"""Comprehensive Unit Test Suite for VGARSS Resource Management & Synchronization.

Covers:
- Capacity constraints & over-allocation prevention
- Simultaneous capacity-one requests (mutex contention)
- Allocation conflicts (exclusive vs exclusive, exclusive vs shared)
- Repeated requests (duplicate allocation validation)
- Unauthorized release protection
- Deadlock detection via Wait-For Graph (WFG) cycle analysis
- Deadlock prevention via Global Resource Ordering
- Banker's Algorithm safety and resource request checks
- Cancellation, abort, and disconnect recovery (zero lost wakeups)
- Legal OS WAITING transitions integrated with SimulationEngine
"""
import pytest
from backend.app.simulation.models import (
    ProcessDefinition,
    ProcessState,
)
from backend.app.simulation.schedulers import FCFSScheduler
from backend.app.simulation.engine import SimulationEngine
from backend.app.simulation.resources import (
    ResourceMode,
    ResourceType,
    ResourceDefinition,
    Resource,
    ResourceManager,
    BankersAlgorithm,
)
from backend.app.simulation.resources.models import (
    OverAllocationError,
    UnauthorizedReleaseError,
    DuplicateAllocationError,
    LockOrderingViolationError,
)


# ============================================================================
# 1. ATOMIC ALLOCATION & CAPACITY CONSTRAINTS
# ============================================================================

def test_mutex_capacity_one_exclusive_contention():
    """Simultaneous requests for a capacity-1 mutex: first granted, second blocked."""
    r_def = ResourceDefinition(id="MUTEX_CPU", name="CPU Mutex", total_capacity=1, resource_type=ResourceType.MUTEX)
    res = Resource(r_def)

    # Process 1 acquires
    assert res.try_acquire("P1", mode=ResourceMode.EXCLUSIVE, units=1) is True
    assert res.available_units == 0
    assert res.exclusive_holder == "P1"
    assert res.is_held_by("P1") is True

    # Process 2 attempts acquisition -> must be denied and enqueued in wait queue
    assert res.try_acquire("P2", mode=ResourceMode.EXCLUSIVE, units=1) is False
    assert res.available_units == 0
    assert len(res.wait_queue) == 1
    assert res.wait_queue[0].process_id == "P2"


def test_over_allocation_prevention():
    """Requesting more units than total resource capacity raises OverAllocationError."""
    r_def = ResourceDefinition(id="SEM_MEM", name="Memory Semaphore", total_capacity=3, resource_type=ResourceType.SEMAPHORE)
    res = Resource(r_def)

    with pytest.raises(OverAllocationError):
        res.try_acquire("P1", mode=ResourceMode.SHARED, units=5)


def test_shared_vs_exclusive_conflicts():
    """Tests shared reader concurrency and exclusive writer mutual exclusion."""
    r_def = ResourceDefinition(id="RW_BUF", name="Shared Buffer", total_capacity=4, resource_type=ResourceType.SEMAPHORE)
    res = Resource(r_def)

    # P1 acquires SHARED 2 units -> Granted
    assert res.try_acquire("P1", mode=ResourceMode.SHARED, units=2) is True
    assert res.available_units == 2

    # P2 acquires SHARED 1 unit -> Granted concurrently
    assert res.try_acquire("P2", mode=ResourceMode.SHARED, units=1) is True
    assert res.available_units == 1

    # P3 attempts EXCLUSIVE -> Denied because active shared readers exist
    assert res.try_acquire("P3", mode=ResourceMode.EXCLUSIVE, units=1) is False
    assert len(res.wait_queue) == 1
    assert res.wait_queue[0].process_id == "P3"

    # P4 attempts SHARED -> Denied because exclusive writer P3 is waiting ahead in queue (prevents starvation)
    assert res.try_acquire("P4", mode=ResourceMode.SHARED, units=1) is False


# ============================================================================
# 2. REPEATED REQUESTS & UNAUTHORIZED RELEASES
# ============================================================================

def test_duplicate_allocation_rejection():
    """Process already holding an exclusive lock cannot re-request without release."""
    r_def = ResourceDefinition(id="LOCK_A", name="Lock A", total_capacity=1)
    res = Resource(r_def)

    assert res.try_acquire("P1", mode=ResourceMode.EXCLUSIVE) is True

    # Duplicate acquisition raises DuplicateAllocationError
    with pytest.raises(DuplicateAllocationError):
        res.try_acquire("P1", mode=ResourceMode.EXCLUSIVE)


def test_unauthorized_release_prevention():
    """Process cannot release a resource held by another process or unheld resource."""
    r_def = ResourceDefinition(id="MUTEX_1", name="Mutex 1", total_capacity=1)
    res = Resource(r_def)

    res.try_acquire("P1", mode=ResourceMode.EXCLUSIVE)

    # P2 attempts to release P1's lock -> UnauthorizedReleaseError
    with pytest.raises(UnauthorizedReleaseError):
        res.release("P2")

    # Releasing when free -> UnauthorizedReleaseError
    res.release("P1")
    with pytest.raises(UnauthorizedReleaseError):
        res.release("P1")


