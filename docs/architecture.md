# VGARSS 2.0 — System Architecture & Technical Specification

**System Name**: Virtual Group Asynchronous Real-Time Resource Synchronization & Scheduling System (VGARSS)  
**Release**: 2.0 (Chat-First Multi-User Collaboration & Systems Engineering Platform)  
**Document Version**: 2.0.0-PROD-SPEC  
**Target Stack**: React 18+, TypeScript, Vite, Tailwind CSS, Python 3.12+, FastAPI, PostgreSQL / SQLite WAL, Authenticated WebSockets, Async TCP (Port 9000)  
**Authors**: Principal Product Designer & Lead Systems Architect  

---

## 1. Executive Summary & VGARSS 2.0 Vision

VGARSS 2.0 transforms VGARSS from an isolated operating system and computer network simulation console into a **chat-first, multi-user systems collaboration suite**. It seamlessly bridges human team coordination with low-level systems engineering principles:
1. **Real-Time Human Collaboration**: Workspaces, persistent group channels, direct messaging, live presence, typing indicators, read receipts, and full-text message search.
2. **Actionable Task Coordination**: Interactive creation of execution tasks directly from chat messages, member assignments, priority levels, deadlines, and dependency tracking.
3. **Deterministic OS Process Scheduling & Concurrency**: Direct mapping between collaborative tasks and Process Control Blocks (PCBs) executed on simulated CPUs using FCFS, SJF, SRTF, Round Robin, and Priority Scheduling with aging.
4. **Shared Resource Synchronization**: Explicit Mutex locks, Counting Semaphores, Critical Section monitors, Banker's Algorithm safety checks, and Resource Allocation Graph (RAG) cycle detection.
5. **Computer Networks Protocol Demonstration**: Raw TCP socket server on port 9000 showcasing 4-byte big-endian framing, connection lifecycles, and byte serialization alongside authenticated WebSocket multiplexing and RESTful APIs.

---

## 2. User Journeys & Page Hierarchy

### 2.1 Core User Journeys

#### Journey 1: Collaborative Incident & Task Dispatch
```mermaid
sequenceDiagram
    autonumber
    actor Alice as Alice (Dev Lead)
    actor Bob as Bob (Systems Eng)
    participant Chat as Channel (#os-lab)
    participant TaskSvc as Task & OS Bridge
    participant Sched as CPU Scheduler
    participant ResSvc as Concurrency Manager

    Alice->>Chat: "High memory pressure on node-01. Need cache flush task."
    Alice->>Chat: [Create Task from Message] -> Priority: High, Deadline: 10m, Req: MUTEX_DB
    Chat->>TaskSvc: Create Task [TSK-201] (State: NEW)
    TaskSvc-->>Chat: Broadcast System Message: "Task TSK-201 created by Alice, assigned to Bob"
    TaskSvc->>Sched: Admit to Ready Queue (PCB TSK-201: Burst=5, Priority=1)
    Sched-->>Chat: System Notification: "TSK-201 admitted to READY queue"
    Sched->>ResSvc: Request MUTEX_DB for TSK-201
    alt Mutex Available
        ResSvc-->>Sched: Mutex Granted
        Sched->>Sched: Dispatch to CPU (State: RUNNING)
        Sched-->>Chat: System Message: "TSK-201 RUNNING on Core 0 [MUTEX_DB Acquired]"
    else Mutex Held by Another Process
        ResSvc-->>Sched: Blocked -> Enter WAITING queue
        Sched-->>Chat: System Warning: "TSK-201 BLOCKED waiting on MUTEX_DB"
    end
    Bob->>Chat: "@Alice I'm profiling the memory leak now."
```

#### Journey 2: Cross-View Simulation & Telemetry Analysis
1. **Workspace Arrival**: User logs in, authenticates via JWT/session, loads workspace `#announcements` or `#os-scheduling-lab`.
2. **Context Switching**: User switches from the chat panel to the dedicated **Scheduler View** to inspect the live interactive Gantt chart and Ready Queue.
3. **Resource Inspection**: User navigates to **Resources View** to test Mutex locks, observe Semaphore token depletion, and trigger Deadlock cycle detection in the interactive RAG canvas.
4. **Network Verification**: User navigates to **Network View** to inspect raw TCP 4-byte big-endian framing on port 9000, trigger diagnostic ping/pong frames, and monitor WebSocket telemetry sequence numbers.
5. **Analytics & Benchmarking**: User opens **Analytics View** to run comparative benchmarks across FCFS, SJF, SRTF, RR, and Priority algorithms on identical task workloads.

### 2.2 Page Hierarchy & Application Routing

