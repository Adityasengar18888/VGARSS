# VGARSS 2.0 — Free Production Deployment Guide for `adityasengar.online/vgarss`

This step-by-step guide walks you through deploying **VGARSS 2.0** for free with high availability, persistent WebSockets, automated PostgreSQL persistence, and routing on **`adityasengar.online/vgarss`** (or `vgarss.adityasengar.online`).

---

## 1. Free Architecture Overview

```mermaid
graph LR
    subgraph Clients ["Client Devices"]
        U["Browser / PWA"]
    end

    subgraph Domain ["Custom Domain: adityasengar.online"]
        DNS["adityasengar.online/vgarss\n(Cloudflare / Vercel / Nginx)"]
    end

    subgraph Frontend_Host ["Static Host (Vercel / Cloudflare Pages)"]
        SPA["Vite React PWA Bundle\nBase: /vgarss/\n(Free Edge CDN, HTTPS)"]
    end

    subgraph Backend_Host ["ASGI Host (Render Web Service)"]
        API["FastAPI Backend (Uvicorn)\nWebSockets: /ws/v2 (WSS)\nAuthoritative Scheduler"]
    end

    subgraph Database_Host ["Managed Database (Neon Serverless)"]
        DB[("PostgreSQL 16 Engine\n(SSL Required, Always-Free)")]
    end

    U -->|HTTPS / WSS| DNS
    DNS -->|Proxy /vgarss/*| SPA
    SPA -->|REST API / WSS| API
    API -->|TCP / SSL| DB
```