# ============================================================================
# 3. ATOMIC RELEASE & ZERO LOST WAKEUPS
# ============================================================================

def test_atomic_release_wakes_waiters():
    """Releasing a resource atomically awakens the next queued waiter without lost wakeups."""
    r_def = ResourceDefinition(id="SEM_TOKENS", name="Tokens", total_capacity=1)
    res = Resource(r_def)

    res.try_acquire("P1", mode=ResourceMode.EXCLUSIVE)
    res.try_acquire("P2", mode=ResourceMode.EXCLUSIVE)
    res.try_acquire("P3", mode=ResourceMode.EXCLUSIVE)

    assert res.exclusive_holder == "P1"
    assert len(res.wait_queue) == 2

    # P1 releases -> P2 is awakened and given the lock
    awakened = res.release("P1")
    assert awakened == ["P2"]
    assert res.exclusive_holder == "P2"
    assert len(res.wait_queue) == 1

    # P2 releases -> P3 is awakened and given the lock
    awakened = res.release("P2")
    assert awakened == ["P3"]
    assert res.exclusive_holder == "P3"
    assert len(res.wait_queue) == 0


# ============================================================================
# 4. DEADLOCK DETECTION (WAIT-FOR GRAPH CYCLE DETECTION)
# ============================================================================

def test_deadlock_detection_circular_wait():
    """Detects classic circular wait deadlock: P1 holds R1, wants R2; P2 holds R2, wants R1."""
    mgr = ResourceManager(enable_resource_ordering=False)
    r1 = mgr.register_resource(ResourceDefinition(id="R1", name="Resource 1", total_capacity=1))
    r2 = mgr.register_resource(ResourceDefinition(id="R2", name="Resource 2", total_capacity=1))

    # P1 acquires R1, P2 acquires R2
    assert mgr.acquire("P1", "R1") is True
    assert mgr.acquire("P2", "R2") is True

    # No deadlock yet
    assert mgr.check_deadlock() is None

    # P1 requests R2 -> blocked, waits for P2
    assert mgr.acquire("P1", "R2") is False

    # Still no cycle (P1 -> P2)
    assert mgr.check_deadlock() is None

    # P2 requests R1 -> blocked, waits for P1 (creates cycle P1 -> P2 -> P1)
    assert mgr.acquire("P2", "R1") is False

    # Cycle MUST be detected now
    cycle = mgr.check_deadlock()
    assert cycle is not None
    assert set(cycle.processes) == {"P1", "P2"}
    assert set(cycle.involved_resources) == {"R1", "R2"}
    assert "Circular wait deadlock detected" in cycle.description


# ============================================================================
# 5. DEADLOCK PREVENTION (GLOBAL RESOURCE ORDERING)
# ============================================================================

def test_resource_ordering_deadlock_prevention():
    """Enforces global linear resource ordering to prevent circular wait."""
    mgr = ResourceManager(enable_resource_ordering=True)
    mgr.register_resource(ResourceDefinition(id="R1", name="Resource 1", total_capacity=1, order_rank=1))
    mgr.register_resource(ResourceDefinition(id="R2", name="Resource 2", total_capacity=1, order_rank=2))

    # P1 acquires R1 (rank 1), then R2 (rank 2 > 1) -> Allowed!
    assert mgr.acquire("P1", "R1") is True
    assert mgr.acquire("P1", "R2") is True

    # P2 acquires R2 (rank 2)
    # Then attempts to acquire R1 (rank 1 <= 2) -> LockOrderingViolationError!
    mgr.register_resource(ResourceDefinition(id="R3", name="Resource 3", total_capacity=1, order_rank=3))
    assert mgr.acquire("P2", "R3") is True

    with pytest.raises(LockOrderingViolationError, match="Lock ordering violation"):
        mgr.acquire("P2", "R1")


# ============================================================================
# 6. BANKER'S ALGORITHM (SAFETY & RESOURCE REQUESTS)
# ============================================================================

