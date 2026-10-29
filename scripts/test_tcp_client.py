#!/usr/bin/env python3
"""VGARSS Raw TCP Socket Client.

Connects to 127.0.0.1:9000, receives the initial CONNECTED handshake,
encodes and transmits a 4-byte big-endian length-prefixed JSON request frame,
and unpacks and displays the server response frame.
"""

import json
import socket
import struct
import sys


def main():
    host = sys.argv[1] if len(sys.argv) > 1 else "127.0.0.1"
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 9000
    action = sys.argv[3].upper() if len(sys.argv) > 3 else "PING"
    client_id = sys.argv[4] if len(sys.argv) > 4 else "windows_client"
    target_id = sys.argv[5] if len(sys.argv) > 5 else "operator_alpha"
    payload_raw = sys.argv[6] if len(sys.argv) > 6 else '{"task": "TEST_BURST", "units": 4}'

    print(f"[*] Connecting to VGARSS Raw TCP Server on {host}:{port}...")
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(5.0)

    try:
        s.connect((host, port))

        # 1. Read CONNECTED Handshake
        raw_header = s.recv(4)
        if len(raw_header) < 4:
            print("[-] Failed to read frame length header")
            sys.exit(1)

        frame_len = struct.unpack("!I", raw_header)[0]
        handshake_bytes = s.recv(frame_len)
        handshake = json.loads(handshake_bytes.decode("utf-8"))

        header_hex = " ".join(f"{b:02X}" for b in raw_header)
        print(f"[+] CONNECTED Handshake Received:")
        print(f"    Header (4-Byte Hex): {header_hex}")
        print(f"    Declared Length:     {frame_len} bytes")
        print(f"    Server Payload:      {json.dumps(handshake, indent=2)}")

        # 2. Build Request Frame
        req = {"action": action}
        if action == "IDENTIFY":
            req["client_id"] = client_id
        elif action == "PAIR":
            req["target_id"] = target_id
        elif action == "FORWARD":
            req["target_id"] = target_id
            try:
                req["payload"] = json.loads(payload_raw)
            except Exception:
                req["payload"] = payload_raw

        json_bytes = json.dumps(req).encode("utf-8")
        header_bytes = struct.pack("!I", len(json_bytes))
        tx_hex = " ".join(f"{b:02X}" for b in header_bytes)

        print(f"\n[*] Transmitting Frame (Action={action}):")
        print(f"    Header (4-Byte Hex): {tx_hex}")
        print(f"    Payload Length:      {len(json_bytes)} bytes")
        print(f"    JSON Body:           {json.dumps(req)}")

        s.sendall(header_bytes + json_bytes)

        # 3. Read Response Frame
        resp_header = s.recv(4)
        if len(resp_header) < 4:
            print("[-] Incomplete response header")
            sys.exit(1)
        resp_len = struct.unpack("!I", resp_header)[0]
        resp_body = s.recv(resp_len)
        resp = json.loads(resp_body.decode("utf-8"))

        rx_hex = " ".join(f"{b:02X}" for b in resp_header)
        print(f"\n[+] Server Response Frame Received:")
        print(f"    Header (4-Byte Hex): {rx_hex}")
        print(f"    Declared Length:     {resp_len} bytes")
        print(f"    Server Response:     {json.dumps(resp, indent=2)}")
        print("\n[SUCCESS] Raw TCP framing verified successfully!")

    except Exception as e:
        print(f"[-] TCP Error: {e}")
        sys.exit(1)
    finally:
        s.close()


if __name__ == "__main__":
    main()

