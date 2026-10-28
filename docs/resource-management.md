# VGARSS — Resource Management & Concurrency Control Specification

**Document Version**: 1.0.0  
**Implementation**: Python 3.12 (`backend/app/simulation/resources/`)  
**Primitives**: Virtual Mutexes, Counting Semaphores, Resource Manager  
**Deadlock Strategies**: Global Resource Ordering (Prevention), Banker's Algorithm (Avoidance), Wait-For Graph Cycle Detection (Detection)  
**Test Suite**: `tests/backend/test_resources.py` (11 Concurrency Tests, 28 Total Backend Tests Passing)  

---

## 1. Concurrency Architecture & Primitives

VGARSS provides a thread-safe, mathematically verified resource management subsystem that models how operating systems coordinate shared resources (such as memory buffers, I/O devices, and hardware channels) among competing concurrent processes.

```
+-------------------------------------------------------------------------------+
|                               ResourceManager                                 |
|  - Global Linear Lock Ordering (Deadlock Prevention)                          |
|  - Active Allocation Registry & Ownership Tracking                            |
|  - Disconnect / Cancellation Recovery Coordinator                             |
+-------------------------------------------------------------------------------+
             |                                              |
             v                                              v
+--------------------------+                   +--------------------------+
|  Resource: MUTEX         |                   |  Resource: SEMAPHORE     |
|  - Capacity: 1           |                   |  - Capacity: K >= 1      |
|  - Mode: EXCLUSIVE       |                   |  - Mode: SHARED / EXCL   |
|  - Single Holder         |                   |  - Multi-holder Capacity |
|  - FIFO Wait Queue       |                   |  - FIFO Wait Queue       |
|  - Reentrant Guard       |                   |  - Writer Starvation Grd |
+--------------------------+                   +--------------------------+
             |                                              |
             +----------------------+-----------------------+
                                    |
                                    v
                   +----------------------------------+
                   | Wait-For Graph (WFG) Detector    |
                   | - Bipartite RAG Projection       |
                   | - DFS Cycle Detection Algorithm  |
                   +----------------------------------+
```

---

## 2. Access Modes & Primitives

### 2.1 Access Modes

| Mode | Semantics | Capacity Constraint | Use Case |
| :--- | :--- | :--- | :--- |
| `EXCLUSIVE` | Single-owner mutual exclusion (Writer / Mutex). | Exactly 1 active holder permitted. | Critical sections, serial bus interfaces, exclusive file writes. |
| `SHARED` | Multi-token reader access (Reader / Counting Semaphore). | Total allocated units $\le$ Total Capacity. | Reader-writer locks, database connection pools, buffer slots. |

### 2.2 Synchronization Primitives

1. **Virtual Mutex**:
   - `total_capacity = 1`, `resource_type = ResourceType.MUTEX`.
   - Supports only `EXCLUSIVE` acquisition.
   - When held by process $P_A$, subsequent requests by $P_B$ fail and append $P_B$ to the mutex's wait queue.
2. **Counting Semaphore**:
   - `total_capacity = K \ge 1`, `resource_type = ResourceType.SEMAPHORE`.
   - Supports both `SHARED` multi-unit tokens and `EXCLUSIVE` reservations.
   - Prevents writer starvation: If an `EXCLUSIVE` request is pending in the wait queue, subsequent `SHARED` requests are queued rather than jumping ahead.

---

## 3. Core Concurrency Invariants

The VGARSS resource management system strictly enforces 6 core concurrency invariants:

### Invariant 1: No Over-Allocation
$$0 \le \text{available\_units} \le \text{total\_capacity}$$
$$\text{available\_units} + \sum_{p \in \text{holders}} \text{units}(p) = \text{total\_capacity}$$
Attempting to request more units than `total_capacity` immediately raises `OverAllocationError`.

### Invariant 2: No Unauthorized Release
Only the process that currently holds a resource instance is permitted to release it.
If process $P_B$ attempts to release a resource currently held by $P_A$ (or if any process attempts to release a free resource):
$$\text{owner}(R) \ne P \implies \text{raise UnauthorizedReleaseError}$$

### Invariant 3: No Duplicate Allocation
A process currently holding an exclusive lock on resource $R$ cannot re-acquire $R$ without first releasing it:
$$P \in \text{exclusive\_holder}(R) \implies \text{raise DuplicateAllocationError}$$
This eliminates unintentional re-entrant deadlocks.

