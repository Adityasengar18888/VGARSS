# VGARSS 2.0 — Design System & UI/UX Specification

**Design Direction**: Dark Developer-Tool & High-Density Systems Collaboration Platform  
**Target Viewports**: Desktop Ultrawide (1920x1080), Standard Laptop (1440x900), Tablet (1024x768), Mobile (390x844 responsive)  
**Primary Typography**: Inter (UI / Text), JetBrains Mono (Data, Metrics, PCBs, Logs, Hex Dumps)  
**Authors**: Principal Product Designer & UI/UX Systems Architect  
**Document Version**: 2.0.0-PROD-DESIGN  

---

## 1. Design Philosophy & Aesthetic Pillars

VGARSS 2.0 synthesizes the fluid real-time communication of modern collaboration suites (Slack, Discord, Linear) with the analytical precision of developer observability consoles (Datadog, Grafana, Cloudflare).

### Key Design Pillars
1. **Three-Column Spatial Hierarchy**: Information flows naturally from high-level scope (Workspace Server Rail) to contextual channels and direct conversations (Channel Sidebar) to the central operational stage (Main Conversation Panel / Dedicated Systems Views).
2. **Restrained, Purposeful Semantic Accents**: Pure obsidian/slate canvas (`#020617`, `#0b1120`) prevents visual fatigue during long debugging sessions. Vibrant colors are reserved strictly for operational states (Emerald for running/online, Amber for ready/waiting, Rose for blocked/deadlock, Sky for interactive highlights).
3. **Living Real-Time Telemetry**: Micro-indicators (pulsing connection beads, live typing ripples, animated Gantt progress needles, smooth state pill transitions) provide immediate tactile feedback without disorienting layout shifts.
4. **Resilient System States**: Every component and panel explicitly specifies **Loading**, **Empty**, **Active/Executing**, **Paused**, **Error**, and **Disconnected** states. No placeholder dead-ends or fabricated data.
5. **Accessibility & Ergonomics (WCAG 2.1 AA)**: High-contrast ratios ($> 4.5:1$), distinct geometric shapes paired with color codes for color-blind safety, and keyboard-driven navigation (`Ctrl+K` for search, `Space` for play/pause).

---

## 2. Design Tokens

### 2.1 Color Palette

```css
:root {
  /* Surface & Canvas Tokens */
  --canvas-base:         #020617; /* Slate 950 - Root application background */
  --surface-rail:        #030712; /* Gray 950 - Server / Workspace Icon Rail (64px) */
  --surface-sidebar:     #090d16; /* Dark Slate - Channel & DM Navigation Sidebar (240px) */
  --surface-panel:       #0b1120; /* Slate 900 - Central Stage & Chat Canvas */
  --surface-card:        #0f172a; /* Slate 900 - Elevated Cards & Modals */
  --surface-elevated:    #1e293b; /* Slate 800 - Popovers, Tooltips & Menus */
  --surface-input:       #030712; /* Slate 950 - Input Fields & Textareas */

  /* Border & Divider Tokens */
  --border-subtle:       #1e293b; /* Slate 800 - Standard structural delimiters */
  --border-muted:        #151e2e; /* Muted inner borders */
  --border-focus:        #0ea5e9; /* Sky 500 - Focused inputs & active selections */
  --border-highlight:    #334155; /* Slate 700 - Hover border state */

  /* Text Hierarchy Tokens */
  --text-primary:        #f8fafc; /* Slate 50 - High contrast headings & values */
  --text-secondary:      #94a3b8; /* Slate 400 - Body copy, labels, timestamps */
  --text-muted:          #64748b; /* Slate 500 - Inactive tabs, placeholder text */
  --text-code:           #38bdf8; /* Sky 400 - Code symbols, process IDs, hex */
  --text-link:           #38bdf8; /* Sky 400 - Hyperlinks & interactive tags */

  /* OS Process & System States */
  --status-new:          #38bdf8; /* Sky 400 - Process: NEW admitted */
  --status-ready:        #fbbf24; /* Amber 400 - Process: READY in queue */
  --status-running:      #34d399; /* Emerald 400 - Process: RUNNING on CPU */
  --status-waiting:      #f43f5e; /* Rose 500 - Process: WAITING / Blocked */
  --status-terminated:   #64748b; /* Slate 500 - Process: TERMINATED */
  --status-deadlock:     #e11d48; /* Rose 600 - Deadlock cycle alert */

  /* Presence & Network Tokens */
  --presence-online:     #10b981; /* Emerald 500 - Connected & active */
  --presence-away:       #f59e0b; /* Amber 500 - Idle / Away */
  --presence-dnd:        #ef4444; /* Red 500 - Do Not Disturb */
  --presence-offline:    #64748b; /* Slate 500 - Offline */
  --network-tcp-badge:   #6366f1; /* Indigo 500 - Raw TCP Port 9000 */
  --network-ws-badge:    #06b6d4; /* Cyan 500 - Authenticated WebSocket */
}
```

