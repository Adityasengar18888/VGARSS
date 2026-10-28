"""Simulation Configuration & Telemetry Pydantic Schemas."""
from typing import Optional, List, Dict
from pydantic import BaseModel, Field


class ProcessInput(BaseModel):
    id: str = Field(..., min_length=1)
    arrival_time: int = Field(..., ge=0)
    burst_time: int = Field(..., gt=0)
    priority: int = Field(default=1)


class ResourceInput(BaseModel):
    id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    total_capacity: int = Field(default=1, gt=0)
    resource_type: str = Field(default="MUTEX")
    order_rank: int = Field(default=0, ge=0)


class SimulationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    algorithm: str = Field(default="ROUND_ROBIN", description="FCFS, SJF, SRTF, ROUND_ROBIN, PRIORITY")
    time_quantum: int = Field(default=2, ge=1)
    aging_interval: Optional[int] = Field(default=None, ge=1)
    is_preemptive: bool = Field(default=False)
    processes: List[ProcessInput] = Field(..., min_length=1)
    resources: List[ResourceInput] = Field(default_factory=list)


class SimulationResponse(BaseModel):
    id: str
    group_id: str
    name: str
    algorithm: str
    time_quantum: int
    status: str
    current_tick: int
    cpu_utilization: float
    avg_waiting_time: float
    avg_turnaround_time: float
    avg_response_time: float
    throughput: float
    processes: List[Dict] = Field(default_factory=list)
    created_at: str


class SimulationStepResponse(BaseModel):
    simulation_id: str
    tick: int
    status: str
    running_process_id: Optional[str] = None
    ready_queue: List[str] = Field(default_factory=list)
    waiting_queue: List[str] = Field(default_factory=list)
    terminated_processes: List[str] = Field(default_factory=list)
    metrics: Dict
    gantt_entry: Dict
