"""Standalone runner script for VGARSS Raw Length-Prefixed TCP Socket Server (Port 9000).

Coursework Demonstration:
- Dedicated transport-layer raw TCP socket server
- 4-byte big-endian binary length prefix framing
- Completely decoupled from FastAPI and public Web entrypoint
"""
import os
import sys
import asyncio
import logging

# Ensure project root in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] [tcp-server] %(message)s")
logger = logging.getLogger("vgarss.network.tcp")

from backend.app.config import settings
from backend.app.network.tcp_server import RawTcpServer


async def main():
    logger.info("==========================================================")
    logger.info("       VGARSS Coursework Raw TCP Socket Server            ")
    logger.info("==========================================================")
    logger.info(f"Host: {settings.host}:{settings.tcp_port}")
    logger.info(f"Framing: 4-Byte Big-Endian '!I' Length-Prefixed JSON")
    logger.info(f"Max Connections: {settings.tcp_max_connections}")
    logger.info(f"Max Frame Size: {settings.tcp_max_frame_size} bytes")

    server = RawTcpServer(
        host=settings.host,
        port=settings.tcp_port,
        max_connections=settings.tcp_max_connections,
        max_frame_size=settings.tcp_max_frame_size,
        read_timeout=settings.tcp_read_timeout,
    )

    await server.start()
    try:
        while True:
            await asyncio.sleep(1)
    except (KeyboardInterrupt, asyncio.CancelledError):
        logger.info("TCP Server termination signal received.")
    finally:
        await server.stop()
        logger.info("TCP Server shut down cleanly.")


if __name__ == "__main__":
    asyncio.run(main())

