"""Comprehensive Unit Test Suite for VGARSS CPU Scheduling Engine.

Covers:
- Process validation (invalid bursts, invalid arrivals, duplicate IDs)
- Arrival times and sequencing
- Deterministic tie-breaking
- FCFS, SJF (non-preemptive), SRTF (preemptive SJF), Round Robin, and Priority
- Preemption & quantum expiration
- CPU idle gaps
- Mid-run dynamic arrivals
- Priority aging starvation mitigation
- Accurate metrics (Waiting, Turnaround, Response, CPU Utilization, Throughput)
"""
import pytest
from pydantic import ValidationError
from backend.app.simulation.models import (
    ProcessDefinition,
    ProcessState,
)
from backend.app.simulation.schedulers import (
    FCFSScheduler,
    SJFScheduler,
    RoundRobinScheduler,
    PriorityScheduler,
)
from backend.app.simulation.engine import SimulationEngine


# ============================================================================
# 1. VALIDATION & INPUT INTEGRITY TESTS
# ============================================================================

def test_invalid_burst_time_raises_error():
    """Burst time must be strictly positive (> 0)."""
    with pytest.raises(ValidationError):
        ProcessDefinition(id="P1", arrival_time=0, burst_time=0)

    with pytest.raises(ValidationError):
        ProcessDefinition(id="P2", arrival_time=0, burst_time=-5)


def test_invalid_arrival_time_raises_error():
    """Arrival time must be non-negative (>= 0)."""
    with pytest.raises(ValidationError):
        ProcessDefinition(id="P1", arrival_time=-1, burst_time=5)


def test_invalid_empty_process_id_raises_error():
    """Process ID cannot be blank or whitespace."""
    with pytest.raises(ValidationError):
        ProcessDefinition(id="   ", arrival_time=0, burst_time=4)


def test_duplicate_process_ids_raises_error():
    """Duplicate process IDs in the workload must be rejected."""
    procs = [
        ProcessDefinition(id="P1", arrival_time=0, burst_time=3),
        ProcessDefinition(id="P1", arrival_time=2, burst_time=4),
    ]
    with pytest.raises(ValueError, match="Duplicate process ID"):
        SimulationEngine(scheduler=FCFSScheduler(), processes=procs)


def test_invalid_round_robin_quantum_raises_error():
    """Round Robin quantum must be an integer >= 1."""
    with pytest.raises(ValueError, match="Time quantum must be a positive integer"):
        RoundRobinScheduler(time_quantum=0)

    with pytest.raises(ValueError, match="Time quantum must be a positive integer"):
        RoundRobinScheduler(time_quantum=-2)


# ============================================================================
# 2. FCFS (FIRST-COME, FIRST-SERVED) SCHEDULING TESTS
# ============================================================================

def test_fcfs_execution_and_metrics():
    """Tests FCFS scheduling order and verifies exact turnaround, waiting, and response times."""
    procs = [
        ProcessDefinition(id="P1", arrival_time=0, burst_time=3),
        ProcessDefinition(id="P2", arrival_time=2, burst_time=2),
        ProcessDefinition(id="P3", arrival_time=4, burst_time=1),
    ]
    engine = SimulationEngine(scheduler=FCFSScheduler(), processes=procs)
    engine.run_until_completion()

    # Timeline:
    # t=0..3: P1 executes (finishes at t=3)
    # t=3..5: P2 executes (finishes at t=5)
    # t=5..6: P3 executes (finishes at t=6)
    p1 = engine.get_pcb("P1")
    p2 = engine.get_pcb("P2")
    p3 = engine.get_pcb("P3")

    assert p1.completion_time == 3
    assert p1.turnaround_time == 3  # 3 - 0
    assert p1.waiting_time == 0     # 3 - 3
    assert p1.response_time == 0    # 0 - 0

    assert p2.completion_time == 5
    assert p2.turnaround_time == 3  # 5 - 2
    assert p2.waiting_time == 1     # 3 - 2
    assert p2.response_time == 1    # 3 - 2

    assert p3.completion_time == 6
    assert p3.turnaround_time == 2  # 6 - 4
    assert p3.waiting_time == 1     # 2 - 1
    assert p3.response_time == 1    # 5 - 4

    metrics = engine.get_metrics()
    assert metrics.total_ticks == 6
    assert metrics.busy_ticks == 6
    assert metrics.idle_ticks == 0
    assert metrics.cpu_utilization == 100.0
    assert metrics.avg_turnaround_time == round((3 + 3 + 2) / 3, 2)  # 2.67
    assert metrics.avg_waiting_time == round((0 + 1 + 1) / 3, 2)     # 0.67
    assert metrics.avg_response_time == round((0 + 1 + 1) / 3, 2)    # 0.67


