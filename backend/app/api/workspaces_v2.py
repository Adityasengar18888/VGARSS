"""Workspaces, Memberships & RBAC REST Router (VGARSS 2.0)."""
import uuid
import re
import asyncio
from datetime import datetime, timezone
import sqlite3
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status

from backend.app.database import get_db
from backend.app.api.deps import get_current_user
from backend.app.schemas.chat_v2 import (
    WorkspaceCreate,
    WorkspaceResponse,
    WorkspaceMemberAdd,
    WorkspaceMemberResponse,
)
from backend.app.network.chat_hub import chat_hub

router = APIRouter(prefix="/api/v2/workspaces", tags=["Workspaces V2"])


def slugify(text: str) -> str:
    """Generates a clean URL slug from a workspace name."""
    s = text.lower().strip()
    s = re.sub(r"[^\w\s-]", "", s)
    return re.sub(r"[\s_-]+", "-", s)[:50]


def check_workspace_membership(db: sqlite3.Connection, workspace_id: str, user_id: str) -> dict:
    """Verifies user membership in the workspace. Returns membership record or raises 403."""
    cursor = db.execute(
        """
        SELECT m.role, w.id AS workspace_id, w.name, w.owner_id
        FROM workspace_members m
        JOIN workspaces w ON m.workspace_id = w.id
        WHERE m.workspace_id = ? AND m.user_id = ?
        """,
        (workspace_id, user_id),
    )
    row = cursor.fetchone()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You are not a member of this workspace.",
        )
    return dict(row)


