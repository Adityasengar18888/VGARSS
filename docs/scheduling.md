# VGARSS — CPU Scheduling Engine Specification & Semantics

**Document Version**: 1.0.0  
**Engine Implementation**: Python 3.12 (`backend/app/simulation/`)  
**Clock Mechanism**: Discrete Logical Simulation Clock (Tick-Driven, Zero Wall-Clock Sleep)  
**Test Suite**: `tests/backend/test_schedulers.py` (17/17 Passed)  

---

## 1. Architectural Philosophy & Separation of Concerns

The VGARSS CPU Scheduling Engine is designed as a standalone, deterministic domain kernel completely decoupled from transport protocols (REST, WebSockets, TCP sockets) and presentation interfaces (React UI).

- **Logical Simulation Clock**: The engine operates purely on discrete clock units (`current_tick = 0, 1, 2, ...`). It advances explicitly through `step()` or `run_until_completion()`, ensuring:
  1. Microsecond-fast automated test execution without relying on `time.sleep()`.
  2. Perfectly reproducible, deterministic execution traces for any given workload.
  3. Interactive stepping capability (1 tick at a time) for visual debugging.

---

## 2. Process Control Block (PCB) & 5-State Machine

Every process admitted to the simulation is encapsulated within a mutable `ProcessControlBlock` (PCB) tracking lifecycle states and discrete timing events.

### 2.1 State Definitions & Lifecycle Invariants

```
   [ Admission ]
         |
         v
     +-------+       Arrival Tick Reached       +---------+
     |  NEW  | -------------------------------> |  READY  |
     +-------+                                  +---------+
                                                     |  ^
                                      CPU Dispatcher |  | Preemption (Quantum / Higher Priority)
                                                     v  |
                                                +---------+
                                                | RUNNING |
                                                +---------+
                                                     |
                                  Remaining Burst == 0
                                                     v
                                              +------------+
                                              | TERMINATED |
                                              +------------+
```

| State Enum | Invariant / Description |
| :--- | :--- |
| `NEW` | The process definition is ingested, but the simulation clock has not yet reached its `arrival_time` (`current_tick < arrival_time`). |
| `READY` | The process has arrived (`current_tick >= arrival_time`) and is waiting in the Ready Queue for CPU dispatch. |
| `RUNNING` | The process is currently allocated the CPU and executing its burst. |
| `WAITING` | The process is temporarily blocked waiting for a synchronized shared resource (Mutex or Semaphore). |
| `TERMINATED`| The process remaining CPU burst has reached 0. Completion time and final metrics are computed and sealed. |

### 2.2 PCB Data Fields

```python
class ProcessControlBlock:
    id: str                     # Process identifier (e.g. 'P1')
    arrival_time: int           # Logical tick when process enters system
    burst_time: int             # Total CPU time required (> 0)
    remaining_time: int         # CPU time remaining to execute
    priority: int               # Current effective priority (lower = higher priority)
    base_priority: int          # Initial priority assigned at creation
    state: ProcessState         # NEW | READY | RUNNING | WAITING | TERMINATED
    start_time: Optional[int]   # Tick when process was FIRST dispatched to CPU
    completion_time: Optional[int] # Tick when process completed its final burst
    waiting_time: int           # Total ticks spent waiting in READY queue
    turnaround_time: int        # Completion Time - Arrival Time
    response_time: int          # Start Time - Arrival Time
    ticks_in_ready: int         # Consecutive/cumulative ticks in READY (used for aging)
    admission_order: int        # Stable index assigned during ingestion
```

---

## 3. Scheduling Algorithms & Deterministic Tie-Breaking

