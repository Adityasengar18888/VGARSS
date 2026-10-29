"""Comprehensive Tests for VGARSS 2.0 Chat Platform, Workspaces, and Tasks.

Verifies:
1. Authentication: Registration, bcrypt password hashing, login, session tokens, logout
2. Workspace & Membership Authorization: RBAC enforcement, unauthorized access prevention
3. Message Persistence: Stored with sender, channel/conversation, timestamp, and message ID
4. Pagination & Chronological Ordering: Messages returned oldest-to-newest with cursor limits
5. Idempotency: Handling duplicate client_msg_id submissions
6. Real-Time WebSocket Multi-Client: Broadcast of messages, presence, and typing indicators
7. Reconnection & Catch-Up: Replaying missed messages via sequence numbers
8. Task Coordination Bridge: Creation from message, state transitions, and system notifications
"""
import uuid
import json
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.database import init_db, get_connection
from backend.app.security import verify_password
from backend.app.network.chat_hub import chat_hub


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
        conn.execute("DELETE FROM tasks;")
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


def test_auth_registration_bcrypt_and_login():
    """Verifies user registration, bcrypt password hashing, login, and session validation."""
    client = TestClient(app)

    # 1. Register Alice
    reg_resp = client.post(
        "/api/v2/auth/register",
        json={
            "username": "alice",
            "email": "alice@vgarss.org",
            "password": "StrongBcryptPassword123!",
        },
    )
    assert reg_resp.status_code == 201
    reg_data = reg_resp.json()
    assert "token" in reg_data
    token = reg_data["token"]
    assert reg_data["user"]["username"] == "alice"

    # Verify password was stored with bcrypt in DB
    conn = get_connection()
    row = conn.execute("SELECT password_hash FROM users WHERE username = 'alice'").fetchone()
    conn.close()
    assert row is not None
    assert verify_password("StrongBcryptPassword123!", row["password_hash"])
    assert not verify_password("WrongPassword!", row["password_hash"])

    # 2. Login
    login_resp = client.post(
        "/api/v2/auth/login",
        json={"username": "alice", "password": "StrongBcryptPassword123!"},
    )
    assert login_resp.status_code == 200
    login_token = login_resp.json()["token"]

    # 3. Access protected /me
    me_resp = client.get("/api/v2/auth/me", headers={"Authorization": f"Bearer {login_token}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["username"] == "alice"

    # 4. Wrong password login fails
    bad_login = client.post(
        "/api/v2/auth/login",
        json={"username": "alice", "password": "BadPassword!"},
    )
    assert bad_login.status_code == 401


def test_workspace_rbac_and_unauthorized_access():
    """Verifies that unauthorized users cannot read or write to workspaces they don't belong to."""
    client = TestClient(app)

    # Register Alice (Owner of WS A)
    alice_tok = client.post(
        "/api/v2/auth/register",
        json={"username": "alice_rbac", "email": "alice_rbac@vgarss.org", "password": "Password123!"},
    ).json()["token"]

    # Register Bob (Intruder)
    bob_tok = client.post(
        "/api/v2/auth/register",
        json={"username": "bob_rbac", "email": "bob_rbac@vgarss.org", "password": "Password123!"},
    ).json()["token"]

    # Alice creates a private workspace
    ws_resp = client.post(
        "/api/v2/workspaces",
        json={"name": "Alice Private Lab", "description": "Confidential research"},
        headers={"Authorization": f"Bearer {alice_tok}"},
    )
    assert ws_resp.status_code == 201
    ws_id = ws_resp.json()["id"]

    # Bob attempts to list members of Alice's workspace -> MUST BE 403 FORBIDDEN
    forbidden_resp = client.get(
        f"/api/v2/workspaces/{ws_id}/members",
        headers={"Authorization": f"Bearer {bob_tok}"},
    )
    assert forbidden_resp.status_code == 403
    assert "not a member" in forbidden_resp.json()["detail"].lower()

    # Bob attempts to list channels -> MUST BE 403 FORBIDDEN
    forbidden_chans = client.get(
        f"/api/v2/workspaces/{ws_id}/channels",
        headers={"Authorization": f"Bearer {bob_tok}"},
    )
    assert forbidden_chans.status_code == 403

    # Alice adds Bob as MEMBER
    add_resp = client.post(
        f"/api/v2/workspaces/{ws_id}/members",
        json={"username": "bob_rbac", "role": "MEMBER"},
        headers={"Authorization": f"Bearer {alice_tok}"},
    )
    assert add_resp.status_code == 201
    assert add_resp.json()["role"] == "MEMBER"

    # Now Bob can read workspace members
    allowed_resp = client.get(
        f"/api/v2/workspaces/{ws_id}/members",
        headers={"Authorization": f"Bearer {bob_tok}"},
    )
    assert allowed_resp.status_code == 200
    members = allowed_resp.json()
    assert len(members) == 2


def test_message_persistence_and_chronological_pagination():
    """Verifies that messages are persisted with all metadata and retrieved in chronological order."""
    client = TestClient(app)

    # Register user & create workspace
    tok = client.post(
        "/api/v2/auth/register",
        json={"username": "carol", "email": "carol@vgarss.org", "password": "Password123!"},
    ).json()["token"]

    ws_id = client.post(
        "/api/v2/workspaces",
        json={"name": "Engineering Workspace"},
        headers={"Authorization": f"Bearer {tok}"},
    ).json()["id"]

    # Get the default general channel
    chans = client.get(f"/api/v2/workspaces/{ws_id}/channels", headers={"Authorization": f"Bearer {tok}"}).json()
    general_ch = next(c for c in chans if c["name"] == "general")
    ch_id = general_ch["id"]

    # Post 5 sequential messages
    sent_ids = []
    for i in range(1, 6):
        res = client.post(
            f"/api/v2/channels/{ch_id}/messages",
            json={"content": f"Message number {i}", "client_msg_id": f"client-id-{i}"},
            headers={"Authorization": f"Bearer {tok}"},
        )
        assert res.status_code == 201
        data = res.json()
        assert data["content"] == f"Message number {i}"
        assert data["sender_username"] == "carol"
        assert data["seq"] == i
        sent_ids.append(data["id"])

    # Retrieve paginated messages (limit=3)
    page1 = client.get(
        f"/api/v2/channels/{ch_id}/messages?limit=3",
        headers={"Authorization": f"Bearer {tok}"},
    ).json()

    assert page1["has_more"] is True
    # Verify chronological ordering (oldest to newest in page)
    msgs = page1["messages"]
    assert len(msgs) == 3
    # The latest 3 messages in chronological sequence: 3, 4, 5
    assert msgs[0]["content"] == "Message number 3"
    assert msgs[1]["content"] == "Message number 4"
    assert msgs[2]["content"] == "Message number 5"

    # Verify message persistence directly in database
    conn = get_connection()
    db_rows = conn.execute("SELECT id, content, seq FROM messages WHERE channel_id = ? ORDER BY seq ASC", (ch_id,)).fetchall()
    conn.close()
    assert len(db_rows) == 5
    assert [r["seq"] for r in db_rows] == [1, 2, 3, 4, 5]


def test_idempotency_duplicate_client_msg_id():
    """Verifies that sending a message with duplicate client_msg_id does not create duplicate entries."""
    client = TestClient(app)

    tok = client.post(
        "/api/v2/auth/register",
        json={"username": "dave", "email": "dave@vgarss.org", "password": "Password123!"},
    ).json()["token"]

    ws_id = client.post(
        "/api/v2/workspaces",
        json={"name": "Dave Workspace"},
        headers={"Authorization": f"Bearer {tok}"},
    ).json()["id"]

    chans = client.get(f"/api/v2/workspaces/{ws_id}/channels", headers={"Authorization": f"Bearer {tok}"}).json()
    ch_id = chans[0]["id"]

    # First submission
    res1 = client.post(
        f"/api/v2/channels/{ch_id}/messages",
        json={"content": "Important payload", "client_msg_id": "stable-uuid-999"},
        headers={"Authorization": f"Bearer {tok}"},
    )
    assert res1.status_code == 201
    id1 = res1.json()["id"]

    # Duplicate submission
    res2 = client.post(
        f"/api/v2/channels/{ch_id}/messages",
        json={"content": "Important payload retry", "client_msg_id": "stable-uuid-999"},
        headers={"Authorization": f"Bearer {tok}"},
    )
    assert res2.status_code == 201
    id2 = res2.json()["id"]

    # Must be the exact same message ID
    assert id1 == id2

    # Verify only 1 record exists in DB
    conn = get_connection()
    count = conn.execute("SELECT COUNT(*) AS c FROM messages WHERE client_msg_id = 'stable-uuid-999'").fetchone()["c"]
    conn.close()
    assert count == 1


def test_task_creation_and_system_notification():
    """Verifies task creation from chat, status transitions, and automated system notifications."""
    client = TestClient(app)

    # Setup Alice and Bob
    alice_tok = client.post(
        "/api/v2/auth/register",
        json={"username": "alice_task", "email": "alice_t@vgarss.org", "password": "Password123!"},
    ).json()["token"]
    bob_tok = client.post(
        "/api/v2/auth/register",
        json={"username": "bob_task", "email": "bob_t@vgarss.org", "password": "Password123!"},
    ).json()["token"]

    ws_id = client.post(
        "/api/v2/workspaces",
        json={"name": "Task Lab Workspace"},
        headers={"Authorization": f"Bearer {alice_tok}"},
    ).json()["id"]

    # Add Bob
    client.post(
        f"/api/v2/workspaces/{ws_id}/members",
        json={"username": "bob_task", "role": "MEMBER"},
        headers={"Authorization": f"Bearer {alice_tok}"},
    )

    bob_id = client.get("/api/v2/auth/me", headers={"Authorization": f"Bearer {bob_tok}"}).json()["id"]
    chans = client.get(f"/api/v2/workspaces/{ws_id}/channels", headers={"Authorization": f"Bearer {alice_tok}"}).json()
    ch_id = chans[0]["id"]

    # Alice posts a message
    msg = client.post(
        f"/api/v2/channels/{ch_id}/messages",
        json={"content": "Memory leak detected on cluster node 3"},
        headers={"Authorization": f"Bearer {alice_tok}"},
    ).json()

    # Create task linked to message
    task_res = client.post(
        "/api/v2/tasks",
        json={
            "workspace_id": ws_id,
            "channel_id": ch_id,
            "source_message_id": msg["id"],
            "title": "Patch Memory Leak",
            "description": "Profile heap and release unreferenced PCB handles",
            "assignee_id": bob_id,
            "priority": "HIGH",
            "estimated_burst_ticks": 8,
        },
        headers={"Authorization": f"Bearer {alice_tok}"},
    )
    assert task_res.status_code == 201
    task_data = task_res.json()
    assert task_data["status"] == "NEW"
    assert task_data["priority"] == "HIGH"
    assert task_data["numeric_priority"] == 2
    task_id = task_data["id"]

    # Verify system notification message was auto-posted to channel
    chan_msgs = client.get(
        f"/api/v2/channels/{ch_id}/messages",
        headers={"Authorization": f"Bearer {alice_tok}"},
    ).json()["messages"]

    sys_msgs = [m for m in chan_msgs if m["message_type"] == "SYSTEM_EVENT"]
    assert len(sys_msgs) >= 1
    assert f"Task [{task_id}]" in sys_msgs[-1]["content"]

    # Transition task status to RUNNING
    update_res = client.patch(
        f"/api/v2/tasks/{task_id}",
        json={"status": "RUNNING"},
        headers={"Authorization": f"Bearer {alice_tok}"},
    )
    assert update_res.status_code == 200
    assert update_res.json()["status"] == "RUNNING"


def test_websocket_realtime_chat_and_catchup_sync():
    """Verifies multi-client WebSocket message distribution and reconnection catch-up."""
    client = TestClient(app)

    alice_tok = client.post(
        "/api/v2/auth/register",
        json={"username": "ws_alice", "email": "ws_alice@vgarss.org", "password": "Password123!"},
    ).json()["token"]

    bob_tok = client.post(
        "/api/v2/auth/register",
        json={"username": "ws_bob", "email": "ws_bob@vgarss.org", "password": "Password123!"},
    ).json()["token"]

    ws_id = client.post(
        "/api/v2/workspaces",
        json={"name": "Realtime Testing WS"},
        headers={"Authorization": f"Bearer {alice_tok}"},
    ).json()["id"]

    client.post(
        f"/api/v2/workspaces/{ws_id}/members",
        json={"username": "ws_bob", "role": "MEMBER"},
        headers={"Authorization": f"Bearer {alice_tok}"},
    )

    chans = client.get(f"/api/v2/workspaces/{ws_id}/channels", headers={"Authorization": f"Bearer {alice_tok}"}).json()
    ch_id = chans[0]["id"]

    # Connect Alice & Bob to WebSocket simultaneously
    with client.websocket_connect(f"/ws/v2?token={alice_tok}&workspace_id={ws_id}") as ws_alice:
        init_alice = ws_alice.receive_json()
        assert init_alice["type"] == "AUTH_SUCCESS"

        with client.websocket_connect(f"/ws/v2?token={bob_tok}&workspace_id={ws_id}") as ws_bob:
            init_bob = ws_bob.receive_json()
            assert init_bob["type"] == "AUTH_SUCCESS"

            # Alice receives Bob's online presence announcement
            presence_frame = ws_alice.receive_json()
            assert presence_frame["type"] == "PRESENCE_UPDATE"

            # Alice sends a message via REST API
            post_res = client.post(
                f"/api/v2/channels/{ch_id}/messages",
                json={"content": "Hello Real-Time World!", "client_msg_id": "rt-msg-1"},
                headers={"Authorization": f"Bearer {alice_tok}"},
            )
            assert post_res.status_code == 201

            # Both Alice and Bob should receive CHAT_MESSAGE_RECV frame
            frame_alice = ws_alice.receive_json()
            assert frame_alice["type"] == "CHAT_MESSAGE_RECV"
            assert frame_alice["payload"]["content"] == "Hello Real-Time World!"

            frame_bob = ws_bob.receive_json()
            assert frame_bob["type"] == "CHAT_MESSAGE_RECV"
            assert frame_bob["payload"]["content"] == "Hello Real-Time World!"

            # Test Ping / Pong
            ws_alice.send_json({"type": "PING"})
            pong = ws_alice.receive_json()
            assert pong["type"] == "PONG"

            # Test Typing indicator: Alice sends typing
            ws_alice.send_json({"type": "TYPING_START", "target_id": ch_id, "is_channel": True})
            # Bob should receive TYPING_EVENT
            typing_frame = ws_bob.receive_json()
            assert typing_frame["type"] == "TYPING_EVENT"
            assert typing_frame["username"] == "ws_alice"

            # Reconnection Catch-Up simulation:
            # Client asks for missed events since sequence 0
            ws_bob.send_json({"type": "CATCHUP_REQUEST", "target_id": ch_id, "since_seq": 0})
            catchup_replayed = ws_bob.receive_json()
            assert catchup_replayed["type"] == "CHAT_MESSAGE_RECV"
            assert catchup_replayed["payload"]["content"] == "Hello Real-Time World!"

            complete_frame = ws_bob.receive_json()
            assert complete_frame["type"] == "CATCHUP_COMPLETE"
            assert complete_frame["replayed_count"] >= 1
