"""VGARSS Configuration Module supporting Production Multi-Device Deployments."""
import os
import json
from typing import List
from pydantic_settings import BaseSettings


def _parse_cors_origins() -> List[str]:
    raw = os.getenv("VGARSS_CORS_ORIGINS") or os.getenv("CORS_ORIGINS")
    if raw:
        raw = raw.strip()
        if raw.startswith("["):
            try:
                return json.loads(raw)
            except Exception:
                pass
        return [o.strip() for o in raw.split(",") if o.strip()]
    return [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]


def _resolve_database_url() -> str:
    url = os.getenv("DATABASE_URL") or os.getenv("VGARSS_DATABASE_URL") or "sqlite:///./vgarss.db"
    # Normalize legacy postgres:// protocol to postgresql:// for SQLAlchemy/psycopg
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    return url


class Settings(BaseSettings):
    app_name: str = "VGARSS Simulation Engine"
    app_version: str = "0.2.0"
    environment: str = os.getenv("VGARSS_ENV", os.getenv("ENV", "development"))
    host: str = os.getenv("VGARSS_HOST", "0.0.0.0" if os.getenv("VGARSS_ENV") == "production" else "127.0.0.1")
    port: int = int(os.getenv("PORT", os.getenv("VGARSS_PORT", "8000")))
    secret_key: str = os.getenv("SECRET_KEY", os.getenv("VGARSS_SECRET_KEY", "vgarss-dev-insecure-secret-key-change-in-prod"))
    
    # Cross-Origin Resource Sharing (CORS)
    cors_origins: List[str] = _parse_cors_origins()
    trust_proxy_headers: bool = os.getenv("VGARSS_TRUST_PROXY_HEADERS", "true").lower() in ("true", "1", "yes")

    # Coursework Raw TCP Socket Server (Isolated on Port 9000)
    tcp_port: int = int(os.getenv("VGARSS_TCP_PORT", "9000"))
    enable_tcp_server: bool = os.getenv("VGARSS_ENABLE_TCP", "true" if os.getenv("VGARSS_ENV") != "production" else "false").lower() in ("true", "1", "yes")
    tcp_max_connections: int = int(os.getenv("VGARSS_TCP_MAX_CONN", "50"))
    tcp_read_timeout: float = float(os.getenv("VGARSS_TCP_TIMEOUT", "30.0"))
    tcp_max_frame_size: int = int(os.getenv("VGARSS_TCP_MAX_FRAME", str(1024 * 1024)))  # 1 MB

    # Relational Persistence (PostgreSQL & SQLite WAL)
    database_url: str = _resolve_database_url()

    # WebSockets & Telemetry Hub
    ws_max_queue_size: int = int(os.getenv("VGARSS_WS_MAX_QUEUE", "150"))
    ws_history_size: int = int(os.getenv("VGARSS_WS_HISTORY_SIZE", "500"))
    ws_write_timeout: float = float(os.getenv("VGARSS_WS_TIMEOUT", "5.0"))

    # Authoritative Scheduler Worker & Cross-Process Coordination
    worker_id: str = os.getenv("WORKER_ID", f"worker-{os.getpid()}")
    scheduler_worker_enabled: bool = os.getenv("VGARSS_SCHEDULER_WORKER", "true").lower() in ("true", "1", "yes")
    scheduler_step_interval: float = float(os.getenv("VGARSS_SCHEDULER_INTERVAL", "1.0"))
    scheduler_lock_ttl: float = float(os.getenv("VGARSS_SCHEDULER_LOCK_TTL", "5.0"))


settings = Settings()
