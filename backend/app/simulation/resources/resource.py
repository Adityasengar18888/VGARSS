"""Thread-Safe Resource Primitive with Exclusive/Shared Modes and Wait Queues."""
import threading
from typing import Optional, List, Dict
from backend.app.simulation.resources.models import (
    ResourceMode,
    ResourceType,
    ResourceDefinition,
    ResourceStatus,
    WaiterRequest,
    OverAllocationError,
    UnauthorizedReleaseError,
    DuplicateAllocationError,
)


class Resource:
    """Thread-safe synchronization primitive supporting Mutex and Semaphore semantics.
    
    Invariants:
    1. available_units >= 0 and available_units <= total_capacity.
    2. In EXCLUSIVE mode: exclusive_holder is not None, shared_holders is empty.
    3. In SHARED mode: exclusive_holder is None, sum(shared_holders.values()) == (total_capacity - available_units).
    4. Never permit unauthorized release.
    5. Never permit duplicate exclusive acquisition by the same process without release.
    """

    def __init__(self, definition: ResourceDefinition):
        self.id = definition.id
        self.name = definition.name
        self.resource_type = definition.resource_type
        self.total_capacity = definition.total_capacity
        self.available_units = definition.total_capacity
        self.order_rank = definition.order_rank

        self.exclusive_holder: Optional[str] = None
        self.shared_holders: Dict[str, int] = {}
        self.wait_queue: List[WaiterRequest] = []

        self._lock = threading.RLock()

    def is_free(self) -> bool:
        """Returns True if no process holds this resource."""
        with self._lock:
            return self.exclusive_holder is None and len(self.shared_holders) == 0

    def is_held_by(self, process_id: str) -> bool:
        """Returns True if the given process currently holds exclusive or shared access."""
        with self._lock:
            return (self.exclusive_holder == process_id) or (process_id in self.shared_holders)

    def try_acquire(
        self,
        process_id: str,
        mode: ResourceMode = ResourceMode.EXCLUSIVE,
        units: int = 1,
        current_tick: int = 0,
        enqueue_on_failure: bool = True,
    ) -> bool:
        """Attempts to atomically acquire resource units.
        
        If successful, returns True.
        If unavailable and enqueue_on_failure is True, enqueues request and returns False.
        """
        with self._lock:
            if units <= 0:
                raise ValueError(f"Requested units must be > 0. Got: {units}")
            if units > self.total_capacity:
                raise OverAllocationError(
                    f"Requested {units} units exceeds total resource capacity of {self.total_capacity} for '{self.id}'."
                )

            # Prevent duplicate exclusive acquisition
            if self.exclusive_holder == process_id:
                raise DuplicateAllocationError(
                    f"Process '{process_id}' already holds an exclusive lock on resource '{self.id}'."
                )

            # Check if acquisition is possible right now
            can_grant = False
            if mode == ResourceMode.EXCLUSIVE:
                # Can grant exclusive only if free of any exclusive or shared holders
                # and available_units >= units and no other process is waiting ahead
                queue_ahead = [w for w in self.wait_queue if w.process_id != process_id]
                if (
                    self.exclusive_holder is None
                    and len(self.shared_holders) == 0
                    and self.available_units >= units
                    and len(queue_ahead) == 0
                ):
                    can_grant = True
            else:
                # SHARED mode: can grant if no exclusive holder, sufficient available units,
                # and no pending exclusive requests ahead in queue (prevents writer starvation)
                has_exclusive_waiter_ahead = any(
                    w.mode == ResourceMode.EXCLUSIVE for w in self.wait_queue if w.process_id != process_id
                )
                if (
                    self.exclusive_holder is None
                    and self.available_units >= units
                    and not has_exclusive_waiter_ahead
                ):
                    can_grant = True

            if can_grant:
                # Commit allocation
                self.available_units -= units
                if mode == ResourceMode.EXCLUSIVE:
                    self.exclusive_holder = process_id
                else:
                    self.shared_holders[process_id] = self.shared_holders.get(process_id, 0) + units

                # Remove from wait queue if previously queued
                self.wait_queue = [w for w in self.wait_queue if w.process_id != process_id]
                return True

            # If cannot grant, enqueue request if requested
            if enqueue_on_failure:
                # Check if already in queue
                already_queued = any(w.process_id == process_id for w in self.wait_queue)
                if not already_queued:
                    self.wait_queue.append(
                        WaiterRequest(
                            process_id=process_id,
                            mode=mode,
                            units=units,
                            requested_at_tick=current_tick,
                        )
                    )
            return False

    def release(self, process_id: str, units: Optional[int] = None) -> List[str]:
        """Atomically releases held units and wakes up eligible pending waiters without lost wakeups.
        
        Returns the list of process IDs that were successfully awakened and allocated.
        """
        with self._lock:
            # 1. Validate ownership
            if self.exclusive_holder == process_id:
                released = self.total_capacity - self.available_units
                self.exclusive_holder = None
                self.available_units = self.total_capacity
            elif process_id in self.shared_holders:
                held = self.shared_holders[process_id]
                rel = held if (units is None or units >= held) else units
                self.shared_holders[process_id] -= rel
                if self.shared_holders[process_id] <= 0:
                    del self.shared_holders[process_id]
                self.available_units += rel
            else:
                raise UnauthorizedReleaseError(
                    f"Process '{process_id}' cannot release resource '{self.id}' because it does not hold it."
                )

            # 2. Wake up pending waiters atomically
            awakened: List[str] = []
            self._satisfy_waiters(awakened)
            return awakened

    def _satisfy_waiters(self, awakened_list: List[str]) -> None:
        """Internal helper to greedily dispatch pending waiters from queue."""
        while self.wait_queue:
            next_req = self.wait_queue[0]

            if next_req.mode == ResourceMode.EXCLUSIVE:
                # Exclusive requires entirely free resource and sufficient capacity
                if (
                    self.exclusive_holder is None
                    and len(self.shared_holders) == 0
                    and self.available_units >= next_req.units
                ):
                    self.wait_queue.pop(0)
                    self.available_units -= next_req.units
                    self.exclusive_holder = next_req.process_id
                    awakened_list.append(next_req.process_id)
                break  # Cannot proceed past a blocked exclusive waiter
            else:
                # SHARED mode
                if self.exclusive_holder is None and self.available_units >= next_req.units:
                    self.wait_queue.pop(0)
                    self.available_units -= next_req.units
                    self.shared_holders[next_req.process_id] = (
                        self.shared_holders.get(next_req.process_id, 0) + next_req.units
                    )
                    awakened_list.append(next_req.process_id)
                else:
                    break

    def force_release(self, process_id: str) -> List[str]:
        """Unconditionally releases all locks held by process_id and cleans its waiting entries.
        
        Used for cancellation, abort, and disconnect recovery.
        """
        with self._lock:
            awakened: List[str] = []
            was_holding = False

            if self.exclusive_holder == process_id:
                self.exclusive_holder = None
                self.available_units = self.total_capacity
                was_holding = True

            if process_id in self.shared_holders:
                rel = self.shared_holders.pop(process_id)
                self.available_units += rel
                was_holding = True

            # Also scrub from wait queue
            self.wait_queue = [w for w in self.wait_queue if w.process_id != process_id]

            if was_holding:
                self._satisfy_waiters(awakened)

            return awakened

    def remove_waiter(self, process_id: str) -> bool:
        """Removes a process from the wait queue without altering active allocations."""
        with self._lock:
            initial_len = len(self.wait_queue)
            self.wait_queue = [w for w in self.wait_queue if w.process_id != process_id]
            return len(self.wait_queue) < initial_len

    def get_status(self) -> ResourceStatus:
        """Produces a thread-safe telemetry snapshot."""
        with self._lock:
            return ResourceStatus(
                id=self.id,
                name=self.name,
                type=self.resource_type,
                total_capacity=self.total_capacity,
                available_units=self.available_units,
                exclusive_holder=self.exclusive_holder,
                shared_holders=dict(self.shared_holders),
                wait_queue=[w.process_id for w in self.wait_queue],
                order_rank=self.order_rank,
            )
