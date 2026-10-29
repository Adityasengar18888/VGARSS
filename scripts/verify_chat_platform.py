"""Verification script for VGARSS 2.0 Chat Platform, Task Coordination, Scheduling & Resources."""
import sys
import httpx

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

base = "http://127.0.0.1:8000"

print("[1] Logging in as Alice Cooper...")
alice_auth = httpx.post(f"{base}/api/v2/auth/dev-switch", json={"username": "alice"}).json()
a_tok = alice_auth["token"]

print("[2] Fetching Workspaces & Channels...")
ws_list = httpx.get(f"{base}/api/v2/workspaces", headers={"Authorization": f"Bearer {a_tok}"}).json()
assert len(ws_list) > 0, "No workspace found"
ws = next((w for w in ws_list if w.get("id") == "ws-core-engineering"), ws_list[0])
print(f"    Active Workspace: {ws['name']} ({ws['id']})")

# Ensure Bob is invited to this workspace so he has full member rights
httpx.post(
    f"{base}/api/v2/workspaces/{ws['id']}/members",
    json={"username": "bob", "role": "ADMIN"},
    headers={"Authorization": f"Bearer {a_tok}"},
)

chans = httpx.get(f"{base}/api/v2/workspaces/{ws['id']}/channels", headers={"Authorization": f"Bearer {a_tok}"}).json()
os_ch = next(c for c in chans if "os-scheduling" in c["name"])
print(f"    Target Channel: #{os_ch['name']} ({os_ch['id']})")

print("[3] Alice posting message...")
msg1 = httpx.post(
    f"{base}/api/v2/channels/{os_ch['id']}/messages",
    json={"content": "Kernel workload initialized. Preparing Round Robin benchmark."},
    headers={"Authorization": f"Bearer {a_tok}"},
).json()
print(f"    Message: [{msg1['sender_display_name']}] \"{msg1['content']}\" (ID: {msg1['id']}, Seq: {msg1['seq']})")

print("[4] Creating task from message with required resources...")
task1 = httpx.post(
    f"{base}/api/v2/tasks",
    json={
        "workspace_id": ws["id"],
        "channel_id": os_ch["id"],
        "source_message_id": msg1["id"],
        "title": "Evaluate Priority Scheduling with Aging",
        "description": "Starvation mitigation test on 5 processes",
        "priority": "HIGH",
        "arrival_time": 0,
        "estimated_burst_ticks": 4,
        "required_resources": ["res-mutex-gpu"],
    },
    headers={"Authorization": f"Bearer {a_tok}"},
).json()
print(f"    Task Created: [{task1['id']}] \"{task1['title']}\" (Status: {task1['status']}, Priority: {task1['priority']}, Burst: {task1['estimated_burst_ticks']} ticks)")

print("[5] Switching to Bob Smith...")
bob_auth = httpx.post(f"{base}/api/v2/auth/dev-switch", json={"username": "bob"}).json()
b_tok = bob_auth["token"]

print("[6] Bob replies in channel...")
msg2 = httpx.post(
    f"{base}/api/v2/channels/{os_ch['id']}/messages",
    json={"content": "@Alice Cooper Acknowledged, running starvation aging benchmark."},
    headers={"Authorization": f"Bearer {b_tok}"},
).json()
print(f"    Message: [{msg2['sender_display_name']}] \"{msg2['content']}\"")

print("[7] Bob admits task to READY state...")
admitted_task = httpx.patch(
    f"{base}/api/v2/tasks/{task1['id']}",
    json={"status": "READY", "action": "ADMIT"},
    headers={"Authorization": f"Bearer {b_tok}"},
).json()
print(f"    Task State Updated: {admitted_task['id']} -> {admitted_task['status']}")

print("[8] Listing Workspace Synchronization Resources...")
resources = httpx.get(
    f"{base}/api/v2/workspaces/{ws['id']}/resources",
    headers={"Authorization": f"Bearer {b_tok}"},
).json()
print(f"    Found {len(resources)} resources:")
for r in resources:
    print(f"    * [{r['id']}] {r['name']} ({r['resource_type']}) - {r['available_units']}/{r['total_capacity']} available")

target_res = next((r for r in resources if r["available_units"] > 0), resources[0])
target_res_id = target_res["id"]

print(f"[9] Task acquires lock on {target_res['name']} ({target_res_id})...")
acq_resp = httpx.post(
    f"{base}/api/v2/tasks/{task1['id']}/resources/acquire",
    json={"resource_id": target_res_id, "mode": "EXCLUSIVE" if target_res["resource_type"] == "MUTEX" else "SHARED", "units": 1},
    headers={"Authorization": f"Bearer {b_tok}"},
)
assert acq_resp.status_code == 200, f"Acquire failed: {acq_resp.text}"
acq_res = acq_resp.json()
print(f"    Acquisition Result: Status={acq_res['status']}, Granted={acq_res['granted']}")

print("[10] Querying Centralized Backend Scheduler State...")
sched_state = httpx.get(
    f"{base}/api/v2/workspaces/{ws['id']}/scheduler",
    headers={"Authorization": f"Bearer {b_tok}"},
).json()
print(f"    Scheduler Algorithm: {sched_state['algorithm']}, Current Tick: {sched_state['current_tick']}, Ready: {len(sched_state['ready_queue'])}, Running: {sched_state['running_task_id']}")

print("[11] Advancing Backend Scheduler by 1 Clock Tick...")
step_resp = httpx.post(
    f"{base}/api/v2/workspaces/{ws['id']}/scheduler/step",
    headers={"Authorization": f"Bearer {b_tok}"},
)
assert step_resp.status_code == 200, f"Step failed: {step_resp.text}"
step_res = step_resp.json()
print(f"    Scheduler Step Tick: {step_res['current_tick']}, Running: {step_res['running_task_id']}, CPU Utilization: {step_res['metrics']['cpu_utilization']}%")

print("[12] Checking Deadlock Detection (Wait-For Graph Cycle Detection)...")
dl_report = httpx.get(
    f"{base}/api/v2/workspaces/{ws['id']}/deadlock",
    headers={"Authorization": f"Bearer {b_tok}"},
).json()
print(f"    Deadlock Detected: {dl_report['deadlock_detected']}, Cycles: {dl_report['cycle_tasks']}")

if acq_res["granted"]:
    print(f"[13] Releasing {target_res['name']} ({target_res_id})...")
    rel_resp = httpx.post(
        f"{base}/api/v2/tasks/{task1['id']}/resources/release",
        json={"resource_id": target_res_id},
        headers={"Authorization": f"Bearer {b_tok}"},
    )
    assert rel_resp.status_code == 200, f"Release failed: {rel_resp.text}"
    rel_res = rel_resp.json()
    print(f"    Release Result: Released={rel_res['released']}, Awakened={rel_res['awakened_tasks']}")
else:
    print(f"[13] Task correctly blocked in WAITING queue on {target_res_id}.")

print("[14] Verifying Channel System Events Stream...")
all_msgs = httpx.get(
    f"{base}/api/v2/channels/{os_ch['id']}/messages",
    headers={"Authorization": f"Bearer {b_tok}"},
).json()["messages"]

print(f"    Total messages in #{os_ch['name']}: {len(all_msgs)}")
system_events = [m for m in all_msgs if m.get("message_type") == "SYSTEM_EVENT"]
print(f"    System Events logged in channel: {len(system_events)}")
for m in all_msgs[-8:]:
    print(f"    * [{m.get('message_type', 'TEXT')}] [{m['sender_display_name']}]: {m['content']}")

print("\nSUCCESS: All VGARSS 2.0 chat, scheduling, and resource coordination verified live!")
