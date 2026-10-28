# AGENTS.md — VGARSS Engineering Standards & Guidelines

This document defines the architecture, system design, coding standards, and operational guidelines for **VGARSS (Virtual Group Asynchronous Real-Time Resource Synchronization & Scheduling System)**. All Antigravity agents, subagents, and contributors must strictly adhere to these rules.

---

## 1. System Architecture

- **Frontend**: React 18+, TypeScript, Vite, Tailwind CSS, Lucide icons.
- **Backend**: Python 3.12+, FastAPI, Pydantic v2, Uvicorn (ASGI).
- **Persistence**: SQLite (via SQLAlchemy / aiosqlite / raw structured SQL) for lightweight zero-setup local storage, with clean abstraction allowing migration to PostgreSQL.
- **Communication Protocol Stack**:
  1. **REST APIs**: Resource configuration, initial bootstrap, process definitions, user session creation.
  2. **WebSockets (Bi-directional)**: High-frequency real-time telemetry, scheduling queue state updates, mutex/semaphore lock states, and live events.
  3. **Raw TCP Socket Demonstration**: Dedicated Python socket server running on port 9000 to demonstrate low-level network packet framing, connection lifecycle, binary/JSON payload parsing, and multithreaded/async socket handling.
- **Testing & Quality Assurance**:
  - Backend: `pytest`, `pytest-asyncio`, `httpx` (for FastAPI TestClient).
  - Frontend: Component unit tests, TypeScript typechecking (`tsc --noEmit`), Vite build validation.
  - Browser verification: Antigravity browser automation agent.

---

## 2. Computer Networks Standards

1. **Client-Server Architecture**:
   - Strict separation between the transport layer, message serialization/deserialization, protocol parsing, and core scheduling/synchronization logic.
2. **Message Validation & Framing**:
   - All network packets (REST, WebSocket, TCP) must follow strict schema validation (via Pydantic models).
   - In raw TCP sockets, use length-prefixed or explicit delimiter framing to prevent packet fragmentation and coalescing issues.
3. **Concurrency & Client Management**:
   - Support multiple concurrent client connections asynchronously without thread starvation or socket blocking.
   - Gracefully handle client disconnects, dropped sockets, and network timeouts.
4. **Resilience & Idempotency**:
   - Guard against duplicate requests, out-of-order execution, and malformed payloads.
   - Emit structured network error codes and actionable error messages back to the client.

---

## 3. Operating Systems & Process Scheduling Standards

1. **Process Lifecycle Simulation**:
   - Explicitly model and visualize all process states:
     - `NEW`: Process admitted to the system.
     - `READY`: In ready queue awaiting CPU scheduler dispatch.
     - `RUNNING`: Actively executing CPU burst.
     - `WAITING` (Blocked): Blocked waiting for I/O or synchronized resource acquisition.
     - `TERMINATED`: Finished execution; memory/resources freed.
2. **Scheduling Algorithms**:
   - Implement accurate, deterministic scheduling algorithms:
     - **FCFS** (First-Come, First-Served)
     - **SJF** (Shortest Job First - Non-Preemptive & Preemptive / SRTF)
     - **Round Robin** (Time Quantum-driven with context-switch tracking)
     - **Priority Scheduling** (Preemptive and Non-Preemptive with starvation mitigation / aging)
3. **Accurate Metrics Calculation**:
   - Compute real mathematical metrics:
     - Turnaround Time = $T_{completion} - T_{arrival}$
     - Waiting Time = $T_{turnaround} - T_{burst}$
     - Response Time = $T_{first\_response} - T_{arrival}$
     - CPU Utilization = $\frac{\sum T_{busy}}{T_{total}} \times 100\%$
     - Throughput = $\frac{\text{Completed Processes}}{T_{total}}$
4. **Concurrency & Synchronization Primitives**:
   - Model shared resource pools with explicit Mutexes and Counting Semaphores.
   - Demonstrate race condition prevention and atomic test-and-set or lock operations.
   - Implement **Deadlock Detection** (Resource Allocation Graph / Cycle Detection) or **Deadlock Prevention/Avoidance** (Banker's Algorithm).

---

## 4. UI/UX Design System Standards

1. **Aesthetic Direction**:
   - Sleek, high-density, modern developer-tool aesthetic (deep dark theme: obsidian, slate, charcoal with cyan/emerald/violet accents).
   - Crisp modern typography (Inter / Roboto / JetBrains Mono for metrics and log data).
   - Modern glassmorphism or clean border-separated panels (`border-slate-800`, subtle gradients).
2. **Component & State Integrity**:
   - Every view must have distinct states: **Loading**, **Empty**, **Active/Executing**, **Paused**, **Error**, and **Disconnected**.
   - Interactive Gantt charts, live Ready Queue lanes, Resource Allocation matrices, and Event Logs.
   - No dead buttons, placeholder `TODO` alerts, or fabricated performance numbers. All visualized metrics must directly stem from the simulation engine.

---

## 5. Engineering Quality & Operational Principles

1. **Inspect Before Modifying**: Always read and verify existing file content before modifying.
2. **Incremental Changes**: Make modular, targeted commits with clear commit messages.
3. **Automated Verification**: Run tests (`pytest`) and typechecking (`tsc`) after code changes.
4. **Secret Hygiene**: Never commit passwords, tokens, API keys, or `.env` files.
5. **Honest Reporting**: Never claim a test or check passed without executing it and verifying zero error exit codes.
