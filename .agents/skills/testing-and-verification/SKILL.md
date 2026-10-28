---
name: testing-and-verification
description: >-
  Use this skill when authoring, executing, or troubleshooting automated tests,
  including backend unit tests with pytest, API endpoint tests with httpx, frontend verification,
  and Antigravity browser automation.
---

# Testing & Verification Skill for VGARSS

This skill provides step-by-step procedures for running automated test suites, validating scheduling metrics, and testing browser behavior in VGARSS.

## 1. Backend Testing with `pytest`

1. **Test Location**:
   - Store all backend test suites in `tests/backend/`.
   - File naming: `test_*.py`.
2. **Key Test Suites**:
   - `test_process_lifecycle.py`: Tests state machine transitions (NEW -> READY -> RUNNING -> WAITING -> TERMINATED).
   - `test_schedulers.py`: Tests FCFS, SJF, SRTF, RR, Priority with exact mathematical assertions on turnaround and waiting times.
   - `test_synchronization.py`: Tests mutex locking, semaphore count depletion, and deadlock detection graph cycle analysis.
   - `test_api.py`: Tests `/api/v1/health` and simulation control endpoints using `httpx.AsyncClient` or FastAPI `TestClient`.
3. **Execution Command**:
   ```powershell
   # In project root with active venv:
   pytest tests/backend -v
   ```

## 2. Frontend & Browser Verification

1. **Type Checking & Build Testing**:
   ```powershell
   cd frontend
   npx tsc --noEmit
   npm run build
   ```
2. **Browser Subagent Testing**:
   - Use the native `browser_subagent` to open `http://localhost:5173`.
   - Verify that the title renders, the simulation controls respond, and the WebSocket indicator shows connected.
   - Session WebP recordings are saved to artifacts for review.

## Verification Checklist
- All automated tests must exit with code 0.
- Never mark a test as passed without actual execution and output inspection.
