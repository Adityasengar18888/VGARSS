"""End-to-End System Integration Test for VGARSS.

Exercises the complete integrated workflow across:
1. User registration & session token generation
2. Virtual group creation & partition isolation
3. Simulation initialization with tasks and shared mutex resources
4. Dynamic task/process submission to an active simulation
5. Dynamic scheduling policy updates (e.g. FCFS -> Round Robin)
6. Multi-client authenticated WebSocket telemetry verification
7. Resource conflict simulation (P1 acquires, P2 blocked -> WAITING)
8. Resource release & process resumption (P1 releases -> P2 awakened -> READY -> RUNNING)
9. Step-by-step Gantt execution to completion
10. Accurate mathematical metrics verification (TAT, WT, RT, CPU util)
11. Database / Engine persistence and consistency verification in SQLite
12. Simulation state reset back to initial tick 0
13. Raw TCP socket server length-prefixed framing and paired forwarding on port 9000
"""
import json
import struct
import asyncio
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.database import init_db, get_connection
from backend.app.network import connection_manager, EventType, RawTcpServer
from backend.app.network.framing import read_frame, write_frame
from backend.app.api.simulations import active_simulations


@pytest.fixture(autouse=True)
def setup_clean_state():
    """Resets database and in-memory caches before test execution."""
    init_db()
    active_simulations.clear()
    connection_manager._groups.clear()
    connection_manager._group_seq.clear()
    connection_manager._group_history.clear()
    connection_manager._global_listeners.clear()

    conn = get_connection()
    with conn:
        conn.execute("PRAGMA foreign_keys = OFF;")
        conn.execute("DELETE FROM simulation_history;")
        conn.execute("DELETE FROM simulation_resources;")
        conn.execute("DELETE FROM simulation_processes;")
        conn.execute("DELETE FROM simulations;")
        conn.execute("DELETE FROM group_memberships;")
        conn.execute("DELETE FROM virtual_groups;")
        conn.execute("DELETE FROM sessions;")
        conn.execute("DELETE FROM users;")
        conn.execute("PRAGMA foreign_keys = ON;")
    conn.close()


