"""Comprehensive REST API Integration Test Suite for VGARSS.

Covers:
- Authentication (registration, login, invalid credentials, password hash protection)
- Unauthenticated access rejection (401 Unauthorized)
- Virtual Group creation, membership & Cross-Group Authorization (403 Forbidden)
- Simulation lifecycle (creation, stepping, play to completion, invalid input 422)
- Task state transition validation (cannot step completed simulation)
- Persistence after restart (engine reconstruction from SQLite)
- Resource acquisition, release, and deadlock detection API
"""
import pytest
import sqlite3
from httpx import AsyncClient, ASGITransport
from backend.app.main import app
from backend.app.database import init_db, get_connection
from backend.app.api.simulations import active_simulations


@pytest.fixture(autouse=True)
def setup_test_db():
    """Ensures a clean database state before each test."""
    init_db()
    active_simulations.clear()
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


@pytest.mark.asyncio
async def test_user_registration_and_login():
    """Tests user registration, token generation, and password hash exclusion."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Register User
        reg_payload = {
            "username": "alice_dev",
            "email": "alice@vgarss.org",
            "password": "SecurePassword123!",
        }
        res = await client.post("/api/v1/auth/register", json=reg_payload)
        assert res.status_code == 201
        data = res.json()
        assert "token" in data
        assert data["user"]["username"] == "alice_dev"
        # Invariant: Password hash MUST NEVER be exposed in API responses
        assert "password_hash" not in data["user"]
        token = data["token"]

        # 2. Duplicate registration fails
        dup_res = await client.post("/api/v1/auth/register", json=reg_payload)
        assert dup_res.status_code == 400

        # 3. Login with valid password
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"username": "alice_dev", "password": "SecurePassword123!"},
        )
        assert login_res.status_code == 200
        assert "token" in login_res.json()

        # 4. Login with invalid password
        bad_login = await client.post(
            "/api/v1/auth/login",
            json={"username": "alice_dev", "password": "WrongPassword"},
        )
        assert bad_login.status_code == 401

        # 5. Access /auth/me with Bearer token
        me_res = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert me_res.status_code == 200
        assert me_res.json()["email"] == "alice@vgarss.org"


@pytest.mark.asyncio
async def test_unauthenticated_request_rejected():
    """Protected endpoints must reject requests lacking a valid session token."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/groups")
        assert res.status_code == 401


@pytest.mark.asyncio
async def test_virtual_group_rbac_and_cross_group_isolation():
    """Enforces that users cannot access or mutate virtual groups they do not belong to (403 Forbidden)."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Register User 1 (Alice)
        u1 = await client.post(
            "/api/v1/auth/register",
            json={"username": "alice_rbac", "email": "alice_rbac@vgarss.org", "password": "pass123456"},
        )
        t1 = u1.json()["token"]

        # Register User 2 (Bob)
        u2 = await client.post(
            "/api/v1/auth/register",
            json={"username": "bob_rbac", "email": "bob_rbac@vgarss.org", "password": "pass123456"},
        )
        t2 = u2.json()["token"]

        # Alice creates Group A
        g_res = await client.post(
            "/api/v1/groups",
            json={"name": "Alice Group A", "description": "Confidential kernel simulations"},
            headers={"Authorization": f"Bearer {t1}"},
        )
        assert g_res.status_code == 201
        group_a_id = g_res.json()["id"]

        # Alice can view her group
        a_view = await client.get(
            f"/api/v1/groups/{group_a_id}",
            headers={"Authorization": f"Bearer {t1}"},
        )
        assert a_view.status_code == 200

        # Bob attempts to access Alice's Group A -> MUST return 403 Forbidden!
        b_view = await client.get(
            f"/api/v1/groups/{group_a_id}",
            headers={"Authorization": f"Bearer {t2}"},
        )
        assert b_view.status_code == 403

        # Bob attempts to create a simulation inside Alice's Group A -> MUST return 403 Forbidden!
        b_sim = await client.post(
            f"/api/v1/groups/{group_a_id}/simulations",
            json={
                "name": "Intruder Sim",
                "algorithm": "FCFS",
                "processes": [{"id": "P1", "arrival_time": 0, "burst_time": 4}],
            },
            headers={"Authorization": f"Bearer {t2}"},
        )
        assert b_sim.status_code == 403


@pytest.mark.asyncio
async def test_simulation_lifecycle_and_stepping():
    """Tests creating, stepping, and completing a simulation via REST routes."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Register & login
        auth = await client.post(
            "/api/v1/auth/register",
            json={"username": "sim_tester", "email": "tester@vgarss.org", "password": "password123"},
        )
        token = auth.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Create Group
        grp = await client.post("/api/v1/groups", json={"name": "Sim Test Group"}, headers=headers)
        gid = grp.json()["id"]

        # Invalid burst time validation (burst <= 0)
        invalid_sim = await client.post(
            f"/api/v1/groups/{gid}/simulations",
            json={
                "name": "Bad Sim",
                "algorithm": "ROUND_ROBIN",
                "processes": [{"id": "P1", "arrival_time": 0, "burst_time": 0}],
            },
            headers=headers,
        )
        assert invalid_sim.status_code == 422  # Pydantic validation error

        # Create valid simulation
        sim_res = await client.post(
            f"/api/v1/groups/{gid}/simulations",
            json={
                "name": "Valid RR Sim",
                "algorithm": "ROUND_ROBIN",
                "time_quantum": 2,
                "processes": [
                    {"id": "P1", "arrival_time": 0, "burst_time": 3},
                    {"id": "P2", "arrival_time": 0, "burst_time": 2},
                ],
            },
            headers=headers,
        )
        assert sim_res.status_code == 201
        sid = sim_res.json()["id"]

        # Step 1 tick
        step1 = await client.post(f"/api/v1/groups/{gid}/simulations/{sid}/step", headers=headers)
        assert step1.status_code == 200
        data1 = step1.json()
        assert data1["tick"] == 1
        assert data1["running_process_id"] == "P1"

        # Play to completion
        play = await client.post(f"/api/v1/groups/{gid}/simulations/{sid}/play", headers=headers)
        assert play.status_code == 200
        completed_data = play.json()
        assert completed_data["status"] == "COMPLETED"
        assert completed_data["current_tick"] == 5  # total burst 3 + 2 = 5 ticks
        assert completed_data["cpu_utilization"] == 100.0

        # Cannot step a completed simulation -> 400 Bad Request
        bad_step = await client.post(f"/api/v1/groups/{gid}/simulations/{sid}/step", headers=headers)
        assert bad_step.status_code == 400


