# VGARSS — Design System & UI/UX Specification

**Design Direction**: Premium Dark Infrastructure & Operating System Monitoring Console  
**Document Version**: 2.0.0  
**Target Viewports**: 1920x1080 (Desktop), 1440x900 (Laptop), 1024x768 (Tablet), Mobile adaptation  
**Primary Typography**: Inter (UI / Text), JetBrains Mono (Data, Metrics, Logs, Hex)  
**Authors**: Senior UI/UX Designer & Principal Frontend Architect  

---

## 1. Design Philosophy & Infrastructure Aesthetic

The VGARSS dashboard embodies a high-density, high-precision developer-tool interface reminiscent of modern telemetry observability platforms (Datadog, Grafana, Cloudflare Dashboard, Linear).

### Key Design Pillars
1. **Information Density with Visual Breathing Room**: Compact, readable information hierarchy utilizing consistent border delimiters (`border-slate-800`), crisp panel cards, and generous internal paddings.
2. **Restrained, Semantic Color Palette**: Deep dark background tones (obsidian, slate 950) with purposeful accent colors reserved exclusively for process states, system health, and alert priorities.
3. **Living Interface**: Real-time micro-indicators (pulsing connection beads, smooth Gantt timeline progressions, active queue transitions) that reflect simulation and network reality.
4. **Resilient System States**: Every single component explicitly defines **Loading**, **Empty**, **Active/Executing**, **Paused**, **Error**, and **Disconnected** states. Nonfunctional placeholder buttons or fabricated metrics are strictly forbidden.

---

## 2. Design Tokens

### 2.1 Color Palette

```css
/* Surface & Background */
--bg-canvas:        #020617; /* Slate 950 - Root background */
--bg-surface:       #0b1120; /* Slate 900/90 - Card and panel surfaces */
--bg-surface-elev:  #0f172a; /* Slate 900 - Hovered or modal surfaces */
--bg-input:         #030712; /* Slate 950/80 - Inputs and sub-containers */

/* Borders & Dividers */
--border-subtle:    #1e293b; /* Slate 800 - Standard panel borders */
--border-focus:     #0284c7; /* Sky 600 - Input focus borders */
--border-highlight: #334155; /* Slate 700 - Hover border state */

/* Text Hierarchy */
--text-primary:     #f8fafc; /* Slate 50 - High contrast titles & values */
--text-secondary:   #94a3b8; /* Slate 400 - Labels, descriptions */
--text-muted:       #64748b; /* Slate 500 - Inactive items, timestamps */
--text-code:        #38bdf8; /* Sky 400 - Code symbols, process IDs */

/* Semantic Accents & Status Indicators */
--status-new:       #38bdf8; /* Sky 400 - Process: NEW */
--status-ready:     #fbbf24; /* Amber 400 - Process: READY */
--status-running:   #34d399; /* Emerald 400 - Process: RUNNING */
--status-waiting:   #f43f5e; /* Rose 500 - Process: WAITING / Blocked */
--status-term:      #64748b; /* Slate 500 - Process: TERMINATED */
--status-deadlock:  #e11d48; /* Rose 600 - Deadlock Alert Banner */
--status-online:    #10b981; /* Emerald 500 - WebSocket / TCP Online */
--status-offline:   #ef4444; /* Red 500 - Service Disconnected */
```

### 2.2 Typography Scale

All typography uses **Inter** for user interface elements and **JetBrains Mono** for numerical metrics, ticks, process identifiers, hex dumps, and telemetry feeds.

