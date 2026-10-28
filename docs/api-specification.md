# VGARSS — Versioned REST API & Protocol Specification

**Base URL**: `http://127.0.0.1:8000/api/v1`  
**Authentication**: HTTP Bearer Token (`Authorization: Bearer <session_token>`)  
**Data Exchange Format**: JSON (Pydantic v2 validated)  

---

## 1. Authentication & Session Endpoints (`/auth`)

### 1.1 Register User
- **`POST /api/v1/auth/register`**
- **Description**: Registers a new user account. Hashes the password using PBKDF2 HMAC SHA-256 with an individual salt. Issues a 24-hour session token.
- **Request Body**:
  ```json
  {
    "username": "alice_dev",
    "email": "alice@vgarss.org",
    "password": "SecurePassword123!"
  }
  ```
- **Response 201 Created**:
  ```json
  {
    "token": "dGhpcy1pcy1hLXRlc3Qtc2Vzc2lvbi10b2tlbg",
    "expires_at": "2026-10-29T23:20:00+00:00",
    "user": {
      "id": "u-91823-abcd",
      "username": "alice_dev",
      "email": "alice@vgarss.org",
      "created_at": "2026-10-28T23:20:00+00:00"
    }
  }
  ```
- **Security Invariant**: Password hashes are never returned in responses.

### 1.2 User Login
- **`POST /api/v1/auth/login`**
- **Description**: Verifies credentials using constant-time comparison. Issues a new session token.
- **Request Body**:
  ```json
  {
    "username": "alice_dev",
    "password": "SecurePassword123!"
  }
  ```
- **Response 200 OK**: Returns `TokenResponse`.

### 1.3 Current User Profile
- **`GET /api/v1/auth/me`**
- **Headers**: `Authorization: Bearer <token>`
- **Response 200 OK**: Returns `UserResponse`.

---

## 2. Virtual Groups & Authorization (`/groups`)

### 2.1 List Accessible Groups
- **`GET /api/v1/groups`**
- **Description**: Lists all Virtual Groups where the authenticated user is either the owner or an authorized member.
- **Response 200 OK**:
  ```json
  [
    {
      "id": "grp-alpha-01",
      "name": "Production Simulation Cluster",
      "description": "Kernel benchmark domain",
      "owner_id": "u-91823-abcd",
      "created_at": "2026-10-28T23:20:00+00:00",
      "members": []
    }
  ]
  ```

### 2.2 Create Virtual Group
- **`POST /api/v1/groups`**
- **Request Body**:
  ```json
  {
    "name": "Cluster Beta",
    "description": "Round Robin and Mutex evaluations"
  }
  ```
- **Response 201 Created**: Creator is automatically established as owner and group `ADMIN`.

### 2.3 Get Group Details & Member Roster
- **`GET /api/v1/groups/{group_id}`**
- **Authorization**: User must be the owner or an active member of `{group_id}`. Cross-group unauthorized access returns **403 Forbidden**.

### 2.4 Add Member to Group
- **`POST /api/v1/groups/{group_id}/members`**
- **Request Body**: `{"username": "bob_tester", "role": "MEMBER"}`
- **Response 201 Created**.

---

## 3. Simulation Lifecycle & Stepping (`/groups/{group_id}/simulations`)

### 3.1 Create Simulation
- **`POST /api/v1/groups/{group_id}/simulations`**
- **Request Body**:
  ```json
  {
    "name": "RR Quantum 2 Benchmark",
    "algorithm": "ROUND_ROBIN",
    "time_quantum": 2,
    "aging_interval": null,
    "is_preemptive": false,
    "processes": [
      { "id": "P1", "arrival_time": 0, "burst_time": 5, "priority": 1 },
      { "id": "P2", "arrival_time": 1, "burst_time": 3, "priority": 2 }
    ],
    "resources": [
      { "id": "R1", "name": "DB Mutex", "total_capacity": 1, "resource_type": "MUTEX", "order_rank": 1 }
    ]
  }
  ```
- **Response 201 Created**: Returns simulation initial state. Persists configuration in SQLite (`simulations`, `simulation_processes`, `simulation_resources`).

### 3.2 Step Simulation by 1 Tick
- **`POST /api/v1/groups/{group_id}/simulations/{sim_id}/step`**
- **Description**: Advances simulation clock by exactly 1 tick. Enforces task state transition (cannot step a `COMPLETED` simulation, returns 400 Bad Request).
- **Response 200 OK**:
  ```json
  {
    "simulation_id": "sim-8192",
    "tick": 1,
    "status": "RUNNING",
    "running_process_id": "P1",
    "ready_queue": ["P2"],
    "waiting_queue": [],
    "terminated_processes": [],
    "metrics": {
      "total_ticks": 1,
      "busy_ticks": 1,
      "idle_ticks": 0,
      "cpu_utilization": 100.0,
      "throughput": 0.0,
      "avg_waiting_time": 0.0,
      "avg_turnaround_time": 0.0,
      "avg_response_time": 0.0
    },
    "gantt_entry": {
      "tick": 0,
      "process_id": "P1",
      "state": "RUNNING"
    }
  }
  ```

### 3.3 Play to Completion
- **`POST /api/v1/groups/{group_id}/simulations/{sim_id}/play`**
- **Description**: Runs simulation until all processes reach `TERMINATED`. Computes final metrics and seals records in SQLite.

---

## 4. Resource Synchronization & Deadlock (`/resources`)

### 4.1 Acquire Resource
- **`POST /api/v1/groups/{group_id}/simulations/{sim_id}/resources/acquire`**
- **Request Body**:
  ```json
  {
    "process_id": "P1",
    "resource_id": "R1",
    "mode": "EXCLUSIVE",
    "units": 1
  }
  ```
- **Response 200 OK**:
  ```json
  {
    "granted": true,
    "process_id": "P1",
    "resource_id": "R1",
    "status": "ACQUIRED"
  }
  ```
- *Note*: If blocked, returns `"status": "BLOCKED_WAITING"`, transitions process to `WAITING`, and vacates CPU.

### 4.2 Release Resource
- **`POST /api/v1/groups/{group_id}/simulations/{sim_id}/resources/release`**
- **Request Body**: `{"process_id": "P1", "resource_id": "R1"}`
- **Response 200 OK**: Awakened waiting processes are unblocked and transition `WAITING` $\to$ `READY`.

### 4.3 Check Deadlock
- **`GET /api/v1/groups/{group_id}/simulations/{sim_id}/resources/deadlock`**
- **Response 200 OK**:
  ```json
  {
    "deadlock_detected": true,
    "cycle_processes": ["P1", "P2"],
    "involved_resources": ["R1", "R2"],
    "description": "Circular wait deadlock detected: P1 -> P2 -> P1"
  }
  ```

---

## 5. Health & Root Endpoints

- **`GET /`**: API index, documentation links, and route catalogue.
- **`GET /api/v1/health`**: Real-time service status, environment name, timestamp, and configured port mapping (`8000`, `9000`).
