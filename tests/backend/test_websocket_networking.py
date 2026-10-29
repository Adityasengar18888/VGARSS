"""Comprehensive Test Suite for VGARSS Group-Specific WebSockets & Event Hub.

Tests:
- Token-based Authentication & Group Authorization Boundaries
- Monotonically increasing Event Sequence Numbers per Virtual Group
- Real-time Task Lifecycle events (created, stepped, completed)
- Concurrency & Shared Resource events (acquired, blocked, released, deadlock)
- Reconnection & State Resynchronization (RESYNC_BATCH & RESYNC_FULL)
- Health checks (PING / PONG heartbeats)
- Slow-client detection & graceful eviction
- Disconnect handling and resource cleanup
"""
import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from backend.app.main import app
from backend.app.database import init_db, get_connection
from backend.app.network import connection_manager, EventType, ClientConnection
from backend.app.api.simulations import active_simulations


@pytest.fixture(autouse=True)
def clean_db():
    """Wipes SQLite database and in-memory caches before each test."""
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


def create_user_and_group(client: TestClient, username: str, group_name: str):
    """Helper to create a user, session, and virtual group."""
    reg = client.post(
        "/api/v1/auth/register",
        json={"username": username, "email": f"{username}@test.org", "password": "Password123!"},
    )
    token = reg.json()["token"]
    user_id = reg.json()["user"]["id"]

    grp = client.post(
        "/api/v1/groups",
        json={"name": group_name, "description": "Test cluster"},
        headers={"Authorization": f"Bearer {token}"},
    )
    group_id = grp.json()["id"]
    return token, user_id, group_id


def test_ws_unauthenticated_and_forbidden_access():
    """Tests that invalid tokens and cross-group unauthorized access are rejected."""
    client = TestClient(app)
    alice_token, _, grp_alice = create_user_and_group(client, "alice", "Alice Cluster")
    bob_token, _, grp_bob = create_user_and_group(client, "bob", "Bob Cluster")

    # 1. Invalid Token
    with client.websocket_connect(f"/ws/groups/{grp_alice}?token=invalid-token") as ws:
        err = ws.receive_json()
        assert err["type"] == EventType.ERROR.value
        assert err["code"] == "FORBIDDEN"
        with pytest.raises(WebSocketDisconnect) as exc:
            ws.receive_json()
        assert exc.value.code == 1008

    # 2. Cross-Group Forbidden Access (Bob trying to connect to Alice's group)
    with client.websocket_connect(f"/ws/groups/{grp_alice}?token={bob_token}") as ws:
        err = ws.receive_json()
        assert err["type"] == EventType.ERROR.value
        assert err["code"] == "FORBIDDEN"
        with pytest.raises(WebSocketDisconnect) as exc:
            ws.receive_json()
        assert exc.value.code == 1008

    # 3. Non-existent Group
    with client.websocket_connect(f"/ws/groups/non-existent-group?token={alice_token}") as ws:
        err = ws.receive_json()
        assert err["type"] == EventType.ERROR.value
        assert err["code"] == "FORBIDDEN"


def test_ws_authenticated_group_connection_and_heartbeat():
    """Tests successful authentication, handshake, and heartbeat ping/pong."""
    client = TestClient(app)
    token, _, group_id = create_user_and_group(client, "alice", "Kernel Benchmark")

    with client.websocket_connect(f"/ws/groups/{group_id}?token={token}") as ws:
        # Handshake confirmation
        welcome = ws.receive_json()
        assert welcome["type"] == EventType.AUTH_SUCCESS.value
        assert welcome["group_id"] == group_id
        assert welcome["user"]["username"] == "alice"
        assert welcome["current_seq"] == 0

        # Heartbeat Ping-Pong
        ws.send_json({"type": "PING", "timestamp": "2026-10-29T00:00:00Z"})
        pong = ws.receive_json()
        assert pong["type"] == EventType.PONG.value
        assert pong["client_timestamp"] == "2026-10-29T00:00:00Z"
        assert "server_timestamp" in pong

        # Echo request
        ws.send_json({"type": "ECHO", "data": "OS-Telemetry"})
        echo = ws.receive_json()
        assert echo["type"] == "ECHO_REPLY"
        assert echo["data"] == "OS-Telemetry"


def test_ws_first_frame_auth():
    """Tests authenticating via initial AUTH frame when token is omitted from URL."""
    client = TestClient(app)
    token, _, group_id = create_user_and_group(client, "alice", "Initial Frame Group")

    with client.websocket_connect(f"/ws/groups/{group_id}") as ws:
        # Send initial AUTH frame
        ws.send_json({"type": "AUTH", "token": token})
        welcome = ws.receive_json()
        assert welcome["type"] == EventType.AUTH_SUCCESS.value
        assert welcome["user"]["username"] == "alice"


