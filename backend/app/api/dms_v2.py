"""Direct Messaging (1:1 & Group DMs) REST Router (VGARSS 2.0)."""
import uuid
import json
import sqlite3
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from backend.app.database import get_db
from backend.app.api.deps import get_current_user
from backend.app.api.workspaces_v2 import check_workspace_membership
from backend.app.schemas.chat_v2 import (
    DirectConversationResponse,
    UserProfileResponse,
    MessageCreate,
    MessageResponse,
    MessagePageResponse,
)
from backend.app.network.chat_hub import chat_hub

router = APIRouter(tags=["Direct Messages V2"])


class OpenDmRequest(BaseModel):
    recipient_id: str


def check_dm_participant(db: sqlite3.Connection, conversation_id: str, user_id: str) -> dict:
    """Verifies that the user is a participant in the direct conversation."""
    cursor = db.execute(
        """
        SELECT c.id, c.workspace_id, c.is_group
        FROM direct_conversations c
        JOIN direct_conversation_participants p ON c.id = p.conversation_id
        WHERE c.id = ? AND p.user_id = ?
        """,
        (conversation_id, user_id),
    )
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=403, detail="Forbidden: You are not a participant in this conversation.")
    return dict(row)


@router.get("/api/v2/workspaces/{workspace_id}/dms", response_model=List[DirectConversationResponse])
def list_direct_conversations(
    workspace_id: str,
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Lists all active direct message conversations for the user in this workspace."""
    check_workspace_membership(db, workspace_id, current_user["id"])

    # Query all DM conversations where current_user is a participant
    cursor = db.execute(
        """
        SELECT c.id AS conversation_id, c.is_group, p_self.unread_count,
               u_peer.id AS peer_id, u_peer.username AS peer_username, u_peer.display_name AS peer_display_name,
               u_peer.avatar_url AS peer_avatar, u_peer.presence_state AS peer_presence,
               u_peer.status_message AS peer_status, u_peer.email AS peer_email
        FROM direct_conversations c
        JOIN direct_conversation_participants p_self ON c.id = p_self.conversation_id AND p_self.user_id = ?
        JOIN direct_conversation_participants p_peer ON c.id = p_peer.conversation_id AND p_peer.user_id != ?
        JOIN users u_peer ON p_peer.user_id = u_peer.id
        WHERE c.workspace_id = ?
        """,
        (current_user["id"], current_user["id"], workspace_id),
    )
    rows = cursor.fetchall()
    results = []
    online_ids = set(chat_hub.get_online_users(workspace_id))

    for r in rows:
        is_online = r["peer_id"] in online_ids or r["peer_presence"] == "ONLINE"
        recipient = UserProfileResponse(
            id=r["peer_id"],
            username=r["peer_username"],
            email=r["peer_email"],
            display_name=r["peer_display_name"] or r["peer_username"],
            avatar_url=r["peer_avatar"],
            presence_state="ONLINE" if is_online else (r["peer_presence"] or "OFFLINE"),
            status_message=r["peer_status"] or "",
        )
        results.append(
            DirectConversationResponse(
                id=r["conversation_id"],
                workspace_id=workspace_id,
                is_group=bool(r["is_group"]),
                recipient=recipient,
                unread_count=r["unread_count"] or 0,
            )
        )
    return results


@router.post("/api/v2/workspaces/{workspace_id}/dms", response_model=DirectConversationResponse)
def open_or_create_dm(
    workspace_id: str,
    payload: OpenDmRequest,
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Opens an existing 1:1 DM conversation with the target recipient or creates a new one."""
    check_workspace_membership(db, workspace_id, current_user["id"])
    check_workspace_membership(db, workspace_id, payload.recipient_id)

    # Check for existing 1:1 conversation between the two users
    cursor = db.execute(
        """
        SELECT c.id
        FROM direct_conversations c
        JOIN direct_conversation_participants p1 ON c.id = p1.conversation_id AND p1.user_id = ?
        JOIN direct_conversation_participants p2 ON c.id = p2.conversation_id AND p2.user_id = ?
        WHERE c.workspace_id = ? AND c.is_group = 0
        """,
        (current_user["id"], payload.recipient_id, workspace_id),
    )
    existing = cursor.fetchone()
    convo_id = existing["id"] if existing else None

    if not convo_id:
        convo_id = str(uuid.uuid4())
        with db:
            db.execute(
                "INSERT INTO direct_conversations (id, workspace_id, is_group) VALUES (?, ?, 0)",
                (convo_id, workspace_id),
            )
            db.execute(
                "INSERT INTO direct_conversation_participants (conversation_id, user_id) VALUES (?, ?)",
                (convo_id, current_user["id"]),
            )
            db.execute(
                "INSERT INTO direct_conversation_participants (conversation_id, user_id) VALUES (?, ?)",
                (convo_id, payload.recipient_id),
            )

    # Fetch recipient profile
    u_row = db.execute(
        "SELECT id, username, email, display_name, avatar_url, presence_state, status_message FROM users WHERE id = ?",
        (payload.recipient_id,),
    ).fetchone()
    if not u_row:
        raise HTTPException(status_code=404, detail="Recipient not found.")

    is_online = payload.recipient_id in chat_hub.get_online_users(workspace_id) or u_row["presence_state"] == "ONLINE"
    recipient = UserProfileResponse(
        id=u_row["id"],
        username=u_row["username"],
        email=u_row["email"],
        display_name=u_row["display_name"] or u_row["username"],
        avatar_url=u_row["avatar_url"],
        presence_state="ONLINE" if is_online else (u_row["presence_state"] or "OFFLINE"),
        status_message=u_row["status_message"] or "",
    )

    return DirectConversationResponse(
        id=convo_id,
        workspace_id=workspace_id,
        is_group=False,
        recipient=recipient,
        unread_count=0,
    )


@router.get("/api/v2/dms/{conversation_id}/messages", response_model=MessagePageResponse)
def get_dm_messages(
    conversation_id: str,
    limit: int = Query(50, ge=1, le=100),
    before_id: Optional[str] = Query(None),
    since_seq: Optional[int] = Query(None),
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Fetches paginated messages for a direct conversation."""
    convo = check_dm_participant(db, conversation_id, current_user["id"])

    base_sql = """
        SELECT m.id, m.workspace_id, m.channel_id, m.conversation_id, m.sender_id,
               u.username AS sender_username, u.display_name AS sender_display_name, u.avatar_url AS sender_avatar,
               m.message_type, m.content, m.parent_id, m.reply_count, m.is_edited, m.is_pinned,
               m.payload_json, m.client_msg_id, m.seq, m.created_at, m.delivery_status
        FROM messages m
        LEFT JOIN users u ON m.sender_id = u.id
        WHERE m.conversation_id = ?
    """
    params = [conversation_id]

    if since_seq is not None:
        base_sql += " AND m.seq > ?"
        params.append(since_seq)

    if before_id:
        cursor_row = db.execute("SELECT created_at FROM messages WHERE id = ?", (before_id,)).fetchone()
        if cursor_row:
            base_sql += " AND m.created_at < ?"
            params.append(cursor_row["created_at"])

    base_sql += " ORDER BY m.created_at DESC LIMIT ?"
    params.append(limit + 1)

    rows = db.execute(base_sql, tuple(params)).fetchall()
    has_more = len(rows) > limit
    result_rows = rows[:limit]
    result_rows.reverse()

    messages = []
    for r in result_rows:
        payload = {}
        try:
            payload = json.loads(r["payload_json"] or "{}")
        except Exception:
            pass

        messages.append(
            MessageResponse(
                id=r["id"],
                workspace_id=r["workspace_id"],
                conversation_id=r["conversation_id"],
                sender_id=r["sender_id"],
                sender_username=r["sender_username"],
                sender_display_name=r["sender_display_name"] or r["sender_username"] or "Unknown",
                sender_avatar=r["sender_avatar"],
                message_type=r["message_type"],
                content=r["content"],
                parent_id=r["parent_id"],
                reply_count=r["reply_count"],
                payload_json=payload,
                client_msg_id=r["client_msg_id"],
                seq=r["seq"],
                created_at=str(r["created_at"]),
                delivery_status=r["delivery_status"] or "SENT",
            )
        )

    next_cursor = messages[0].id if (has_more and messages) else None
    return MessagePageResponse(
        messages=messages,
        has_more=has_more,
        next_cursor=next_cursor,
        total_count=len(messages),
    )


@router.post("/api/v2/dms/{conversation_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def post_dm_message(
    conversation_id: str,
    payload: MessageCreate,
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Sends a direct message. Persists message before broadcasting via WebSocket."""
    convo = check_dm_participant(db, conversation_id, current_user["id"])
    workspace_id = convo["workspace_id"]

    # Idempotency check
    if payload.client_msg_id:
        existing = db.execute(
            """
            SELECT m.id, m.workspace_id, m.conversation_id, m.sender_id, u.username AS sender_username,
                   u.display_name AS sender_display_name, m.message_type, m.content, m.seq, m.created_at, m.delivery_status
            FROM messages m
            LEFT JOIN users u ON m.sender_id = u.id
            WHERE m.client_msg_id = ?
            """,
            (payload.client_msg_id,),
        ).fetchone()
        if existing:
            return MessageResponse(
                id=existing["id"],
                workspace_id=existing["workspace_id"],
                conversation_id=existing["conversation_id"],
                sender_id=existing["sender_id"],
                sender_username=existing["sender_username"],
                sender_display_name=existing["sender_display_name"],
                message_type=existing["message_type"],
                content=existing["content"],
                client_msg_id=payload.client_msg_id,
                seq=existing["seq"],
                created_at=str(existing["created_at"]),
                delivery_status=existing["delivery_status"] or "SENT",
            )

    msg_id = str(uuid.uuid4())
    payload_str = json.dumps(payload.payload_json or {})
    seq = chat_hub.get_next_seq(conversation_id)

    # 1. PERSIST FIRST
    with db:
        db.execute(
            """
            INSERT INTO messages (id, workspace_id, conversation_id, sender_id, message_type, content, parent_id, payload_json, client_msg_id, seq)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (msg_id, workspace_id, conversation_id, current_user["id"], payload.message_type, payload.content, payload.parent_id, payload_str, payload.client_msg_id, seq),
        )
        db.execute(
            "UPDATE direct_conversation_participants SET unread_count = unread_count + 1 WHERE conversation_id = ? AND user_id != ?",
            (conversation_id, current_user["id"]),
        )

    sender_display = current_user.get("display_name") or current_user["username"]
    resp_obj = MessageResponse(
        id=msg_id,
        workspace_id=workspace_id,
        conversation_id=conversation_id,
        sender_id=current_user["id"],
        sender_username=current_user["username"],
        sender_display_name=sender_display,
        message_type=payload.message_type,
        content=payload.content,
        parent_id=payload.parent_id,
        payload_json=payload.payload_json or {},
        client_msg_id=payload.client_msg_id,
        seq=seq,
        created_at=datetime.now(timezone.utc).isoformat(),
        delivery_status="SENT",
    )

    # 2. BROADCAST AFTER PERSISTENCE
    await chat_hub.broadcast_message(
        workspace_id=workspace_id,
        message_dict=resp_obj.model_dump(),
        conversation_id=conversation_id,
    )

    return resp_obj


@router.post("/api/v2/dms/{conversation_id}/read")
def mark_dm_read(
    conversation_id: str,
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Resets the user's unread counter for this DM conversation."""
    with db:
        db.execute(
            "UPDATE direct_conversation_participants SET unread_count = 0 WHERE conversation_id = ? AND user_id = ?",
            (conversation_id, current_user["id"]),
        )
    return {"status": "ok", "conversation_id": conversation_id}

