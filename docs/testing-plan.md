# VGARSS — Automated Testing & Verification Plan

**Document Version**: 2.0.0  
**Test Frameworks**: `pytest` 8.3+, `pytest-asyncio` 0.24+, `httpx`, `vitest` 2.1+, React Testing Library  
**Target Platform**: Windows 11 (64-bit), PowerShell 5.1 / 7+  
**Current Status**: 100% Passed (63 Backend Tests, 6 Frontend Tests, 10/10 Live Demo Phases)  

---

## 1. Testing Architecture & Verification Strategy

VGARSS employs a multi-tiered verification hierarchy ensuring mathematical precision in Operating System algorithms, protocol compliance in Computer Networking transports, and boundary robustness in security layers.

```
+-------------------------------------------------------------------------------+
|                       Tier 4: Live End-to-End Workflow                        |
|  - 10-Phase Automation Script (`scripts/demo_e2e_workflow.py`)                |
|  - Dual WebSockets, Dynamic Scheduler Reconfiguration, Raw TCP Socket Forward |
+-------------------------------------------------------------------------------+
                                        ^
                                        |
+-------------------------------------------------------------------------------+
|                       Tier 3: Security & Boundary Fuzzing                     |
|  - `test_security_and_edge_cases.py` (9 Tests)                                |
|  - Injection Resistance, Malformed Packets, Concurrency Caps, RBAC Boundaries |
+-------------------------------------------------------------------------------+
                                        ^
                                        |
+-------------------------------------------------------------------------------+
|                       Tier 2: API & Network Protocol Integration              |
|  - `test_api.py` (10 Tests)                                                   |
|  - `test_tcp_server.py` (7 Tests - 4-Byte Binary Framing & Concurrency)        |
|  - `test_websocket_networking.py` (7 Tests - Sequence Monotonicity & Resync)  |
|  - `test_e2e_integration.py` (2 Tests - State Machine + TCP Lifecycle)        |
+-------------------------------------------------------------------------------+
                                        ^
                                        |
+-------------------------------------------------------------------------------+
|                       Tier 1: Core OS Domain Unit Testing                     |
|  - `test_schedulers.py` (17 Tests - FCFS, SJF, SRTF, RR, Priority with Aging) |
|  - `test_resources.py` (11 Tests - Mutexes, Semaphores, RAG Cycle Detection)  |
|  - Frontend Vitest Components (6 Tests - Header, Sidebar, Telemetry)          |
+-------------------------------------------------------------------------------+
```

---

## 2. Test Suite Breakdown & Coverage Catalog

### 2.1 Operating Systems Core: CPU Scheduling (`test_schedulers.py`)
- **Location**: `tests/backend/test_schedulers.py`
- **Count**: 17 tests
- **Verifications**:
  1. `test_process_lifecycle_state_transitions`: Validates `NEW -> READY -> RUNNING -> WAITING -> TERMINATED` state sequence and timestamps.
  2. `test_fcfs_scheduling_order_and_metrics`: Verifies non-preemptive arrival ordering and exact Turnaround ($T_c - T_a$), Waiting ($T_{ta} - T_b$), and Response times.
  3. `test_sjf_non_preemptive_execution`: Ensures shortest remaining burst dispatched next without preemption.
  4. `test_srtf_preemption`: Validates that an arriving process with a shorter burst immediately preempts the currently running process and increments context switches.
  5. `test_round_robin_time_quantum_preemption`: Tests quantum expiration ($q=2$), rotational queue round-trip, and context-switch tracking.
  6. `test_round_robin_quantum_1`: Tests single-tick quantum rotation edge case.
  7. `test_priority_non_preemptive`: Verifies dispatch strictly by priority value.
  8. `test_priority_preemptive_dispatch`: Validates high-priority arrival preemption.
  9. `test_priority_aging_prevents_starvation`: Proves that low-priority processes have their priority incremented dynamically as wait time accumulates.
  10. `test_cpu_utilization_and_throughput_calculation`: Verifies idle-time tracking and $\frac{\sum T_{busy}}{T_{total}}$ math.
  11. `test_empty_queue_idle_stepping`: Confirms simulator handles zero ready processes gracefully without crashing.
  12. `test_step_by_step_execution`: Validates deterministic 1-tick discrete stepping.
  13. `test_reset_simulation_state`: Confirms state reset clears PCB metrics and resets clock to 0.
  14. `test_dynamic_policy_switch`: Validates in-flight scheduler strategy replacement.
  15. `test_simultaneous_process_arrival`: Tests tie-breaking by process ID when arrival ticks match.
  16. `test_multi_process_complex_workload`: Validates 10-process mixed workload convergence.
  17. `test_zero_burst_rejection`: Ensures invalid process burst time $\le 0$ is rejected.

