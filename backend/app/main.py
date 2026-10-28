"""VGARSS Core FastAPI Application."""
import datetime
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from backend.app.config import settings

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Virtual Group Asynchronous Real-Time Resource Synchronization & Scheduling System",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Active WebSocket connections
active_connections: list[WebSocket] = []

@app.get("/")
def root():
    return {
        "system": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
        "health": "/api/v1/health",
    }

@app.get("/api/v1/health")
def health_check():
    return {
        "status": "healthy",
        "version": settings.app_version,
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "environment": settings.environment,
        "ports": {
            "rest_api": settings.port,
            "websocket": settings.port,
            "raw_tcp": settings.tcp_port,
        },
    }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    try:
        # Send initial welcome message
        await websocket.send_json({
            "event": "CONNECTED",
            "message": "Connected to VGARSS real-time telemetry stream",
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        })
        while True:
            data = await websocket.receive_text()
            # Echo / acknowledge command
            await websocket.send_json({
                "event": "ACK",
                "received": data,
                "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            })
    except WebSocketDisconnect:
        if websocket in active_connections:
            active_connections.remove(websocket)
