"""VGARSS Networking Subsystem.

Contains:
- Authenticated Group-Specific WebSocket Manager & Event Hub
- Raw Python Length-Prefixed TCP Socket Server (Port 9000)
- Protocol Framing Utilities
"""
from backend.app.network.framing import (
    encode_frame,
    read_frame,
    write_frame,
    FramingError,
    FrameTooLargeError,
    MalformedPayloadError,
    ConnectionClosedError,
)
from backend.app.network.events import EventType, NetworkEvent
from backend.app.network.manager import ClientConnection, ConnectionManager, connection_manager
from backend.app.network.tcp_server import ClientSession, RawTcpServer
from backend.app.network.router import ws_router

__all__ = [
    "encode_frame",
    "read_frame",
    "write_frame",
    "FramingError",
    "FrameTooLargeError",
    "MalformedPayloadError",
    "ConnectionClosedError",
    "EventType",
    "NetworkEvent",
    "ClientConnection",
    "ConnectionManager",
    "connection_manager",
    "ClientSession",
    "RawTcpServer",
    "ws_router",
]
