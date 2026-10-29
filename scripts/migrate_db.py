"""Database Migration CLI Script for VGARSS 2.0 (PostgreSQL & SQLite)."""
import os
import sys
import logging

# Ensure project root in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("vgarss.migrate")

from backend.app.config import settings
from backend.app.database import run_migrations, is_postgres, get_connection


def main():
    logger.info("==========================================================")
    logger.info("       VGARSS Database Migration & Schema Initializer     ")
    logger.info("==========================================================")
    logger.info(f"Target Database URL: {settings.database_url}")
    logger.info(f"Database Engine: {'PostgreSQL' if is_postgres() else 'SQLite WAL'}")

    try:
        # Test connection
        conn = get_connection()
        conn.close()
        logger.info("Database connection verified successfully.")

        # Run schema creation and migrations
        run_migrations()
        logger.info("Database schema initialized and all column migrations applied successfully.")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Migration failed: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()