@pytest.mark.asyncio
async def test_persistence_after_restart():
    """Verifies that simulation state and metrics persist in SQLite across server/engine restarts."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Register user and create group
        auth = await client.post(
            "/api/v1/auth/register",
            json={"username": "persist_user", "email": "persist@vgarss.org", "password": "password123"},
        )
        token = auth.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        grp = await client.post("/api/v1/groups", json={"name": "Persistence Group"}, headers=headers)
        gid = grp.json()["id"]

        # Create and step simulation
        sim = await client.post(
            f"/api/v1/groups/{gid}/simulations",
            json={
                "name": "Persisted FCFS",
                "algorithm": "FCFS",
                "processes": [
                    {"id": "P1", "arrival_time": 0, "burst_time": 4},
                    {"id": "P2", "arrival_time": 2, "burst_time": 3},
                ],
            },
            headers=headers,
        )
        sid = sim.json()["id"]

        # Execute 2 steps
        await client.post(f"/api/v1/groups/{gid}/simulations/{sid}/step", headers=headers)
        await client.post(f"/api/v1/groups/{gid}/simulations/{sid}/step", headers=headers)

        # SIMULATE RESTART: Wipe in-memory active_simulations cache!
        active_simulations.clear()
        assert sid not in active_simulations

        # Re-query simulation details: must reconstruct cleanly from SQLite!
        resumed = await client.get(f"/api/v1/groups/{gid}/simulations/{sid}", headers=headers)
        assert resumed.status_code == 200
        resumed_data = resumed.json()
        assert resumed_data["id"] == sid
        assert resumed_data["current_tick"] == 2
        assert resumed_data["status"] == "RUNNING"


@pytest.mark.asyncio
async def test_resource_and_deadlock_api():
    """Tests resource allocation, release, and deadlock detection via REST endpoints."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        auth = await client.post(
            "/api/v1/auth/register",
            json={"username": "deadlock_tester", "email": "deadlock@vgarss.org", "password": "password123"},
        )
        headers = {"Authorization": f"Bearer {auth.json()['token']}"}

        grp = await client.post("/api/v1/groups", json={"name": "Deadlock Lab Group"}, headers=headers)
        gid = grp.json()["id"]

        # Create simulation with 2 resources
        sim = await client.post(
            f"/api/v1/groups/{gid}/simulations",
            json={
                "name": "Deadlock Sim",
                "algorithm": "FCFS",
                "processes": [
                    {"id": "P1", "arrival_time": 0, "burst_time": 10},
                    {"id": "P2", "arrival_time": 0, "burst_time": 10},
                ],
                "resources": [
                    {"id": "R1", "name": "Resource 1", "total_capacity": 1},
                    {"id": "R2", "name": "Resource 2", "total_capacity": 1},
                ],
            },
            headers=headers,
        )
        sid = sim.json()["id"]

        # P1 acquires R1
        acq1 = await client.post(
            f"/api/v1/groups/{gid}/simulations/{sid}/resources/acquire",
            json={"process_id": "P1", "resource_id": "R1"},
            headers=headers,
        )
        assert acq1.status_code == 200
        assert acq1.json()["granted"] is True

        # P2 acquires R2
        acq2 = await client.post(
            f"/api/v1/groups/{gid}/simulations/{sid}/resources/acquire",
            json={"process_id": "P2", "resource_id": "R2"},
            headers=headers,
        )
        assert acq2.status_code == 200
        assert acq2.json()["granted"] is True

        # No deadlock yet
        dl_check1 = await client.get(
            f"/api/v1/groups/{gid}/simulations/{sid}/resources/deadlock",
            headers=headers,
        )
        assert dl_check1.json()["deadlock_detected"] is False

        # P1 requests R2 -> Blocked
        await client.post(
            f"/api/v1/groups/{gid}/simulations/{sid}/resources/acquire",
            json={"process_id": "P1", "resource_id": "R2"},
            headers=headers,
        )

        # P2 requests R1 -> Blocked, triggers cycle!
        await client.post(
            f"/api/v1/groups/{gid}/simulations/{sid}/resources/acquire",
            json={"process_id": "P2", "resource_id": "R1"},
            headers=headers,
        )

        # Query deadlock endpoint: must flag circular wait!
        dl_check2 = await client.get(
            f"/api/v1/groups/{gid}/simulations/{sid}/resources/deadlock",
            headers=headers,
        )
        dl_data = dl_check2.json()
        assert dl_data["deadlock_detected"] is True
        assert set(dl_data["cycle_processes"]) == {"P1", "P2"}
