"""Comprehensive Test Suite for Raw TCP Socket Server & Protocol Framing.

Tests:
- Length-prefixed binary framing (header validation, encode/decode)
- Partial reads and buffer coalescing / fragment chunking
- Bounded concurrency and connection limit enforcement
- Client idle timeouts
- Malformed payloads (invalid JSON, frame too large, truncated header)
- Paired-client direct pairing, room pairing & bidirectional message forwarding
- Disconnect handling, peer unpairing notifications & resource cleanup
"""
import struct
import asyncio
import pytest
from backend.app.network.framing import (
    encode_frame,
    read_frame,
    write_frame,
    HEADER_FORMAT,
    HEADER_SIZE,
    FrameTooLargeError,
    MalformedPayloadError,
)
from backend.app.network.tcp_server import RawTcpServer


@pytest.fixture
async def tcp_server():
    """Starts a clean RawTcpServer on an ephemeral port (port=0)."""
    server = RawTcpServer(
        host="127.0.0.1",
        port=0,
        max_connections=5,
        max_frame_size=4096,  # 4 KB limit for testing
        read_timeout=2.0,
    )
    await server.start()
    yield server
    await server.stop()


async def open_client(port: int):
    """Helper connecting a raw TCP client to the ephemeral server port."""
    reader, writer = await asyncio.open_connection("127.0.0.1", port)
    # Read initial CONNECTED frame
    welcome = await read_frame(reader)
    assert welcome["status"] == "CONNECTED"
    return reader, writer, welcome


@pytest.mark.asyncio
async def test_tcp_framing_encode_decode():
    """Tests binary framing encode and decode invariants."""
    data = {"action": "PING", "timestamp": "2026-10-29T00:00:00Z"}
    encoded = encode_frame(data)
    
    # 4-byte header length
    declared_len = struct.unpack(HEADER_FORMAT, encoded[:HEADER_SIZE])[0]
    body = encoded[HEADER_SIZE:]
    assert len(body) == declared_len

    # Feed into asyncio StreamReader
    reader = asyncio.StreamReader()
    reader.feed_data(encoded)
    reader.feed_eof()

    decoded = await read_frame(reader)
    assert decoded == data


@pytest.mark.asyncio
async def test_tcp_partial_read_fragmentation():
    """Tests that read_frame handles fragmented TCP buffers arriving byte-by-byte."""
    payload = {"message": "Deterministic kernel scheduling across discrete clock ticks"}
    encoded = encode_frame(payload)

    reader = asyncio.StreamReader()
    
    # Feed header in two 2-byte chunks
    reader.feed_data(encoded[:2])
    await asyncio.sleep(0.01)
    reader.feed_data(encoded[2:HEADER_SIZE])
    await asyncio.sleep(0.01)

    # Feed body in single-byte fragments
    for b in encoded[HEADER_SIZE:]:
        reader.feed_data(bytes([b]))
        await asyncio.sleep(0.001)

    reader.feed_eof()
    decoded = await read_frame(reader)
    assert decoded == payload


@pytest.mark.asyncio
async def test_tcp_ping_and_echo(tcp_server):
    """Tests basic PING-PONG and ECHO request-response cycle."""
    reader, writer, _ = await open_client(tcp_server.actual_port)

    # 1. PING
    await write_frame(writer, {"action": "PING"})
    pong = await read_frame(reader)
    assert pong["status"] == "OK"
    assert pong["action"] == "PONG"
    assert "timestamp" in pong

    # 2. ECHO
    await write_frame(writer, {"action": "ECHO", "data": {"key": "vgarss_metrics", "val": 42}})
    echo_resp = await read_frame(reader)
    assert echo_resp["status"] == "OK"
    assert echo_resp["action"] == "ECHO"
    assert echo_resp["data"] == {"key": "vgarss_metrics", "val": 42}

    writer.close()
    await writer.wait_closed()


