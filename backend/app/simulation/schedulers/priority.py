"""Priority CPU Scheduler with optional Aging Starvation Mitigation."""
from typing import List, Optional
from backend.app.simulation.models import ProcessControlBlock
from backend.app.simulation.schedulers.base import BaseScheduler


class PriorityScheduler(BaseScheduler):
    """Priority-based CPU scheduler supporting preemptive and non-preemptive modes.
    
    Priority Convention:
    - Lower numerical value indicates higher scheduling priority (e.g., Priority 1 > Priority 5).
    
    Starvation Prevention (Aging):
    - If `aging_interval` is set (e.g. 5 ticks), every process waiting in the ready queue
      for `aging_interval` ticks has its effective priority boosted by 1 (priority value decremented, down to min 1).
    """

    def __init__(self, is_preemptive: bool = False, aging_interval: Optional[int] = None):
        if aging_interval is not None and aging_interval <= 0:
            raise ValueError(f"Aging interval must be > 0. Got: {aging_interval}")
        
        name = "PRIORITY_PREEMPTIVE" if is_preemptive else "PRIORITY"
        super().__init__(name=name, is_preemptive=is_preemptive)
        self.aging_interval = aging_interval

    def select_next(
        self,
        ready_queue: List[ProcessControlBlock],
        current_running: Optional[ProcessControlBlock],
        current_tick: int,
    ) -> Optional[ProcessControlBlock]:
        if not ready_queue:
            return None
        # Deterministic sorting: effective priority ascending (lower value = higher rank),
        # then arrival_time, then admission_order, then id
        return min(
            ready_queue,
            key=lambda p: (p.priority, p.arrival_time, p.admission_order, p.id),
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

        highest_ready = min(
            ready_queue,
            key=lambda p: (p.priority, p.arrival_time, p.admission_order, p.id),
        )
        return highest_ready.priority < running.priority

    def on_tick_end(
        self,
        ready_queue: List[ProcessControlBlock],
        running: Optional[ProcessControlBlock],
        current_tick: int,
    ) -> None:
        """Applies priority aging to all processes residing in the ready queue."""
        if not self.aging_interval:
            return

        for p in ready_queue:
            p.ticks_in_ready += 1
            if p.ticks_in_ready % self.aging_interval == 0 and p.priority > 1:
                p.priority -= 1
