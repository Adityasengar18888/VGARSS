# VGARSS 2.0 — Virtual Group Asynchronous Real-Time Resource Synchronization & Scheduling System

[![Python 3.12](https://img.shields.io/badge/python-3.12%2B-blue.svg)](https://www.python.org/downloads/)
[![React 18](https://img.shields.io/badge/react-18.3-61dafb.svg)](https://react.dev/)
[![TypeScript 5.5](https://img.shields.io/badge/typescript-5.5-3178c6.svg)](https://www.typescriptlang.org/)
[![Vite 5](https://img.shields.io/badge/vite-5.4-646cff.svg)](https://vitejs.dev/)
[![Tailwind CSS 3](https://img.shields.io/badge/tailwind-3.4-38bdf8.svg)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

VGARSS 2.0 is a dual-domain engineering system transformed into a **chat-first, multi-user collaboration platform** combining real-time messaging, virtual groups, task coordination, Operating Systems scheduling, and Computer Networks demonstrations. It unites **Computer Networks** (client-server architecture, message validation, authenticated WebSockets with presence & offline catch-up, raw TCP socket framing) with **Operating Systems** (process lifecycle modeling, deterministic CPU scheduling algorithms, mutex/semaphore synchronization, and deadlock detection).

---

## Table of Contents

- [System Architecture](#system-architecture)
- [VGARSS 2.0 Platform Features](#vgarss-20-platform-features)
- [Prerequisites (Windows 11)](#prerequisites-windows-11)
- [Quick Start Guide](#quick-start-guide)
  - [Unified Development Launcher](#1-unified-development-launcher-recommended)
  - [Individual Service Launchers](#2-individual-service-launchers)
- [Network Protocol Stack & Ports](#network-protocol-stack--ports)
- [Raw TCP Socket Demonstration](#raw-tcp-socket-demonstration)
- [Automated Verification & Testing](#automated-verification--testing)
- [Project Directory Structure](#project-directory-structure)
- [Troubleshooting & Windows Tips](#troubleshooting--windows-tips)
- [Documentation Index](#documentation-index)

---

## System Architecture

```
                      +---------------------------------------+
                      |     VGARSS 2.0 React Web Client       |
                      |  (Three-Column Chat + Consoles)       |
                      |  Port: 5173                           |
                      +------------------+--------------------+
                                         |
                        REST APIs        |  Bi-directional
                        (/api/v2/*)      |  WebSockets (/ws/v2)
                                         v
                      +---------------------------------------+
                      |         FastAPI Core Engine           |
                      |  - Auth & RBAC (Workspaces/Channels)  |
                      |  - ChatHub WebSocket Telemetry Hub    |
                      |  - Task Coordination & CPU Bridge     |
                      |  - SQLite / PostgreSQL Dual-Mode      |
                      |  Port: 8000                           |
                      +------------------+--------------------+
                                         |
                +-------------------------+-------------------------+
                |                                                   |
                v                                                   v
+-------------------------------+               +----------------------------------+
|  OS Simulation Engine Core    |               | Raw TCP Socket Demonstration     |
| - Process Lifecycle (5-State) |               | - Port 9000 Standalone Server    |
| - Scheduler (FCFS, SJF, RR)   |               | - Custom length-prefixed framing |
| - Priority (Aging & Starve)   |               | - Multi-client concurrent socket |
| - Mutex & Semaphore Registry  |               | - Paired-client message routing  |
| - Deadlock Detection (RAG/WFG)|               +----------------------------------+
+-------------------------------+
```

---

## VGARSS 2.0 Platform Features

### 1. Chat-First Multi-User Collaboration & Task Coordination
- **Three-Column Desktop Layout**:
  - **Server / Workspace Sidebar**: Workspace switcher with unread badges, instant dev user switcher (`alice`, `bob`, `charlie`), user profile with live presence ring.
  - **Channel & DM Sidebar**: Channel navigation (`#general`, `#os-scheduling-lab`, `#cn-protocols`), Direct Messages, dedicated Systems Consoles shortcuts, and WebSocket connection status indicator.
  - **Main Conversation Stage**: Paginated message history, Markdown support, inline task cards with real-time status chips and one-click CPU dispatch buttons, system notification banners, and typing indicator.
  - **Context Drawer**: Collapsible right panel displaying Online/Offline channel members and active workspace tasks.
- **Task-to-CPU Coordination Bridge**:
  - Create tasks directly from chat messages with custom priority (`LOW`, `NORMAL`, `HIGH`, `CRITICAL`), estimated CPU burst ticks, assigned members, and channel announcements.
  - Real-time task state transitions (`NEW` -> `READY` -> `RUNNING` -> `WAITING` -> `TERMINATED`) automatically emit readable system event messages to the channel.
  - Dispatch tasks directly from the chat feed into the OS CPU scheduler simulation.
- **Search & Modals**:
  - Full-text search (`Ctrl+K`) across messages and tasks within the active workspace.
  - Workspace creation, channel creation, member invitation with RBAC (`owner`, `admin`, `member`), user profile editor, and workspace settings.

### 2. Operating Systems Core
- **5-State Process Lifecycle**: Explicit simulation of `NEW`, `READY`, `RUNNING`, `WAITING` (blocked on lock), and `TERMINATED` states.
- **Deterministic Scheduling Algorithms**:
  - **FCFS** (First-Come, First-Served)
  - **SJF** (Shortest Job First - Non-Preemptive & Preemptive / SRTF)
  - **Round Robin** (Time Quantum preemption with exact context-switch tracking)
  - **Priority Scheduling** (Non-Preemptive & Preemptive with dynamic aging to prevent starvation)
- **Mathematical Metrics Engine**: Accurate calculation of Turnaround Time ($T_{completion} - T_{arrival}$), Waiting Time ($T_{turnaround} - T_{burst}$), Response Time ($T_{first\_response} - T_{arrival}$), Throughput, and CPU Utilization.
- **Concurrency & Synchronization**:
  - Mutexes (exclusive access) and Counting Semaphores (shared reader capacity).
  - Deadlock Detection via Wait-For Graph (WFG) cycle detection algorithm.
  - Resource Allocation Graph (RAG) real-time state visualization.

### 3. Computer Networks Core
- **Authenticated Real-Time WebSockets (`/ws/v2`)**:
  - Token-verified handshake on connection.
  - Monotonic per-target event sequence numbers (`seq`).
  - Offline message catch-up and sequence synchronization (`CATCHUP_REQUEST` / `CATCHUP_RESPONSE`).
  - Heartbeat ping/pong with latency calculation.
  - Real-time typing indicators with debounce and presence broadcasting (`online`, `idle`, `offline`).
- **Standalone Raw TCP Socket Server (Port 9000)**:
  - Completely decoupled from FastAPI/HTTP; implemented using Python `asyncio.start_server`.
  - Binary framing: **4-byte big-endian unsigned integer length header** (`!I`) preceding a UTF-8 JSON payload.
  - Protection against frame-size overflow (1 MB maximum payload limit).
  - Partial read reconstruction via `readexactly` stream buffers.
  - Bounded concurrency with idle client timeouts and paired-client message forwarding.

### 4. Dedicated Systems Consoles
- **Process Scheduler**: Interactive timeline, Gantt chart, ready queue lanes, simulation controls (Start, Pause, Step, Reset, Policy Switch).
- **Resource Monitor**: Live mutex and semaphore capacity bars, active holders, waiting queues.
- **Network Monitor**: Active WebSocket metrics, raw TCP port 9000 status, live packet transmitter and frame inspector.
- **Performance Analytics**: Real-time throughput, turnaround time, and waiting time distributions.

---

## Prerequisites (Windows 11)

- **Operating System**: Windows 11 (64-bit)
- **Node.js**: v22.17.0+ (LTS) & npm 11.6.0+
- **Python**: 3.12.5+ (64-bit)
- **Git**: 2.50.1+
- **PowerShell**: 5.1 or PowerShell 7+ (`pwsh`)

---

## Quick Start Guide

### 1. Unified Development Launcher (Recommended)

The easiest way to start VGARSS on Windows is via the unified development script. It checks prerequisites, verifies port availability, performs optional preflight tests, and boots both backend (FastAPI + TCP) and frontend (Vite) in coordinated processes:

```powershell
# In PowerShell (run from repository root):
.\scripts\dev.ps1
```

To run with preflight tests before launching:
```powershell
.\scripts\dev.ps1 -RunTests
```

When you are done, press `Ctrl+C` in the PowerShell window. The launcher safely terminates both frontend and backend child processes without killing unrelated system processes.

---

### 2. Individual Service Launchers

If you prefer separate terminal windows:

#### Terminal 1: Backend & TCP Server
```powershell
# Runs dependency checks, port validation (8000, 9000), and starts Uvicorn
.\scripts\run-backend.ps1
```
- REST API Documentation: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- OpenAPI JSON: [http://127.0.0.1:8000/openapi.json](http://127.0.0.1:8000/openapi.json)
- Raw TCP Server: `127.0.0.1:9000`

#### Terminal 2: Frontend Client
```powershell
# Audits node modules and starts the Vite development server on port 5173
.\scripts\run-frontend.ps1
```
- Dashboard UI: [http://localhost:5173](http://localhost:5173)

---

## Network Protocol Stack & Ports

All services are strictly bound to loopback (`127.0.0.1`) to ensure developer privacy.

| Port | Protocol | Service | Description | Auth / Security |
| :--- | :--- | :--- | :--- | :--- |
| **8000** | HTTP / REST | FastAPI Gateway | Task submission, simulation controls, group management | Bearer Token / Role-Based Access |
| **8000** | WebSocket | Telemetry Hub | Group-isolated event streams (`/ws/groups/{id}`) | Session Token Handshake |
| **9000** | Raw TCP | Standalone Socket Server | 4-byte big-endian binary length-prefixed framing | Bounded connections, length checks |
| **5173** | HTTP / HMR | Vite Web Client | React 18 frontend dashboard | Localhost loopback |

---

## Raw TCP Socket Demonstration

The Raw TCP server runs on port 9000. It demonstrates transport-layer socket programming without web frameworks.

### PowerShell Socket Verification Script
Test the raw socket server directly using the provided PowerShell verification script:

```powershell
.\scripts\test-tcp.ps1
```

This script connects to `127.0.0.1:9000`, formats a 4-byte big-endian header with a JSON payload `{"action": "PING"}`, sends the frame, and unpacks the 4-byte header from the server response:

```
=== VGARSS Raw TCP Server Verification ===
Connecting to 127.0.0.1:9000...
Connected successfully!

[TX] Sending Action: PING
[TX] Frame Header (4 bytes hex): 00-00-00-12 (Length: 18 bytes)
[TX] Payload: {"action": "PING"}

[RX] Received Header (4 bytes hex): 00-00-00-55 (Length: 85 bytes)
[RX] Raw JSON: {"action":"PONG","server_time":"2026-10-29T00:50:00Z","status":"OK"}
[SUCCESS] Received valid PONG from TCP Server!
```

### Python Interactive / Programmatic Client
You can also connect programmatically in Python:
```python
import socket, struct, json

s = socket.create_connection(("127.0.0.1", 9000))

# Encode payload
payload = json.dumps({"action": "ECHO", "data": "Hello VGARSS"}).encode("utf-8")
header = struct.pack("!I", len(payload)) # 4-byte big-endian unsigned int

# Send frame
s.sendall(header + payload)

# Read response length
resp_len = struct.unpack("!I", s.recv(4))[0]
resp_body = s.recv(resp_len).decode("utf-8")
print("Response:", json.loads(resp_body))
s.close()
```

---

## Automated Verification & Testing

VGARSS includes an exhaustive automated verification suite covering unit, integration, security, and end-to-end workflows.

### Run All Tests via PowerShell
```powershell
.\scripts\test-all.ps1
```
This script executes:
1. **Backend Unit & Integration Tests** (`pytest tests/backend -v`): **74 passing tests**
2. **Frontend Component Tests** (`npm test`): **8 passing tests**
3. **Production Frontend Build Check** (`npm run build`): Validates TypeScript types and Vite bundling.

### Automated End-to-End Live Demonstration
Execute a 10-phase automated end-to-end workflow verifying backend health, authentication, group isolation, multi-client WebSockets, dynamic task admission, policy update, resource acquisition/blocking, release resumption, metrics calculation, and raw TCP framing:

```powershell
.\.venv\Scripts\python scripts/demo_e2e_workflow.py
```

### Backend Test Matrix Breakdown (74 Tests)

| Test File | Count | Focus Areas |
| :--- | :--- | :--- |
| `tests/backend/test_workspace_scheduling_and_resources.py` | 5 | Task creation from chat with metadata, workspace CPU scheduler stepping, concurrent resource locking/blocking, deadlock detection via Wait-For Graph, and task cancellation recovery |
| `tests/backend/test_schedulers.py` | 17 | FCFS, SJF, SRTF, Round Robin (quantums 1 & 2), Priority with aging, context switches |
| `tests/backend/test_resources.py` | 11 | Mutex exclusive locks, Semaphore capacity, FIFO wait queues, RAG cycle detection |
| `tests/backend/test_chat_platform.py` | 6 | Authentication, workspace RBAC, message pagination, idempotency, concurrent WebSockets, offline catch-up, task events |
| `tests/backend/test_api_endpoints.py` | 6 | REST API endpoints, groups, processes, simulation lifecycle, SQLite persistence |
| `tests/backend/test_tcp_server.py` | 7 | Length-prefixed framing, 1MB limits, timeouts, partial reads, paired forwarding |
| `tests/backend/test_websocket_networking.py` | 7 | Group auth, monotonic sequence numbers, resync batches, slow-client protection |
| `tests/backend/test_security_and_edge_cases.py` | 9 | Path traversal, SQL injection fuzzing, expired sessions, payload limits, RBAC |
| `tests/backend/test_e2e_integration.py` | 2 | Full system lifecycle (REST + WS + Resource contention) and TCP forward cycle |

---

## Project Directory Structure

```
.
├── .agents/                    # Antigravity agent skills & engineering guidelines
├── .env.example                # Safe environment configuration template
├── AGENTS.md                   # Engineering standards & operational rules
├── README.md                   # Primary system documentation
├── docs/                       # Technical specifications & operating guides
│   ├── architecture.md         # Full system architecture & dataflow diagrams
│   ├── networking.md           # REST, WebSocket & TCP protocol specifications
│   ├── scheduling.md           # CPU scheduling algorithms & PCB state machine
│   ├── resource-management.md  # Concurrency, mutexes, semaphores & deadlocks
│   ├── setup-windows.md        # Detailed Windows 11 setup & troubleshooting
│   ├── api-specification.md    # OpenAPI/REST contract documentation
│   ├── design-system.md        # UI/UX design tokens & component standards
│   └── testing-plan.md         # Automated test plans & verification matrices
├── scripts/                    # Windows PowerShell automation scripts
│   ├── dev.ps1                 # Unified development launcher (backend + frontend)
│   ├── run-backend.ps1         # Backend & TCP server launcher
│   ├── run-frontend.ps1        # Frontend Vite launcher
│   ├── test-all.ps1            # Full test suite runner (63 backend + 6 frontend)
│   ├── test-tcp.ps1            # Raw TCP socket framing tester
│   └── demo_e2e_workflow.py    # 10-phase interactive live demonstration
├── backend/                    # Python 3.12 FastAPI backend & TCP server
│   ├── app/
│   │   ├── api/                # REST route controllers (simulations, groups, etc.)
│   │   ├── core/               # Security, authentication, database engine
│   │   ├── models/             # SQLAlchemy ORM database models
│   │   ├── network/            # WebSocket manager & raw TCP server implementation
│   │   ├── schemas/            # Pydantic v2 data models & validators
│   │   ├── simulation/         # OS scheduler engine & resource manager
│   │   ├── config.py           # Application settings
│   │   └── main.py             # FastAPI entrypoint & lifespan orchestrator
│   ├── pyproject.toml          # Python project metadata
│   └── requirements.txt        # Backend dependencies
├── frontend/                   # React 18 + TypeScript + Vite + Tailwind frontend
│   ├── src/
│   │   ├── components/         # Reusable UI components & navigation
│   │   ├── hooks/              # Custom hooks (useSimulation, useWebSocket)
│   │   ├── services/           # REST & WebSocket API clients
│   │   ├── types/              # TypeScript type definitions
│   │   └── views/              # Scheduler, Resource, Network, Deadlock views
│   ├── package.json            # Node.js dependencies
│   └── vite.config.ts          # Vite build configuration
└── tests/                      # Automated test suite
    ├── backend/                # Pytest suites (unit, network, e2e, security)
    └── frontend/               # Vitest component tests
```

---

## Troubleshooting & Windows Tips

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| `tests/backend/test_workspace_scheduling_and_resources.py` | 5 | Task creation from chat with metadata, workspace CPU scheduler stepping, concurrent resource locking/blocking, deadlock detection via Wait-For Graph, and task cancellation recovery |
| **PowerShell script execution disabled** | Windows default Execution Policy restricts scripts | Run `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` in PowerShell. |
| **Port 8000, 9000, or 5173 already in use** | A previous instance or dangling process is listening | Run `Get-NetTCPConnection -LocalPort 8000,9000,5173 -ErrorAction SilentlyContinue` to find the PID, then terminate with `Stop-Process -Id <PID> -Force`. |
| **Path containing spaces or OneDrive** | PowerShell string interpolation with spaces | Always wrap project paths in double quotes or use the standard project scripts which handle quoting automatically. |
| **Dangling Node.js processes** | Vite process tree remains active after terminal close | Use `taskkill /PID <PID> /T /F` to terminate the process tree completely. |
| **Virtual environment activation blocked** | Untrusted script in `.venv\Scripts` | Use `.venv\Scripts\python -m ...` directly without activation, or set `RemoteSigned` policy. |

---

## Documentation Index

- [Windows Setup Guide](docs/setup-windows.md): Step-by-step developer installation on Windows 11.
- [System Architecture](docs/architecture.md): Deep dive into VGARSS components and invariants.
- [Networking & Protocol Specification](docs/networking.md): Detailed REST, WebSocket, and Raw TCP documentation.
- [CPU Scheduling Engine](docs/scheduling.md): Process state transitions, metrics math, and scheduling policies.
- [Resource Management & Deadlocks](docs/resource-management.md): Mutexes, Semaphores, and RAG cycle detection.
- [Testing & Verification Plan](docs/testing-plan.md): Comprehensive test catalog and validation steps.
- [API Specification](docs/api-specification.md): REST endpoint contracts and schemas.
- [UI/UX Design System](docs/design-system.md): Component tokens and design principles.
- [Production Deployment Guide](docs/deployment.md): Hosting architecture, managed PostgreSQL setup, migrations, backups, and verification.