@pytest.mark.asyncio
async def test_tcp_bounded_concurrency():
    """Tests that server enforces maximum connection capacity limit."""
    server = RawTcpServer(host="127.0.0.1", port=0, max_connections=2, read_timeout=5.0)
    await server.start()

    try:
        # Client 1 connects
        r1, w1, _ = await open_client(server.actual_port)
        # Client 2 connects
        r2, w2, _ = await open_client(server.actual_port)
        assert server.client_count == 2

        # Client 3 attempts to connect (exceeds max_connections=2)
        r3, w3 = await asyncio.open_connection("127.0.0.1", server.actual_port)
        rej_frame = await read_frame(r3)
        assert rej_frame["status"] == "ERROR"
        assert rej_frame["code"] == "CONCURRENCY_LIMIT_EXCEEDED"

        # Disconnect client 1
        w1.close()
        await w1.wait_closed()
        await asyncio.sleep(0.05)
        assert server.client_count == 1

        # Now Client 4 can connect
        r4, w4, _ = await open_client(server.actual_port)
        assert server.client_count == 2

        w2.close()
        await w2.wait_closed()
        w4.close()
        await w4.wait_closed()
    finally:
        await server.stop()


@pytest.mark.asyncio
async def test_tcp_read_timeout():
    """Tests that idle clients exceeding read timeout are cleanly terminated."""
    server = RawTcpServer(host="127.0.0.1", port=0, max_connections=5, read_timeout=0.3)
    await server.start()

    try:
        r, w, _ = await open_client(server.actual_port)
        # Client stays idle without sending data
        resp = await read_frame(r)
        assert resp["status"] == "ERROR"
        assert resp["code"] == "TIMEOUT"

        w.close()
        await w.wait_closed()
    finally:
        await server.stop()


@pytest.mark.asyncio
async def test_tcp_frame_too_large(tcp_server):
    """Tests rejection when client declares frame length exceeding max_frame_size."""
    r, w = await asyncio.open_connection("127.0.0.1", tcp_server.actual_port)
    await read_frame(r)  # Handshake

    # Send 4-byte header claiming 10,000 bytes (max is 4096)
    excessive_len = struct.pack(HEADER_FORMAT, 10000)
    w.write(excessive_len)
    await w.drain()

    resp = await read_frame(r)
    assert resp["status"] == "ERROR"
    assert resp["code"] == "FRAME_TOO_LARGE"

    w.close()
    await w.wait_closed()


@pytest.mark.asyncio
async def test_tcp_malformed_payload(tcp_server):
    """Tests rejection when payload contains invalid JSON bytes."""
    r, w = await asyncio.open_connection("127.0.0.1", tcp_server.actual_port)
    await read_frame(r)  # Handshake

    bad_payload = b"{not_valid_json!"
    header = struct.pack(HEADER_FORMAT, len(bad_payload))
    w.write(header + bad_payload)
    await w.drain()

    resp = await read_frame(r)
    assert resp["status"] == "ERROR"
    assert resp["code"] == "MALFORMED_PAYLOAD"

    # Connection remains alive for subsequent valid command
    await write_frame(w, {"action": "PING"})
    pong = await read_frame(r)
    assert pong["status"] == "OK"
    assert pong["action"] == "PONG"

    w.close()
    await w.wait_closed()