| Token | Font Family | Size | Weight | Line Height | Use Case |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `display-lg` | Inter | 24px (1.5rem) | 700 (Bold) | 32px | View header titles, modal titles |
| `display-md` | Inter | 18px (1.125rem) | 600 (Semibold) | 24px | Card section headers |
| `body-base` | Inter | 14px (0.875rem) | 400 (Regular) | 20px | Descriptions, modal bodies |
| `body-sm` | Inter | 12px (0.75rem) | 500 (Medium) | 16px | Table text, button labels, badges |
| `mono-kpi` | JetBrains Mono | 20px (1.25rem) | 600 (Semibold) | 24px | KPI numbers, CPU utilization |
| `mono-code` | JetBrains Mono | 12px (0.75rem) | 400 (Regular) | 16px | Ticks, process IDs, logs, JSON |
| `mono-xs` | JetBrains Mono | 10px (0.625rem) | 500 (Medium) | 12px | Micro tags, timestamps, offsets |

### 2.3 Spacing, Borders & Shadows

- **Spacing Grid**: 4px base (`p-1` = 4px, `p-2` = 8px, `p-3` = 12px, `p-4` = 16px, `p-6` = 24px).
- **Border Radii**:
  - `rounded-lg`: 8px (Cards, modal surfaces, table containers).
  - `rounded-md`: 6px (Buttons, text inputs, dropdowns).
  - `rounded-sm`: 4px (Badges, Gantt slice blocks, status pills).
- **Shadows**:
  - `shadow-sm`: Subtle separation for cards on dark canvases.
  - `shadow-cyan-500/10`: Subtle glowing edge on active controls and primary action buttons.

---

## 3. Global Status & State Conventions

### 3.1 Process State Matrix

| State Enum | Visual Badge | Background Color | Text / Border Color | Description |
| :--- | :--- | :--- | :--- | :--- |
| `NEW` | `● NEW` | `bg-sky-950/60` | `text-sky-300 border-sky-800` | Process admitted, awaiting arrival tick. |
| `READY` | `● READY` | `bg-amber-950/60` | `text-amber-300 border-amber-800`| In Ready Queue awaiting CPU dispatch. |
| `RUNNING` | `● RUNNING` | `bg-emerald-950/60`| `text-emerald-300 border-emerald-800`| Actively executing burst on CPU. |
| `WAITING` | `● WAITING` | `bg-rose-950/60` | `text-rose-300 border-rose-800` | Blocked waiting on Mutex/Semaphore. |
| `TERMINATED`| `● TERM` | `bg-slate-900` | `text-slate-400 border-slate-800` | Burst completed, PCB metrics finalized. |

### 3.2 Universal Component States

Every visual module implements 6 standardized states:
1. **Loading State**: Shimmering skeleton placeholders matching the exact card dimensions (`animate-pulse bg-slate-800/40`).
2. **Empty State**: Centered icon, muted heading, and a direct Call-To-Action (CTA) (e.g. "No processes configured. [Load Default Benchmark Workload]").
3. **Active / Executing State**: Real-time tick animations, active process glowing green, live telemetry streaming in console.
4. **Paused State**: Amber subtle header banner indicating simulation clock is halted. Step and Resume buttons enabled.
5. **Error State**: Rose-tinted container with explicit error code, detailed diagnostics, and a "Retry / Reset" button.
6. **Disconnected State**: Persistent top overlay banner: *"WebSocket connection dropped. Retrying in Xs..."* with an immediate manual "Reconnect" button.

---

## 4. Reusable Core UI Components

### 4.1 Global Navigation & Header Bar
- **Sidebar**: Fixed 64px collapsed (expandable to 240px) with icons for each of the 8 views. Active view highlighted with cyan vertical bar and `bg-slate-800/60`.
- **Top Utility Header**:
  - Virtual Group Selector dropdown.
  - Simulation Clock: `TICK: 0042` in JetBrains Mono.
  - Service Status Indicators:
    - `REST API`: Green dot + response latency (e.g. `12ms`).
    - `WebSocket`: Green pulsing dot + `ONLINE`.
    - `TCP Port 9000`: Indigo dot + `LISTENING`.
  - Global Simulation Toolbar: [Play / Auto-tick], [Step 1 Tick], [Pause], [Reset], Speed Slider (100ms - 2000ms).

