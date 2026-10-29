"""Authoritative Server-Side Scheduler & Distributed Worker Coordinator for VGARSS 2.0.

Provides:
- Centralized server-side execution of CPU scheduling and resource coordination
- Distributed lease-based leader election preventing multiple worker instances
  from running the same workspace simulation concurrently
- Discrete clock ticking, process state transitions, metrics calculation, and
  event broadcasting over authenticated WebSockets
- In-process lifespan support or standalone dedicated worker process execution
"""
import os
import sys
import time
import uuid
import json
import asyncio
import logging
from datetime import datetime, timezone
from typing import Set, Dict, Optional, Any

from backend.app.config import settings
from backend.app.database import (
    get_connection,
    acquire_workspace_lock,
    release_workspace_lock,
)
from backend.app.simulation.workspace_engine import workspace_engine_manager
from backend.app.network.chat_hub import chat_hub

logger = logging.getLogger("vgarss.scheduler_worker")


class AuthoritativeSchedulerWorker:
    """Manages coordinated, authoritative background CPU scheduling across workspaces."""

    def __init__(
        self,
        worker_id: Optional[str] = None,
        step_interval: float = 1.0,
        lock_ttl: float = 5.0,
    ):
        self.worker_id = worker_id or settings.worker_id
        self.step_interval = step_interval
        self.lock_ttl = lock_ttl
        self.is_running: bool = False
        self._loop_task: Optional[asyncio.Task] = None
        self._held_workspaces: Set[str] = set()

    async def start(self):
        """Starts the background authoritative scheduling loop."""
        if self.is_running:
            return
        self.is_running = True
        logger.info(f"Authoritative Scheduler Worker [{self.worker_id}] started (interval={self.step_interval}s, ttl={self.lock_ttl}s).")
        self._loop_task = asyncio.create_task(self._worker_loop())

    async def stop(self):
        """Stops the scheduler loop and releases all held workspace locks."""
        if not self.is_running:
            return
        self.is_running = False
        logger.info(f"Stopping Authoritative Scheduler Worker [{self.worker_id}]...")
        if self._loop_task:
            self._loop_task.cancel()
            try:
                await self._loop_task
            except asyncio.CancelledError:
                pass
            self._loop_task = None

        # Release all distributed leases
        conn = get_connection()
        try:
            for ws_id in list(self._held_workspaces):
                release_workspace_lock(conn, ws_id, self.worker_id)
            self._held_workspaces.clear()
        finally:
            conn.close()
        logger.info(f"Scheduler Worker [{self.worker_id}] shut down cleanly.")

    async def _worker_loop(self):
        """Periodic coordination loop discovering active workspaces and auto-stepping."""
        while self.is_running:
            try:
                await self._step_active_workspaces()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in scheduler worker loop: {e}", exc_info=True)

            try:
                await asyncio.sleep(self.step_interval)
            except asyncio.CancelledError:
                break

    async def _step_active_workspaces(self):
        """Finds workspaces that require scheduling, acquires distributed lease, and steps them."""
        conn = get_connection()
        try:
            # Discover workspaces with tasks in READY or RUNNING state
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT DISTINCT workspace_id FROM tasks
                WHERE status IN ('READY', 'RUNNING')
                """
            )
            active_workspaces = [r["workspace_id"] for r in cursor.fetchall()]

            for ws_id in active_workspaces:
                # 1. Coordinate via distributed lease to prevent multiple workers stepping same workspace
                has_lease = acquire_workspace_lock(conn, ws_id, self.worker_id, self.lock_ttl)
                if not has_lease:
                    # Another worker is actively managing this workspace
                    if ws_id in self._held_workspaces:
                        self._held_workspaces.remove(ws_id)
                    continue

                self._held_workspaces.add(ws_id)

                # 2. Authoritatively advance the discrete simulation clock
                engine = workspace_engine_manager.get_engine(ws_id, conn)
                new_state, events = engine.step(conn)

                # 3. Persist and broadcast channel system events
                for evt in events:
                    if evt.get("channel_id"):
                        sys_msg_id = str(uuid.uuid4())
                        seq = chat_hub.get_next_seq(evt["channel_id"])
                        cursor.execute(
                            """
                            INSERT INTO messages (id, workspace_id, channel_id, sender_id, message_type, content, payload_json, seq)
                            VALUES (?, ?, ?, NULL, 'SYSTEM_EVENT', ?, ?, ?)
                            """,
                            (
                                sys_msg_id,
                                ws_id,
                                evt["channel_id"],
                                evt["message"],
                                json.dumps({"task_id": evt["task_id"], "event": evt["event_type"]}),
                                seq,
                            ),
                        )
                        await chat_hub.broadcast_message(
                            workspace_id=ws_id,
                            channel_id=evt["channel_id"],
                            message_dict={
                                "id": sys_msg_id,
                                "workspace_id": ws_id,
                                "channel_id": evt["channel_id"],
                                "sender_id": None,
                                "sender_username": "System",
                                "sender_display_name": "System",
                                "message_type": "SYSTEM_EVENT",
                                "content": evt["message"],
                                "seq": seq,
                                "payload_json": {"task_id": evt["task_id"], "event": evt["event_type"]},
                                "created_at": datetime.now(timezone.utc).isoformat(),
                            },
                        )

                # 4. Broadcast updated scheduler state to all workspace subscribers
                await chat_hub.broadcast_scheduler_event(ws_id, "SCHEDULER_STEP", new_state)

            if hasattr(conn, "commit"):
                conn.commit()

        finally:
            conn.close()


scheduler_worker = AuthoritativeSchedulerWorker(
    worker_id=settings.worker_id,
    step_interval=settings.scheduler_step_interval,
    lock_ttl=settings.scheduler_lock_ttl,
)


async def main():
    """Standalone dedicated worker CLI entrypoint."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] [scheduler-worker] %(message)s",
    )
    logger.info("==========================================================")
    logger.info("     VGARSS Dedicated Authoritative Scheduler Worker      ")
    logger.info("==========================================================")
    logger.info(f"Worker ID: {settings.worker_id}")
    logger.info(f"Database: {settings.database_url}")
    logger.info(f"Step Interval: {settings.scheduler_step_interval}s, TTL: {settings.scheduler_lock_ttl}s")

    worker = AuthoritativeSchedulerWorker(
        worker_id=settings.worker_id,
        step_interval=settings.scheduler_step_interval,
        lock_ttl=settings.scheduler_lock_ttl,
    )

    await worker.start()
    try:
        while True:
            await asyncio.sleep(1)
    except (KeyboardInterrupt, asyncio.CancelledError):
        logger.info("Termination signal received.")
    finally:
        await worker.stop()


if __name__ == "__main__":
    asyncio.run(main())
