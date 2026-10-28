---
name: operating-systems
description: >-
  Use this skill when implementing, verifying, or testing Operating System process management,
  CPU scheduling algorithms (FCFS, SJF, Round Robin, Priority), process control blocks (PCBs),
  state transitions, and scheduling performance metrics in VGARSS.
---

# Operating Systems & Process Scheduling Skill for VGARSS

This skill governs the core simulation engine responsible for process lifecycles, CPU scheduling, state transitions, and metric calculations.

## 1. Process Control Block (PCB) & 5-State Model

Every process must be modeled as a discrete PCB entity tracking:
- `process_id`: Unique identifier (e.g., "P1", "P2").
- `state`: Current enum state (`NEW`, `READY`, `RUNNING`, `WAITING`, `TERMINATED`).
- `arrival_time`: Tick at which process becomes available.
- `burst_time`: Total CPU time required.
- `remaining_time`: Remaining CPU time units.
- `priority`: Priority rank (configurable convention: lower number = higher priority).
- `start_time`: First tick at which the process was dispatched to CPU.
- `completion_time`: Tick at which process finished execution.
- `waiting_time`: Total ticks spent in READY queue.
- `turnaround_time`: Completion time - Arrival time.
- `response_time`: First dispatch time - Arrival time.

## 2. CPU Scheduling Algorithms

Implement exact algorithmic logic:
1. **FCFS (First-Come, First-Served)**:
   - Non-preemptive. Dispatches processes strictly by arrival time sequence.
2. **SJF (Shortest Job First)**:
   - Non-preemptive variant: Dispatches available process with smallest burst time.
   - Preemptive variant (SRTF - Shortest Remaining Time First): Preempts running process if a newly arrived process has shorter remaining burst time.
3. **Round Robin (RR)**:
   - Preemptive time-sliced scheduling.
   - Dispatches processes from ready queue for a maximum of `time_quantum` ticks.
   - Properly accounts for context switch overhead and moves preempted process to the back of the ready queue.
4. **Priority Scheduling**:
   - Supports both preemptive and non-preemptive modes.
   - Includes starvation prevention mechanism (aging priority if a process waits too long).

## 3. Metrics Verification

Verify mathematical formulas:
- $\text{Turnaround Time} = T_{\text{completion}} - T_{\text{arrival}}$
- $\text{Waiting Time} = \text{Turnaround Time} - \text{Burst Time}$
- $\text{Response Time} = T_{\text{first run}} - T_{\text{arrival}}$
- $\text{CPU Utilization} = \frac{\text{Busy Ticks}}{\text{Total Ticks}} \times 100\%$
- $\text{Throughput} = \frac{\text{Completed Processes}}{\text{Total Simulation Ticks}}$

## Verification Checklist
- Write unit tests against standard textbook examples (e.g. Silberschatz/Galvin OS benchmarks) to guarantee exact match of Gantt slices and metric averages.
