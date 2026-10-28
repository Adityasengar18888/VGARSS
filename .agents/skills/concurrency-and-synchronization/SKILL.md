---
name: concurrency-and-synchronization
description: >-
  Use this skill when implementing or testing concurrency control primitives, mutex locks,
  counting semaphores, race condition prevention, critical sections, deadlock detection,
  and resource allocation graphs in VGARSS.
---

# Concurrency & Synchronization Skill for VGARSS

This skill governs the modeling, execution, and verification of concurrency control mechanisms, synchronization primitives, and deadlock management in VGARSS.

## 1. Synchronization Primitives

1. **Mutex (Mutual Exclusion Lock)**:
   - Binary state: `UNLOCKED` or `LOCKED_BY(P_i)`.
   - Operations: `acquire()` and `release()`.
   - Guard against invalid releases (e.g. process releasing a lock it does not own).
   - If acquired, subsequent requesting processes transition from `RUNNING` to `WAITING` and join the mutex wait queue.

2. **Counting Semaphore**:
   - Initial capacity: integer $K \ge 0$.
   - `wait()` (P operation): If count > 0, decrement count and proceed; if 0, block process in semaphore queue.
   - `signal()` (V operation): If waiting processes exist, unblock one; otherwise increment available count.

3. **Critical Section Modeling**:
   - Explicitly simulate processes requiring shared resources (e.g., Shared Memory Buffer, Printer, Network Channel) during specific ticks of their burst.

## 2. Deadlock Detection & Avoidance

1. **Deadlock Conditions (Coffman Conditions)**:
   - Mutual Exclusion, Hold & Wait, No Preemption, Circular Wait.
2. **Resource Allocation Graph (RAG)**:
   - Vertices: Processes $P = \{P_1, P_2, \dots\}$ and Resources $R = \{R_1, R_2, \dots\}$.
   - Request Edges: $P_i \to R_j$ (Process $P_i$ is waiting for Resource $R_j$).
   - Assignment Edges: $R_j \to P_i$ (Resource $R_j$ is allocated to Process $P_i$).
3. **Cycle Detection Algorithm**:
   - Run Tarjan's or Kahn's Cycle Detection algorithm on the wait-for graph.
   - If a directed cycle is detected, trigger a **Deadlock Alert**, identify the participating processes, and recommend preemption or rollback actions.

## Verification Checklist
- Test mutual exclusion by simulating 3 processes racing for 1 mutex lock; ensure only 1 enters the critical section while 2 wait.
- Verify deadlock trigger test case: P1 holds R1 and requests R2; P2 holds R2 and requests R1. Ensure the system flags a deadlock cycle immediately.
