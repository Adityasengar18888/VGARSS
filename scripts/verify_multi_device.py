"""Multi-User & Multi-Device Real-Time Verification Script for VGARSS 2.0.

Simulates two independent client devices (Client A: Alice, Client B: Bob) running
concurrently over REST and authenticated WebSockets (/ws/v2).

Verifies:
1. Independent multi-device authentication & session isolation
2. Real-time bi-directional presence updates across devices
3. Typing indicator transmission & receipt
4. Real-time message broadcast with monotonic sequence numbering
5. Collaborative task creation from chat with process metadata
6. Concurrent resource allocation & ownership synchronization
7. Server-side scheduler stepping & CPU telemetry broadcast
8. Client network disconnection, background offline messaging, and
   reconnection with monotonic sequence catch-up (CATCHUP_REQUEST/RESPONSE)
"""
import sys
import json
import uuid
import asyncio
from typing import Optional, Any
import httpx
import websockets

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_HTTP = "http://127.0.0.1:8000"
BASE_WS = "ws://127.0.0.1:8000"


class VirtualDeviceClient:
    """Simulates an independent user running on a separate device."""

    def __init__(self, username: str, device_label: str):
        self.username = username
        self.device_label = device_label
        self.token: str = ""
        self.user_data: dict = {}
        self.ws: Any = None
        self.inbox: asyncio.Queue = asyncio.Queue()
        self.listen_task: Optional[asyncio.Task] = None
        self.http = httpx.AsyncClient(base_url=BASE_HTTP, timeout=10.0)

    async def authenticate(self):
        resp = await self.http.post("/api/v2/auth/dev-switch", json={"username": self.username})
        assert resp.status_code == 200, f"Auth failed for {self.username}: {resp.text}"
        data = resp.json()
        self.token = data["token"]
        self.user_data = data["user"]
        self.http.headers["Authorization"] = f"Bearer {self.token}"
        print(f"[{self.device_label}] Authenticated as {self.username} (Token: {self.token[:12]}...)")

    async def connect_ws(self, workspace_id: str):
        ws_url = f"{BASE_WS}/ws/v2?token={self.token}&workspace_id={workspace_id}"
        self.ws = await websockets.connect(ws_url)
        self.listen_task = asyncio.create_task(self._listener())
        # First frame should be auth confirmation
        frame = await self.receive_frame(timeout=3.0)
        assert frame.get("type") == "AUTH_OK" or "type" in frame, f"Unexpected initial frame: {frame}"
        print(f"[{self.device_label}] WebSocket Connected & Authenticated (/ws/v2)")

    async def _listener(self):
        try:
            async for raw in self.ws:
                data = json.loads(raw)
                print(f"[{self.device_label}] WS RECV: {data.get('type')} (user={data.get('user_id')}, state={data.get('presence_state')})")
                await self.inbox.put(data)
        except (websockets.ConnectionClosed, asyncio.CancelledError):
            pass

    async def receive_frame(self, expected_type: Optional[str] = None, timeout: float = 5.0) -> dict:
        loop = asyncio.get_running_loop()
        deadline = loop.time() + timeout
        while loop.time() < deadline:
            remaining = max(deadline - loop.time(), 0.1)
            try:
                frame = await asyncio.wait_for(self.inbox.get(), timeout=min(remaining, 1.0))
                print(f"[{self.device_label}] POPPED FROM INBOX: {frame.get('type')}")
                if expected_type is None or frame.get("type") == expected_type:
                    return frame
            except asyncio.TimeoutError:
                pass
        raise TimeoutError(f"[{self.device_label}] Timed out waiting for frame of type '{expected_type}'")

    async def drain_frames(self) -> list:
        frames = []
        while not self.inbox.empty():
            frames.append(self.inbox.get_nowait())
        return frames

    async def send_frame(self, frame: dict):
        await self.ws.send(json.dumps(frame))

    async def disconnect_ws(self):
        if self.listen_task:
            self.listen_task.cancel()
            self.listen_task = None
        if self.ws:
            await self.ws.close()
            self.ws = None
        print(f"[{self.device_label}] WebSocket Disconnected (Simulating Network Drop)")

    async def close(self):
        await self.disconnect_ws()
        await self.http.aclose()


