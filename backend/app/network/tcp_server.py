"""Standalone Raw Python Length-Prefixed TCP Socket Server for VGARSS.

Implements Computer Networks standards:
- Length-prefixed binary framing (4-byte big-endian '!I' prefix + UTF-8 JSON)
- Non-blocking asynchronous socket I/O using asyncio.start_server
- Bounded concurrency with connection capacity limits
- Strict payload size limits (rejects frames exceeding max_frame_size)
- Idle client read timeouts
- Robust malformed frame and partial read recovery
- Bidirectional paired-client forwarding / peer-to-peer message routing
- Completely decoupled from FastAPI
"""
import uuid
import time
import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Optional, Set, Any

from backend.app.network.framing import (
    read_frame,
    write_frame,
    DEFAULT_MAX_FRAME_SIZE,
    FramingError,
    FrameTooLargeError,
    MalformedPayloadError,
    ConnectionClosedError,
)

logger = logging.getLogger("vgarss.network.tcp")


class ClientSession:
    """Encapsulates a connected TCP client socket session."""

    def __init__(
        self,
        client_id: str,
        reader: asyncio.StreamReader,
        writer: asyncio.StreamWriter,
    ):
        self.client_id: str = client_id
        self.reader: asyncio.StreamReader = reader
        self.writer: asyncio.StreamWriter = writer
        self.peer_id: Optional[str] = None
        self.room_id: Optional[str] = None
        self.connected_at: float = time.time()
        self.is_closed: bool = False
        self._write_lock: asyncio.Lock = asyncio.Lock()

    async def send(self, payload: Dict[str, Any]) -> None:
        """Asynchronously writes a length-prefixed JSON frame."""
        if self.is_closed:
            return
        async with self._write_lock:
            try:
                await write_frame(self.writer, payload)
            except Exception as e:
                self.is_closed = True
                logger.debug(f"Failed to send TCP frame to {self.client_id}: {e}")

    async def close(self) -> None:
        """Closes the client socket connection cleanly."""
        if self.is_closed:
            return
        self.is_closed = True
        try:
            self.writer.close()
            await self.writer.wait_closed()
        except Exception:
            pass


