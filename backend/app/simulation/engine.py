"""VGARSS Core Simulation Engine.

Operates on a discrete logical simulation clock (no wall-clock sleeps).
Manages 5-state process transitions, scheduling dispatch decisions,
Gantt chart event tracking, and metric evaluations.
"""
from typing import List, Optional, Dict
from backend.app.simulation.models import (
    ProcessState,
    ProcessControlBlock,
    ProcessDefinition,
    GanttEntry,
    SimulationMetrics,
    SimulationSnapshot,
)
from backend.app.simulation.schedulers.base import BaseScheduler


class SimulationEngine:
    """Deterministic, discrete-event OS Process Scheduling Simulation Engine."""

    def __init__(
        self,
        scheduler: BaseScheduler,
        processes: Optional[List[ProcessDefinition]] = None,
        resource_manager: Optional["ResourceManager"] = None,
    ):
        from backend.app.simulation.resources.manager import ResourceManager
        self.scheduler = scheduler
        self.resource_manager: Optional[ResourceManager] = resource_manager
        self.current_tick: int = 0
        self.busy_ticks: int = 0
        self.idle_ticks: int = 0
        self.current_quantum_ticks: int = 0
        
        self.running_process: Optional[ProcessControlBlock] = None
        self.ready_queue: List[ProcessControlBlock] = []
        self.waiting_queue: List[ProcessControlBlock] = []
        self.terminated_processes: List[ProcessControlBlock] = []
        self.new_processes: List[ProcessControlBlock] = []
        self.gantt_chart: List[GanttEntry] = []
        self._admission_counter: int = 0
        self._pcb_lookup: Dict[str, ProcessControlBlock] = {}

        if processes:
            self.load_processes(processes)

    def load_processes(self, processes: List[ProcessDefinition]) -> None:
        """Validates and loads a collection of process definitions into the simulation."""
        # Check for duplicate IDs
        seen_ids = set()
        for p in processes:
            if p.id in seen_ids:
                raise ValueError(f"Duplicate process ID detected: '{p.id}'. Process IDs must be unique.")
            seen_ids.add(p.id)

        # Stable sort by arrival time to preserve explicit ingestion order
        sorted_defs = sorted(processes, key=lambda x: x.arrival_time)
        for p_def in sorted_defs:
            self.add_process(p_def)

    def add_process(self, p_def: ProcessDefinition) -> ProcessControlBlock:
        """Dynamically ingests a process definition into the simulation."""
        if p_def.id in self._pcb_lookup:
            raise ValueError(f"Process with ID '{p_def.id}' already exists in simulation.")

        pcb = ProcessControlBlock.from_definition(p_def, admission_order=self._admission_counter)
        self._admission_counter += 1
        self._pcb_lookup[pcb.id] = pcb

        if pcb.arrival_time <= self.current_tick:
            # Immediate admission to ready queue
            pcb.state = ProcessState.READY
            self.ready_queue.append(pcb)
        else:
            self.new_processes.append(pcb)

        return pcb

    def is_completed(self) -> bool:
        """Returns True if all admitted processes have reached TERMINATED state."""
        return (
            len(self.new_processes) == 0
            and len(self.ready_queue) == 0
            and len(self.waiting_queue) == 0
            and self.running_process is None
        )

    def reset(self) -> None:
        """Resets the simulation engine state cleanly to tick 0."""
        self.current_tick = 0
        self.busy_ticks = 0
        self.idle_ticks = 0
        self.current_quantum_ticks = 0
        self.running_process = None
        self.ready_queue = []
        self.waiting_queue = []
        self.terminated_processes = []
        self.new_processes = []
        self.gantt_chart = []

        # Reset all PCB instances to initial state
        for pcb in self._pcb_lookup.values():
            pcb.state = ProcessState.NEW
            pcb.remaining_time = pcb.burst_time
            pcb.start_time = None
            pcb.completion_time = None
            pcb.waiting_time = 0
            pcb.turnaround_time = 0
            pcb.response_time = 0
            if pcb.arrival_time <= 0:
                pcb.state = ProcessState.READY
                self.ready_queue.append(pcb)
            else:
                self.new_processes.append(pcb)

        if self.resource_manager:
            self.resource_manager.reset()

    def step(self) -> SimulationSnapshot:
        """Executes a single discrete simulation tick (from current_tick to current_tick + 1)."""
        # 1. Admit new arrivals whose arrival_time <= current_tick
        arrived = [p for p in self.new_processes if p.arrival_time <= self.current_tick]
        for p in arrived:
            self.new_processes.remove(p)
            p.state = ProcessState.READY
            self.ready_queue.append(p)

        # 2. Check for preemption if a process is currently running
        if self.running_process is not None:
            if self.scheduler.should_preempt(
                self.running_process,
                self.ready_queue,
                self.current_quantum_ticks,
                self.current_tick,
            ):
                self.running_process.state = ProcessState.READY
                self.ready_queue.append(self.running_process)
                self.running_process = None
                self.current_quantum_ticks = 0

        # 3. CPU Dispatch if idle
        if self.running_process is None and self.ready_queue:
            candidate = self.scheduler.select_next(self.ready_queue, None, self.current_tick)
            if candidate is not None:
                self.ready_queue.remove(candidate)
                self.running_process = candidate
                self.running_process.state = ProcessState.RUNNING
                self.current_quantum_ticks = 0
                
                # First time dispatched
                if self.running_process.start_time is None:
                    self.running_process.start_time = self.current_tick
                    self.running_process.response_time = self.current_tick - self.running_process.arrival_time

        # 4. Execute 1 Tick Burst
        if self.running_process is not None:
            gantt_entry = GanttEntry(
                tick=self.current_tick,
                process_id=self.running_process.id,
                state="RUNNING",
            )
            self.running_process.remaining_time -= 1
            self.busy_ticks += 1
            self.current_quantum_ticks += 1
        else:
            gantt_entry = GanttEntry(
                tick=self.current_tick,
                process_id=None,
                state="IDLE",
            )
            self.idle_ticks += 1

        self.gantt_chart.append(gantt_entry)

        # 5. Accumulate waiting time for processes in ready queue
        for p in self.ready_queue:
            p.waiting_time += 1

        # Hook for scheduler tick end (e.g. aging)
        self.scheduler.on_tick_end(self.ready_queue, self.running_process, self.current_tick)

        # 6. Advance logical clock
        self.current_tick += 1

        # 7. Check for termination of the executed process
        if self.running_process is not None and self.running_process.remaining_time == 0:
            terminated_id = self.running_process.id
            self.running_process.state = ProcessState.TERMINATED
            self.running_process.completion_time = self.current_tick
            self.running_process.calculate_final_metrics()
            self.terminated_processes.append(self.running_process)
            self.running_process = None
            self.current_quantum_ticks = 0

            # Automatically release all locks held by terminating process
            if self.resource_manager:
                awakened = self.resource_manager.handle_process_disconnect(terminated_id)
                for pid in awakened:
                    self._wake_process(pid)

        # 8. Produce snapshot
        snapshot = SimulationSnapshot(
            tick=self.current_tick,
            running_process_id=self.running_process.id if self.running_process else None,
            ready_queue=[p.id for p in self.ready_queue],
            waiting_queue=[p.id for p in self.waiting_queue],
            terminated_processes=[p.id for p in self.terminated_processes],
            metrics=self.get_metrics(),
            gantt_entry=gantt_entry,
        )
        return snapshot

    def run_until_completion(self, max_ticks: int = 10000) -> List[SimulationSnapshot]:
        """Runs the simulation consecutively until all processes terminate or max_ticks is reached."""
        snapshots = []
        while not self.is_completed() and self.current_tick < max_ticks:
            snapshot = self.step()
            snapshots.append(snapshot)
        return snapshots

    def get_metrics(self) -> SimulationMetrics:
        """Calculates exact aggregate mathematical performance metrics."""
        total = self.current_tick
        busy = self.busy_ticks
        idle = self.idle_ticks
        
        cpu_util = (busy / total * 100.0) if total > 0 else 0.0
        n_term = len(self.terminated_processes)
        throughput = (n_term / total) if total > 0 else 0.0

        if n_term > 0:
            avg_wt = sum(p.waiting_time for p in self.terminated_processes) / n_term
            avg_tat = sum(p.turnaround_time for p in self.terminated_processes) / n_term
            avg_rt = sum(p.response_time for p in self.terminated_processes) / n_term
        else:
            avg_wt = 0.0
            avg_tat = 0.0
            avg_rt = 0.0

        return SimulationMetrics(
            total_ticks=total,
            busy_ticks=busy,
            idle_ticks=idle,
            cpu_utilization=round(cpu_util, 2),
            throughput=round(throughput, 4),
            avg_waiting_time=round(avg_wt, 2),
            avg_turnaround_time=round(avg_tat, 2),
            avg_response_time=round(avg_rt, 2),
        )

    def get_pcb(self, process_id: str) -> Optional[ProcessControlBlock]:
        """Retrieves the live PCB of any process."""
        return self._pcb_lookup.get(process_id)

    def request_resource(
        self,
        process_id: str,
        resource_id: str,
        mode: Optional["ResourceMode"] = None,
        units: int = 1,
    ) -> bool:
        """Process requests a resource. If denied, transitions process RUNNING -> WAITING."""
        from backend.app.simulation.resources.models import ResourceMode
        if mode is None:
            mode = ResourceMode.EXCLUSIVE
        if not self.resource_manager:
            raise RuntimeError("SimulationEngine has no configured ResourceManager.")

        pcb = self._pcb_lookup.get(process_id)
        if not pcb:
            raise KeyError(f"Process '{process_id}' not found.")

        granted = self.resource_manager.acquire(
            process_id=process_id,
            resource_id=resource_id,
            mode=mode,
            units=units,
            current_tick=self.current_tick,
        )

        if not granted:
            # Transition to WAITING state
            pcb.state = ProcessState.WAITING
            if self.running_process and self.running_process.id == process_id:
                self.running_process = None
                self.current_quantum_ticks = 0
            if pcb in self.ready_queue:
                self.ready_queue.remove(pcb)
            if pcb not in self.waiting_queue:
                self.waiting_queue.append(pcb)

        return granted

    def release_resource(
        self,
        process_id: str,
        resource_id: str,
        units: Optional[int] = None,
    ) -> List[str]:
        """Process releases a resource. Awakened processes transition WAITING -> READY."""
        if not self.resource_manager:
            raise RuntimeError("SimulationEngine has no configured ResourceManager.")

        awakened = self.resource_manager.release(process_id, resource_id, units)
        for pid in awakened:
            self._wake_process(pid)
        return awakened

    def _wake_process(self, process_id: str) -> None:
        """Internal helper to wake a process from WAITING to READY."""
        pcb = self._pcb_lookup.get(process_id)
        if pcb and pcb in self.waiting_queue:
            self.waiting_queue.remove(pcb)
            pcb.state = ProcessState.READY
            self.ready_queue.append(pcb)

    def cancel_or_disconnect_process(self, process_id: str) -> List[str]:
        """Handles process cancellation, abort, or disconnect recovery."""
        pcb = self._pcb_lookup.get(process_id)
        if not pcb:
            raise KeyError(f"Process '{process_id}' not found.")

        awakened: List[str] = []
        if self.resource_manager:
            awakened = self.resource_manager.handle_process_disconnect(process_id)
            for pid in awakened:
                self._wake_process(pid)

        if self.running_process and self.running_process.id == process_id:
            self.running_process = None
            self.current_quantum_ticks = 0

        if pcb in self.new_processes:
            self.new_processes.remove(pcb)
        if pcb in self.ready_queue:
            self.ready_queue.remove(pcb)
        if pcb in self.waiting_queue:
            self.waiting_queue.remove(pcb)

        pcb.state = ProcessState.TERMINATED
        pcb.completion_time = self.current_tick
        pcb.calculate_final_metrics()
        if pcb not in self.terminated_processes:
            self.terminated_processes.append(pcb)

        return awakened
