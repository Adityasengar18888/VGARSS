"""Resource Manager coordinating Synchronization, Deadlock Prevention & Recovery."""
import threading
from typing import Dict, List, Optional, Set
from backend.app.simulation.resources.models import (
    ResourceMode,
    ResourceDefinition,
    ResourceStatus,
    AllocationRecord,
    LockOrderingViolationError,
)
from backend.app.simulation.resources.resource import Resource
from backend.app.simulation.resources.deadlock import WaitForGraph, DeadlockCycle


class ResourceManager:
    """Central Resource Manager enforcing concurrency invariants and deadlock strategies.
    
    Invariants:
    1. Global lock ordering prevents circular wait when enabled.
    2. Atomic allocation and release with zero lost wakeups.
    3. Never permit unauthorized release.
    4. Safe disconnect and cancellation recovery releasing all held locks.
    """

    def __init__(self, enable_resource_ordering: bool = False):
        self.enable_resource_ordering = enable_resource_ordering
        self.resources: Dict[str, Resource] = {}
        self.active_allocations: Dict[str, List[AllocationRecord]] = {}
        self.wait_for_graph = WaitForGraph()
        self._manager_lock = threading.RLock()

    def register_resource(self, definition: ResourceDefinition) -> Resource:
        """Registers a new synchronization primitive in the manager."""
        with self._manager_lock:
            if definition.id in self.resources:
                raise ValueError(f"Resource with ID '{definition.id}' is already registered.")
            res = Resource(definition)
            self.resources[definition.id] = res
            return res

    def get_resource(self, resource_id: str) -> Resource:
        """Retrieves a registered resource by ID."""
        with self._manager_lock:
            if resource_id not in self.resources:
                raise KeyError(f"Resource '{resource_id}' is not registered.")
            return self.resources[resource_id]

    def acquire(
        self,
        process_id: str,
        resource_id: str,
        mode: ResourceMode = ResourceMode.EXCLUSIVE,
        units: int = 1,
        current_tick: int = 0,
    ) -> bool:
        """Attempts to acquire a resource.
        
        If resource-ordering deadlock prevention is enabled, validates that the requested
        resource rank is strictly greater than any resource rank currently held by the process.
        """
        with self._manager_lock:
            res = self.get_resource(resource_id)

            # Deadlock Prevention via Global Lock Ordering
            if self.enable_resource_ordering:
                held_ranks = self._get_held_ranks(process_id)
                if held_ranks:
                    max_held = max(held_ranks)
                    if res.order_rank <= max_held:
                        raise LockOrderingViolationError(
                            f"Lock ordering violation: Process '{process_id}' holds resource with rank {max_held} "
                            f"and cannot request '{resource_id}' with lower or equal rank {res.order_rank}."
                        )

            # Attempt atomic acquisition
            granted = res.try_acquire(
                process_id=process_id,
                mode=mode,
                units=units,
                current_tick=current_tick,
                enqueue_on_failure=True,
            )

            if granted:
                record = AllocationRecord(
                    process_id=process_id,
                    resource_id=resource_id,
                    mode=mode,
                    units=units,
                    acquired_at_tick=current_tick,
                )
                self.active_allocations.setdefault(process_id, []).append(record)

            return granted

    def release(
        self,
        process_id: str,
        resource_id: str,
        units: Optional[int] = None,
    ) -> List[str]:
        """Atomically releases a held resource and returns the list of awakened process IDs."""
        with self._manager_lock:
            res = self.get_resource(resource_id)
            awakened = res.release(process_id, units)

            # Update active allocations record
            if process_id in self.active_allocations:
                # Remove or update allocation record
                remaining_records = []
                for rec in self.active_allocations[process_id]:
                    if rec.resource_id == resource_id:
                        if units is not None and rec.units > units:
                            rec.units -= units
                            remaining_records.append(rec)
                    else:
                        remaining_records.append(rec)
                self.active_allocations[process_id] = remaining_records

            # Register awakened allocations
            for awakened_pid in awakened:
                # Check what mode the awakened process got
                is_exclusive = (res.exclusive_holder == awakened_pid)
                held_units = res.total_capacity - res.available_units if is_exclusive else res.shared_holders.get(awakened_pid, 1)
                new_rec = AllocationRecord(
                    process_id=awakened_pid,
                    resource_id=resource_id,
                    mode=ResourceMode.EXCLUSIVE if is_exclusive else ResourceMode.SHARED,
                    units=held_units,
                )
                self.active_allocations.setdefault(awakened_pid, []).append(new_rec)

            return awakened

    def handle_process_disconnect(self, process_id: str) -> List[str]:
        """Gracefully recovers from process cancellation, abort, or network disconnect.
        
        Releases all held resources atomically and unblocks waiting processes without lost wakeups.
        """
        with self._manager_lock:
            all_awakened: List[str] = []
            for res in self.resources.values():
                awakened = res.force_release(process_id)
                for pid in awakened:
                    if pid not in all_awakened:
                        all_awakened.append(pid)
                        # Record allocation for awakened process
                        is_excl = (res.exclusive_holder == pid)
                        units = (res.total_capacity - res.available_units) if is_excl else res.shared_holders.get(pid, 1)
                        self.active_allocations.setdefault(pid, []).append(
                            AllocationRecord(
                                process_id=pid,
                                resource_id=res.id,
                                mode=ResourceMode.EXCLUSIVE if is_excl else ResourceMode.SHARED,
                                units=units,
                            )
                        )

            # Scrub allocations for disconnected process
            self.active_allocations.pop(process_id, None)
            return all_awakened

    def check_deadlock(self) -> Optional[DeadlockCycle]:
        """Scans the active Wait-For Graph across all resources and returns a DeadlockCycle if detected."""
        with self._manager_lock:
            self.wait_for_graph.build_from_resources(list(self.resources.values()))
            return self.wait_for_graph.detect_cycle()

    def get_all_statuses(self) -> List[ResourceStatus]:
        """Produces a snapshot list of all resource states."""
        with self._manager_lock:
            return [res.get_status() for res in self.resources.values()]

    def _get_held_ranks(self, process_id: str) -> Set[int]:
        """Helper returning the set of order ranks of all resources currently held by a process."""
        ranks: Set[int] = set()
        allocations = self.active_allocations.get(process_id, [])
        for rec in allocations:
            if rec.resource_id in self.resources:
                ranks.add(self.resources[rec.resource_id].order_rank)
        return ranks