def test_fcfs_deterministic_tie_breaking():
    """When processes arrive simultaneously, admission order / ID breaks ties deterministically."""
    procs = [
        ProcessDefinition(id="P2", arrival_time=0, burst_time=2),
        ProcessDefinition(id="P1", arrival_time=0, burst_time=2),
    ]
    engine = SimulationEngine(scheduler=FCFSScheduler(), processes=procs)
    engine.run_until_completion()

    # P2 was ingested first, so P2 runs first
    p2 = engine.get_pcb("P2")
    p1 = engine.get_pcb("P1")
    assert p2.completion_time == 2
    assert p1.completion_time == 4


# ============================================================================
# 3. SJF (NON-PREEMPTIVE) SCHEDULING TESTS
# ============================================================================

def test_sjf_non_preemptive_scheduling():
    """Tests non-preemptive Shortest Job First with mid-run arrivals and tie-breaking."""
    procs = [
        ProcessDefinition(id="P1", arrival_time=0, burst_time=7),
        ProcessDefinition(id="P2", arrival_time=2, burst_time=4),
        ProcessDefinition(id="P3", arrival_time=4, burst_time=1),
        ProcessDefinition(id="P4", arrival_time=5, burst_time=4),
    ]
    engine = SimulationEngine(scheduler=SJFScheduler(is_preemptive=False), processes=procs)
    engine.run_until_completion()

    # P1 starts at t=0, runs non-preemptively until t=7.
    # At t=7, Ready Queue has P3(burst 1), P2(burst 4), P4(burst 4).
    # Smallest burst is P3(1) -> runs t=7..8.
    # At t=8, P2 and P4 both have burst 4. Tie-break: arrival time P2(2) < P4(5).
    # P2 runs t=8..12.
    # P4 runs t=12..16.
    p1 = engine.get_pcb("P1")
    p3 = engine.get_pcb("P3")
    p2 = engine.get_pcb("P2")
    p4 = engine.get_pcb("P4")

    assert p1.completion_time == 7
    assert p3.completion_time == 8
    assert p2.completion_time == 12
    assert p4.completion_time == 16


# ============================================================================
# 4. SRTF (PREEMPTIVE SJF) SCHEDULING TESTS
# ============================================================================

def test_srtf_preemption_on_shorter_arrival():
    """Tests that a newly arrived process with smaller remaining burst preempts the running process."""
    procs = [
        ProcessDefinition(id="P1", arrival_time=0, burst_time=8),
        ProcessDefinition(id="P2", arrival_time=1, burst_time=4),
        ProcessDefinition(id="P3", arrival_time=2, burst_time=9),
        ProcessDefinition(id="P4", arrival_time=3, burst_time=2),
    ]
    engine = SimulationEngine(scheduler=SJFScheduler(is_preemptive=True), processes=procs)
    engine.run_until_completion()

    # t=0..1: P1 runs (remaining: 7).
    # t=1: P2 arrives (burst 4 < 7). P2 preempts P1!
    # t=1..3: P2 runs (remaining: 2).
    # t=3: P4 arrives (burst 2). P2 has remaining 2. No preemption (P2 continues).
    # t=3..5: P2 finishes at t=5.
    # At t=5, candidates: P4(remaining 2), P1(remaining 7), P3(remaining 9).
    # P4 runs t=5..7 (finishes at t=7).
    # P1 runs t=7..14 (finishes at t=14).
    # P3 runs t=14..23 (finishes at t=23).
    p1 = engine.get_pcb("P1")
    p2 = engine.get_pcb("P2")
    p3 = engine.get_pcb("P3")
    p4 = engine.get_pcb("P4")

    assert p2.completion_time == 5
    assert p4.completion_time == 7
    assert p1.completion_time == 14
    assert p3.completion_time == 23

    # Check that P1 was preempted and resumed
    assert p1.start_time == 0
    assert p1.response_time == 0
    assert p1.turnaround_time == 14
    assert p1.waiting_time == 6  # 14 - 8


