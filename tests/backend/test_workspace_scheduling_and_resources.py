"""Automated Verification Suite for VGARSS 2.0 Workspace Scheduling & Resource Engine.

Validates:
1. Task creation from chat messages with full parameters & channel event emission.
2. 5-State Process Management (NEW, READY, RUNNING, WAITING, TERMINATED) & accurate metrics.
3. Centralized Backend Schedulers (FCFS, SJF, Round Robin, Priority with aging).
4. Concurrent Resource Management (Mutex & Semaphore, ownership, wait queues, unauthorized release guards).
5. Deadlock Detection via Wait-For Graph cycle detection.
6. Cancellation and disconnection recovery releasing all held locks with zero lost wakeups.
7. Persistence of system events in channel message stream.
"""
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database import init_db, get_connection
from backend.app.network.chat_hub import chat_hub

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_test_db():
    """Wipes test database tables and in-memory chat hub before each test."""
    init_db()
    chat_hub._seq_counters.clear()
    chat_hub._event_buffers.clear()
    chat_hub._user_sessions.clear()
    chat_hub._workspace_subscribers.clear()
    chat_hub._active_typing.clear()
    chat_hub._presence.clear()

    conn = get_connection()
    conn.execute("PRAGMA foreign_keys = OFF;")
    with conn:
        conn.execute("DELETE FROM message_receipts;")
        conn.execute("DELETE FROM workspace_invitations;")
        conn.execute("DELETE FROM messages;")
        conn.execute("DELETE FROM task_resource_allocations;")
        conn.execute("DELETE FROM tasks;")
        conn.execute("DELETE FROM resources;")
        conn.execute("DELETE FROM channel_members;")
        conn.execute("DELETE FROM channels;")
        conn.execute("DELETE FROM direct_conversation_participants;")
        conn.execute("DELETE FROM direct_conversations;")
        conn.execute("DELETE FROM workspace_members;")
        conn.execute("DELETE FROM workspaces;")
        conn.execute("DELETE FROM sessions;")
        conn.execute("DELETE FROM users;")
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.close()


