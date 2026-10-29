"""Tests for Multi-User Authentication, Cookies, and QR/Link Group Invitations."""
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database import get_connection, init_db

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_test_db():
    def _wipe():
        conn = get_connection()
        conn.execute("PRAGMA foreign_keys = OFF;")
        with conn:
            conn.execute("DELETE FROM message_receipts;")
            conn.execute("DELETE FROM workspace_invitations;")
            conn.execute("DELETE FROM messages;")
            conn.execute("DELETE FROM tasks;")
            conn.execute("DELETE FROM workspace_members;")
            conn.execute("DELETE FROM workspaces;")
            conn.execute("DELETE FROM sessions;")
            conn.execute("DELETE FROM users;")
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.close()

    init_db()
    _wipe()
    yield
    _wipe()


def test_auth_cookie_and_bearer_login():
    """Verifies that login returns session token and also sets HttpOnly session cookie."""
    # Register user
    reg_resp = client.post(
        "/api/v2/auth/register",
        json={
            "username": "diana_prince",
            "email": "diana@themyscira.io",
            "password": "AmazonWarrior2026!",
        },
    )
    assert reg_resp.status_code == 201
    data = reg_resp.json()
    assert "token" in data
    assert reg_resp.cookies.get("vgarss_session") == data["token"]

    # Verify protected /me endpoint works via Bearer token
    me_resp = client.get("/api/v2/auth/me", headers={"Authorization": f"Bearer {data['token']}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["username"] == "diana_prince"

    # Verify protected /me endpoint works via cookie alone
    me_cookie_resp = client.get("/api/v2/auth/me", cookies={"vgarss_session": data["token"]})
    assert me_cookie_resp.status_code == 200
    assert me_cookie_resp.json()["username"] == "diana_prince"

    # Test logout clears cookie and invalidates session
    logout_resp = client.post("/api/v2/auth/logout", cookies={"vgarss_session": data["token"]})
    assert logout_resp.status_code == 200

    # Ensure token is invalidated
    me_after_logout = client.get("/api/v2/auth/me", headers={"Authorization": f"Bearer {data['token']}"})
    assert me_after_logout.status_code == 401


def test_invitation_lifecycle_and_join():
    """Tests creating an invitation, public preview, joining, and quota enforcement."""
    # 1. Login as Alice (dev switch creates user if not exists)
    alice_auth = client.post("/api/v2/auth/dev-switch", json={"username": "alice"}).json()
    alice_token = alice_auth["token"]
    alice_headers = {"Authorization": f"Bearer {alice_token}"}

    # Create Alice's workspace
    ws_resp = client.post(
        "/api/v2/workspaces",
        headers=alice_headers,
        json={"name": "Engineering Workspace", "description": "Core test workspace"},
    )
    assert ws_resp.status_code == 201
    workspace_id = ws_resp.json()["id"]

    # 2. Create an invitation with max_uses=2 and expires_in_hours=24
    create_inv_resp = client.post(
        f"/api/v2/workspaces/{workspace_id}/invitations",
        headers=alice_headers,
        json={"role": "MEMBER", "expires_in_hours": 24, "max_uses": 2},
    )
    assert create_inv_resp.status_code == 201
    inv_data = create_inv_resp.json()
    code = inv_data["code"]
    inv_id = inv_data["id"]
    assert code.startswith("vgi-")
    assert inv_data["max_uses"] == 2
    assert inv_data["uses_count"] == 0

    # 3. Public preview test (no auth header needed)
    preview_resp = client.get(f"/api/v2/invitations/{code}")
    assert preview_resp.status_code == 200
    prev_data = preview_resp.json()
    assert prev_data["workspace_id"] == workspace_id
    assert prev_data["is_valid"] is True
    assert prev_data["role"] == "MEMBER"

    # 4. User 1 (new user) registers and joins via invitation
    u1_reg = client.post(
        "/api/v2/auth/register",
        json={"username": "new_dev_01", "email": "dev1@vgarss.org", "password": "Password123!"},
    ).json()
    u1_headers = {"Authorization": f"Bearer {u1_reg['token']}"}

    join1 = client.post(f"/api/v2/invitations/{code}/join", headers=u1_headers)
    assert join1.status_code == 200
    assert join1.json()["status"] == "joined"

    # Verify User 1 can now access workspace
    u1_ws = client.get("/api/v2/workspaces", headers=u1_headers).json()
    assert any(w["id"] == workspace_id for w in u1_ws)

    # 5. User 1 re-joining should be idempotent
    rejoin = client.post(f"/api/v2/invitations/{code}/join", headers=u1_headers)
    assert rejoin.status_code == 200
    assert rejoin.json()["status"] == "already_member"

    # 6. User 2 registers and joins (consumes 2nd use)
    u2_reg = client.post(
        "/api/v2/auth/register",
        json={"username": "new_dev_02", "email": "dev2@vgarss.org", "password": "Password123!"},
    ).json()
    u2_headers = {"Authorization": f"Bearer {u2_reg['token']}"}

    join2 = client.post(f"/api/v2/invitations/{code}/join", headers=u2_headers)
    assert join2.status_code == 200
    assert join2.json()["status"] == "joined"

    # 7. User 3 tries to join, but quota is exceeded!
    u3_reg = client.post(
        "/api/v2/auth/register",
        json={"username": "new_dev_03", "email": "dev3@vgarss.org", "password": "Password123!"},
    ).json()
    u3_headers = {"Authorization": f"Bearer {u3_reg['token']}"}

    join3 = client.post(f"/api/v2/invitations/{code}/join", headers=u3_headers)
    assert join3.status_code == 400
    assert "maximum usage limit" in join3.json()["detail"].lower()

    # Public preview should now report invalid due to max uses
    preview_exceeded = client.get(f"/api/v2/invitations/{code}").json()
    assert preview_exceeded["is_valid"] is False
    assert "maximum" in preview_exceeded["invalid_reason"].lower()


def test_invitation_revocation():
    """Verifies that an admin can revoke an invitation and prevent subsequent joins."""
    alice_auth = client.post("/api/v2/auth/dev-switch", json={"username": "alice"}).json()
    alice_headers = {"Authorization": f"Bearer {alice_auth['token']}"}

    ws_resp = client.post(
        "/api/v2/workspaces",
        headers=alice_headers,
        json={"name": "Revoke Test Workspace", "description": "Test revoking invites"},
    )
    assert ws_resp.status_code == 201
    workspace_id = ws_resp.json()["id"]

    create_resp = client.post(
        f"/api/v2/workspaces/{workspace_id}/invitations",
        headers=alice_headers,
        json={"role": "MEMBER", "max_uses": 5},
    ).json()
    inv_id = create_resp["id"]
    code = create_resp["code"]

    # Revoke invitation
    revoke_resp = client.delete(
        f"/api/v2/workspaces/{workspace_id}/invitations/{inv_id}",
        headers=alice_headers,
    )
    assert revoke_resp.status_code == 200

    # User attempts to join with revoked invite
    eve_reg = client.post(
        "/api/v2/auth/register",
        json={"username": "eve_hacker", "email": "eve@evil.corp", "password": "Password123!"},
    ).json()
    eve_headers = {"Authorization": f"Bearer {eve_reg['token']}"}

    join_resp = client.post(f"/api/v2/invitations/{code}/join", headers=eve_headers)
    assert join_resp.status_code == 400
    assert "revoked" in join_resp.json()["detail"].lower()
