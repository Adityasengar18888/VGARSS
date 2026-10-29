"""Binary Length-Prefixed Protocol Framing for VGARSS TCP Network Layer.

Protocol Specification:
  0                   1                   2                   3
  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 |                 Payload Length N (4 Bytes Big-Endian)         |
 +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 |                                                               |
 +                   UTF-8 JSON Encoded Payload                  +
 |                          (N Bytes)                            |
 +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
"""
import json
import struct
import asyncio
from typing import Any, Tuple, Union

# 4-byte big-endian unsigned integer prefix format
HEADER_FORMAT = "!I"
HEADER_SIZE = struct.calcsize(HEADER_FORMAT)  # 4 bytes
DEFAULT_MAX_FRAME_SIZE = 1024 * 1024  # 1 MB maximum payload limit


class FramingError(Exception):
    """Base exception for network framing errors."""
    pass


class FrameTooLargeError(FramingError):
    """Raised when an incoming packet declares a length exceeding max permitted size."""
    pass


class MalformedPayloadError(FramingError):
    """Raised when the received payload is not valid UTF-8 or JSON."""
    pass


class ConnectionClosedError(FramingError):
    """Raised when the stream is closed before reading expected bytes."""
    pass


def encode_frame(payload: Union[dict, list, str, bytes]) -> bytes:
    """Encodes a payload into a 4-byte length-prefixed binary packet."""
    if isinstance(payload, bytes):
        raw_body = payload
    elif isinstance(payload, str):
        raw_body = payload.encode("utf-8")
    else:
        raw_body = json.dumps(payload).encode("utf-8")

    length = len(raw_body)
    header = struct.pack(HEADER_FORMAT, length)
    return header + raw_body


async def read_frame(
    reader: asyncio.StreamReader,
    max_frame_size: int = DEFAULT_MAX_FRAME_SIZE,
) -> dict[str, Any]:
    """Reads a single framed message from an asyncio StreamReader.
    
    Handles partial reads, verifies length boundaries, and decodes JSON.
    """
    try:
        header = await reader.readexactly(HEADER_SIZE)
    except asyncio.IncompleteReadError as e:
        if len(e.partial) == 0:
            raise ConnectionClosedError("Client closed connection cleanly.") from e
        raise FramingError(f"Incomplete frame header: received {len(e.partial)} of {HEADER_SIZE} bytes.") from e

    length = struct.unpack(HEADER_FORMAT, header)[0]

    if length > max_frame_size:
        raise FrameTooLargeError(
            f"Frame length {length} bytes exceeds maximum allowed {max_frame_size} bytes."
        )

    if length == 0:
        return {}

    try:
        payload_bytes = await reader.readexactly(length)
    except asyncio.IncompleteReadError as e:
        raise FramingError(
            f"Incomplete frame body: expected {length} bytes, received {len(e.partial)} bytes."
        ) from e

    try:
        text = payload_bytes.decode("utf-8")
        return json.loads(text)
    except (UnicodeDecodeError, json.JSONDecodeError) as e:
        raise MalformedPayloadError(f"Failed to decode JSON payload: {e}") from e


async def write_frame(
    writer: asyncio.StreamWriter,
    payload: Union[dict, list, str, bytes],
) -> None:
    """Encodes and asynchronously writes a framed message to an asyncio StreamWriter."""
    frame_bytes = encode_frame(payload)
    writer.write(frame_bytes)
    await writer.drain()