```
/ (Root Layout: Server Rail + Workspace Context)
├── /login                           # Authentication & Session Bootstrap
├── /register                        # User Registration
├── /workspaces/:workspaceId         # Active Workspace Container
│   ├── /channels/:channelId         # Group Channel (Chat + Inline Tasks)
│   ├── /dms/:conversationId         # Direct Message Conversation (1:1 / Multi)
│   ├── /scheduler                   # Dedicated OS CPU Scheduler & Gantt View
│   ├── /resources                   # Shared Resource Matrix & Deadlock Lab
│   ├── /network                     # Raw TCP Port 9000 & WebSocket Monitor
│   ├── /analytics                   # Algorithm Benchmarking & Metric Curves
│   ├── /search                      # Workspace Message & Task Search
│   ├── /notifications               # Mentions, Assignments & System Alerts
│   └── /settings                    # Workspace & Member Administration
└── /profile                         # User Profile, Preferences & Credentials
```

---

## 3. Component & Service Architecture

### 3.1 High-Level Architecture Diagram

```mermaid
graph TB
    subgraph Client_Presentation ["Frontend Client (React 18 + TypeScript + Vite)"]
        UI_SHELL["Three-Column Layout Engine\nServer Rail | Channel Sidebar | Main Stage"]
        CHAT_MOD["Chat & Messaging Module\nVirtual List, Composer, Markdown, Reactions"]
        TASK_MOD["Task Coordination Engine\nTask Creator, Inline Cards, Assignment"]
        OS_VIEWS["OS & CN Dedicated Consoles\nScheduler, Resources, Network, Analytics"]
        WS_CLIENT["Multiplexed WebSocket Client\nHeartbeat, Auto-Reconnect, Seq Number Buffer"]
        STATE_STORE["Global Workspace & Telemetry Store\nZustand / Reactive Context"]
    end

    subgraph API_Gateway ["FastAPI API Gateway (Port 8000)"]
        AUTH_ROUTER["Auth & RBAC Middleware\nJWT Bearer + Dev Session Tokens"]
        WS_ROUTER["Authenticated WebSocket Hub (/ws/v2)\nChannels, DMs, Presences, Telemetry"]
        REST_ROUTER["REST Controllers (/api/v2/*)\nWorkspaces, Channels, Messages, Tasks"]
    end

    subgraph Core_Services ["Modular Backend Services"]
        CHAT_SVC["Chat & Direct Messaging Service\nPersistence, Mentions, Search Indexing"]
        TASK_SVC["Task Coordination Service\nLifecycle, Due Dates, Assignees"]
        SIM_SVC["OS Simulation Kernel\nPCB Pool, 5-State Machine, Schedulers"]
        RES_SVC["Resource & Concurrency Coordinator\nMutex, Semaphore, Banker's, RAG Cycle"]
        TCP_SRV["Raw TCP Socket Daemon (Port 9000)\n4-Byte Length-Prefixed Framing Engine"]
    end

    subgraph Persistence_Tier ["Persistence & Storage Layer"]
        PG_DB[("PostgreSQL 16 / SQLite WAL Storage\nUsers, Workspaces, Messages, Tasks, PCBs")]
        CACHE[("In-Memory Presence & Pub/Sub\nConnection Manager / Redis-Ready")]
    end

    UI_SHELL --> STATE_STORE
    STATE_STORE <--> REST_ROUTER
    WS_CLIENT <-->|WebSocket wss://| WS_ROUTER

    WS_ROUTER --> CACHE
    WS_ROUTER --> CHAT_SVC
    WS_ROUTER --> SIM_SVC

    REST_ROUTER --> AUTH_ROUTER
    AUTH_ROUTER --> CHAT_SVC
    AUTH_ROUTER --> TASK_SVC
    AUTH_ROUTER --> SIM_SVC
    AUTH_ROUTER --> RES_SVC

    TASK_SVC --> SIM_SVC
    SIM_SVC --> RES_SVC

    CHAT_SVC --> PG_DB
    TASK_SVC --> PG_DB
    SIM_SVC --> PG_DB
    RES_SVC --> PG_DB

    TCP_SRV <--> SIM_SVC
```

### 3.2 Frontend Architecture & Component Decomposition

