"""First-Come, First-Served (FCFS) CPU Scheduler."""
from typing import List, Optional
from backend.app.simulation.models import ProcessControlBlock
from backend.app.simulation.schedulers.base import BaseScheduler


class FCFSScheduler(BaseScheduler):
    """First-Come, First-Served non-preemptive scheduler.
    
    Dispatches processes strictly according to arrival time.
    Deterministic tie-breaking: arrival_time -> admission_order -> process_id.
    """

    def __init__(self):
        super().__init__(name="FCFS", is_preemptive=False)

    def select_next(
        self,
        ready_queue: List[ProcessControlBlock],
        current_running: Optional[ProcessControlBlock],
        current_tick: int,
    ) -> Optional[ProcessControlBlock]:
        if not ready_queue:
            return None
        # Sort key: arrival_time ascending, then admission_order, then id alphanumeric
        return min(ready_queue, key=lambda p: (p.arrival_time, p.admission_order, p.id))

    def should_preempt(
        self,
        running: ProcessControlBlock,
        ready_queue: List[ProcessControlBlock],
        current_quantum_ticks: int,
        current_tick: int,
    ) -> bool:
        return False