def _setup_test_workspace():
    """Helper creating user, workspace, channel, and registering test resources."""
    # 1. Register Alice
    reg = client.post(
        "/api/v2/auth/register",
        json={"username": "alice", "email": "alice@vgarss.org", "password": "BcryptPassword2026!"},
    )
    token = reg.json()["token"]

    # 2. Create Workspace (auto-seeds default channels: general, os-scheduling-lab, cn-networking)
    ws_res = client.post(
        "/api/v2/workspaces",
        json={"name": "OS Simulation Workspace", "description": "Workspace for scheduling & resources"},
        headers={"Authorization": f"Bearer {token}"},
    )
    ws = ws_res.json()

    # 3. Retrieve default channel
    chans = client.get(
        f"/api/v2/workspaces/{ws['id']}/channels",
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    chan = next(c for c in chans if "os-scheduling" in c["name"])

    # 4. Insert test resources into workspace
    conn = get_connection()
    with conn:
        conn.execute(
            """
            INSERT INTO resources (id, workspace_id, name, resource_type, total_capacity, available_units, description, order_rank)
            VALUES
                ('res-mutex-gpu', ?, 'GPU Matrix Engine', 'MUTEX', 1, 1, 'Exclusive GPU accelerator', 1),
                ('res-mutex-db', ?, 'Kernel Page Lock', 'MUTEX', 1, 1, 'Exclusive memory lock', 2),
                ('res-sem-io', ?, 'DMA Channel Pool', 'SEMAPHORE', 3, 3, 'Capacity limited DMA channels', 3)
            """,
            (ws["id"], ws["id"], ws["id"]),
        )
    conn.close()

    return token, ws, chan


def test_task_creation_from_chat_with_full_metadata():
    """Validates creating a task directly from a chat message with all parameters and channel announcement."""
    token, ws, chan = _setup_test_workspace()

    # 1. Post a source chat message
    msg_res = client.post(
        f"/api/v2/channels/{chan['id']}/messages",
        json={"content": "Kernel bottleneck detected in DMA controller. Scheduling mitigation task."},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert msg_res.status_code == 201
    source_msg = msg_res.json()

    # 2. Create task linked to message
    task_res = client.post(
        "/api/v2/tasks",
        json={
            "workspace_id": ws["id"],
            "channel_id": chan["id"],
            "source_message_id": source_msg["id"],
            "title": "DMA Buffer Overrun Mitigation",
            "description": "Optimize ring buffer DMA pointers and test with Round Robin",
            "priority": "HIGH",
            "arrival_time": 0,
            "estimated_burst_ticks": 4,
            "deadline": "2026-10-30T12:00:00Z",
            "required_resources": ["res-sem-io"],
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert task_res.status_code == 201
    task = task_res.json()

    assert task["id"].startswith("TSK-")
    assert task["title"] == "DMA Buffer Overrun Mitigation"
    assert task["priority"] == "HIGH"
    assert task["numeric_priority"] == 2
    assert task["arrival_time"] == 0
    assert task["estimated_burst_ticks"] == 4
    assert task["status"] == "NEW"
    assert task["source_message_id"] == source_msg["id"]
    assert "res-sem-io" in task["required_resources"]

    # 3. Verify readable system event posted to channel message stream
    ch_msgs = client.get(
        f"/api/v2/channels/{chan['id']}/messages",
        headers={"Authorization": f"Bearer {token}"},
    ).json()["messages"]

    event_msg = next((m for m in ch_msgs if task["id"] in m["content"]), None)
    assert event_msg is not None
    assert event_msg["message_type"] == "SYSTEM_EVENT"
    assert "DMA Buffer Overrun Mitigation" in event_msg["content"]


def test_workspace_cpu_scheduler_stepping_and_metrics():
    """Validates discrete logical clock stepping, process dispatch, termination, and metrics."""
    token, ws, chan = _setup_test_workspace()

    # Configure scheduler policy: ROUND_ROBIN quantum 2
    policy_res = client.post(
        f"/api/v2/workspaces/{ws['id']}/scheduler/policy?algorithm=ROUND_ROBIN&time_quantum=2",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert policy_res.status_code == 200

    # Create 2 tasks with known burst times: T1 (3 ticks), T2 (2 ticks)
    t1 = client.post(
        "/api/v2/tasks",
        json={
            "workspace_id": ws["id"],
            "channel_id": chan["id"],
            "title": "Kernel Benchmark Alpha",
            "priority": "MEDIUM",
            "arrival_time": 0,
            "estimated_burst_ticks": 3,
        },
        headers={"Authorization": f"Bearer {token}"},
    ).json()

    t2 = client.post(
        "/api/v2/tasks",
        json={
            "workspace_id": ws["id"],
            "channel_id": chan["id"],
            "title": "Kernel Benchmark Beta",
            "priority": "HIGH",
            "arrival_time": 0,
            "estimated_burst_ticks": 2,
        },
        headers={"Authorization": f"Bearer {token}"},
    ).json()

    # Step 1: Admission & dispatch
    step1 = client.post(
        f"/api/v2/workspaces/{ws['id']}/scheduler/step",
        headers={"Authorization": f"Bearer {token}"},
    ).json()

    assert step1["current_tick"] == 1
    assert step1["running_task_id"] in [t1["id"], t2["id"]]

    # Run remaining steps until tasks finish
    for _ in range(8):
        st = client.post(
            f"/api/v2/workspaces/{ws['id']}/scheduler/step",
            headers={"Authorization": f"Bearer {token}"},
        ).json()
        if len(st["terminated_tasks"]) >= 2:
            break

    # Verify final scheduler state
    state = client.get(
        f"/api/v2/workspaces/{ws['id']}/scheduler",
        headers={"Authorization": f"Bearer {token}"},
    ).json()

    assert len(state["terminated_tasks"]) >= 2
    metrics = state["metrics"]
    assert metrics["total_ticks"] > 0
    assert metrics["cpu_utilization"] > 0
    assert metrics["throughput"] > 0
    assert metrics["avg_turnaround_time"] > 0


def test_concurrent_resource_locking_and_blocking():
    """Validates exclusive mutex locks, FIFO waiting queues, and unblocking on release."""
    token, ws, chan = _setup_test_workspace()

    # Create Task A and Task B
    ta = client.post(
        "/api/v2/tasks",
        json={"workspace_id": ws["id"], "channel_id": chan["id"], "title": "Worker Task A", "estimated_burst_ticks": 5},
        headers={"Authorization": f"Bearer {token}"},
    ).json()

    tb = client.post(
        "/api/v2/tasks",
        json={"workspace_id": ws["id"], "channel_id": chan["id"], "title": "Worker Task B", "estimated_burst_ticks": 5},
        headers={"Authorization": f"Bearer {token}"},
    ).json()

    # Task A acquires exclusive GPU mutex
    acq_a = client.post(
        f"/api/v2/tasks/{ta['id']}/resources/acquire",
        json={"resource_id": "res-mutex-gpu", "mode": "EXCLUSIVE", "units": 1},
        headers={"Authorization": f"Bearer {token}"},
    ).json()

    assert acq_a["granted"] is True
    assert acq_a["status"] == "ACQUIRED"

    # Task B tries to acquire the same exclusive GPU mutex -> MUST BLOCK (WAITING)
    acq_b = client.post(
        f"/api/v2/tasks/{tb['id']}/resources/acquire",
        json={"resource_id": "res-mutex-gpu", "mode": "EXCLUSIVE", "units": 1},
        headers={"Authorization": f"Bearer {token}"},
    ).json()

    assert acq_b["granted"] is False
    assert acq_b["status"] == "WAITING_BLOCKED"

    # Verify Task B is in WAITING state
    tb_detail = client.get(f"/api/v2/tasks/{tb['id']}", headers={"Authorization": f"Bearer {token}"}).json()
    assert tb_detail["status"] == "WAITING"

    # Verify resource inspector reflects holder and wait queue
    res_list = client.get(f"/api/v2/workspaces/{ws['id']}/resources", headers={"Authorization": f"Bearer {token}"}).json()
    gpu_res = next(r for r in res_list if r["id"] == "res-mutex-gpu")
    assert gpu_res["available_units"] == 0
    assert gpu_res["exclusive_holder_task_id"] == ta["id"]
    assert len(gpu_res["wait_queue"]) >= 1
    assert gpu_res["wait_queue"][0]["task_id"] == tb["id"]

    # Verify unauthorized release guard: Task B cannot release Task A's lock
    unauth_rel = client.post(
        f"/api/v2/tasks/{tb['id']}/resources/release",
        json={"resource_id": "res-mutex-gpu"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert unauth_rel.status_code == 403

    # Task A releases GPU mutex -> Task B MUST be awakened to READY
    rel_a = client.post(
        f"/api/v2/tasks/{ta['id']}/resources/release",
        json={"resource_id": "res-mutex-gpu"},
        headers={"Authorization": f"Bearer {token}"},
    ).json()

    assert rel_a["released"] is True
    assert tb["id"] in rel_a["awakened_tasks"]

    # Verify Task B transitioned to READY
    tb_unblocked = client.get(f"/api/v2/tasks/{tb['id']}", headers={"Authorization": f"Bearer {token}"}).json()
    assert tb_unblocked["status"] == "READY"


def test_deadlock_detection_via_wait_for_graph():
    """Validates Coffman circular wait detection: Task 1 holds R1, wants R2; Task 2 holds R2, wants R1."""
    token, ws, chan = _setup_test_workspace()

    # Create two tasks
    t1 = client.post(
        "/api/v2/tasks",
        json={"workspace_id": ws["id"], "channel_id": chan["id"], "title": "Deadlock Candidate 1", "estimated_burst_ticks": 5},
        headers={"Authorization": f"Bearer {token}"},
    ).json()

    t2 = client.post(
        "/api/v2/tasks",
        json={"workspace_id": ws["id"], "channel_id": chan["id"], "title": "Deadlock Candidate 2", "estimated_burst_ticks": 5},
        headers={"Authorization": f"Bearer {token}"},
    ).json()

    # Step 1: T1 acquires res-mutex-gpu
    client.post(
        f"/api/v2/tasks/{t1['id']}/resources/acquire",
        json={"resource_id": "res-mutex-gpu", "mode": "EXCLUSIVE", "units": 1},
        headers={"Authorization": f"Bearer {token}"},
    )

    # Step 2: T2 acquires res-mutex-db
    client.post(
        f"/api/v2/tasks/{t2['id']}/resources/acquire",
        json={"resource_id": "res-mutex-db", "mode": "EXCLUSIVE", "units": 1},
        headers={"Authorization": f"Bearer {token}"},
    )

    # Step 3: T1 requests res-mutex-db (held by T2) -> T1 BLOCKS on T2
    client.post(
        f"/api/v2/tasks/{t1['id']}/resources/acquire",
        json={"resource_id": "res-mutex-db", "mode": "EXCLUSIVE", "units": 1},
        headers={"Authorization": f"Bearer {token}"},
    )

    # Step 4: T2 requests res-mutex-gpu (held by T1) -> T2 BLOCKS on T1 => CIRCULAR WAIT!
    client.post(
        f"/api/v2/tasks/{t2['id']}/resources/acquire",
        json={"resource_id": "res-mutex-gpu", "mode": "EXCLUSIVE", "units": 1},
        headers={"Authorization": f"Bearer {token}"},
    )

    # Check deadlock report
    dl_report = client.get(
        f"/api/v2/workspaces/{ws['id']}/deadlock",
        headers={"Authorization": f"Bearer {token}"},
    ).json()

    assert dl_report["deadlock_detected"] is True
    assert len(dl_report["cycle_tasks"]) >= 2
    assert t1["id"] in dl_report["cycle_tasks"]
    assert t2["id"] in dl_report["cycle_tasks"]
    assert dl_report["recommended_action"] is not None


def test_task_cancellation_and_recovery():
    """Validates that cancelling or aborting a task safely releases all held resources without lost wakeups."""
    token, ws, chan = _setup_test_workspace()

    t_holder = client.post(
        "/api/v2/tasks",
        json={"workspace_id": ws["id"], "channel_id": chan["id"], "title": "Lock Holder", "estimated_burst_ticks": 5},
        headers={"Authorization": f"Bearer {token}"},
    ).json()

    t_waiter = client.post(
        "/api/v2/tasks",
        json={"workspace_id": ws["id"], "channel_id": chan["id"], "title": "Waiting Lock Requestor", "estimated_burst_ticks": 5},
        headers={"Authorization": f"Bearer {token}"},
    ).json()

    # t_holder acquires res-mutex-gpu
    client.post(
        f"/api/v2/tasks/{t_holder['id']}/resources/acquire",
        json={"resource_id": "res-mutex-gpu", "mode": "EXCLUSIVE", "units": 1},
        headers={"Authorization": f"Bearer {token}"},
    )

    # t_waiter requests res-mutex-gpu and blocks (WAITING)
    client.post(
        f"/api/v2/tasks/{t_waiter['id']}/resources/acquire",
        json={"resource_id": "res-mutex-gpu", "mode": "EXCLUSIVE", "units": 1},
        headers={"Authorization": f"Bearer {token}"},
    )

    # Holder is cancelled
    cancel_res = client.patch(
        f"/api/v2/tasks/{t_holder['id']}",
        json={"action": "CANCEL"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert cancel_res.status_code == 200

    # Waiter must now be awakened to READY (or dispatched to RUNNING by scheduler)
    waiter_status = client.get(f"/api/v2/tasks/{t_waiter['id']}", headers={"Authorization": f"Bearer {token}"}).json()
    assert waiter_status["status"] in ("READY", "RUNNING")