### Free Tier Specifications
| Service | Provider | Cost | Features |
| :--- | :--- | :--- | :--- |
| **Relational Database** | [Neon](https://neon.tech) | **Free** | 0.5 GB persistent PostgreSQL 16, auto-backups, SSL required, **never expires** (unlike Render's 30-day DB). |
| **Backend & WebSockets** | [Render](https://render.com) | **Free** | 512 MB RAM, Python 3.12, persistent WebSockets (`wss://`), automated TLS, auto-deploy from Git. |
| **Frontend CDN** | [Vercel](https://vercel.com) | **Free** | Unlimited bandwidth, global edge CDN, automated PWA Service Worker caching, SSL. |
| **Custom Domain** | `adityasengar.online` | Owned | Routed to `/vgarss` via Cloudflare, Vercel Rewrites, or DNS CNAME. |

---

## 2. Step 1: Create Free PostgreSQL Database on Neon (2 mins)

1. Navigate to **[https://console.neon.tech](https://console.neon.tech)** and sign in (GitHub or Google).
2. Click **Create Project**:
   - **Project Name**: `vgarss-production`
   - **Postgres Version**: `16`
   - **Region**: Select the region closest to you (e.g. `aws-ap-southeast-1` or `aws-us-east-2`).
3. Once created, copy the **Connection string**:
   ```
   postgresql://vgarss_user:YOUR_PASSWORD@ep-random-name.region.aws.neon.tech/neondb?sslmode=require
   ```
   *(Keep this string handy for Step 2)*.

---

## 3. Step 2: Deploy Backend to Render (3 mins)

1. Log in to **[https://dashboard.render.com](https://dashboard.render.com)**.
2. Click **New +** $\to$ **Web Service** $\to$ Connect your GitHub repository:
   - **Name**: `vgarss-backend`
   - **Language**: `Python`
   - **Region**: Match or pick near your Neon DB region (e.g., `Singapore` or `Oregon`).
   - **Branch**: `master` (or your main branch).
   - **Root Directory**: Leave blank (root).
   - **Build Command**:
     ```bash
     pip install -r requirements.txt && python scripts/migrate_db.py
     ```
   - **Start Command**:
     ```bash
     uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT
     ```
   - **Plan**: **Free**
3. Scroll down to **Environment Variables** and add:

| Key | Value | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://...your-neon-url...?sslmode=require` | Neon connection string |
| `SECRET_KEY` | *(Click "Generate" or paste a 64-char random hex string)* | Session encryption key |
| `VGARSS_ENV` | `production` | Enables production mode |
| `VGARSS_SCHEDULER_WORKER` | `true` | Runs server-side scheduler |
| `VGARSS_ENABLE_TCP` | `false` | Disables raw port 9000 on cloud web ingress |
| `VGARSS_TRUST_PROXY_HEADERS`| `true` | Forwards client IPs & TLS proto |
| `VGARSS_CORS_ORIGINS` | `https://adityasengar.online,https://www.adityasengar.online,https://vgarss.adityasengar.online` | Trusted frontend origins |

4. Click **Deploy Web Service**.
5. Once deployed, Render assigns a public HTTPS URL (e.g., `https://vgarss-backend.onrender.com`).
   - Test it in your browser: `https://vgarss-backend.onrender.com/api/v2/health` $\to$ Should return `{"status":"healthy","database":"connected",...}`.

---

## 4. Step 3: Deploy Frontend to Vercel (2 mins)

1. Log in to **[https://vercel.com](https://vercel.com)**.
2. Click **Add New...** $\to$ **Project** $\to$ Import your GitHub repo.
3. Configure project settings:
   - **Project Name**: `vgarss`
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Expand **Environment Variables** and add:

| Key | Value | Notes |
| :--- | :--- | :--- |
| `VITE_API_URL` | `https://vgarss-backend.onrender.com` | Your backend URL from Step 2 |
| `VITE_BASE_PATH` | `/vgarss/` | Tells Vite to serve assets under `/vgarss/` |

5. Click **Deploy**. Vercel will build and assign a deployment URL (e.g., `https://vgarss-ten.vercel.app/vgarss/`).

---

## 5. Step 4: Route `adityasengar.online/vgarss`

Choose whichever option matches where your domain `adityasengar.online` is managed:

### Option A: Using Cloudflare (Recommended for any registrar)
If your domain's DNS is managed in **Cloudflare** (100% free):

1. In Cloudflare Dashboard for `adityasengar.online`, go to **Workers & Pages** $\to$ **Create Application** $\to$ **Worker**.
2. Name it `vgarss-router` and click **Deploy**.
3. Click **Edit code** and paste this lightweight proxy script:
   ```javascript
   export default {
     async fetch(request) {
       const url = new URL(request.url);

       // Route 1: Backend WebSocket (/vgarss/ws/...) -> Render WSS
       if (url.pathname.startsWith('/vgarss/ws')) {
         const backendUrl = new URL(request.url);
         backendUrl.hostname = 'vgarss-backend.onrender.com';
         backendUrl.pathname = url.pathname.replace('/vgarss', '');
         return fetch(new Request(backendUrl, request));
       }

       // Route 2: Backend REST API (/vgarss/api/...) -> Render HTTPS
       if (url.pathname.startsWith('/vgarss/api')) {
         const backendUrl = new URL(request.url);
         backendUrl.hostname = 'vgarss-backend.onrender.com';
         backendUrl.pathname = url.pathname.replace('/vgarss', '');
         return fetch(new Request(backendUrl, request));
       }

       // Route 3: Frontend Web App (/vgarss/*) -> Vercel Edge
       if (url.pathname.startsWith('/vgarss')) {
         const vercelUrl = new URL(request.url);
         vercelUrl.hostname = 'vgarss.vercel.app'; // Replace with your Vercel domain
         return fetch(new Request(vercelUrl, request));
       }

       // Other paths on adityasengar.online pass through untouched
       return fetch(request);
     }
   };
   ```
4. Click **Deploy**, then go to **Settings** $\to$ **Domains & Routes** $\to$ **Add Route**:
   - **Route**: `adityasengar.online/vgarss*`
   - **Zone**: `adityasengar.online`
   - Click **Save**.

Now visiting `https://adityasengar.online/vgarss` will directly load VGARSS!

---

### Option B: If `adityasengar.online` is Already a Vercel Project
If your main website is hosted as a Vercel project on `adityasengar.online`:

In the repository of your main portfolio/website, add a rewrite to its `vercel.json`:
```json
{
  "rewrites": [
    {
      "source": "/vgarss/:match*",
      "destination": "https://vgarss.vercel.app/vgarss/:match*"
    }
  ]
}
```
Push and redeploy your main site. Vercel will proxy all `/vgarss/*` requests seamlessly under `adityasengar.online/vgarss` without changing the browser URL.

---

### Option C: If `adityasengar.online` is on an Nginx/Linux Server
If you manage `adityasengar.online` via an Ubuntu VPS with Nginx:

Add this block inside your `/etc/nginx/sites-available/adityasengar.online` configuration:
```nginx
# VGARSS Web Client
location /vgarss/ {
    proxy_pass https://vgarss.vercel.app/vgarss/;
    proxy_set_header Host vgarss.vercel.app;
    proxy_ssl_server_name on;
}

# VGARSS Backend API (Optional direct reverse proxy)
location /vgarss/api/ {
    proxy_pass https://vgarss-backend.onrender.com/api/;
    proxy_set_header Host vgarss-backend.onrender.com;
    proxy_ssl_server_name on;
}

# VGARSS WebSockets
location /vgarss/ws/ {
    proxy_pass https://vgarss-backend.onrender.com/ws/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host vgarss-backend.onrender.com;
    proxy_ssl_server_name on;
}
```
Run `sudo nginx -t && sudo systemctl reload nginx`.

---

### Option D: Zero-Config Companion Subdomain (`vgarss.adityasengar.online`)
If you also want `https://vgarss.adityasengar.online` with 1-click zero-proxy setup:
1. In your domain registrar or DNS management (GoDaddy, Namecheap, Cloudflare, Hostinger):
   - Add a `CNAME` record:
     - **Type**: `CNAME`
     - **Name**: `vgarss`
     - **Content / Value**: `cname.vercel-dns.com`
     - **Proxy status**: `DNS only` (or proxied if on Cloudflare).
2. In your Vercel project settings:
   - Go to **Settings** $\to$ **Domains** $\to$ Enter `vgarss.adityasengar.online` $\to$ **Add**.
3. Vercel automatically generates an SSL certificate in ~60 seconds.

---

## 6. Verification Checklist

- [ ] **Health Endpoint**: `curl https://<backend-url>/api/v2/health` returns status `healthy` and `database: "connected"`.
- [ ] **Database Persistence**: User registration or default workspace data persists across server restarts.
- [ ] **Real-Time WebSockets**: Open two browser windows at `https://adityasengar.online/vgarss`. Verify that typing, messages, and task updates sync instantly between both windows.
- [ ] **Neural Transmission Animation**: Outgoing messages traverse synaptic nodes and display real-time server and recipient delivery checkmarks (`delivered` and `read`).
- [ ] **PWA Installability**: Check the address bar or app menu for the "Install VGARSS" button to install as a standalone desktop or mobile application.

