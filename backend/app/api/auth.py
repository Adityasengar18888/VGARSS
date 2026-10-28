"""Authentication & User REST Endpoints."""
import uuid
import sqlite3
from fastapi import APIRouter, Depends, HTTPException, status
from backend.app.database import get_db
from backend.app.security import hash_password, verify_password, generate_session_token
from backend.app.schemas.auth import UserRegister, UserLogin, UserResponse, TokenResponse
from backend.app.api.deps import get_current_user

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister, db: sqlite3.Connection = Depends(get_db)):
    """Registers a new user, hashes password with PBKDF2 salt, and creates a session token."""
    # Check if username or email already exists
    cursor = db.execute(
        "SELECT id FROM users WHERE username = ? OR email = ?",
        (payload.username, payload.email),
    )
    if cursor.fetchone():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this username or email already exists.",
        )

    user_id = str(uuid.uuid4())
    pw_hash = hash_password(payload.password)

    with db:
        db.execute(
            "INSERT INTO users (id, username, email, password_hash) VALUES (?, ?, ?, ?)",
            (user_id, payload.username, payload.email, pw_hash),
        )
        token, expires_at = generate_session_token()
        db.execute(
            "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
            (token, user_id, expires_at.isoformat()),
        )

    user_resp = UserResponse(
        id=user_id,
        username=payload.username,
        email=payload.email,
        created_at=str(expires_at),
    )
    return TokenResponse(token=token, expires_at=expires_at.isoformat(), user=user_resp)


@router.post("/login", response_model=TokenResponse)
def login(payload: UserLogin, db: sqlite3.Connection = Depends(get_db)):
    """Verifies credentials and returns a new session token."""
    cursor = db.execute(
        "SELECT id, username, email, password_hash, created_at FROM users WHERE username = ?",
        (payload.username,),
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

    user_resp = UserResponse(
        id=user_id,
        username=row["username"],
        email=row["email"],
        created_at=str(row["created_at"]),
    )
    return TokenResponse(token=token, expires_at=expires_at.isoformat(), user=user_resp)


@router.get("/me", response_model=UserResponse)
def get_me(current_user: dict = Depends(get_current_user)):
    """Retrieves authenticated user profile. Password hash is never exposed."""
    return UserResponse(**current_user)


@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Logs out by invalidating active sessions."""
    with db:
        db.execute("DELETE FROM sessions WHERE user_id = ?", (current_user["id"],))
    return {"message": "Successfully logged out."}
