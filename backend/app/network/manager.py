"""VGARSS WebSocket Connection Manager & Real-Time Event Hub.

Handles:
- Group-specific WebSocket connections and RBAC authorization verification
- Monotonically increasing event sequence numbers per Virtual Group
- Event history buffering and state resynchronization (batch replay & full snapshot)
- Bounded outbound queues and proactive slow-client detection & eviction
- Thread-safe and async-safe broadcast scheduling across OS simulation steps
"""
import uuid
import time
import asyncio
import logging
import sqlite3
from collections import deque
from datetime import datetime, timezone
from typing import Dict, Set, Optional, Any, List
from fastapi import WebSocket, status

from backend.app.config import settings
from backend.app.network.events import EventType, NetworkEvent
from backend.app.database import get_connection

logger = logging.getLogger("vgarss.network.manager")


class ClientConnection:
    """Represents an active, authenticated WebSocket client session."""

    def __init__(
        self,
        websocket: WebSocket,
        user_id: str,
        username: str,
        group_id: str,
        max_queue_size: int = 100,
        manager: Optional["ConnectionManager"] = None,
    ):
        self.client_id: str = str(uuid.uuid4())
        self.websocket: WebSocket = websocket
        self.user_id: str = user_id
        self.username: str = username
        self.group_id: str = group_id
        self.manager: Optional["ConnectionManager"] = manager
        self.outbound_queue: asyncio.Queue[Dict[str, Any]] = asyncio.Queue(maxsize=max_queue_size)
        self.sender_task: Optional[asyncio.Task] = None
        self.last_heartbeat: float = time.time()
        self.is_closed: bool = False

    def send_event_nowait(self, event_dict: Dict[str, Any]) -> bool:
        """Enqueues an event for asynchronous writing.
        
        If the outbound queue is full, the client is diagnosed as a Slow Client
        and evicted to prevent buffer bloat and head-of-line blocking.
        """
        if self.is_closed:
            return False

        try:
            self.outbound_queue.put_nowait(event_dict)
            return True
        except asyncio.QueueFull:
            logger.warning(
                f"[SlowClient] Outbound queue full ({self.outbound_queue.maxsize}) for user={self.username} "
                f"group={self.group_id} client_id={self.client_id}. Dropping connection."
            )
            # Mark closed and schedule eviction safely
            self.is_closed = True
            if self.manager:
                try:
                    loop = asyncio.get_running_loop()
                    loop.create_task(
                        self.manager.evict_slow_client(self, reason="Slow client dropped: queue buffer overflow")
                    )
                except RuntimeError:
                    if self.manager._main_loop and self.manager._main_loop.is_running():
                        self.manager._main_loop.call_soon_threadsafe(
                            lambda: asyncio.create_task(
                                self.manager.evict_slow_client(self, reason="Slow client dropped: queue buffer overflow")
                            )
                        )
            return False

    async def _sender_loop(self, write_timeout: float = 5.0) -> None:
        """Pulls outbound events and writes them to the underlying WebSocket stream."""
        try:
            while not self.is_closed:
                event = await self.outbound_queue.get()
                try:
                    await asyncio.wait_for(
                        self.websocket.send_json(event),
                        timeout=write_timeout,
                    )
                except asyncio.TimeoutError:
                    logger.warning(
                        f"[SlowClient] WebSocket send timed out ({write_timeout}s) for client {self.client_id}. "
                        "Terminating connection."
                    )
                    self.is_closed = True
                    if self.manager:
                        await self.manager.evict_slow_client(
                            self, reason="Slow client dropped: socket write timeout"
                        )
                    break
                except Exception as e:
                    logger.debug(f"Error sending frame to client {self.client_id}: {e}")
                    break
                finally:
                    self.outbound_queue.task_done()
        except asyncio.CancelledError:
            pass
        finally:
            self.is_closed = True

    async def close(self, code: int = status.WS_1000_NORMAL_CLOSURE, reason: str = "") -> None:
        """Cleanly terminates the sender task and closes the WebSocket."""
        if self.is_closed and (self.sender_task is None or self.sender_task.done()):
            return
        self.is_closed = True

        if self.sender_task and not self.sender_task.done():
            self.sender_task.cancel()
            try:
                await self.sender_task
            except (asyncio.CancelledError, Exception):
                pass

        try:
            await self.websocket.close(code=code, reason=reason)
        except Exception:
            pass


