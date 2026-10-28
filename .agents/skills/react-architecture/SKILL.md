---
name: react-architecture
description: >-
  Use this skill when architecting, structuring, or developing React components,
  custom hooks, state management, WebSocket telemetry listeners, and TypeScript interfaces
  in the VGARSS frontend.
---

# React & TypeScript Architecture Skill for VGARSS

This skill provides architectural patterns, state management strategies, and component design rules for the VGARSS frontend.

## Project Structure Conventions

```
frontend/src/
├── assets/             # Static icons and assets
├── components/         # Reusable UI components
│   ├── controls/       # Simulation toolbar, buttons, inputs
│   ├── gantt/          # Live Gantt chart and timeline renderers
│   ├── queues/         # Process queue cards and status chips
│   ├── resources/      # Mutex, Semaphore, and Deadlock panels
│   └── telemetry/      # TCP packet logger and network monitor
├── hooks/              # Custom hooks (e.g. useWebSocket, useSimulation)
├── types/              # Strict TypeScript domain interfaces
│   ├── process.ts      # Process, PCB, and State definitions
│   ├── scheduling.ts   # Scheduling algorithms, metrics, and parameters
│   └── network.ts      # WebSocket events and TCP telemetry models
├── services/           # REST API client and WebSocket manager
└── App.tsx             # Root layout and component assembly
```

## Key Architectural Principles

1. **Strict TypeScript Types**:
   - Never use `any`. Always define explicit interfaces for API responses, simulation states, and WebSocket messages.
2. **WebSocket Resilient Hook (`useWebSocket`)**:
   - Automatically handle connect, reconnect backoff, heartbeat/ping-pong, and graceful disconnection states.
   - Buffer incoming events to prevent UI thread stuttering during high-speed simulation ticks.
3. **Optimistic Updates & Single Source of Truth**:
   - The backend simulation kernel is the authoritative source of truth for ticks, queue state, and process statuses.
   - The frontend synchronizes its state via WebSocket state packets or REST polling fallbacks.
4. **Performance & Render Optimization**:
   - Use `React.memo` or clean component boundaries for high-frequency elements like Gantt ticks and log streams.

## Verification Checklist
- Run `npm run lint` or `npx tsc --noEmit` to verify type safety.
- Verify that hot module replacement (HMR) operates smoothly without infinite render loops.
