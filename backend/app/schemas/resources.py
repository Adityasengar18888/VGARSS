"""Resource Management Pydantic Schemas."""
from typing import Optional, List, Dict
from pydantic import BaseModel, Field


class ResourceAcquireRequest(BaseModel):
    process_id: str = Field(..., min_length=1)
    resource_id: str = Field(..., min_length=1)
    mode: str = Field(default="EXCLUSIVE")
    units: int = Field(default=1, gt=0)


class ResourceReleaseRequest(BaseModel):
    process_id: str = Field(..., min_length=1)
    resource_id: str = Field(..., min_length=1)
    units: Optional[int] = Field(default=None, gt=0)


class ResourceStatusResponse(BaseModel):
    id: str
    name: str
    type: str
    total_capacity: int
    available_units: int
    exclusive_holder: Optional[str] = None
    shared_holders: Dict[str, int] = Field(default_factory=dict)
    wait_queue: List[str] = Field(default_factory=list)
    order_rank: int


class DeadlockStatusResponse(BaseModel):
    deadlock_detected: bool
    cycle_processes: List[str] = Field(default_factory=list)
    involved_resources: List[str] = Field(default_factory=list)
    description: str = ""
