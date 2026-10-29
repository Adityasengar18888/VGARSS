"""Workspace Search REST Router (VGARSS 2.0)."""
import sqlite3
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query

from backend.app.database import get_db
from backend.app.api.deps import get_current_user
from backend.app.api.workspaces_v2 import check_workspace_membership
from backend.app.schemas.chat_v2 import SearchResultItem

router = APIRouter(tags=["Search V2"])


@router.get("/api/v2/search", response_model=List[SearchResultItem])
def search_workspace(
    workspace_id: str,
    q: str = Query(..., min_length=1, max_length=100),
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Searches across messages and collaborative tasks within the active workspace."""
    check_workspace_membership(db, workspace_id, current_user["id"])

    term = f"%{q.strip()}%"
    results = []

    # 1. Search Messages
    msg_rows = db.execute(
        """
        SELECT m.id, m.content, m.channel_id, c.name AS channel_name, m.created_at
        FROM messages m
        LEFT JOIN channels c ON m.channel_id = c.id
        WHERE m.workspace_id = ? AND m.content LIKE ?
        ORDER BY m.created_at DESC LIMIT 20
        """,
        (workspace_id, term),
    ).fetchall()

    for r in msg_rows:
        results.append(
            SearchResultItem(
                id=r["id"],
                type="message",
                title=f"Message in #{r['channel_name'] or 'direct'}",
                snippet=r["content"][:120],
                workspace_id=workspace_id,
                channel_id=r["channel_id"],
                channel_name=r["channel_name"],
                created_at=str(r["created_at"]),
            )
        )

    # 2. Search Tasks
    task_rows = db.execute(
        """
        SELECT t.id, t.title, t.description, t.channel_id, c.name AS channel_name, t.created_at
        FROM tasks t
        LEFT JOIN channels c ON t.channel_id = c.id
        WHERE t.workspace_id = ? AND (t.title LIKE ? OR t.description LIKE ?)
        ORDER BY t.created_at DESC LIMIT 20
        """,
        (workspace_id, term, term),
    ).fetchall()

    for r in task_rows:
        results.append(
            SearchResultItem(
                id=r["id"],
                type="task",
                title=f"Task [{r['id']}]: {r['title']}",
                snippet=(r["description"] or r["title"])[:120],
                workspace_id=workspace_id,
                channel_id=r["channel_id"],
                channel_name=r["channel_name"],
                created_at=str(r["created_at"]),
            )
        )

    return results

