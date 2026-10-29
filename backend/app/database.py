"""Unified Database Persistence Layer (PostgreSQL & SQLite WAL Dual-Mode).

Provides ACID relational persistence for:
- Workspaces, Channels, Direct Messages, and Real-Time Chat History
- Users, Roles, Memberships, Presence, and Session Authentication
- Collaborative Tasks mapped to OS Simulation Processes and Resources
- Full backward-compatibility with VGARSS 1.0 Virtual Groups and Simulations
"""
import os
import re
import sqlite3
import logging
from datetime import datetime, timezone, timedelta
from typing import Generator, Optional, Any, List, Dict
from backend.app.config import settings
from backend.app.security import hash_password

logger = logging.getLogger("vgarss.database")


class CompatRow(dict):
    """Row wrapper that allows access by column name (row['col']), attribute, and index (row[0])."""
    def __init__(self, data: dict):
        super().__init__(data)
        self._keys = list(data.keys())
        self._values = list(data.values())

    def __getitem__(self, item):
        if isinstance(item, int):
            return self._values[item]
        return super().__getitem__(item)

    def keys(self):
        return self._keys

    def values(self):
        return self._values

    def items(self):
        return super().items()


class PostgresCompatCursor:
    """Cursor adapter converting SQLite-style parameter placeholders (?) and queries to PostgreSQL."""
    def __init__(self, raw_cursor):
        self._cur = raw_cursor

    def _convert_sql(self, sql: str) -> str:
        s = re.sub(r"INSERT\s+OR\s+IGNORE\s+INTO", "INSERT INTO", sql, flags=re.IGNORECASE)
        has_ignore = bool(re.search(r"INSERT\s+OR\s+IGNORE\s+INTO", sql, flags=re.IGNORECASE))
        if has_ignore and "ON CONFLICT" not in s.upper():
            s = s.strip()
            if s.endswith(";"):
                s = s[:-1] + " ON CONFLICT DO NOTHING;"
            else:
                s = s + " ON CONFLICT DO NOTHING"
        parts = s.split("'")
        for i in range(0, len(parts), 2):
            parts[i] = parts[i].replace("?", "%s")
        return "'".join(parts)

    def execute(self, sql: str, params: Any = None):
        converted = self._convert_sql(sql)
        if params is not None:
            if isinstance(params, (list, tuple)):
                self._cur.execute(converted, params)
            else:
                self._cur.execute(converted, (params,))
        else:
            self._cur.execute(converted)
        return self

    def executemany(self, sql: str, seq_of_params: Any):
        converted = self._convert_sql(sql)
        self._cur.executemany(converted, seq_of_params)
        return self

    def fetchone(self):
        row = self._cur.fetchone()
        if row is None:
            return None
        return CompatRow(row)

    def fetchall(self):
        rows = self._cur.fetchall()
        return [CompatRow(r) for r in rows]

    @property
    def rowcount(self):
        return self._cur.rowcount

    @property
    def lastrowid(self):
        return getattr(self._cur, "lastrowid", None)

    def close(self):
        self._cur.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


class PostgresCompatConnection:
    """Connection adapter that provides SQLite-compatible execution, transactions, and row factories over psycopg."""
    def __init__(self, raw_conn):
        self._conn = raw_conn

    def cursor(self):
        return PostgresCompatCursor(self._conn.cursor())

    def execute(self, sql: str, params: Any = None):
        cur = self.cursor()
        cur.execute(sql, params)
        return cur

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is not None:
            self.rollback()
        else:
            self.commit()


def get_db_path() -> str:
    """Extracts target file path or connection string from configuration."""
    url = settings.database_url
    if url.startswith("sqlite:///"):
        return url.replace("sqlite:///", "")
    return url


def is_postgres() -> bool:
    """Checks whether configured database URL targets PostgreSQL."""
    return settings.database_url.startswith(("postgresql://", "postgres://"))