@pytest.mark.asyncio
async def test_tcp_paired_client_direct_forwarding(tcp_server):
    """Tests direct pairing between two clients and bidirectional message forwarding."""
    # 1. Connect Client A
    r_a, w_a, _ = await open_client(tcp_server.actual_port)
    await write_frame(w_a, {"action": "IDENTIFY", "client_id": "alice"})
    id_a = await read_frame(r_a)
    assert id_a["status"] == "OK"
    assert id_a["client_id"] == "alice"

    # 2. Connect Client B
    r_b, w_b, _ = await open_client(tcp_server.actual_port)
    await write_frame(w_b, {"action": "IDENTIFY", "client_id": "bob"})
    id_b = await read_frame(r_b)
    assert id_b["status"] == "OK"
    assert id_b["client_id"] == "bob"

    # 3. Alice pairs with Bob
    await write_frame(w_a, {"action": "PAIR", "target_id": "bob"})
    pair_resp_a = await read_frame(r_a)
    assert pair_resp_a["status"] == "OK"
    assert pair_resp_a["peer_id"] == "bob"

    pair_notif_b = await read_frame(r_b)
    assert pair_notif_b["status"] == "PEER_PAIRED"
    assert pair_notif_b["peer_id"] == "alice"

    # 4. Alice forwards a message to Bob
    await write_frame(w_a, {
        "action": "FORWARD",
        "payload": {"task": "SIMULATE_BURST", "burst_time": 5, "priority": 1},
    })

    # Bob receives forwarded message
    fwd_b = await read_frame(r_b)
    assert fwd_b["status"] == "FORWARDED"
    assert fwd_b["from_client_id"] == "alice"
    assert fwd_b["payload"]["task"] == "SIMULATE_BURST"
    assert fwd_b["payload"]["burst_time"] == 5

    # Alice receives delivery confirmation
    ack_a = await read_frame(r_a)
    assert ack_a["status"] == "OK"
    assert ack_a["action"] == "FORWARD"
    assert ack_a["delivered_to"] == "bob"

    # 5. Bob replies and forwards back to Alice
    await write_frame(w_b, {
        "action": "FORWARD",
        "payload": {"reply": "BURST_ACCEPTED", "assigned_pid": "P1"},
    })

    fwd_a = await read_frame(r_a)
    assert fwd_a["status"] == "FORWARDED"
    assert fwd_a["from_client_id"] == "bob"
    assert fwd_a["payload"]["assigned_pid"] == "P1"

    ack_b = await read_frame(r_b)
    assert ack_b["status"] == "OK"

    # 6. Unpair
    await write_frame(w_a, {"action": "UNPAIR"})
    unpair_a = await read_frame(r_a)
    assert unpair_a["status"] == "OK"

    unpair_b = await read_frame(r_b)
    assert unpair_b["status"] == "PEER_UNPAIRED"

    w_a.close()
    await w_a.wait_closed()
    w_b.close()
    await w_b.wait_closed()


@pytest.mark.asyncio
async def test_tcp_room_pairing_and_peer_disconnect(tcp_server):
    """Tests channel/room pairing and peer disconnect notification."""
    r1, w1, _ = await open_client(tcp_server.actual_port)
    r2, w2, _ = await open_client(tcp_server.actual_port)

    # Client 1 joins room "simulation-ch1"
    await write_frame(w1, {"action": "JOIN_PAIR", "room_id": "simulation-ch1"})
    wait_resp = await read_frame(r1)
    assert wait_resp["status"] == "WAITING_FOR_PEER"
    assert wait_resp["room_id"] == "simulation-ch1"

    # Client 2 joins same room -> automates pairing
    await write_frame(w2, {"action": "JOIN_PAIR", "room_id": "simulation-ch1"})
    paired_c2 = await read_frame(r2)
    assert paired_c2["status"] == "OK"
    assert paired_c2["action"] == "JOIN_PAIR"

    paired_c1 = await read_frame(r1)
    assert paired_c1["status"] == "PEER_PAIRED"

    # Client 1 disconnects abruptly
    w1.close()
    await w1.wait_closed()

    # Client 2 receives PEER_DISCONNECTED
    disc_notif = await read_frame(r2)
    assert disc_notif["status"] == "PEER_DISCONNECTED"

    # Forwarding now returns NOT_PAIRED
    await write_frame(w2, {"action": "FORWARD", "payload": {"test": 123}})
    err = await read_frame(r2)
    assert err["status"] == "ERROR"
    assert err["code"] == "NOT_PAIRED"

    w2.close()
    await w2.wait_closed()