```
frontend/src/
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx               # Responsive Three-Column Desktop & Collapsible Mobile Grid
│   │   ├── ServerSidebar.tsx          # Workspace icon rail, unread pips, add workspace modal
│   │   ├── ChannelSidebar.tsx         # Channels tree, direct messages, dedicated system view links
│   │   ├── MainConversationPanel.tsx  # Central chat/view stage with header and composer
│   │   └── RightDrawer.tsx            # Context drawer for channel members, tasks, and allocations
│   ├── chat/
│   │   ├── MessageList.tsx            # Virtualized message stream with infinite scroll
│   │   ├── MessageItem.tsx            # User avatar, timestamp, markdown text, reaction pill
│   │   ├── SystemMessageItem.tsx      # System events (task created, mutex acquired, deadlock alert)
│   │   ├── MessageComposer.tsx        # Multiline input, markdown tools, mention suggest, task trigger
│   │   ├── TypingIndicator.tsx        # Active typers indicator ("Alice is typing...")
│   │   └── SearchModal.tsx            # Ctrl+K full-text message and task search dialog
│   ├── tasks/
│   │   ├── TaskCardInline.tsx         # Embedded interactive task card inside chat feed
│   │   ├── TaskCreationModal.tsx      # Modal to convert message or form input to OS Task
│   │   ├── TaskAssigneePicker.tsx     # Member selector dropdown with avatar chips
│   │   └── TaskPriorityBadge.tsx      # Low (Slate), Med (Sky), High (Amber), Critical (Rose)
│   ├── views/ (Preserved & Enhanced Dedicated Views)
│   │   ├── ProcessSchedulerView.tsx   # Interactive Gantt, Ready/Waiting swimlanes, PCB inspector
│   │   ├── ResourceMonitorView.tsx    # Mutex locks, semaphore capacity bars, live allocation matrix
│   │   ├── DeadlockLabView.tsx        # Resource Allocation Graph (RAG) with cycle detection
│   │   ├── NetworkMonitorView.tsx     # Port 9000 raw TCP hex/JSON inspector and WebSocket telemetry
│   │   ├── PerformanceAnalyticsView.tsx # Comparative benchmarking curves and turnaround/waiting tables
│   │   ├── ProfileView.tsx            # User profile, custom avatar, status message, active sessions
│   │   └── WorkspaceSettingsView.tsx  # Workspace member roles, channel creation, invite link
│   └── common/
│       ├── Card.tsx, Header.tsx, States.tsx, Modal.tsx, Dropdown.tsx
├── hooks/
│   ├── useWorkspace.ts                # Active workspace, channel, and DM selection
│   ├── useChat.ts                     # Messages fetch, send, optimistic ACK, typing events
│   ├── useTasks.ts                    # Task CRUD, status updates, resource claim hooks
│   ├── useWebSocket.ts                # Resilient multiplexed WebSocket with exponential backoff
│   ├── useSimulation.ts               # Core OS simulation lifecycle (tick, play, pause, reset)
│   └── usePresence.ts                 # Real-time online/away/offline member status tracking
├── services/
│   ├── api.ts                         # REST API Client with Bearer token injection
│   └── websocket.ts                   # WebSocket frame router and event dispatcher
└── types/
    ├── auth.ts, workspace.ts, chat.ts, task.ts, process.ts, resources.ts, network.ts
```

---

## 4. Database Schema Specification (PostgreSQL / SQLite WAL)

The schema is defined in standard ANSI SQL compatible with both **PostgreSQL 16+** and **SQLite 3.40+ (in WAL mode)**.

