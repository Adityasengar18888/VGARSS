# VGARSS 2.0 — QR Code & Workspace Invitation Architecture

## 1. Overview & Objectives

The VGARSS 2.0 Group Invitation System enables frictionless, multi-device onboarding into workspaces and virtual groups through:
- **Shareable Invitation URLs**: Deep-linkable URLs containing cryptographically secure invitation tokens.
- **Dynamic QR Code Matrix**: In-browser vector QR generation for instant mobile phone camera scanning and multi-device pairing.
- **Granular Access Controls**: Configurable expiration timelines (1 hour, 24 hours, 7 days, no expiry) and usage quotas (single-use, multi-use, unlimited).
- **Safe Public Previews**: Prospective members can preview workspace metadata (name, description, member count) before joining.
- **Instant Synchronization**: Automatic channel subscription and real-time WebSocket broadcast of new membership arrival.

---

## 2. Relational Database Schema

```sql
CREATE TABLE IF NOT EXISTS workspace_invitations (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    code TEXT UNIQUE NOT NULL,
    created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'MEMBER',         -- 'ADMIN', 'MEMBER', 'GUEST'
    max_uses INTEGER NOT NULL DEFAULT 0,         -- 0 = Unlimited
    uses_count INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMP,                        -- NULL = Never expires
    revoked_at TIMESTAMP,                        -- NULL = Active
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invitations_code ON workspace_invitations(code);
CREATE INDEX IF NOT EXISTS idx_invitations_ws ON workspace_invitations(workspace_id);
```

---

## 3. Protocol & API Endpoints

### 3.1 Create Invitation
- **Route**: `POST /api/v2/workspaces/{workspace_id}/invitations`
- **Authorization**: Caller must have `OWNER` or `ADMIN` role in target workspace.
- **Payload**:
  ```json
  {
    "role": "MEMBER",
    "expires_in_hours": 24,
    "max_uses": 10
  }
  ```
- **Response**: Returns invitation record including unique code (e.g. `vgi-k9m2p4x8q`), expiration timestamp, and full shareable URL.

### 3.2 List Active Workspace Invitations
- **Route**: `GET /api/v2/workspaces/{workspace_id}/invitations`
- **Authorization**: Caller must be `OWNER` or `ADMIN`.
- **Response**: List of active and expired invitations with current `uses_count`.

### 3.3 Revoke Invitation
- **Route**: `DELETE /api/v2/workspaces/{workspace_id}/invitations/{invitation_id}`
- **Authorization**: Caller must be `OWNER` or `ADMIN`.
- **Action**: Sets `revoked_at = CURRENT_TIMESTAMP`.

### 3.4 Public Invitation Preview (Pre-Join)
- **Route**: `GET /api/v2/invitations/{code}`
- **Authorization**: Unauthenticated or Authenticated.
- **Response**:
  ```json
  {
    "code": "vgi-k9m2p4x8q",
    "workspace_id": "ws-core-engineering",
    "workspace_name": "VGARSS Core Engineering",
    "workspace_description": "Main production workspace for OS simulation & network collaboration",
    "icon_url": null,
    "member_count": 3,
    "role": "MEMBER",
    "is_valid": true,
    "expires_at": "2026-10-30T12:00:00Z"
  }
  ```

### 3.5 Join Workspace via Invitation
- **Route**: `POST /api/v2/invitations/{code}/join`
- **Authorization**: Authenticated user (`get_current_user`).
- **Validation Steps**:
  1. Lookup invitation code.
  2. Reject if revoked (`revoked_at IS NOT NULL`).
  3. Reject if expired (`expires_at < CURRENT_TIMESTAMP`).
  4. Reject if usage quota reached (`max_uses > 0 AND uses_count >= max_uses`).
  5. Check if user is already a member (idempotent success or redirect).
  6. Atomically increment `uses_count`.
  7. Insert user into `workspace_members`, auto-subscribe to public channels, and sync to virtual groups.
  8. Broadcast membership event across workspace WebSockets.

---

## 4. QR Code Generation & Scanning Flow

1. **Generation (Sender)**:
   - When an Admin opens the "Invite Members" dialog, an invitation link is generated.
   - The React frontend uses `<QRCodeSVG />` from `qrcode.react` to render a clean, high-contrast, scalable QR code matrix.
   - Includes quick actions: **Copy Link**, **Download QR Image**, and **Revoke Code**.

2. **Scanning / Receipt (Recipient)**:
   - Mobile user points native camera or QR scanner at the code.
   - The browser opens `https://<vgarss-host>/?invite=<code>`.
   - If not authenticated, the app prompts for login/registration while preserving `invite=<code>` in the URL or local storage.
   - Upon authentication, a welcoming **Join Workspace** modal displays workspace metadata and the "Join Workspace" confirmation button.