def test_full_system_e2e_workflow():
    """Executes the complete VGARSS end-to-end integration lifecycle."""
    client = TestClient(app)

    # -------------------------------------------------------------------------
    # 1. User Authentication
    # -------------------------------------------------------------------------
    reg_res = client.post(
        "/api/v1/auth/register",
        json={
            "username": "lead_architect",
            "email": "architect@vgarss.org",
            "password": "SecurePassword123!",
        },
    )
    assert reg_res.status_code == 201
    auth_data = reg_res.json()
    token = auth_data["token"]
    user_id = auth_data["user"]["id"]
    headers = {"Authorization": f"Bearer {token}"}

    # -------------------------------------------------------------------------
    # 2. Virtual Group Creation
    # -------------------------------------------------------------------------
    grp_res = client.post(
        "/api/v1/groups",
        json={
            "name": "Integration Test Cluster",
            "description": "Partition for multi-client concurrency & scheduling tests",
        },
        headers=headers,
    )
    assert grp_res.status_code == 201
    group_id = grp_res.json()["id"]

    # -------------------------------------------------------------------------
    # 3. Create Initial Simulation Workload with Tasks & Mutex
    # -------------------------------------------------------------------------
    sim_create_payload = {
        "name": "E2E Concurrency & Preemption Run",
        "algorithm": "FCFS",
        "time_quantum": 2,
        "is_preemptive": False,
        "processes": [
            {"id": "P1", "arrival_time": 0, "burst_time": 3, "priority": 1},
            {"id": "P2", "arrival_time": 0, "burst_time": 3, "priority": 2},
        ],
        "resources": [
            {
                "id": "R_LOCK",
                "name": "Shared DB Mutex",
                "resource_type": "MUTEX",
                "total_capacity": 1,
                "order_rank": 1,
            }
        ],
    }
    create_res = client.post(
        f"/api/v1/groups/{group_id}/simulations",
        json=sim_create_payload,
        headers=headers,
    )
    assert create_res.status_code == 201
    sim_id = create_res.json()["id"]

    # -------------------------------------------------------------------------
    # 4. Dynamic Task Submission
    # -------------------------------------------------------------------------
    proc_res = client.post(
        f"/api/v1/groups/{group_id}/simulations/{sim_id}/processes",
        json={"id": "P3", "arrival_time": 1, "burst_time": 2, "priority": 3},
        headers=headers,
    )
    assert proc_res.status_code == 201
    assert proc_res.json()["id"] == "P3"

    # Verify simulation state reflects 3 processes
    sim_info = client.get(f"/api/v1/groups/{group_id}/simulations/{sim_id}", headers=headers).json()
    assert len(sim_info["processes"]) == 3

    # -------------------------------------------------------------------------
    # 5. Dynamic Scheduling Policy Update
    # -------------------------------------------------------------------------
    policy_res = client.put(
        f"/api/v1/groups/{group_id}/simulations/{sim_id}/policy",
        json={"algorithm": "ROUND_ROBIN", "time_quantum": 2, "is_preemptive": True},
        headers=headers,
    )
    assert policy_res.status_code == 200
    assert policy_res.json()["algorithm"] == "ROUND_ROBIN"
    assert policy_res.json()["time_quantum"] == 2

    # -------------------------------------------------------------------------
    # 6. Multi-Client WebSocket Telemetry & Concurrency Observation
    # -------------------------------------------------------------------------
    with client.websocket_connect(f"/ws/groups/{group_id}?token={token}") as ws_client1:
        # Client 1 Auth handshake
        c1_handshake = ws_client1.receive_json()
        assert c1_handshake["type"] == EventType.AUTH_SUCCESS.value
        assert c1_handshake["group_id"] == group_id

        with client.websocket_connect(f"/ws/groups/{group_id}?token={token}") as ws_client2:
            # Client 2 Auth handshake
            c2_handshake = ws_client2.receive_json()
            assert c2_handshake["type"] == EventType.AUTH_SUCCESS.value
            assert c2_handshake["group_id"] == group_id

            # -----------------------------------------------------------------
            # 7. Step Simulation (P1 admitted & runs 1 tick)
            # -----------------------------------------------------------------
            step1 = client.post(f"/api/v1/groups/{group_id}/simulations/{sim_id}/step", headers=headers)
            assert step1.status_code == 200
            step1_data = step1.json()
            assert step1_data["tick"] == 1
            assert step1_data["running_process_id"] == "P1"

            # Both clients observe SIMULATION_STEP with identical payload and sequence
            ev1_c1 = ws_client1.receive_json()
            ev1_c2 = ws_client2.receive_json()
            assert ev1_c1["type"] == EventType.SIMULATION_STEP.value
            assert ev1_c2["type"] == EventType.SIMULATION_STEP.value
            assert ev1_c1["seq"] == ev1_c2["seq"]
            assert ev1_c1["payload"]["running_process_id"] == "P1"

            # -----------------------------------------------------------------
            # 8. Trigger Resource Conflict (P1 acquires, P2 blocked -> WAITING)
            # -----------------------------------------------------------------
            # P1 acquires R_LOCK
            acq1 = client.post(
                f"/api/v1/groups/{group_id}/simulations/{sim_id}/resources/acquire",
                json={"process_id": "P1", "resource_id": "R_LOCK", "mode": "EXCLUSIVE", "units": 1},
                headers=headers,
            )
            assert acq1.status_code == 200
            assert acq1.json()["granted"] is True

            # Both clients observe RESOURCE_ACQUIRED
            acq_ev_c1 = ws_client1.receive_json()
            acq_ev_c2 = ws_client2.receive_json()
            assert acq_ev_c1["type"] == EventType.RESOURCE_ACQUIRED.value
            assert acq_ev_c2["type"] == EventType.RESOURCE_ACQUIRED.value
            assert acq_ev_c1["payload"]["process_id"] == "P1"

            # P2 attempts to acquire R_LOCK (Conflict! P1 holds it)
            acq2 = client.post(
                f"/api/v1/groups/{group_id}/simulations/{sim_id}/resources/acquire",
                json={"process_id": "P2", "resource_id": "R_LOCK", "mode": "EXCLUSIVE", "units": 1},
                headers=headers,
            )
            assert acq2.status_code == 200
            assert acq2.json()["granted"] is False
            assert acq2.json()["status"] == "BLOCKED_WAITING"

            # Both clients observe RESOURCE_BLOCKED
            block_ev_c1 = ws_client1.receive_json()
            block_ev_c2 = ws_client2.receive_json()
            assert block_ev_c1["type"] == EventType.RESOURCE_BLOCKED.value
            assert block_ev_c2["type"] == EventType.RESOURCE_BLOCKED.value
            assert block_ev_c1["payload"]["process_id"] == "P2"

            # Verify resource status in REST
            res_statuses = client.get(
                f"/api/v1/groups/{group_id}/simulations/{sim_id}/resources",
                headers=headers,
            ).json()
            assert res_statuses[0]["exclusive_holder"] == "P1"
            assert "P2" in res_statuses[0]["wait_queue"]

            # Verify database consistency for WAITING process
            conn = get_connection()
            p2_row = conn.execute(
                "SELECT state FROM simulation_processes WHERE simulation_id = ? AND id = 'P2'",
                (sim_id,),
            ).fetchone()
            assert p2_row["state"] == "WAITING"
            conn.close()

            # -----------------------------------------------------------------
            # 9. Release Resource & Verify P2 Resumes
            # -----------------------------------------------------------------
            rel_res = client.post(
                f"/api/v1/groups/{group_id}/simulations/{sim_id}/resources/release",
                json={"process_id": "P1", "resource_id": "R_LOCK"},
                headers=headers,
            )
            assert rel_res.status_code == 200
            assert rel_res.json()["released"] is True
            assert "P2" in rel_res.json()["awakened_processes"]

            # Both clients observe RESOURCE_RELEASED with awakened_processes: ["P2"]
            rel_ev_c1 = ws_client1.receive_json()
            rel_ev_c2 = ws_client2.receive_json()
            assert rel_ev_c1["type"] == EventType.RESOURCE_RELEASED.value
            assert rel_ev_c2["type"] == EventType.RESOURCE_RELEASED.value
            assert "P2" in rel_ev_c1["payload"]["awakened_processes"]

            # Verify database consistency for awakened process
            conn = get_connection()
            p2_row = conn.execute(
                "SELECT state FROM simulation_processes WHERE simulation_id = ? AND id = 'P2'",
                (sim_id,),
            ).fetchone()
            assert p2_row["state"] == "READY"
            conn.close()

            # -----------------------------------------------------------------
            # 10. Step Forward & Run Simulation to Completion
            # -----------------------------------------------------------------
            # Step until completed
            completed = False
            for _ in range(50):
                step = client.post(f"/api/v1/groups/{group_id}/simulations/{sim_id}/step", headers=headers)
                sdata = step.json()
                ws_client1.receive_json()
                ws_client2.receive_json()
                if sdata["status"] == "COMPLETED":
                    completed = True
                    # Drain the SIMULATION_COMPLETED event
                    ws_client1.receive_json()
                    ws_client2.receive_json()
                    break

            assert completed is True

    # -------------------------------------------------------------------------
    # 11. Inspect Metrics & Mathematical Invariants
    # -------------------------------------------------------------------------
    final_sim = client.get(f"/api/v1/groups/{group_id}/simulations/{sim_id}", headers=headers).json()
    assert final_sim["status"] == "COMPLETED"
    assert final_sim["cpu_utilization"] > 0
    assert final_sim["throughput"] > 0
    assert final_sim["avg_waiting_time"] >= 0
    assert final_sim["avg_turnaround_time"] >= 0

    # Verify per-process invariants in SQLite: TAT = WT + BT
    conn = get_connection()
    proc_rows = conn.execute(
        "SELECT id, burst_time, waiting_time, turnaround_time, response_time, state FROM simulation_processes WHERE simulation_id = ?",
        (sim_id,),
    ).fetchall()
    for row in proc_rows:
        assert row["state"] == "TERMINATED"
        # Turnaround = Waiting + Burst
        assert row["turnaround_time"] == row["waiting_time"] + row["burst_time"]
        assert row["response_time"] >= 0
    conn.close()

    # -------------------------------------------------------------------------
    # 12. Simulation State Reset
    # -------------------------------------------------------------------------
    reset_res = client.post(f"/api/v1/groups/{group_id}/simulations/{sim_id}/reset", headers=headers)
    assert reset_res.status_code == 200
    reset_data = reset_res.json()
    assert reset_data["status"] == "INITIALIZED"
    assert reset_data["current_tick"] == 0
    assert reset_data["cpu_utilization"] == 0.0

    conn = get_connection()
    reset_procs = conn.execute(
        "SELECT state, remaining_time, burst_time FROM simulation_processes WHERE simulation_id = ?",
        (sim_id,),
    ).fetchall()
    for rp in reset_procs:
        assert rp["remaining_time"] == rp["burst_time"]
    conn.close()