```sql
-- ============================================================================
-- 1. USERS, AUTHENTICATION & PRESENCE
-- ============================================================================

CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    status_message VARCHAR(120),
    presence_state VARCHAR(20) NOT NULL DEFAULT 'OFFLINE', -- 'ONLINE', 'AWAY', 'DND', 'OFFLINE'
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_sessions (
    token VARCHAR(128) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_info VARCHAR(255),
    ip_address VARCHAR(45),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 2. WORKSPACES & MEMBERSHIPS (RBAC)
-- ============================================================================

CREATE TABLE workspaces (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    icon_url TEXT,
    owner_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE workspace_members (
    workspace_id VARCHAR(36) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'MEMBER', -- 'OWNER', 'ADMIN', 'MEMBER', 'GUEST'
    nickname VARCHAR(100),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (workspace_id, user_id)
);

-- ============================================================================
-- 3. CHANNELS, DIRECT CONVERSATIONS & PARTICIPANTS
-- ============================================================================

CREATE TABLE channels (
    id VARCHAR(36) PRIMARY KEY,
    workspace_id VARCHAR(36) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(80) NOT NULL,
    topic TEXT,
    channel_type VARCHAR(20) NOT NULL DEFAULT 'TEXT', -- 'TEXT', 'SIMULATION', 'ANNOUNCEMENT'
    is_private BOOLEAN NOT NULL DEFAULT FALSE,
    created_by VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_workspace_channel_name UNIQUE (workspace_id, name)
);

CREATE TABLE channel_members (
    channel_id VARCHAR(36) NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_message_id VARCHAR(36),
    unread_count INTEGER NOT NULL DEFAULT 0,
    notification_preference VARCHAR(20) NOT NULL DEFAULT 'ALL', -- 'ALL', 'MENTIONS', 'MUTED'
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE direct_conversations (
    id VARCHAR(36) PRIMARY KEY,
    workspace_id VARCHAR(36) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    is_group BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE direct_conversation_participants (
    conversation_id VARCHAR(36) NOT NULL REFERENCES direct_conversations(id) ON DELETE CASCADE,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_message_id VARCHAR(36),
    unread_count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (conversation_id, user_id)
);

-- ============================================================================
-- 4. MESSAGES, THREADS & REACTIONS
-- ============================================================================

CREATE TABLE messages (
    id VARCHAR(36) PRIMARY KEY,
    workspace_id VARCHAR(36) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    channel_id VARCHAR(36) REFERENCES channels(id) ON DELETE CASCADE,
    conversation_id VARCHAR(36) REFERENCES direct_conversations(id) ON DELETE CASCADE,
    sender_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL, -- Null if automated system event
    message_type VARCHAR(30) NOT NULL DEFAULT 'USER_TEXT', -- 'USER_TEXT', 'SYSTEM_EVENT', 'TASK_CARD', 'CODE_SNIPPET'
    content TEXT NOT NULL,
    parent_id VARCHAR(36) REFERENCES messages(id) ON DELETE CASCADE, -- For threaded replies
    reply_count INTEGER NOT NULL DEFAULT 0,
    is_edited BOOLEAN NOT NULL DEFAULT FALSE,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    payload_json JSONB, -- For rich metadata (task previews, simulation event details, attachments)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_message_target CHECK (
        (channel_id IS NOT NULL AND conversation_id IS NULL) OR
        (channel_id IS NULL AND conversation_id IS NOT NULL)
    )
);

CREATE TABLE message_reactions (
    message_id VARCHAR(36) NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(32) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (message_id, user_id, emoji)
);

-- ============================================================================
-- 5. TASKS & OS SCHEDULING BRIDGE
-- ============================================================================

CREATE TABLE tasks (
    id VARCHAR(36) PRIMARY KEY,
    workspace_id VARCHAR(36) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    channel_id VARCHAR(36) REFERENCES channels(id) ON DELETE SET NULL,
    source_message_id VARCHAR(36) REFERENCES messages(id) ON DELETE SET NULL,
    creator_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    assignee_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM', -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    numeric_priority INTEGER NOT NULL DEFAULT 2,   -- 1 = Highest (OS convention), 4 = Lowest
    deadline TIMESTAMP WITH TIME ZONE,
    estimated_burst_ticks INTEGER NOT NULL DEFAULT 5, -- Estimated CPU execution time
    status VARCHAR(20) NOT NULL DEFAULT 'NEW',       -- 'NEW', 'READY', 'RUNNING', 'WAITING', 'TERMINATED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 6. SHARED RESOURCES & CONCURRENCY ALLOCATIONS
-- ============================================================================

CREATE TABLE resources (
    id VARCHAR(36) PRIMARY KEY,
    workspace_id VARCHAR(36) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(80) NOT NULL,
    resource_type VARCHAR(20) NOT NULL DEFAULT 'MUTEX', -- 'MUTEX', 'SEMAPHORE'
    total_capacity INTEGER NOT NULL DEFAULT 1,
    available_units INTEGER NOT NULL DEFAULT 1,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_workspace_resource_name UNIQUE (workspace_id, name)
);

CREATE TABLE task_resource_allocations (
    id VARCHAR(36) PRIMARY KEY,
    task_id VARCHAR(36) NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    resource_id VARCHAR(36) NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    requested_units INTEGER NOT NULL DEFAULT 1,
    allocated_units INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'REQUESTED', -- 'REQUESTED', 'HELD', 'RELEASED', 'PREEMPTED'
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    acquired_at TIMESTAMP WITH TIME ZONE,
    released_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- 7. PERFORMANCE & SEARCH INDEXING
-- ============================================================================

CREATE INDEX idx_messages_channel_created ON messages(channel_id, created_at DESC);
CREATE INDEX idx_messages_convo_created ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_parent ON messages(parent_id);
CREATE INDEX idx_tasks_workspace_status ON tasks(workspace_id, status);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX idx_allocations_task ON task_resource_allocations(task_id);
CREATE INDEX idx_allocations_resource ON task_resource_allocations(resource_id);
```

---

## 5. REST API & WebSocket Event Contracts

### 5.1 REST API Contracts (`/api/v2/*`)

#### Authentication & User Profiles
- `POST /api/v2/auth/register`
  - Request: `{ "username": "alice", "email": "alice@vgarss.org", "password": "...", "display_name": "Alice Cooper" }`
  - Response (201): `{ "token": "vgarss-session-...", "user": { ... } }`
- `POST /api/v2/auth/login`
  - Request: `{ "username_or_email": "alice", "password": "..." }`
  - Response (200): `{ "token": "vgarss-session-...", "user": { ... } }`
- `GET /api/v2/auth/me`
  - Response (200): `{ "id": "...", "username": "alice", "display_name": "Alice Cooper", "presence": "ONLINE" }`

#### Workspaces & Members
- `GET /api/v2/workspaces`
  - Response (200): Array of Workspace summaries with unread message counters.
- `POST /api/v2/workspaces`
  - Request: `{ "name": "VGARSS Core Engineering", "slug": "vgarss-core", "description": "Kernel dev workspace" }`
  - Response (201): Created Workspace entity.
- `GET /api/v2/workspaces/{workspace_id}/members`
  - Response (200): Array of members with presence, roles, and avatar URLs.

#### Channels & Messages
- `GET /api/v2/workspaces/{workspace_id}/channels`
  - Response (200): Array of channels (`#announcements`, `#os-scheduling-lab`, `#cn-networking`).
- `POST /api/v2/workspaces/{workspace_id}/channels`
  - Request: `{ "name": "os-scheduling-lab", "topic": "CPU scheduling and Gantt telemetry", "is_private": false }`
  - Response (201): Created Channel entity.
