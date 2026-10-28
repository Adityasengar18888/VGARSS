# VGARSS — API & Protocol Specification

## 1. REST Endpoints (HTTP Port 8000)

### 1.1 System Health
- **`GET /api/v1/health`**
  - **Response 200 OK**:
    ```json
    {
      "status": "healthy",
      "version": "1.0.0",
      "timestamp": "2026-10-28T22:45:00Z",
      "ports": {
        "rest_api": 8000,
        "websocket": 8000,
        "raw_tcp": 9000
      }
    }
    ```

### 1.2 Simulation Configuration & Control
- **`POST /api/v1/simulation/load`**
  - Load a set of processes into the `NEW` state.
  - **Payload**:
    ```json
    {
      "algorithm": "ROUND_ROBIN",
      "time_quantum": 2,
      "processes": [
        { "id": "P1", "arrival_time": 0, "burst_time": 5, "priority": 2 },
        { "id": "P2", "arrival_time": 1, "burst_time": 3, "priority": 1 }
      ]
    }
    ```
- **`POST /api/v1/simulation/step`**
  - Advances simulation by 1 time unit (tick).
- **`POST /api/v1/simulation/play`**
  - Continuously executes the simulation.
- **`POST /api/v1/simulation/pause`**
  - Pauses execution.
- **`POST /api/v1/simulation/reset`**
  - Resets all queues and resource states.

---

## 2. WebSocket Protocol (`ws://127.0.0.1:8000/ws`)

### 2.1 Server Broadcast Events
Every simulation step broadcasts state updates:
```json
{
  "event": "STATE_UPDATE",
  "tick": 4,
  "running_process": "P1",
  "ready_queue": ["P2"],
  "waiting_queue": [],
  "terminated": [],
  "gantt_entry": { "tick": 4, "process_id": "P1" },
  "resources": [
    { "name": "R1_MUTEX", "type": "mutex", "holder": "P1", "waiters": [] },
    { "name": "R2_SEM", "type": "semaphore", "available": 2, "max": 3 }
  ]
}
```

---

## 3. Raw TCP Socket Protocol (Port 9000)

### 3.1 Framing
All TCP messages are framed with a 4-byte big-endian unsigned integer prefix indicating the byte length of the UTF-8 encoded JSON payload:

```
+---------------------------+-----------------------------------+
|  Length (4 Bytes Big-End) |  UTF-8 Encoded JSON Payload       |
+---------------------------+-----------------------------------+
```

### 3.2 Sample Message
- Length: `0x0000003A` (58 bytes)
- Payload: `{"action": "SUBMIT_PROCESS", "id": "P3", "arrival": 2, "burst": 4}`