@pytest.mark.asyncio
async def test_raw_tcp_demonstration_lifecycle():
    """Tests the raw TCP socket server length-prefixed framing and paired forwarding."""
    server = RawTcpServer(host="127.0.0.1", port=0, max_connections=10, read_timeout=2.0)
    await server.start()
    port = server.actual_port

    try:
        # 1. Connect Client A
        reader_a, writer_a = await asyncio.open_connection("127.0.0.1", port)
        handshake_a = await read_frame(reader_a)
        assert handshake_a["status"] == "CONNECTED"
        id_a = handshake_a["client_id"]

        # 2. PING / PONG
        await write_frame(writer_a, {"action": "PING"})
        pong = await read_frame(reader_a)
        assert pong["action"] == "PONG"

        # 3. IDENTIFY
        await write_frame(writer_a, {"action": "IDENTIFY", "client_id": "operator_alpha"})
        ident_res = await read_frame(reader_a)
        assert ident_res["client_id"] == "operator_alpha"

        # 4. Connect Client B & Pair
        reader_b, writer_b = await asyncio.open_connection("127.0.0.1", port)
        handshake_b = await read_frame(reader_b)
        assert handshake_b["status"] == "CONNECTED"

        await write_frame(writer_b, {"action": "IDENTIFY", "client_id": "operator_beta"})
        await read_frame(reader_b)

        # Pair B with A
        await write_frame(writer_b, {"action": "PAIR", "target_id": "operator_alpha"})
        pair_res = await read_frame(reader_b)
        assert pair_res["status"] == "OK"
        assert pair_res["peer_id"] == "operator_alpha"

        # Client A receives the PEER_PAIRED event notification
        pair_notify_a = await read_frame(reader_a)
        assert pair_notify_a["status"] == "PEER_PAIRED"
        assert pair_notify_a["peer_id"] == "operator_beta"

        # 5. Forward message from B to A
        test_payload = {"command": "DISPATCH_BURST", "units": 4, "resource": "R1"}
        await write_frame(writer_b, {"action": "FORWARD", "payload": test_payload})

        # Client A receives the forwarded packet
        received_by_a = await read_frame(reader_a)
        assert received_by_a["status"] == "FORWARDED"
        assert received_by_a["from_client_id"] == "operator_beta"
        assert received_by_a["payload"] == test_payload

        # Client B receives confirmation
        fwd_ack = await read_frame(reader_b)
        assert fwd_ack["status"] == "OK"

        # Clean close
        writer_a.close()
        writer_b.close()
        await writer_a.wait_closed()
        await writer_b.wait_closed()

    finally:
        await server.stop()