- `GET /api/v2/channels/{channel_id}/messages?limit=50&before_id={cursor}`
  - Response (200): `{ "messages": [...], "has_more": true, "next_cursor": "..." }`
- `POST /api/v2/channels/{channel_id}/messages`
  - Request: `{ "content": "Admitting benchmark workload now.", "message_type": "USER_TEXT" }`
  - Response (201): Created Message entity broadcasted via WebSocket.

#### Tasks & OS Coordination Bridge
- `POST /api/v2/tasks`
  - Request:
    ```json
    {
      "workspace_id": "ws-101",
      "channel_id": "chan-201",
      "source_message_id": "msg-902",
      "title": "Evaluate Priority Scheduler with Aging",
      "description": "Starvation mitigation test on 5 processes",
      "assignee_id": "usr-88",
      "priority": "HIGH",
      "deadline": "2026-10-29T12:00:00Z",
      "estimated_burst_ticks": 6,
      "required_resources": ["MUTEX_DB"]
    }
    ```
  - Response (201): Created Task entity + auto-generated system message in channel.
- `PATCH /api/v2/tasks/{task_id}`
  - Request: `{ "status": "READY", "assignee_id": "usr-92" }`
  - Response (200): Updated Task entity with state transition broadcast.

### 5.2 WebSocket Event Contract (`ws://<host>:8000/ws/v2`)

All real-time telemetry, chat, presence, and task events share a unified JSON frame:

```typescript
export interface WsFrame<T = any> {
  seq?: number;             // Strictly increasing monotonic sequence number for state catch-up
  type: WsEventType;        // Semantic event identifier
  workspace_id?: string;    // Workspace scope
  channel_id?: string;      // Channel scope (if applicable)
  conversation_id?: string; // DM scope (if applicable)
  timestamp: string;        // ISO 8601 UTC timestamp
  payload: T;               // Strongly typed payload
}
```

#### Event Catalog

| Event Name | Direction | Payload Structure | Purpose |
| :--- | :--- | :--- | :--- |
| `CLIENT_AUTH` | Client $\to$ Server | `{ token: string, client_version: string }` | Handshake authentication |
| `PRESENCE_HEARTBEAT` | Client $\to$ Server | `{ state: 'ONLINE' \| 'AWAY' \| 'DND' }` | Keep-alive and presence ping |
| `PRESENCE_UPDATE` | Server $\to$ Client | `{ user_id: string, presence_state: string, last_seen_at: string }` | Member presence broadcast |
| `TYPING_START` | Client $\to$ Server | `{ channel_id?: string, conversation_id?: string }` | User started typing |
| `TYPING_EVENT` | Server $\to$ Client | `{ user_id: string, username: string, channel_id?: string }` | Typing indicator broadcast |
| `CHAT_MESSAGE_SENT` | Client $\to$ Server | `{ channel_id?: string, conversation_id?: string, content: string, client_msg_id: string }` | Outbound chat message |
| `CHAT_MESSAGE_RECV` | Server $\to$ Client | Full `Message` schema with user profile and parsed mentions | Real-time chat distribution |
| `TASK_CREATED` | Server $\to$ Client | Full `Task` schema + auto-generated system message | Broadcast task creation |
| `TASK_STATE_CHANGED` | Server $\to$ Client | `{ task_id: string, old_state: string, new_state: string, running_core?: number }` | Real-time OS process transition |
| `RESOURCE_LOCK_ACQUIRED`| Server $\to$ Client | `{ task_id: string, resource_id: string, units: number, remaining: number }` | Mutex/Semaphore acquired |
| `DEADLOCK_CYCLE_DETECT` | Server $\to$ Client | `{ detected: boolean, cycle_tasks: string[], cycle_resources: string[] }` | RAG cycle warning |
| `SIMULATION_TELEMETRY` | Server $\to$ Client | `{ tick: number, cpu_utilization: number, ready_queue: string[], gantt_slice: any }` | Dedicated scheduler feed |

---

## 6. Authorization Rules & Message Ownership

### 6.1 Role-Based Access Control (RBAC) Matrix

| Action / Capability | Workspace Owner | Workspace Admin | Workspace Member | Guest / External |
| :--- | :---: | :---: | :---: | :---: |
| Delete Workspace | **Yes** | No | No | No |
| Manage Workspace Settings & Roles | **Yes** | **Yes** | No | No |
| Create / Archive Public Channels | **Yes** | **Yes** | **Yes** | No |
| Create Private Channels | **Yes** | **Yes** | **Yes** | No |
| Send Messages in Channels | **Yes** | **Yes** | **Yes** | Conditional |
| Edit Own Messages | **Yes** (anytime) | **Yes** (anytime) | **Yes** (within 15m) | **Yes** (within 5m) |
| Delete Own Messages | **Yes** | **Yes** | **Yes** | **Yes** |
| Delete Any User's Message (Moderation) | **Yes** | **Yes** | No | No |
| Create Tasks from Messages | **Yes** | **Yes** | **Yes** | No |
| Assign / Reassign Tasks | **Yes** | **Yes** | **Yes** | No |
| Force-Preempt Resource Locks | **Yes** | **Yes** | No | No |
| Control CPU Simulation Clock | **Yes** | **Yes** | **Yes** | View Only |