def get_connection(db_path: Optional[str] = None) -> Any:
    """Creates an optimized database connection.
    
    If PostgreSQL URL is configured, attempts connection via psycopg with row dictionary factory.
    Otherwise, creates an optimized SQLite connection with foreign keys and WAL mode.
    """
    target = db_path if db_path is not None else get_db_path()

    if is_postgres() and db_path is None:
        try:
            import psycopg
            from psycopg.rows import dict_row
            raw_conn = psycopg.connect(settings.database_url, row_factory=dict_row)
            return PostgresCompatConnection(raw_conn)
        except Exception as e:
            logger.warning(f"Could not connect to PostgreSQL ({e}). Falling back to SQLite WAL mode.")

    # SQLite optimized connection
    if target != ":memory:":
        dir_name = os.path.dirname(target)
        if dir_name and not os.path.exists(dir_name):
            os.makedirs(dir_name, exist_ok=True)

    conn = sqlite3.connect(target, check_same_thread=False, timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    if target != ":memory:":
        try:
            conn.execute("PRAGMA journal_mode = WAL;")
        except Exception:
            pass
    conn.execute("PRAGMA synchronous = NORMAL;")
    return conn


def init_db(db_path: Optional[str] = None) -> None:
    """Initializes tables, constraints, foreign keys, indexes, and seeded dev users."""
    conn = get_connection(db_path)
    
    schema_sql = """
    -- ========================================================================
    -- 1. USERS & SESSIONS
    -- ========================================================================
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT NOT NULL DEFAULT '',
        avatar_url TEXT,
        bio TEXT DEFAULT '',
        status_message TEXT DEFAULT '',
        presence_state TEXT NOT NULL DEFAULT 'OFFLINE', -- 'ONLINE', 'AWAY', 'DND', 'OFFLINE'
        last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        device_info TEXT DEFAULT 'Desktop Web',
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- ========================================================================
    -- 2. WORKSPACES & VIRTUAL GROUPS (Dual-Domain Compatibility)
    -- ========================================================================
    CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        description TEXT DEFAULT '',
        icon_url TEXT,
        owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS workspace_members (
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'MEMBER', -- 'OWNER', 'ADMIN', 'MEMBER', 'GUEST'
        nickname TEXT,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (workspace_id, user_id)
    );

    -- Preserved VGARSS 1.0 Virtual Groups for backward compatibility
    CREATE TABLE IF NOT EXISTS virtual_groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS group_memberships (
        group_id TEXT NOT NULL REFERENCES virtual_groups(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'MEMBER', -- 'ADMIN', 'MEMBER', 'VIEWER'
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (group_id, user_id)
    );

    -- ========================================================================
    -- 3. CHANNELS & DIRECT CONVERSATIONS
    -- ========================================================================
    CREATE TABLE IF NOT EXISTS channels (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        topic TEXT DEFAULT '',
        channel_type TEXT NOT NULL DEFAULT 'TEXT', -- 'TEXT', 'SIMULATION', 'ANNOUNCEMENT'
        is_private INTEGER NOT NULL DEFAULT 0,
        created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (workspace_id, name)
    );

    CREATE TABLE IF NOT EXISTS channel_members (
        channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        last_read_message_id TEXT,
        unread_count INTEGER NOT NULL DEFAULT 0,
        notification_preference TEXT NOT NULL DEFAULT 'ALL',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (channel_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS direct_conversations (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        is_group INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS direct_conversation_participants (
        conversation_id TEXT NOT NULL REFERENCES direct_conversations(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        last_read_message_id TEXT,
        unread_count INTEGER NOT NULL DEFAULT 0,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (conversation_id, user_id)
    );

    -- ========================================================================
    -- 4. MESSAGES, THREADS & REACTIONS
    -- ========================================================================
    CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        channel_id TEXT REFERENCES channels(id) ON DELETE CASCADE,
        conversation_id TEXT REFERENCES direct_conversations(id) ON DELETE CASCADE,
        sender_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        message_type TEXT NOT NULL DEFAULT 'USER_TEXT', -- 'USER_TEXT', 'SYSTEM_EVENT', 'TASK_CARD', 'CODE_SNIPPET'
        content TEXT NOT NULL,
        parent_id TEXT REFERENCES messages(id) ON DELETE CASCADE,
        reply_count INTEGER NOT NULL DEFAULT 0,
        is_edited INTEGER NOT NULL DEFAULT 0,
        is_pinned INTEGER NOT NULL DEFAULT 0,
        payload_json TEXT DEFAULT '{}',
        client_msg_id TEXT,
        delivery_status TEXT NOT NULL DEFAULT 'SENT', -- 'SENT', 'DELIVERED', 'READ'
        seq INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS message_receipts (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        receipt_type TEXT NOT NULL, -- 'DELIVERED', 'READ'
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(message_id, user_id, receipt_type)
    );
    CREATE INDEX IF NOT EXISTS idx_receipts_msg ON message_receipts(message_id);
    CREATE INDEX IF NOT EXISTS idx_receipts_user ON message_receipts(user_id);

    CREATE TABLE IF NOT EXISTS message_reactions (
        message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        emoji TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (message_id, user_id, emoji)
    );

    -- ========================================================================
    -- 5. TASKS & OS SCHEDULING BRIDGE
    -- ========================================================================
    CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        channel_id TEXT REFERENCES channels(id) ON DELETE SET NULL,
        source_message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
        creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        priority TEXT NOT NULL DEFAULT 'MEDIUM', -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
        numeric_priority INTEGER NOT NULL DEFAULT 2,
        deadline TIMESTAMP,
        estimated_burst_ticks INTEGER NOT NULL DEFAULT 5,
        arrival_time INTEGER NOT NULL DEFAULT 0,
        remaining_burst_ticks INTEGER NOT NULL DEFAULT 5,
        start_tick INTEGER,
        completion_tick INTEGER,
        waiting_ticks INTEGER NOT NULL DEFAULT 0,
        turnaround_ticks INTEGER NOT NULL DEFAULT 0,
        response_ticks INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'NEW',     -- 'NEW', 'READY', 'RUNNING', 'WAITING', 'TERMINATED'
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- ========================================================================
    -- 6. SHARED RESOURCES & ALLOCATIONS
    -- ========================================================================
    CREATE TABLE IF NOT EXISTS resources (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        resource_type TEXT NOT NULL DEFAULT 'MUTEX', -- 'MUTEX', 'SEMAPHORE'
        total_capacity INTEGER NOT NULL DEFAULT 1,
        available_units INTEGER NOT NULL DEFAULT 1,
        description TEXT DEFAULT '',
        order_rank INTEGER NOT NULL DEFAULT 1,
        exclusive_holder TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (workspace_id, name)
    );

    CREATE TABLE IF NOT EXISTS task_resource_allocations (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
        requested_units INTEGER NOT NULL DEFAULT 1,
        allocated_units INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'REQUESTED', -- 'REQUESTED', 'HELD', 'RELEASED', 'PREEMPTED'
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        acquired_at TIMESTAMP,
        released_at TIMESTAMP
    );

    -- ========================================================================
    -- 7. PRESERVED VGARSS 1.0 SIMULATION RUNS & PCB TABLES
    -- ========================================================================
    CREATE TABLE IF NOT EXISTS simulations (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL REFERENCES virtual_groups(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        algorithm TEXT NOT NULL,
        time_quantum INTEGER DEFAULT 2,
        aging_interval INTEGER,
        is_preemptive INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'INITIALIZED',
        current_tick INTEGER DEFAULT 0,
        busy_ticks INTEGER DEFAULT 0,
        idle_ticks INTEGER DEFAULT 0,
        cpu_utilization REAL DEFAULT 0.0,
        avg_waiting_time REAL DEFAULT 0.0,
        avg_turnaround_time REAL DEFAULT 0.0,
        avg_response_time REAL DEFAULT 0.0,
        throughput REAL DEFAULT 0.0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS simulation_processes (
        id TEXT NOT NULL,
        simulation_id TEXT NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
        arrival_time INTEGER NOT NULL,
        burst_time INTEGER NOT NULL,
        remaining_time INTEGER NOT NULL,
        priority INTEGER DEFAULT 1,
        state TEXT NOT NULL DEFAULT 'NEW',
        start_time INTEGER,
        completion_time INTEGER,
        waiting_time INTEGER DEFAULT 0,
        turnaround_time INTEGER DEFAULT 0,
        response_time INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (simulation_id, id)
    );

    CREATE TABLE IF NOT EXISTS simulation_resources (
        id TEXT NOT NULL,
        simulation_id TEXT NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        resource_type TEXT NOT NULL DEFAULT 'MUTEX',
        total_capacity INTEGER DEFAULT 1,
        available_units INTEGER DEFAULT 1,
        order_rank INTEGER DEFAULT 0,
        exclusive_holder TEXT,
        PRIMARY KEY (simulation_id, id)
    );

    CREATE TABLE IF NOT EXISTS simulation_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        simulation_id TEXT NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
        tick INTEGER NOT NULL,
        running_process_id TEXT,
        ready_queue_json TEXT NOT NULL,
        waiting_queue_json TEXT NOT NULL,
        terminated_json TEXT NOT NULL,
        gantt_state TEXT NOT NULL DEFAULT 'RUNNING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- ========================================================================
    -- 8. DISTRIBUTED WORKER COORDINATION & SCHEDULER LEASES
    -- ========================================================================
    CREATE TABLE IF NOT EXISTS workspace_scheduler_locks (
        workspace_id TEXT PRIMARY KEY,
        worker_id TEXT NOT NULL,
        locked_until TEXT NOT NULL,
        heartbeat_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- ========================================================================
    -- 9. WORKSPACE & GROUP INVITATIONS (QR Code & Deep Linking)
    -- ========================================================================
    CREATE TABLE IF NOT EXISTS workspace_invitations (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        code TEXT UNIQUE NOT NULL,
        created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'MEMBER',
        max_uses INTEGER NOT NULL DEFAULT 0,
        uses_count INTEGER NOT NULL DEFAULT 0,
        expires_at TIMESTAMP,
        revoked_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- ========================================================================
    -- 10. INDEXES FOR PERFORMANCE
    -- ========================================================================
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_memberships_user ON group_memberships(user_id);
    CREATE INDEX IF NOT EXISTS idx_ws_members_user ON workspace_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_channels_ws ON channels(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_messages_channel_created ON messages(channel_id, created_at ASC);
    CREATE INDEX IF NOT EXISTS idx_messages_convo_created ON messages(conversation_id, created_at ASC);
    CREATE INDEX IF NOT EXISTS idx_messages_client_id ON messages(client_msg_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_ws_status ON tasks(workspace_id, status);
    CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
    CREATE INDEX IF NOT EXISTS idx_simulations_group ON simulations(group_id);
    CREATE INDEX IF NOT EXISTS idx_processes_sim ON simulation_processes(simulation_id);
    CREATE INDEX IF NOT EXISTS idx_resources_sim ON simulation_resources(simulation_id);
    CREATE INDEX IF NOT EXISTS idx_history_sim_tick ON simulation_history(simulation_id, tick);
    CREATE INDEX IF NOT EXISTS idx_invitations_code ON workspace_invitations(code);
    CREATE INDEX IF NOT EXISTS idx_invitations_ws ON workspace_invitations(workspace_id);
    """

    if isinstance(conn, sqlite3.Connection):
        with conn:
            conn.executescript(schema_sql)
            _migrate_columns_sqlite(conn)
            _seed_defaults(conn)
        conn.close()
    else:
        # PostgreSQL execution
        try:
            with conn.cursor() as cur:
                pg_sql = schema_sql.replace("INTEGER PRIMARY KEY AUTOINCREMENT", "SERIAL PRIMARY KEY")
                cur.execute(pg_sql)
            _migrate_columns_postgres(conn)
            _seed_defaults(conn)
            if hasattr(conn, "commit"):
                conn.commit()
            conn.close()
        except Exception as e:
            logger.error(f"PostgreSQL schema init failed: {e}")


def _migrate_columns_postgres(conn: Any) -> None:
    """Ensures PostgreSQL tables receive newly introduced columns seamlessly."""
    migrations = [
        "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS arrival_time INTEGER NOT NULL DEFAULT 0;",
        "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS remaining_burst_ticks INTEGER NOT NULL DEFAULT 5;",
        "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_tick INTEGER;",
        "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completion_tick INTEGER;",
        "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS waiting_ticks INTEGER NOT NULL DEFAULT 0;",
        "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS turnaround_ticks INTEGER NOT NULL DEFAULT 0;",
        "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS response_ticks INTEGER NOT NULL DEFAULT 0;",
        "ALTER TABLE resources ADD COLUMN IF NOT EXISTS order_rank INTEGER NOT NULL DEFAULT 1;",
        "ALTER TABLE resources ADD COLUMN IF NOT EXISTS exclusive_holder TEXT;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT '';",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '';",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS status_message TEXT DEFAULT '';",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS presence_state TEXT NOT NULL DEFAULT 'OFFLINE';",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;",
        "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_info TEXT DEFAULT 'Desktop Web';",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'SENT';",
        # Clean up transient probe / test accounts from live Neon PostgreSQL
        "DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email IN ('probe_check@test.com', 'diag1@test.com') OR username IN ('test_diag_1', 'testuser_probe'));",
        "DELETE FROM workspace_members WHERE user_id IN (SELECT id FROM users WHERE email IN ('probe_check@test.com', 'diag1@test.com') OR username IN ('test_diag_1', 'testuser_probe'));",
        "DELETE FROM users WHERE email IN ('probe_check@test.com', 'diag1@test.com') OR username IN ('test_diag_1', 'testuser_probe');",
        # Auto-join all registered users to the primary collaboration workspace
        "INSERT INTO workspace_members (workspace_id, user_id, role) SELECT 'ws-core-engineering', id, 'MEMBER' FROM users ON CONFLICT DO NOTHING;",
    ]
    cur = conn.cursor()
    for sql in migrations:
        try:
            cur.execute(sql)
        except Exception as e:
            logger.warning(f"PostgreSQL column migration notice: {e}")


def _migrate_columns_sqlite(conn: sqlite3.Connection) -> None:
    """Ensures existing SQLite tables receive newly introduced columns seamlessly."""
    cursor = conn.cursor()
    try:
        cursor.execute("PRAGMA table_info(users)")
        cols = [r["name"] for r in cursor.fetchall()]
        if cols and "display_name" not in cols:
            conn.execute("ALTER TABLE users ADD COLUMN display_name TEXT NOT NULL DEFAULT ''")
        if cols and "avatar_url" not in cols:
            conn.execute("ALTER TABLE users ADD COLUMN avatar_url TEXT")
        if cols and "bio" not in cols:
            conn.execute("ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ''")
        if cols and "status_message" not in cols:
            conn.execute("ALTER TABLE users ADD COLUMN status_message TEXT DEFAULT ''")
        if cols and "presence_state" not in cols:
            conn.execute("ALTER TABLE users ADD COLUMN presence_state TEXT NOT NULL DEFAULT 'OFFLINE'")
        if cols and "last_seen_at" not in cols:
            conn.execute("ALTER TABLE users ADD COLUMN last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
        if cols and "updated_at" not in cols:
            conn.execute("ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")

        cursor.execute("PRAGMA table_info(sessions)")
        s_cols = [r["name"] for r in cursor.fetchall()]
        if s_cols and "device_info" not in s_cols:
            conn.execute("ALTER TABLE sessions ADD COLUMN device_info TEXT DEFAULT 'Desktop Web'")

        cursor.execute("PRAGMA table_info(tasks)")
        t_cols = [r["name"] for r in cursor.fetchall()]
        if t_cols:
            if "arrival_time" not in t_cols:
                conn.execute("ALTER TABLE tasks ADD COLUMN arrival_time INTEGER NOT NULL DEFAULT 0")
            if "remaining_burst_ticks" not in t_cols:
                conn.execute("ALTER TABLE tasks ADD COLUMN remaining_burst_ticks INTEGER NOT NULL DEFAULT 5")
            if "start_tick" not in t_cols:
                conn.execute("ALTER TABLE tasks ADD COLUMN start_tick INTEGER")
            if "completion_tick" not in t_cols:
                conn.execute("ALTER TABLE tasks ADD COLUMN completion_tick INTEGER")
            if "waiting_ticks" not in t_cols:
                conn.execute("ALTER TABLE tasks ADD COLUMN waiting_ticks INTEGER NOT NULL DEFAULT 0")
            if "turnaround_ticks" not in t_cols:
                conn.execute("ALTER TABLE tasks ADD COLUMN turnaround_ticks INTEGER NOT NULL DEFAULT 0")
            if "response_ticks" not in t_cols:
                conn.execute("ALTER TABLE tasks ADD COLUMN response_ticks INTEGER NOT NULL DEFAULT 0")

        cursor.execute("PRAGMA table_info(resources)")
        res_cols = [r["name"] for r in cursor.fetchall()]
        if res_cols:
            if "order_rank" not in res_cols:
                conn.execute("ALTER TABLE resources ADD COLUMN order_rank INTEGER NOT NULL DEFAULT 1")
            if "exclusive_holder" not in res_cols:
                conn.execute("ALTER TABLE resources ADD COLUMN exclusive_holder TEXT")
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS workspace_scheduler_locks (
                workspace_id TEXT PRIMARY KEY,
                worker_id TEXT NOT NULL,
                locked_until TEXT NOT NULL,
                heartbeat_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS workspace_invitations (
                id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
                code TEXT UNIQUE NOT NULL,
                created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                role TEXT NOT NULL DEFAULT 'MEMBER',
                max_uses INTEGER NOT NULL DEFAULT 0,
                uses_count INTEGER NOT NULL DEFAULT 0,
                expires_at TIMESTAMP,
                revoked_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_invitations_code ON workspace_invitations(code)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_invitations_ws ON workspace_invitations(workspace_id)")

        cursor.execute("PRAGMA table_info(messages)")
        msg_cols = [r["name"] for r in cursor.fetchall()]
        if msg_cols and "delivery_status" not in msg_cols:
            conn.execute("ALTER TABLE messages ADD COLUMN delivery_status TEXT NOT NULL DEFAULT 'SENT'")

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS message_receipts (
                id TEXT PRIMARY KEY,
                message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                receipt_type TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(message_id, user_id, receipt_type)
            )
            """
        )
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_receipts_msg ON message_receipts(message_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_receipts_user ON message_receipts(user_id)")
    except Exception as e:
        logger.warning(f"Column migration warning: {e}")


def acquire_workspace_lock(conn: Any, workspace_id: str, worker_id: str, ttl_seconds: float = 5.0) -> bool:
    """Attempts to acquire or renew a distributed scheduling lease for a workspace.
    
    Safe across multiple concurrent backend worker processes. Returns True if lease acquired.
    """
    now = datetime.now(timezone.utc)
    until = now + timedelta(seconds=ttl_seconds)
    now_iso = now.isoformat()
    until_iso = until.isoformat()

    cursor = conn.cursor()
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS workspace_scheduler_locks (
            workspace_id TEXT PRIMARY KEY,
            worker_id TEXT NOT NULL,
            locked_until TEXT NOT NULL,
            heartbeat_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    # 1. Try to renew existing lock if owned by this worker, or take over expired lock
    cursor.execute(
        """
        UPDATE workspace_scheduler_locks
        SET worker_id = ?, locked_until = ?, heartbeat_at = ?
        WHERE workspace_id = ? AND (worker_id = ? OR locked_until < ?)
        """,
        (worker_id, until_iso, now_iso, workspace_id, worker_id, now_iso),
    )
    if cursor.rowcount > 0:
        if hasattr(conn, "commit"):
            conn.commit()
        return True

    # 2. Try inserting new lock row if no row exists yet
    try:
        cursor.execute(
            """
            INSERT INTO workspace_scheduler_locks (workspace_id, worker_id, locked_until, heartbeat_at)
            VALUES (?, ?, ?, ?)
            """,
            (workspace_id, worker_id, until_iso, now_iso),
        )
        if hasattr(conn, "commit"):
            conn.commit()
        return True
    except Exception:
        # Another worker beat us to insert
        return False


def release_workspace_lock(conn: Any, workspace_id: str, worker_id: str) -> bool:
    """Releases a distributed lease if owned by this worker."""
    cursor = conn.cursor()
    cursor.execute(
        "DELETE FROM workspace_scheduler_locks WHERE workspace_id = ? AND worker_id = ?",
        (workspace_id, worker_id),
    )
    released = cursor.rowcount > 0
    if hasattr(conn, "commit"):
        conn.commit()
    return released


def run_migrations(db_path: Optional[str] = None) -> None:
    """Public migration entrypoint for CLI scripts and container startup."""
    init_db(db_path)


def _seed_defaults(conn: Any) -> None:
    """Seeds default users and primary workspace for instant multi-user exploration (skipped during pytest)."""
    if os.getenv("PYTEST_CURRENT_TEST"):
        return

    cursor = conn.cursor()

    # Seed Users
    dev_users = [
        ("usr-alice", "alice", "alice@vgarss.org", "Alice Cooper (Dev Lead)", "ONLINE"),
        ("usr-bob", "bob", "bob@vgarss.org", "Bob Smith (Systems Eng)", "ONLINE"),
        ("usr-charlie", "charlie", "charlie@vgarss.org", "Charlie Day (Kernel Dev)", "AWAY"),
    ]
    common_hash = hash_password("VgarssSecure2026!")

    for u_id, uname, email, dname, presence in dev_users:
        row = cursor.execute("SELECT id FROM users WHERE username = ?", (uname,)).fetchone()
        if not row:
            cursor.execute(
                """
                INSERT INTO users (id, username, email, password_hash, display_name, presence_state)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (u_id, uname, email, common_hash, dname, presence),
            )
        else:
            cursor.execute(
                "UPDATE users SET password_hash = ?, display_name = COALESCE(NULLIF(display_name, ''), ?), presence_state = ? WHERE id = ?",
                (common_hash, dname, presence, row["id"]),
            )

    alice_id = cursor.execute("SELECT id FROM users WHERE username = 'alice'").fetchone()["id"]
    bob_id = cursor.execute("SELECT id FROM users WHERE username = 'bob'").fetchone()["id"]
    charlie_id = cursor.execute("SELECT id FROM users WHERE username = 'charlie'").fetchone()["id"]

    # Seed Default Workspace & Channels
    ws_id = "ws-core-engineering"
    cursor.execute(
        """
        INSERT OR IGNORE INTO workspaces (id, name, slug, description, owner_id)
        VALUES (?, ?, ?, ?, ?)
        """,
        (ws_id, "VGARSS Core Engineering", "core-eng", "Main production workspace for OS simulation & network collaboration", alice_id),
    )
    # Also sync to virtual_groups for legacy views
    cursor.execute(
        """
        INSERT OR IGNORE INTO virtual_groups (id, name, description, owner_id)
        VALUES (?, ?, ?, ?)
        """,
        (ws_id, "VGARSS Core Engineering", "Main production workspace for OS simulation & network collaboration", alice_id),
    )

    # Add all 3 users as workspace members
    cursor.execute("INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'OWNER')", (ws_id, alice_id))
    cursor.execute("INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'ADMIN')", (ws_id, bob_id))
    cursor.execute("INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'MEMBER')", (ws_id, charlie_id))

    cursor.execute("INSERT OR IGNORE INTO group_memberships (group_id, user_id, role) VALUES (?, ?, 'ADMIN')", (ws_id, alice_id))
    cursor.execute("INSERT OR IGNORE INTO group_memberships (group_id, user_id, role) VALUES (?, ?, 'ADMIN')", (ws_id, bob_id))
    cursor.execute("INSERT OR IGNORE INTO group_memberships (group_id, user_id, role) VALUES (?, ?, 'MEMBER')", (ws_id, charlie_id))

    # Ensure all existing and newly registered users belong to the primary collaboration workspace
    cursor.execute("SELECT id FROM users")
    for u_row in cursor.fetchall():
        uid = u_row["id"] if isinstance(u_row, dict) or hasattr(u_row, "__getitem__") else u_row[0]
        cursor.execute("INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'MEMBER')", (ws_id, uid))
        cursor.execute("INSERT OR IGNORE INTO group_memberships (group_id, user_id, role) VALUES (?, ?, 'MEMBER')", (ws_id, uid))

    # Seed Default Channels
    channels = [
        ("chan-general", ws_id, "general", "Company-wide discussion and team updates", "TEXT"),
        ("chan-os-lab", ws_id, "os-scheduling-lab", "Real-time process scheduling, CPU burst logs, and Gantt charts", "SIMULATION"),
        ("chan-cn-net", ws_id, "cn-networking", "TCP Port 9000 packet framing and WebSocket telemetry monitoring", "TEXT"),
    ]
    for c_id, c_ws, c_name, c_topic, c_type in channels:
        cursor.execute(
            """
            INSERT OR IGNORE INTO channels (id, workspace_id, name, topic, channel_type, created_by)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (c_id, c_ws, c_name, c_topic, c_type, alice_id),
        )
        for u_id in [alice_id, bob_id, charlie_id]:
            cursor.execute("INSERT OR IGNORE INTO channel_members (channel_id, user_id) VALUES (?, ?)", (c_id, u_id))

    # Seed an initial message in #os-scheduling-lab
    cursor.execute(
        """
        INSERT OR IGNORE INTO messages (id, workspace_id, channel_id, sender_id, message_type, content, seq)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        ("msg-welcome-01", ws_id, "chan-os-lab", alice_id, "USER_TEXT", "Welcome to VGARSS 2.0! You can create collaborative tasks from messages and schedule them onto the CPU.", 1),
    )

    # Seed Default Workspace Resources
    resources = [
        ("res-mutex-gpu", ws_id, "GPU Matrix Accelerator", "MUTEX", 1, 1, "Exclusive high-performance tensor accelerator", 1),
        ("res-sem-io", ws_id, "DMA Channel Pool", "SEMAPHORE", 3, 3, "High-speed Direct Memory Access channels", 2),
        ("res-mutex-db", ws_id, "Kernel Page Lock", "MUTEX", 1, 1, "Shared memory translation lookaside buffer lock", 3),
    ]
    for r_id, r_ws, r_name, r_type, r_cap, r_avail, r_desc, r_rank in resources:
        cursor.execute(
            """
            INSERT OR IGNORE INTO resources (id, workspace_id, name, resource_type, total_capacity, available_units, description, order_rank)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (r_id, r_ws, r_name, r_type, r_cap, r_avail, r_desc, r_rank),
        )

    if hasattr(conn, "commit"):
        conn.commit()


def get_db() -> Generator[Any, None, None]:
    """FastAPI dependency yielding a thread-safe database connection per request."""
    conn = get_connection()
    try:
        yield conn
    finally:
        conn.close()
