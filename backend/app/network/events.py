"""Network Event Taxonomy, Sequencing & Message Models for VGARSS."""
from enum import Enum
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class EventType(str, Enum):
    # Task & Simulation Lifecycle
    SIMULATION_CREATED = "SIMULATION_CREATED"
    SIMULATION_STEP = "SIMULATION_STEP"
    SIMULATION_COMPLETED = "SIMULATION_COMPLETED"
    SIMULATION_PAUSED = "SIMULATION_PAUSED"
    SIMULATION_RESET = "SIMULATION_RESET"
    SIMULATION_POLICY_CHANGED = "SIMULATION_POLICY_CHANGED"
    PROCESS_ADMITTED = "PROCESS_ADMITTED"
    PROCESS_STATE_CHANGED = "PROCESS_STATE_CHANGED"

    # Concurrency & Resource Lifecycle
    RESOURCE_ACQUIRED = "RESOURCE_ACQUIRED"
    RESOURCE_BLOCKED = "RESOURCE_BLOCKED"
    RESOURCE_RELEASED = "RESOURCE_RELEASED"
    DEADLOCK_DETECTED = "DEADLOCK_DETECTED"

    # System, Sync & Telemetry
    CONNECTED = "CONNECTED"
    AUTH_SUCCESS = "AUTH_SUCCESS"
    AUTH_FAILED = "AUTH_FAILED"
    RESYNC_BATCH = "RESYNC_BATCH"
    RESYNC_FULL = "RESYNC_FULL"
    PONG = "PONG"
    SLOW_CLIENT_WARNING = "SLOW_CLIENT_WARNING"
    ERROR = "ERROR"


class NetworkEvent(BaseModel):
    """Structured telemetry event with monotonic sequence number per Virtual Group."""
    seq: int
    type: str
    group_id: str
    simulation_id: Optional[str] = None
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    payload: Dict[str, Any] = Field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "seq": self.seq,
            "type": self.type,
            "group_id": self.group_id,
            "simulation_id": self.simulation_id,
            "timestamp": self.timestamp,
            "payload": self.payload,
        }