### 3.1 First-Come, First-Served (FCFS)
- **Classification**: Non-preemptive.
- **Dispatch Criteria**: Evaluates all processes currently in `ready_queue`. Selects the candidate with the earliest `arrival_time`.
- **Tie-Breaking**: If arrival times are identical, breaks ties using `admission_order` (the caller's insertion sequence), followed by `process_id` lexicographically.
- **Preemption**: None (`should_preempt` always returns `False`).

### 3.2 Shortest Job First (SJF - Non-Preemptive)
- **Classification**: Non-preemptive.
- **Dispatch Criteria**: Selects the candidate from `ready_queue` with the smallest initial `burst_time`.
- **Tie-Breaking**: Smallest `burst_time` $\to$ earliest `arrival_time` $\to$ `admission_order` $\to$ `process_id`.
- **Preemption**: None. Once dispatched, runs until `remaining_time == 0`.

### 3.3 Shortest Remaining Time First (SRTF - Preemptive SJF)
- **Classification**: Preemptive.
- **Dispatch Criteria**: Selects the candidate with the smallest `remaining_time`.
- **Preemption Rule**: At each tick, if any process in the `ready_queue` has `candidate.remaining_time < running.remaining_time`, the running process is preempted, returned to `ready_queue`, and the shorter candidate is dispatched.

### 3.4 Round Robin (RR)
- **Classification**: Preemptive with time quantum $Q \ge 1$.
- **Dispatch Criteria**: Ready Queue is treated as a First-In, First-Out (FIFO) queue. The head of the queue is dispatched.
- **Preemption Rule**:
  - A tick counter `current_quantum_ticks` tracks consecutive ticks the current process has run.
  - When `current_quantum_ticks >= Q` and other processes are waiting in `ready_queue`, the running process is preempted and appended to the tail of `ready_queue`.
  - `current_quantum_ticks` resets to 0.

### 3.5 Priority Scheduling (Preemptive & Non-Preemptive with Aging)
- **Classification**: Configurable (`is_preemptive: bool`).
- **Priority Convention**: Lower numerical value = Higher priority (e.g., Priority `1` > Priority `5`).
- **Preemption Rule** (when `is_preemptive=True`): If a newly arrived process in `ready_queue` has `candidate.priority < running.priority`, the running process is preempted.
- **Starvation Mitigation (Priority Aging)**:
  - Configurable `aging_interval` $W > 0$.
  - At the end of every tick, for each process residing in `ready_queue`:
    - Increment `ticks_in_ready += 1`.
    - If `ticks_in_ready % aging_interval == 0` and `priority > 1`:
      $$\text{priority} \leftarrow \text{priority} - 1$$
    - This guarantees that even the lowest-priority process eventually achieves Priority 1 and executes, completely preventing starvation.

---

## 4. Mathematical Metric Formulas

The simulation engine implements exact standard Operating Systems metrics:

### 4.1 Turnaround Time ($TAT$)
The total elapsed time from when a process is submitted to when it completes execution:
$$\text{TAT} = T_{\text{completion}} - T_{\text{arrival}}$$

### 4.2 Waiting Time ($WT$)
The total cumulative time a process spent waiting in the `READY` queue:
$$\text{WT} = \text{TAT} - T_{\text{burst}}$$
*Invariant*: In the discrete simulation engine, this strictly equals the count of ticks during which the process was in `ProcessState.READY`.

### 4.3 Response Time ($RT$)
The time from process arrival to its first dispatch on the CPU:
$$\text{RT} = T_{\text{start\_time}} - T_{\text{arrival}}$$

### 4.4 CPU Utilization ($\%$)
The percentage of simulation time during which the CPU was actively executing a process burst:
$$\text{CPU Utilization} = \left( \frac{T_{\text{busy\_ticks}}}{T_{\text{total\_ticks}}} \right) \times 100\% \quad (T_{\text{total}} > 0)$$

### 4.5 Throughput
The number of processes completed per unit of simulation time:
$$\text{Throughput} = \frac{N_{\text{terminated}}}{T_{\text{total\_ticks}}} \quad (T_{\text{total}} > 0)$$

---

## 5. Gantt Chart & Discrete Event Tracing

At every tick $t$, the simulation engine emits a `GanttEntry`:

```python
class GanttEntry:
    tick: int                         # Logical tick offset (0, 1, 2, ...)
    process_id: Optional[str]         # Running process ID (or None if CPU is idle)
    state: str                        # "RUNNING" or "IDLE"
```

### CPU Idle Intervals
When no process has arrived or all arrived processes have terminated while others arrive in the future, the engine accurately logs:
`GanttEntry(tick=t, process_id=None, state="IDLE")`
and increments `idle_ticks += 1`, correctly depressing CPU utilization.

---

## 6. Automated Pytest Verification Results

The test suite in [`tests/backend/test_schedulers.py`](file:///c:/Users/Welcome/OneDrive/Desktop/os%20cn%20project/tests/backend/test_schedulers.py) was executed against Python 3.12:

```text
============================= test session starts =============================
platform win32 -- Python 3.12.12, pytest-9.2.0, pluggy-1.7.0
rootdir: C:\Users\Welcome\OneDrive\Desktop\os cn project
configfile: pyproject.toml
plugins: anyio-4.15.1, asyncio-1.4.1

tests/backend/test_health.py::test_root_endpoint PASSED                  [  5%]
tests/backend/test_health.py::test_health_endpoint PASSED                [ 11%]
tests/backend/test_schedulers.py::test_invalid_burst_time_raises_error PASSED [ 17%]
tests/backend/test_schedulers.py::test_invalid_arrival_time_raises_error PASSED [ 23%]
tests/backend/test_schedulers.py::test_invalid_empty_process_id_raises_error PASSED [ 29%]
tests/backend/test_schedulers.py::test_duplicate_process_ids_raises_error PASSED [ 35%]
tests/backend/test_schedulers.py::test_invalid_round_robin_quantum_raises_error PASSED [ 41%]
tests/backend/test_schedulers.py::test_fcfs_execution_and_metrics PASSED [ 47%]
tests/backend/test_schedulers.py::test_fcfs_deterministic_tie_breaking PASSED [ 52%]
tests/backend/test_schedulers.py::test_sjf_non_preemptive_scheduling PASSED [ 58%]
tests/backend/test_schedulers.py::test_srtf_preemption_on_shorter_arrival PASSED [ 64%]
tests/backend/test_schedulers.py::test_round_robin_quantum_preemption PASSED [ 70%]
tests/backend/test_schedulers.py::test_priority_non_preemptive PASSED    [ 76%]
tests/backend/test_schedulers.py::test_priority_preemptive PASSED        [ 82%]
tests/backend/test_schedulers.py::test_priority_aging_starvation_mitigation PASSED [ 88%]
tests/backend/test_schedulers.py::test_cpu_idle_gap PASSED               [ 94%]
tests/backend/test_schedulers.py::test_mid_run_dynamic_arrival PASSED    [100%]

============================= 17 passed in 0.39s ==============================
```

### Verified Scenarios Summary
1. **Invalid Bursts & Arrivals**: Validates that burst time $\le 0$, arrival time $< 0$, and whitespace IDs raise validation errors.
2. **Duplicate IDs**: Validates that duplicate IDs raise a clear `ValueError`.
3. **Invalid Quantum**: Validates that Round Robin quantum $\le 0$ raises `ValueError`.
4. **FCFS Execution**: Verified exact Gantt progression, completion times, and metric averages.
5. **Deterministic Tie-Breaking**: Verified stable admission order tie-breaking for simultaneous arrivals.
6. **Non-preemptive SJF**: Verified selection of shortest total burst among available ready processes.
7. **Preemptive SRTF**: Verified immediate preemption of running process when a shorter burst arrives.
8. **Round Robin**: Verified time-slicing by quantum ($Q=2$) and queue tail reinsertion.
9. **Priority Scheduling**: Verified non-preemptive and preemptive dispatch by priority rank.
10. **Priority Aging**: Verified automatic priority boost every $W$ waiting ticks.
11. **CPU Idle Gaps**: Verified idle ticks, idle Gantt entries, and depressed CPU utilization during arrival gaps.
12. **Mid-Run Arrivals**: Verified dynamic process injection while simulation is actively executing.