### Invariant 4: Zero Lost Wakeups
Resource release is atomic. When a holding process releases units:
1. Available units are returned to the pool.
2. The waiting queue is immediately evaluated.
3. The next eligible waiter (or contiguous shared readers) is popped, allocated, and returned in the awakened list.
Waiters are guaranteed to never be stranded.

### Invariant 5: Mutex-Protected Thread Safety
All state mutations on `Resource` and `ResourceManager` are guarded by internal re-entrant locks (`threading.RLock`). The state remains atomic and consistent across concurrent thread or asyncio invocations.

### Invariant 6: Separation of Locks from Network Operations
Locks are never held during network transmission or I/O. The simulation engine and resource manager acquire locks, record mutations in memory, release the lock, and only then dispatch WebSocket or TCP network frames.

---

## 4. Legal OS Process State Transitions

When integrated with the `SimulationEngine`, resource acquisition and release directly govern the process lifecycle state machine:

```
          Lock Contention (Acquisition Fails)
  RUNNING -----------------------------------> WAITING (Blocked)
     ^                                            |
     |                                            | Lock Released / Signal
     |             CPU Dispatch                   |
     +----------------------------------------- READY
```

1. **Blocking Transition (`RUNNING` $\to$ `WAITING`)**:
   - If the currently running process executes a resource request that cannot be immediately satisfied, `request_resource()` returns `False`.
   - The process state transitions to `ProcessState.WAITING`.
   - The process is removed from the CPU (`running_process = None`), removed from `ready_queue`, and appended to `waiting_queue`.
   - The CPU is vacated, allowing other ready processes to execute or logging an `IDLE` tick.
2. **Unblocking Transition (`WAITING` $\to$ `READY`)**:
   - When the holder releases the resource (or terminates/disconnects), the resource manager returns the awakened process IDs.
   - For each awakened process:
     - Removed from `waiting_queue`.
     - State transitions to `ProcessState.READY`.
     - Appended to `ready_queue` for scheduling dispatch.
   - Invariant: A process in `WAITING` is never dispatched to the CPU.

---

## 5. Deadlock Management Strategies

VGARSS implements all three canonical Operating Systems deadlock management methodologies:

### 5.1 Deadlock Prevention: Global Linear Resource Ordering
To break Coffman's **Circular Wait** condition, every registered resource is assigned a global linear hierarchy rank:
$$O(R_1) < O(R_2) < O(R_3) < \dots < O(R_n)$$

**Ordering Rule**:
A process holding a resource with rank $k$ is only permitted to request resources with rank $j > k$:
$$\max_{R \in \text{held}(P)} O(R) \ge O(R_{\text{req}}) \implies \text{raise LockOrderingViolationError}$$
Because all processes must acquire resources in strictly increasing rank order, a directed cycle cannot form.

### 5.2 Deadlock Avoidance: Banker's Algorithm
For workloads with declared maximum resource demands, Dijkstra's Banker's Algorithm evaluates every request before granting:

- **Safety Check Algorithm**:
  1. Let $\text{Work} = \text{Available}$. Let $\text{Finish}[P_i] = \text{False}$ for all processes.
  2. Find an index $i$ such that $\text{Finish}[P_i] == \text{False}$ and $\text{Need}[P_i] \le \text{Work}$.
  3. If found: $\text{Work} \leftarrow \text{Work} + \text{Allocation}[P_i]$; $\text{Finish}[P_i] \leftarrow \text{True}$. Repeat step 2.
  4. If all $\text{Finish} == \text{True}$, system is **Safe**.
- **Denial & Rollback**:
  If granting a request would leave the system with no safe execution sequence, the tentative allocation is rolled back, the request is denied, and the process is forced to wait.

### 5.3 Deadlock Detection: Wait-For Graph (WFG) & Cycle Analysis
For workloads where maximum claims are not known in advance:
1. `WaitForGraph` maintains directed edges $P_A \to P_B$ where $P_A$ is in the wait queue of a resource currently held by $P_B$.
2. At every tick or request event, a Depth-First Search (DFS) with recursion-stack cycle detection is executed.
3. If a cycle is detected (e.g. $P_1 \to P_2 \to P_1$), the system constructs a `DeadlockCycle` object containing:
   - Participating process IDs: `['P1', 'P2']`
   - Involved resources: `['R1', 'R2']`
   - Human-readable circular wait description.

