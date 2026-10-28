"""Virtual Groups REST Router & RBAC Management."""
import uuid
import sqlite3
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from backend.app.database import get_db
from backend.app.api.deps import get_current_user, require_group_access
from backend.app.schemas.groups import (
    VirtualGroupCreate,
    VirtualGroupResponse,
    GroupMemberAdd,
    GroupMemberResponse,
)

router = APIRouter(prefix="/api/v1/groups", tags=["Virtual Groups"])


@router.get("", response_model=List[VirtualGroupResponse])
def list_groups(
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Lists all Virtual Groups accessible to the authenticated user (owned or membership)."""
    cursor = db.execute(
        """
        SELECT DISTINCT g.id, g.name, g.description, g.owner_id, g.created_at
        FROM virtual_groups g
        LEFT JOIN group_memberships m ON g.id = m.group_id
        WHERE g.owner_id = ? OR m.user_id = ?
        ORDER BY g.created_at DESC
        """,
        (current_user["id"], current_user["id"]),
    )
    rows = cursor.fetchall()
    results = []
    for r in rows:
        results.append(
            VirtualGroupResponse(
                id=r["id"],
                name=r["name"],
                description=r["description"] or "",
                owner_id=r["owner_id"],
                created_at=str(r["created_at"]),
                members=[],
            )
        )
    return results


@router.post("", response_model=VirtualGroupResponse, status_code=status.HTTP_201_CREATED)
def create_group(
    payload: VirtualGroupCreate,
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Creates a new isolated Virtual Group. Creator is established as owner and ADMIN."""
    group_id = str(uuid.uuid4())
    with db:
        db.execute(
            "INSERT INTO virtual_groups (id, name, description, owner_id) VALUES (?, ?, ?, ?)",
            (group_id, payload.name, payload.description, current_user["id"]),
        )
        db.execute(
            "INSERT INTO group_memberships (group_id, user_id, role) VALUES (?, ?, ?)",
            (group_id, current_user["id"], "ADMIN"),
        )

    return VirtualGroupResponse(
        id=group_id,
        name=payload.name,
        description=payload.description or "",
        owner_id=current_user["id"],
        created_at="now",
        members=[
            GroupMemberResponse(
                user_id=current_user["id"],
                username=current_user["username"],
                role="ADMIN",
                joined_at="now",
            )
        ],
    )


@router.get("/{group_id}", response_model=VirtualGroupResponse)
def get_group_details(
    group_id: str,
    group: dict = Depends(require_group_access),
    db: sqlite3.Connection = Depends(get_db),
):
    """Retrieves Virtual Group details and member roster. Enforces group authorization."""
    cursor = db.execute(
        """
        SELECT m.user_id, u.username, m.role, m.created_at
        FROM group_memberships m
        JOIN users u ON m.user_id = u.id
        WHERE m.group_id = ?
        """,
        (group_id,),
    )
    members = [
        GroupMemberResponse(
            user_id=r["user_id"],
            username=r["username"],
            role=r["role"],
            joined_at=str(r["created_at"]),
        )
        for r in cursor.fetchall()
    ]

    return VirtualGroupResponse(
        id=group["id"],
        name=group["name"],
        description=group["description"] or "",
        owner_id=group["owner_id"],
        created_at=str(group["created_at"]),
        members=members,
    )


@router.post("/{group_id}/members", response_model=GroupMemberResponse, status_code=status.HTTP_201_CREATED)
def add_member(
    group_id: str,
    payload: GroupMemberAdd,
    group: dict = Depends(require_group_access),
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Adds a registered user to the Virtual Group. Requires group owner or ADMIN role."""
    # Find user to add
    cursor = db.execute("SELECT id, username FROM users WHERE username = ?", (payload.username,))
    target_user = cursor.fetchone()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User '{payload.username}' does not exist.",
        )

    # Check if already member
    mem_check = db.execute(
        "SELECT role FROM group_memberships WHERE group_id = ? AND user_id = ?",
        (group_id, target_user["id"]),
    ).fetchone()
    if mem_check:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User '{payload.username}' is already a member of this group.",
        )

    with db:
        db.execute(
            "INSERT INTO group_memberships (group_id, user_id, role) VALUES (?, ?, ?)",
            (group_id, target_user["id"], payload.role),
        )

    return GroupMemberResponse(
        user_id=target_user["id"],
        username=target_user["username"],
        role=payload.role,
        joined_at="now",
    )
