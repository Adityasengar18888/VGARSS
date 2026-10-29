"""Multiplexed Authenticated WebSocket Endpoint for VGARSS 2.0 Real-Time Collaboration."""
import json
import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status

from backend.app.database import get_connection
from backend.app.network.chat_hub import chat_hub, ChatClientSession

logger = logging.getLogger("vgarss.network.ws_v2")
ws_v2_router = APIRouter(tags=["WebSockets V2"])


def verify_session_token(token: str) -> Optional[dict]:
    """Validates session token in DB and returns user dictionary if valid and unexpired."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT u.id, u.username, u.display_name, s.expires_at
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.token = ?
            """,
            (token,),
        )
        row = cursor.fetchone()
        if not row:
            return None
        # Check expiration
        expires_at = datetime.fromisoformat(row["expires_at"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > expires_at:
            return None
        return {
            "id": row["id"],
            "username": row["username"],
            "display_name": row["display_name"] or row["username"],
        }
    finally:
        conn.close()


@ws_v2_router.websocket("/ws/v2")
async def websocket_v2_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
    workspace_id: Optional[str] = Query(None),
):
    """Multiplexed real-time WebSocket connection for chat, presence, typing, and task telemetry."""
    user = None
    if token:
        user = verify_session_token(token)
        if not user:
            await websocket.accept()
            await websocket.send_json({
                "type": "ERROR",
                "code": "AUTH_FAILED",
                "message": "Invalid or expired session token.",
            })
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Authentication failed")
            return
        await websocket.accept()
    else:
        # Await initial AUTH frame within 5 seconds
        await websocket.accept()
        try:
            raw_init = await websocket.receive_text()
            init_msg = json.loads(raw_init)
            if init_msg.get("type") in ("AUTH", "CLIENT_AUTH") and "token" in init_msg:
                token = init_msg["token"]
                workspace_id = init_msg.get("workspace_id", workspace_id)
                user = verify_session_token(token)

            if not user:
                await websocket.send_json({
                    "type": "ERROR",
                    "code": "AUTH_FAILED",
                    "message": "Authentication failed or token invalid.",
                })
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Auth failed")
                return
        except Exception as e:
            logger.warning(f"WebSocket handshake failed: {e}")
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Handshake error")
            return

    # Authorized: register session in Hub
    session = ChatClientSession(
        websocket=websocket,
        user_id=user["id"],
        username=user["username"],
        display_name=user["display_name"],
        workspace_id=workspace_id,
    )

    # Confirm authentication FIRST before registering broadcasts
    session.send_nowait({
        "type": "AUTH_SUCCESS",
        "user": user,
        "workspace_id": workspace_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    await chat_hub.register_session(session, workspace_id)

    try:
        while not session.is_closed:
            raw_text = await websocket.receive_text()
            try:
                data = json.loads(raw_text)
            except Exception:
                session.send_nowait({
                    "type": "ERROR",
                    "code": "MALFORMED_JSON",
                    "message": "Message is not valid JSON.",
                })
                continue

            event_type = data.get("type", "").upper()

            if event_type == "PING":
                session.send_nowait({"type": "PONG", "timestamp": datetime.now(timezone.utc).isoformat()})

            elif event_type == "PRESENCE_HEARTBEAT":
                p_state = data.get("state", "ONLINE")
                await chat_hub.broadcast_presence(session.user_id, p_state, session.workspace_id)

            elif event_type == "SUBSCRIBE_WORKSPACE":
                new_ws = data.get("workspace_id")
                if new_ws:
                    await chat_hub.subscribe_workspace(session, new_ws)
                    session.send_nowait({
                        "type": "SUBSCRIBED_WORKSPACE",
                        "workspace_id": new_ws,
                    })

            elif event_type == "TYPING_START":
                target_id = data.get("target_id")
                is_ch = data.get("is_channel", True)
                if target_id:
                    await chat_hub.handle_typing(session, target_id, is_ch)

            elif event_type == "CATCHUP_REQUEST":
                target_id = data.get("target_id")
                since_seq = data.get("since_seq", 0)
                if target_id:
                    await chat_hub.replay_missed_events(session, target_id, since_seq)

            elif event_type in ("MESSAGE_DELIVERED", "MESSAGE_DELIVERY_ACK"):
                message_id = data.get("message_id")
                if message_id:
                    await chat_hub.record_receipt(
                        session=session,
                        message_id=message_id,
                        receipt_type="DELIVERED",
                        channel_id=data.get("channel_id"),
                        conversation_id=data.get("conversation_id"),
                    )

            elif event_type in ("MESSAGE_READ", "MESSAGE_READ_ACK"):
                message_id = data.get("message_id")
                if message_id:
                    await chat_hub.record_receipt(
                        session=session,
                        message_id=message_id,
                        receipt_type="READ",
                        channel_id=data.get("channel_id"),
                        conversation_id=data.get("conversation_id"),
                    )

    except WebSocketDisconnect:
        logger.debug(f"WebSocket client {user['username']} disconnected cleanly.")
    except Exception as e:
        logger.warning(f"WebSocket error for {user['username']}: {e}")
    finally:
        await chat_hub.unregister_session(session)
