---
name: database-api-design
description: >-
  Use this skill when designing, building, or modifying REST API endpoints, Pydantic data schemas,
  SQLite database persistence, and data models in the VGARSS backend.
---

# Database Architecture & API Design Skill for VGARSS

This skill provides guidelines for constructing reliable, clean, and schema-validated REST APIs and database interactions for VGARSS.

## 1. REST API Design Standards

1. **Path Conventions**:
   - Prefix all resource endpoints with `/api/v1/`.
   - Use plural nouns for resource collections (e.g., `/api/v1/simulations`, `/api/v1/processes`).
   - Use verbs only for non-CRUD state control actions (e.g., `/api/v1/simulation/step`, `/api/v1/simulation/reset`).
2. **Status Codes**:
   - `200 OK`: Successful read or state update.
   - `201 Created`: Simulation record or process set created.
   - `400 Bad Request`: Validation failure (e.g. invalid burst time $\le 0$).
   - `404 Not Found`: Process ID or simulation run ID does not exist.
   - `422 Unprocessable Entity`: Automatic FastAPI schema validation error.
3. **Pydantic Validation**:
   - Define strict models using Pydantic v2.
   - Use `Field(gt=0)` for burst times, `Field(ge=0)` for arrival times.
   - Enforce enum constraints on scheduling algorithms (`FCFS`, `SJF`, `SRTF`, `ROUND_ROBIN`, `PRIORITY`).

## 2. Persistence Layer (SQLite & Future Migration)

1. **SQLite Storage**:
   - Store simulation run metadata, timeline logs, and calculated metrics in `vgarss.db`.
   - Maintain WAL (Write-Ahead Logging) mode for concurrent read/write support without locking the database file: `PRAGMA journal_mode=WAL;`.
2. **Portability**:
   - Structure models so they can transition from SQLite to PostgreSQL with minimal connection string modification.

## Verification Checklist
- Access Swagger UI at `http://127.0.0.1:8000/docs` to inspect generated OpenAPI schemas.
- Ensure database sessions are committed and closed cleanly using dependency injection (`Depends(get_db)`).