class ConnectionManager:
    """Central Connection Manager for Group-Specific WebSockets."""

    def __init__(self):
        # group_id -> set of active ClientConnection
        self._groups: Dict[str, Set[ClientConnection]] = {}
        # group_id -> current monotonic sequence number (starts at 0, first event is 1)
        self._group_seq: Dict[str, int] = {}
        # group_id -> deque of recent NetworkEvents for state resync
        self._group_history: Dict[str, deque[NetworkEvent]] = {}
        # Global listeners without group filter (e.g. general dashboard /ws)
        self._global_listeners: Set[ClientConnection] = set()
        # Pointer to the main asyncio event loop
        self._main_loop: Optional[asyncio.AbstractEventLoop] = None

    def set_event_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._main_loop = loop

    def verify_authorization(
        self,
        group_id: str,
        token: str,
        db_conn: Optional[sqlite3.Connection] = None,
    ) -> Optional[Dict[str, Any]]:
        """Verifies session token and group membership.
        
        Returns user info dictionary if authorized, None if invalid or forbidden.
        """
        close_db = False
        if db_conn is None:
            db_conn = get_connection()
            close_db = True

        try:
            # 1. Verify Session Token
            cursor = db_conn.execute(
                """
                SELECT u.id, u.username, u.email, s.expires_at
                FROM sessions s
                JOIN users u ON s.user_id = u.id
                WHERE s.token = ?
                """,
                (token,),
            )
            row = cursor.fetchone()
            if not row:
                return None

            # Validate expiration
            expires_str = row["expires_at"]
            try:
                expires_at = datetime.fromisoformat(expires_str)
                if expires_at.tzinfo is None:
                    expires_at = expires_at.replace(tzinfo=timezone.utc)
            except Exception:
                expires_at = datetime.strptime(
                    expires_str.split(".")[0], "%Y-%m-%d %H:%M:%S"
                ).replace(tzinfo=timezone.utc)

            if datetime.now(timezone.utc) > expires_at:
                return None

            user_id = row["id"]
            username = row["username"]

            # 2. Verify Virtual Group Exists & Access Boundary
            grp_cursor = db_conn.execute(
                "SELECT id, owner_id FROM virtual_groups WHERE id = ?",
                (group_id,),
            )
            grp_row = grp_cursor.fetchone()
            if not grp_row:
                return None

            # Owner has full access
            if grp_row["owner_id"] == user_id:
                return {
                    "id": user_id,
                    "username": username,
                    "role": "OWNER",
                    "group_id": group_id,
                }

            # Check group memberships table
            mem_cursor = db_conn.execute(
                "SELECT role FROM group_memberships WHERE group_id = ? AND user_id = ?",
                (group_id, user_id),
            )
            mem_row = mem_cursor.fetchone()
            if mem_row:
                return {
                    "id": user_id,
                    "username": username,
                    "role": mem_row["role"],
                    "group_id": group_id,
                }

            return None
        finally:
            if close_db:
                db_conn.close()

    async def connect_client(
        self,
        websocket: WebSocket,
        group_id: str,
        user: Dict[str, Any],
        max_queue_size: int = settings.ws_max_queue_size,
    ) -> ClientConnection:
        """Registers a new authorized client connection for the given virtual group."""
        self._main_loop = asyncio.get_running_loop()
        client = ClientConnection(
            websocket=websocket,
            user_id=user["id"],
            username=user["username"],
            group_id=group_id,
            max_queue_size=max_queue_size,
            manager=self,
        )

        # Start sender task
        client.sender_task = asyncio.create_task(
            client._sender_loop(write_timeout=settings.ws_write_timeout)
        )

        if group_id not in self._groups:
            self._groups[group_id] = set()
            if group_id not in self._group_seq:
                self._group_seq[group_id] = 0
            if group_id not in self._group_history:
                self._group_history[group_id] = deque(maxlen=settings.ws_history_size)

        self._groups[group_id].add(client)
        logger.info(
            f"Client connected: user={client.username} group={group_id} client_id={client.client_id} "
            f"(active_group_clients={len(self._groups[group_id])})"
        )
        return client

    async def connect_global_listener(
        self,
        websocket: WebSocket,
        max_queue_size: int = settings.ws_max_queue_size,
    ) -> ClientConnection:
        """Registers an unauthenticated or global telemetry client (e.g. for fallback UI)."""
        self._main_loop = asyncio.get_running_loop()
        client = ClientConnection(
            websocket=websocket,
            user_id="anonymous",
            username="anonymous",
            group_id="__global__",
            max_queue_size=max_queue_size,
            manager=self,
        )
        client.sender_task = asyncio.create_task(
            client._sender_loop(write_timeout=settings.ws_write_timeout)
        )
        self._global_listeners.add(client)
        return client

    async def disconnect(self, client: ClientConnection) -> None:
        """Cleans up client connection and frees resources."""
        await client.close()

        if client.group_id in self._groups:
            self._groups[client.group_id].discard(client)
            if len(self._groups[client.group_id]) == 0:
                del self._groups[client.group_id]

        self._global_listeners.discard(client)
        logger.info(
            f"Client disconnected: user={client.username} group={client.group_id} client_id={client.client_id}"
        )

    async def evict_slow_client(self, client: ClientConnection, reason: str) -> None:
        """Evicts a slow or unresponsive client with status 1008 Policy Violation."""
        try:
            await client.close(code=status.WS_1008_POLICY_VIOLATION, reason=reason)
        except Exception:
            pass
        finally:
            if client.group_id in self._groups:
                self._groups[client.group_id].discard(client)
            self._global_listeners.discard(client)

    def get_current_seq(self, group_id: str) -> int:
        return self._group_seq.get(group_id, 0)

    def broadcast_to_group(
        self,
        group_id: str,
        event_type: str,
        payload: Dict[str, Any],
        simulation_id: Optional[str] = None,
    ) -> NetworkEvent:
        """Increments sequence number, stores in history, and broadcasts to group subscribers."""
        if group_id not in self._group_seq:
            self._group_seq[group_id] = 0
        if group_id not in self._group_history:
            self._group_history[group_id] = deque(maxlen=settings.ws_history_size)

        self._group_seq[group_id] += 1
        seq = self._group_seq[group_id]

        event = NetworkEvent(
            seq=seq,
            type=event_type,
            group_id=group_id,
            simulation_id=simulation_id,
            timestamp=datetime.now(timezone.utc).isoformat(),
            payload=payload,
        )

        # Store in bounded history ring buffer for resynchronization
        self._group_history[group_id].append(event)
        event_dict = event.to_dict()

        # Send to all group clients and global listeners
        group_clients = list(self._groups.get(group_id, set()))
        global_clients = list(self._global_listeners)
        all_targets = group_clients + global_clients

        if all_targets:
            try:
                loop = asyncio.get_running_loop()
                in_loop = (loop is self._main_loop)
            except RuntimeError:
                in_loop = False

            for client in all_targets:
                if in_loop:
                    client.send_event_nowait(event_dict)
                elif self._main_loop and self._main_loop.is_running():
                    self._main_loop.call_soon_threadsafe(client.send_event_nowait, event_dict)
                else:
                    client.send_event_nowait(event_dict)

        return event

    def broadcast(
        self,
        group_id: str,
        event_type: str,
        payload: Dict[str, Any],
        simulation_id: Optional[str] = None,
    ) -> NetworkEvent:
        """Thread-safe and async-safe broadcast dispatch helper.
        
        Can be invoked from synchronous REST handlers or background simulation tasks.
        """
        return self.broadcast_to_group(group_id, event_type, payload, simulation_id)

    async def resynchronize_client(
        self,
        client: ClientConnection,
        last_seq: int,
        db_conn: Optional[sqlite3.Connection] = None,
    ) -> None:
        """Performs state resynchronization for reconnecting clients.
        
        Replays missed events if available within the history buffer,
        or sends a full group state snapshot if the gap is too large.
        """
        group_id = client.group_id
        current_seq = self.get_current_seq(group_id)
        history = list(self._group_history.get(group_id, deque()))

        # If last_seq > 0 and client is already up-to-date
        if last_seq > 0 and last_seq >= current_seq:
            client.send_event_nowait({
                "type": EventType.RESYNC_BATCH.value,
                "group_id": group_id,
                "from_seq": current_seq,
                "to_seq": current_seq,
                "missed_count": 0,
                "events": [],
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
            return

        # If last_seq > 0: Check if missed events are present in history
        if last_seq > 0 and history:
            oldest_seq = history[0].seq
            if last_seq + 1 >= oldest_seq:
                missed_events = [e.to_dict() for e in history if e.seq > last_seq]
                client.send_event_nowait({
                    "type": EventType.RESYNC_BATCH.value,
                    "group_id": group_id,
                    "from_seq": last_seq + 1,
                    "to_seq": current_seq,
                    "missed_count": len(missed_events),
                    "events": missed_events,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })
                return

        # Explicit full snapshot (last_seq <= 0) or gap detected -> Full state resynchronization
        close_db = False
        if db_conn is None:
            db_conn = get_connection()
            close_db = True

        try:
            cursor = db_conn.execute(
                """
                SELECT id, name, algorithm, status, current_tick, cpu_utilization,
                       avg_waiting_time, avg_turnaround_time, throughput
                FROM simulations
                WHERE group_id = ?
                ORDER BY created_at DESC
                LIMIT 5
                """,
                (group_id,),
            )
            sim_rows = [dict(r) for r in cursor.fetchall()]

            client.send_event_nowait({
                "type": EventType.RESYNC_FULL.value,
                "group_id": group_id,
                "current_seq": current_seq,
                "simulations": sim_rows,
                "message": "Full state snapshot provided after reconnection gap.",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
        finally:
            if close_db:
                db_conn.close()

    def get_group_client_count(self, group_id: str) -> int:
        return len(self._groups.get(group_id, set()))

    def get_total_client_count(self) -> int:
        total = sum(len(clients) for clients in self._groups.values())
        return total + len(self._global_listeners)


# Global singleton instance
connection_manager = ConnectionManager()
