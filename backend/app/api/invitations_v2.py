"""Workspace & Group Invitations with QR Code & Deep Link Support (VGARSS 2.0)."""
import uuid
import secrets
import sqlite3
import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status

from backend.app.database import get_db
from backend.app.api.deps import get_current_user
from backend.app.api.workspaces_v2 import check_workspace_membership
from backend.app.schemas.chat_v2 import (
    InvitationCreate,
    InvitationResponse,
    InvitationPreview,
    InvitationJoinResponse,
)
from backend.app.network.chat_hub import chat_hub

router = APIRouter(tags=["Invitations V2"])


def _format_invite_url(request: Request, code: str) -> str:
    """Constructs the canonical browser join URL based on origin or base URL."""
    base = str(request.base_url).rstrip("/")
    return f"{base}/?invite={code}"


@router.post(
    "/api/v2/workspaces/{workspace_id}/invitations",
    response_model=InvitationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_workspace_invitation(
    workspace_id: str,
    payload: InvitationCreate,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Generates a secure QR/link invitation. Requires OWNER or ADMIN role."""
    caller = check_workspace_membership(db, workspace_id, current_user["id"])
    if caller["role"] not in ("OWNER", "ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied: Only OWNER or ADMIN may generate workspace invitations.",
        )

    inv_id = str(uuid.uuid4())
    # Cryptographically random token suffix
    code = f"vgi-{secrets.token_urlsafe(8).replace('-', '').replace('_', '').lower()}"

    now = datetime.datetime.now(datetime.timezone.utc)
    expires_at = None
    if payload.expires_in_hours:
        expires_at = (now + datetime.timedelta(hours=payload.expires_in_hours)).isoformat()

    now_iso = now.isoformat()

    with db:
        db.execute(
            """
            INSERT INTO workspace_invitations (
                id, workspace_id, code, created_by, role, max_uses, uses_count, expires_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
            """,
            (
                inv_id,
                workspace_id,
                code,
                current_user["id"],
                payload.role,
                payload.max_uses,
                expires_at,
                now_iso,
            ),
        )

    invite_url = _format_invite_url(request, code)

    return InvitationResponse(
        id=inv_id,
        workspace_id=workspace_id,
        code=code,
        role=payload.role,
        max_uses=payload.max_uses,
        uses_count=0,
        expires_at=expires_at,
        revoked_at=None,
        invite_url=invite_url,
        created_at=now_iso,
    )


@router.get(
    "/api/v2/workspaces/{workspace_id}/invitations",
    response_model=List[InvitationResponse],
)
def list_workspace_invitations(
    workspace_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Lists all created invitations for a workspace. Requires OWNER or ADMIN role."""
    caller = check_workspace_membership(db, workspace_id, current_user["id"])
    if caller["role"] not in ("OWNER", "ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied: Only OWNER or ADMIN may view workspace invitations.",
        )

    cursor = db.execute(
        """
        SELECT id, workspace_id, code, role, max_uses, uses_count, expires_at, revoked_at, created_at
        FROM workspace_invitations
        WHERE workspace_id = ?
        ORDER BY created_at DESC
        """,
        (workspace_id,),
    )
    rows = cursor.fetchall()
    results = []
    for r in rows:
        results.append(
            InvitationResponse(
                id=r["id"],
                workspace_id=r["workspace_id"],
                code=r["code"],
                role=r["role"],
                max_uses=r["max_uses"],
                uses_count=r["uses_count"],
                expires_at=str(r["expires_at"]) if r["expires_at"] else None,
                revoked_at=str(r["revoked_at"]) if r["revoked_at"] else None,
                invite_url=_format_invite_url(request, r["code"]),
                created_at=str(r["created_at"]),
            )
        )
    return results


@router.delete("/api/v2/workspaces/{workspace_id}/invitations/{invitation_id}")
def revoke_workspace_invitation(
    workspace_id: str,
    invitation_id: str,
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Revokes an active invitation link immediately. Requires OWNER or ADMIN."""
    caller = check_workspace_membership(db, workspace_id, current_user["id"])
    if caller["role"] not in ("OWNER", "ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied: Only OWNER or ADMIN may revoke invitations.",
        )

    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    with db:
        cursor = db.execute(
            """
            UPDATE workspace_invitations
            SET revoked_at = ?
            WHERE id = ? AND workspace_id = ? AND revoked_at IS NULL
            """,
            (now_iso, invitation_id, workspace_id),
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Invitation not found or already revoked.")

    return {"status": "revoked", "invitation_id": invitation_id}


@router.get("/api/v2/invitations/{code}", response_model=InvitationPreview)
def preview_invitation(code: str, db: sqlite3.Connection = Depends(get_db)):
    """Public preview of an invitation before joining (metadata & validity check)."""
    cursor = db.execute(
        """
        SELECT i.id, i.workspace_id, i.code, i.role, i.max_uses, i.uses_count, i.expires_at, i.revoked_at,
               w.name AS workspace_name, w.description AS workspace_description, w.icon_url
        FROM workspace_invitations i
        JOIN workspaces w ON i.workspace_id = w.id
        WHERE i.code = ?
        """,
        (code,),
    )
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Invitation code not found.")

    # Check member count
    mem_cursor = db.execute(
        "SELECT COUNT(*) AS count FROM workspace_members WHERE workspace_id = ?",
        (row["workspace_id"],),
    )
    member_count = mem_cursor.fetchone()["count"]

    is_valid = True
    invalid_reason = None

    if row["revoked_at"]:
        is_valid = False
        invalid_reason = "This invitation has been revoked by an administrator."
    elif row["max_uses"] > 0 and row["uses_count"] >= row["max_uses"]:
        is_valid = False
        invalid_reason = "This invitation has reached its maximum allowed uses."
    elif row["expires_at"]:
        try:
            expires_at = datetime.datetime.fromisoformat(row["expires_at"])
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=datetime.timezone.utc)
            if datetime.datetime.now(datetime.timezone.utc) > expires_at:
                is_valid = False
                invalid_reason = "This invitation link has expired."
        except Exception:
            pass

    return InvitationPreview(
        code=row["code"],
        workspace_id=row["workspace_id"],
        workspace_name=row["workspace_name"],
        workspace_description=row["workspace_description"] or "",
        icon_url=row["icon_url"],
        member_count=member_count,
        role=row["role"],
        is_valid=is_valid,
        invalid_reason=invalid_reason,
        expires_at=str(row["expires_at"]) if row["expires_at"] else None,
    )


@router.post("/api/v2/invitations/{code}/join", response_model=InvitationJoinResponse)
async def join_workspace_via_invitation(
    code: str,
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Joins a workspace using a valid QR code or invitation link."""
    cursor = db.execute(
        """
        SELECT i.id, i.workspace_id, i.code, i.role, i.max_uses, i.uses_count, i.expires_at, i.revoked_at,
               w.name AS workspace_name
        FROM workspace_invitations i
        JOIN workspaces w ON i.workspace_id = w.id
        WHERE i.code = ?
        """,
        (code,),
    )
    inv = cursor.fetchone()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation code not found.")

    # Validation
    if inv["revoked_at"]:
        raise HTTPException(status_code=400, detail="This invitation has been revoked.")

    if inv["max_uses"] > 0 and inv["uses_count"] >= inv["max_uses"]:
        raise HTTPException(status_code=400, detail="This invitation has reached its maximum usage limit.")

    if inv["expires_at"]:
        try:
            expires_at = datetime.datetime.fromisoformat(inv["expires_at"])
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=datetime.timezone.utc)
            if datetime.datetime.now(datetime.timezone.utc) > expires_at:
                raise HTTPException(status_code=400, detail="This invitation has expired.")
        except HTTPException:
            raise
        except Exception:
            pass

    workspace_id = inv["workspace_id"]
    user_id = current_user["id"]

    # Check if already a member
    mem_check = db.execute(
        "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?",
        (workspace_id, user_id),
    ).fetchone()

    if mem_check:
        return InvitationJoinResponse(
            workspace_id=workspace_id,
            workspace_name=inv["workspace_name"],
            role=mem_check["role"],
            status="already_member",
        )

    # Perform atomic join and increment uses
    with db:
        # Increment uses
        db.execute(
            "UPDATE workspace_invitations SET uses_count = uses_count + 1 WHERE id = ?",
            (inv["id"],),
        )
        # Add to workspace_members
        db.execute(
            "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)",
            (workspace_id, user_id, inv["role"]),
        )
        # Auto-join all public channels
        ch_cursor = db.execute(
            "SELECT id FROM channels WHERE workspace_id = ? AND is_private = 0",
            (workspace_id,),
        )
        for ch in ch_cursor.fetchall():
            db.execute(
                "INSERT OR IGNORE INTO channel_members (channel_id, user_id) VALUES (?, ?)",
                (ch["id"], user_id),
            )

        # Sync to group_memberships
        db.execute(
            "INSERT OR IGNORE INTO group_memberships (group_id, user_id, role) VALUES (?, ?, 'MEMBER')",
            (workspace_id, user_id),
        )

        # Add system event message in general channel
        gen_ch = db.execute(
            "SELECT id FROM channels WHERE workspace_id = ? AND name = 'general'",
            (workspace_id,),
        ).fetchone()

        if gen_ch:
            sys_msg_id = f"sys-{uuid.uuid4()}"
            db.execute(
                """
                INSERT INTO messages (id, workspace_id, channel_id, sender_id, message_type, content)
                VALUES (?, ?, ?, ?, 'SYSTEM_EVENT', ?)
                """,
                (
                    sys_msg_id,
                    workspace_id,
                    gen_ch["id"],
                    user_id,
                    f"@{current_user['username']} joined the workspace via invitation.",
                ),
            )

    return InvitationJoinResponse(
        workspace_id=workspace_id,
        workspace_name=inv["workspace_name"],
        role=inv["role"],
        status="joined",
    )

