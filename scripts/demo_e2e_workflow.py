"""VGARSS End-to-End Live Workflow Demonstration Script.

Runs an interactive, comprehensive demonstration against the live running
FastAPI ASGI server (port 8000) and Raw TCP Socket server (port 9000).
"""
import sys
import json
import time
import struct
import asyncio
import httpx
import websockets

sys.path.insert(0, ".")
from backend.app.network.framing import read_frame, write_frame

BASE_URL = "http://127.0.0.1:8000"
WS_URL = "ws://127.0.0.1:8000"
TCP_HOST = "127.0.0.1"
TCP_PORT = 9000


async def run_live_demonstration():
    print("=" * 80)
    print(" VGARSS END-TO-END SYSTEM INTEGRATION DEMONSTRATION")
    print("=" * 80)

    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as http:
        # 1. Health & Server Status
        print("\n[1/10] Verifying System Gateways & Health...")
        health = (await http.get("/api/v1/health")).json()
        print(f"  --> FastAPI Server: {health['status']} (v{health['version']})")
        print(f"  --> Ports: REST={health['ports']['rest_api']}, Raw TCP={health['ports']['raw_tcp']}")

        tcp_status = (await http.get("/api/v1/network/tcp/status")).json()
        print(f"  --> Raw TCP Status: {tcp_status['status']} on port {tcp_status['port']} ({tcp_status['framing']})")

        # 2. Authentication & Session
        print("\n[2/10] Authenticating Engineer Session...")
        uniq = str(int(time.time()))[-4:]
        reg = await http.post("/api/v1/auth/register", json={
            "username": f"eng_{uniq}",
            "email": f"eng_{uniq}@vgarss.org",
            "password": "SecurePassword123!",
        })
        token = reg.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        print(f"  --> Registered user 'eng_{uniq}', acquired session token: {token[:12]}...")

        # 3. Virtual Group Isolation Domain
        print("\n[3/10] Provisioning Virtual Group Isolation Domain...")
        grp = await http.post("/api/v1/groups", json={
            "name": f"Live Cluster {uniq}",
            "description": "Multi-tenant domain for real-time scheduling & concurrency demonstration",
        }, headers=headers)
        group_id = grp.json()["id"]
        print(f"  --> Virtual Group ID: {group_id}")

        # 4. Multi-Client WebSocket Telemetry Connections
        print("\n[4/10] Establishing Bi-directional WebSockets for Client Alpha and Client Beta...")
        ws_uri = f"{WS_URL}/ws/groups/{group_id}?token={token}"
        
        async with websockets.connect(ws_uri) as ws_alpha, websockets.connect(ws_uri) as ws_beta:
            auth_a = json.loads(await ws_alpha.recv())
            auth_b = json.loads(await ws_beta.recv())
            print(f"  --> Client Alpha Handshake: {auth_a['type']} (seq={auth_a.get('current_seq', 0)})")
            print(f"  --> Client Beta Handshake:  {auth_b['type']} (seq={auth_b.get('current_seq', 0)})")

            # 5. Workload Creation & Dynamic Task Submission
            print("\n[5/10] Initializing Simulation Workload (P1, P2) and Shared Mutex (R1)...")
            sim_init = await http.post(f"/api/v1/groups/{group_id}/simulations", json={
                "name": "Live Concurrency Workload",
                "algorithm": "FCFS",
                "time_quantum": 2,
                "processes": [
                    {"id": "P1", "arrival_time": 0, "burst_time": 3, "priority": 1},
                    {"id": "P2", "arrival_time": 0, "burst_time": 3, "priority": 2},
                ],
                "resources": [
                    {"id": "R1", "name": "Critical DB Lock", "resource_type": "MUTEX", "total_capacity": 1, "order_rank": 1}
                ],
            }, headers=headers)
            sim_id = sim_init.json()["id"]
            print(f"  --> Simulation ID: {sim_id} (Algorithm: FCFS)")

            # Consume SIMULATION_CREATED from both websockets
            ev_sim_a = json.loads(await ws_alpha.recv())
            ev_sim_b = json.loads(await ws_beta.recv())
            print(f"  --> WS Event: {ev_sim_a['type']} observed on both clients (seq={ev_sim_a['seq']})")

            # Dynamically submit task P3
            print("  --> Dynamically submitting additional Task P3...")
            proc3 = await http.post(f"/api/v1/groups/{group_id}/simulations/{sim_id}/processes", json={
                "id": "P3",
                "arrival_time": 1,
                "burst_time": 2,
                "priority": 3,
            }, headers=headers)
            print(f"  --> Submitted: {proc3.json()}")

            ev_p3_a = json.loads(await ws_alpha.recv())
            ev_p3_b = json.loads(await ws_beta.recv())
            print(f"  --> WS Event: {ev_p3_a['type']} (process={ev_p3_a['payload']['process_id']}, seq={ev_p3_a['seq']})")

            # 6. Change Scheduling Policy dynamically
            print("\n[6/10] Updating Scheduling Policy dynamically from FCFS to ROUND_ROBIN (Q=2)...")
            policy_up = await http.put(f"/api/v1/groups/{group_id}/simulations/{sim_id}/policy", json={
                "algorithm": "ROUND_ROBIN",
                "time_quantum": 2,
                "is_preemptive": True,
            }, headers=headers)
            print(f"  --> Active Policy: {policy_up.json()['algorithm']} (Quantum={policy_up.json()['time_quantum']})")

            ev_pol_a = json.loads(await ws_alpha.recv())
            ev_pol_b = json.loads(await ws_beta.recv())
            print(f"  --> WS Event: {ev_pol_a['type']} (algorithm={ev_pol_a['payload']['algorithm']}, seq={ev_pol_a['seq']})")

            # 7. Step Simulation and Trigger Resource Conflict
            print("\n[7/10] Advancing Logical Simulation Clock & Triggering Resource Conflict...")
            step1 = await http.post(f"/api/v1/groups/{group_id}/simulations/{sim_id}/step", headers=headers)
            s1 = step1.json()
            print(f"  --> Tick {s1['tick']}: Process {s1['running_process_id']} is RUNNING on CPU")
            await ws_alpha.recv()
            await ws_beta.recv()

            # P1 requests R1 (Granted)
            print("  --> Process P1 requests Mutex R1 (EXCLUSIVE)...")
            acq1 = (await http.post(f"/api/v1/groups/{group_id}/simulations/{sim_id}/resources/acquire", json={
                "process_id": "P1", "resource_id": "R1", "mode": "EXCLUSIVE", "units": 1
            }, headers=headers)).json()
            print(f"  --> Result: granted={acq1['granted']}, status={acq1['status']}")
            ev_acq1 = json.loads(await ws_alpha.recv())
            await ws_beta.recv()
            print(f"  --> WS Event: {ev_acq1['type']} (holder={ev_acq1['payload']['process_id']}, seq={ev_acq1['seq']})")

            # P2 requests R1 (Conflict! Denied -> WAITING)
            print("  --> Process P2 requests Mutex R1 (Conflict! P1 is exclusive holder)...")
            acq2 = (await http.post(f"/api/v1/groups/{group_id}/simulations/{sim_id}/resources/acquire", json={
                "process_id": "P2", "resource_id": "R1", "mode": "EXCLUSIVE", "units": 1
            }, headers=headers)).json()
            print(f"  --> Result: granted={acq2['granted']}, status={acq2['status']} (P2 moved to WAITING queue)")
            ev_acq2 = json.loads(await ws_alpha.recv())
            await ws_beta.recv()
            print(f"  --> WS Event: {ev_acq2['type']} (blocked_process={ev_acq2['payload']['process_id']}, seq={ev_acq2['seq']})")

            # Inspect resource allocation status
            res_stat = (await http.get(f"/api/v1/groups/{group_id}/simulations/{sim_id}/resources", headers=headers)).json()
            print(f"  --> Resource R1 State: Holder='{res_stat[0]['exclusive_holder']}', Wait Queue={res_stat[0]['wait_queue']}")

            # 8. Release Resource & Unblock P2
            print("\n[8/10] Process P1 releases Mutex R1 -> P2 Awakened & Resumed...")
            rel = (await http.post(f"/api/v1/groups/{group_id}/simulations/{sim_id}/resources/release", json={
                "process_id": "P1", "resource_id": "R1"
            }, headers=headers)).json()
            print(f"  --> Released: {rel['released']}, Awakened Processes: {rel['awakened_processes']}")
            ev_rel = json.loads(await ws_alpha.recv())
            await ws_beta.recv()
            print(f"  --> WS Event: {ev_rel['type']} (awakened={ev_rel['payload']['awakened_processes']}, seq={ev_rel['seq']})")

            # 9. Step forward to Completion
            print("\n[9/10] Executing Simulation to Completion...")
            completed = False
            while not completed:
                st = (await http.post(f"/api/v1/groups/{group_id}/simulations/{sim_id}/step", headers=headers)).json()
                await ws_alpha.recv()
                await ws_beta.recv()
                if st["status"] == "COMPLETED":
                    completed = True
                    await ws_alpha.recv()  # SIMULATION_COMPLETED
                    await ws_beta.recv()
                    print(f"  --> Simulation COMPLETED at tick T={st['tick']}")

            # Inspect final mathematical metrics
            full_sim = (await http.get(f"/api/v1/groups/{group_id}/simulations/{sim_id}", headers=headers)).json()
            print("\n  ================ FINAL EXECUTION METRICS ================")
            print(f"  CPU Utilization:     {full_sim['cpu_utilization']}%")
            print(f"  Throughput:          {full_sim['throughput']} processes / tick")
            print(f"  Avg Waiting Time:    {full_sim['avg_waiting_time']} ticks")
            print(f"  Avg Turnaround Time: {full_sim['avg_turnaround_time']} ticks")
            print(f"  Avg Response Time:   {full_sim['avg_response_time']} ticks")
            print("  --------------------------------------------------------")
            print(f"  {'PID':<6} {'ARRIVAL':<8} {'BURST':<6} {'START':<6} {'FINISH':<8} {'TAT (WT+BT)':<12} {'STATE'}")
            for p in full_sim["processes"]:
                tat_check = f"{p['turnaround_time']} ({p['waiting_time']}+{p['burst_time']})"
                print(f"  {p['id']:<6} {p['arrival_time']:<8} {p['burst_time']:<6} {str(p.get('start_time')):<6} {str(p.get('completion_time')):<8} {tat_check:<12} {p['state']}")

            # Reset Simulation
            print("\n  --> Resetting Simulation to initial state (Tick=0)...")
            reset = (await http.post(f"/api/v1/groups/{group_id}/simulations/{sim_id}/reset", headers=headers)).json()
            print(f"  --> Simulation Reset: status={reset['status']}, tick={reset['current_tick']}")

        # 10. Raw TCP Demonstration on Port 9000
        print("\n[10/10] Testing Raw TCP Socket Protocol & Framing on Port 9000...")
        reader_a, writer_a = await asyncio.open_connection(TCP_HOST, TCP_PORT)
        # Read 4-byte length prefix
        raw_len_bytes = await reader_a.readexactly(4)
        frame_len = struct.unpack("!I", raw_len_bytes)[0]
        raw_payload = await reader_a.readexactly(frame_len)
        handshake = json.loads(raw_payload.decode("utf-8"))
        header_hex = raw_len_bytes.hex(" ").upper()
        print(f"  --> TCP Handshake received: length={frame_len}B (Header Hex: {header_hex})")
        print(f"  --> Server payload: {handshake['server']} (Client ID: {handshake['client_id']})")

        # Send PING frame
        ping_body = json.dumps({"action": "PING"}).encode("utf-8")
        writer_a.write(struct.pack("!I", len(ping_body)) + ping_body)
        await writer_a.drain()

        # Read PONG frame
        pong_len = struct.unpack("!I", await reader_a.readexactly(4))[0]
        pong_res = json.loads((await reader_a.readexactly(pong_len)).decode("utf-8"))
        print(f"  --> PING / PONG confirmed: {pong_res['action']} at {pong_res['timestamp']}")

        # Test Paired Forwarding over Raw TCP
        await write_frame(writer_a, {"action": "IDENTIFY", "client_id": "operator_live_a"})
        await read_frame(reader_a)

        reader_b, writer_b = await asyncio.open_connection(TCP_HOST, TCP_PORT)
        await read_frame(reader_b)
        await write_frame(writer_b, {"action": "IDENTIFY", "client_id": "operator_live_b"})
        await read_frame(reader_b)

        # Pair B with A
        await write_frame(writer_b, {"action": "PAIR", "target_id": "operator_live_a"})
        pair_ack = await read_frame(reader_b)
        print(f"  --> Direct Client Pairing: {pair_ack['message']}")
        await read_frame(reader_a)  # PEER_PAIRED notification

        # Forward packet B -> A
        telemetry_pkt = {"event": "REMOTE_BURST_DISPATCH", "core_id": 3, "ticks": 10}
        await write_frame(writer_b, {"action": "FORWARD", "payload": telemetry_pkt})
        fwd_res = await read_frame(reader_a)
        print(f"  --> Forwarded Packet received by Client A: from='{fwd_res['from_client_id']}', payload={fwd_res['payload']}")

        writer_a.close()
        writer_b.close()
        await writer_a.wait_closed()
        await writer_b.wait_closed()

    print("\n" + "=" * 80)
    print(" ALL 10 PHASES OF THE VGARSS END-TO-END WORKFLOW SUCCEEDED PERFECTLY!")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(run_live_demonstration())
