"""SQLite Persistence Layer with WAL Mode, Foreign Keys, Constraints & Indexing."""
import sqlite3
import os
from typing import Generator
from backend.app.config import settings

# Extract file path from sqlite:/// URI
def get_db_path() -> str:
    url = settings.database_url
    if url.startswith("sqlite:///"):
        return url.replace("sqlite:///", "")
    return url


def get_connection(db_path: str = None) -> sqlite3.Connection:
    """Creates an optimized SQLite connection with foreign keys and WAL mode enabled."""
    target_path = db_path if db_path is not None else get_db_path()
    
    # Ensure directory exists if needed
    dir_name = os.path.dirname(target_path)
    if dir_name and not os.path.exists(dir_name):
        os.makedirs(dir_name, exist_ok=True)

    conn = sqlite3.connect(target_path, check_same_thread=False, timeout=30.0)
    conn.row_factory = sqlite3.Row

    # Performance and integrity pragmas
    conn.execute("PRAGMA foreign_keys = ON;")
    if target_path != ":memory:":
        conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    return conn


def init_db(db_path: str = None) -> None:
    """Initializes tables, constraints, foreign keys, and indexes."""
    conn = get_connection(db_path)
    with conn:
        conn.executescript("""
        -- 1. Users Table
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- 2. Sessions Table (for Token-based Authentication)
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- 3. Virtual Groups Table (Isolation Boundaries)
        CREATE TABLE IF NOT EXISTS virtual_groups (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- 4. Group Memberships (Multi-user collaboration & RBAC)
        CREATE TABLE IF NOT EXISTS group_memberships (
            group_id TEXT NOT NULL REFERENCES virtual_groups(id) ON DELETE CASCADE,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            role TEXT NOT NULL DEFAULT 'MEMBER', -- 'ADMIN', 'MEMBER', 'VIEWER'
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (group_id, user_id)
        );

        -- 5. Simulation Runs Table
        CREATE TABLE IF NOT EXISTS simulations (
            id TEXT PRIMARY KEY,
            group_id TEXT NOT NULL REFERENCES virtual_groups(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            algorithm TEXT NOT NULL,             -- 'FCFS', 'SJF', 'SRTF', 'ROUND_ROBIN', 'PRIORITY'
            time_quantum INTEGER DEFAULT 2,
            aging_interval INTEGER,
            is_preemptive INTEGER DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'INITIALIZED', -- 'INITIALIZED', 'RUNNING', 'PAUSED', 'COMPLETED'
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

        -- 6. Simulation Processes (Process Control Blocks)
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

        -- 7. Simulation Shared Resources
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

        -- 8. Simulation Tick Timeline & History
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

        -- Indexes for High-Frequency Queries
        CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_memberships_user ON group_memberships(user_id);
        CREATE INDEX IF NOT EXISTS idx_simulations_group ON simulations(group_id);
        CREATE INDEX IF NOT EXISTS idx_processes_sim ON simulation_processes(simulation_id);
        CREATE INDEX IF NOT EXISTS idx_resources_sim ON simulation_resources(simulation_id);
        CREATE INDEX IF NOT EXISTS idx_history_sim_tick ON simulation_history(simulation_id, tick);
        """)
    conn.close()


def get_db() -> Generator[sqlite3.Connection, None, None]:
    """FastAPI dependency yielding a thread-safe SQLite connection per request."""
    conn = get_connection()
    try:
        yield conn
    finally:
        conn.close()
