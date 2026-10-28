# Workflow 6 — Concurrency & Resource Allocation Testing

## Objective
Verify the correctness of Mutex locking, Semaphore count management, and Resource Allocation Graph (RAG) deadlock detection.

## Step-by-Step Procedure
1. Test Mutual Exclusion:
   - Configure 2 or more processes attempting to acquire a single mutex simultaneously.
   - Assert only 1 process transitions to `RUNNING` inside the critical section, while others transition to `WAITING`.
2. Test Semaphore Allocation:
   - Configure a counting semaphore with capacity $K$.
   - Assert $K$ processes acquire successfully; the $(K+1)$-th process blocks until a signal/release occurs.
3. Test Deadlock Detection:
   - Configure a circular wait condition: $P_1$ holds $R_1$, requests $R_2$; $P_2$ holds $R_2$, requests $R_1$.
   - Assert that the Deadlock Detector identifies the cycle and fires a `DEADLOCK_DETECTED` event with involved process IDs.