class RawTcpServer:
    """High-concurrency standalone TCP Socket Server."""

    def __init__(
        self,
        host: str = "127.0.0.1",
        port: int = 9000,
        max_connections: int = 50,
        max_frame_size: int = DEFAULT_MAX_FRAME_SIZE,
        read_timeout: float = 30.0,
    ):
        self.host: str = host
        self.port: int = port
        self.actual_port: int = port
        self.max_connections: int = max_connections
        self.max_frame_size: int = max_frame_size
        self.read_timeout: float = read_timeout

        self._server: Optional[asyncio.Server] = None
        self._clients: Dict[str, ClientSession] = {}
        self._rooms: Dict[str, Set[str]] = {}  # room_id -> set of client_ids waiting/paired
        self._lock: asyncio.Lock = asyncio.Lock()
        self._running: bool = False

    @property
    def client_count(self) -> int:
        return len(self._clients)

    async def start(self) -> None:
        """Binds and starts listening for incoming TCP client connections."""
        self._running = True
        self._server = await asyncio.start_server(
            self._handle_client,
            host=self.host,
            port=self.port,
        )
        # In case port 0 was passed for ephemeral testing
        sockets = self._server.sockets
        if sockets:
            self.actual_port = sockets[0].getsockname()[1]
        logger.info(f"RawTcpServer listening on {self.host}:{self.actual_port} (max_conn={self.max_connections})")

    async def stop(self) -> None:
        """Shuts down server and cleanly closes all active client connections."""
        self._running = False
        if self._server:
            self._server.close()
            await self._server.wait_closed()

        async with self._lock:
            sessions = list(self._clients.values())
            for session in sessions:
                await session.close()
            self._clients.clear()
            self._rooms.clear()

        logger.info("RawTcpServer stopped cleanly.")

    async def _handle_client(
        self,
        reader: asyncio.StreamReader,
        writer: asyncio.StreamWriter,
    ) -> None:
        """Main connection lifecycle coroutine for an individual TCP client."""
        # 1. Enforce Bounded Concurrency
        async with self._lock:
            if len(self._clients) >= self.max_connections:
                logger.warning(
                    f"TCP connection rejected: active connections ({len(self._clients)}) "
                    f"exceeds limit ({self.max_connections})."
                )
                try:
                    await write_frame(writer, {
                        "status": "ERROR",
                        "code": "CONCURRENCY_LIMIT_EXCEEDED",
                        "message": f"Server connection limit of {self.max_connections} reached.",
                    })
                    writer.close()
                    await writer.wait_closed()
                except Exception:
                    pass
                return

            client_id = f"client-{uuid.uuid4().hex[:8]}"
            session = ClientSession(client_id, reader, writer)
            self._clients[client_id] = session

        # 2. Send Connected Handshake
        await session.send({
            "status": "CONNECTED",
            "client_id": client_id,
            "server": "VGARSS-Raw-TCP-Server",
            "max_frame_size": self.max_frame_size,
            "read_timeout": self.read_timeout,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        # 3. Read Loop with Timeouts & Framing Validation
        try:
            while self._running and not session.is_closed:
                try:
                    payload = await asyncio.wait_for(
                        read_frame(reader, max_frame_size=self.max_frame_size),
                        timeout=self.read_timeout,
                    )
                except asyncio.TimeoutError:
                    logger.warning(f"TCP client {session.client_id} timed out after {self.read_timeout}s.")
                    await session.send({
                        "status": "ERROR",
                        "code": "TIMEOUT",
                        "message": f"Connection read timeout ({self.read_timeout}s) exceeded.",
                    })
                    break
                except ConnectionClosedError:
                    # Client disconnected cleanly
                    break
                except FrameTooLargeError as e:
                    logger.warning(f"TCP client {session.client_id} sent frame exceeding limit: {e}")
                    await session.send({
                        "status": "ERROR",
                        "code": "FRAME_TOO_LARGE",
                        "message": str(e),
                    })
                    break
                except MalformedPayloadError as e:
                    logger.warning(f"TCP client {session.client_id} sent malformed payload: {e}")
                    await session.send({
                        "status": "ERROR",
                        "code": "MALFORMED_PAYLOAD",
                        "message": str(e),
                    })
                    continue
                except FramingError as e:
                    logger.warning(f"TCP framing error from {session.client_id}: {e}")
                    await session.send({
                        "status": "ERROR",
                        "code": "FRAMING_ERROR",
                        "message": str(e),
                    })
                    break

                if not isinstance(payload, dict):
                    await session.send({
                        "status": "ERROR",
                        "code": "INVALID_COMMAND",
                        "message": "Message payload must be a JSON object.",
                    })
                    continue

                # Dispatch Action
                await self._dispatch_action(session, payload)

        except Exception as e:
            logger.debug(f"TCP client {session.client_id} connection exception: {e}")
        finally:
            await self._cleanup_client(session)

    async def _dispatch_action(self, session: ClientSession, payload: Dict[str, Any]) -> None:
        """Dispatches validated JSON commands received from TCP clients."""
        action = payload.get("action", "").upper()

        # Health Check
        if action == "PING":
            await session.send({
                "status": "OK",
                "action": "PONG",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })

        # Echo Test
        elif action == "ECHO":
            await session.send({
                "status": "OK",
                "action": "ECHO",
                "data": payload.get("data"),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })

        # Client Self-Identification
        elif action == "IDENTIFY":
            new_id = str(payload.get("client_id", "")).strip()
            if not new_id:
                await session.send({
                    "status": "ERROR",
                    "code": "INVALID_CLIENT_ID",
                    "message": "client_id cannot be empty.",
                })
                return

            async with self._lock:
                if new_id in self._clients and self._clients[new_id] is not session:
                    await session.send({
                        "status": "ERROR",
                        "code": "ID_IN_USE",
                        "message": f"Client ID '{new_id}' is already registered.",
                    })
                    return

                old_id = session.client_id
                del self._clients[old_id]
                session.client_id = new_id
                self._clients[new_id] = session

            await session.send({
                "status": "OK",
                "action": "IDENTIFY",
                "client_id": new_id,
                "message": f"Client ID updated from '{old_id}' to '{new_id}'.",
            })

        # Query Connection Status
        elif action == "STATUS":
            await session.send({
                "status": "OK",
                "action": "STATUS",
                "client_id": session.client_id,
                "total_connected": len(self._clients),
                "peer_id": session.peer_id,
                "room_id": session.room_id,
            })

        # Paired-Client Direct Pairing
        elif action == "PAIR":
            target_id = str(payload.get("target_id", "")).strip()
            if not target_id:
                await session.send({
                    "status": "ERROR",
                    "code": "MISSING_TARGET_ID",
                    "message": "Action PAIR requires 'target_id'.",
                })
                return

            if target_id == session.client_id:
                await session.send({
                    "status": "ERROR",
                    "code": "CANNOT_PAIR_SELF",
                    "message": "A client cannot pair with itself.",
                })
                return

            async with self._lock:
                target_session = self._clients.get(target_id)
                if not target_session or target_session.is_closed:
                    await session.send({
                        "status": "ERROR",
                        "code": "TARGET_NOT_FOUND",
                        "message": f"Target client '{target_id}' is not connected.",
                    })
                    return

                # Establish bidirectional pair
                session.peer_id = target_id
                target_session.peer_id = session.client_id

            await session.send({
                "status": "OK",
                "action": "PAIR",
                "peer_id": target_id,
                "message": f"Successfully paired with '{target_id}'.",
            })
            await target_session.send({
                "status": "PEER_PAIRED",
                "peer_id": session.client_id,
                "message": f"Paired with client '{session.client_id}'.",
            })

        # Paired-Client Channel / Room Pairing
        elif action == "JOIN_PAIR":
            room_id = str(payload.get("room_id", "default")).strip()
            session.room_id = room_id

            partner: Optional[ClientSession] = None
            async with self._lock:
                if room_id not in self._rooms:
                    self._rooms[room_id] = set()

                room_members = self._rooms[room_id]
                # Look for an available unpaused member
                available = [cid for cid in room_members if cid != session.client_id and cid in self._clients]
                if available:
                    partner_id = available[0]
                    partner = self._clients[partner_id]
                    room_members.remove(partner_id)
                    session.peer_id = partner_id
                    partner.peer_id = session.client_id
                else:
                    room_members.add(session.client_id)

            if partner:
                await session.send({
                    "status": "OK",
                    "action": "JOIN_PAIR",
                    "peer_id": partner.client_id,
                    "room_id": room_id,
                    "message": f"Paired with '{partner.client_id}' in room '{room_id}'.",
                })
                await partner.send({
                    "status": "PEER_PAIRED",
                    "peer_id": session.client_id,
                    "room_id": room_id,
                    "message": f"Paired with '{session.client_id}' in room '{room_id}'.",
                })
            else:
                await session.send({
                    "status": "WAITING_FOR_PEER",
                    "room_id": room_id,
                    "message": f"Waiting for a peer to join room '{room_id}'.",
                })

        # Unpair Action
        elif action == "UNPAIR":
            async with self._lock:
                old_peer = session.peer_id
                session.peer_id = None
                peer_session = self._clients.get(old_peer) if old_peer else None
                if peer_session:
                    peer_session.peer_id = None

            if peer_session:
                await peer_session.send({
                    "status": "PEER_UNPAIRED",
                    "peer_id": session.client_id,
                    "message": f"Peer '{session.client_id}' has unpaired.",
                })

            await session.send({
                "status": "OK",
                "action": "UNPAIR",
                "message": "Unpaired successfully.",
            })

        # Paired-Client Forwarding
        elif action == "FORWARD":
            forward_data = payload.get("payload")
            if forward_data is None:
                await session.send({
                    "status": "ERROR",
                    "code": "MISSING_PAYLOAD",
                    "message": "Action FORWARD requires a 'payload' field.",
                })
                return

            target_id = payload.get("target_id") or session.peer_id
            if not target_id:
                await session.send({
                    "status": "ERROR",
                    "code": "NOT_PAIRED",
                    "message": "Client is not paired and no 'target_id' was provided.",
                })
                return

            async with self._lock:
                target_session = self._clients.get(target_id)
                if not target_session or target_session.is_closed:
                    await session.send({
                        "status": "ERROR",
                        "code": "TARGET_NOT_FOUND",
                        "message": f"Target client '{target_id}' is not connected.",
                    })
                    return

            # Forward frame to peer
            await target_session.send({
                "status": "FORWARDED",
                "from_client_id": session.client_id,
                "payload": forward_data,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })

            # Acknowledge sender
            await session.send({
                "status": "OK",
                "action": "FORWARD",
                "delivered_to": target_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })

        else:
            await session.send({
                "status": "ERROR",
                "code": "UNKNOWN_ACTION",
                "message": f"Action '{action}' is not supported.",
            })

    async def _cleanup_client(self, session: ClientSession) -> None:
        """Removes client from tracking structures and notifies any paired peer."""
        peer_to_notify: Optional[ClientSession] = None

        async with self._lock:
            # 1. Unlink peer
            if session.peer_id:
                peer_session = self._clients.get(session.peer_id)
                if peer_session:
                    peer_session.peer_id = None
                    peer_to_notify = peer_session

            # 2. Remove from rooms
            if session.room_id and session.room_id in self._rooms:
                self._rooms[session.room_id].discard(session.client_id)
                if len(self._rooms[session.room_id]) == 0:
                    del self._rooms[session.room_id]

            # 3. Remove from active client map
            self._clients.pop(session.client_id, None)

        await session.close()

        # 4. Notify peer of disconnection
        if peer_to_notify and not peer_to_notify.is_closed:
            await peer_to_notify.send({
                "status": "PEER_DISCONNECTED",
                "peer_id": session.client_id,
                "message": f"Paired peer '{session.client_id}' has disconnected.",
            })


async def main():
    """CLI runner for standalone Raw TCP Server execution."""
    import sys
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 9000
    server = RawTcpServer(host="127.0.0.1", port=port)
    await server.start()
    try:
        while True:
            await asyncio.sleep(3600)
    except (KeyboardInterrupt, asyncio.CancelledError):
        await server.stop()


if __name__ == "__main__":
    asyncio.run(main())

