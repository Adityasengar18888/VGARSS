"""Real-Time Chat & Telemetry Hub for VGARSS 2.0 (Port 8000 /ws/v2).

Provides:
- Authenticated multi-user WebSocket connections
- Real-time message fanout, typing indicators, and presence tracking
- Monotonic sequence numbering per channel/conversation
- Missed message retrieval & catch-up resync on reconnection
- Automated system notifications for task & OS scheduling state changes
"""
import uuid
import time
import json
import asyncio
import logging
from collections import deque
from datetime import datetime, timezone
from typing import Dict, Set, Optional, Any, List
from fastapi import WebSocket

from backend.app.database import get_connection

logger = logging.getLogger("vgarss.network.chat_hub")


class ChatClientSession:
    """Represents an active, authenticated user connection to the real-time hub."""

    def __init__(
        self,
        websocket: WebSocket,
        user_id: str,
        username: str,
        display_name: str,
        workspace_id: Optional[str] = None,
        max_queue_size: int = 150,
    ):
        self.session_id: str = str(uuid.uuid4())
        self.websocket: WebSocket = websocket
        self.user_id: str = user_id
        self.username: str = username
        self.display_name: str = display_name
        self.workspace_id: Optional[str] = workspace_id
        self.active_channel_id: Optional[str] = None
        self.active_conversation_id: Optional[str] = None
        self.outbound_queue: asyncio.Queue = asyncio.Queue(maxsize=max_queue_size)
        self.is_closed: bool = False
        self.last_heartbeat: float = time.time()
        self.sender_task: Optional[asyncio.Task] = None

    def send_nowait(self, frame: Dict[str, Any]) -> bool:
        """Enqueues an event for asynchronous writing without blocking."""
        if self.is_closed:
            return False
        try:
            self.outbound_queue.put_nowait(frame)
            return True
        except asyncio.QueueFull:
            logger.warning(f"Dropping event: outbound buffer full for user {self.username}")
            return False

    async def sender_loop(self, timeout_sec: float = 5.0) -> None:
        """Pulls outbound events and transmits them over the WebSocket."""
        try:
            while not self.is_closed:
                frame = await self.outbound_queue.get()
                try:
                    await asyncio.wait_for(self.websocket.send_json(frame), timeout=timeout_sec)
                except (asyncio.TimeoutError, Exception) as e:
                    logger.error(f"Socket send failed for {self.username}: {type(e).__name__}: {e}", exc_info=True)
                    self.is_closed = True
                    break
        except asyncio.CancelledError:
            pass


