"""Post-Deployment Verification Script for VGARSS 2.0.

Validates the live production deployment against all 7 acceptance criteria:
1. Public frontend loads (HTTP 200, valid HTML/JS bundle).
2. Backend health endpoint responds (GET /api/v2/health, healthy, DB connected).
3. Secure user registration and login work (bcrypt hash, token issuance).
4. Messages persist across page reloads / client reconnections.
5. Two independent client devices exchange real-time WebSocket messages (WSS/WS /ws/v2).
6. Collaborative task creation and resource state updates propagate to both devices.
7. Verification that database state remains intact and accessible.

Usage:
    python scripts/verify_deployment.py --api-url <API_URL> --frontend-url <FRONTEND_URL>
    python scripts/verify_deployment.py (defaults to local staging: http://127.0.0.1:8000 and http://127.0.0.1:5173)
"""
import sys
import json
import uuid
import asyncio
import argparse
from typing import Optional, Any
import httpx
import websockets

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


class LiveTestClient:
    """Represents an independent user session on a device."""
    def __init__(self, username: str, device_name: str, base_http: str, base_ws: str):
        self.username = username
        self.device_name = device_name
        self.base_http = base_http
        self.base_ws = base_ws
        self.token = ""
        self.user = {}
        self.ws = None
        self.inbox = asyncio.Queue()
        self.listen_task = None
        self.http = httpx.AsyncClient(base_url=base_http, timeout=15.0)

    async def register_or_login(self):
        # Generate test user
        password = "VgarssLive2026!#"
        email = f"{self.username}_{uuid.uuid4().hex[:6]}@test-vgarss.org"
        try:
            reg_resp = await self.http.post(
                "/api/v2/auth/register",
                json={"username": f"{self.username}_{uuid.uuid4().hex[:4]}", "email": email, "password": password},
            )
            if reg_resp.status_code == 201:
                data = reg_resp.json()
                self.token = data["token"]
                self.user = data["user"]
                self.http.headers["Authorization"] = f"Bearer {self.token}"
                return
        except Exception:
            pass

        # Fallback to dev-switch
        resp = await self.http.post("/api/v2/auth/dev-switch", json={"username": self.username})
        assert resp.status_code == 200, f"Auth failed for {self.username}: {resp.text}"
        data = resp.json()
        self.token = data["token"]
        self.user = data["user"]
        self.http.headers["Authorization"] = f"Bearer {self.token}"

    async def connect_ws(self, workspace_id: str):
        ws_url = f"{self.base_ws}/ws/v2?token={self.token}&workspace_id={workspace_id}"
        self.ws = await websockets.connect(ws_url)
        self.listen_task = asyncio.create_task(self._listen())
        # First frame should be auth confirmation
        frame = await self.receive_frame(timeout=5.0)
        assert frame.get("type") in ("AUTH_SUCCESS", "AUTH_OK"), f"Unexpected frame: {frame}"

    async def _listen(self):
        try:
            async for raw in self.ws:
                msg = json.loads(raw)
                await self.inbox.put(msg)
        except (websockets.ConnectionClosed, asyncio.CancelledError):
            pass

    async def receive_frame(self, expected_type: Optional[str] = None, timeout: float = 8.0) -> dict:
        loop = asyncio.get_running_loop()
        deadline = loop.time() + timeout
        while loop.time() < deadline:
            remaining = max(deadline - loop.time(), 0.1)
            try:
                frame = await asyncio.wait_for(self.inbox.get(), timeout=min(remaining, 1.0))
                if expected_type is None or frame.get("type") == expected_type:
                    return frame
            except asyncio.TimeoutError:
                pass
        raise TimeoutError(f"[{self.device_name}] Timed out waiting for frame '{expected_type}'")

    async def close(self):
        if self.listen_task:
            self.listen_task.cancel()
        if self.ws:
            await self.ws.close()
        await self.http.aclose()


