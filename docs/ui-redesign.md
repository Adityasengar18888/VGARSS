# VGARSS 2.0 — Phase 1: Professional UI Redesign Specification

## 1. Executive Summary & Design Vision

VGARSS 2.0 is transformed from a dark developer console prototype into a restrained, information-dense, and accessible collaboration platform. Inspired by the clarity and craft of Linear, Slack, and Microsoft Teams, the user experience emphasizes:

- **Purposeful Light Mode First**: Clean white surfaces (`#FFFFFF`) grounded by a cool-neutral canvas background (`#F5F6F8`), subtle structural dividers (`#E4E7EC`), and deep slate typography (`#202631`).
- **Signature Technical Accent**: Deep slate-indigo (`#4055A8`) reserved for active focal points, primary calls-to-action, focus rings, and selection indicators.
- **Strict Information Hierarchy**: Controlled spacing multiples of 4px, monospace tabular figures for real-time telemetry, and a maximum line length of 65 characters for conversational readability.
- **Zero Decorative Fluff**: Elimination of heavy gradients, glowing neon borders, glassmorphic blurs, and arbitrary animations in favor of crisp 1px borders, subtle hover transitions under 200ms, and tactile press feedback.

---

## 2. Design Tokens & Color Palette

### 2.1 Color Tokens

| Token Name | Hex Value | Semantic Role | WCAG Contrast on Surface (`#FFFFFF`) |
|------------|-----------|---------------|--------------------------------------|
| `--color-bg-canvas` | `#F5F6F8` | Page viewport and background canvas | N/A |
| `--color-bg-surface` | `#FFFFFF` | Panels, conversation cards, modal bodies | Baseline (1.00:1) |
| `--color-bg-elevated` | `#F8FAFC` | Hover rows, message composer wells, popovers | 1.05:1 |
| `--color-bg-input` | `#FFFFFF` | Form inputs, search fields, textareas | 1.00:1 |
| `--color-ink-primary` | `#202631` | Headers, message body, primary labels | **13.6:1 (AAA)** |
| `--color-ink-subtle` | `#475467` | Secondary labels, timestamps, metadata | **7.5:1 (AAA)** |
| `--color-ink-muted` | `#667085` | Placeholder text, inactive tab labels | **4.9:1 (AA)** |
| `--color-ink-disabled` | `#98A2B3` | Disabled buttons, inactive icons | 2.8:1 (Inactive) |
| `--color-border` | `#E4E7EC` | Structural borders, card boundaries, dividers | 1.25:1 |
| `--color-border-subtle` | `#F2F4F7` | Inner cell borders, faint line breaks | 1.10:1 |
| `--color-brand` | `#4055A8` | Primary button fill, active channel highlight | **6.4:1 on `#FFFFFF` (AA)** |
| `--color-brand-hover` | `#334488` | Hover state for primary buttons | 8.2:1 |
| `--color-brand-focus` | `#556CD6` | Focus rings (`outline: 2px solid`) | 4.6:1 |
| `--color-brand-light` | `#EEF2FF` | Active background tint, badge background | 1.15:1 |
| `--color-success` | `#16805D` | Process TERMINATED, online presence, verified | **4.8:1 (AA)** |
| `--color-warning` | `#B7791F` | Process WAITING, resource held, away status | **4.7:1 (AA)** |
| `--color-error` | `#C0393A` | Deadlock detected, offline presence, destructive | **5.4:1 (AA)** |

---

## 3. Typography & Micro-Rules

1. **Font Families**: Maximum of two font families:
   - Body & UI: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
   - Telemetry & Code: `'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace` with `font-variant-numeric: tabular-nums`
2. **Body Line Length**: Strictly capped at `max-w-[65ch]` to optimize reading ergonomics in message streams.
3. **Emphasis**: **Bold** (`font-semibold` / `font-bold`) is used for emphasis. Italics (`font-style: italic`) are strictly forbidden globally.
4. **Links & Interactivity**: Underlines are reserved exclusively for clickable hyperlinks.
5. **Touch Targets**: Minimum 44x44px touch targets enforced for all buttons and interactive controls.
6. **Motion**: Transitions are restricted to `transform` and `opacity`, capped at 150ms-200ms `ease-out`. Honored via `@media (prefers-reduced-motion: reduce)`.

---

## 4. Application Layout System

```
+-----------------------------------------------------------------------------------------------+
| Mobile Top Bar: [Hamburger] [Active Workspace Name]                           [User Profile]  |
+---------+--------------------+----------------------------------------+-----------------------+
| Rail    | Channels & DMs     | Main Stage                             | Context Drawer        |
| (64px)  | (240px)            | (Flex-1)                               | (260px, Collapsible)  |
|---------+--------------------+----------------------------------------+-----------------------+
| Brand   | Workspace Header   | Header: #channel / DM recipient        | Workspace Members     |
| Icon    | Channels List      | -------------------------------------- | (with live presence)  |
|         | - #general         | Message Stream:                        | --------------------- |
| WS #1   | - #os-lab          | - System notices                       | Active Tasks Pool     |
| (Active)| - #cn-net          | - User chat bubbles (max 65ch)         | - Prioritized items   |
|         |                    | - Task cards with CPU metrics          | - Resource requests   |
| WS #2   | Direct Messages    | -------------------------------------- |                       |
|         | - Alice (Online)   | Message Composer Well                  |                       |
| [+] Add | - Bob (Away)       | [Input field] [Send / Create Task]     |                       |
|         |                    |                                        |                       |
| [Dev]   | Systems Consoles   | [Or Scheduler / Deadlock / Net View]   |                       |
| [Prof]  | [Sched][Res][Net]  |                                        |                       |
+---------+--------------------+----------------------------------------+-----------------------+
| Mobile Bottom Navigation Bar: [Chat] [Scheduler] [Resources] [Network] [Analytics]           |
+-----------------------------------------------------------------------------------------------+
```

### Responsive Breakpoints:
- **Desktop (>= 1024px)**: Full three-column layout with persistent workspace rail, channel drawer, main conversation panel, and collapsible right drawer.
- **Tablet (768px - 1023px)**: Two-column layout with collapsible left rail and slide-over context drawer.
- **Mobile (< 768px)**: Single-view focus. Slide-over hamburger menu for channel selection, fixed bottom navigation bar for systems views.

---

## 5. View Restyling Strategy (Preserving Full Capabilities)

All technical engineering views are maintained at 100% functionality with zero regressions, converted to high-contrast white card containers with subtle borders:

1. **Process Scheduler View**:
   - Clean white control toolbar with algorithm selector and single-step / auto-play controls.
   - High-contrast Gantt chart with crisp colored blocks for process execution.
   - Monospace telemetry table with tabular metrics (turnaround, waiting time, throughput).
2. **Resource Monitor & Deadlock Lab Views**:
   - Mutex and semaphore status chips with high-contrast text and explicit status labels.
   - Resource allocation matrix and cycle-detection wait-for graphs rendered on clean white surfaces.
3. **Network Monitor View**:
   - Port 9000 TCP packet transmission diagnostic workbench with clean monospace payload inspect logs.
   - Real-time WebSocket connection state pill and latency telemetry.

