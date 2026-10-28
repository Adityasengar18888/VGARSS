"""Round Robin (RR) CPU Scheduler."""
from typing import List, Optional
from backend.app.simulation.models import ProcessControlBlock
from backend.app.simulation.schedulers.base import BaseScheduler


class RoundRobinScheduler(BaseScheduler):
    """Preemptive time-sliced Round Robin scheduler with configurable time quantum."""

    def __init__(self, time_quantum: int = 2):
        if time_quantum <= 0:
            raise ValueError(f"Time quantum must be a positive integer >= 1. Got: {time_quantum}")
        super().__init__(name="ROUND_ROBIN", is_preemptive=True)
        self.time_quantum = time_quantum

    def select_next(
        self,
        ready_queue: List[ProcessControlBlock],
        current_running: Optional[ProcessControlBlock],
        current_tick: int,
    ) -> Optional[ProcessControlBlock]:
        if not ready_queue:
            return None
        # FIFO queue selection: take the head of the ready queue
        return ready_queue[0]

    def should_preempt(
        self,
        running: ProcessControlBlock,
        ready_queue: List[ProcessControlBlock],
        current_quantum_ticks: int,
        current_tick: int,
    ) -> bool:
        # Preempt if current process has reached or exceeded the allocated time quantum
        if current_quantum_ticks >= self.time_quantum:
            # If others are waiting in ready queue, must preempt to enforce fairness
            return len(ready_queue) > 0
        return False
