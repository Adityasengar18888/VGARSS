"""Shortest Job First (SJF) and Shortest Remaining Time First (SRTF) Schedulers."""
from typing import List, Optional
from backend.app.simulation.models import ProcessControlBlock
from backend.app.simulation.schedulers.base import BaseScheduler


class SJFScheduler(BaseScheduler):
    """Shortest Job First scheduler supporting both non-preemptive (SJF) and preemptive (SRTF) modes.
    
    Deterministic tie-breaking:
    - Primary key: burst_time (non-preemptive) or remaining_time (preemptive)
    - Secondary key: arrival_time
    - Tertiary key: admission_order
    - Quaternary key: process_id
    """

    def __init__(self, is_preemptive: bool = False):
        name = "SRTF" if is_preemptive else "SJF"
        super().__init__(name=name, is_preemptive=is_preemptive)

    def select_next(
        self,
        ready_queue: List[ProcessControlBlock],
        current_running: Optional[ProcessControlBlock],
        current_tick: int,
    ) -> Optional[ProcessControlBlock]:
        if not ready_queue:
            return None

        if self.is_preemptive:
            # Preemptive (SRTF): compare remaining burst times
            return min(
                ready_queue,
                key=lambda p: (p.remaining_time, p.arrival_time, p.admission_order, p.id),
            )
        else:
            # Non-preemptive (SJF): compare total burst times
            return min(
                ready_queue,
                key=lambda p: (p.burst_time, p.arrival_time, p.admission_order, p.id),
            )

    def should_preempt(
        self,
        running: ProcessControlBlock,
        ready_queue: List[ProcessControlBlock],
        current_quantum_ticks: int,
        current_tick: int,
    ) -> bool:
        if not self.is_preemptive or not ready_queue:
            return False

        # In SRTF, preempt if any ready process has strictly smaller remaining time
        best_candidate = min(
            ready_queue,
            key=lambda p: (p.remaining_time, p.arrival_time, p.admission_order, p.id),
        )
        return best_candidate.remaining_time < running.remaining_time