def test_bankers_algorithm_safety_and_denial():
    """Tests Banker's algorithm safe sequence discovery and denial of unsafe requests."""
    # 3 resources: A(10), B(5), C(7)
    total_res = {"A": 10, "B": 5, "C": 7}
    banker = BankersAlgorithm(total_resources=total_res)

    # Register 3 processes with maximum claims
    banker.register_process("P0", {"A": 7, "B": 5, "C": 3})
    banker.register_process("P1", {"A": 3, "B": 2, "C": 2})
    banker.register_process("P2", {"A": 9, "B": 0, "C": 2})

    # P1 requests allocation (safe)
    granted, msg = banker.request_resources("P1", {"A": 2, "B": 0, "C": 0})
    assert granted is True
    assert "safe state" in msg

    # Safe sequence exists
    is_safe, seq = banker.is_safe_state()
    assert is_safe is True
    assert len(seq) == 3

    # Exceeding maximum claim raises ValueError
    with pytest.raises(ValueError, match="exceeding its remaining need"):
        banker.request_resources("P1", {"A": 5, "B": 0, "C": 0})

    # Setup an initial allocation for P2 so A has limited availability
    # P2 requests A: 3, C: 2
    granted, _ = banker.request_resources("P2", {"A": 3, "B": 0, "C": 2})
    assert granted is True

    # P0 requests B: 1
    granted, _ = banker.request_resources("P0", {"A": 0, "B": 1, "C": 0})
    assert granted is True

    # Now available: A: 5, B: 4, C: 5
    # If P0 requests B: 3:
    # Available B becomes 1.
    # P0 needs A:7 (only 5 available -> cannot finish)
    # P1 needs B:2 (only 1 available -> cannot finish)
    # P2 needs A:6 (only 5 available -> cannot finish)
    # No process can finish! Strictly unsafe state.
    granted, msg = banker.request_resources("P0", {"A": 0, "B": 3, "C": 0})
    assert granted is False
    assert "unsafe state" in msg


# ============================================================================
# 7. CANCELLATION & DISCONNECT RECOVERY
# ============================================================================

def test_process_disconnect_recovery_releases_all_locks():
    """When a process disconnects or cancels, all held locks are freed and waiters are awakened."""
    mgr = ResourceManager()
    mgr.register_resource(ResourceDefinition(id="MUTEX_NET", name="Net Mutex", total_capacity=1))
    mgr.register_resource(ResourceDefinition(id="SEM_IO", name="IO Sem", total_capacity=2, resource_type=ResourceType.SEMAPHORE))

    # P1 acquires MUTEX_NET and 2 units of SEM_IO
    mgr.acquire("P1", "MUTEX_NET")
    mgr.acquire("P1", "SEM_IO", mode=ResourceMode.SHARED, units=2)

    # P2 and P3 are waiting
    mgr.acquire("P2", "MUTEX_NET")
    mgr.acquire("P3", "SEM_IO", mode=ResourceMode.SHARED, units=1)

    # P1 disconnects
    awakened = mgr.handle_process_disconnect("P1")

    # Both P2 and P3 must be awakened!
    assert "P2" in awakened
    assert "P3" in awakened

    # MUTEX_NET is now held by P2
    r_net = mgr.get_resource("MUTEX_NET")
    assert r_net.exclusive_holder == "P2"

    # SEM_IO is now held by P3
    r_io = mgr.get_resource("SEM_IO")
    assert r_io.shared_holders == {"P3": 1}
    assert r_io.available_units == 1


# ============================================================================
# 8. INTEGRATED LEGAL WAITING TRANSITIONS (ENGINE + SCHEDULER)
# ============================================================================

def test_simulation_engine_waiting_transitions():
    """Verifies RUNNING -> WAITING on lock contention and WAITING -> READY on lock release."""
    mgr = ResourceManager()
    mgr.register_resource(ResourceDefinition(id="R_CRITICAL", name="Critical Section", total_capacity=1))

    procs = [
        ProcessDefinition(id="P1", arrival_time=0, burst_time=5),
        ProcessDefinition(id="P2", arrival_time=0, burst_time=5),
    ]
    engine = SimulationEngine(scheduler=FCFSScheduler(), processes=procs, resource_manager=mgr)

    # Tick 0: P1 is dispatched to RUNNING
    engine.step()
    p1 = engine.get_pcb("P1")
    p2 = engine.get_pcb("P2")
    assert p1.state == ProcessState.RUNNING

    # P1 acquires R_CRITICAL -> Granted
    assert engine.request_resource("P1", "R_CRITICAL") is True

    # P2 attempts to acquire R_CRITICAL while in ready queue or dispatched -> Blocked!
    # Transition P2 to WAITING
    assert engine.request_resource("P2", "R_CRITICAL") is False
    assert p2.state == ProcessState.WAITING
    assert p2 in engine.waiting_queue
    assert p2 not in engine.ready_queue

    # P1 runs to completion
    while p1.state != ProcessState.TERMINATED:
        engine.step()

    # Upon P1 termination, R_CRITICAL is automatically released!
    # P2 is awakened and transitions WAITING -> READY!
    assert p2.state == ProcessState.READY
    assert p2 in engine.ready_queue
    assert p2 not in engine.waiting_queue

    # Step engine: P2 is dispatched to RUNNING and runs until termination
    engine.run_until_completion()
    assert p2.state == ProcessState.TERMINATED
    assert engine.is_completed()