---

## 6. Cancellation & Disconnect Recovery

When a process cancels, is aborted, or abruptly disconnects (e.g., dropped socket connection):

1. **`handle_process_disconnect(process_id)`**:
   - Automatically iterates over all registered resources.
   - For every resource held by the disconnected process (exclusive or shared), force-releases the allocation.
   - Cleans the disconnected process from all pending wait queues.
   - Evaluates waiting queues and awakens eligible waiting processes.
   - Cleans up active allocation tables and Banker's algorithm claims.
2. **Process PCB Update**:
   - If the disconnected process was `RUNNING`, vacates the CPU.
   - Removes the process from `new_processes`, `ready_queue`, and `waiting_queue`.
   - Sets state to `TERMINATED` and finalizes timestamps.
   - Awakened waiting processes cleanly transition from `WAITING` $\to$ `READY`.

---

## 7. Verification & Automated Test Results

The full backend test suite (`tests/backend/test_resources.py` and `tests/backend/test_schedulers.py`) was executed on Python 3.12:

```text
============================= test session starts =============================
platform win32 -- Python 3.12.12, pytest-9.2.0, pluggy-1.7.0 -- .venv\Scripts\python.exe
rootdir: C:\Users\Welcome\OneDrive\Desktop\os cn project
configfile: pyproject.toml
testpaths: tests/backend
plugins: anyio-4.15.1, asyncio-1.4.1

tests/backend/test_health.py::test_root_endpoint PASSED                  [  3%]
tests/backend/test_health.py::test_health_endpoint PASSED                [  7%]
tests/backend/test_resources.py::test_mutex_capacity_one_exclusive_contention PASSED [ 10%]
tests/backend/test_resources.py::test_over_allocation_prevention PASSED  [ 14%]
tests/backend/test_resources.py::test_shared_vs_exclusive_conflicts PASSED [ 17%]
tests/backend/test_resources.py::test_duplicate_allocation_rejection PASSED [ 21%]
tests/backend/test_resources.py::test_unauthorized_release_prevention PASSED [ 25%]
tests/backend/test_resources.py::test_atomic_release_wakes_waiters PASSED [ 28%]
tests/backend/test_resources.py::test_deadlock_detection_circular_wait PASSED [ 32%]
tests/backend/test_resources.py::test_resource_ordering_deadlock_prevention PASSED [ 35%]
tests/backend/test_resources.py::test_bankers_algorithm_safety_and_denial PASSED [ 39%]
tests/backend/test_resources.py::test_process_disconnect_recovery_releases_all_locks PASSED [ 42%]
tests/backend/test_resources.py::test_simulation_engine_waiting_transitions PASSED [ 46%]
tests/backend/test_schedulers.py::test_invalid_burst_time_raises_error PASSED [ 50%]
tests/backend/test_schedulers.py::test_invalid_arrival_time_raises_error PASSED [ 53%]
tests/backend/test_schedulers.py::test_invalid_empty_process_id_raises_error PASSED [ 57%]
tests/backend/test_schedulers.py::test_duplicate_process_ids_raises_error PASSED [ 60%]
tests/backend/test_schedulers.py::test_invalid_round_robin_quantum_raises_error PASSED [ 64%]
tests/backend/test_schedulers.py::test_fcfs_execution_and_metrics PASSED [ 67%]
tests/backend/test_schedulers.py::test_fcfs_deterministic_tie_breaking PASSED [ 71%]
tests/backend/test_schedulers.py::test_sjf_non_preemptive_scheduling PASSED [ 75%]
tests/backend/test_schedulers.py::test_srtf_preemption_on_shorter_arrival PASSED [ 78%]
tests/backend/test_schedulers.py::test_round_robin_quantum_preemption PASSED [ 82%]
tests/backend/test_schedulers.py::test_priority_non_preemptive PASSED    [ 85%]
tests/backend/test_schedulers.py::test_priority_preemptive PASSED        [ 89%]
tests/backend/test_schedulers.py::test_priority_aging_starvation_mitigation PASSED [ 92%]
tests/backend/test_schedulers.py::test_cpu_idle_gap PASSED               [ 96%]
tests/backend/test_schedulers.py::test_mid_run_dynamic_arrival PASSED    [100%]

============================= 28 passed in 0.45s ==============================
```
