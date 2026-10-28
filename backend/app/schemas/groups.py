"""Virtual Groups & Membership Pydantic Schemas."""
from typing import Optional, List
from pydantic import BaseModel, Field


class VirtualGroupCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="Virtual Group Name")
    description: Optional[str] = Field(default="", max_length=500)


class GroupMemberAdd(BaseModel):
    username: str = Field(..., min_length=1, description="Username to add to group")
    role: str = Field(default="MEMBER", description="Group role: ADMIN, MEMBER, or VIEWER")


class GroupMemberResponse(BaseModel):
    user_id: str
    username: str
    role: str
    joined_at: str


class VirtualGroupResponse(BaseModel):
    id: str
    name: str
    description: str
    owner_id: str
    members: List[GroupMemberResponse] = Field(default_factory=list)
    created_at: str
