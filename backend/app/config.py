"""VGARSS Configuration Module."""
import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_name: str = "VGARSS Simulation Engine"
    app_version: str = "0.1.0"
    environment: str = os.getenv("VGARSS_ENV", "development")
    host: str = os.getenv("VGARSS_HOST", "127.0.0.1")
    port: int = int(os.getenv("VGARSS_PORT", "8000"))
    tcp_port: int = int(os.getenv("VGARSS_TCP_PORT", "9000"))
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]
    database_url: str = os.getenv("VGARSS_DATABASE_URL", "sqlite:///./vgarss.db")

settings = Settings()