### 6.2 Message Ownership & Immutability Rules
1. **Ownership Enforcement**: A user can only edit or delete their own messages. Backend validates `message.sender_id == current_user.id`.
2. **Audit & Edit History**: When a message is edited, `is_edited = TRUE` and `updated_at` are persisted. System messages generated by task/resource events cannot be edited or deleted by non-admin members.
3. **Soft-Delete / Tombstoning**: Deleted messages are marked with a tombstone (`is_deleted = TRUE`, content replaced with `"[This message was deleted]"`) to preserve thread tree integrity and references in task links.

---

## 7. Reconnection, Message Persistence & Task-State Synchronization

### 7.1 Real-Time Synchronization Protocol

To ensure seamless multi-device operation and prevent message loss during flaky connections:

1. **Monotonic Sequence Numbers (`seq`)**:
   - The backend increments an atomic sequence number per channel/conversation for every event.
   - The client tracks `last_received_seq`.
2. **Resilient Reconnection with Exponential Backoff**:
   - When a WebSocket drops, the client attempts reconnection at intervals: $500\text{ms} \to 1\text{s} \to 2\text{s} \to 4\text{s} \dots \max 30\text{s}$.
3. **Catch-up Sync Handshake**:
   - Upon reconnecting, the client issues:
     ```json
     {
       "type": "CATCHUP_REQUEST",
       "channel_id": "chan-401",
       "since_seq": 1042
     }
     ```
   - The server transmits any missed events stored in its circular buffer or queries the database.
4. **Optimistic UI with Client-Generated `client_msg_id`**:
   - Outbound chat messages appear immediately with a `status: 'pending'` indicator.
   - Upon receipt of server `CHAT_MESSAGE_RECV` carrying matching `client_msg_id`, the client updates the message status to `status: 'sent'`.
5. **Task-State Mutual Exclusion**:
   - All state transitions (`NEW` $\to$ `READY` $\to$ `RUNNING` $\to$ `WAITING` $\to$ `TERMINATED`) are verified against atomic database transactions or the single-threaded simulation orchestrator loop to prevent race conditions across concurrent browser tabs.

---

## 8. Deployment Architecture for Multi-Device Access

### 8.1 Topology & Container Architecture

```mermaid
graph TB
    subgraph Multi_Device_Clients ["Multi-Device Clients"]
        DESK["Desktop Browser (1920x1080)"]
        LAPTOP["Laptop Browser (1440x900)"]
        MOBILE["Mobile Device (390x844 Collapsible)"]
        TCP_NODE["External Python / Raw TCP Client"]
    end

    subgraph Edge_Reverse_Proxy ["Edge Reverse Proxy (Nginx / Caddy)"]
        PROXY["Nginx Reverse Proxy & SSL Termination\nPorts 80 / 443"]
    end

    subgraph Application_Containers ["Dockerized Application Services"]
        WEB_APP["Vite Production Static Build\nServed via Nginx / Node"]
        API_APP["FastAPI ASGI Cluster (Uvicorn Workers)\nPort 8000"]
        TCP_APP["Raw TCP Socket Daemon\nPort 9000"]
    end

    subgraph Data_Services ["Data & State Persistence"]
        POSTGRES[("PostgreSQL 16 Cluster\nPersistent Volumes & WAL Mode")]
        REDIS[("Redis 7 Pub/Sub & Presence Cache\nCross-Worker Telemetry Fanout")]
    end

    DESK --> PROXY
    LAPTOP --> PROXY
    MOBILE --> PROXY
    TCP_NODE -->|Direct Port 9000| TCP_APP

    PROXY -->|HTTP /| WEB_APP
    PROXY -->|HTTP /api/v2| API_APP
    PROXY -->|WSS /ws/v2| API_APP

    API_APP --> POSTGRES
    API_APP <--> REDIS
    API_APP <--> TCP_APP
```

### 8.2 Multi-Device Local & LAN Access Configuration
- **LAN Binding**: The server binds to `0.0.0.0:8000` (FastAPI) and `0.0.0.0:9000` (Raw TCP), allowing mobile devices, laptops, and developer workstations on the same local network (e.g. `192.168.1.x`) to connect simultaneously.
- **Environment Parity**:
  - Development: Dual-mode support allowing seamless zero-setup SQLite WAL mode (`sqlite:///./vgarss.db`) for immediate offline developer testing, or PostgreSQL connection string (`postgresql://vgarss:secret@localhost:5432/vgarss_db`) via environment variable `VGARSS_DATABASE_URL`.
  - Production: Docker Compose orchestrating `nginx`, `web`, `api`, `tcp_server`, `postgres`, and `redis`.

---

## 9. Reconciliation & Conflicts with Existing Implementation

The table below catalogs every divergence between the current VGARSS 1.0 implementation and the target VGARSS 2.0 architecture, detailing root causes and non-destructive resolution strategies.