### 2.2 Typography Scale

The type system pairs **Inter** (for user interface copy, navigation, buttons, and conversation feeds) with **JetBrains Mono** (for simulation ticks, PCBs, CPU utilization, hex dumps, and code blocks).

| Token | Font Family | Size | Weight | Line Height | Use Case |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `display-xl` | Inter | 28px (1.75rem) | 700 (Bold) | 36px | Modal hero titles, landing headers |
| `display-lg` | Inter | 20px (1.25rem) | 600 (Semibold) | 28px | Channel headers, view titles |
| `display-md` | Inter | 16px (1.0rem) | 600 (Semibold) | 24px | Section headers, card titles |
| `body-base` | Inter | 14px (0.875rem) | 400 (Regular) | 20px | Chat message body, descriptions |
| `body-sm` | Inter | 12px (0.75rem) | 500 (Medium) | 16px | Timestamps, author names, button copy |
| `mono-kpi` | JetBrains Mono | 22px (1.375rem) | 600 (Semibold) | 28px | CPU Utilization, Turnaround Time, Tick counts |
| `mono-code` | JetBrains Mono | 12px (0.75rem) | 400 (Regular) | 18px | Code blocks, process IDs (`P1`), JSON frames |
| `mono-xs` | JetBrains Mono | 10px (0.625rem) | 500 (Medium) | 14px | Micro badges, packet byte offsets |

### 2.3 Spacing, Borders & Elevation

- **Base Unit**: 4px grid (`p-1` = 4px, `p-2` = 8px, `p-3` = 12px, `p-4` = 16px, `p-6` = 24px, `p-8` = 32px).
- **Border Radii**:
  - `rounded-sm`: 4px (Status pills, Gantt slice rectangles, code badges).
  - `rounded-md`: 6px (Buttons, text inputs, message composer, dropdowns).
  - `rounded-lg`: 8px (Cards, modal dialogues, sidebar panels).
  - `rounded-full`: 9999px (User avatars, presence dots, server icons).
- **Shadows & Glows**:
  - Subtle dark separation: `shadow-md shadow-black/40`.
  - Active focus glow: `shadow-[0_0_12px_rgba(14,165,233,0.25)]` (Sky 500).
  - Alert glow: `shadow-[0_0_12px_rgba(244,63,94,0.30)]` (Rose 500).

---

## 3. Desktop Three-Column Layout