# ============================================================================
# 5. ROUND ROBIN SCHEDULING TESTS
# ============================================================================

def test_round_robin_quantum_preemption():
    """Tests Round Robin time-slicing and rotation with quantum = 2."""
    procs = [
        ProcessDefinition(id="P1", arrival_time=0, burst_time=5),
        ProcessDefinition(id="P2", arrival_time=0, burst_time=3),
    ]
    engine = SimulationEngine(scheduler=RoundRobinScheduler(time_quantum=2), processes=procs)
    engine.run_until_completion()

    # Sequence of Gantt ticks:
    # t=0..2: P1 executes 2 ticks (remaining: 3) -> preempted
    # t=2..4: P2 executes 2 ticks (remaining: 1) -> preempted
    # t=4..6: P1 executes 2 ticks (remaining: 1) -> preempted
    # t=6..7: P2 executes 1 tick (finishes at t=7)
    # t=7..8: P1 executes 1 tick (finishes at t=8)
    gantt = [e.process_id for e in engine.gantt_chart]
    assert gantt == ["P1", "P1", "P2", "P2", "P1", "P1", "P2", "P1"]

    p1 = engine.get_pcb("P1")
    p2 = engine.get_pcb("P2")
    assert p2.completion_time == 7
    assert p1.completion_time == 8


# ============================================================================
# 6. PRIORITY SCHEDULING TESTS
# ============================================================================

def test_priority_non_preemptive():
    """Non-preemptive priority: lower numerical value = higher priority."""
    procs = [
        ProcessDefinition(id="P1", arrival_time=0, burst_time=4, priority=3),
        ProcessDefinition(id="P2", arrival_time=0, burst_time=2, priority=1),
        ProcessDefinition(id="P3", arrival_time=0, burst_time=3, priority=2),
    ]
    engine = SimulationEngine(scheduler=PriorityScheduler(is_preemptive=False), processes=procs)
    engine.run_until_completion()

    # P2 (priority 1) -> P3 (priority 2) -> P1 (priority 3)
    p2 = engine.get_pcb("P2")
    p3 = engine.get_pcb("P3")
    p1 = engine.get_pcb("P1")

    assert p2.completion_time == 2
    assert p3.completion_time == 5
    assert p1.completion_time == 9


def test_priority_preemptive():
    """Preemptive priority: high-priority arrival preempts lower-priority running process."""
    procs = [
        ProcessDefinition(id="P1", arrival_time=0, burst_time=6, priority=4),
        ProcessDefinition(id="P2", arrival_time=2, burst_time=2, priority=1),
    ]
    engine = SimulationEngine(scheduler=PriorityScheduler(is_preemptive=True), processes=procs)
    engine.run_until_completion()

    # t=0..2: P1 runs (remaining 4)
    # t=2: P2 arrives with priority 1 (higher than 4). Preempts P1!
    # t=2..4: P2 runs and completes at t=4.
    # t=4..8: P1 resumes and completes at t=8.
    p2 = engine.get_pcb("P2")
    p1 = engine.get_pcb("P1")

    assert p2.completion_time == 4
    assert p1.completion_time == 8


