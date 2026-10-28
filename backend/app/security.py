"""Cryptographic Security, Password Hashing & Session Token Utilities."""
import os
import hashlib
import secrets
import datetime
from typing import Tuple

PBKDF2_ITERATIONS = 100_000
SESSION_EXPIRY_HOURS = 24


def hash_password(password: str) -> str:
    """Securely hashes a plaintext password using PBKDF2 HMAC SHA-256 with a unique salt."""
    if not password:
        raise ValueError("Password cannot be empty.")
    salt = os.urandom(16).hex()
    key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        bytes.fromhex(salt),
        PBKDF2_ITERATIONS,
    ).hex()
    return f"{salt}:{key}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plaintext password against a stored salt:key hash using constant-time comparison."""
    if not plain_password or not hashed_password:
        return False
    try:
        salt, key = hashed_password.split(":", 1)
        check_key = hashlib.pbkdf2_hmac(
            "sha256",
            plain_password.encode("utf-8"),
            bytes.fromhex(salt),
            PBKDF2_ITERATIONS,
        ).hex()
        return secrets.compare_digest(key, check_key)
    except Exception:
        return False


def generate_session_token() -> Tuple[str, datetime.datetime]:
    """Generates a cryptographically strong session token and expiration timestamp."""
    token = secrets.token_urlsafe(32)
    expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=SESSION_EXPIRY_HOURS)
    return token, expires_at
