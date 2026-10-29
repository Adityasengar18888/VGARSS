"""Task Coordination, CPU Scheduling & Resource Management REST Router (VGARSS 2.0).

Bridges chat-driven collaborative task management with the OS Process Scheduler,
shared resource allocation, deadlock detection, and bi-directional real-time telemetry.
"""
import uuid
import json
import sqlite3
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status

from backend.app.database import get_db
from backend.app.api.deps import get_current_user
from backend.app.api.workspaces_v2 import check_workspace_membership
from backend.app.schemas.chat_v2 import (
    TaskCreate,
    TaskUpdate,
    TaskResponse,
    WorkspaceSchedulerState,
    WorkspaceResourceStatus,
    WorkspaceResourceAcquireRequest,
    WorkspaceResourceReleaseRequest,
    DeadlockReport,
)
from backend.app.network.chat_hub import chat_hub
from backend.app.simulation.workspace_engine import (
    workspace_engine_manager,
    PRIORITY_NUMERIC_MAP,
)

router = APIRouter(tags=["Tasks & OS Scheduling V2"])


def _build_task_response(r: sqlite3.Row, db: sqlite3.Connection) -> TaskResponse:
    tid = r["id"]
    # Get required resources
    req_rows = db.execute("SELECT resource_id FROM task_resource_allocations WHERE task_id = ?", (tid,)).fetchall()
    req_res = [row["resource_id"] for row in req_rows]

    # Get held resources
    held_rows = db.execute(
        "SELECT resource_id FROM task_resource_allocations WHERE task_id = ? AND status = 'HELD'", (tid,)
    ).fetchall()
    held_res = [row["resource_id"] for row in held_rows]

    arr_time = r["arrival_time"] if "arrival_time" in r.keys() and r["arrival_time"] is not None else 0
    rem_ticks = r["remaining_burst_ticks"] if "remaining_burst_ticks" in r.keys() and r["remaining_burst_ticks"] is not None else r["estimated_burst_ticks"]
    wt = r["waiting_ticks"] if "waiting_ticks" in r.keys() and r["waiting_ticks"] is not None else 0
    tat = r["turnaround_ticks"] if "turnaround_ticks" in r.keys() and r["turnaround_ticks"] is not None else 0
    rt = r["response_ticks"] if "response_ticks" in r.keys() and r["response_ticks"] is not None else 0

    return TaskResponse(
        id=tid,
        workspace_id=r["workspace_id"],
        channel_id=r["channel_id"],
        source_message_id=r["source_message_id"],
        creator_id=r["creator_id"],
        creator_name=r["creator_name"] or "Unknown",
        assignee_id=r["assignee_id"],
        assignee_name=r["assignee_name"] or "Unassigned",
        title=r["title"],
        description=r["description"] or "",
        priority=r["priority"],
        numeric_priority=r["numeric_priority"],
        arrival_time=arr_time,
        deadline=str(r["deadline"]) if r["deadline"] else None,
        estimated_burst_ticks=r["estimated_burst_ticks"],
        remaining_burst_ticks=rem_ticks,
        status=r["status"],
        waiting_ticks=wt,
        turnaround_ticks=tat,
        response_ticks=rt,
        required_resources=req_res,
        held_resources=held_res,
        waiting_on_resource=None,
        created_at=str(r["created_at"]),
    )


