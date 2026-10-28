---
name: ui-ux-design
description: >-
  Use this skill when designing, styling, and refining the user interface of VGARSS,
  including design tokens, dark developer-tool themes, typography, Gantt chart visuals,
  responsive layouts, empty/loading/error states, and visual polish.
---

# UI/UX Design System Skill for VGARSS

This skill guides the design and implementation of visual aesthetics, layout structures, and user interactions for the VGARSS developer dashboard.

## Design System Tokens

1. **Color Palette (Dark Theme Devtool)**:
   - **Background Canvas**: Slate 950 (`#020617`) or Zinc 950 (`#09090b`).
   - **Card / Surface**: Slate 900 (`#0f172a`) with subtle 1px border `slate-800` (`#1e293b`).
   - **Primary Accents**: Cyan 500 (`#06b6d4`), Emerald 500 (`#10b981`), Indigo 500 (`#6366f1`).
   - **Status Indicators**:
     - NEW: Sky 400 (`#38bdf8`)
     - READY: Amber 400 (`#fbbf24`)
     - RUNNING: Emerald 400 (`#34d399`)
     - WAITING: Rose 400 (`#f43f5e`)
     - TERMINATED: Slate 500 (`#64748b`)
2. **Typography**:
   - Primary: Inter / Outfit / sans-serif for clean readability.
   - Monospace: JetBrains Mono / Fira Code / monospace for tick counters, process IDs, hex dumps, and metrics.
3. **Information Density**:
   - Clean, compact spacing (`gap-3`, `p-4`, `text-xs` / `text-sm`) suitable for developer diagnostic consoles and operating system monitors.

## Essential View Components

1. **Header & Global Status Bar**:
   - System simulation state (Running, Paused, Stopped), Tick count, WebSocket link status badge, and TCP Port status.
2. **Interactive Simulation Controls**:
   - Step Forward (1 tick), Play / Auto-tick, Pause, Reset, Speed Slider (100ms - 2000ms), Algorithm Selector dropdown.
3. **Live Gantt Chart Visualizer**:
   - Horizontal time-series grid showing process execution intervals with colored process blocks and hover tooltips.
4. **Queue Swimlanes**:
   - Clear visual boxes for Ready Queue, Blocked/Waiting Queue, and Terminated pool.
5. **Resource Matrix & Deadlock Graph**:
   - Mutex locks, Semaphore tokens, and Resource Allocation Graph visualization with cycle warning banners.

## Verification Checklist
- Verify that every button triggers state changes without dead ends or missing handlers.
- Ensure all states (empty, loading, running, error, disconnected) are visually styled.
- Check contrast ratios and text legibility on dark backgrounds.