```
+---------------------------------------------------------------------------------------------------------------+
| TOP APPLICATION HEADER (48px): Workspace Switcher | Simulation Tick: 0042 | REST: 12ms | WS: OK | TCP: 9000  |
+----+----------------------+---------------------------------------------------------------+-------------------+
|    |                      | MAIN CONVERSATION / DEDICATED VIEW PANEL                      | CONTEXT DRAWER    |
| S  | CHANNEL SIDEBAR      |                                                               |                   |
| E  | (240px)              | Channel Header: #os-scheduling-lab | Topic | [Search] [Views] | (260px Collapsible)
| R  |                      +---------------------------------------------------------------+                   |
| V  | Workspaces:          | MESSAGE FEED & INLINE TASK CARDS:                             | Active Members:   |
| E  |  > Core Eng (Active) |                                                               | - Alice (Lead) ●  |
| R  |                      | [10:41] Alice: Admitting workload for Round Robin test...     | - Bob (Systems) ● |
|    | Text Channels:       |                                                               | - Charlie (Dev) ○ |
| R  |  # announcements     | +-----------------------------------------------------------+ |                   |
| A  |  # os-scheduling-lab | | [TASK-104] CPU Burst Benchmark                [RUNNING] | | Pinned Tasks:     |
| I  |  # cn-networking     | | Assignee: Bob | Priority: HIGH | Est: 6 ticks             | | - TSK-104 (P1)    |
| L  |                      | | Resources: MUTEX_A (Acquired) | Deadline: In 15m          | | - TSK-105 (P2)    |
|    | Direct Messages:     | +-----------------------------------------------------------+ |                   |
| (  |  @ Alice Cooper  ●   |                                                               | Resource Claims:  |
| 64 |  @ Bob Smith     ●   | [10:42] SYSTEM: Process P1 dispatched to CPU Core 0           | - MUTEX_A: Held   |
| px |  @ Charlie Day   ○   |                                                               | - SEM_B: 2/3 Free |
| )  |                      +---------------------------------------------------------------+                   |
|    | Systems Consoles:    | MESSAGE COMPOSER:                                             |                   |
|    |  [~] Scheduler       | Type a message... [Markdown] [@Mention] [+ Task] [Send]       |                   |
|    |  [#] Resources       |                                                               |                   |
|    |  [^] Network         |                                                               |                   |
|    |  [*] Analytics       |                                                               |                   |
+----+----------------------+---------------------------------------------------------------+-------------------+
```

### 3.1 Column 1: Server / Workspace Icon Rail (64px)
- Fixed left column with deep charcoal background (`#030712`).
- Displays circular workspace icons with subtle active selection indicator (white vertical bar on left edge).
- Direct Messages quick button at top with unread badge counter.
- Plus button `[+]` to create or join a new workspace.
- User profile avatar at bottom with status ring and quick-menu access.

### 3.2 Column 2: Channel & Conversation Sidebar (240px)
- Dedicated workspace header with role chip (`ADMIN`, `MEMBER`) and settings dropdown.
- Collapsible section for **Group Channels** (`#announcements`, `#os-scheduling-lab`, `#cn-networking`) with active unread indicators.
- Collapsible section for **Direct Messages** with avatars and live presence dots.
- Dedicated section for **Systems Consoles** (`Scheduler`, `Resources`, `Network`, `Analytics`) providing single-click access to OS/CN simulation views.
- Quick search bar at top (`Ctrl+K`) for global message and task search.

### 3.3 Column 3: Main Conversation & Systems Stage
- **Header Bar (48px)**: Channel title with `#` prefix, topic description, active participants count, search button, and toggles for Pinned Tasks and Members Drawer.
- **Message Feed**: Virtualized scrolling stream featuring:
  - User messages with markdown rendering, code block copy button, and emoji reaction tray.
  - Inline Task Cards with real-time status badges, assignee chips, and resource requirement tags.
  - Automated System Event messages rendered in muted JetBrains Mono with distinctive color-coded icon bullets.
- **Composer Dock**: Multiline input supporting auto-expanding textarea, formatting shortcuts, `@mention` autocomplete popover, code snippet insert, and a dedicated `[+ Create Task]` button.

### 3.4 Context Drawer (260px Collapsible)
- Slidably collapsible right drawer toggled from the channel header.
- **Tab 1: Members**: Categorized into Online, Away, and Offline members with role badges.
- **Tab 2: Tasks**: Pinned active tasks for the current channel with real-time status and quick actions (Dispatch to Scheduler, Release Resource).