| Area | Current VGARSS 1.0 Implementation | Target VGARSS 2.0 Architecture | Impact / Conflict Analysis | Resolution Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **Database Engine & Driver** | SQLite file (`vgarss.db`) accessed via Python's standard `sqlite3` driver with raw string DDL. | PostgreSQL 16+ as primary target; zero-setup SQLite WAL mode for local dev. | `sqlite3` raw driver lacks connection pooling, async I/O, native JSONB, and concurrent write scalability required for real-time chat. | Implement dual-dialect database abstraction layer using SQLAlchemy 2.0 / `asyncpg` with fallback to `aiosqlite`. Use ANSI SQL migrations. |
| **Virtual Groups vs Workspaces** | `virtual_groups` table is a single-level simulation container. No channels, no roles beyond `MEMBER`/`ADMIN`. | Workspaces with hierarchical channels (`#general`, `#os-lab`), direct messages, and granular RBAC. | 1.0 client expects flat group list. 2.0 requires workspace navigation rail + channel tree. | Map existing `virtual_groups` directly to `workspaces`. Automatically create a default `#general` and `#os-scheduling-lab` channel for every group. |
| **Simulation Processes vs Collaborative Tasks** | `simulation_processes` are synthetic CPU bursts (`P1`, `P2`) with arrival and burst times. | `tasks` table represents collaborative user tasks (`title`, `assignee_id`, `deadline`, `status`). | A process is an OS abstraction; a task is a collaborative unit. | Bi-directional bridge: creating a task optionally spawns a Process Control Block (PCB) in the active simulation run with `burst_time = estimated_burst_ticks`. |
| **WebSocket Framing & Endpoints** | Dedicated `/ws/groups/{group_id}` endpoint broadcasting only OS simulation step snapshots. | Multiplexed `/ws/v2` handling chat messages, typing events, presence heartbeats, and simulation telemetry. | 1.0 frontend hooks (`useWebSocket`) listen exclusively for `SIMULATION_STEP`. 2.0 requires multiplexed event routing. | Retain backward-compatible `/ws/groups/{group_id}` route for standalone simulation testing, while introducing `/ws/v2` for the full collaboration application. |
| **Frontend Layout & Shell** | Single-pane topbar with icon sidebar (8 view switchers) rendering one full-screen view at a time. | Three-column desktop layout (Server rail + Channel sidebar + Main conversation / Active View stage) with mobile drawers. | Existing view components (`ProcessSchedulerView`, `ResourceMonitorView`, etc.) were styled as top-level full-screen pages. | Mount the existing dedicated views (`Scheduler`, `Resources`, `Network`, `Analytics`) seamlessly inside the main stage of the 3-column shell when selected. |
| **Session & Token Authentication** | Plain static tokens stored in `sessions` table without expiry validation or JWT claims. | Authenticated sessions with JWT bearer tokens, user profile metadata, and device tracking. | `api.ensureDevSession()` currently registers a dummy user. 2.0 needs authentic multi-user identities to show chat authors. | Upgrade auth service to issue JWT tokens while maintaining a seeded multi-user dev fixture (`alice`, `bob`, `charlie`) for instant one-click login during evaluation. |

---

## 10. Multi-Device Deployment, Networking & Authoritative Execution Specification

