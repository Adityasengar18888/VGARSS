# VGARSS — Virtual Group Asynchronous Real-Time Resource Synchronization & Scheduling System

VGARSS is a dual-domain engineering system uniting **Computer Networks** (asynchronous client-server architecture, message validation, bi-directional WebSockets, raw TCP socket framing) and **Operating Systems** (process state modeling, CPU scheduling algorithms, mutex/semaphore synchronization, deadlock avoidance/detection).

---

## System Overview

```
                      +---------------------------------------+
                      |       VGARSS React Web Client         |
                      |  (Vite + TypeScript + Tailwind CSS)   |
                      +------------------+--------------------+
                                         |
                       REST API /        |  Bi-directional
                       Status Polling    |  WebSockets (/ws)
                                         v
                      +---------------------------------------+
                      |         FastAPI Core Engine           |
                      |  - REST Endpoints (/api/v1)           |
                      |  - WebSocket Telemetry Broadcast      |
                      |  - SQLite Simulation State Persistence|
                      +------------------+--------------------+
                                         |
               +-------------------------+-------------------------+
               |                                                   |
               v                                                   v
+-------------------------------+               +----------------------------------+
|  OS Simulation Engine Core    |               | Raw TCP Socket Demonstration     |
| - Process Lifecycle (5-State) |               | - Port 9000 Server               |
| - Scheduler (FCFS, SJF, RR)   |               | - Custom length-prefixed framing |
| - Mutex / Semaphore Engine    |               | - Multi-client concurrent socket |
| - Deadlock Detection (RAG)    |               +----------------------------------+
+-------------------------------+
```

---

## Prerequisites (Verified on Host)

- **Operating System**: Windows 11 (64-bit)
- **Node.js**: v22.17.0+ & npm 11.6.0+
- **Python**: 3.12.5+
- **Git**: 2.50.1+
- **PowerShell**: 5.1+

---

## Directory Structure

```
.
├── .agents/
│   └── skills/                  # Antigravity project skills
│       ├── ui-ux-design/
│       ├── react-architecture/
│       ├── computer-networks/
│       ├── operating-systems/
│       ├── concurrency-and-synchronization/
│       ├── database-api-design/
│       ├── testing-and-verification/
│       └── windows-development-workflow/
├── .env.example                 # Config template
├── .gitignore                   # Multi-runtime ignore specifications
├── AGENTS.md                    # Core engineering standards & guidelines
├── README.md                    # Project documentation
├── docs/                        # Architecture, setup, API & testing docs
│   ├── architecture.md
│   ├── setup-windows.md
│   ├── api-specification.md
│   └── testing-plan.md
├── backend/                     # Python 3.12 FastAPI backend & TCP server
│   ├── app/
│   ├── requirements.txt
│   └── pyproject.toml
├── frontend/                    # React + TypeScript + Vite + Tailwind frontend
│   ├── src/
│   └── package.json
└── tests/                       # Automated test suites
    ├── backend/
    ├── frontend/
    └── integration/
```

---

## Quick Start (Windows PowerShell)

### 1. Backend Setup
```powershell
# In project root
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

### 2. Frontend Setup
```powershell
cd frontend
npm install
npm run dev
```

### 3. Run Automated Tests
```powershell
pytest tests/backend -v
```