class ChatHub:
    """Central Real-Time Collaboration & Telemetry Orchestrator."""

    def __init__(self):
        # Maps user_id -> Set[ChatClientSession] (multi-device support)
        self._user_sessions: Dict[str, Set[ChatClientSession]] = {}
        # Maps workspace_id -> Set[ChatClientSession]
        self._workspace_subscribers: Dict[str, Set[ChatClientSession]] = {}
        # In-memory presence states: user_id -> {"state": "ONLINE", "last_seen": ...}
        self._presence: Dict[str, Dict[str, Any]] = {}
        # Monotonic sequence tracker: target_id (channel/convo) -> int
        self._seq_counters: Dict[str, int] = {}
        # Circular event buffer for fast catch-up: target_id -> deque of frames
        self._event_buffers: Dict[str, deque] = {}
        # Active typing indicators: key (target_id:user_id) -> timestamp
        self._active_typing: Dict[str, float] = {}
        self._lock = asyncio.Lock()

    def get_next_seq(self, target_id: str) -> int:
        """Generates the next monotonic sequence number for a channel or conversation."""
        current = self._seq_counters.get(target_id, 0) + 1
        self._seq_counters[target_id] = current
        return current

    def buffer_event(self, target_id: str, frame: Dict[str, Any]) -> None:
        """Appends an event to the circular buffer for reconnection catch-up."""
        if target_id not in self._event_buffers:
            self._event_buffers[target_id] = deque(maxlen=200)
        self._event_buffers[target_id].append(frame)

    async def register_session(self, session: ChatClientSession, workspace_id: Optional[str] = None) -> None:
        """Registers a newly connected client session."""
        async with self._lock:
            if session.user_id not in self._user_sessions:
                self._user_sessions[session.user_id] = set()
            self._user_sessions[session.user_id].add(session)

            if workspace_id:
                session.workspace_id = workspace_id
                if workspace_id not in self._workspace_subscribers:
                    self._workspace_subscribers[workspace_id] = set()
                self._workspace_subscribers[workspace_id].add(session)

            self._presence[session.user_id] = {
                "state": "ONLINE",
                "last_seen": datetime.now(timezone.utc).isoformat(),
            }

        # Start sender task
        loop = asyncio.get_running_loop()
        session.sender_task = loop.create_task(session.sender_loop())

        # Broadcast online presence update to workspace peers
        await self.broadcast_presence(session.user_id, "ONLINE", session.workspace_id)

    async def unregister_session(self, session: ChatClientSession) -> None:
        """Cleans up a disconnected client session."""
        session.is_closed = True
        if session.sender_task:
            session.sender_task.cancel()

        user_id = session.user_id
        workspace_id = session.workspace_id

        async with self._lock:
            if user_id in self._user_sessions:
                self._user_sessions[user_id].discard(session)
                if not self._user_sessions[user_id]:
                    del self._user_sessions[user_id]
                    self._presence[user_id] = {
                        "state": "OFFLINE",
                        "last_seen": datetime.now(timezone.utc).isoformat(),
                    }

            if workspace_id and workspace_id in self._workspace_subscribers:
                self._workspace_subscribers[workspace_id].discard(session)
                if not self._workspace_subscribers[workspace_id]:
                    del self._workspace_subscribers[workspace_id]

        # If user has no active sessions left, broadcast OFFLINE
        if user_id not in self._user_sessions:
            await self.broadcast_presence(user_id, "OFFLINE", workspace_id)

    async def subscribe_workspace(self, session: ChatClientSession, workspace_id: str) -> None:
        """Subscribes an active session to a workspace's event stream."""
        async with self._lock:
            # Remove from old workspace if different
            if session.workspace_id and session.workspace_id in self._workspace_subscribers:
                self._workspace_subscribers[session.workspace_id].discard(session)

            session.workspace_id = workspace_id
            if workspace_id not in self._workspace_subscribers:
                self._workspace_subscribers[workspace_id] = set()
            self._workspace_subscribers[workspace_id].add(session)

    async def broadcast_presence(self, user_id: str, state: str, workspace_id: Optional[str] = None) -> None:
        """Emits real-time presence change to members of the workspace (excluding the user themselves)."""
        frame = {
            "type": "PRESENCE_UPDATE",
            "user_id": user_id,
            "presence_state": state,
            "last_seen_at": datetime.now(timezone.utc).isoformat(),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        async with self._lock:
            targets = [
                s for s in self._workspace_subscribers.get(workspace_id, [])
                if s.user_id != user_id
            ] if workspace_id else [
                s for sessions in self._user_sessions.values() for s in sessions
                if s.user_id != user_id
            ]

        for s in targets:
            s.send_nowait(frame)

    async def handle_typing(self, session: ChatClientSession, target_id: str, is_channel: bool = True) -> None:
        """Emits typing indicator to peers in the channel or direct conversation."""
        now = time.time()
        key = f"{target_id}:{session.user_id}"
        last_typed = self._active_typing.get(key, 0)

        # Debounce: broadcast at most once every 1.5 seconds per user
        if now - last_typed < 1.5:
            return
        self._active_typing[key] = now

        frame = {
            "type": "TYPING_EVENT",
            "target_id": target_id,
            "is_channel": is_channel,
            "user_id": session.user_id,
            "username": session.username,
            "display_name": session.display_name,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        async with self._lock:
            peers = [
                s for s in self._workspace_subscribers.get(session.workspace_id, [])
                if s.user_id != session.user_id
            ]

        for p in peers:
            p.send_nowait(frame)

    async def broadcast_to_user(self, user_id: str, frame: Dict[str, Any]) -> None:
        """Sends an event directly to all active sessions of a specific user across all devices/workspaces."""
        async with self._lock:
            sessions = list(self._user_sessions.get(user_id, set()))
        for s in sessions:
            s.send_nowait(frame)

    async def broadcast_message(
        self,
        workspace_id: str,
        message_dict: Dict[str, Any],
        channel_id: Optional[str] = None,
        conversation_id: Optional[str] = None,
    ) -> None:
        """Broadcasts a persisted message to all relevant online participants."""
        target_id = channel_id or conversation_id or workspace_id
        if "seq" in message_dict and message_dict["seq"] is not None and message_dict["seq"] > 0:
            seq = message_dict["seq"]
        else:
            seq = self.get_next_seq(target_id)
            message_dict["seq"] = seq

        frame = {
            "type": "CHAT_MESSAGE_RECV",
            "workspace_id": workspace_id,
            "channel_id": channel_id,
            "conversation_id": conversation_id,
            "seq": seq,
            "payload": message_dict,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        self.buffer_event(target_id, frame)

        target_sessions: Set[ChatClientSession] = set()

        async with self._lock:
            # 1. Include all current subscribers of the workspace
            target_sessions.update(self._workspace_subscribers.get(workspace_id, set()))

            # 2. For Direct Messages: deliver directly to ALL active sessions of all participants
            # regardless of which workspace they are currently focused on
            if conversation_id:
                try:
                    conn = get_connection()
                    cursor = conn.cursor()
                    cursor.execute(
                        "SELECT user_id FROM direct_conversation_participants WHERE conversation_id = ?",
                        (conversation_id,),
                    )
                    for r in cursor.fetchall():
                        uid = r["user_id"]
                        target_sessions.update(self._user_sessions.get(uid, set()))
                    conn.close()
                except Exception as e:
                    logger.warning(f"Could not resolve DM participants for fanout: {e}")

            # 3. For Channel Messages: also deliver to any online member of the workspace
            # even if they currently have another workspace active in their tab
            elif channel_id:
                try:
                    conn = get_connection()
                    cursor = conn.cursor()
                    cursor.execute(
                        "SELECT user_id FROM workspace_members WHERE workspace_id = ?",
                        (workspace_id,),
                    )
                    for r in cursor.fetchall():
                        uid = r["user_id"]
                        target_sessions.update(self._user_sessions.get(uid, set()))
                    conn.close()
                except Exception as e:
                    logger.warning(f"Could not resolve workspace members for channel fanout: {e}")

        for s in target_sessions:
            s.send_nowait(frame)

    async def broadcast_task_event(self, workspace_id: str, event_type: str, task_dict: Dict[str, Any]) -> None:
        """Broadcasts task creation or state transition updates to the workspace."""
        frame = {
            "type": event_type,
            "workspace_id": workspace_id,
            "task_id": task_dict.get("id"),
            "payload": task_dict,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        async with self._lock:
            subscribers = list(self._workspace_subscribers.get(workspace_id, []))

        for s in subscribers:
            s.send_nowait(frame)

    async def broadcast_scheduler_event(self, workspace_id: str, event_type: str, state_dict: Dict[str, Any]) -> None:
        """Broadcasts CPU scheduling tick updates and metrics to workspace subscribers."""
        frame = {
            "type": event_type,
            "workspace_id": workspace_id,
            "state": state_dict,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        async with self._lock:
            subscribers = list(self._workspace_subscribers.get(workspace_id, []))

        for s in subscribers:
            s.send_nowait(frame)

    async def replay_missed_events(
        self,
        session: ChatClientSession,
        target_id: str,
        since_seq: int,
    ) -> int:
        """Transmits buffered events with seq > since_seq to catch up a reconnected client."""
        buffered = self._event_buffers.get(target_id, deque())
        missed = [evt for evt in buffered if evt.get("seq", 0) > since_seq]

        for evt in missed:
            session.send_nowait(evt)

        # Notify catchup completed
        session.send_nowait({
            "type": "CATCHUP_COMPLETE",
            "target_id": target_id,
            "replayed_count": len(missed),
            "latest_seq": self._seq_counters.get(target_id, since_seq),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        return len(missed)

    def get_online_users(self, workspace_id: Optional[str] = None) -> List[str]:
        """Returns list of user IDs currently connected."""
        if workspace_id:
            subscribers = self._workspace_subscribers.get(workspace_id, set())
            return list({s.user_id for s in subscribers})
        return list(self._user_sessions.keys())

    async def record_receipt(
        self,
        session: ChatClientSession,
        message_id: str,
        receipt_type: str,
        channel_id: Optional[str] = None,
        conversation_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Authoritatively records a message delivery or read acknowledgement and broadcasts it."""
        if receipt_type not in ("DELIVERED", "READ"):
            return None

        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id, workspace_id, channel_id, conversation_id, sender_id, delivery_status FROM messages WHERE id = ?",
                (message_id,),
            )
            msg_row = cursor.fetchone()
            if not msg_row:
                return None

            # Users cannot acknowledge delivery or read of their own messages
            if msg_row["sender_id"] == session.user_id:
                return None

            ws_id = msg_row["workspace_id"]
            # Authorize: recipient must be a member of the workspace
            cursor.execute(
                "SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?",
                (ws_id, session.user_id),
            )
            if not cursor.fetchone():
                return None

            receipt_id = f"rcpt-{uuid.uuid4().hex[:12]}"
            now_iso = datetime.now(timezone.utc).isoformat()

            # Record receipt idempotently
            cursor.execute(
                """
                INSERT OR IGNORE INTO message_receipts (id, message_id, user_id, receipt_type, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (receipt_id, message_id, session.user_id, receipt_type, now_iso),
            )

            # Update overall delivery_status on messages table
            if receipt_type == "READ":
                cursor.execute(
                    "UPDATE messages SET delivery_status = 'READ', updated_at = ? WHERE id = ?",
                    (now_iso, message_id),
                )
            elif receipt_type == "DELIVERED":
                cursor.execute(
                    "UPDATE messages SET delivery_status = 'DELIVERED', updated_at = ? WHERE id = ? AND delivery_status = 'SENT'",
                    (now_iso, message_id),
                )

            # Query counts
            cursor.execute(
                "SELECT COUNT(DISTINCT user_id) as cnt FROM message_receipts WHERE message_id = ? AND receipt_type = 'DELIVERED'",
                (message_id,),
            )
            del_count = cursor.fetchone()["cnt"]

            cursor.execute(
                "SELECT COUNT(DISTINCT user_id) as cnt FROM message_receipts WHERE message_id = ? AND receipt_type = 'READ'",
                (message_id,),
            )
            read_count = cursor.fetchone()["cnt"]

            if hasattr(conn, "commit"):
                conn.commit()

            frame = {
                "type": f"MESSAGE_{receipt_type}_UPDATE",
                "message_id": message_id,
                "channel_id": channel_id or msg_row["channel_id"],
                "conversation_id": conversation_id or msg_row["conversation_id"],
                "workspace_id": ws_id,
                "user_id": session.user_id,
                "username": session.username,
                "display_name": session.display_name,
                "status": "delivered" if receipt_type == "DELIVERED" else "read",
                "delivered_count": del_count,
                "read_count": read_count,
                "timestamp": now_iso,
            }

            # Broadcast update to workspace subscribers AND directly to sender & recipient
            target_receipt_sessions: Set[ChatClientSession] = set()
            async with self._lock:
                target_receipt_sessions.update(self._workspace_subscribers.get(ws_id, set()))
                if msg_row.get("sender_id"):
                    target_receipt_sessions.update(self._user_sessions.get(msg_row["sender_id"], set()))
                target_receipt_sessions.update(self._user_sessions.get(session.user_id, set()))

            for s in target_receipt_sessions:
                s.send_nowait(frame)

            return frame
        except Exception as e:
            logger.warning(f"Failed to record {receipt_type} receipt for {message_id}: {e}")
            return None
        finally:
            conn.close()


# Singleton Hub Instance
chat_hub = ChatHub()
