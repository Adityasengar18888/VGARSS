---
name: computer-networks
description: >-
  Use this skill when developing, debugging, or testing network communications,
  including REST APIs, bi-directional WebSockets, raw TCP socket servers, message framing,
  serialization, packet validation, and multi-client connection management.
---

# Computer Networks Skill for VGARSS

This skill governs network layer design, socket programming, protocol framing, and asynchronous communication handling in VGARSS.

## Core Networking Concepts & Implementation

1. **Client-Server Architecture**:
   - Clear decoupling of network transport handlers from underlying operating system simulation algorithms.
   - Handlers receive raw payloads, validate schemas, forward actions to the simulation engine, and return structured network responses.

2. **Raw TCP Socket Server (Port 9000)**:
   - Built with Python `asyncio.start_server` to achieve high-concurrency non-blocking I/O.
   - **Binary Framing Specification**:
     - All messages are prefixed with a 4-byte big-endian unsigned integer (`!I` in `struct.pack`/`unpack`).
     - Message structure: `[4 bytes length (N)][N bytes UTF-8 JSON]`.
     - Handles partial reads and multiple coalesced messages in the TCP receive buffer (`asyncio.StreamReader.readexactly`).

3. **WebSocket Telemetry Stream**:
   - FastAPI WebSocket router (`/ws`).
   - Maintains a concurrent connection manager to broadcast state updates to all active UI clients.
   - Gracefully removes disconnected clients without throwing unhandled exceptions.

4. **Error Handling & Network Edge Cases**:
   - Guard against malformed JSON, truncated buffers, connection resets (`ConnectionResetError`), and client heartbeats.
   - Provide client-side reconnection logic with exponential backoff.

## Verification Checklist
- Run automated TCP socket client tests verifying handshake, message transmission, response parsing, and disconnect cleanup.
- Verify WebSocket connection status changes (Connecting -> Connected -> Disconnected) visually and via unit tests.
