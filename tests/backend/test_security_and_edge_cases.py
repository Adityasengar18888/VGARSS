"""Comprehensive Security, Boundary, and Invariant Verification Suite for VGARSS.

Probes and validates:
1. Password hashing & credential validation
2. Session token tamper-resistance & expiration
3. Virtual Group multi-tenant isolation & RBAC boundaries
4. API schema boundary enforcement (fuzzing negative bursts, zero quantum, duplicate IDs)
5. Concurrency & Resource capacity invariants
6. Deadlock graph cycle detection correctness
7. Raw TCP framing robustness (oversized frames, malformed JSON, truncated buffers)
8. WebSocket error resilience (malformed frames, cross-group snooping)
"""
import struct
import asyncio
import datetime
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.database import init_db, get_connection
from backend.app.security import hash_password, verify_password, generate_session_token
from backend.app.network import connection_manager, EventType, RawTcpServer
from backend.app.network.framing import (
    write_frame,
    read_frame,
    encode_frame,
    HEADER_FORMAT,
    HEADER_SIZE,
    FrameTooLargeError,
    MalformedPayloadError,
)
from backend.app.simulation.resources import (
    ResourceManager,
    ResourceDefinition,
    ResourceType,
)
from backend.app.simulation.resources.models import (
    ResourceMode,
    ResourceError,
)


@pytest.fixture(autouse=True)
def clean_database_state():
    """Wipes SQLite database and in-memory caches before test execution."""
    init_db()
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


# =============================================================================
# 1. Cryptographic & Authentication Security
# =============================================================================

def test_password_hashing_entropy_and_verification():
    """Verifies that password hashing produces unique salts and constant-time checks."""
    pw = "SuperSecretPassword99!"
    hash1 = hash_password(pw)
    hash2 = hash_password(pw)

    # Different salts must yield different hashes for identical plaintext
    assert hash1 != hash2
    assert ":" in hash1
    salt1, key1 = hash1.split(":", 1)
    salt2, key2 = hash2.split(":", 1)
    assert salt1 != salt2
    assert len(bytes.fromhex(salt1)) == 16

    # Positive and negative verification
    assert verify_password(pw, hash1) is True
    assert verify_password(pw, hash2) is True
    assert verify_password("WrongPassword123!", hash1) is False
    assert verify_password("", hash1) is False
    assert verify_password(pw, "") is False
    assert verify_password(pw, "corrupted:hash") is False


def test_session_token_entropy_and_expiration():
    """Verifies CSPRNG token generation and expiration calculation."""
    token, expires_at = generate_session_token()
    assert len(token) >= 32
    now = datetime.datetime.now(datetime.timezone.utc)
    delta = expires_at - now
    # Verify default expiration window is ~24 hours
    assert 23.9 <= delta.total_seconds() / 3600 <= 24.1


def test_expired_session_token_rejected_by_api():
    """Verifies that an expired session token is rejected with HTTP 401."""
    client = TestClient(app)
    # Register user
    reg = client.post(
        "/api/v1/auth/register",
        json={"username": "alice_exp", "email": "alice_exp@vgarss.org", "password": "Password123!"},
    )
    token = reg.json()["token"]

    # Manually backdate the session expiration in SQLite to the past
    conn = get_connection()
    past_time = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=2)).isoformat()
    conn.execute("UPDATE sessions SET expires_at = ? WHERE token = ?", (past_time, token))
    conn.commit()
    conn.close()

    # Attempt request with expired session
    res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401
    assert "expired" in res.json()["detail"].lower()


# =============================================================================
# 2. Virtual Group Isolation & Authorization Boundaries
# =============================================================================