### 4.2 Interactive Gantt Chart Visualizer
- **Timeline Grid**: Horizontal scrolling time-series grid where columns represent simulation ticks ($t_0, t_1, t_2, \dots$).
- **Process Rows**: Each process occupies a distinct swimlane row labeled with its ID ($P_1, P_2, \dots$).
- **Execution Slices**: Color-coded rectangles indicating state during that tick:
  - Green block: Active execution burst.
  - Amber striped block: Waiting in ready queue.
  - Red patterned block: Blocked waiting on resource.
  - Gray dash: Idle or not arrived.
- **Context Tooltip**: Hovering over any slice reveals: `Tick t=4: Process P1 (Remaining Burst: 2, Priority: 1)`.

### 4.3 Queue Swimlanes (Ready & Waiting)
- Horizontal cards showing processes currently queued in FIFO or priority sequence.
- Each PCB card displays: Process ID, Arrival Time, Burst/Remaining, and Priority badge.
- Drag-and-drop or reorder capability for interactive simulation testing.

### 4.4 Resource & Mutex Allocation Matrix
- **Mutex Widget**: Circular lock icon (`Unlocked` in emerald vs `Locked by P1` in amber). Waiters list displayed as small chip tags below.
- **Counting Semaphore Widget**: Progress bar displaying capacity allocation (e.g. `2 / 3 Tokens Available`).
- **Acquire/Release Simulation Buttons**: Allows interactive injection of resource claims.

### 4.5 Deadlock Laboratory (Resource Allocation Graph)
- **Interactive SVG / Canvas Graph**:
  - Circular nodes: Processes ($P_1, P_2, \dots$).
  - Square nodes: Resources ($R_1, R_2, \dots$).
  - Directed arrows: Blue for resource assigned ($R_j \to P_i$), orange for resource requested ($P_i \to R_j$).
- **Cycle Warning Banner**: If a cycle is detected, participating edges pulse in bright rose (`#f43f5e`), and the exact cycle sequence is printed in monospace with one-click **Abort** or **Preempt** resolution buttons.

### 4.6 Raw Telemetry & Packet Inspector
- Split console view: Left side displays real-time event log stream; right side displays raw framed packet payload (Hex viewer + parsed JSON tree).
- Filter controls: Filter by `WebSocket`, `TCP:9000`, `REST`, or `SIM_EVENT`.

---

## 5. View-by-View Detailed Specifications

### 5.1 Overview View (`/`)
- **Top Metric Cards (KPIs)**:
  - Total Active Processes (Count & State Breakdown).
  - CPU Utilization percentage gauge.
  - Average Turnaround Time ($TAT$).
  - Average Waiting Time ($WT$).
  - Throughput (completed processes per 100 ticks).
- **Mini-Gantt Preview**: Real-time sliding 20-tick execution window.
- **Active Resource Lock Status**: Quick badges showing Mutex and Semaphore occupancy.
- **Recent Telemetry Feed**: Real-time 5-line scrolling log.

### 5.2 Virtual Groups View (`/groups`)
- Grid of virtual group cards representing isolated simulation partitions.
- Card metrics: Group Name, Description, Assigned Processes, Current Running Algorithm, Isolation Status.
- Actions: "Create New Virtual Group", "Clone Group Configuration", "Switch Active Context".

### 5.3 Process Scheduler View (`/scheduler`)
- Full-width interactive Gantt chart visualizer with zoom controls (1x, 2x, 5x).
- Algorithm Selection Bar: Switch between `FCFS`, `SJF`, `SRTF`, `ROUND_ROBIN`, `PRIORITY`.
- Algorithm Parameter Inputs: Quantum slider ($Q \in [1, 10]$), Context Switch Overhead ($\delta \in [0, 3]$ ticks), Aging Frequency ($W \in [1, 20]$).
- Workload Ingestion Form: Add process modal (ID, Arrival, Burst, Priority) + "Load Standard Benchmark (Silberschatz Ex. 5.1)".
- Detailed PCB Table: Tabular breakdown showing Start Time, Completion Time, TAT, WT, RT with individual step inspection.

