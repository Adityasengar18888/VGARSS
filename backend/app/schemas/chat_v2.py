"""Pydantic v2 Schemas for VGARSS 2.0 Chat Platform, Workspaces, and Tasks."""
from datetime import datetime
from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field, EmailStr


class UserPresenceUpdate(BaseModel):
    presence_state: Literal["ONLINE", "AWAY", "DND", "OFFLINE"] = "ONLINE"
    status_message: Optional[str] = Field(None, max_length=120)


class UserProfileResponse(BaseModel):
    id: str
    username: str
    email: str
    display_name: str
    avatar_url: Optional[str] = None
    bio: Optional[str] = ""
    status_message: Optional[str] = ""
    presence_state: str = "OFFLINE"
    last_seen_at: Optional[str] = None


class WorkspaceCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    slug: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = Field("", max_length=500)
    icon_url: Optional[str] = None


class WorkspaceResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: str
    icon_url: Optional[str] = None
    owner_id: str
    role: str = "MEMBER"
    unread_count: int = 0
    created_at: str


class WorkspaceMemberAdd(BaseModel):
    username: str
    role: Literal["ADMIN", "MEMBER", "GUEST"] = "MEMBER"


class WorkspaceMemberResponse(BaseModel):
    user_id: str
    username: str
    display_name: str
    avatar_url: Optional[str] = None
    role: str
    presence_state: str = "OFFLINE"
    status_message: Optional[str] = ""
    joined_at: str


class ChannelCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    topic: Optional[str] = Field("", max_length=255)
    channel_type: Literal["TEXT", "SIMULATION", "ANNOUNCEMENT"] = "TEXT"
    is_private: bool = False


class ChannelResponse(BaseModel):
    id: str
    workspace_id: str
    name: str
    topic: str
    channel_type: str
    is_private: bool
    created_by: str
    unread_count: int = 0
    created_at: str


class DirectConversationResponse(BaseModel):
    id: str
    workspace_id: str
    is_group: bool = False
    recipient: UserProfileResponse
    unread_count: int = 0
    last_message: Optional[Dict[str, Any]] = None


class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=10000)
    message_type: Literal["USER_TEXT", "SYSTEM_EVENT", "TASK_CARD", "CODE_SNIPPET"] = "USER_TEXT"
    client_msg_id: Optional[str] = None
    parent_id: Optional[str] = None
    payload_json: Optional[Dict[str, Any]] = Field(default_factory=dict)


class MessageResponse(BaseModel):
    id: str
    workspace_id: str
    channel_id: Optional[str] = None
    conversation_id: Optional[str] = None
    sender_id: Optional[str] = None
    sender_username: Optional[str] = None
    sender_display_name: Optional[str] = None
    sender_avatar: Optional[str] = None
    message_type: str
    content: str
    parent_id: Optional[str] = None
    reply_count: int = 0
    is_edited: bool = False
    is_pinned: bool = False
    payload_json: Dict[str, Any] = Field(default_factory=dict)
    client_msg_id: Optional[str] = None
    seq: int = 0
    created_at: str
    delivery_status: str = "SENT"
    delivered_count: int = 0
    read_count: int = 0


class MessageReceiptAck(BaseModel):
    message_id: str
    channel_id: Optional[str] = None
    conversation_id: Optional[str] = None
    receipt_type: Literal["DELIVERED", "READ"] = "DELIVERED"


class MessagePageResponse(BaseModel):
    messages: List[MessageResponse]
    has_more: bool
    next_cursor: Optional[str] = None
    total_count: int


class TaskCreate(BaseModel):
    workspace_id: str
    channel_id: Optional[str] = None
    source_message_id: Optional[str] = None
    title: str = Field(..., min_length=2, max_length=150)
    description: Optional[str] = Field("", max_length=2000)
    assignee_id: Optional[str] = None
    priority: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"] = "MEDIUM"
    arrival_time: int = Field(0, ge=0, description="Arrival tick in logical simulation clock")
    deadline: Optional[str] = None
    estimated_burst_ticks: int = Field(5, ge=1, le=100)
    required_resources: Optional[List[str]] = Field(default_factory=list)


