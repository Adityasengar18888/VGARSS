"""Standalone runner script for VGARSS Authoritative Scheduler Worker."""
import os
import sys
import asyncio

# Ensure project root in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.simulation.scheduler_service import main

if __name__ == "__main__":
    asyncio.run(main())

