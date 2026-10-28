"""Abstract Base Class for CPU Scheduling Strategies."""
from abc import ABC, abstractmethod
from typing import List, Optional
from backend.app.simulation.models import ProcessControlBlock


class BaseScheduler(ABC):
    """Abstract interface defining required scheduler dispatch and preemption behaviors."""

    def __init__(self, name: str, is_preemptive: bool):
        self.name = name
        self.is_preemptive = is_preemptive

    @abstractmethod
    def select_next(
        self,
        ready_queue: List[ProcessControlBlock],
        current_running: Optional[ProcessControlBlock],
        current_tick: int,
    ) -> Optional[ProcessControlBlock]:
        """Selects the next process from the ready queue to dispatch on the CPU."""
        pass

    @abstractmethod
    def should_preempt(
        self,
        running: ProcessControlBlock,
        ready_queue: List[ProcessControlBlock],
        current_quantum_ticks: int,
        current_tick: int,
    ) -> bool:
        """Determines whether the currently running process must be preempted."""
        pass

    def on_tick_end(
        self,
        ready_queue: List[ProcessControlBlock],
        running: Optional[ProcessControlBlock],
        current_tick: int,
    ) -> None:
        """Hook called at the conclusion of every tick (e.g. for aging updates)."""
        pass
