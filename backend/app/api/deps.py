"""FastAPI Dependency Injection Providers."""
import sqlite3
import datetime
from typing import Optional
from fastapi import Depends, HTTPException, Security, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from backend.app.database import get_db

security_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_bearer),
    token: Optional[str] = None,
    db: sqlite3.Connection = Depends(get_db),
) -> dict:
    """Authenticates user via Bearer token, HttpOnly cookie, or query parameter. Never exposes password hash."""
    session_token = None
    if credentials and credentials.credentials:
        session_token = credentials.credentials
    elif token:
        session_token = token
    elif request.cookies.get("vgarss_session"):
        session_token = request.cookies.get("vgarss_session")

    if not session_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    cursor = db.execute(
        """
        SELECT u.id, u.username, u.email, u.created_at, s.expires_at
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = ?
        """,
        (session_token,),
    )
    row = cursor.fetchone()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check expiration
    expires_raw = row["expires_at"]
    if isinstance(expires_raw, datetime.datetime):
        expires_at = expires_raw
    else:
        expires_str = str(expires_raw)
        try:
            expires_at = datetime.datetime.fromisoformat(expires_str)
        except Exception:
            # Fallback ISO parser
            expires_at = datetime.datetime.strptime(expires_str.split(".")[0], "%Y-%m-%d %H:%M:%S")

    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=datetime.timezone.utc)

    if datetime.datetime.now(datetime.timezone.utc) > expires_at:
        db.execute("DELETE FROM sessions WHERE token = ?", (session_token,))
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return {
        "id": row["id"],
        "username": row["username"],
        "email": row["email"],
        "created_at": str(row["created_at"]),
    }


def require_group_access(
    group_id: str,
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
) -> dict:
    """Enforces Virtual Group authorization boundary. Rejects cross-group unauthorized access."""
    cursor = db.execute("SELECT * FROM virtual_groups WHERE id = ?", (group_id,))
    group = cursor.fetchone()
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Virtual group '{group_id}' does not exist.",
        )

    # Check if user is group owner
    if group["owner_id"] == current_user["id"]:
        return dict(group)

    # Check if user is a member
    mem_cursor = db.execute(
        "SELECT role FROM group_memberships WHERE group_id = ? AND user_id = ?",
        (group_id, current_user["id"]),
    )
    membership = mem_cursor.fetchone()
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You are not a member of this virtual group.",
        )

    group_dict = dict(group)
    group_dict["user_role"] = membership["role"]
    return group_dict
