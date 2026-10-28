"""Resource and Synchronization Data Models and Exceptions."""
from enum import Enum
from typing import Optional, List, Dict
from pydantic import BaseModel, Field, field_validator


# ============================================================================
# CONCURRENCY & SYNCHRONIZATION EXCEPTIONS
# ============================================================================

class ResourceError(Exception):
    """Base exception for all resource management and synchronization errors."""
    pass


class OverAllocationError(ResourceError):
    """Raised when an operation would exceed total resource capacity."""
    pass


class UnauthorizedReleaseError(ResourceError):
    """Raised when a process attempts to release a resource it does not own."""
    pass


class DuplicateAllocationError(ResourceError):
    """Raised when a process attempts to acquire an exclusive lock it already holds."""
    pass


class LockOrderingViolationError(ResourceError):
    """Raised when resource acquisition violates global linear lock ordering rules."""
    pass


class UnsafeStateError(ResourceError):
    """Raised by Banker's Algorithm when a request leads to a deadlock-prone unsafe state."""
    pass


# ============================================================================
# ENUMS & MODELS
# ============================================================================

class ResourceMode(str, Enum):
    """Access mode for resource acquisition."""
    EXCLUSIVE = "EXCLUSIVE"  # Mutex / Write lock (exclusive single owner)
    SHARED = "SHARED"        # Semaphore / Read lock (multiple shared holders)


class ResourceType(str, Enum):
    """Underlying synchronization primitive type."""
    MUTEX = "MUTEX"
    SEMAPHORE = "SEMAPHORE"


class ResourceDefinition(BaseModel):
    """Immutable specification for resource registration."""
    id: str = Field(..., min_length=1, description="Unique resource identifier (e.g. 'R1', 'MUTEX_DB')")
    name: str = Field(..., min_length=1, description="Human-readable resource name")
    total_capacity: int = Field(default=1, gt=0, description="Total units/instances available (must be > 0)")
    resource_type: ResourceType = Field(default=ResourceType.MUTEX, description="MUTEX or SEMAPHORE")
    order_rank: int = Field(default=0, ge=0, description="Global linear hierarchy index for deadlock prevention")

    @field_validator("id")
    @classmethod
    def validate_id_not_blank(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Resource ID cannot be empty or whitespace only.")
        return trimmed


class WaiterRequest(BaseModel):
    """Pending allocation request in a resource's waiting queue."""
    process_id: str
    mode: ResourceMode
    units: int = 1
    requested_at_tick: int = 0


class AllocationRecord(BaseModel):
    """Active allocation entry tracking explicit ownership."""
    process_id: str
    resource_id: str
    mode: ResourceMode
    units: int = 1
    acquired_at_tick: int = 0


class ResourceStatus(BaseModel):
    """Point-in-time telemetry snapshot of a resource's state."""
    id: str
    name: str
    type: ResourceType
    total_capacity: int
    available_units: int
    exclusive_holder: Optional[str] = None
    shared_holders: Dict[str, int] = Field(default_factory=dict)
    wait_queue: List[str] = Field(default_factory=list)
    order_rank: int