### 5.4 Resource Monitor View (`/resources`)
- Visual display of all shared system resources.
- Mutex Cards: Lock holder, lock duration, wait list sequence.
- Semaphore Bars: Available token fill meters.
- Critical Section Timeline: Tracks which process held which resource at each tick.

### 5.5 Deadlock Laboratory View (`/deadlock`)
- Dedicated visual canvas for the Resource Allocation Graph (RAG).
- "Inject Deadlock Scenario" preset button: Sets up the classic circular wait ($P_1 \to R_1 \to P_2 \to R_2 \to P_1$).
- Live Cycle Detector: Real-time status indicator (`NORMAL` vs `DEADLOCK DETECTED`).
- Recovery Action Panel:
  - "Kill Lowest Priority Process"
  - "Force Lock Preemption"
  - "Rollback to Tick t-k"

### 5.6 Network Monitor View (`/network`)
- Real-time network stream inspector.
- Dual-column telemetry view:
  - **Column 1**: WebSocket bi-directional channel (`ws://127.0.0.1:8000/ws`). Shows telemetry broadcasts, client pings, and acknowledgments.
  - **Column 2**: Port 9000 Raw TCP Socket Server monitor. Displays raw incoming packet byte lengths, 4-byte big-endian header dumps, and parsed JSON payloads.
- Connection stats: Active sockets, Total packets received, Byte throughput, Connection latency.

### 5.7 Performance Analytics View (`/analytics`)
- Comparative benchmarking charts comparing all 5 scheduling algorithms on the exact same workload:
  - FCFS vs SJF vs SRTF vs RR vs Priority.
  - Bar charts for Average Waiting Time and Turnaround Time.
  - Line graph showing CPU Utilization over simulation duration.
- Export options: Export benchmark report as CSV or JSON.

### 5.8 Settings View (`/settings`)
- Network configuration: Backend REST Host/Port (default: `127.0.0.1:8000`), TCP Socket Port (default: `9000`).
- Simulation defaults: Default scheduling strategy, default quantum, default aging rate.
- Database management: SQLite database size indicator, "Clear Simulation History", "Export Database Snapshot".

---

## 6. Responsive Layout & Breakpoint Specifications

| Viewport Class | Breakpoint | Layout Adaptations |
| :--- | :--- | :--- |
| **Desktop / Ultrawide** | $\ge 1440\text{px}$ | Full 3-column layouts. Expanded sidebar. Dual-pane network inspector. |
| **Standard Laptop** | $1024\text{px} - 1439\text{px}$ | 2-column layouts. Collapsed icon-only sidebar. Tabbed network inspector. |
| **Tablet** | $768\text{px} - 1023\text{px}$ | Single-column stacked cards. Horizontal scrolling Gantt chart with touch drag. |
| **Mobile** | $< 768\text{px}$ | Mobile navigation bottom bar or drawer. Condensed KPI metrics. Queue cards stacked vertically. |

---

## 7. Accessibility & Ergonomics (WCAG 2.1 AA)

1. **Color Contrast Ratios**:
   - All text meets a minimum contrast ratio of **4.5:1** against dark canvas backgrounds.
   - Status indicators utilize both color and geometric icon shapes (e.g. checkmark, square, triangle) to ensure legibility for color-blind users.
2. **Keyboard Navigation**:
   - `Spacebar`: Toggle Play / Pause simulation.
   - `Right Arrow` ($\to$): Step forward 1 tick.
   - `R`: Reset simulation.
   - `1` through `8`: Quick jump between navigation views.
3. **Screen Reader Semantics**:
   - All interactive controls feature explicit `aria-label` attributes (e.g. `aria-label="Step simulation forward by one tick"`).
   - Live Gantt updates announce significant state changes via `aria-live="polite"` regions.