### 2.2 Concurrency & Deadlocks (`test_resources.py`)
- **Location**: `tests/backend/test_resources.py`
- **Count**: 11 tests
- **Verifications**:
  1. `test_mutex_exclusive_acquisition_success`: Verifies single-holder locking.
  2. `test_mutex_contention_and_blocking`: Verifies second process transitions to `WAITING` and enters FIFO queue.
  3. `test_mutex_release_and_wakeup`: Verifies releasing awakens the next waiting process and returns it to `READY`.
  4. `test_semaphore_shared_capacity`: Validates concurrent tokens up to capacity $K$.
  5. `test_semaphore_exhaustion_and_blocking`: Confirms request $K+1$ blocks.
  6. `test_semaphore_release_and_token_return`: Confirms unit increment and unblocking.
  7. `test_reentrant_mutex_behavior`: Tests double-lock detection and behavior.
  8. `test_illegal_release_rejection`: Ensures unheld lock release raises appropriate error.
  9. `test_deadlock_detection_rag_cycle`: Simulates $P_1 \to R_2 \to P_2 \to R_1 \to P_1$ cycle and validates detection via Tarjan's/DFS algorithm.
  10. `test_deadlock_detection_no_false_positives`: Verifies DAG structure does not falsely report deadlock.
  11. `test_resource_manager_disconnect_cleanup`: Validates orphan lock recovery if a process aborts.

### 2.3 REST API Endpoints & Persistence (`test_api.py`)
- **Location**: `tests/backend/test_api.py`
- **Count**: 10 tests
- **Verifications**:
  1. `test_health_check`: `GET /api/v1/health` returns status `healthy` and version.
  2. `test_create_session`: `POST /api/v1/auth/sessions` returns valid Bearer token.
  3. `test_create_and_list_groups`: Virtual group creation and isolation.
  4. `test_create_simulation_with_processes`: Process payload validation and persistence.
  5. `test_step_simulation`: Discrete single-tick simulation advance.
  6. `test_run_simulation_to_completion`: Continuous simulation run and final metric calculation.
  7. `test_reset_simulation_api`: State reset to tick 0.
  8. `test_update_simulation_policy`: Dynamic algorithm switch via REST.
  9. `test_acquire_and_release_resource_api`: REST-level concurrency control.
  10. `test_deadlock_status_api`: RAG graph and cycle status endpoint.

### 2.4 Raw TCP Socket Server (`test_tcp_server.py`)
- **Location**: `tests/backend/test_tcp_server.py`
- **Count**: 7 tests
- **Verifications**:
  1. `test_tcp_framing_ping_pong`: Validates 4-byte big-endian framing and `PING`/`PONG` handshake.
  2. `test_tcp_echo_payload`: Validates arbitrary JSON payload echoing.
  3. `test_tcp_frame_too_large_rejection`: Confirms frames exceeding 1 MB are rejected with `FRAME_TOO_LARGE` and closed.
  4. `test_tcp_malformed_json_handling`: Verifies invalid JSON yields `MALFORMED_JSON` error frame.
  5. `test_tcp_partial_read_reassembly`: Streams packets fragmented byte-by-byte to prove `readexactly` reassembly.
  6. `test_tcp_paired_client_forwarding`: Connects two clients, pairs them, and forwards messages bidirectionally.
  7. `test_tcp_client_timeout_disconnect`: Verifies idle client socket cleanup after inactivity.

