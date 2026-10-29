"""Database Backup Utility for VGARSS 2.0 (PostgreSQL & SQLite WAL).

Supports:
- PostgreSQL remote/managed backups via pg_dump
- SQLite WAL zero-downtime hot backups via sqlite3 backup API
- Gzip compression with SHA-256 integrity checksum generation
"""
import os
import sys
import gzip
import shutil
import hashlib
import sqlite3
import datetime
import subprocess
from pathlib import Path
from urllib.parse import urlparse

# Ensure project root is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app.config import settings

BACKUP_DIR = Path("backups")


def calculate_sha256(filepath: Path) -> str:
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def backup_sqlite(source_path: str, dest_dir: Path) -> Path:
    timestamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d_%H%M%S")
    raw_backup_file = dest_dir / f"vgarss_sqlite_{timestamp}.db"
    gz_backup_file = dest_dir / f"vgarss_sqlite_{timestamp}.db.gz"

    print(f"[*] Starting SQLite hot backup from: {source_path}")
    source_conn = sqlite3.connect(source_path)
    dest_conn = sqlite3.connect(str(raw_backup_file))
    with dest_conn:
        source_conn.backup(dest_conn, pages=100)
    dest_conn.close()
    source_conn.close()

    # Compress with gzip
    print(f"[*] Compressing backup to: {gz_backup_file.name}")
    with open(raw_backup_file, "rb") as f_in, gzip.open(gz_backup_file, "wb", compresslevel=9) as f_out:
        shutil.copyfileobj(f_in, f_out)

    # Clean up raw uncompressed copy
    raw_backup_file.unlink()

    checksum = calculate_sha256(gz_backup_file)
    checksum_file = dest_dir / f"{gz_backup_file.name}.sha256"
    checksum_file.write_text(f"{checksum}  {gz_backup_file.name}\n", encoding="utf-8")

    size_kb = gz_backup_file.stat().st_size / 1024
    print(f"[+] SQLite backup completed successfully: {gz_backup_file} ({size_kb:.2f} KB)")
    print(f"    SHA-256: {checksum}")
    return gz_backup_file


def backup_postgres(database_url: str, dest_dir: Path) -> Path:
    timestamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d_%H%M%S")
    gz_backup_file = dest_dir / f"vgarss_postgres_{timestamp}.sql.gz"

    parsed = urlparse(database_url)
    db_name = parsed.path.lstrip("/")
    host = parsed.hostname or "localhost"
    port = str(parsed.port or 5432)
    user = parsed.username or "postgres"

    print(f"[*] Executing pg_dump for PostgreSQL database '{db_name}' on {host}:{port}...")

    env = os.environ.copy()
    if parsed.password:
        env["PGPASSWORD"] = parsed.password

    # Check for pg_dump availability
    pg_dump_cmd = shutil.which("pg_dump")
    if not pg_dump_cmd:
        print("[!] Warning: 'pg_dump' utility not found in PATH.")
        print("    If running against remote PostgreSQL without pg_dump locally, use your managed provider's")
        print("    snapshot tool (Neon / Render / Supabase) or install PostgreSQL Client Tools.")
        raise FileNotFoundError("pg_dump binary is required for direct PostgreSQL logical dump.")

    cmd = [
        pg_dump_cmd,
        "-h", host,
        "-p", port,
        "-U", user,
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-acl",
        db_name,
    ]

    with gzip.open(gz_backup_file, "wb", compresslevel=9) as f_out:
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
        stdout, stderr = proc.communicate()
        if proc.returncode != 0:
            if gz_backup_file.exists():
                gz_backup_file.unlink()
            raise RuntimeError(f"pg_dump failed (exit {proc.returncode}): {stderr.decode('utf-8')}")
        f_out.write(stdout)

    checksum = calculate_sha256(gz_backup_file)
    checksum_file = dest_dir / f"{gz_backup_file.name}.sha256"
    checksum_file.write_text(f"{checksum}  {gz_backup_file.name}\n", encoding="utf-8")

    size_kb = gz_backup_file.stat().st_size / 1024
    print(f"[+] PostgreSQL backup completed successfully: {gz_backup_file} ({size_kb:.2f} KB)")
    print(f"    SHA-256: {checksum}")
    return gz_backup_file


def main():
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    db_url = settings.database_url
    print("==========================================================================")
    print("                VGARSS 2.0 Database Backup Utility                        ")
    print("==========================================================================")
    print(f"Target Database URL: {db_url.split('@')[-1] if '@' in db_url else db_url}")

    if db_url.startswith(("postgresql://", "postgres://")):
        try:
            backup_postgres(db_url, BACKUP_DIR)
        except Exception as e:
            print(f"[!] PostgreSQL backup error: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        sqlite_file = settings.database_url.replace("sqlite:///", "")
        if not os.path.exists(sqlite_file):
            print(f"[!] SQLite database file not found at: {sqlite_file}", file=sys.stderr)
            sys.exit(1)
        backup_sqlite(sqlite_file, BACKUP_DIR)


if __name__ == "__main__":
    main()