---

## 4. Mobile Responsive Layout & Drawer Navigation

```
+-------------------------------------------------------------------+
| [=] #os-scheduling-lab               (Tick: 0042)     [Search] [i] |
+-------------------------------------------------------------------+
| MESSAGE FEED:                                                     |
|                                                                   |
| [10:41] Alice: Benchmark loaded. Dispatching task now...          |
| +---------------------------------------------------------------+ |
| | [TASK-104] CPU Burst Benchmark                      [RUNNING] | |
| | Assignee: Bob | Est: 6 ticks | MUTEX_A: Held                 | |
| +---------------------------------------------------------------+ |
| [10:42] SYSTEM: Process P1 entered RUNNING state.                 |
+-------------------------------------------------------------------+
| [ + ] Message #os-scheduling-lab...                        [Send] |
+-------------------------------------------------------------------+
| [Chat]      [Scheduler]      [Resources]     [Network]   [Settings]|
+-------------------------------------------------------------------+
```

### Mobile Adaptations
1. **Collapsible Navigation Drawer**: Hamburger button `[=]` in top mobile header opens a slide-over drawer containing the Server Rail and Channel Sidebar combined.
2. **Bottom Navigation Bar**: 5 primary touch tabs (`Chat`, `Scheduler`, `Resources`, `Network`, `Settings`) allowing one-thumb switching between messaging and systems consoles.
3. **Compact Message Cards**: Avatars reduced to 28px, system messages condensed to single-line badges, and task cards optimized with stacked layout.
4. **Touch Ergonomics**: All interactive tap targets adhere to Apple HIG and Google Material guidelines ($\ge 44 \times 44\text{px}$).

---

## 5. Dedicated Views Integration

When a user selects a systems console from the sidebar, the central stage seamlessly transitions from the chat feed to the dedicated view, maintaining the workspace context and live topbar telemetry:

### 5.1 Dedicated Scheduler View
- **Interactive Gantt Visualizer**: Horizontal timeline grid displaying simulation ticks ($t_0, t_1, t_2, \dots$) with color-coded execution slices for each process row.
- **Queue Swimlanes**: Dedicated lanes for Ready Queue (ordered by arrival or priority) and Waiting Queue (with resource wait tags).
- **Algorithm Selector Bar**: Switch between `FCFS`, `SJF`, `SRTF`, `ROUND_ROBIN` (with quantum slider), and `PRIORITY` (with aging intervals).
- **Process Control Blocks (PCB) Inspector**: Full table detailing Arrival, Burst, Remaining, Turnaround, Waiting, and Response times.

### 5.2 Dedicated Resources View
- **Mutex Widgets**: Real-time lock cards showing Lock Status (`Unlocked` in emerald vs `Locked by TSK-104` in amber) and FIFO wait queues.
- **Semaphore Token Meters**: Capacity gauges visualizing available tokens vs total capacity with interactive increment/decrement controls.
- **Deadlock Laboratory Canvas**: Visual Resource Allocation Graph (RAG) with directed arrows, automatic cycle highlighting in pulsing rose, and Banker's Algorithm safety evaluation.

### 5.3 Dedicated Network View
- **Dual Telemetry Stream**: Left side monitors WebSocket events with sequence numbers, latency graphs, and ping/pong triggers; right side monitors raw TCP Port 9000 packets with 4-byte big-endian framing inspection (Hex dump + decoded JSON).
- **Packet Injection Console**: Interactive form to send framed TCP packets (`SUBMIT_PROCESS`, `ACQUIRE_RESOURCE`, `PING`) directly to the Python socket daemon.

### 5.4 Dedicated Analytics View
- **Comparative Benchmarking Engine**: Side-by-side metric comparison running all 5 scheduling algorithms on the exact same task workload.
- **Performance Charts**: Average Turnaround Time vs Waiting Time bar charts, CPU Utilization time-series graphs, and exportable CSV/JSON reports.

