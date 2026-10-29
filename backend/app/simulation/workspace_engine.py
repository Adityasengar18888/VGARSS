"""Workspace CPU Scheduler & Resource Engine Manager (VGARSS 2.0).

Coordinates discrete-event simulation, process management, concurrency synchronization,
deadlock detection, and real-time chat telemetry across workspaces.
"""
import asyncio
import json
import logging
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple, Any

from backend.app.simulation.models import (
    ProcessState,
    ProcessControlBlock,
    ProcessDefinition,
    GanttEntry,
    SimulationMetrics,
)
from backend.app.simulation.schedulers import (
    BaseScheduler,
    FCFSScheduler,
    SJFScheduler,
    RoundRobinScheduler,
    PriorityScheduler,
)
from backend.app.simulation.resources import (
    ResourceManager,
    ResourceDefinition,
    ResourceType,
    ResourceMode,
)
from backend.app.simulation.resources.models import AllocationRecord
from backend.app.network.chat_hub import chat_hub

logger = logging.getLogger(__name__)

PRIORITY_NUMERIC_MAP = {
    "CRITICAL": 1,
    "HIGH": 2,
    "MEDIUM": 3,
    "LOW": 4,
}


class WorkspaceSchedulerEngine:
    """Manages the OS Process Scheduler and Shared Resource Pool for a single Workspace."""

    def __init__(self, workspace_id: str, algorithm: str = "ROUND_ROBIN", time_quantum: int = 2):
        self.workspace_id = workspace_id
        self.algorithm = algorithm.upper()
        self.time_quantum = time_quantum
        self.aging_interval: Optional[int] = 5
        self.is_preemptive: bool = True
        self._lock = threading.RLock()

        # Instantiate scheduler
        self.scheduler: BaseScheduler = self._create_scheduler(self.algorithm, self.time_quantum)

        # Simulation clock & state
        self.current_tick: int = 0
        self.busy_ticks: int = 0
        self.idle_ticks: int = 0
        self.current_quantum_ticks: int = 0

        self.running_task_id: Optional[str] = None
        self.ready_queue: List[str] = []      # task_ids
        self.waiting_queue: List[str] = []    # task_ids
        self.terminated_queue: List[str] = [] # task_ids
        self.gantt_history: List[dict] = []

        # Process metadata lookup: task_id -> dict
        self.tasks_meta: Dict[str, dict] = {}

        # Resource manager
        self.resource_manager = ResourceManager()

    def _create_scheduler(self, algorithm: str, time_quantum: int) -> BaseScheduler:
        algo = algorithm.upper()
        if algo == "FCFS":
            return FCFSScheduler()
        elif algo == "SJF":
            return SJFScheduler(is_preemptive=False)
        elif algo == "SRTF":
            return SJFScheduler(is_preemptive=True)
        elif algo == "ROUND_ROBIN":
            return RoundRobinScheduler(time_quantum=time_quantum)
        elif "PRIORITY" in algo:
            return PriorityScheduler(is_preemptive=self.is_preemptive, aging_interval=self.aging_interval)
        return RoundRobinScheduler(time_quantum=time_quantum)

    def set_policy(self, algorithm: str, time_quantum: int = 2, is_preemptive: bool = True, aging_interval: Optional[int] = 5):
        with self._lock:
            self.algorithm = algorithm.upper()
            self.time_quantum = time_quantum
            self.is_preemptive = is_preemptive
            self.aging_interval = aging_interval
            self.scheduler = self._create_scheduler(self.algorithm, self.time_quantum)
            self.current_quantum_ticks = 0

    def _resolve_resource_id(self, resource_id: str) -> str:
        """Resolves generic or prefix-based resource IDs to the workspace resource ID."""
        if resource_id in self.resource_manager.resources:
            return resource_id
        for rid in self.resource_manager.resources:
            if rid.startswith(resource_id) or resource_id in rid:
                return rid
        return resource_id

    def sync_from_db(self, db: sqlite3.Connection):
        """Loads all workspace tasks and resources from SQLite into engine memory."""
        with self._lock:
            # Sync Resources
            res_rows = db.execute("SELECT * FROM resources WHERE workspace_id = ?", (self.workspace_id,)).fetchall()
            if len(res_rows) == 0:
                defaults = [
                    (f"res-mutex-gpu-{self.workspace_id[:8]}", "GPU Matrix Accelerator", "MUTEX", 1, "Exclusive high-performance tensor accelerator", 1),
                    (f"res-sem-io-{self.workspace_id[:8]}", "DMA Channel Pool", "SEMAPHORE", 3, "High-speed Direct Memory Access channels", 2),
                    (f"res-mutex-db-{self.workspace_id[:8]}", "Kernel Page Lock", "MUTEX", 1, "Shared memory translation lookaside buffer lock", 3),
                ]
                for rid, rname, rtype_str, rcap, rdesc, rrank in defaults:
                    db.execute(
                        """
                        INSERT OR IGNORE INTO resources (id, workspace_id, name, resource_type, total_capacity, available_units, description, order_rank)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (rid, self.workspace_id, rname, rtype_str, rcap, rcap, rdesc, rrank),
                    )
                db.commit()
                res_rows = db.execute("SELECT * FROM resources WHERE workspace_id = ?", (self.workspace_id,)).fetchall()

            for r in res_rows:
                r_id = r["id"]
                if r_id not in self.resource_manager.resources:
                    rtype = ResourceType.MUTEX if r["resource_type"].upper() == "MUTEX" else ResourceType.SEMAPHORE
                    r_rank = r["order_rank"] if "order_rank" in r.keys() else 1
                    self.resource_manager.register_resource(
                        ResourceDefinition(
                            id=r_id,
                            name=r["name"],
                            total_capacity=r["total_capacity"],
                            resource_type=rtype,
                            order_rank=r_rank,
                        )
                    )

            # Sync Tasks
            task_rows = db.execute(
                """
                SELECT t.*, u_c.display_name AS creator_name, u_a.display_name AS assignee_name
                FROM tasks t
                JOIN users u_c ON t.creator_id = u_c.id
                LEFT JOIN users u_a ON t.assignee_id = u_a.id
                WHERE t.workspace_id = ?
                """,
                (self.workspace_id,),
            ).fetchall()

            for tr in task_rows:
                tid = tr["id"]
                arr_time = tr["arrival_time"] if "arrival_time" in tr.keys() and tr["arrival_time"] is not None else 0
                rem_ticks = tr["remaining_burst_ticks"] if "remaining_burst_ticks" in tr.keys() and tr["remaining_burst_ticks"] is not None else tr["estimated_burst_ticks"]
                
                # Fetch required resources
                alloc_rows = db.execute("SELECT resource_id FROM task_resource_allocations WHERE task_id = ?", (tid,)).fetchall()
                req_res = [ar["resource_id"] for ar in alloc_rows]

                if tid not in self.tasks_meta:
                    self.tasks_meta[tid] = {
                        "id": tid,
                        "workspace_id": tr["workspace_id"],
                        "channel_id": tr["channel_id"],
                        "source_message_id": tr["source_message_id"],
                        "creator_id": tr["creator_id"],
                        "creator_name": tr["creator_name"] or "Unknown",
                        "assignee_id": tr["assignee_id"],
                        "assignee_name": tr["assignee_name"] or "Unassigned",
                        "title": tr["title"],
                        "description": tr["description"] or "",
                        "priority": tr["priority"],
                        "numeric_priority": tr["numeric_priority"],
                        "arrival_time": arr_time,
                        "deadline": str(tr["deadline"]) if tr["deadline"] else None,
                        "estimated_burst_ticks": tr["estimated_burst_ticks"],
                        "remaining_burst_ticks": rem_ticks,
                        "status": tr["status"],
                        "start_tick": tr["start_tick"] if "start_tick" in tr.keys() else None,
                        "completion_tick": tr["completion_tick"] if "completion_tick" in tr.keys() else None,
                        "waiting_ticks": tr["waiting_ticks"] if "waiting_ticks" in tr.keys() else 0,
                        "turnaround_ticks": tr["turnaround_ticks"] if "turnaround_ticks" in tr.keys() else 0,
                        "response_ticks": tr["response_ticks"] if "response_ticks" in tr.keys() else 0,
                        "required_resources": req_res,
                        "held_resources": [],
                        "waiting_on_resource": None,
                        "created_at": str(tr["created_at"]),
                    }

                    # Place into appropriate queue if not already placed
                    st = tr["status"]
                    if st == "RUNNING" and not self.running_task_id:
                        self.running_task_id = tid
                    elif st == "READY" and tid not in self.ready_queue:
                        self.ready_queue.append(tid)
                    elif st == "WAITING" and tid not in self.waiting_queue:
                        self.waiting_queue.append(tid)
                    elif st == "TERMINATED" and tid not in self.terminated_queue:
                        self.terminated_queue.append(tid)

    def admit_task(self, task_id: str, db: sqlite3.Connection) -> dict:
        """Admits a task from NEW to READY queue."""
        with self._lock:
            meta = self.tasks_meta.get(task_id)
            if not meta:
                self.sync_from_db(db)
                meta = self.tasks_meta.get(task_id)
            if not meta:
                raise KeyError(f"Task '{task_id}' not found.")

            meta["status"] = "READY"
            if task_id not in self.ready_queue:
                self.ready_queue.append(task_id)

            db.execute("UPDATE tasks SET status = 'READY', updated_at = CURRENT_TIMESTAMP WHERE id = ?", (task_id,))
            return meta

    def step(self, db: sqlite3.Connection) -> Tuple[dict, List[dict]]:
        """Executes a single discrete simulation tick, evaluates scheduler policy, and returns event notifications."""
        with self._lock:
            self.sync_from_db(db)
            events_to_emit: List[dict] = []

            # 1. Admit any NEW tasks whose arrival_time <= current_tick
            for tid, meta in self.tasks_meta.items():
                if meta["status"] == "NEW" and meta["arrival_time"] <= self.current_tick:
                    meta["status"] = "READY"
                    if tid not in self.ready_queue:
                        self.ready_queue.append(tid)
                    db.execute("UPDATE tasks SET status = 'READY', updated_at = CURRENT_TIMESTAMP WHERE id = ?", (tid,))
                    events_to_emit.append({
                        "task_id": tid,
                        "channel_id": meta["channel_id"],
                        "event_type": "TASK_ADMITTED",
                        "message": f"⚡ Task [{tid}] \"{meta['title']}\" arrived at Tick {self.current_tick} and entered READY queue.",
                        "new_status": "READY",
                    })

            # Build PCB instances for scheduler selection
            ready_pcbs: List[ProcessControlBlock] = []
            for tid in self.ready_queue:
                m = self.tasks_meta[tid]
                pcb = ProcessControlBlock(
                    id=m["id"],
                    arrival_time=m["arrival_time"],
                    burst_time=m["estimated_burst_ticks"],
                    remaining_time=m["remaining_burst_ticks"],
                    priority=m["numeric_priority"],
                    base_priority=m["numeric_priority"],
                    state=ProcessState.READY,
                    waiting_time=m["waiting_ticks"],
                )
                ready_pcbs.append(pcb)

            running_pcb: Optional[ProcessControlBlock] = None
            if self.running_task_id:
                m = self.tasks_meta[self.running_task_id]
                running_pcb = ProcessControlBlock(
                    id=m["id"],
                    arrival_time=m["arrival_time"],
                    burst_time=m["estimated_burst_ticks"],
                    remaining_time=m["remaining_burst_ticks"],
                    priority=m["numeric_priority"],
                    base_priority=m["numeric_priority"],
                    state=ProcessState.RUNNING,
                    waiting_time=m["waiting_ticks"],
                )

            # 2. Check for preemption
            if running_pcb is not None:
                if self.scheduler.should_preempt(running_pcb, ready_pcbs, self.current_quantum_ticks, self.current_tick):
                    preempted_id = running_pcb.id
                    self.tasks_meta[preempted_id]["status"] = "READY"
                    self.ready_queue.append(preempted_id)
                    self.running_task_id = None
                    self.current_quantum_ticks = 0
                    db.execute("UPDATE tasks SET status = 'READY', updated_at = CURRENT_TIMESTAMP WHERE id = ?", (preempted_id,))
                    events_to_emit.append({
                        "task_id": preempted_id,
                        "channel_id": self.tasks_meta[preempted_id]["channel_id"],
                        "event_type": "TASK_PREEMPTED",
                        "message": f"⚡ Task [{preempted_id}] was preempted by scheduler and returned to READY queue.",
                        "new_status": "READY",
                    })
                    # Rebuild ready pcbs
                    ready_pcbs.append(running_pcb)
                    running_pcb = None

            # 3. CPU Dispatch if idle
            if self.running_task_id is None and ready_pcbs:
                candidate = self.scheduler.select_next(ready_pcbs, None, self.current_tick)
                if candidate is not None:
                    cand_id = candidate.id
                    self.ready_queue.remove(cand_id)
                    self.running_task_id = cand_id
                    meta = self.tasks_meta[cand_id]
                    meta["status"] = "RUNNING"
                    self.current_quantum_ticks = 0

                    if meta["start_tick"] is None:
                        meta["start_tick"] = self.current_tick
                        meta["response_ticks"] = self.current_tick - meta["arrival_time"]

                    db.execute(
                        "UPDATE tasks SET status = 'RUNNING', start_tick = COALESCE(start_tick, ?), response_ticks = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                        (self.current_tick, meta["response_ticks"], cand_id),
                    )

                    events_to_emit.append({
                        "task_id": cand_id,
                        "channel_id": meta["channel_id"],
                        "event_type": "TASK_DISPATCHED",
                        "message": f"⚡ Task [{cand_id}] \"{meta['title']}\" dispatched to CPU (Tick {self.current_tick}).",
                        "new_status": "RUNNING",
                    })

            # 4. Execute 1 Tick Burst
            if self.running_task_id:
                meta = self.tasks_meta[self.running_task_id]
                meta["remaining_burst_ticks"] -= 1
                self.busy_ticks += 1
                self.current_quantum_ticks += 1
                g_entry = {
                    "tick": self.current_tick,
                    "process_id": self.running_task_id,
                    "state": "RUNNING",
                    "task_title": meta["title"],
                }
            else:
                self.idle_ticks += 1
                g_entry = {
                    "tick": self.current_tick,
                    "process_id": None,
                    "state": "IDLE",
                    "task_title": "CPU Idle",
                }

            self.gantt_history.append(g_entry)

            # 5. Accumulate waiting time for ready tasks
            for tid in self.ready_queue:
                self.tasks_meta[tid]["waiting_ticks"] += 1
                db.execute("UPDATE tasks SET waiting_ticks = waiting_ticks + 1 WHERE id = ?", (tid,))

            # 6. Advance logical clock
            self.current_tick += 1

            # 7. Check for termination of executed task
            if self.running_task_id:
                meta = self.tasks_meta[self.running_task_id]
                if meta["remaining_burst_ticks"] <= 0:
                    term_id = self.running_task_id
                    meta["status"] = "TERMINATED"
                    meta["completion_tick"] = self.current_tick
                    meta["turnaround_ticks"] = self.current_tick - meta["arrival_time"]
                    self.terminated_queue.append(term_id)
                    self.running_task_id = None
                    self.current_quantum_ticks = 0

                    db.execute(
                        """
                        UPDATE tasks
                        SET status = 'TERMINATED', remaining_burst_ticks = 0,
                            completion_tick = ?, turnaround_ticks = ?, updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                        """,
                        (self.current_tick, meta["turnaround_ticks"], term_id),
                    )

                    # Auto-release all resources held by terminated task
                    awakened = self.resource_manager.handle_process_disconnect(term_id)
                    for awk_id in awakened:
                        self._wake_task(awk_id, db, events_to_emit)

                    events_to_emit.append({
                        "task_id": term_id,
                        "channel_id": meta["channel_id"],
                        "event_type": "TASK_COMPLETED",
                        "message": f"⚡ Task [{term_id}] completed at Tick {self.current_tick}! (Turnaround: {meta['turnaround_ticks']} ticks, Wait: {meta['waiting_ticks']} ticks).",
                        "new_status": "TERMINATED",
                    })
                else:
                    db.execute(
                        "UPDATE tasks SET remaining_burst_ticks = ? WHERE id = ?",
                        (meta["remaining_burst_ticks"], self.running_task_id),
                    )

            state = self.get_state()
            return state, events_to_emit

    def request_resource(self, task_id: str, resource_id: str, mode: str, units: int, db: sqlite3.Connection) -> Tuple[bool, List[dict]]:
        """Task requests resource acquisition. If denied, transitions task to WAITING and enqueues it."""
        with self._lock:
            self.sync_from_db(db)
            resource_id = self._resolve_resource_id(resource_id)
            meta = self.tasks_meta.get(task_id)
            if not meta:
                raise KeyError(f"Task '{task_id}' not found.")

            res_mode = ResourceMode.EXCLUSIVE if mode.upper() == "EXCLUSIVE" else ResourceMode.SHARED
            granted = self.resource_manager.acquire(
                process_id=task_id,
                resource_id=resource_id,
                mode=res_mode,
                units=units,
                current_tick=self.current_tick,
            )

            res_obj = self.resource_manager.get_resource(resource_id)
            events: List[dict] = []

            if granted:
                meta["held_resources"].append(resource_id)
                meta["waiting_on_resource"] = None
                alloc_id = f"alloc-{uuid.uuid4().hex[:8]}"
                db.execute(
                    """
                    INSERT INTO task_resource_allocations (id, task_id, resource_id, requested_units, allocated_units, status, acquired_at)
                    VALUES (?, ?, ?, ?, ?, 'HELD', CURRENT_TIMESTAMP)
                    """,
                    (alloc_id, task_id, resource_id, units, units),
                )
                db.execute(
                    "UPDATE resources SET available_units = ?, exclusive_holder = ? WHERE id = ?",
                    (res_obj.available_units, res_obj.exclusive_holder, resource_id),
                )
                events.append({
                    "task_id": task_id,
                    "channel_id": meta["channel_id"],
                    "event_type": "RESOURCE_ACQUIRED",
                    "message": f"⚡ Task [{task_id}] acquired resource [{resource_id}] ({mode.upper()}, {units} unit(s)).",
                    "new_status": meta["status"],
                })
            else:
                # Transition to WAITING
                meta["status"] = "WAITING"
                meta["waiting_on_resource"] = resource_id
                if self.running_task_id == task_id:
                    self.running_task_id = None
                    self.current_quantum_ticks = 0
                if task_id in self.ready_queue:
                    self.ready_queue.remove(task_id)
                if task_id not in self.waiting_queue:
                    self.waiting_queue.append(task_id)

                db.execute("UPDATE tasks SET status = 'WAITING', updated_at = CURRENT_TIMESTAMP WHERE id = ?", (task_id,))
                events.append({
                    "task_id": task_id,
                    "channel_id": meta["channel_id"],
                    "event_type": "RESOURCE_BLOCKED",
                    "message": f"⚡ Task [{task_id}] blocked waiting for resource [{resource_id}] (state: WAITING).",
                    "new_status": "WAITING",
                })

            return granted, events

    def release_resource(self, task_id: str, resource_id: str, units: Optional[int], db: sqlite3.Connection) -> Tuple[List[str], List[dict]]:
        """Task releases held resource. Awakened tasks transition WAITING -> READY."""
        with self._lock:
            self.sync_from_db(db)
            resource_id = self._resolve_resource_id(resource_id)
            meta = self.tasks_meta.get(task_id)
            if not meta:
                raise KeyError(f"Task '{task_id}' not found.")

            # Validate that task actually holds this resource
            held_ranks = self.resource_manager._get_held_ranks(task_id)
            res_obj = self.resource_manager.get_resource(resource_id)
            if res_obj.order_rank not in held_ranks and res_obj.exclusive_holder != task_id and task_id not in res_obj.shared_holders:
                raise PermissionError(f"Task '{task_id}' does not hold resource '{resource_id}'. Cannot release.")

            awakened = self.resource_manager.release(task_id, resource_id, units)
            if resource_id in meta["held_resources"]:
                meta["held_resources"].remove(resource_id)

            db.execute(
                "UPDATE task_resource_allocations SET status = 'RELEASED', released_at = CURRENT_TIMESTAMP WHERE task_id = ? AND resource_id = ? AND status = 'HELD'",
                (task_id, resource_id),
            )
            db.execute(
                "UPDATE resources SET available_units = ?, exclusive_holder = ? WHERE id = ?",
                (res_obj.available_units, res_obj.exclusive_holder, resource_id),
            )

            events: List[dict] = [{
                "task_id": task_id,
                "channel_id": meta["channel_id"],
                "event_type": "RESOURCE_RELEASED",
                "message": f"⚡ Task [{task_id}] released resource [{resource_id}].",
                "new_status": meta["status"],
            }]

            for awk_id in awakened:
                self._wake_task(awk_id, db, events)

            return awakened, events

    def _wake_task(self, task_id: str, db: sqlite3.Connection, events: List[dict]):
        """Internal helper transitioning a task from WAITING to READY."""
        m = self.tasks_meta.get(task_id)
        if m:
            if task_id in self.waiting_queue:
                self.waiting_queue.remove(task_id)
            m["status"] = "READY"
            m["waiting_on_resource"] = None
            if task_id not in self.ready_queue:
                self.ready_queue.append(task_id)
            db.execute("UPDATE tasks SET status = 'READY', updated_at = CURRENT_TIMESTAMP WHERE id = ?", (task_id,))
            events.append({
                "task_id": task_id,
                "channel_id": m["channel_id"],
                "event_type": "TASK_UNBLOCKED",
                "message": f"⚡ Task [{task_id}] unblocked and returned to READY queue.",
                "new_status": "READY",
            })

    def check_deadlock(self) -> dict:
        """Runs Wait-For Graph cycle detection across all workspace resources."""
        with self._lock:
            cycle = self.resource_manager.check_deadlock()
            if cycle:
                return {
                    "deadlock_detected": True,
                    "cycle_tasks": cycle.processes,
                    "cycle_resources": cycle.involved_resources,
                    "description": cycle.description,
                    "recommended_action": f"Abort or preempt task '{cycle.processes[0]}' to break circular wait.",
                }
            return {
                "deadlock_detected": False,
                "cycle_tasks": [],
                "cycle_resources": [],
                "description": "No circular wait detected. System state is safe.",
                "recommended_action": None,
            }

    def cancel_or_abort_task(self, task_id: str, db: sqlite3.Connection) -> Tuple[List[str], List[dict]]:
        """Handles task cancellation or disconnect recovery by releasing all held resources."""
        with self._lock:
            meta = self.tasks_meta.get(task_id)
            if not meta:
                raise KeyError(f"Task '{task_id}' not found.")

            awakened = self.resource_manager.handle_process_disconnect(task_id)
            if self.running_task_id == task_id:
                self.running_task_id = None
                self.current_quantum_ticks = 0
            if task_id in self.ready_queue:
                self.ready_queue.remove(task_id)
            if task_id in self.waiting_queue:
                self.waiting_queue.remove(task_id)

            meta["status"] = "TERMINATED"
            if task_id not in self.terminated_queue:
                self.terminated_queue.append(task_id)

            db.execute("UPDATE tasks SET status = 'TERMINATED', updated_at = CURRENT_TIMESTAMP WHERE id = ?", (task_id,))
            db.execute(
                "UPDATE task_resource_allocations SET status = 'RELEASED', released_at = CURRENT_TIMESTAMP WHERE task_id = ? AND status = 'HELD'",
                (task_id,),
            )

            events: List[dict] = [{
                "task_id": task_id,
                "channel_id": meta["channel_id"],
                "event_type": "TASK_CANCELLED",
                "message": f"⚡ Task [{task_id}] was aborted/disconnected. All held resources safely released.",
                "new_status": "TERMINATED",
            }]

            for awk_id in awakened:
                self._wake_task(awk_id, db, events)

            return awakened, events

    def reset(self, db: sqlite3.Connection):
        """Resets ticks, queues, and task progress to initial state."""
        with self._lock:
            self.current_tick = 0
            self.busy_ticks = 0
            self.idle_ticks = 0
            self.current_quantum_ticks = 0
            self.running_task_id = None
            self.ready_queue = []
            self.waiting_queue = []
            self.terminated_queue = []
            self.gantt_history = []
            self.resource_manager.reset()

            # Reset task remaining ticks
            for meta in self.tasks_meta.values():
                meta["remaining_burst_ticks"] = meta["estimated_burst_ticks"]
                meta["status"] = "NEW"
                meta["waiting_ticks"] = 0
                meta["turnaround_ticks"] = 0
                meta["response_ticks"] = 0
                meta["start_tick"] = None
                meta["completion_tick"] = None
                meta["held_resources"] = []
                meta["waiting_on_resource"] = None

            db.execute(
                """
                UPDATE tasks
                SET status = 'NEW', remaining_burst_ticks = estimated_burst_ticks,
                    waiting_ticks = 0, turnaround_ticks = 0, response_ticks = 0,
                    start_tick = NULL, completion_tick = NULL, updated_at = CURRENT_TIMESTAMP
                WHERE workspace_id = ?
                """,
                (self.workspace_id,),
            )
            db.execute(
                """
                UPDATE resources
                SET available_units = total_capacity, exclusive_holder = NULL
                WHERE workspace_id = ?
                """,
                (self.workspace_id,),
            )
            db.execute(
                """
                UPDATE task_resource_allocations
                SET status = 'RELEASED', released_at = CURRENT_TIMESTAMP
                WHERE task_id IN (SELECT id FROM tasks WHERE workspace_id = ?)
                """,
                (self.workspace_id,),
            )

    def get_metrics(self) -> dict:
        total = self.current_tick
        busy = self.busy_ticks
        idle = self.idle_ticks
        cpu_util = (busy / total * 100.0) if total > 0 else 0.0
        n_term = len(self.terminated_queue)
        throughput = (n_term / total) if total > 0 else 0.0

        term_metas = [self.tasks_meta[tid] for tid in self.terminated_queue if tid in self.tasks_meta]
        if term_metas:
            avg_wt = sum(m["waiting_ticks"] for m in term_metas) / len(term_metas)
            avg_tat = sum(m["turnaround_ticks"] for m in term_metas) / len(term_metas)
            avg_rt = sum(m["response_ticks"] for m in term_metas) / len(term_metas)
        else:
            avg_wt = 0.0
            avg_tat = 0.0
            avg_rt = 0.0

        return {
            "total_ticks": total,
            "busy_ticks": busy,
            "idle_ticks": idle,
            "cpu_utilization": round(cpu_util, 2),
            "throughput": round(throughput, 4),
            "avg_waiting_time": round(avg_wt, 2),
            "avg_turnaround_time": round(avg_tat, 2),
            "avg_response_time": round(avg_rt, 2),
        }

    def get_state(self) -> dict:
        return {
            "workspace_id": self.workspace_id,
            "current_tick": self.current_tick,
            "algorithm": self.algorithm,
            "time_quantum": self.time_quantum,
            "aging_interval": self.aging_interval,
            "is_preemptive": self.is_preemptive,
            "running_task_id": self.running_task_id,
            "running_task": self.tasks_meta.get(self.running_task_id) if self.running_task_id else None,
            "ready_queue": [self.tasks_meta[tid] for tid in self.ready_queue if tid in self.tasks_meta],
            "waiting_queue": [self.tasks_meta[tid] for tid in self.waiting_queue if tid in self.tasks_meta],
            "terminated_tasks": [self.tasks_meta[tid] for tid in self.terminated_queue if tid in self.tasks_meta],
            "gantt_history": self.gantt_history,
            "metrics": self.get_metrics(),
        }

    def get_resource_statuses(self) -> List[dict]:
        with self._lock:
            statuses = []
            for res_id, res in self.resource_manager.resources.items():
                waiters = []
                for w in res.wait_queue:
                    task_title = self.tasks_meta.get(w.process_id, {}).get("title", w.process_id)
                    waiters.append({
                        "task_id": w.process_id,
                        "task_title": task_title,
                        "requested_units": w.units,
                        "mode": w.mode.value,
                    })

                statuses.append({
                    "id": res.id,
                    "workspace_id": self.workspace_id,
                    "name": res.name,
                    "resource_type": res.resource_type.value,
                    "total_capacity": res.total_capacity,
                    "available_units": res.available_units,
                    "exclusive_holder_task_id": res.exclusive_holder,
                    "exclusive_holder_name": self.tasks_meta.get(res.exclusive_holder, {}).get("title") if res.exclusive_holder else None,
                    "shared_holders": dict(res.shared_holders),
                    "wait_queue": waiters,
                    "order_rank": res.order_rank,
                    "description": "",
                })
            return statuses


class WorkspaceEngineManager:
    """Singleton managing active WorkspaceSchedulerEngine instances."""

    def __init__(self):
        self._engines: Dict[str, WorkspaceSchedulerEngine] = {}
        self._lock = threading.Lock()

    def get_engine(self, workspace_id: str, db: sqlite3.Connection) -> WorkspaceSchedulerEngine:
        with self._lock:
            if workspace_id not in self._engines:
                eng = WorkspaceSchedulerEngine(workspace_id)
                eng.sync_from_db(db)
                self._engines[workspace_id] = eng
            return self._engines[workspace_id]


workspace_engine_manager = WorkspaceEngineManager()
