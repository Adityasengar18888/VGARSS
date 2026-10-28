"""Process, PCB, and Simulation Data Models."""
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator


class ProcessState(str, Enum):
    """The 5 discrete states of an Operating System process lifecycle."""
    NEW = "NEW"
    READY = "READY"
    RUNNING = "RUNNING"
    WAITING = "WAITING"
    TERMINATED = "TERMINATED"


class ProcessDefinition(BaseModel):
    """Immutable specification for process ingestion."""
    id: str = Field(..., min_length=1, description="Unique process identifier (e.g. 'P1')")
    arrival_time: int = Field(..., ge=0, description="Tick at which the process arrives in the system")
    burst_time: int = Field(..., gt=0, description="Total CPU execution units required (must be > 0)")
    priority: int = Field(default=1, description="Priority level (lower numerical value = higher priority)")

    @field_validator("id")
    @classmethod
    def validate_id_not_whitespace(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Process ID cannot be empty or whitespace only.")
        return trimmed


class ProcessControlBlock(BaseModel):
    """Process Control Block (PCB) maintaining mutable runtime process state."""
    id: str
    arrival_time: int
    burst_time: int
    remaining_time: int
    priority: int
    base_priority: int
    state: ProcessState = ProcessState.NEW
    
    # Timing tracking
    start_time: Optional[int] = None
    completion_time: Optional[int] = None
    waiting_time: int = 0
    turnaround_time: int = 0
    response_time: int = 0
    
    # Ready queue tracking
    ticks_in_ready: int = 0
    last_dispatched_tick: Optional[int] = None
    admission_order: int = 0

    @classmethod
    def from_definition(cls, p: ProcessDefinition, admission_order: int = 0) -> "ProcessControlBlock":
        return cls(
            id=p.id,
            arrival_time=p.arrival_time,
            burst_time=p.burst_time,
            remaining_time=p.burst_time,
            priority=p.priority,
            base_priority=p.priority,
            state=ProcessState.NEW,
            admission_order=admission_order,
        )

    def calculate_final_metrics(self) -> None:
        """Computes and updates metrics when process terminates."""
        if self.completion_time is not None:
            self.turnaround_time = self.completion_time - self.arrival_time
            self.waiting_time = self.turnaround_time - self.burst_time
            if self.start_time is not None:
                self.response_time = self.start_time - self.arrival_time
            else:
                self.response_time = 0


class GanttEntry(BaseModel):
    """Discrete single-tick execution record for Gantt visualizers."""
    tick: int
    process_id: Optional[str] = None  # None indicates CPU was idle
    state: str = "RUNNING"  # "RUNNING", "IDLE", "CONTEXT_SWITCH"


class SimulationMetrics(BaseModel):
    """Aggregate mathematical performance metrics."""
    total_ticks: int = 0
    busy_ticks: int = 0
    idle_ticks: int = 0
    cpu_utilization: float = 0.0
    throughput: float = 0.0
    avg_waiting_time: float = 0.0
    avg_turnaround_time: float = 0.0
    avg_response_time: float = 0.0


class SimulationSnapshot(BaseModel):
    """Point-in-time snapshot of the simulation state."""
    tick: int
    running_process_id: Optional[str] = None
    ready_queue: List[str] = Field(default_factory=list)
    waiting_queue: List[str] = Field(default_factory=list)
    terminated_processes: List[str] = Field(default_factory=list)
    metrics: SimulationMetrics
    gantt_entry: GanttEntry
