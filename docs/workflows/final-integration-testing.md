# Workflow 7 — Final Integration Testing

## Objective
Validate the entire end-to-end VGARSS system across REST API, WebSocket streams, raw TCP socket client, and React UI.

## Step-by-Step Procedure
1. Start Backend server (`uvicorn backend.app.main:app`).
2. Start Frontend server (`npm run dev`).
3. Connect a raw TCP client to port 9000 and submit a batch of processes.
4. Verify in the React UI via WebSocket that the submitted processes appear in the `NEW` -> `READY` state.
5. Trigger simulation playback in the UI.
6. Verify live Gantt chart progression, metric calculation, and process termination.
7. Confirm that both TCP client and Web client receive real-time state broadcasts synchronously.
8. Perform final security scan to ensure no `.env` files or credentials are leaked in repository commits.