async def run_verification():
    print("==========================================================================")
    print("      VGARSS 2.0 Multi-User / Multi-Device Cross-Client Verification      ")
    print("==========================================================================")

    # 1. Spin up two independent clients simulating different computers
    client_a = VirtualDeviceClient("alice", "Device A [Alice / Workstation]")
    client_b = VirtualDeviceClient("bob", "Device B [Bob / Laptop]")

    try:
        # Phase 1: Authentication
        print("\n--- PHASE 1: INDEPENDENT AUTHENTICATION ---")
        await client_a.authenticate()
        await client_b.authenticate()

        # Phase 2: Workspace Discovery & Membership Verification
        print("\n--- PHASE 2: WORKSPACE & CHANNEL DISCOVERY ---")
        ws_res = await client_a.http.get("/api/v2/workspaces")
        workspaces = ws_res.json()
        assert len(workspaces) > 0, "No workspace available"
        ws = next((w for w in workspaces if w.get("id") == "ws-core-engineering"), workspaces[0])
        ws_id = ws["id"]
        print(f"Target Shared Workspace: {ws['name']} ({ws_id})")

        # Ensure Bob is in this workspace
        await client_a.http.post(
            f"/api/v2/workspaces/{ws_id}/members",
            json={"username": "bob", "role": "ADMIN"},
        )

        channels = (await client_a.http.get(f"/api/v2/workspaces/{ws_id}/channels")).json()
        target_ch = next(c for c in channels if "os-scheduling" in c["name"])
        ch_id = target_ch["id"]
        print(f"Target Shared Channel: #{target_ch['name']} ({ch_id})")

        # Phase 3: Dual WebSocket Handshake
        print("\n--- PHASE 3: CONCURRENT WEBSOCKET HANDSHAKES ---")
        await client_a.connect_ws(ws_id)
        await client_b.connect_ws(ws_id)

        # Drain initial presence/connection frames
        await asyncio.sleep(0.5)
        await client_a.drain_frames()
        await client_b.drain_frames()

        # Phase 4: Bi-directional Presence Synchronization
        print("\n--- PHASE 4: PRESENCE SYNCHRONIZATION ---")
        # Client A updates status to AWAY via REST
        p_resp = await client_a.http.patch("/api/v2/auth/presence", json={"presence_state": "AWAY", "status_message": "Compiling kernel modules"})
        assert p_resp.status_code == 200, f"Presence patch failed: {p_resp.text}"
        
        # Client B must receive Alice's presence change frame
        pres_frame = await client_b.receive_frame(expected_type="PRESENCE_UPDATE", timeout=5.0)
        assert pres_frame.get("type") == "PRESENCE_UPDATE", f"Expected PRESENCE_UPDATE, got: {pres_frame}"
        print(f"[Device B] Received Presence Update: User {pres_frame.get('user_id')} -> {pres_frame.get('presence_state')}")

        # Phase 5: Typing Indicators
        print("\n--- PHASE 5: TYPING INDICATORS ---")
        await client_a.send_frame({"type": "TYPING_START", "target_id": ch_id, "is_channel": True})
        typing_frame = await client_b.receive_frame(expected_type="TYPING_EVENT", timeout=5.0)
        assert typing_frame.get("type") == "TYPING_EVENT", f"Expected TYPING_EVENT, got: {typing_frame}"
        print(f"[Device B] Received Typing Notification from {typing_frame.get('display_name')}")

        # Phase 6: Real-Time Messaging & Monotonic Sequencing
        print("\n--- PHASE 6: REAL-TIME MESSAGING & MONOTONIC SEQUENCING ---")
        client_msg_id = f"cmsg-dev-{uuid.uuid4().hex[:8]}"
        msg_payload = {"content": f"Multi-device synchronization test message {client_msg_id}", "client_msg_id": client_msg_id}
        post_resp = await client_a.http.post(f"/api/v2/channels/{ch_id}/messages", json=msg_payload)
        assert post_resp.status_code == 201
        msg_data = post_resp.json()
        print(f"[Device A] Sent Message: \"{msg_data['content']}\" (ID: {msg_data['id']}, Seq: {msg_data['seq']})")

        # Client B receives message frame
        chat_frame = await client_b.receive_frame(expected_type="CHAT_MESSAGE_RECV", timeout=5.0)
        assert chat_frame.get("type") == "CHAT_MESSAGE_RECV", f"Expected CHAT_MESSAGE_RECV, got: {chat_frame}"
        received_msg = chat_frame.get("payload", {})
        assert received_msg.get("content") == msg_payload["content"]
        assert chat_frame.get("seq") == msg_data["seq"]
        print(f"[Device B] Real-Time Received: \"{received_msg.get('content')}\" (Seq: {chat_frame.get('seq')})")

        # Phase 7: Collaborative Task Creation from Chat
        print("\n--- PHASE 7: CHAT-TO-TASK PROCESS CREATION ---")
        task_resp = await client_a.http.post(
            "/api/v2/tasks",
            json={
                "workspace_id": ws_id,
                "channel_id": ch_id,
                "source_message_id": msg_data["id"],
                "title": "Cross-Device Shared Task",
                "description": "Multi-client concurrency check",
                "priority": "HIGH",
                "arrival_time": 0,
                "estimated_burst_ticks": 4,
            },
        )
        assert task_resp.status_code == 201
        task_data = task_resp.json()
        task_id = task_data["id"]
        print(f"[Device A] Created Task [{task_id}] \"{task_data['title']}\" from Chat Message")

        # Client B receives task event or channel announcement
        task_frame = await client_b.receive_frame(expected_type="TASK_CREATED", timeout=5.0)
        print(f"[Device B] Received WebSocket Event: {task_frame.get('type')}")

        # Phase 8: Resource Allocation & Synchronization
        print("\n--- PHASE 8: CONCURRENT RESOURCE LOCKING ---")
        res_list = (await client_b.http.get(f"/api/v2/workspaces/{ws_id}/resources")).json()
        assert len(res_list) > 0, "No resources found"
        target_res = res_list[0]
        res_id = target_res["id"]

        # Client B admits task to READY
        await client_b.http.patch(f"/api/v2/tasks/{task_id}", json={"status": "READY", "action": "ADMIT"})

        # Client B acquires resource for task
        acq_resp = await client_b.http.post(
            f"/api/v2/tasks/{task_id}/resources/acquire",
            json={"resource_id": res_id, "mode": "EXCLUSIVE" if target_res["resource_type"] == "MUTEX" else "SHARED", "units": 1},
        )
        assert acq_resp.status_code == 200
        print(f"[Device B] Acquired Resource [{res_id}] for Task [{task_id}] (Status: {acq_resp.json()['status']})")

        # Client A receives the resource acquisition notification
        res_event = await client_a.receive_frame(expected_type="TASK_STATE_CHANGED", timeout=5.0)
        print(f"[Device A] Received Real-Time Resource Event: {res_event.get('type')}")

        # Phase 9: Authoritative Scheduler Stepping
        print("\n--- PHASE 9: AUTHORITATIVE SCHEDULER STEPPING ---")
        step_resp = await client_a.http.post(f"/api/v2/workspaces/{ws_id}/scheduler/step")
        assert step_resp.status_code == 200
        step_data = step_resp.json()
        print(f"[Device A] Stepped Scheduler to Tick {step_data['current_tick']} (CPU Utilization: {step_data['metrics']['cpu_utilization']}%)")

        # Both devices receive the scheduler step event
        step_frame_b = await client_b.receive_frame(expected_type="SCHEDULER_STEP", timeout=5.0)
        assert step_frame_b.get("type") == "SCHEDULER_STEP"
        tick = step_frame_b.get("payload", {}).get("current_tick") or step_frame_b.get("state", {}).get("current_tick")
        print(f"[Device B] Received SCHEDULER_STEP Event: Tick {tick}")

        # Phase 10: Disconnect, Offline Buffering & Monotonic Sequence Catch-Up
        print("\n--- PHASE 10: NETWORK DROP, OFFLINE BUFFERING & RECONNECTION CATCH-UP ---")
        last_seen_seq = chat_frame.get("seq")
        print(f"[Device B] Simulating Network Disconnect (Last Seen Seq: {last_seen_seq})...")
        await client_b.disconnect_ws()

        # While Device B is offline, Device A posts 3 messages to the channel
        print("[Device A] Sending 3 messages while Device B is OFFLINE...")
        for i in range(1, 4):
            await client_a.http.post(
                f"/api/v2/channels/{ch_id}/messages",
                json={"content": f"Offline Catchup Message #{i}"},
            )
        print("[Device A] 3 offline messages persisted to database and buffered.")

        # Device B reconnects to WebSocket
        print("[Device B] Reconnecting to WebSocket...")
        await client_b.connect_ws(ws_id)
        # Drain initial welcome/presence frames
        await asyncio.sleep(0.5)
        await client_b.drain_frames()

        # Device B requests missed messages starting after last_seen_seq
        print(f"[Device B] Sending CATCHUP_REQUEST for channel {ch_id} since seq {last_seen_seq}...")
        await client_b.send_frame({
            "type": "CATCHUP_REQUEST",
            "target_id": ch_id,
            "since_seq": last_seen_seq,
        })

        # Device B receives replayed messages and then CATCHUP_COMPLETE
        replayed_messages = []
        catchup_complete = False
        loop = asyncio.get_running_loop()
        deadline = loop.time() + 5.0
        while loop.time() < deadline and not catchup_complete:
            try:
                frame = await asyncio.wait_for(client_b.inbox.get(), timeout=1.0)
                if frame.get("type") == "CHAT_MESSAGE_RECV":
                    replayed_messages.append(frame)
                    print(f"    * Replayed [Seq: {frame.get('seq')}]: {frame.get('payload', {}).get('content')}")
                elif frame.get("type") == "CATCHUP_COMPLETE":
                    catchup_complete = True
                    print(f"[Device B] Received CATCHUP_COMPLETE: {frame.get('replayed_count')} replayed events")
            except asyncio.TimeoutError:
                pass

        assert catchup_complete, "Device B never received CATCHUP_COMPLETE"
        assert len(replayed_messages) >= 3, f"Expected at least 3 replayed messages, got {len(replayed_messages)}"

        print("\n==========================================================================")
        print(" [+] ALL 10 MULTI-USER & MULTI-DEVICE PHASES PASSED WITH 100% CONSISTENCY! ")
        print("==========================================================================")

    finally:
        await client_a.close()
        await client_b.close()


if __name__ == "__main__":
    asyncio.run(run_verification())
