# VGARSS 2.0 — Multi-User Authentication & Session Architecture

## 1. Authentication Strategy Overview

VGARSS 2.0 implements an authoritative server-side session authentication system designed for zero-trust multi-user collaboration. The architecture guarantees:
- **No Plaintext Credential Exposure**: Passwords are hashed using bcrypt with salt stretching before persistence.
- **Dual Transport Credential Propagation**: Authentication tokens are issued as cryptographically random 32-byte session tokens delivered via both `Authorization: Bearer <token>` headers and secure `HttpOnly` cookies.
- **Bi-Directional WebSocket Authentication**: Real-time WebSocket connections authenticate during handshake query parameter validation or immediate initial `CLIENT_AUTH` control frames.
- **Strict Role-Based Access Control (RBAC)**: Enforced across all workspace channels, direct messages, tasks, and OS simulation dispatchers.

---

## 2. Cryptographic Standards & User Identity Model

### 2.1 Password Security
- **Algorithm**: `bcrypt` (12 rounds of salt expansion) with unique per-credential salt tracking.
- **Verification**: Constant-time byte-level comparison to prevent timing attacks.
- **Legacy Verification**: Backward-compatibility with PBKDF2-SHA256 (`100,000` iterations) hashes if upgrading from prior installations.

### 2.2 Relational User Schema

```sql
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    avatar_url TEXT,
    bio TEXT DEFAULT '',
    status_message TEXT DEFAULT '',
    presence_state TEXT NOT NULL DEFAULT 'OFFLINE', -- 'ONLINE', 'AWAY', 'DND', 'OFFLINE'
    last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2.3 Session Schema & Invalidation

```sql
CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_info TEXT DEFAULT 'Desktop Web',
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 3. Session Lifecycle & Endpoints

### 3.1 Registration (`POST /api/v2/auth/register`)
- Validates username alphanumeric formatting (3–32 chars) and RFC-5322 email syntax.
- Checks uniqueness in `users` table.
- Inserts new user record, hashes password with `bcrypt(rounds=12)`.
- Generates 32-byte session token with a 24-hour expiration window.
- Sets HTTP cookie `vgarss_session` with flags `HttpOnly; SameSite=Lax; Path=/`.

### 3.2 Login (`POST /api/v2/auth/login`)
- Verifies username/email against stored `password_hash`.
- On match: generates new session token, sets user presence to `ONLINE`, sets `vgarss_session` cookie, and returns `{ token, expires_at, user }`.
- On failure: returns HTTP 401 with standard `WWW-Authenticate: Bearer` challenge.

### 3.3 Session Verification (`GET /api/v2/auth/me`)
- Dependency `get_current_user` inspects:
  1. `Authorization: Bearer <token>` header
  2. Request Cookie: `vgarss_session`
  3. Query parameter `?token=<token>` (for WebSocket fallback)
- Queries `sessions JOIN users` and enforces `expires_at > UTC_NOW()`.
- Automatically prunes expired session rows upon discovery.

### 3.4 Logout (`POST /api/v2/auth/logout`)
- Invalidates active session row in `sessions` table.
- Clears `vgarss_session` cookie (`Max-Age=0`).
- Updates `users.presence_state = 'OFFLINE'` and broadcasts presence change to all active workspace WebSockets.

---

## 4. Development Identity Fast-Switching

For seamless local multi-user testing without repeated manual credential entry, the backend provides `POST /api/v2/auth/dev-switch`:
- Allows instant switching between pre-seeded identities: `alice` (Owner), `bob` (Admin), `charlie` (Member).
- Automatically provisions isolated session tokens and sets cookies.
- Restricted to non-production environments (`settings.environment != 'production'`).

