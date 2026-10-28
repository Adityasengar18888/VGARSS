# Workflow 5 — Scheduling Algorithm Verification

## Objective
Verify the algorithmic accuracy and mathematical metrics of FCFS, SJF (Preemptive/Non-preemptive), Round Robin, and Priority Scheduling.

## Step-by-Step Procedure
1. Define standardized process test workloads (e.g. 5 processes with specified arrival, burst, and priority times).
2. Compute reference theoretical Turnaround Time, Waiting Time, Response Time, and Gantt sequence manually or via benchmark.
3. Execute simulation kernel with each scheduler algorithm.
4. Compare simulated metrics against theoretical values using automated test assertions in `tests/backend/test_schedulers.py`.
5. Flag any discrepancies in preemptions or tie-breaking logic.
