"""Channels & Channel Messaging REST Router (VGARSS 2.0)."""
import uuid
import json
import sqlite3
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status

from backend.app.database import get_db
from backend.app.api.deps import get_current_user
from backend.app.api.workspaces_v2 import check_workspace_membership
from backend.app.schemas.chat_v2 import (
    ChannelCreate,
    ChannelResponse,
    MessageCreate,
    MessageResponse,
    MessagePageResponse,
    MessageReceiptAck,
)
from backend.app.network.chat_hub import chat_hub

router = APIRouter(tags=["Channels V2"])


@router.get("/api/v2/workspaces/{workspace_id}/channels", response_model=List[ChannelResponse])
def list_workspace_channels(
    workspace_id: str,
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Lists all accessible channels in a workspace, including individual unread message counts."""
    check_workspace_membership(db, workspace_id, current_user["id"])

    cursor = db.execute(
        """
        SELECT c.id, c.workspace_id, c.name, c.topic, c.channel_type, c.is_private, c.created_by, c.created_at,
               COALESCE(cm.unread_count, 0) AS unread_count
        FROM channels c
        LEFT JOIN channel_members cm ON c.id = cm.channel_id AND cm.user_id = ?
        WHERE c.workspace_id = ? AND (c.is_private = 0 OR cm.user_id IS NOT NULL)
        ORDER BY 
            CASE c.channel_type WHEN 'ANNOUNCEMENT' THEN 1 WHEN 'TEXT' THEN 2 ELSE 3 END,
            c.name ASC
        """,
        (current_user["id"], workspace_id),
    )
    rows = cursor.fetchall()
    return [
        ChannelResponse(
            id=r["id"],
            workspace_id=r["workspace_id"],
            name=r["name"],
            topic=r["topic"] or "",
            channel_type=r["channel_type"],
            is_private=bool(r["is_private"]),
            created_by=r["created_by"],
            unread_count=r["unread_count"],
            created_at=str(r["created_at"]),
        )
        for r in rows
    ]


@router.post("/api/v2/workspaces/{workspace_id}/channels", response_model=ChannelResponse, status_code=status.HTTP_201_CREATED)
def create_channel(
    workspace_id: str,
    payload: ChannelCreate,
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Creates a new text or simulation channel within the workspace."""
    check_workspace_membership(db, workspace_id, current_user["id"])

    clean_name = payload.name.lower().strip().replace(" ", "-")

    # Check for name uniqueness within workspace
    cursor = db.execute("SELECT id FROM channels WHERE workspace_id = ? AND name = ?", (workspace_id, clean_name))
    if cursor.fetchone():
        raise HTTPException(status_code=400, detail=f"A channel named '#{clean_name}' already exists in this workspace.")

    channel_id = str(uuid.uuid4())
    with db:
        db.execute(
            """
            INSERT INTO channels (id, workspace_id, name, topic, channel_type, is_private, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (channel_id, workspace_id, clean_name, payload.topic or "", payload.channel_type, int(payload.is_private), current_user["id"]),
        )
        # Add creator to channel members
        db.execute("INSERT INTO channel_members (channel_id, user_id) VALUES (?, ?)", (channel_id, current_user["id"]))

    return ChannelResponse(
        id=channel_id,
        workspace_id=workspace_id,
        name=clean_name,
        topic=payload.topic or "",
        channel_type=payload.channel_type,
        is_private=payload.is_private,
        created_by=current_user["id"],
        unread_count=0,
        created_at="now",
    )


@router.get("/api/v2/channels/{channel_id}/messages", response_model=MessagePageResponse)
def get_channel_messages(
    channel_id: str,
    limit: int = Query(50, ge=1, le=100),
    before_id: Optional[str] = Query(None),
    after_id: Optional[str] = Query(None),
    since_seq: Optional[int] = Query(None),
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Fetches paginated message history for a channel, ordered chronologically ascending."""
    # Find channel & verify workspace membership
    cursor = db.execute("SELECT workspace_id, is_private FROM channels WHERE id = ?", (channel_id,))
    ch = cursor.fetchone()
    if not ch:
        raise HTTPException(status_code=404, detail="Channel not found.")

    check_workspace_membership(db, ch["workspace_id"], current_user["id"])

    # Query with filters
    base_sql = """
        SELECT m.id, m.workspace_id, m.channel_id, m.conversation_id, m.sender_id,
               u.username AS sender_username, u.display_name AS sender_display_name, u.avatar_url AS sender_avatar,
               m.message_type, m.content, m.parent_id, m.reply_count, m.is_edited, m.is_pinned,
               m.payload_json, m.client_msg_id, m.seq, m.created_at, m.delivery_status
        FROM messages m
        LEFT JOIN users u ON m.sender_id = u.id
        WHERE m.channel_id = ?
    """
    params = [channel_id]

    if since_seq is not None:
        base_sql += " AND m.seq > ?"
        params.append(since_seq)

    if before_id:
        cursor_row = db.execute("SELECT created_at FROM messages WHERE id = ?", (before_id,)).fetchone()
        if cursor_row:
            base_sql += " AND m.created_at < ?"
            params.append(cursor_row["created_at"])

    if after_id:
        cursor_row = db.execute("SELECT created_at FROM messages WHERE id = ?", (after_id,)).fetchone()
        if cursor_row:
            base_sql += " AND m.created_at > ?"
            params.append(cursor_row["created_at"])

    base_sql += " ORDER BY m.created_at DESC LIMIT ?"
    params.append(limit + 1)

    rows = db.execute(base_sql, tuple(params)).fetchall()
    has_more = len(rows) > limit
    result_rows = rows[:limit]
    # Reverse to return chronologically ascending (oldest -> newest for rendering)
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
                channel_id=r["channel_id"],
                conversation_id=r["conversation_id"],
                sender_id=r["sender_id"],
                sender_username=r["sender_username"],
                sender_display_name=r["sender_display_name"] or r["sender_username"] or "System",
                sender_avatar=r["sender_avatar"],
                message_type=r["message_type"],
                content=r["content"],
                parent_id=r["parent_id"],
                reply_count=r["reply_count"],
                is_edited=bool(r["is_edited"]),
                is_pinned=bool(r["is_pinned"]),
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


@router.post("/api/v2/channels/{channel_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def post_channel_message(
    channel_id: str,
    payload: MessageCreate,
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Posts a message to a channel. Persists message in database before broadcasting via WebSocket."""
    cursor = db.execute("SELECT workspace_id FROM channels WHERE id = ?", (channel_id,))
    ch = cursor.fetchone()
    if not ch:
        raise HTTPException(status_code=404, detail="Channel not found.")

    workspace_id = ch["workspace_id"]
    check_workspace_membership(db, workspace_id, current_user["id"])

    # Idempotency check: if client_msg_id already submitted, return existing record
    if payload.client_msg_id:
        cursor = db.execute(
            """
            SELECT m.id, m.workspace_id, m.channel_id, m.sender_id, u.username AS sender_username,
                   u.display_name AS sender_display_name, m.message_type, m.content, m.seq, m.created_at, m.delivery_status
            FROM messages m
            LEFT JOIN users u ON m.sender_id = u.id
            WHERE m.client_msg_id = ?
            """,
            (payload.client_msg_id,),
        )
        existing = cursor.fetchone()
        if existing:
            return MessageResponse(
                id=existing["id"],
                workspace_id=existing["workspace_id"],
                channel_id=existing["channel_id"],
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
    seq = chat_hub.get_next_seq(channel_id)

    # 1. PERSIST FIRST
    with db:
        db.execute(
            """
            INSERT INTO messages (id, workspace_id, channel_id, sender_id, message_type, content, parent_id, payload_json, client_msg_id, seq)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (msg_id, workspace_id, channel_id, current_user["id"], payload.message_type, payload.content, payload.parent_id, payload_str, payload.client_msg_id, seq),
        )
        # Update unread count for other channel members
        db.execute(
            "UPDATE channel_members SET unread_count = unread_count + 1 WHERE channel_id = ? AND user_id != ?",
            (channel_id, current_user["id"]),
        )

    sender_display = current_user.get("display_name") or current_user["username"]
    resp_obj = MessageResponse(
        id=msg_id,
        workspace_id=workspace_id,
        channel_id=channel_id,
        sender_id=current_user["id"],
        sender_username=current_user["username"],
        sender_display_name=sender_display,
        message_type=payload.message_type,
        content=payload.content,
        parent_id=payload.parent_id,
        reply_count=0,
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
        channel_id=channel_id,
    )

    return resp_obj


@router.post("/api/v2/channels/{channel_id}/read")
def mark_channel_read(
    channel_id: str,
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Resets the user's unread counter for this channel."""
    with db:
        db.execute(
            "UPDATE channel_members SET unread_count = 0 WHERE channel_id = ? AND user_id = ?",
            (channel_id, current_user["id"]),
        )
    return {"status": "ok", "channel_id": channel_id}


@router.post("/api/v2/messages/{message_id}/receipt")
async def record_message_receipt_endpoint(
    message_id: str,
    payload: MessageReceiptAck,
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Authoritatively records delivery or read status for a message and broadcasts receipt telemetry."""
    cursor = db.execute("SELECT id, workspace_id, channel_id, conversation_id, sender_id FROM messages WHERE id = ?", (message_id,))
    msg = cursor.fetchone()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found.")

    check_workspace_membership(db, msg["workspace_id"], current_user["id"])

    # Cannot ack own message
    if msg["sender_id"] == current_user["id"]:
        return {"status": "ignored", "reason": "Sender cannot acknowledge own message"}

    receipt_type = payload.receipt_type.upper()
    now_iso = datetime.now(timezone.utc).isoformat()
    rcpt_id = f"rcpt-{uuid.uuid4().hex[:12]}"

    with db:
        db.execute(
            """
            INSERT OR IGNORE INTO message_receipts (id, message_id, user_id, receipt_type, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (rcpt_id, message_id, current_user["id"], receipt_type, now_iso),
        )
        if receipt_type == "READ":
            db.execute("UPDATE messages SET delivery_status = 'READ', updated_at = ? WHERE id = ?", (now_iso, message_id))
        elif receipt_type == "DELIVERED":
            db.execute("UPDATE messages SET delivery_status = 'DELIVERED', updated_at = ? WHERE id = ? AND delivery_status != 'READ'", (now_iso, message_id))

    frame = {
        "type": f"MESSAGE_{receipt_type}_UPDATE",
        "message_id": message_id,
        "channel_id": msg["channel_id"],
        "conversation_id": msg["conversation_id"],
        "workspace_id": msg["workspace_id"],
        "user_id": current_user["id"],
        "username": current_user["username"],
        "display_name": current_user.get("display_name") or current_user["username"],
        "status": "delivered" if receipt_type == "DELIVERED" else "read",
        "timestamp": now_iso,
    }
    async with chat_hub._lock:
        subscribers = list(chat_hub._workspace_subscribers.get(msg["workspace_id"], []))
    for s in subscribers:
        s.send_nowait(frame)

    return {"status": "recorded", "message_id": message_id, "receipt_type": receipt_type}