---

## 6. Comprehensive Component States

Every component throughout the application strictly implements 6 standardized states:

1. **Loading State**:
   - Animated shimmering skeleton cards (`animate-pulse bg-slate-800/50 rounded-md`).
   - Monospace telemetry spinner with micro-label: `"Synchronizing workspace channels & PCB pool..."`.
2. **Empty State**:
   - Centered visual graphic, clear explanatory heading, and an actionable Call-To-Action (e.g. *"No tasks created in this channel yet. [Convert Chat Message to Task]"*).
3. **Active / Executing State**:
   - Emerald pulsing connection beads, animated Gantt execution needle, and live scrolling telemetry logs.
4. **Paused State**:
   - Subtle amber status banner on header: *"Simulation clock paused at Tick 0042. [Step 1 Tick] [Resume]"*.
5. **Error State**:
   - Border tinted in rose-500, explicit error code, detailed diagnostics, and a prominent `[Retry Connection]` button.
6. **Disconnected State**:
   - Fixed top banner overlay: *"WebSocket disconnected. Reconnecting in 3s... [Reconnect Now]"* with zero data destruction.

---

## 7. Interactive Chat & Task UX Specifications

### 7.1 Message Actions & Context Menu
Hovering over any message reveals a floating quick-action bar:
- `[😀 Add Reaction]`: Opens emoji picker popover.
- `[💬 Reply in Thread]`: Opens thread drawer on right side.
- `[⚡ Create Task]`: Pre-populates the Task Creation Modal with message content, author as creator, and current channel.
- `[📌 Pin Message]`: Pins message to channel context drawer.
- `[...] More Options`: Edit (if author), Delete (if author or admin), Copy Link.

### 7.2 Inline Task Card Design
```
+---------------------------------------------------------------------------------+
| [TSK-104]  HIGH PRIORITY                         STATUS: RUNNING (Core 0)       |
| Refactor Memory Buffer Allocation                                               |
| Assignee: @bob_systems   |   Est: 6 Ticks   |   Deadline: Today at 5:00 PM      |
| Resources Claimed: [MUTEX_DB] (Held)   |   Source: msg-8492                     |
| [View in Scheduler]   [Request Mutex]   [Release Mutex]   [Mark Complete]       |
+---------------------------------------------------------------------------------+
```

### 7.3 System Event Messages
Automated notifications emitted by the simulation engine are styled distinctly from human messages:
- Left border accent matching event type (Emerald for task completion, Amber for queue dispatch, Rose for deadlock/lock block).
- JetBrains Mono typography with timestamp and entity badges:
  - `⚡ 10:42:15` `[TASK-104]` dispatched to CPU Core 0 by **Round Robin Scheduler** (Quantum: 2).
  - `🔒 10:42:17` `[TASK-104]` acquired lock on `MUTEX_DB`.
  - `⚠️ 10:42:19` `[TASK-105]` blocked on `MUTEX_DB`; transitioned to **WAITING** queue.

---

## 8. Accessibility & Ergonomics Checklist (WCAG 2.1 AA)

- [x] All body copy passes minimum 4.5:1 contrast against dark canvas backgrounds (`#f8fafc` on `#0b1120` = 14.8:1 contrast).
- [x] Color is never used as the sole indicator of status; every status dot is accompanied by an accessible text label or distinct geometric icon shape.
- [x] Full keyboard navigation:
  - `Ctrl + K` / `Cmd + K`: Global search modal.
  - `Spacebar`: Toggle Play / Pause simulation.
  - `Right Arrow`: Step forward 1 simulation tick.
  - `Esc`: Close open modal or drawer.
- [x] Screen reader aria labels (`aria-live="polite"` on message stream and simulation status indicators).
- [x] Focus rings clearly visible on all interactive elements (`focus:ring-2 focus:ring-sky-500`).
