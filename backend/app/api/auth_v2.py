"""Authentication, User Profile & Presence REST Router (VGARSS 2.0)."""
import uuid
import sqlite3
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Response, Request, status
from pydantic import BaseModel, Field

from backend.app.config import settings
from backend.app.database import get_db
from backend.app.security import hash_password, verify_password, generate_session_token
from backend.app.api.deps import get_current_user
from backend.app.schemas.auth import UserRegister, UserLogin, TokenResponse, UserResponse
from backend.app.schemas.chat_v2 import UserPresenceUpdate, UserProfileResponse
from backend.app.network.chat_hub import chat_hub

router = APIRouter(prefix="/api/v2/auth", tags=["Auth V2"])


class DevSwitchRequest(BaseModel):
    username: str = Field(..., description="Target username ('alice', 'bob', 'charlie')")


def _set_auth_cookie(response: Response, token: str, max_age: int = 86400):
    """Sets a secure, HttpOnly session cookie."""
    is_prod = settings.environment.lower() == "production"
    response.set_cookie(
        key="vgarss_session",
        value=token,
        max_age=max_age,
        httponly=True,
        samesite="lax",
        secure=is_prod,
        path="/",
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister, response: Response, db: sqlite3.Connection = Depends(get_db)):
    """Registers a new user account with bcrypt password hashing and creates an initial session."""
    normalized_email = payload.email.strip().lower()
    normalized_username = payload.username.strip()

    cursor = db.execute("SELECT id FROM users WHERE username = ? OR email = ?", (normalized_username, normalized_email))
    if cursor.fetchone():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this username or email already exists.",
        )

    user_id = str(uuid.uuid4())
    pw_hash = hash_password(payload.password)
    display_name = normalized_username.replace("_", " ").title()

    with db:
        db.execute(
            """
            INSERT INTO users (id, username, email, password_hash, display_name, presence_state)
            VALUES (?, ?, ?, ?, ?, 'ONLINE')
            """,
            (user_id, normalized_username, normalized_email, pw_hash, display_name),
        )
        token, expires_at = generate_session_token()
        db.execute(
            "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
            (token, user_id, expires_at.isoformat()),
        )

    _set_auth_cookie(response, token)

    user_resp = UserResponse(
        id=user_id,
        username=normalized_username,
        email=normalized_email,
        created_at=str(expires_at),
    )
    return TokenResponse(token=token, expires_at=expires_at.isoformat(), user=user_resp)


@router.post("/login", response_model=TokenResponse)
def login(payload: UserLogin, response: Response, db: sqlite3.Connection = Depends(get_db)):
    """Verifies credentials with bcrypt and returns an active session token."""
    login_target = payload.username.strip()
    cursor = db.execute(
        "SELECT id, username, email, password_hash, created_at FROM users WHERE username = ? OR email = ?",
        (login_target, login_target.lower()),
    )
    row = cursor.fetchone()

    if not row or not verify_password(payload.password, row["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = row["id"]
    token, expires_at = generate_session_token()

    with db:
        db.execute(
            "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
            (token, user_id, expires_at.isoformat()),
        )
        db.execute("UPDATE users SET presence_state = 'ONLINE' WHERE id = ?", (user_id,))

    _set_auth_cookie(response, token)

    user_resp = UserResponse(
        id=user_id,
        username=row["username"],
        email=row["email"],
        created_at=str(row["created_at"]),
    )
    return TokenResponse(token=token, expires_at=expires_at.isoformat(), user=user_resp)


@router.get("/me", response_model=UserProfileResponse)
def get_me(
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Returns the authenticated user's profile and live presence state."""
    cursor = db.execute(
        "SELECT id, username, email, display_name, avatar_url, bio, status_message, presence_state, last_seen_at FROM users WHERE id = ?",
        (current_user["id"],),
    )
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User profile not found.")

    return UserProfileResponse(
        id=row["id"],
        username=row["username"],
        email=row["email"],
        display_name=row["display_name"] or row["username"],
        avatar_url=row["avatar_url"],
        bio=row["bio"] or "",
        status_message=row["status_message"] or "",
        presence_state=row["presence_state"] or "ONLINE",
        last_seen_at=str(row["last_seen_at"]),
    )


@router.patch("/presence")
async def update_presence(
    payload: UserPresenceUpdate,
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Updates the user's presence status and broadcasts the change via WebSocket."""
    with db:
        db.execute(
            "UPDATE users SET presence_state = ?, status_message = COALESCE(?, status_message) WHERE id = ?",
            (payload.presence_state, payload.status_message, current_user["id"]),
        )
    await chat_hub.broadcast_presence(current_user["id"], payload.presence_state)
    return {"status": "ok", "presence_state": payload.presence_state}


@router.post("/logout")
def logout(
    response: Response,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Revokes the current session token and deletes authentication cookies."""
    # Find session token from header or cookie
    auth_header = request.headers.get("Authorization", "")
    session_token = auth_header.replace("Bearer ", "").strip() if "Bearer " in auth_header else request.cookies.get("vgarss_session")

    with db:
        if session_token:
            db.execute("DELETE FROM sessions WHERE token = ?", (session_token,))
        db.execute("UPDATE users SET presence_state = 'OFFLINE' WHERE id = ?", (current_user["id"],))

    response.delete_cookie(key="vgarss_session", path="/")
    return {"status": "logged_out"}


@router.post("/dev-switch", response_model=TokenResponse)
def dev_switch_user(payload: DevSwitchRequest, response: Response, db: sqlite3.Connection = Depends(get_db)):
    """One-click developer identity switcher for multi-client testing (Alice, Bob, Charlie)."""
    cursor = db.execute("SELECT id, username, email, created_at FROM users WHERE username = ?", (payload.username,))
    row = cursor.fetchone()
    if not row:
        # Auto-create if somehow missing
        u_id = f"usr-{payload.username}"
        pw_hash = hash_password("VgarssSecure2026!")
        d_name = payload.username.replace("_", " ").title()
        with db:
            db.execute(
                "INSERT INTO users (id, username, email, password_hash, display_name, presence_state) VALUES (?, ?, ?, ?, ?, 'ONLINE')",
                (u_id, payload.username, f"{payload.username}@vgarss.org", pw_hash, d_name),
            )
        row = {"id": u_id, "username": payload.username, "email": f"{payload.username}@vgarss.org", "created_at": "now"}

    user_id = row["id"]
    token, expires_at = generate_session_token()

    with db:
        db.execute(
            "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
            (token, user_id, expires_at.isoformat()),
        )
        db.execute("UPDATE users SET presence_state = 'ONLINE' WHERE id = ?", (user_id,))

    _set_auth_cookie(response, token)

    user_resp = UserResponse(
        id=user_id,
        username=row["username"],
        email=row["email"],
        created_at=str(row["created_at"]),
    )
    return TokenResponse(token=token, expires_at=expires_at.isoformat(), user=user_resp)