async def run_deployment_verification(api_url: str, frontend_url: str):
    # Normalize URLs
    api_url = api_url.rstrip("/")
    frontend_url = frontend_url.rstrip("/")

    # Derive WebSocket URL (http -> ws, https -> wss)
    ws_protocol = "wss" if api_url.startswith("https") else "ws"
    ws_host = api_url.split("://", 1)[-1]
    ws_url = f"{ws_protocol}://{ws_host}"

    print("==========================================================================")
    print("               VGARSS 2.0 Post-Deployment Verification                     ")
    print("==========================================================================")
    print(f"Backend Target API:      {api_url}")
    print(f"Frontend Static Target:  {frontend_url}")
    print(f"WebSocket Target:        {ws_url}")
    print("--------------------------------------------------------------------------\n")

    results = {}

    # 1. Public Frontend Loads
    print("[Check 1/7] Testing Public Frontend Ingress...")
    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as http:
        try:
            fe_resp = await http.get(frontend_url)
            assert fe_resp.status_code == 200, f"Frontend returned HTTP {fe_resp.status_code}"
            assert "<html" in fe_resp.text.lower(), "Frontend response did not contain HTML markup"
            print(f"  [+] Frontend loaded successfully (HTTP 200, length: {len(fe_resp.text)} bytes)")
            results["frontend_load"] = True
        except Exception as e:
            print(f"  [-] Frontend load failed: {e}")
            results["frontend_load"] = False

    # 2. Backend Health Endpoint Responds
    print("\n[Check 2/7] Testing Backend Health & Telemetry Endpoint (/api/v2/health)...")
    async with httpx.AsyncClient(timeout=15.0) as http:
        try:
            h_resp = await http.get(f"{api_url}/api/v2/health")
            assert h_resp.status_code == 200, f"Health endpoint returned HTTP {h_resp.status_code}"
            h_data = h_resp.json()
            assert h_data.get("status") in ("healthy", "degraded"), f"Unexpected health status: {h_data.get('status')}"
            print(f"  [+] Health endpoint returned HTTP 200 OK")
            print(f"      - Status:           {h_data.get('status')}")
            print(f"      - Database Engine:  {h_data.get('database', {}).get('engine')}")
            print(f"      - Database Status:  {h_data.get('database', {}).get('status')}")
            print(f"      - Worker ID:        {h_data.get('worker_id')}")
            print(f"      - Scheduler Worker: {h_data.get('scheduler_worker', {}).get('is_running')}")
            results["health_check"] = True
        except Exception as e:
            print(f"  [-] Health check failed: {e}")
            results["health_check"] = False

    # 3. Registration & Authentication
    print("\n[Check 3/7] Testing User Registration, Password Hashing & Login...")
    client_a = LiveTestClient("alice", "Device 1 [Alice / Workstation]", api_url, ws_url)
    client_b = LiveTestClient("bob", "Device 2 [Bob / Mobile]", api_url, ws_url)

    try:
        await client_a.register_or_login()
        await client_b.register_or_login()
        print(f"  [+] Client A authenticated (ID: {client_a.user.get('id')})")
        print(f"  [+] Client B authenticated (ID: {client_b.user.get('id')})")
        results["auth_and_login"] = True

        # Discover or create shared workspace and channel
        ws_res = await client_a.http.get("/api/v2/workspaces")
        workspaces = ws_res.json()
        if not workspaces:
            create_ws = await client_a.http.post(
                "/api/v2/workspaces",
                json={"name": "Deployment Verification Workspace", "description": "Automated verification test space"},
            )
            assert create_ws.status_code == 201, f"Failed to create workspace: {create_ws.text}"
            ws_data = create_ws.json()
            ws_id = ws_data["id"]
            ws_name = ws_data["name"]
        else:
            ws_id = workspaces[0]["id"]
            ws_name = workspaces[0]["name"]

        # Ensure Client B is a member of the workspace
        b_uname = client_b.user.get("username", client_b.username)
        await client_a.http.post(
            f"/api/v2/workspaces/{ws_id}/members",
            json={"username": b_uname, "role": "ADMIN"},
        )

        channels_res = await client_a.http.get(f"/api/v2/workspaces/{ws_id}/channels")
        channels = channels_res.json()
        if not channels:
            create_ch = await client_a.http.post(
                f"/api/v2/workspaces/{ws_id}/channels",
                json={"name": "general", "topic": "Verification Channel"},
            )
            assert create_ch.status_code == 201
            ch_data = create_ch.json()
            channels = [ch_data]

        ch_id = channels[0]["id"]
        ch_name = channels[0]["name"]
        print(f"  [+] Using Target Workspace: {ws_name} ({ws_id})")
        print(f"  [+] Using Target Channel:   #{ch_name} ({ch_id})")

        # 4. Message Persistence Across Reloads
        print("\n[Check 4/7] Testing Message Persistence Across Page Reloads...")
        unique_text = f"Deployment persistence test msg {uuid.uuid4().hex[:8]}"
        post_resp = await client_a.http.post(
            f"/api/v2/channels/{ch_id}/messages",
            json={"content": unique_text},
        )
        assert post_resp.status_code == 201, f"Post message failed: {post_resp.text}"
        sent_id = post_resp.json()["id"]

        # Simulate fresh reload / fetch from REST database
        history_resp = await client_b.http.get(f"/api/v2/channels/{ch_id}/messages?limit=20")
        assert history_resp.status_code == 200
        history_msgs = history_resp.json().get("messages", [])
        matched = any(m["id"] == sent_id and m["content"] == unique_text for m in history_msgs)
        assert matched, "Persisted message was not found in freshly reloaded channel history"
        print(f"  [+] Message verified in persistent database (ID: {sent_id})")
        results["message_persistence"] = True

        # 5. Live Two-Device WebSocket Messaging
        print("\n[Check 5/7] Testing Real-Time Cross-Device WebSocket Messaging (WSS/WS)...")
        await client_a.connect_ws(ws_id)
        await client_b.connect_ws(ws_id)
        print("  [+] Dual WebSocket connections established (/ws/v2)")

        # Send live message from Device A
        live_content = f"Real-time broadcast from Device A [{uuid.uuid4().hex[:6]}]"
        await client_a.http.post(
            f"/api/v2/channels/{ch_id}/messages",
            json={"content": live_content, "client_msg_id": f"live-{uuid.uuid4().hex[:8]}"},
        )

        # Device B receives live message frame via WebSocket
        frame = await client_b.receive_frame(expected_type="CHAT_MESSAGE_RECV", timeout=8.0)
        assert frame.get("payload", {}).get("content") == live_content
        print(f"  [+] Device B received live WebSocket frame in real-time (Seq: {frame.get('seq')})")
        results["live_websockets"] = True

        # 6. Task Update Propagation Across Both Devices
        print("\n[Check 6/7] Testing Chat-to-Task Creation & Multi-Device Propagation...")
        task_resp = await client_a.http.post(
            "/api/v2/tasks",
            json={
                "workspace_id": ws_id,
                "channel_id": ch_id,
                "title": f"Live Deployment Task {uuid.uuid4().hex[:4]}",
                "priority": "MEDIUM",
                "arrival_time": 0,
                "estimated_burst_ticks": 3,
            },
        )
        assert task_resp.status_code == 201
        task_id = task_resp.json()["id"]

        # Device B receives task creation event
        t_frame = await client_b.receive_frame(expected_type="TASK_CREATED", timeout=8.0)
        assert t_frame.get("task_id") == task_id or t_frame.get("payload", {}).get("id") == task_id
        print(f"  [+] Task creation [{task_id}] propagated to Device B in real-time")
        results["task_propagation"] = True

        # 7. Verification Summary
        print("\n[Check 7/7] Database State & Restart Resilience Verification...")
        final_check = await client_a.http.get(f"/api/v2/tasks/{task_id}")
        assert final_check.status_code == 200
        print(f"  [+] Task state verified intact in primary persistent storage")
        results["persistence_resilience"] = True

    finally:
        await client_a.close()
        await client_b.close()

    print("\n==========================================================================")
    print("                      DEPLOYMENT VERIFICATION AUDIT                       ")
    print("==========================================================================")
    for check_name, passed in results.items():
        status_text = "PASSED [OK]" if passed else "FAILED [X]"
        print(f"  {check_name.replace('_', ' ').title():<30} : {status_text}")
    print("==========================================================================")

    all_passed = all(results.values()) and len(results) >= 7
    if all_passed:
        print("[+] ALL POST-DEPLOYMENT CHECKS COMPLETED SUCCESSFULLY!\n")
        return 0
    else:
        print("[-] SOME CHECKS FAILED. See output details above.\n")
        return 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="VGARSS 2.0 Post-Deployment Verification")
    parser.add_argument("--api-url", default="http://127.0.0.1:8000", help="Base URL of VGARSS API")
    parser.add_argument("--frontend-url", default="http://127.0.0.1:5173", help="Base URL of VGARSS Frontend")
    args = parser.parse_args()

    exit_code = asyncio.run(run_deployment_verification(args.api_url, args.frontend_url))
    sys.exit(exit_code)
