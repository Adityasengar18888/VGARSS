# VGARSS — Testing & Verification Plan

## 1. Test Levels

1. **Unit Testing (Backend - `pytest`)**:
   - Process lifecycle state transitions (NEW -> READY -> RUNNING -> WAITING -> TERMINATED).
   - CPU Scheduling algorithm mathematical correctness:
     - FCFS metrics validation.
     - SJF (Non-preemptive & Preemptive / SRTF) shortest burst selection.
     - Round Robin quantum preemption and context switch tracking.
     - Priority scheduling starvation prevention.
   - Resource allocation, Mutex locking, Semaphore decrementing/incrementing.
   - Resource Allocation Graph (RAG) cycle detection for deadlock verification.
2. **API & Network Testing (`pytest` + `httpx`)**:
   - Health endpoint status 200 checks.
   - Simulation configuration load validation.
   - WebSocket broadcast and event reception.
   - Raw TCP socket binary framing encoding/decoding.
3. **Frontend Testing & Verification**:
   - TypeScript compilation checks (`tsc --noEmit`).
   - Vite bundle build check (`npm run build`).
   - Visual inspection and interaction testing via Antigravity browser subagent.
4. **End-to-End Simulation Testing**:
   - Loading standard benchmark workloads and verifying that computed Average Waiting Time, Turnaround Time, and Throughput match theoretical reference values.