class TaskUpdate(BaseModel):
    status: Optional[Literal["NEW", "READY", "RUNNING", "WAITING", "TERMINATED"]] = None
    assignee_id: Optional[str] = None
    priority: Optional[Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]] = None
    deadline: Optional[str] = None
    action: Optional[str] = None
    resource_id: Optional[str] = None
    units: Optional[int] = 1


class TaskResponse(BaseModel):
    id: str
    workspace_id: str
    channel_id: Optional[str] = None
    source_message_id: Optional[str] = None
    creator_id: str
    creator_name: str
    assignee_id: Optional[str] = None
    assignee_name: Optional[str] = None
    title: str
    description: str
    priority: str
    numeric_priority: int
    arrival_time: int = 0
    deadline: Optional[str] = None
    estimated_burst_ticks: int
    remaining_burst_ticks: int = 5
    status: str
    waiting_ticks: int = 0
    turnaround_ticks: int = 0
    response_ticks: int = 0
    required_resources: List[str] = Field(default_factory=list)
    held_resources: List[str] = Field(default_factory=list)
    waiting_on_resource: Optional[str] = None
    created_at: str


class WorkspaceSchedulerState(BaseModel):
    workspace_id: str
    current_tick: int
    algorithm: str
    time_quantum: int
    aging_interval: Optional[int] = None
    is_preemptive: bool
    running_task_id: Optional[str] = None
    running_task: Optional[TaskResponse] = None
    ready_queue: List[TaskResponse] = Field(default_factory=list)
    waiting_queue: List[TaskResponse] = Field(default_factory=list)
    terminated_tasks: List[TaskResponse] = Field(default_factory=list)
    gantt_history: List[dict] = Field(default_factory=list)
    metrics: dict = Field(default_factory=dict)


class WorkspaceResourceStatus(BaseModel):
    id: str
    workspace_id: str
    name: str
    resource_type: str
    total_capacity: int
    available_units: int
    exclusive_holder_task_id: Optional[str] = None
    exclusive_holder_name: Optional[str] = None
    shared_holders: dict = Field(default_factory=dict)
    wait_queue: List[dict] = Field(default_factory=list)
    order_rank: int = 1
    description: str = ""


class WorkspaceResourceAcquireRequest(BaseModel):
    resource_id: str
    units: int = Field(1, ge=1)
    mode: Literal["EXCLUSIVE", "SHARED"] = "EXCLUSIVE"


class WorkspaceResourceReleaseRequest(BaseModel):
    resource_id: str
    units: Optional[int] = None


class DeadlockReport(BaseModel):
    deadlock_detected: bool
    cycle_tasks: List[str] = Field(default_factory=list)
    cycle_resources: List[str] = Field(default_factory=list)
    wait_for_edges: List[dict] = Field(default_factory=list)
    description: str = ""
    recommended_action: Optional[str] = None


class SearchResultItem(BaseModel):
    id: str
    type: Literal["message", "task"]
    title: str
    snippet: str
    workspace_id: str
    channel_id: Optional[str] = None
    channel_name: Optional[str] = None
    created_at: str


class InvitationCreate(BaseModel):
    role: Literal["ADMIN", "MEMBER", "GUEST"] = "MEMBER"
    expires_in_hours: Optional[int] = Field(24, ge=1, le=8760, description="Expiration in hours (null for indefinite)")
    max_uses: int = Field(0, ge=0, description="Max usage count (0 for unlimited)")


class InvitationResponse(BaseModel):
    id: str
    workspace_id: str
    code: str
    role: str
    max_uses: int
    uses_count: int
    expires_at: Optional[str] = None
    revoked_at: Optional[str] = None
    invite_url: str
    created_at: str


class InvitationPreview(BaseModel):
    code: str
    workspace_id: str
    workspace_name: str
    workspace_description: str = ""
    icon_url: Optional[str] = None
    member_count: int = 1
    role: str = "MEMBER"
    is_valid: bool = True
    invalid_reason: Optional[str] = None
    expires_at: Optional[str] = None


class InvitationJoinResponse(BaseModel):
    workspace_id: str
    workspace_name: str
    role: str
    status: str = "joined"


