"""Cryptographic Security, Password Hashing & Session Token Utilities.

Supports standard bcrypt password hashing with unique salt prefixes and backward-compatible verification.
"""
import os
import hashlib
import secrets
import datetime
from typing import Tuple
import bcrypt

PBKDF2_ITERATIONS = 100_000
SESSION_EXPIRY_HOURS = 24


def hash_password(password: str) -> str:
    """Securely hashes a plaintext password using bcrypt with a unique salt tracking prefix."""
    if not password:
        raise ValueError("Password cannot be empty.")
    salt_hex = secrets.token_hex(16)
    salt_bcrypt = bcrypt.gensalt(rounds=12)
    hashed_bcrypt = bcrypt.hashpw(password.encode("utf-8"), salt_bcrypt).decode("utf-8")
    return f"{salt_hex}:{hashed_bcrypt}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plaintext password against a stored bcrypt or legacy pbkdf2 hash."""
    if not plain_password or not hashed_password:
        return False
    try:
        if ":" in hashed_password:
            salt_hex, key = hashed_password.split(":", 1)
            # Bcrypt hash verification
            if key.startswith(("$2a$", "$2b$", "$2y$")):
                return bcrypt.checkpw(plain_password.encode("utf-8"), key.encode("utf-8"))
            
            # Legacy PBKDF2 hash verification
            check_key = hashlib.pbkdf2_hmac(
                "sha256",
                plain_password.encode("utf-8"),
                bytes.fromhex(salt_hex),
                PBKDF2_ITERATIONS,
            ).hex()
            return secrets.compare_digest(key, check_key)
        
        # Raw bcrypt hash without prefix
        if hashed_password.startswith(("$2a$", "$2b$", "$2y$")):
            return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
            
        return False
    except Exception:
        return False


def generate_session_token() -> Tuple[str, datetime.datetime]:
    """Generates a cryptographically strong session token and expiration timestamp."""
    token = secrets.token_urlsafe(32)
    expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=SESSION_EXPIRY_HOURS)
    return token, expires_at