### 10.1 Dynamic Client Networking & Zero-Localhost Ingress
In production, hardcoded localhost URLs break multi-device, containerized, and mobile access. VGARSS 2.0 implements dynamic runtime configuration in [`frontend/src/config.ts`](file:///c:/Users/Welcome/OneDrive/Desktop/os%20cn%20project/frontend/src/config.ts):
1. **Dynamic Base URL Resolution**:
   - `getApiBaseUrl()` resolves in order:
     - `localStorage.getItem('vgarss_api_url')` (runtime manual override for mobile testing).
     - `import.meta.env.VITE_API_URL` (injected at build or container start).
     - Dynamic browser origin (`window.location.origin` in production reverse proxies, or `${protocol}//${hostname}:8000` in dev).
   - `getWebSocketBaseUrl()` mirrors the API host with automatic protocol promotion (`http:` $\to$ `ws:`, `https:` $\to$ `wss:`), or reads `VITE_WS_URL`.
2. **Reverse Proxy Headers & Explicit CORS**:
   - Backend mounts `ProxyHeadersMiddleware` (`trusted_hosts="*"`) to reliably parse `X-Forwarded-Proto` and `X-Forwarded-For`.
   - Production CORS configured via `VGARSS_CORS_ORIGINS` / `CORS_ORIGINS` environment variables, supporting comma-separated or JSON list formats with explicit trusted origins.

### 10.2 Authoritative Background Scheduler & Distributed Leasing
Operating system process scheduling and resource management are governed by an authoritative server-side service rather than client-driven ticks:
1. **Centralized Engine**:
   - [`AuthoritativeSchedulerWorker`](file:///c:/Users/Welcome/OneDrive/Desktop/os%20cn%20project/backend/app/simulation/scheduler_service.py) advances workspace simulation clocks, calculates mathematical scheduling metrics, and broadcasts telemetry frames.
2. **Distributed Process Leasing (`workspace_scheduler_locks`)**:
   - To prevent multiple worker processes or ASGI workers from double-stepping the same workspace simulation, a database-level lease model is enforced:
     ```sql
     CREATE TABLE IF NOT EXISTS workspace_scheduler_locks (
         workspace_id TEXT PRIMARY KEY,
         worker_id TEXT NOT NULL,
         locked_until REAL NOT NULL,
         heartbeat_at REAL NOT NULL
     );
     ```
   - Workers acquire and renew leases using atomic test-and-set transactions with a 5-second TTL. If a worker crashes, the lease expires and an alternate worker transparently assumes control.
3. **Execution Modes**:
   - Can run in-process within FastAPI application lifespan or as a standalone background daemon via [`scripts/run_scheduler_worker.py`](file:///c:/Users/Welcome/OneDrive/Desktop/os%20cn%20project/scripts/run_scheduler_worker.py).

### 10.3 Coursework Raw TCP Socket Server Isolation
To satisfy Computer Networks coursework requirements without impacting web application security:
- A dedicated raw TCP socket server runs on port 9000 ([`backend/app/network/tcp_server.py`](file:///c:/Users/Welcome/OneDrive/Desktop/os%20cn%20project/backend/app/network/tcp_server.py) and [`scripts/run_tcp_server.py`](file:///c:/Users/Welcome/OneDrive/Desktop/os%20cn%20project/scripts/run_tcp_server.py)).
- Features: 4-byte big-endian length-prefixed packet framing, connection lifecycle management, JSON serialization/deserialization, and thread pool concurrency.
- Complete isolation: The raw TCP daemon runs on an independent transport port, completely isolated from public HTTP/WebSocket reverse proxy entry points.

---

## 11. Cross-Device Verification & Known Limitations

### 11.1 Automated Cross-Client Multi-Device Verification
Real multi-device consistency was tested and verified using [`scripts/verify_multi_device.py`](file:///c:/Users/Welcome/OneDrive/Desktop/os%20cn%20project/scripts/verify_multi_device.py), simulating two concurrent clients (Alice on Workstation, Bob on Laptop) across 10 phases:
1. **Phase 1: Independent Authentication**: Isolated tokens and sessions issued for Alice and Bob.
2. **Phase 2: Workspace & Channel Discovery**: Verified shared workspace and `#os-scheduling-lab` membership.
3. **Phase 3: Concurrent WebSocket Handshakes**: Dual authenticated connections established on `/ws/v2`.
4. **Phase 4: Bi-Directional Presence**: Alice updated status to `AWAY`; Bob received `PRESENCE_UPDATE` within 100ms.
5. **Phase 5: Typing Indicators**: Debounced `TYPING_EVENT` transmitted from Alice and rendered on Bob's client.
6. **Phase 6: Real-Time Messaging & Monotonic Sequencing**: Alice posted a channel message; Bob received `CHAT_MESSAGE_RECV` carrying sequence number `seq: 1`.
7. **Phase 7: Chat-to-Task Process Creation**: Task created directly from chat; Bob received real-time `TASK_CREATED` event and channel announcement.
8. **Phase 8: Concurrent Resource Locking**: Bob acquired shared resource `res-sem-io`; Alice received real-time `TASK_STATE_CHANGED` notification.
9. **Phase 9: Authoritative Scheduler Stepping**: Workspace simulation stepped; both clients received authoritative `SCHEDULER_STEP` event with updated CPU metrics.
10. **Phase 10: Network Drop & Offline Catch-up Resync**: Bob disconnected from WebSocket; Alice posted 3 offline messages; Bob reconnected and issued `CATCHUP_REQUEST`; server successfully replayed all 7 missed events in order (`seq: 2` through `seq: 8`) followed by `CATCHUP_COMPLETE`.

### 11.2 Known Limitations & Production Scaling Considerations
1. **Single-Node In-Memory Pub/Sub**:
   - `ChatHub` maintains client WebSocket sessions in process memory.
   - *Limitation*: Running multiple ASGI server processes (e.g. multi-container horizontal autoscale) without sticky sessions requires an external Redis Pub/Sub backplane to fan out events across ASGI workers.
2. **Database Engine Scalability**:
   - Local development uses SQLite WAL mode with WAL journal and busy timeout.
   - *Limitation*: For multi-server production clusters with concurrent writers, PostgreSQL must be configured via `DATABASE_URL` / `VGARSS_DATABASE_URL` (SQLite does not support concurrent write transactions across multiple network nodes).
3. **Layer 4 vs Layer 7 Routing for Port 9000**:
   - The raw TCP server requires direct Layer 4 TCP port forwarding or a TCP load balancer (e.g. AWS NLB or Caddy raw TCP proxy). Standard Layer 7 HTTP ingress controllers (such as Cloud Run or Heroku routers) will not proxy raw byte-framed TCP connections.