@router.get("/api/v2/workspaces/{workspace_id}/tasks", response_model=List[TaskResponse])
def list_workspace_tasks(
    workspace_id: str,
    status: Optional[str] = Query(None),
    assignee_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Lists all tasks within a workspace, with optional status and assignee filters."""
    check_workspace_membership(db, workspace_id, current_user["id"])

    sql = """
        SELECT t.*, u_c.display_name AS creator_name, u_a.display_name AS assignee_name
        FROM tasks t
        JOIN users u_c ON t.creator_id = u_c.id
        LEFT JOIN users u_a ON t.assignee_id = u_a.id
        WHERE t.workspace_id = ?
    """
    params = [workspace_id]

    if status:
        sql += " AND t.status = ?"
        params.append(status)
    if assignee_id:
        sql += " AND t.assignee_id = ?"
        params.append(assignee_id)

    sql += " ORDER BY t.numeric_priority ASC, t.arrival_time ASC, t.created_at DESC"
    rows = db.execute(sql, tuple(params)).fetchall()

    return [_build_task_response(r, db) for r in rows]


@router.get("/api/v2/tasks/{task_id}", response_model=TaskResponse)
def get_task_details(
    task_id: str,
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Retrieves full details for a single task."""
    sql = """
        SELECT t.*, u_c.display_name AS creator_name, u_a.display_name AS assignee_name
        FROM tasks t
        JOIN users u_c ON t.creator_id = u_c.id
        LEFT JOIN users u_a ON t.assignee_id = u_a.id
        WHERE t.id = ?
    """
    row = db.execute(sql, (task_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Task not found.")

    check_workspace_membership(db, row["workspace_id"], current_user["id"])
    return _build_task_response(row, db)


@router.post("/api/v2/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: TaskCreate,
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Creates a new task linked to a chat conversation, creator, priority, burst ticks, and required resources."""
    check_workspace_membership(db, payload.workspace_id, current_user["id"])

    task_id = f"TSK-{uuid.uuid4().hex[:6].upper()}"
    numeric_priority = PRIORITY_NUMERIC_MAP.get(payload.priority, 3)

    with db:
        db.execute(
            """
            INSERT INTO tasks (
                id, workspace_id, channel_id, source_message_id, creator_id,
                assignee_id, title, description, priority, numeric_priority,
                arrival_time, deadline, estimated_burst_ticks, remaining_burst_ticks, status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NEW')
            """,
            (
                task_id, payload.workspace_id, payload.channel_id, payload.source_message_id,
                current_user["id"], payload.assignee_id, payload.title, payload.description or "",
                payload.priority, numeric_priority, payload.arrival_time, payload.deadline,
                payload.estimated_burst_ticks, payload.estimated_burst_ticks,
            ),
        )

        # Store required resources
        if payload.required_resources:
            for res_id in payload.required_resources:
                alloc_id = f"alloc-{uuid.uuid4().hex[:8]}"
                db.execute(
                    """
                    INSERT INTO task_resource_allocations (id, task_id, resource_id, requested_units, status)
                    VALUES (?, ?, ?, 1, 'REQUESTED')
                    """,
                    (alloc_id, task_id, res_id),
                )

        # Look up assignee display name
        assignee_name = "Unassigned"
        if payload.assignee_id:
            a_row = db.execute("SELECT display_name, username FROM users WHERE id = ?", (payload.assignee_id,)).fetchone()
            if a_row:
                assignee_name = a_row["display_name"] or a_row["username"]

        # Post readable system message to channel if channel_id provided
        sys_msg_id = None
        seq = 0
        if payload.channel_id:
            sys_msg_id = str(uuid.uuid4())
            creator_name = current_user.get("display_name") or current_user["username"]
            res_info = f", Resources: {', '.join(payload.required_resources)}" if payload.required_resources else ""
            sys_content = f"⚡ Task [{task_id}] \"{payload.title}\" created by {creator_name} (Priority: {payload.priority}, Assigned: {assignee_name}{res_info})."
            sys_payload = json.dumps({"task_id": task_id, "priority": payload.priority, "status": "NEW"})
            seq = chat_hub.get_next_seq(payload.channel_id)

            db.execute(
                """
                INSERT INTO messages (id, workspace_id, channel_id, sender_id, message_type, content, payload_json, seq)
                VALUES (?, ?, ?, ?, 'SYSTEM_EVENT', ?, ?, ?)
                """,
                (sys_msg_id, payload.workspace_id, payload.channel_id, current_user["id"], sys_content, sys_payload, seq),
            )

    creator_name = current_user.get("display_name") or current_user["username"]
    task_resp = TaskResponse(
        id=task_id,
        workspace_id=payload.workspace_id,
        channel_id=payload.channel_id,
        source_message_id=payload.source_message_id,
        creator_id=current_user["id"],
        creator_name=creator_name,
        assignee_id=payload.assignee_id,
        assignee_name=assignee_name,
        title=payload.title,
        description=payload.description or "",
        priority=payload.priority,
        numeric_priority=numeric_priority,
        arrival_time=payload.arrival_time,
        deadline=payload.deadline,
        estimated_burst_ticks=payload.estimated_burst_ticks,
        remaining_burst_ticks=payload.estimated_burst_ticks,
        status="NEW",
        waiting_ticks=0,
        turnaround_ticks=0,
        response_ticks=0,
        required_resources=payload.required_resources or [],
        held_resources=[],
        waiting_on_resource=None,
        created_at=datetime.now(timezone.utc).isoformat(),
    )

    # Sync into engine cache
    engine = workspace_engine_manager.get_engine(payload.workspace_id, db)
    engine.sync_from_db(db)

    # Broadcast task creation via WebSocket
    await chat_hub.broadcast_task_event(
        workspace_id=payload.workspace_id,
        event_type="TASK_CREATED",
        task_dict=task_resp.model_dump(),
    )

    # Broadcast system message to channel
    if payload.channel_id and sys_msg_id:
        await chat_hub.broadcast_message(
            workspace_id=payload.workspace_id,
            channel_id=payload.channel_id,
            message_dict={
                "id": sys_msg_id,
                "workspace_id": payload.workspace_id,
                "channel_id": payload.channel_id,
                "sender_id": None,
                "sender_username": "System",
                "sender_display_name": "System",
                "message_type": "SYSTEM_EVENT",
                "content": sys_content,
                "seq": seq,
                "payload_json": {"task_id": task_id},
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
        )

    return task_resp


@router.patch("/api/v2/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str,
    payload: TaskUpdate,
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Updates a task's status, priority, or assignee, emitting system events into the channel."""
    cursor = db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    task = cursor.fetchone()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    workspace_id = task["workspace_id"]
    check_workspace_membership(db, workspace_id, current_user["id"])

    old_status = task["status"]
    new_status = payload.status or old_status
    new_assignee = payload.assignee_id if payload.assignee_id is not None else task["assignee_id"]
    new_priority = payload.priority or task["priority"]
    numeric_priority = PRIORITY_NUMERIC_MAP.get(new_priority, task["numeric_priority"])

    engine = workspace_engine_manager.get_engine(workspace_id, db)

    # Handle action-driven transitions
    events_to_emit = []
    if payload.action == "CANCEL" or new_status == "TERMINATED" and old_status != "TERMINATED":
        _, evts = engine.cancel_or_abort_task(task_id, db)
        events_to_emit.extend(evts)
    elif payload.action == "ADMIT" or (old_status == "NEW" and new_status == "READY"):
        engine.admit_task(task_id, db)

    with db:
        db.execute(
            """
            UPDATE tasks
            SET status = ?, assignee_id = ?, priority = ?, numeric_priority = ?,
                deadline = COALESCE(?, deadline), updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (new_status, new_assignee, new_priority, numeric_priority, payload.deadline, task_id),
        )

        # Assignment change notification
        if payload.assignee_id is not None and payload.assignee_id != task["assignee_id"] and task["channel_id"]:
            a_row = db.execute("SELECT display_name, username FROM users WHERE id = ?", (new_assignee,)).fetchone() if new_assignee else None
            a_name = (a_row["display_name"] or a_row["username"]) if a_row else "Unassigned"
            assigner_name = current_user.get("display_name") or current_user["username"]
            sys_msg_id = str(uuid.uuid4())
            sys_content = f"⚡ Task [{task_id}] was assigned to {a_name} by {assigner_name}."
            seq = chat_hub.get_next_seq(task["channel_id"])
            db.execute(
                """
                INSERT INTO messages (id, workspace_id, channel_id, sender_id, message_type, content, payload_json, seq)
                VALUES (?, ?, ?, NULL, 'SYSTEM_EVENT', ?, ?, ?)
                """,
                (sys_msg_id, workspace_id, task["channel_id"], sys_content, json.dumps({"task_id": task_id, "assignee": a_name}), seq),
            )
            events_to_emit.append({
                "task_id": task_id,
                "channel_id": task["channel_id"],
                "sys_msg_id": sys_msg_id,
                "content": sys_content,
                "seq": seq,
            })

        # Status transition notification
        if new_status != old_status and task["channel_id"]:
            sys_msg_id = str(uuid.uuid4())
            sys_content = f"⚡ Task [{task_id}] transitioned from {old_status} to {new_status}."
            seq = chat_hub.get_next_seq(task["channel_id"])
            db.execute(
                """
                INSERT INTO messages (id, workspace_id, channel_id, sender_id, message_type, content, payload_json, seq)
                VALUES (?, ?, ?, NULL, 'SYSTEM_EVENT', ?, ?, ?)
                """,
                (sys_msg_id, workspace_id, task["channel_id"], sys_content, json.dumps({"task_id": task_id, "new_status": new_status}), seq),
            )
            events_to_emit.append({
                "task_id": task_id,
                "channel_id": task["channel_id"],
                "sys_msg_id": sys_msg_id,
                "content": sys_content,
                "seq": seq,
            })

    # Resync engine
    engine.sync_from_db(db)

    # Fetch updated task row
    sql = """
        SELECT t.*, u_c.display_name AS creator_name, u_a.display_name AS assignee_name
        FROM tasks t
        JOIN users u_c ON t.creator_id = u_c.id
        LEFT JOIN users u_a ON t.assignee_id = u_a.id
        WHERE t.id = ?
    """
    updated_row = db.execute(sql, (task_id,)).fetchone()
    resp = _build_task_response(updated_row, db)

    # Broadcast task update
    await chat_hub.broadcast_task_event(
        workspace_id=workspace_id,
        event_type="TASK_STATE_CHANGED",
        task_dict=resp.model_dump(),
    )

    # Broadcast all system event messages to channel
    for evt in events_to_emit:
        if "sys_msg_id" in evt:
            await chat_hub.broadcast_message(
                workspace_id=workspace_id,
                channel_id=evt["channel_id"],
                message_dict={
                    "id": evt["sys_msg_id"],
                    "workspace_id": workspace_id,
                    "channel_id": evt["channel_id"],
                    "sender_id": None,
                    "sender_username": "System",
                    "sender_display_name": "System",
                    "message_type": "SYSTEM_EVENT",
                    "content": evt["content"],
                    "seq": evt["seq"],
                    "payload_json": {"task_id": task_id},
                    "created_at": datetime.now(timezone.utc).isoformat(),
                },
            )

    return resp


# ============================================================================
# RESOURCE COORDINATION & SYNCHRONIZATION ENDPOINTS
# ============================================================================

@router.get("/api/v2/workspaces/{workspace_id}/resources", response_model=List[WorkspaceResourceStatus])
def list_workspace_resources(
    workspace_id: str,
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Retrieves all registered workspace resources, current holders, and waiting queues."""
    check_workspace_membership(db, workspace_id, current_user["id"])
    engine = workspace_engine_manager.get_engine(workspace_id, db)
    return engine.get_resource_statuses()


@router.post("/api/v2/tasks/{task_id}/resources/acquire")
async def acquire_resource_for_task(
    task_id: str,
    payload: WorkspaceResourceAcquireRequest,
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Attempts atomic resource acquisition for a task. Transitions task to WAITING if blocked."""
    cursor = db.execute("SELECT workspace_id, channel_id FROM tasks WHERE id = ?", (task_id,))
    t_row = cursor.fetchone()
    if not t_row:
        raise HTTPException(status_code=404, detail="Task not found.")

    workspace_id = t_row["workspace_id"]
    check_workspace_membership(db, workspace_id, current_user["id"])

    engine = workspace_engine_manager.get_engine(workspace_id, db)
    granted, events = engine.request_resource(
        task_id=task_id,
        resource_id=payload.resource_id,
        mode=payload.mode,
        units=payload.units,
        db=db,
    )

    # Persist and broadcast events
    for evt in events:
        if evt["channel_id"]:
            sys_msg_id = str(uuid.uuid4())
            seq = chat_hub.get_next_seq(evt["channel_id"])
            with db:
                db.execute(
                    """
                    INSERT INTO messages (id, workspace_id, channel_id, sender_id, message_type, content, payload_json, seq)
                    VALUES (?, ?, ?, NULL, 'SYSTEM_EVENT', ?, ?, ?)
                    """,
                    (sys_msg_id, workspace_id, evt["channel_id"], evt["message"], json.dumps({"task_id": task_id, "event": evt["event_type"]}), seq),
                )
            await chat_hub.broadcast_message(
                workspace_id=workspace_id,
                channel_id=evt["channel_id"],
                message_dict={
                    "id": sys_msg_id,
                    "workspace_id": workspace_id,
                    "channel_id": evt["channel_id"],
                    "sender_id": None,
                    "sender_username": "System",
                    "sender_display_name": "System",
                    "message_type": "SYSTEM_EVENT",
                    "content": evt["message"],
                    "seq": seq,
                    "payload_json": {"task_id": task_id, "event": evt["event_type"]},
                    "created_at": datetime.now(timezone.utc).isoformat(),
                },
            )

    # Broadcast task update
    t_updated = db.execute("SELECT t.*, u_c.display_name AS creator_name, u_a.display_name AS assignee_name FROM tasks t JOIN users u_c ON t.creator_id = u_c.id LEFT JOIN users u_a ON t.assignee_id = u_a.id WHERE t.id = ?", (task_id,)).fetchone()
    resp = _build_task_response(t_updated, db)
    await chat_hub.broadcast_task_event(workspace_id, "TASK_STATE_CHANGED", resp.model_dump())

    return {
        "granted": granted,
        "task_id": task_id,
        "resource_id": payload.resource_id,
        "status": "ACQUIRED" if granted else "WAITING_BLOCKED",
    }


@router.post("/api/v2/tasks/{task_id}/resources/release")
async def release_resource_for_task(
    task_id: str,
    payload: WorkspaceResourceReleaseRequest,
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Releases a resource held by a task and unblocks waiting tasks."""
    cursor = db.execute("SELECT workspace_id, channel_id FROM tasks WHERE id = ?", (task_id,))
    t_row = cursor.fetchone()
    if not t_row:
        raise HTTPException(status_code=404, detail="Task not found.")

    workspace_id = t_row["workspace_id"]
    check_workspace_membership(db, workspace_id, current_user["id"])

    engine = workspace_engine_manager.get_engine(workspace_id, db)
    try:
        awakened, events = engine.release_resource(task_id, payload.resource_id, payload.units, db)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

    # Persist and broadcast events
    for evt in events:
        if evt["channel_id"]:
            sys_msg_id = str(uuid.uuid4())
            seq = chat_hub.get_next_seq(evt["channel_id"])
            with db:
                db.execute(
                    """
                    INSERT INTO messages (id, workspace_id, channel_id, sender_id, message_type, content, payload_json, seq)
                    VALUES (?, ?, ?, NULL, 'SYSTEM_EVENT', ?, ?, ?)
                    """,
                    (sys_msg_id, workspace_id, evt["channel_id"], evt["message"], json.dumps({"task_id": task_id, "event": evt["event_type"]}), seq),
                )
            await chat_hub.broadcast_message(
                workspace_id=workspace_id,
                channel_id=evt["channel_id"],
                message_dict={
                    "id": sys_msg_id,
                    "workspace_id": workspace_id,
                    "channel_id": evt["channel_id"],
                    "sender_id": None,
                    "sender_username": "System",
                    "sender_display_name": "System",
                    "message_type": "SYSTEM_EVENT",
                    "content": evt["message"],
                    "seq": seq,
                    "payload_json": {"task_id": task_id, "event": evt["event_type"]},
                    "created_at": datetime.now(timezone.utc).isoformat(),
                },
            )

    return {
        "released": True,
        "task_id": task_id,
        "resource_id": payload.resource_id,
        "awakened_tasks": awakened,
    }


# ============================================================================
# CENTRALIZED WORKSPACE OS CPU SCHEDULER ENDPOINTS
# ============================================================================

@router.get("/api/v2/workspaces/{workspace_id}/scheduler", response_model=WorkspaceSchedulerState)
def get_workspace_scheduler_state(
    workspace_id: str,
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Retrieves live scheduler clock, policy, ready queue, running task, and metrics."""
    check_workspace_membership(db, workspace_id, current_user["id"])
    engine = workspace_engine_manager.get_engine(workspace_id, db)
    return engine.get_state()


@router.post("/api/v2/workspaces/{workspace_id}/scheduler/step", response_model=WorkspaceSchedulerState)
async def step_workspace_scheduler(
    workspace_id: str,
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Steps the workspace CPU scheduler clock by 1 tick and broadcasts the transition."""
    check_workspace_membership(db, workspace_id, current_user["id"])
    engine = workspace_engine_manager.get_engine(workspace_id, db)
    state, events = engine.step(db)

    # Persist and broadcast channel messages for scheduler events
    for evt in events:
        if evt["channel_id"]:
            sys_msg_id = str(uuid.uuid4())
            seq = chat_hub.get_next_seq(evt["channel_id"])
            with db:
                db.execute(
                    """
                    INSERT INTO messages (id, workspace_id, channel_id, sender_id, message_type, content, payload_json, seq)
                    VALUES (?, ?, ?, NULL, 'SYSTEM_EVENT', ?, ?, ?)
                    """,
                    (sys_msg_id, workspace_id, evt["channel_id"], evt["message"], json.dumps({"task_id": evt["task_id"], "event": evt["event_type"]}), seq),
                )
            await chat_hub.broadcast_message(
                workspace_id=workspace_id,
                channel_id=evt["channel_id"],
                message_dict={
                    "id": sys_msg_id,
                    "workspace_id": workspace_id,
                    "channel_id": evt["channel_id"],
                    "sender_id": None,
                    "sender_username": "System",
                    "sender_display_name": "System",
                    "message_type": "SYSTEM_EVENT",
                    "content": evt["message"],
                    "seq": seq,
                    "payload_json": {"task_id": evt["task_id"], "event": evt["event_type"]},
                    "created_at": datetime.now(timezone.utc).isoformat(),
                },
            )

    # Broadcast scheduler tick to workspace
    await chat_hub.broadcast_task_event(
        workspace_id=workspace_id,
        event_type="SCHEDULER_STEP",
        task_dict={
            "current_tick": state["current_tick"],
            "running_task_id": state["running_task_id"],
            "ready_count": len(state["ready_queue"]),
            "metrics": state["metrics"],
        },
    )

    return state


@router.post("/api/v2/workspaces/{workspace_id}/scheduler/policy")
async def update_scheduler_policy(
    workspace_id: str,
    algorithm: str = Query("ROUND_ROBIN"),
    time_quantum: int = Query(2),
    aging_interval: Optional[int] = Query(5),
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Switches the workspace scheduling algorithm (FCFS, SJF, SRTF, ROUND_ROBIN, PRIORITY)."""
    check_workspace_membership(db, workspace_id, current_user["id"])
    engine = workspace_engine_manager.get_engine(workspace_id, db)
    engine.set_policy(algorithm=algorithm, time_quantum=time_quantum, aging_interval=aging_interval)
    return {"algorithm": algorithm.upper(), "time_quantum": time_quantum, "aging_interval": aging_interval}


@router.post("/api/v2/workspaces/{workspace_id}/scheduler/reset")
async def reset_workspace_scheduler(
    workspace_id: str,
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Resets the simulation clock and all task execution progress cleanly."""
    check_workspace_membership(db, workspace_id, current_user["id"])
    engine = workspace_engine_manager.get_engine(workspace_id, db)
    engine.reset(db)
    return engine.get_state()


@router.get("/api/v2/workspaces/{workspace_id}/deadlock", response_model=DeadlockReport)
def check_workspace_deadlock(
    workspace_id: str,
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Runs Wait-For Graph cycle detection to detect circular wait deadlocks."""
    check_workspace_membership(db, workspace_id, current_user["id"])
    engine = workspace_engine_manager.get_engine(workspace_id, db)
    report = engine.check_deadlock()
    return DeadlockReport(**report)
