"""VGARSS Core FastAPI Application & Lifespan Service Orchestrator."""
import logging
import asyncio
import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from backend.app.config import settings
from backend.app.database import init_db, get_connection, is_postgres
from backend.app.api import auth_router, groups_router, simulations_router, resources_router
from backend.app.api.auth_v2 import router as auth_v2_router
from backend.app.api.workspaces_v2 import router as workspaces_v2_router
from backend.app.api.channels_v2 import router as channels_v2_router
from backend.app.api.dms_v2 import router as dms_v2_router
from backend.app.api.tasks_v2 import router as tasks_v2_router
from backend.app.api.search_v2 import router as search_v2_router
from backend.app.api.invitations_v2 import router as invitations_v2_router
from backend.app.network import ws_router, connection_manager, RawTcpServer
from backend.app.network.ws_v2 import ws_v2_router
from backend.app.network.chat_hub import chat_hub
from backend.app.simulation.scheduler_service import scheduler_worker

# Configure Structured Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
)
logger = logging.getLogger("vgarss.backend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager initializing persistence, background worker, and network servers."""
    logger.info(f"Initializing VGARSS persistence schema (Target: {'PostgreSQL' if is_postgres() else 'SQLite WAL'})...")
    init_db()
    logger.info("Database schema initialized and verified.")

    loop = asyncio.get_running_loop()
    connection_manager.set_event_loop(loop)

    # 1. Authoritative Server-Side Scheduler Background Worker
    if settings.scheduler_worker_enabled:
        try:
            await scheduler_worker.start()
            logger.info(f"Authoritative Scheduler Worker running (Worker ID: {settings.worker_id})")
        except Exception as e:
            logger.error(f"Failed to start Authoritative Scheduler Worker: {e}")

    # 2. Dedicated Coursework Raw TCP Socket Server
    tcp_server = None
    if settings.enable_tcp_server:
        try:
            tcp_server = RawTcpServer(
                host=settings.host,
                port=settings.tcp_port,
                max_connections=settings.tcp_max_connections,
                max_frame_size=settings.tcp_max_frame_size,
                read_timeout=settings.tcp_read_timeout,
            )
            await tcp_server.start()
            logger.info(f"Raw TCP socket server running on {settings.host}:{settings.tcp_port}")
        except Exception as e:
            logger.warning(f"Could not bind TCP socket server on {settings.host}:{settings.tcp_port}: {e}")

    yield

    # Graceful Shutdown
    if scheduler_worker.is_running:
        logger.info("Stopping Authoritative Scheduler Worker...")
        await scheduler_worker.stop()

    if tcp_server:
        logger.info("Stopping Raw TCP socket server...")
        await tcp_server.stop()

    logger.info("VGARSS Backend application shutting down cleanly.")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Virtual Group Asynchronous Real-Time Resource Synchronization & Scheduling System",
    lifespan=lifespan,
)

# Reverse Proxy Headers Middleware (X-Forwarded-Proto, X-Forwarded-For)
if settings.trust_proxy_headers:
    app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")

# Production CORS Configuration with explicit trusted origins and Vercel preview support
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"^https:\/\/.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Content-Range", "X-Total-Count"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    tb = traceback.format_exc()
    logger.error(f"Unhandled exception on {request.method} {request.url.path}: {exc}\n{tb}")
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "type": type(exc).__name__, "path": request.url.path}
    )

# Include Versioned REST Routers (V1)
app.include_router(auth_router)
app.include_router(groups_router)
app.include_router(simulations_router)
app.include_router(resources_router)

# Include V2 Chat-First Collaboration Routers
app.include_router(auth_v2_router)
app.include_router(workspaces_v2_router)
app.include_router(channels_v2_router)
app.include_router(dms_v2_router)
app.include_router(tasks_v2_router)
app.include_router(search_v2_router)
app.include_router(invitations_v2_router)

# Include WebSocket Routers (V1 group telemetry & V2 real-time collaboration)
app.include_router(ws_router)
app.include_router(ws_v2_router)


@app.get("/")
def root():
    return {
        "system": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
        "health": "/api/v1/health",
        "health_v1": "/api/v1/health",
        "health_v2": "/api/v2/health",
        "worker_id": settings.worker_id,
        "environment": settings.environment,
        "routes": {
            "auth": "/api/v2/auth",
            "workspaces": "/api/v2/workspaces",
            "tasks": "/api/v2/tasks",
            "websocket_collaboration": "/ws/v2",
        },
        "raw_tcp_port": settings.tcp_port,
    }


@app.get("/api/v1/health")
def health_check_v1():
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


@app.get("/api/v2/health")
def health_check_v2():
    """Comprehensive production health check with database ping and active connections."""
    db_status = "connected"
    db_error = None
    try:
        conn = get_connection()
        conn.execute("SELECT 1").fetchone()
        conn.close()
    except Exception as e:
        db_status = "error"
        db_error = str(e)

    total_ws_clients = sum(len(sessions) for sessions in chat_hub._user_sessions.values())

    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "version": settings.app_version,
        "environment": settings.environment,
        "worker_id": settings.worker_id,
        "database": {
            "engine": "PostgreSQL" if is_postgres() else "SQLite WAL",
            "status": db_status,
            "error": db_error,
        },
        "scheduler_worker": {
            "enabled": settings.scheduler_worker_enabled,
            "is_running": scheduler_worker.is_running,
            "interval_sec": settings.scheduler_step_interval,
        },
        "telemetry": {
            "active_ws_users": len(chat_hub._user_sessions),
            "total_connected_devices": total_ws_clients,
            "monitored_workspaces": len(chat_hub._workspace_subscribers),
        },
        "trusted_origins": settings.cors_origins,
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }
