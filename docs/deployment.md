# VGARSS 2.0 — Production Deployment & Operations Guide

This guide details the production hosting architecture, configuration files, environment variables, database management, and verification procedures for **VGARSS 2.0 (Virtual Group Asynchronous Real-Time Resource Synchronization & Scheduling System)**.

---

## 1. Hosting Architecture Overview

```mermaid
graph TB
    subgraph Users ["Client Devices"]
        DESK["Desktop Workstation"]
        LAPTOP["Laptop Browser"]
        MOBILE["Mobile Device"]
    end

    subgraph Static_Host ["Frontend: Static Edge Host (Vercel / Cloudflare Pages / Render)"]
        EDGE["Global CDN Edge (HTTPS / TLS 1.3)"]
        SPA["Vite Single Page Application Bundle\n(HTML5 History API Rewrites)"]
    end

    subgraph ASGI_Host ["Backend: Containerized ASGI Host (Render / Railway / VM)"]
        REVERSE_PROXY["TLS Termination & Header Forwarding\n(HTTPS / WSS /ws/v2)"]
        FASTAPI["FastAPI Application (Port 8000)\nUvicorn ASGI Engine"]
        SCHEDULER["Authoritative Scheduler Worker\n(In-Process Simulation Engine)"]
    end

    subgraph Managed_DB ["Database: Managed Relational Persistence (Neon / Render Postgres)"]
        PG[("PostgreSQL 16 Engine\n(SSL Required, Point-in-Time Recovery)")]
    end

    DESK -->|HTTPS| EDGE
    LAPTOP -->|HTTPS| EDGE
    MOBILE -->|HTTPS| EDGE

    EDGE --> SPA

    SPA -->|REST API (HTTPS)| REVERSE_PROXY
    SPA -->|Bi-Directional WSS (/ws/v2)| REVERSE_PROXY

    REVERSE_PROXY --> FASTAPI
    FASTAPI <--> SCHEDULER
    FASTAPI -->|pgpool / psycopg (SSL)| PG
```

### Architectural Principles
1. **Frontend Isolation**: The React frontend is compiled to a static bundle (`dist/`) and served globally via edge CDNs with automatic HTTPS and SPA routing rewrites.
2. **Persistent WebSockets & ASGI**: The backend runs as a continuous ASGI service handling REST APIs and persistent WebSocket connections (`/ws/v2`) over secure WebSockets (`wss://`).
3. **Managed PostgreSQL**: Relational data, user sessions, chat messages, tasks, and scheduling states persist in a managed PostgreSQL 16 database with automated schema migrations on startup.
4. **Authoritative Simulation**: CPU scheduling ticks and resource locks are managed centrally by the server-side engine rather than uncoordinated client clocks.
5. **Coursework Isolation**: The raw TCP socket server (Port 9000) is isolated from public web ingress and runs independently for Computer Networks coursework demonstrations.

---

## 2. Managed Provider Analysis & Free-Tier Suitability

| Hosting Layer | Recommended Provider | Free Tier Specification | Suitability & Quota Considerations |
| :--- | :--- | :--- | :--- |
| **Frontend Static Host** | **Vercel** / **Cloudflare Pages** / **Render Static Site** | Unlimited bandwidth, automatic SSL (HTTPS), global edge CDN, zero cold starts. | **Optimal**. Single-page application rewrites handled automatically via [`frontend/vercel.json`](file:///c:/Users/Welcome/OneDrive/Desktop/os%20cn%20project/frontend/vercel.json) or [`frontend/public/_redirects`](file:///c:/Users/Welcome/OneDrive/Desktop/os%20cn%20project/frontend/public/_redirects). |
| **ASGI Web Service** | **Render Web Service** / **Railway** | 512 MB RAM, 0.1 vCPU, persistent WebSockets, free TLS certificates (`https://` & `wss://`). | **Supported**. Free tier instances spin down after 15 minutes of HTTP inactivity. VGARSS client-side auto-reconnection with exponential backoff and ping/pong heartbeats gracefully handles wakeups. |
| **Relational Database** | **Neon Serverless PostgreSQL** (or **Render Postgres**) | Neon: 0.5 GB persistent storage, always-free, automated point-in-time backups, SSL required.<br>Render: 1 GB storage, free for 30 days. | **Recommended: Neon**. Unlike Render's free tier (which deletes databases after 30 days), Neon offers persistent free PostgreSQL that does not expire. |

---

## 3. Deployment Methods

### Option A: Recommended Hybrid Architecture (Vercel + Render + Neon)
This configuration offers high reliability, zero cost, permanent data persistence, and low latency for student evaluations.

#### Step 1: Provision Managed PostgreSQL on Neon
1. Log in to [Neon Console](https://console.neon.tech).
2. Create a new project (e.g., `vgarss-production`) targeting PostgreSQL 16.
3. Copy the provided connection string:
   ```
   postgresql://vgarss_user:SecurePassword@ep-cool-sample.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

#### Step 2: Deploy Backend to Render
1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** $\to$ **Web Service** and connect your VGARSS repository.
3. Configure the service settings:
   - **Name**: `vgarss-api`
   - **Environment**: `Python`
   - **Region**: `Oregon (US West)` (or closest region)
   - **Branch**: `master` (or main branch)
   - **Build Command**: `pip install -r requirements.txt && python scripts/migrate_db.py`
   - **Start Command**: `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`
   - **Health Check Path**: `/api/v2/health`
4. Add the following **Environment Variables** in the Render dashboard:
   ```env
   VGARSS_ENV=production
   VGARSS_LOG_LEVEL=INFO
   SECRET_KEY=<generate_secure_random_hex_key>
   DATABASE_URL=postgresql://vgarss_user:SecurePassword@ep-cool-sample.us-east-2.aws.neon.tech/neondb?sslmode=require
   VGARSS_CORS_ORIGINS=https://<your-frontend-app>.vercel.app
   VGARSS_SCHEDULER_WORKER=true
   VGARSS_ENABLE_TCP=false
   VGARSS_TRUST_PROXY_HEADERS=true
   ```
5. Deploy the service and record the assigned public URL (e.g. `https://vgarss-api.onrender.com`).

#### Step 3: Deploy Frontend to Vercel
1. Log in to [Vercel](https://vercel.com).
2. Import the Git repository.
3. Configure the project settings:
   - **Root Directory**: `frontend`
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add the following **Environment Variables**:
   ```env
   VITE_API_URL=https://vgarss-api.onrender.com
   VITE_WS_URL=wss://vgarss-api.onrender.com
   ```
5. Click **Deploy**. Vercel will build the bundle and assign a public HTTPS domain (e.g. `https://vgarss-web.vercel.app`).
6. Return to Render and update `VGARSS_CORS_ORIGINS` to include the exact Vercel production domain.

---

### Option B: All-in-One Infrastructure as Code via Render Blueprint
VGARSS provides a complete [`render.yaml`](file:///c:/Users/Welcome/OneDrive/Desktop/os%20cn%20project/render.yaml) specification:

1. Push your repository to GitHub.
2. In the Render Dashboard, click **Blueprints** $\to$ **New Blueprint Instance**.
3. Select your repository. Render automatically reads `render.yaml` and provisions:
   - `vgarss-db`: Managed PostgreSQL database.
   - `vgarss-api`: Python Web Service with health check `/api/v2/health`.
   - `vgarss-web`: Static site with SPA routing rewrites.
4. Click **Apply**.

---

### Option C: Self-Hosted Production via Docker Compose
For VPS hosts (DigitalOcean Droplet, AWS EC2, Hetzner):

1. Clone repository to VPS:
   ```bash
   git clone <repo-url> /opt/vgarss
   cd /opt/vgarss
   ```
2. Create `.env.prod`:
   ```env
   POSTGRES_DB=vgarss_db
   POSTGRES_USER=vgarss_admin
   POSTGRES_PASSWORD=<generate_secure_db_password>
   SECRET_KEY=<generate_secure_random_key>
   VGARSS_CORS_ORIGINS=https://vgarss.yourdomain.com
   VITE_API_URL=https://vgarss.yourdomain.com
   ```
3. Run with Docker Compose:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

---

## 4. Production Environment Variables Reference

| Variable | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `VGARSS_ENV` | Yes | `production` | Set to `production` to enforce proxy headers and secure defaults. |
| `PORT` | Auto | `8000` | Assigned dynamically by PaaS providers (Render, Railway, Fly). |
| `SECRET_KEY` | Yes | None | 256-bit cryptographically secure secret for session signatures. |
| `DATABASE_URL` | Yes | `sqlite:///./vgarss.db` | PostgreSQL connection string (`postgresql://user:pass@host:5432/db?sslmode=require`). |
| `VGARSS_CORS_ORIGINS` | Yes | Localhost | Comma-separated list of trusted frontend origins. Never use `*` with credentials. |
| `VGARSS_TRUST_PROXY_HEADERS` | Yes | `true` | Allows parsing `X-Forwarded-Proto` and `X-Forwarded-For`. |
| `VGARSS_SCHEDULER_WORKER` | No | `true` | Enables in-process authoritative CPU scheduler worker. |
| `VGARSS_SCHEDULER_INTERVAL` | No | `1.0` | Clock frequency (in seconds) for authoritative CPU scheduling steps. |
| `VGARSS_SCHEDULER_LOCK_TTL` | No | `5.0` | Lease timeout in seconds for distributed simulation locking. |
| `VGARSS_ENABLE_TCP` | No | `false` | Disable raw TCP port 9000 on public web instances (run standalone via CLI). |
| `VITE_API_URL` | Frontend | Dynamic | Base HTTP URL of the backend API (e.g. `https://api.vgarss.com`). |
| `VITE_WS_URL` | Frontend | Dynamic | Base WebSocket URL (e.g. `wss://api.vgarss.com`). |

---

## 5. Database Management, Migrations & Disaster Recovery

### Automatic Migrations
Database migrations execute automatically upon container / service startup via:
```bash
python scripts/migrate_db.py
```
This ensures tables, foreign keys, monotonic sequence counters, and distributed scheduler locks are in place before HTTP traffic begins.

### Automated Backup Script
Run [`scripts/backup_db.py`](file:///c:/Users/Welcome/OneDrive/Desktop/os%20cn%20project/scripts/backup_db.py):
```bash
python scripts/backup_db.py
```
- Exports a full logical dump (`pg_dump` for PostgreSQL, hot backup API for SQLite WAL).
- Compresses with Gzip level 9 (`.sql.gz` or `.db.gz`).
- Computes and stores SHA-256 integrity checksums in `backups/`.

### Disaster Recovery & Restore
Run [`scripts/restore_db.py`](file:///c:/Users/Welcome/OneDrive/Desktop/os%20cn%20project/scripts/restore_db.py):
```bash
python scripts/restore_db.py backups/vgarss_postgres_20261028_120000.sql.gz
```
- Verifies SHA-256 checksum integrity before touching database state.
- Executes safe restoration into target database.

---

## 6. Post-Deployment Verification Audit

Run [`scripts/verify_deployment.py`](file:///c:/Users/Welcome/OneDrive/Desktop/os%20cn%20project/scripts/verify_deployment.py) against the real deployed URLs:

```bash
python scripts/verify_deployment.py --api-url https://vgarss-api.onrender.com --frontend-url https://vgarss-web.vercel.app
```

The script verifies all 7 acceptance checks:
1. **Public Frontend Ingress**: Verifies HTTP 200 and valid HTML markup.
2. **Backend Telemetry Health**: Queries `/api/v2/health` and verifies DB connection and worker status.
3. **Authentication & Identity**: Tests registration, bcrypt password hashing, and token issuance.
4. **Message Persistence**: Confirms written messages remain readable across reloads.
5. **Live Two-Device WebSocket Messaging**: Tests concurrent real-time delivery over secure `wss://`.
6. **Task & Resource Propagation**: Validates chat-to-task creation and synchronization.
7. **Database Resilience**: Confirms records survive connection drops and restarts.

---

## 7. Rollback Plan & Known Limitations

### Rollback Strategy
1. **Frontend**: In the Vercel or Render dashboard, click on the **Deployments** tab and select **Rollback to this Deployment** on the previous working build. Instant zero-downtime rollback takes under 10 seconds.
2. **Backend**: If a regression occurs, redeploy the previous Git commit hash or container tag.
3. **Database**: If a database migration corrupts data, restore the pre-deployment snapshot using `python scripts/restore_db.py backups/<snapshot>.sql.gz`.

### Known Limitations
1. **Render Free Tier Spin-Down**: Free Web Services idle after 15 minutes of inactivity. Initial connection after inactivity requires a 30-50 second cold start.
2. **Single-Node In-Memory Pub/Sub**: WebSocket clients are tracked in memory by `ChatHub`. Scaling beyond one backend instance requires a Redis Pub/Sub backplane.
3. **Raw TCP Socket Demonstration (Port 9000)**: Port 9000 is intended for coursework demonstrations on localhost or Layer 4 VPS. Cloud PaaS ingress routers (Layer 7) only proxy HTTP/HTTPS/WSS traffic.

