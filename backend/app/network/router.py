"""VGARSS WebSocket Routes for Group-Specific Telemetry & Global Event Streams."""
import json
import logging
from datetime import datetime, timezone
from typing import Optional, Any
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status, HTTPException
from pydantic import BaseModel, Field

from backend.app.network.manager import connection_manager
from backend.app.network.events import EventType

logger = logging.getLogger("vgarss.network.websocket")
ws_router = APIRouter(tags=["WebSockets"])


@ws_router.websocket("/ws/groups/{group_id}")
async def group_websocket_endpoint(
    websocket: WebSocket,
    group_id: str,
    token: Optional[str] = Query(None),
    last_seq: Optional[int] = Query(None),
):
    """Authenticated, group-isolated real-time telemetry and state resynchronization endpoint.
    
    Authentication can be supplied via:
    1. Query parameter: `?token=<session_token>`
    2. Initial frame: `{"type": "AUTH", "token": "<session_token>", "last_seq": 10}`
    """
    client_conn = None
    user = None

    if token:
        user = connection_manager.verify_authorization(group_id, token)
        if not user:
            await websocket.accept()
            await websocket.send_json({
                "type": EventType.ERROR.value,
                "code": "FORBIDDEN",
                "message": f"Unauthorized: invalid session token or no access to group '{group_id}'.",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Unauthorized group access")
            return
        await websocket.accept()
    else:
        # Await initial AUTH frame within 5 seconds
        await websocket.accept()
        try:
            raw_init = await websocket.receive_text()
            init_msg = json.loads(raw_init)
            if init_msg.get("type") == "AUTH" and "token" in init_msg:
                token = init_msg["token"]
                if "last_seq" in init_msg and last_seq is None:
                    last_seq = init_msg.get("last_seq")
                user = connection_manager.verify_authorization(group_id, token)
            
            if not user:
                await websocket.send_json({
                    "type": EventType.ERROR.value,
                    "code": "FORBIDDEN",
                    "message": "Authentication failed or access denied for this virtual group.",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Authentication failed")
                return
        except Exception as e:
            logger.warning(f"WebSocket handshake failed on /ws/groups/{group_id}: {e}")
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Handshake timeout or error")
            return

    # Authorized: register client
    client_conn = await connection_manager.connect_client(websocket, group_id, user)

    # Send handshake confirmation
    current_seq = connection_manager.get_current_seq(group_id)
    client_conn.send_event_nowait({
        "type": EventType.AUTH_SUCCESS.value,
        "group_id": group_id,
        "current_seq": current_seq,
        "user": {"id": user["id"], "username": user["username"], "role": user["role"]},
        "message": f"Successfully authenticated to group '{group_id}'.",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    # Trigger resync if client specified last_seq
    if last_seq is not None:
        await connection_manager.resynchronize_client(client_conn, last_seq)

    # Main incoming message processing loop
    try:
        while not client_conn.is_closed:
            raw_text = await websocket.receive_text()
            try:
                msg = json.loads(raw_text)
            except Exception:
                client_conn.send_event_nowait({
                    "type": EventType.ERROR.value,
                    "code": "MALFORMED_JSON",
                    "message": "Incoming message could not be parsed as JSON.",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })
                continue

            msg_type = msg.get("type", "").upper()

            # Health Check / Heartbeat
            if msg_type == "PING":
                client_conn.send_event_nowait({
                    "type": EventType.PONG.value,
                    "client_timestamp": msg.get("timestamp"),
                    "server_timestamp": datetime.now(timezone.utc).isoformat(),
                })

            # Explicit State Resynchronization Request
            elif msg_type == "RESYNC":
                req_last_seq = int(msg.get("last_seq", 0))
                await connection_manager.resynchronize_client(client_conn, req_last_seq)

            # Echo test
            elif msg_type == "ECHO":
                client_conn.send_event_nowait({
                    "type": "ECHO_REPLY",
                    "data": msg.get("data"),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })

            else:
                client_conn.send_event_nowait({
                    "type": "ACK",
                    "received_type": msg_type,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.debug(f"WebSocket connection exception for client {client_conn.client_id}: {e}")
    finally:
        if client_conn:
            await connection_manager.disconnect(client_conn)


@ws_router.websocket("/ws")
async def general_websocket_endpoint(
    websocket: WebSocket,
    group_id: Optional[str] = Query(None),
    token: Optional[str] = Query(None),
    last_seq: Optional[int] = Query(None),
):
    """Fallback & global telemetry broadcast endpoint.
    
    If `group_id` is supplied, routes into the group authorization pipeline.
    Otherwise operates as a general broadcast receiver.
    """
    if group_id:
        return await group_websocket_endpoint(
            websocket=websocket,
            group_id=group_id,
            token=token,
            last_seq=last_seq,
        )

    await websocket.accept()
    client = await connection_manager.connect_global_listener(websocket)

    client.send_event_nowait({
        "event": EventType.CONNECTED.value,
        "type": EventType.CONNECTED.value,
        "message": "Connected to VGARSS real-time telemetry stream",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    try:
        while not client.is_closed:
            data = await websocket.receive_text()
            try:
                parsed = json.loads(data)
                mtype = parsed.get("type", "").upper()
                if mtype == "PING":
                    client.send_event_nowait({
                        "type": EventType.PONG.value,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })
                    continue
            except Exception:
                pass

            client.send_event_nowait({
                "event": "ACK",
                "received": data,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
    except WebSocketDisconnect:
        pass
    finally:
        await connection_manager.disconnect(client)


class TcpTestRequest(BaseModel):
    action: str = Field(default="PING", description="PING, ECHO, IDENTIFY, STATUS, PAIR, FORWARD")
    client_id: Optional[str] = "client_alpha"
    target_id: Optional[str] = "client_beta"
    payload: Optional[Any] = None


@ws_router.get("/api/v1/network/tcp/status")
async def get_tcp_server_status():
    """Checks whether the raw TCP server is listening on port 9000."""
    import asyncio
    from backend.app.config import settings

    is_online = False
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(settings.host, settings.tcp_port),
            timeout=1.5,
        )
        is_online = True
        writer.close()
        await writer.wait_closed()
    except Exception:
        is_online = False

    return {
        "status": "ONLINE" if is_online else "OFFLINE",
        "host": settings.host,
        "port": settings.tcp_port,
        "framing": "4-byte big-endian prefix (!I)",
    }


@ws_router.post("/api/v1/network/tcp/test")
async def test_tcp_server_packet(req: TcpTestRequest):
    """Sends a length-prefixed binary frame to the raw TCP server on port 9000 and reads the framed response."""
    import asyncio
    import time
    from backend.app.config import settings
    from backend.app.network.framing import read_frame, write_frame

    start_t = time.perf_counter()
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(settings.host, settings.tcp_port),
            timeout=3.0,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Could not connect to TCP server on port 9000: {e}",
        )

    try:
        # 1. Read CONNECTED handshake from server
        handshake = await asyncio.wait_for(read_frame(reader), timeout=2.0)

        # 2. Build packet payload
        msg_body: dict = {"action": req.action.upper()}
        if req.action.upper() == "IDENTIFY" and req.client_id:
            msg_body["client_id"] = req.client_id
        elif req.action.upper() == "PAIR" and req.target_id:
            msg_body["target_id"] = req.target_id
        elif req.action.upper() == "FORWARD":
            msg_body["target_id"] = req.target_id
            msg_body["payload"] = req.payload
        elif req.action.upper() == "ECHO":
            msg_body["data"] = req.payload or {"test": "echo-payload"}

        # 3. Transmit frame
        await write_frame(writer, msg_body)

        # 4. Read response frame
        response = await asyncio.wait_for(read_frame(reader), timeout=2.0)

        round_trip_ms = round((time.perf_counter() - start_t) * 1000, 2)

        # Calculate raw header hex
        json_bytes = json.dumps(msg_body).encode("utf-8")
        header_hex = len(json_bytes).to_bytes(4, byteorder="big").hex(" ").upper()

        writer.close()
        await writer.wait_closed()

        return {
            "connected": True,
            "round_trip_ms": round_trip_ms,
            "sent_header_hex": header_hex,
            "sent_length": len(json_bytes),
            "sent_payload": msg_body,
            "server_handshake": handshake,
            "response_payload": response,
        }
    except Exception as e:
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"TCP communication error: {e}",
        )