### 2.5 Authenticated WebSockets (`test_websocket_networking.py`)
- **Location**: `tests/backend/test_websocket_networking.py`
- **Count**: 7 tests
- **Verifications**:
  1. `test_websocket_connection_and_auth`: Handshake authentication via query token.
  2. `test_websocket_unauthorized_rejection`: Unauthenticated connection closed with `1008 Policy Violation`.
  3. `test_websocket_monotonic_sequence_numbers`: Consecutive simulation steps emit monotonically increasing `seq`.
  4. `test_websocket_resync_batch_replay`: Client reconnecting with `last_seq` receives missed events replay.
  5. `test_websocket_resync_full_snapshot`: Client with stale sequence receives full SQLite state snapshot.
  6. `test_websocket_slow_client_eviction`: Simulates backpressure; verifies queue overflow triggers safe disconnect.
  7. `test_websocket_group_isolation`: Subscribed client on Group A never receives broadcasts from Group B.

### 2.6 Security & Boundary Fuzzing (`test_security_and_edge_cases.py`)
- **Location**: `tests/backend/test_security_and_edge_cases.py`
- **Count**: 9 tests
- **Verifications**:
  1. `test_sql_injection_resilience`: Fuzzes query parameters and IDs with SQL injection patterns.
  2. `test_path_traversal_protection`: Validates safe file and parameter boundaries.
  3. `test_expired_session_token_rejection`: Ensures expired tokens return HTTP 401.
  4. `test_tampered_bearer_token`: Validates rejection of forged session tokens.
  5. `test_duplicate_process_id_validation`: Schema rejects duplicate process IDs with HTTP 422 before SQLite insertion.
  6. `test_negative_burst_validation`: Schema rejects invalid CPU burst values.
  7. `test_rbac_unauthorized_group_modification`: Regular members cannot delete owner groups.
  8. `test_max_payload_size_enforcement`: Rejects payloads exceeding body size limits.
  9. `test_concurrency_socket_limit`: Rejects raw TCP connections beyond capacity cap.

### 2.7 End-to-End System Integration (`test_e2e_integration.py`)
- **Location**: `tests/backend/test_e2e_integration.py`
- **Count**: 2 tests
- **Verifications**:
  1. `test_full_system_lifecycle_e2e`: Complete workflow creating group, adding tasks, establishing WebSocket subscription, stepping simulation, acquiring mutex, detecting block, releasing lock, resuming execution, and verifying metrics.
  2. `test_raw_tcp_demonstration_lifecycle`: Complete TCP client pair registration, paired routing, bidirectional ping-pong, and graceful unpairing.

### 2.8 Frontend Unit & Component Tests (`frontend/src/__tests__/`)
- **Location**: `frontend/src/__tests__/`
- **Count**: 6 tests
- **Verifications**:
  1. Header navigation and role attributes.
  2. Sidebar links and `aria-current` active indicator.
  3. Connection status badge rendering (Connected, Disconnected, Reconnecting).
  4. Simulation control button states (Start, Pause, Step, Reset).
  5. Ready queue visualization component rendering.
  6. Resource allocation bar calculation.

---

## 3. Test Execution Commands

### Execute Full Test Suite (Windows PowerShell)
```powershell
.\scripts\test-all.ps1
```

### Execute Raw TCP Socket Verification
```powershell
.\scripts\test-tcp.ps1
```

### Execute Live Interactive Demonstration
```powershell
.\.venv\Scripts\python scripts/demo_e2e_workflow.py
```

---

## 4. Verification Pass/Fail Criteria & Results

| Criteria | Required Threshold | Observed Result | Status |
| :--- | :--- | :--- | :--- |
| **Backend Unit Tests** | 100% Pass (0 Failures) | 63 / 63 Passed | **PASS** |
| **Frontend Tests** | 100% Pass (0 Failures) | 6 / 6 Passed | **PASS** |
| **TypeScript Compilation** | 0 Type Errors (`tsc -b`) | 0 Errors | **PASS** |
| **Production Vite Build** | Clean output bundle | Built in 2.16s | **PASS** |
| **TCP Framing Integrity** | 4-byte big-endian framing | Verified (`!I` header) | **PASS** |
| **Slow-Client Backpressure** | Eviction on queue full | Evicted cleanly (`1008`) | **PASS** |
| **Deadlock Cycle Detection** | Correct cycle identification | Graph cycle confirmed | **PASS** |
| **Process Tree Cleanup** | No dangling child processes | `dev.ps1` tree termination | **PASS** |
