# VGARSS — Windows 11 Development Environment & Setup Guide

**Document Version**: 2.0.0  
**Target Platform**: Windows 11 (x64) with PowerShell 5.1 / PowerShell 7+ (`pwsh`)  
**Components**: Python 3.12, Node.js 22 LTS, Vite, FastAPI, SQLite WAL  

---

## Table of Contents

1. [Prerequisites & System Verification](#1-prerequisites--system-verification)
2. [PowerShell Execution Policy Configuration](#2-powershell-execution-policy-configuration)
3. [Environment Configuration (.env)](#3-environment-configuration-env)
4. [Backend Setup (Python 3.12)](#4-backend-setup-python-312)
5. [Frontend Setup (Node.js & npm)](#5-frontend-setup-nodejs--npm)
6. [Service Launch Options](#6-service-launch-options)
   - [Option A: Unified Development Launcher (Recommended)](#option-a-unified-development-launcher-recommended)
   - [Option B: Independent PowerShell Sessions](#option-b-independent-powershell-sessions)
7. [Running Automated Tests](#7-running-automated-tests)
8. [Verifying the Raw TCP Socket Server](#8-verifying-the-raw-tcp-socket-server)
9. [Verifying the VGARSS 2.0 Chat Platform](#9-verifying-the-vgarss-20-chat--task-coordination-platform)
10. [Running the Live End-to-End Demonstration](#10-running-the-live-end-to-end-demonstration)
10. [Live E2E Demonstration](#10-running-the-live-end-to-end-demonstration)
11. [Port Management & Process Troubleshooting](#10-port-management--process-troubleshooting)
12. [Common Windows Pitfalls & Solutions](#11-common-windows-pitfalls--solutions)

---

## 1. Prerequisites & System Verification

Open a Windows PowerShell prompt and verify your runtime installations:

```powershell
# 1. Verify Node.js and npm
node --version       # Expected: v22.17.0 or higher
npm --version        # Expected: 11.0.0 or higher

# 2. Verify Python
python --version     # Expected: Python 3.12.x (64-bit)
pip --version

# 3. Verify Git
git --version        # Expected: git version 2.40+

# 4. Verify PowerShell version
$PSVersionTable.PSVersion
```

> [!NOTE]
> If Python is not recognized, ensure that the Python installation directory and `Scripts` folder are added to your Windows system `PATH` environment variable.

---

## 2. PowerShell Execution Policy Configuration

By default, Windows restricts running unsigned PowerShell scripts. To allow local development scripts (`.ps1`) to run:

```powershell
# Check current execution policy
Get-ExecutionPolicy -Scope CurrentUser

# Set RemoteSigned policy for current user (safe and standard for developers)
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
```

---

## 3. Environment Configuration (.env)

VGARSS includes a verified template `.env.example`. Copy it to create your local `.env`:

```powershell
# From repository root
Copy-Item .env.example .env
```

Key configuration variables in `.env`:
- `VGARSS_PORT=8000`: FastAPI gateway and WebSocket port.
- `VGARSS_ENABLE_TCP=true`: Enables the standalone raw TCP server.
- `VGARSS_TCP_PORT=9000`: Raw TCP server port.
- `VGARSS_DATABASE_URL=sqlite:///./vgarss.db`: Local SQLite database path.
- `VGARSS_CORS_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173"]`: Allowed frontend origins.

---

## 4. Backend Setup (Python 3.12)

From the project root:

```powershell
# 1. Create a Python 3.12 virtual environment
python -m venv .venv

# 2. Activate the virtual environment
.\.venv\Scripts\Activate.ps1

# 3. Upgrade pip, wheel, and setuptools
python -m pip install --upgrade pip setuptools wheel

# 4. Install backend dependencies
pip install -r backend/requirements.txt
```

---

## 5. Frontend Setup (Node.js & npm)

From the project root:

```powershell
# 1. Navigate to the frontend directory
cd frontend

# 2. Install Node dependencies (React, Vite, Tailwind CSS, Lucide)
npm install

# 3. Return to project root
cd ..
```

---

## 6. Service Launch Options

### Option A: Unified Development Launcher (Recommended)

The easiest and most reliable method to start VGARSS is via [`scripts/dev.ps1`](file:///c:/Users/Welcome/OneDrive/Desktop/os%20cn%20project/scripts/dev.ps1).

```powershell
# From project root:
.\scripts\dev.ps1
```

**What `dev.ps1` does automatically**:
1. Checks that `.venv` and `frontend/node_modules` exist.
2. Checks that required ports (**8000**, **9000**, **5173**) are free.
3. Spawns the FastAPI backend (with Raw TCP server enabled) in a background process.
4. Spawns the Vite frontend development server.
5. Monitors both processes and displays live URLs:
   - Frontend UI: `http://localhost:5173`
   - REST API & Swagger: `http://127.0.0.1:8000/docs`
   - Raw TCP Server: `127.0.0.1:9000`
6. Catches `Ctrl+C` interrupt and performs a clean process tree shutdown.

#### Running Preflight Verification Before Launch:
```powershell
.\scripts\dev.ps1 -RunTests
```

---

### Option B: Independent PowerShell Sessions

If you prefer watching backend logs and frontend HMR in separate terminal windows:

#### Terminal 1: Backend & TCP Server
```powershell
.\scripts\run-backend.ps1
```
*(Runs port audit, loads `.venv`, sets `VGARSS_ENABLE_TCP=true`, and boots Uvicorn on `127.0.0.1:8000`)*

#### Terminal 2: Frontend Client
```powershell
.\scripts\run-frontend.ps1
```
*(Runs npm audit, checks port 5173, and boots Vite dev server on `http://localhost:5173`)*

---

## 7. Running Automated Tests

Run the complete test suite (unit tests, network framing tests, security fuzzing, frontend tests, and production build) with one command:

```powershell
.\scripts\test-all.ps1
```

### Running Specific Test Categories:
```powershell
# Run only CPU scheduling unit tests (17 tests)
.\.venv\Scripts\pytest tests/backend/test_schedulers.py -v

# Run only Concurrency & Mutex/Semaphore tests (11 tests)
.\.venv\Scripts\pytest tests/backend/test_resources.py -v

# Run only Raw TCP Socket Framing tests (7 tests)
.\.venv\Scripts\pytest tests/backend/test_tcp_server.py -v

# Run only WebSocket Networking & Resync tests (7 tests)
.\.venv\Scripts\pytest tests/backend/test_websocket_networking.py -v

# Run Security, Boundary & RBAC tests (9 tests)
.\.venv\Scripts\pytest tests/backend/test_security_and_edge_cases.py -v

# Run Frontend Vitest component tests (6 tests)
npm --prefix frontend test
```

---

## 8. Verifying the Raw TCP Socket Server

The raw TCP socket server runs on port 9000 and uses a **4-byte big-endian length prefix** followed by UTF-8 JSON.

To test the socket connection and framing directly from PowerShell:

```powershell
.\scripts\test-tcp.ps1
```

**Expected Output**:
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

---

## 9. Verifying the VGARSS 2.0 Chat & Task Coordination Platform

To verify the complete chat-first multi-user platform, run the verification script:

```powershell
.\.venv\Scripts\python scripts/verify_chat_platform.py
```

This script:
1. Logs in as `alice` and verifies workspace and channel discovery.
2. Posts a chat message with monotonic sequence assignment.
3. Creates a collaborative task directly attached to the chat message.
4. Switches sessions to `bob` and posts a threaded reply.
5. Updates task execution state (`NEW` -> `RUNNING`), emitting automated system events into the message stream.
6. Validates chronological message stream retrieval and presence updates.

---

## 10. Running the Live End-to-End Demonstration

To run an interactive, 10-phase demonstration testing all subsystems simultaneously:

```powershell
.\.venv\Scripts\python scripts/demo_e2e_workflow.py
```

**Demonstration Workflow**:
1. Verifies FastAPI `/api/v1/health` and TCP `/api/v1/network/tcp/status`.
2. Creates an administrative session token via `/api/v1/auth/sessions`.
3. Creates a Virtual Group (`VGARSS Demonstration Group`).
4. Establishes dual WebSocket client streams to `/ws/groups/{group_id}`.
5. Submits simulation tasks (`P1`, `P2`, `P3`) with CPU bursts and resource requirements.
6. Steps simulation clock deterministically; observes synchronized WebSocket broadcasts.
7. Updates scheduling policy dynamically (e.g. from `ROUND_ROBIN` to `SRTF`).
8. Triggers a resource conflict on a shared Mutex; verifies process transitions to `WAITING`.
9. Releases the Mutex; verifies waiting process awakens to `READY` and finishes in `TERMINATED`.
10. Validates raw TCP socket framing, PING/PONG, and peer-to-peer forwarding on port 9000.

---

## 11. Port Management & Process Troubleshooting

If a port conflict occurs on ports **8000**, **9000**, or **5173**:

### 1. Identify Which Process Holds the Port
```powershell
Get-NetTCPConnection -LocalPort 8000, 9000, 5173 -State Listen -ErrorAction SilentlyContinue | 
    Select-Object LocalAddress, LocalPort, OwningProcess, @{Name="ProcessName"; Expression={(Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue).ProcessName}}
```

### 2. Terminate Only the Offending Process
```powershell
# Terminate by Process ID (replace <PID> with the OwningProcess number)
Stop-Process -Id <PID> -Force
```

### 3. Terminating Node.js Process Trees on Windows
Because `npm run dev` spawns a child `node.exe` process that may survive when the parent command is interrupted, use `taskkill /T` to kill the entire process tree:
```powershell
taskkill /PID <PID> /T /F
```

---

## 12. Common Windows Pitfalls & Solutions

| Issue | Root Cause | Solution |
| :--- | :--- | :--- |
| `File cannot be loaded because running scripts is disabled` | Windows PowerShell default Execution Policy is `Restricted`. | Run `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force`. |
| `The term 'python' is not recognized` | Python not in Windows system PATH. | Reinstall Python with "Add python.exe to PATH" checked, or specify full path to `python.exe`. |
| Path contains spaces (e.g., `OneDrive/Desktop/os cn project`) | PowerShell interprets unquoted spaces as argument separators. | Always wrap file paths in double quotes: `"scripts/dev.ps1"`. All provided project scripts automatically quote paths. |
| `sqlite3.OperationalError: database is locked` | Simultaneous SQLite writes without WAL mode. | VGARSS automatically configures SQLite in `WAL` (Write-Ahead Logging) mode on startup. Ensure no external SQLite browser has the database locked in exclusive mode. |
| TCP Server connection refused on port 9000 | Backend launched without TCP enabled. | Set environment variable `$env:VGARSS_ENABLE_TCP="true"` or use `scripts/run-backend.ps1` which sets it automatically. |
