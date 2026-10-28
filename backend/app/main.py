"""VGARSS Core FastAPI Application & Lifespan Service Orchestrator."""
import logging
import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from backend.app.config import settings
from backend.app.database import init_db
from backend.app.api import auth_router, groups_router, simulations_router, resources_router

# Configure Structured Logging
logging.basicConfig(
    level=settings.log_level.upper() if hasattr(settings, "log_level") else logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
)
logger = logging.getLogger("vgarss.backend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager initializing SQLite schema and services."""
    logger.info("Initializing VGARSS SQLite persistence schema...")
    init_db()
    logger.info("Database schema initialized with WAL mode & foreign keys enabled.")
    yield
    logger.info("VGARSS Backend application shutting down cleanly.")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Virtual Group Asynchronous Real-Time Resource Synchronization & Scheduling System",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Versioned REST Routers
app.include_router(auth_router)
app.include_router(groups_router)
app.include_router(simulations_router)
app.include_router(resources_router)

# Active WebSocket connections
active_connections: list[WebSocket] = []


@app.get("/")
def root():
    return {
        "system": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
        "health": "/api/v1/health",
        "routes": {
            "auth": "/api/v1/auth",
            "groups": "/api/v1/groups",
            "simulations": "/api/v1/groups/{group_id}/simulations",
            "resources": "/api/v1/groups/{group_id}/simulations/{sim_id}/resources",
        },
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
    """Real-time bi-directional telemetry broadcast socket, kept separate from core schedulers."""
    await websocket.accept()
    active_connections.append(websocket)
    try:
        await websocket.send_json({
            "event": "CONNECTED",
            "message": "Connected to VGARSS real-time telemetry stream",
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        })
        while True:
            data = await websocket.receive_text()
            await websocket.send_json({
                "event": "ACK",
                "received": data,
                "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            })
    except WebSocketDisconnect:
        if websocket in active_connections:
            active_connections.remove(websocket)
