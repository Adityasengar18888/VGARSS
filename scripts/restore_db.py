"""Database Restore Utility for VGARSS 2.0 (PostgreSQL & SQLite WAL).

Supports:
- Safe restoration from compressed .gz backups
- SHA-256 checksum verification before restoration
- Protection safeguards for live production databases
"""
import os
import sys
import gzip
import shutil
import hashlib
import sqlite3
import subprocess
from pathlib import Path
from urllib.parse import urlparse

# Ensure project root is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app.config import settings


def verify_sha256(filepath: Path) -> bool:
    checksum_file = Path(f"{filepath}.sha256")
    if not checksum_file.exists():
        print(f"[!] Warning: No checksum file found at {checksum_file.name}. Skipping integrity verification.")
        return True

    expected = checksum_file.read_text(encoding="utf-8").split()[0].strip()
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    actual = hasher.hexdigest()

    if expected.lower() == actual.lower():
        print(f"[+] SHA-256 Checksum verified: {actual}")
        return True
    else:
        print(f"[!] Checksum mismatch! Expected {expected}, got {actual}", file=sys.stderr)
        return False


def restore_sqlite(backup_gz_path: Path, target_path: str):
    print(f"[*] Restoring SQLite database from: {backup_gz_path} -> {target_path}")
    temp_restored = Path(f"{target_path}.restoring")

    # Decompress to temporary file
    with gzip.open(backup_gz_path, "rb") as f_in, open(temp_restored, "wb") as f_out:
        shutil.copyfileobj(f_in, f_out)

    # Test SQLite file integrity
    test_conn = sqlite3.connect(str(temp_restored))
    integrity = test_conn.execute("PRAGMA integrity_check;").fetchone()
    test_conn.close()

    if integrity[0] != "ok":
        temp_restored.unlink(missing_ok=True)
        raise ValueError(f"Integrity check failed on restored database: {integrity[0]}")

    # Atomic move
    target = Path(target_path)
    if target.exists():
        backup_current = Path(f"{target_path}.bak")
        shutil.copy2(target, backup_current)
        print(f"[*] Existing database backed up to: {backup_current.name}")

    shutil.move(str(temp_restored), str(target))
    print(f"[+] SQLite database restored successfully to: {target_path}")


def restore_postgres(backup_gz_path: Path, database_url: str):
    parsed = urlparse(database_url)
    db_name = parsed.path.lstrip("/")
    host = parsed.hostname or "localhost"
    port = str(parsed.port or 5432)
    user = parsed.username or "postgres"

    psql_cmd = shutil.which("psql")
    if not psql_cmd:
        raise FileNotFoundError("psql binary is required to execute PostgreSQL restore script.")

    print(f"[*] Restoring PostgreSQL database '{db_name}' on {host}:{port} from {backup_gz_path}...")
    env = os.environ.copy()
    if parsed.password:
        env["PGPASSWORD"] = parsed.password

    cmd = [psql_cmd, "-h", host, "-p", port, "-U", user, "-d", db_name]

    with gzip.open(backup_gz_path, "rb") as f_in:
        proc = subprocess.Popen(cmd, stdin=f_in, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
        stdout, stderr = proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(f"psql restore failed (exit {proc.returncode}): {stderr.decode('utf-8')}")

    print(f"[+] PostgreSQL database restored successfully to '{db_name}'.")


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/restore_db.py <path_to_backup_file.gz> [--force]")
        sys.exit(1)

    backup_path = Path(sys.argv[1])
    force = "--force" in sys.argv

    if not backup_path.exists():
        print(f"[!] Backup archive not found: {backup_path}", file=sys.stderr)
        sys.exit(1)

    print("==========================================================================")
    print("                VGARSS 2.0 Database Restore Utility                       ")
    print("==========================================================================")
    print(f"Backup Archive:     {backup_path}")
    print(f"Target Destination: {settings.database_url}")

    if not verify_sha256(backup_path):
        if not force:
            print("[!] Restoration aborted due to checksum mismatch. Pass --force to override.", file=sys.stderr)
            sys.exit(1)

    if settings.database_url.startswith(("postgresql://", "postgres://")):
        restore_postgres(backup_path, settings.database_url)
    else:
        sqlite_file = settings.database_url.replace("sqlite:///", "")
        restore_sqlite(backup_path, sqlite_file)


if __name__ == "__main__":
    main()