def test_ws_event_sequence_numbers_and_task_lifecycle():
    """Tests monotonically increasing sequence numbers during simulation lifecycle."""
    client = TestClient(app)
    token, _, group_id = create_user_and_group(client, "alice", "Lifecycle Group")

    with client.websocket_connect(f"/ws/groups/{group_id}?token={token}") as ws:
        _ = ws.receive_json()  # AUTH_SUCCESS

        # 1. Create Simulation via REST API
        sim_payload = {
            "name": "FCFS Bench",
            "algorithm": "FCFS",
            "time_quantum": 2,
            "processes": [
                {"id": "P1", "arrival_time": 0, "burst_time": 2, "priority": 1},
                {"id": "P2", "arrival_time": 1, "burst_time": 2, "priority": 2},
            ],
            "resources": [],
        }
        res = client.post(
            f"/api/v1/groups/{group_id}/simulations",
            json=sim_payload,
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 201
        sim_id = res.json()["id"]

        # WebSocket receives SIMULATION_CREATED with seq = 1
        ev_created = ws.receive_json()
        assert ev_created["type"] == EventType.SIMULATION_CREATED.value
        assert ev_created["seq"] == 1
        assert ev_created["simulation_id"] == sim_id

        # 2. Step Simulation Tick 1
        step_res = client.post(
            f"/api/v1/groups/{group_id}/simulations/{sim_id}/step",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert step_res.status_code == 200

        # WebSocket receives SIMULATION_STEP with seq = 2
        ev_step1 = ws.receive_json()
        assert ev_step1["type"] == EventType.SIMULATION_STEP.value
        assert ev_step1["seq"] == 2
        assert ev_step1["payload"]["tick"] == 1
        assert ev_step1["payload"]["running_process_id"] == "P1"

        # 3. Step Simulation Tick 2 (P1 terminates)
        client.post(
            f"/api/v1/groups/{group_id}/simulations/{sim_id}/step",
            headers={"Authorization": f"Bearer {token}"},
        )
        ev_step2 = ws.receive_json()
        assert ev_step2["type"] == EventType.SIMULATION_STEP.value
        assert ev_step2["seq"] == 3


def test_ws_concurrency_and_resource_change_events():
    """Tests WebSocket events for resource acquire, block, and release."""
    client = TestClient(app)
    token, _, group_id = create_user_and_group(client, "alice", "Resource Group")

    with client.websocket_connect(f"/ws/groups/{group_id}?token={token}") as ws:
        _ = ws.receive_json()  # AUTH_SUCCESS

        # Create simulation with a mutex resource
        sim_payload = {
            "name": "Mutex Evaluation",
            "algorithm": "FCFS",
            "time_quantum": 2,
            "processes": [
                {"id": "P1", "arrival_time": 0, "burst_time": 5, "priority": 1},
                {"id": "P2", "arrival_time": 0, "burst_time": 5, "priority": 1},
            ],
            "resources": [
                {"id": "R1", "name": "DB_MUTEX", "total_capacity": 1, "resource_type": "MUTEX", "order_rank": 1}
            ],
        }
        res = client.post(
            f"/api/v1/groups/{group_id}/simulations",
            json=sim_payload,
            headers={"Authorization": f"Bearer {token}"},
        )
        sim_id = res.json()["id"]
        _ = ws.receive_json()  # SIMULATION_CREATED

        # P1 acquires R1 (GRANTED)
        client.post(
            f"/api/v1/groups/{group_id}/simulations/{sim_id}/resources/acquire",
            json={"process_id": "P1", "resource_id": "R1", "mode": "EXCLUSIVE", "units": 1},
            headers={"Authorization": f"Bearer {token}"},
        )
        ev_acq = ws.receive_json()
        assert ev_acq["type"] == EventType.RESOURCE_ACQUIRED.value
        assert ev_acq["payload"]["granted"] is True
        assert ev_acq["payload"]["process_id"] == "P1"

        # P2 requests R1 (BLOCKED)
        client.post(
            f"/api/v1/groups/{group_id}/simulations/{sim_id}/resources/acquire",
            json={"process_id": "P2", "resource_id": "R1", "mode": "EXCLUSIVE", "units": 1},
            headers={"Authorization": f"Bearer {token}"},
        )
        ev_blk = ws.receive_json()
        assert ev_blk["type"] == EventType.RESOURCE_BLOCKED.value
        assert ev_blk["payload"]["granted"] is False
        assert ev_blk["payload"]["process_id"] == "P2"

        # P1 releases R1 (UNBLOCKS P2)
        client.post(
            f"/api/v1/groups/{group_id}/simulations/{sim_id}/resources/release",
            json={"process_id": "P1", "resource_id": "R1", "units": 1},
            headers={"Authorization": f"Bearer {token}"},
        )
        ev_rel = ws.receive_json()
        assert ev_rel["type"] == EventType.RESOURCE_RELEASED.value
        assert ev_rel["payload"]["released"] is True
        assert "P2" in ev_rel["payload"]["awakened_processes"]


def test_ws_reconnection_and_state_resynchronization():
    """Tests replaying missed events upon reconnecting with last_seq."""
    client = TestClient(app)
    token, _, group_id = create_user_and_group(client, "alice", "Resync Group")

    # 1. Initial connection: receive event 1
    with client.websocket_connect(f"/ws/groups/{group_id}?token={token}") as ws:
        _ = ws.receive_json()  # AUTH_SUCCESS

        # Generate event 1
        connection_manager.broadcast(group_id, "TEST_EV_1", {"data": 100})
        ev1 = ws.receive_json()
        assert ev1["seq"] == 1

    # Client disconnects. Generate events 2, 3, 4 while client is offline
    connection_manager.broadcast(group_id, "TEST_EV_2", {"data": 200})
    connection_manager.broadcast(group_id, "TEST_EV_3", {"data": 300})
    connection_manager.broadcast(group_id, "TEST_EV_4", {"data": 400})

    # 2. Client reconnects with ?last_seq=1
    with client.websocket_connect(f"/ws/groups/{group_id}?token={token}&last_seq=1") as ws:
        welcome = ws.receive_json()
        assert welcome["type"] == EventType.AUTH_SUCCESS.value
        assert welcome["current_seq"] == 4

        # Client receives RESYNC_BATCH containing missed events 2, 3, 4
        resync = ws.receive_json()
        assert resync["type"] == EventType.RESYNC_BATCH.value
        assert resync["from_seq"] == 2
        assert resync["to_seq"] == 4
        assert resync["missed_count"] == 3
        seqs = [e["seq"] for e in resync["events"]]
        assert seqs == [2, 3, 4]


def test_ws_resync_full_snapshot():
    """Tests RESYNC_FULL fallback when last_seq is 0 or gap is too large."""
    client = TestClient(app)
    token, _, group_id = create_user_and_group(client, "alice", "Snapshot Group")

    # Generate some simulation data
    client.post(
        f"/api/v1/groups/{group_id}/simulations",
        json={
            "name": "State Snapshot Sim",
            "algorithm": "ROUND_ROBIN",
            "time_quantum": 2,
            "processes": [{"id": "P1", "arrival_time": 0, "burst_time": 4, "priority": 1}],
            "resources": [],
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    with client.websocket_connect(f"/ws/groups/{group_id}?token={token}") as ws:
        _ = ws.receive_json()  # AUTH_SUCCESS

        # Client requests full state snapshot with last_seq=0
        ws.send_json({"type": "RESYNC", "last_seq": 0})
        snapshot = ws.receive_json()
        assert snapshot["type"] == EventType.RESYNC_FULL.value
        assert len(snapshot["simulations"]) >= 1
        assert snapshot["simulations"][0]["name"] == "State Snapshot Sim"


def test_ws_slow_client_handling():
    """Tests that a client with a full outbound queue is diagnosed as a Slow Client and evicted."""
    client = TestClient(app)
    token, _, group_id = create_user_and_group(client, "alice", "Slow Client Group")

    with client.websocket_connect(f"/ws/groups/{group_id}?token={token}") as ws:
        _ = ws.receive_json()  # AUTH_SUCCESS

        # Retrieve the underlying ClientConnection instance
        group_clients = list(connection_manager._groups[group_id])
        assert len(group_clients) == 1
        client_conn: ClientConnection = group_clients[0]

        # Force queue capacity to 2 for deterministic testing
        client_conn.outbound_queue = type(client_conn.outbound_queue)(maxsize=2)

        # Enqueue 2 events (fills queue)
        assert client_conn.send_event_nowait({"type": "EV1"}) is True
        assert client_conn.send_event_nowait({"type": "EV2"}) is True

        # 3rd event exceeds maxsize=2 -> diagnoses slow client & triggers eviction
        dropped = client_conn.send_event_nowait({"type": "EV3"})
        assert dropped is False
        assert client_conn.is_closed is True


def test_ws_connection_cleanup_on_disconnect():
    """Tests that disconnecting a client removes it from active tracking sets."""
    client = TestClient(app)
    token, _, group_id = create_user_and_group(client, "alice", "Cleanup Group")

    with client.websocket_connect(f"/ws/groups/{group_id}?token={token}"):
        assert connection_manager.get_group_client_count(group_id) == 1

    # Outside the context manager: connection has been cleanly closed
    import time
    for _ in range(20):
        if connection_manager.get_group_client_count(group_id) == 0:
            break
        time.sleep(0.05)
    assert connection_manager.get_group_client_count(group_id) == 0