@router.get("", response_model=List[WorkspaceResponse])
def list_workspaces(
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Lists all workspaces accessible to the authenticated user."""
    cursor = db.execute(
        """
        SELECT w.id, w.name, w.slug, w.description, w.icon_url, w.owner_id, w.created_at, m.role
        FROM workspaces w
        JOIN workspace_members m ON w.id = m.workspace_id
        WHERE m.user_id = ?
        ORDER BY w.created_at DESC
        """,
        (current_user["id"],),
    )
    rows = cursor.fetchall()
    results = []
    for r in rows:
        results.append(
            WorkspaceResponse(
                id=r["id"],
                name=r["name"],
                slug=r["slug"],
                description=r["description"] or "",
                icon_url=r["icon_url"],
                owner_id=r["owner_id"],
                role=r["role"],
                unread_count=0,
                created_at=str(r["created_at"]),
            )
        )
    return results


@router.post("", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
def create_workspace(
    payload: WorkspaceCreate,
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Creates a new workspace, seeds default channels, and assigns creator as OWNER."""
    ws_id = str(uuid.uuid4())
    slug = payload.slug or f"{slugify(payload.name)}-{ws_id[:6]}"

    # Ensure slug uniqueness
    cursor = db.execute("SELECT id FROM workspaces WHERE slug = ?", (slug,))
    if cursor.fetchone():
        slug = f"{slug}-{uuid.uuid4().hex[:4]}"

    with db:
        # Create workspace
        db.execute(
            """
            INSERT INTO workspaces (id, name, slug, description, icon_url, owner_id)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (ws_id, payload.name, slug, payload.description or "", payload.icon_url, current_user["id"]),
        )
        # Add creator as OWNER
        db.execute(
            "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'OWNER')",
            (ws_id, current_user["id"]),
        )

        # Sync with legacy virtual_groups table for backward-compatible simulation tools
        db.execute(
            "INSERT OR IGNORE INTO virtual_groups (id, name, description, owner_id) VALUES (?, ?, ?, ?)",
            (ws_id, payload.name, payload.description or "", current_user["id"]),
        )
        db.execute(
            "INSERT OR IGNORE INTO group_memberships (group_id, user_id, role) VALUES (?, ?, 'ADMIN')",
            (ws_id, current_user["id"]),
        )

        # Create default channels
        default_channels = [
            ("general", "Company-wide announcements & discussion", "TEXT"),
            ("os-scheduling-lab", "Process scheduling, Gantt telemetry, and CPU metrics", "SIMULATION"),
            ("cn-networking", "TCP Socket Port 9000 & WebSocket event diagnostics", "TEXT"),
        ]
        for c_name, c_topic, c_type in default_channels:
            c_id = str(uuid.uuid4())
            db.execute(
                """
                INSERT INTO channels (id, workspace_id, name, topic, channel_type, created_by)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (c_id, ws_id, c_name, c_topic, c_type, current_user["id"]),
            )
            db.execute(
                "INSERT INTO channel_members (channel_id, user_id) VALUES (?, ?)",
                (c_id, current_user["id"]),
            )

    return WorkspaceResponse(
        id=ws_id,
        name=payload.name,
        slug=slug,
        description=payload.description or "",
        icon_url=payload.icon_url,
        owner_id=current_user["id"],
        role="OWNER",
        unread_count=0,
        created_at="now",
    )


@router.get("/{workspace_id}/members", response_model=List[WorkspaceMemberResponse])
def list_workspace_members(
    workspace_id: str,
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Lists all members of a workspace, their roles, and live online presence state."""
    check_workspace_membership(db, workspace_id, current_user["id"])

    cursor = db.execute(
        """
        SELECT u.id, u.username, u.display_name, u.avatar_url, u.presence_state, u.status_message, m.role, m.joined_at
        FROM workspace_members m
        JOIN users u ON m.user_id = u.id
        WHERE m.workspace_id = ?
        ORDER BY 
            CASE m.role WHEN 'OWNER' THEN 1 WHEN 'ADMIN' THEN 2 ELSE 3 END,
            u.username ASC
        """,
        (workspace_id,),
    )
    rows = cursor.fetchall()
    online_user_ids = set(chat_hub.get_online_users(workspace_id))

    results = []
    for r in rows:
        is_online = r["id"] in online_user_ids or r["presence_state"] == "ONLINE"
        results.append(
            WorkspaceMemberResponse(
                user_id=r["id"],
                username=r["username"],
                display_name=r["display_name"] or r["username"],
                avatar_url=r["avatar_url"],
                role=r["role"],
                presence_state="ONLINE" if is_online else (r["presence_state"] or "OFFLINE"),
                status_message=r["status_message"] or "",
                joined_at=str(r["joined_at"]),
            )
        )
    return results


@router.post("/{workspace_id}/members", response_model=WorkspaceMemberResponse, status_code=status.HTTP_201_CREATED)
def add_workspace_member(
    workspace_id: str,
    payload: WorkspaceMemberAdd,
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Adds a member to the workspace. Requires caller to be OWNER or ADMIN."""
    caller_mem = check_workspace_membership(db, workspace_id, current_user["id"])
    if caller_mem["role"] not in ("OWNER", "ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied: Only OWNER or ADMIN may add workspace members.",
        )

    # Find target user
    cursor = db.execute(
        "SELECT id, username, display_name, avatar_url, presence_state, status_message FROM users WHERE username = ?",
        (payload.username,),
    )
    target_user = cursor.fetchone()
    if not target_user:
        raise HTTPException(status_code=404, detail=f"User '{payload.username}' does not exist.")

    target_id = target_user["id"]

    # Check if already a member
    cursor = db.execute(
        "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?",
        (workspace_id, target_id),
    )
    if cursor.fetchone():
        raise HTTPException(status_code=400, detail="User is already a member of this workspace.")

    with db:
        db.execute(
            "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)",
            (workspace_id, target_id, payload.role),
        )
        # Also auto-join all public channels in workspace
        cursor = db.execute("SELECT id FROM channels WHERE workspace_id = ? AND is_private = 0", (workspace_id,))
        for ch in cursor.fetchall():
            db.execute("INSERT OR IGNORE INTO channel_members (channel_id, user_id) VALUES (?, ?)", (ch["id"], target_id))

        # Sync to group_memberships
        db.execute("INSERT OR IGNORE INTO group_memberships (group_id, user_id, role) VALUES (?, ?, 'MEMBER')", (workspace_id, target_id))

    # Notify target user session in real-time
    ws_row = db.execute("SELECT name FROM workspaces WHERE id = ?", (workspace_id,)).fetchone()
    ws_name = ws_row["name"] if ws_row else "Workspace"
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(chat_hub.broadcast_to_user(
            target_id,
            {
                "type": "WORKSPACE_ADDED",
                "workspace_id": workspace_id,
                "workspace_name": ws_name,
                "role": payload.role,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        ))
    except Exception:
        pass

    return WorkspaceMemberResponse(
        user_id=target_id,
        username=target_user["username"],
        display_name=target_user["display_name"] or target_user["username"],
        avatar_url=target_user["avatar_url"],
        role=payload.role,
        presence_state=target_user["presence_state"] or "OFFLINE",
        status_message=target_user["status_message"] or "",
        joined_at="now",
    )

