# VGARSS — System Architecture Document

## 1. Introduction & Objectives
The **Virtual Group Asynchronous Real-Time Resource Synchronization & Scheduling System (VGARSS)** is designed as an educational, high-performance simulation platform bridging Operating Systems concepts and Computer Networking principles.

The system allows clients to define processes, submit resource requests, observe CPU scheduling in real time, and monitor concurrency control mechanisms (mutexes, semaphores, deadlock detection) across both web-based interfaces and low-level socket connections.

---

## 2. Component Architecture

### 2.1 Backend Engine (Python 3.12 / FastAPI)
- **FastAPI Core**: Handles REST endpoints for system configuration, process ingestion, and scheduling strategy selection.
- **WebSocket Hub**: Broadcasts real-time state mutations (process transitions, Gantt ticks, queue changes, lock acquisitions) at high frequency with low latency.
- **Raw TCP Socket Server**: A separate asynchronous server running on TCP port 9000, demonstrating:
  - Custom 4-byte big-endian length-prefix binary framing.
  - JSON payload decoding/encoding.
  - Multi-client non-blocking I/O.
- **Simulation Kernel**:
  - `ProcessManager`: Maintains process state machine (NEW -> READY -> RUNNING -> WAITING -> TERMINATED).
  - `Scheduler`: Implements FCFS, Non-Preemptive SJF, Preemptive SJF (SRTF), Round Robin (quantum configurable), and Priority Scheduling.
  - `ResourceManager`: Coordinates shared resource allocation, maintains Semaphore counters and Mutex ownership locks.
  - `DeadlockDetector`: Constructs Resource Allocation Graphs (RAG) and identifies wait-for cycles.

### 2.2 Frontend Client (React 18 / TypeScript / Vite / Tailwind CSS)
- **Control Center**: Panel to add processes, set arrival/burst/priority times, configure scheduling algorithm and time slice quantum.
- **Live Scheduling Board**:
  - Real-time Gantt chart visualizer showing CPU time slices.
  - Ready queue and waiting queue visual swimlanes.
  - Process PCB (Process Control Block) detail cards.
- **Resource & Concurrency Monitor**:
  - Mutex state badges (Unlocked / Locked by Process X).
  - Counting semaphore capacity bars.
  - Deadlock alert panel with visual graph representation.
- **Raw TCP Telemetry Console**:
  - Low-level network packet inspector showing framed messages and socket event streams.

### 2.3 Persistence Layer
- SQLite database (`vgarss.db`) storing:
  - Simulation run archives.
  - Process scenario templates.
  - Historical scheduling metrics for comparative analysis.

---

## 3. Communication Protocols

| Channel | Transport | Purpose | Schema / Framing |
| :--- | :--- | :--- | :--- |
| `/api/v1/*` | HTTP/1.1 REST | CRUD operations for simulation runs & config | JSON (Pydantic models) |
| `/ws` | WebSocket | Live state broadcast & interactive control | JSON event stream: `{ "type": string, "payload": object }` |
| Port 9000 | Raw TCP | Direct socket client synchronization | `[4-byte big-endian length][UTF-8 JSON bytes]` |
