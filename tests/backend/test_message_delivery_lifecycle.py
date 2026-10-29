import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database import get_connection

@pytest.fixture(autouse=True)
def clean_test_messages():
    conn = get_connection()
    with conn:
        conn.execute("DELETE FROM message_receipts;")
        conn.execute("DELETE FROM messages WHERE content LIKE 'Mission telemetry%';")
        conn.execute("DELETE FROM channel_members WHERE user_id IN (SELECT id FROM users WHERE username IN ('test_sender_1', 'test_rcpt_1', 'test_outsider_1'));")
        conn.execute("DELETE FROM workspace_members WHERE user_id IN (SELECT id FROM users WHERE username IN ('test_sender_1', 'test_rcpt_1', 'test_outsider_1'));")
        conn.execute("DELETE FROM channels WHERE name = 'receipt-lab';")
        conn.execute("DELETE FROM workspaces WHERE name = 'Receipt Test Workspace';")
        conn.execute("DELETE FROM users WHERE username IN ('test_sender_1', 'test_rcpt_1', 'test_outsider_1');")
    conn.close()
    yield
    conn = get_connection()
    with conn:
        conn.execute("DELETE FROM message_receipts;")
        conn.execute("DELETE FROM messages WHERE content LIKE 'Mission telemetry%';")
        conn.execute("DELETE FROM channel_members WHERE user_id IN (SELECT id FROM users WHERE username IN ('test_sender_1', 'test_rcpt_1', 'test_outsider_1'));")
        conn.execute("DELETE FROM workspace_members WHERE user_id IN (SELECT id FROM users WHERE username IN ('test_sender_1', 'test_rcpt_1', 'test_outsider_1'));")
        conn.execute("DELETE FROM channels WHERE name = 'receipt-lab';")
        conn.execute("DELETE FROM workspaces WHERE name = 'Receipt Test Workspace';")
        conn.execute("DELETE FROM users WHERE username IN ('test_sender_1', 'test_rcpt_1', 'test_outsider_1');")
    conn.close()

def test_message_delivery_and_read_receipt_lifecycle():
    client = TestClient(app)

    # 1. Register sender (Alice) and recipient (Bob)
    sender_res = client.post("/api/v2/auth/register", json={
        "username": "test_sender_1",
        "email": "test_sender_1@vgarss.dev",
        "password": "Password123!"
    })
    assert sender_res.status_code == 201
    sender_token = sender_res.json()["token"]
    sender_id = sender_res.json()["user"]["id"]

    rcpt_res = client.post("/api/v2/auth/register", json={
        "username": "test_rcpt_1",
        "email": "test_rcpt_1@vgarss.dev",
        "password": "Password123!"
    })
    assert rcpt_res.status_code == 201
    rcpt_token = rcpt_res.json()["token"]
    rcpt_id = rcpt_res.json()["user"]["id"]

    # 2. Sender creates workspace and channel
    ws_res = client.post("/api/v2/workspaces", json={
        "name": "Receipt Test Workspace",
        "description": "Testing message delivery lifecycle"
    }, headers={"Authorization": f"Bearer {sender_token}"})
    assert ws_res.status_code == 201
    ws_id = ws_res.json()["id"]

    ch_res = client.post(f"/api/v2/workspaces/{ws_id}/channels", json={
        "name": "receipt-lab",
        "topic": "Delivery verification"
    }, headers={"Authorization": f"Bearer {sender_token}"})
    assert ch_res.status_code == 201
    ch_id = ch_res.json()["id"]

    # 3. Add recipient Bob to workspace and channel
    add_ws_res = client.post(f"/api/v2/workspaces/{ws_id}/members", json={
        "username": "test_rcpt_1",
        "role": "MEMBER"
    }, headers={"Authorization": f"Bearer {sender_token}"})
    assert add_ws_res.status_code == 201

    # 4. Sender sends message
    msg_res = client.post(f"/api/v2/channels/{ch_id}/messages", json={
        "content": "Mission telemetry packet 0x01",
        "client_msg_id": "cli-test-001"
    }, headers={"Authorization": f"Bearer {sender_token}"})
    assert msg_res.status_code == 201
    msg_data = msg_res.json()
    msg_id = msg_data["id"]
    assert msg_data["delivery_status"] == "SENT"

    # 5. Sender cannot acknowledge own message
    own_ack = client.post(f"/api/v2/messages/{msg_id}/receipt", json={
        "message_id": msg_id,
        "channel_id": ch_id,
        "receipt_type": "DELIVERED"
    }, headers={"Authorization": f"Bearer {sender_token}"})
    assert own_ack.status_code == 200
    assert own_ack.json()["status"] == "ignored"

    # 6. Recipient Bob acknowledges DELIVERED
    del_ack = client.post(f"/api/v2/messages/{msg_id}/receipt", json={
        "message_id": msg_id,
        "channel_id": ch_id,
        "receipt_type": "DELIVERED"
    }, headers={"Authorization": f"Bearer {rcpt_token}"})
    assert del_ack.status_code == 200
    assert del_ack.json()["status"] == "recorded"

    # Verify message delivery status updated to DELIVERED
    list_res = client.get(f"/api/v2/channels/{ch_id}/messages", headers={"Authorization": f"Bearer {sender_token}"})
    assert list_res.status_code == 200
    found_msg = next(m for m in list_res.json()["messages"] if m["id"] == msg_id)
    assert found_msg["delivery_status"] == "DELIVERED"

    # 7. Recipient Bob acknowledges READ
    read_ack = client.post(f"/api/v2/messages/{msg_id}/receipt", json={
        "message_id": msg_id,
        "channel_id": ch_id,
        "receipt_type": "READ"
    }, headers={"Authorization": f"Bearer {rcpt_token}"})
    assert read_ack.status_code == 200
    assert read_ack.json()["status"] == "recorded"

    # Verify status is now READ
    list_res2 = client.get(f"/api/v2/channels/{ch_id}/messages", headers={"Authorization": f"Bearer {sender_token}"})
    found_msg2 = next(m for m in list_res2.json()["messages"] if m["id"] == msg_id)
    assert found_msg2["delivery_status"] == "READ"

    # 8. Outsider cannot submit receipt
    outsider_res = client.post("/api/v2/auth/register", json={
        "username": "test_outsider_1",
        "email": "test_outsider_1@vgarss.dev",
        "password": "Password123!"
    })
    outsider_token = outsider_res.json()["token"]
    unauth_ack = client.post(f"/api/v2/messages/{msg_id}/receipt", json={
        "message_id": msg_id,
        "channel_id": ch_id,
        "receipt_type": "READ"
    }, headers={"Authorization": f"Bearer {outsider_token}"})
    assert unauth_ack.status_code == 403

    # 9. Nonexistent message returns 404
    missing_ack = client.post("/api/v2/messages/nonexistent-id/receipt", json={
        "message_id": "nonexistent-id",
        "channel_id": ch_id,
        "receipt_type": "DELIVERED"
    }, headers={"Authorization": f"Bearer {rcpt_token}"})
    assert missing_ack.status_code == 404

    # 10. Idempotent delivery ack does not raise error
    repeat_ack = client.post(f"/api/v2/messages/{msg_id}/receipt", json={
        "message_id": msg_id,
        "channel_id": ch_id,
        "receipt_type": "READ"
    }, headers={"Authorization": f"Bearer {rcpt_token}"})
    assert repeat_ack.status_code == 200
    assert repeat_ack.json()["status"] == "recorded"