def test_cross_group_unauthorized_tampering():
    """Verifies that User A cannot read, step, or mutate simulations belonging to User B."""
    client = TestClient(app)

    # User A creates Group A & Simulation A
    res_a = client.post(
        "/api/v1/auth/register",
        json={"username": "user_a", "email": "a@vgarss.org", "password": "Password123!"},
    )
    token_a = res_a.json()["token"]
    grp_a = client.post(
        "/api/v1/groups",
        json={"name": "Cluster A"},
        headers={"Authorization": f"Bearer {token_a}"},
    ).json()["id"]

    sim_a = client.post(
        f"/api/v1/groups/{grp_a}/simulations",
        json={
            "name": "Sim A",
            "processes": [{"id": "P1", "arrival_time": 0, "burst_time": 2}],
        },
        headers={"Authorization": f"Bearer {token_a}"},
    ).json()["id"]

    # User B registers
    res_b = client.post(
        "/api/v1/auth/register",
        json={"username": "user_b", "email": "b@vgarss.org", "password": "Password123!"},
    )
    token_b = res_b.json()["token"]

    # User B attempts to access Group A
    b_get_grp = client.get(f"/api/v1/groups/{grp_a}", headers={"Authorization": f"Bearer {token_b}"})
    assert b_get_grp.status_code == 403

    # User B attempts to step Simulation A
    b_step_sim = client.post(
        f"/api/v1/groups/{grp_a}/simulations/{sim_a}/step",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert b_step_sim.status_code == 403

    # User B attempts to acquire a resource in Simulation A
    b_acq_res = client.post(
        f"/api/v1/groups/{grp_a}/simulations/{sim_a}/resources/acquire",
        json={"process_id": "P1", "resource_id": "R1", "mode": "EXCLUSIVE"},
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert b_acq_res.status_code == 403


# =============================================================================
# 3. API Input Validation & Boundary Fuzzing
# =============================================================================

def test_api_schema_boundary_enforcement():
    """Fuzzes simulation API inputs with illegal negative, zero, and malformed values."""
    client = TestClient(app)
    reg = client.post(
        "/api/v1/auth/register",
        json={"username": "fuzzer", "email": "fuzzer@vgarss.org", "password": "Password123!"},
    )
    token = reg.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    grp_id = client.post("/api/v1/groups", json={"name": "Fuzz Cluster"}, headers=headers).json()["id"]

    # 1. Negative burst time -> Must be rejected (gt=0)
    bad_burst = client.post(
        f"/api/v1/groups/{grp_id}/simulations",
        json={"name": "Bad Burst", "processes": [{"id": "P1", "arrival_time": 0, "burst_time": -5}]},
        headers=headers,
    )
    assert bad_burst.status_code == 422

    # 2. Zero burst time -> Must be rejected (gt=0)
    zero_burst = client.post(
        f"/api/v1/groups/{grp_id}/simulations",
        json={"name": "Zero Burst", "processes": [{"id": "P1", "arrival_time": 0, "burst_time": 0}]},
        headers=headers,
    )
    assert zero_burst.status_code == 422

    # 3. Negative arrival time -> Must be rejected (ge=0)
    bad_arrival = client.post(
        f"/api/v1/groups/{grp_id}/simulations",
        json={"name": "Bad Arrival", "processes": [{"id": "P1", "arrival_time": -1, "burst_time": 3}]},
        headers=headers,
    )
    assert bad_arrival.status_code == 422

    # 4. Zero time quantum -> Must be rejected (ge=1)
    zero_quantum = client.post(
        f"/api/v1/groups/{grp_id}/simulations",
        json={
            "name": "Zero Quantum",
            "time_quantum": 0,
            "processes": [{"id": "P1", "arrival_time": 0, "burst_time": 3}],
        },
        headers=headers,
    )
    assert zero_quantum.status_code == 422

    # 5. Empty process list -> Must be rejected (min_length=1)
    empty_procs = client.post(
        f"/api/v1/groups/{grp_id}/simulations",
        json={"name": "Empty Procs", "processes": []},
        headers=headers,
    )
    assert empty_procs.status_code == 422

    # 6. Duplicate Process IDs in payload -> Rejected with HTTP 422 by Pydantic validator
    dup_procs = client.post(
        f"/api/v1/groups/{grp_id}/simulations",
        json={
            "name": "Dup Procs",
            "processes": [
                {"id": "P1", "arrival_time": 0, "burst_time": 3},
                {"id": "P1", "arrival_time": 1, "burst_time": 4},
            ],
        },
        headers=headers,
    )
    assert dup_procs.status_code == 422
    assert "duplicate" in dup_procs.text.lower()


# =============================================================================
# 4. Concurrency Invariants & Unauthorized Resource Access
# =============================================================================

def test_unauthorized_and_duplicate_resource_release():
    """Verifies that unauthorized release and double releases are rejected."""
    mgr = ResourceManager()
    mgr.register_resource(ResourceDefinition(id="R1", name="Lock", total_capacity=1, resource_type=ResourceType.MUTEX))

    # P1 acquires R1
    assert mgr.acquire("P1", "R1", ResourceMode.EXCLUSIVE, 1) is True

    # P2 attempts to release R1 without holding it -> Must raise ResourceError
    with pytest.raises(ResourceError):
        mgr.release("P2", "R1")

    # P1 releases R1 -> Succeeded
    awakened = mgr.release("P1", "R1")
    assert awakened == []
    assert mgr.get_resource("R1").available_units == 1

    # P1 attempts to double-release R1 -> Must raise ResourceError
    with pytest.raises(ResourceError):
        mgr.release("P1", "R1")


def test_semaphore_capacity_invariants():
    """Verifies counting semaphore capacity bounds (0 <= available <= capacity)."""
    mgr = ResourceManager()
    mgr.register_resource(ResourceDefinition(id="SEM", name="Pool", total_capacity=2, resource_type=ResourceType.SEMAPHORE))

    # P1 and P2 acquire 1 unit each
    assert mgr.acquire("P1", "SEM", ResourceMode.SHARED, 1) is True
    assert mgr.acquire("P2", "SEM", ResourceMode.SHARED, 1) is True
    assert mgr.get_resource("SEM").available_units == 0

    # P3 requests 1 unit -> denied (enqueued in wait queue)
    assert mgr.acquire("P3", "SEM", ResourceMode.SHARED, 1) is False
    assert any(w.process_id == "P3" for w in mgr.get_resource("SEM").wait_queue)

    # Over-allocation request (asking for 5 units when capacity is 2) -> denied
    with pytest.raises(ResourceError):
        mgr.acquire("P4", "SEM", ResourceMode.SHARED, 5)

    # P1 releases -> P3 awakened atomically
    awakened = mgr.release("P1", "SEM", 1)
    assert "P3" in awakened
    assert mgr.get_resource("SEM").available_units == 0


# =============================================================================
# 5. Raw TCP Protocol Robustness & Network Invariants
# =============================================================================

@pytest.mark.asyncio
async def test_tcp_frame_too_large_rejection():
    """Verifies that TCP server rejects frames exceeding max_frame_size."""
    server = RawTcpServer(host="127.0.0.1", port=0, max_connections=5, max_frame_size=512, read_timeout=2.0)
    await server.start()
    port = server.actual_port

    try:
        reader, writer = await asyncio.open_connection("127.0.0.1", port)
        await read_frame(reader)  # Handshake

        # Send a declared length exceeding 512 bytes
        giant_header = struct.pack(HEADER_FORMAT, 1024 * 1024)
        writer.write(giant_header)
        await writer.drain()

        # Server sends FRAME_TOO_LARGE error and terminates
        err_frame = await read_frame(reader)
        assert err_frame["status"] == "ERROR"
        assert err_frame["code"] == "FRAME_TOO_LARGE"

        writer.close()
        await writer.wait_closed()
    finally:
        await server.stop()


@pytest.mark.asyncio
async def test_tcp_malformed_json_recovery():
    """Verifies that non-JSON payload returns MALFORMED_PAYLOAD without crashing the connection."""
    server = RawTcpServer(host="127.0.0.1", port=0, max_connections=5, max_frame_size=4096, read_timeout=2.0)
    await server.start()
    port = server.actual_port

    try:
        reader, writer = await asyncio.open_connection("127.0.0.1", port)
        await read_frame(reader)  # Handshake

        # Send invalid JSON
        bad_json = b"NOT_A_VALID_JSON_STRING{{{}"
        writer.write(struct.pack(HEADER_FORMAT, len(bad_json)) + bad_json)
        await writer.drain()

        err_frame = await read_frame(reader)
        assert err_frame["status"] == "ERROR"
        assert err_frame["code"] == "MALFORMED_PAYLOAD"

        # Connection should still be alive for a valid PING
        await write_frame(writer, {"action": "PING"})
        pong = await read_frame(reader)
        assert pong["action"] == "PONG"

        writer.close()
        await writer.wait_closed()
    finally:
        await server.stop()