def test_priority_aging_starvation_mitigation():
    """Tests that low-priority processes waiting in ready queue have their priority boosted over time."""
    # P_low has initial priority 5. Aging interval is 2 ticks.
    # P_high has burst 6, priority 1.
    procs = [
        ProcessDefinition(id="P_high", arrival_time=0, burst_time=6, priority=1),
        ProcessDefinition(id="P_low", arrival_time=0, burst_time=2, priority=5),
    ]
    # Use preemptive priority so when P_low's aged priority matches/exceeds, behavior is tracked
    scheduler = PriorityScheduler(is_preemptive=False, aging_interval=2)
    engine = SimulationEngine(scheduler=scheduler, processes=procs)

    # Step through ticks while P_high executes
    # t=0: P_high dispatched. P_low in ready queue.
    engine.step()  # t=1: P_low ticks_in_ready = 1
    p_low = engine.get_pcb("P_low")
    assert p_low.priority == 5

    engine.step()  # t=2: P_low ticks_in_ready = 2 -> aged! Priority becomes 4.
    assert p_low.priority == 4

    engine.step()  # t=3: ticks_in_ready = 3
    assert p_low.priority == 4

    engine.step()  # t=4: ticks_in_ready = 4 -> aged! Priority becomes 3.
    assert p_low.priority == 3

    # Finish simulation
    engine.run_until_completion()
    assert engine.is_completed()


# ============================================================================
# 7. CPU IDLE GAPS & MID-RUN ARRIVALS TESTS
# ============================================================================

def test_cpu_idle_gap():
    """CPU must record IDLE states and metrics accurately when no process is ready."""
    procs = [
        ProcessDefinition(id="P1", arrival_time=0, burst_time=2),
        ProcessDefinition(id="P2", arrival_time=5, burst_time=3),
    ]
    engine = SimulationEngine(scheduler=FCFSScheduler(), processes=procs)
    engine.run_until_completion()

    # t=0..2: P1 runs (finishes at t=2)
    # t=2..5: CPU is IDLE (ticks 2, 3, 4)
    # t=5..8: P2 runs (finishes at t=8)
    assert engine.current_tick == 8
    assert engine.busy_ticks == 5
    assert engine.idle_ticks == 3

    # Verify Gantt chart IDLE entries
    idle_entries = [e for e in engine.gantt_chart if e.state == "IDLE"]
    assert len(idle_entries) == 3
    assert [e.tick for e in idle_entries] == [2, 3, 4]
    assert all(e.process_id is None for e in idle_entries)

    metrics = engine.get_metrics()
    assert metrics.cpu_utilization == round((5 / 8) * 100, 2)  # 62.5%
    assert metrics.throughput == round(2 / 8, 4)                # 0.25


def test_mid_run_dynamic_arrival():
    """Verifies adding a process dynamically while simulation is actively executing."""
    procs = [
        ProcessDefinition(id="P1", arrival_time=0, burst_time=8),
    ]
    engine = SimulationEngine(scheduler=SJFScheduler(is_preemptive=True), processes=procs)

    # Step 3 ticks: P1 runs t=0, 1, 2 (remaining: 5 at t=3)
    engine.step()
    engine.step()
    engine.step()
    assert engine.current_tick == 3

    # Mid-run arrival: P_dyn arrives at t=3 with burst 2 (< remaining 5)
    dyn_proc = ProcessDefinition(id="P_dyn", arrival_time=3, burst_time=2)
    engine.add_process(dyn_proc)

    # Next step should preempt P1 and dispatch P_dyn!
    snapshot = engine.step()
    assert snapshot.gantt_entry.process_id == "P_dyn"

    engine.run_until_completion()
    p_dyn = engine.get_pcb("P_dyn")
    p1 = engine.get_pcb("P1")

    assert p_dyn.completion_time == 5  # ran t=3..5
    assert p1.completion_time == 10    # ran t=0..3, then t=5..10
