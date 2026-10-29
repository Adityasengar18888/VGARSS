import { useState } from 'react';
import {
  Network,
  Activity,
  Send,
  Radio,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  CheckCircle,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { api } from '../services/api';
import { ConnectionStatus, NetworkTelemetryEvent, RawTcpLogEntry } from '../types/network';

interface NetworkMonitorViewProps {
  wsStatus: ConnectionStatus;
  wsLatency: number | null;
  wsEvents: NetworkTelemetryEvent[];
  lastSeq: number;
  onSendWsPing: () => void;
  onResyncWs: () => void;
}

export function NetworkMonitorView({
  wsStatus,
  wsLatency,
  wsEvents,
  lastSeq,
  onSendWsPing,
  onResyncWs,
}: NetworkMonitorViewProps) {
  const [filter, setFilter] = useState<'ALL' | 'WS' | 'TCP'>('ALL');

  // Interactive TCP simulator state
  const [tcpAction, setTcpAction] = useState<string>('PING');
  const [tcpPayload, setTcpPayload] = useState<string>('{"task": "CPU_BENCHMARK", "burst": 5}');
  const [tcpClientId, setTcpClientId] = useState<string>('client_alpha');
  const [tcpTargetId, setTcpTargetId] = useState<string>('client_beta');

  // Simulated & observed TCP raw logs
  const [tcpLogs, setTcpLogs] = useState<RawTcpLogEntry[]>([
    {
      id: 'tcp-init-1',
      direction: 'SERVER',
      action: 'CONNECTED',
      length: 124,
      headerHex: '00 00 00 7C',
      payload: { status: 'CONNECTED', server: 'VGARSS-Raw-TCP-Server', port: 9000, max_frame: 1048576 },
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);

  const handleSendTcpSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    let body: any = {};
    if (tcpAction === 'PING') body = { action: 'PING' };
    else if (tcpAction === 'ECHO') body = { action: 'ECHO', data: { test: 'VGARSS-Packet' } };
    else if (tcpAction === 'IDENTIFY') body = { action: 'IDENTIFY', client_id: tcpClientId };
    else if (tcpAction === 'PAIR') body = { action: 'PAIR', target_id: tcpTargetId };
    else if (tcpAction === 'FORWARD') {
      try {
        body = { action: 'FORWARD', target_id: tcpTargetId, payload: JSON.parse(tcpPayload) };
      } catch {
        body = { action: 'FORWARD', target_id: tcpTargetId, payload: tcpPayload };
      }
    }

    try {
      // Connect to the actual raw TCP server on port 9000
      const realResult = await api.testTcpPacket({
        action: tcpAction,
        client_id: tcpClientId,
        target_id: tcpTargetId,
        payload: body.payload || body.data,
      });

      const outbound: RawTcpLogEntry = {
        id: `tcp-out-${Date.now()}`,
        direction: 'OUTBOUND',
        action: tcpAction,
        length: realResult.sent_length,
        headerHex: realResult.sent_header_hex,
        payload: realResult.sent_payload,
        timestamp: new Date().toLocaleTimeString(),
      };

      const respPayload = realResult.response_payload;
      const inbound: RawTcpLogEntry = {
        id: `tcp-in-${Date.now() + 1}`,
        direction: 'INBOUND',
        action: respPayload.action || respPayload.status,
        length: JSON.stringify(respPayload).length,
        headerHex: realResult.sent_header_hex,
        payload: respPayload,
        timestamp: new Date().toLocaleTimeString(),
      };

      setTcpLogs((prev) => [inbound, outbound, ...prev.slice(0, 15)]);
      return;
    } catch {
      // Graceful fallback to client-side framing computation if server unavailable
    }

    const jsonStr = JSON.stringify(body);
    const len = new TextEncoder().encode(jsonStr).length;
    const hexLen = len.toString(16).padStart(8, '0').match(/.{2}/g)?.join(' ').toUpperCase() || '00 00 00 00';

    const outbound: RawTcpLogEntry = {
      id: `tcp-out-${Date.now()}`,
      direction: 'OUTBOUND',
      action: tcpAction,
      length: len,
      headerHex: hexLen,
      payload: body,
      timestamp: new Date().toLocaleTimeString(),
    };

    let serverResp: any = { status: 'OK', action: tcpAction, timestamp: new Date().toISOString() };
    if (tcpAction === 'PAIR') {
      serverResp = { status: 'OK', action: 'PAIR', peer_id: tcpTargetId, message: `Paired with '${tcpTargetId}'` };
    } else if (tcpAction === 'FORWARD') {
      serverResp = { status: 'OK', action: 'FORWARD', delivered_to: tcpTargetId, timestamp: new Date().toISOString() };
    }

    const respStr = JSON.stringify(serverResp);
    const respLen = new TextEncoder().encode(respStr).length;
    const respHex = respLen.toString(16).padStart(8, '0').match(/.{2}/g)?.join(' ').toUpperCase() || '00 00 00 00';

    const inbound: RawTcpLogEntry = {
      id: `tcp-in-${Date.now() + 1}`,
      direction: 'INBOUND',
      action: serverResp.action || serverResp.status,
      length: respLen,
      headerHex: respHex,
      payload: serverResp,
      timestamp: new Date().toLocaleTimeString(),
    };

    setTcpLogs((prev) => [inbound, outbound, ...prev.slice(0, 15)]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#202631] tracking-tight">Computer Networks Telemetry Monitor</h2>
          <p className="text-xs text-[#667085] mt-1 max-w-[65ch]">
            Real-time WebSocket event frames, 4-byte big-endian TCP binary packet framing, and paired-client forwarding.
          </p>
        </div>

        {/* Filter Toolbar */}
        <div className="flex items-center space-x-1 bg-white p-1 rounded-lg border border-[#E4E7EC] text-xs shadow-sm">
          <Filter className="w-3.5 h-3.5 text-[#667085] ml-1.5" />
          <button
            onClick={() => setFilter('ALL')}
            className={`px-2.5 py-1 rounded font-mono transition-colors ${
              filter === 'ALL' ? 'bg-[#4055A8] text-white font-bold' : 'text-[#667085] hover:text-[#202631]'
            }`}
          >
            All Protocols
          </button>
          <button
            onClick={() => setFilter('WS')}
            className={`px-2.5 py-1 rounded font-mono transition-colors ${
              filter === 'WS' ? 'bg-[#4055A8] text-white font-bold' : 'text-[#667085] hover:text-[#202631]'
            }`}
          >
            WebSockets
          </button>
          <button
            onClick={() => setFilter('TCP')}
            className={`px-2.5 py-1 rounded font-mono active:scale-[0.97] transition-colors ${
              filter === 'TCP' ? 'bg-[#4055A8] text-white font-bold' : 'text-[#667085] hover:text-[#202631]'
            }`}
          >
            TCP:9000
          </button>
        </div>
      </div>

      {/* Network Health KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center justify-between text-[#667085] text-xs font-mono">
            <span>WebSocket Status</span>
            <Radio className="w-4 h-4 text-[#16805D]" />
          </div>
          <div className="mt-3 flex items-center space-x-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                wsStatus === 'connected' ? 'bg-[#16805D] animate-pulse' : 'bg-[#C0393A]'
              }`}
            />
            <span className="text-base font-bold font-mono text-[#202631] uppercase">{wsStatus}</span>
          </div>
          <p className="text-[10px] text-[#667085] mt-2 font-mono">URI: ws://127.0.0.1:8000/ws</p>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-[#667085] text-xs font-mono">
            <span>Round-Trip Latency</span>
            <Activity className="w-4 h-4 text-[#4055A8]" />
          </div>
          <div className="mt-3 text-2xl font-bold font-mono text-[#4055A8]">
            {wsLatency !== null ? `${wsLatency} ms` : '—'}
          </div>
          <p className="text-[10px] text-[#667085] mt-2 font-mono">Heartbeat Ping interval: 15s</p>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-[#667085] text-xs font-mono">
            <span>Event Sequence (Seq)</span>
            <CheckCircle className="w-4 h-4 text-[#16805D]" />
          </div>
          <div className="mt-3 text-2xl font-bold font-mono text-[#202631]">#{lastSeq}</div>
          <p className="text-[10px] text-[#667085] mt-2 font-mono">Monotonic order per group</p>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-[#667085] text-xs font-mono">
            <span>TCP Socket Server</span>
            <Network className="w-4 h-4 text-[#4055A8]" />
          </div>
          <div className="mt-3 flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#16805D] animate-pulse" />
            <span className="text-base font-bold font-mono text-[#202631]">PORT 9000</span>
          </div>
          <p className="text-[10px] text-[#667085] mt-2 font-mono">4-Byte Big-Endian Framing (!I)</p>
        </Card>
      </div>

      {/* Dual Column Telemetry Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: WebSocket Telemetry */}
        {(filter === 'ALL' || filter === 'WS') && (
          <Card
            title="WebSocket Telemetry Channel"
            subtitle="Live state broadcasts, task lifecycle events, and resynchronization batches"
            actions={
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={onSendWsPing}
                  className="px-2.5 py-1 bg-white hover:bg-slate-50 text-[#202631] border border-[#E4E7EC] rounded text-[11px] font-mono transition-colors shadow-sm"
                >
                  Send Ping
                </button>
                <button
                  onClick={onResyncWs}
                  className="px-2.5 py-1 bg-[#4055A8] hover:bg-[#34468B] text-white rounded text-[11px] font-mono transition-colors shadow-sm"
                >
                  Resync
                </button>
              </div>
            }
          >
            <div className="space-y-2 font-mono text-xs overflow-y-auto max-h-[420px] pr-1">
              {wsEvents.slice(-10).reverse().map((ev, i) => (
                <div
                  key={i}
                  className="p-3 bg-[#F8F9FB] border border-[#E4E7EC] rounded-lg flex flex-col space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[#4055A8] font-bold">
                      {ev.seq ? `#${ev.seq} ` : ''}{ev.type}
                    </span>
                    <span className="text-[#667085] text-[10px]">
                      {new Date(ev.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  {ev.payload && (
                    <pre className="text-[10px] text-[#202631] bg-white p-2 rounded overflow-x-auto border border-[#E4E7EC]">
                      {JSON.stringify(ev.payload, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
              {wsEvents.length === 0 && (
                <div className="py-12 text-center text-[#667085] text-xs">
                  No WebSocket frames received yet.
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Right Column: Raw TCP Port 9000 Packet Feed */}
        {(filter === 'ALL' || filter === 'TCP') && (
          <Card
            title="Raw TCP Socket Stream (Port 9000)"
            subtitle="Length-prefixed binary frames with 4-byte header hex dumps and parsed JSON payloads"
          >
            <div className="space-y-2 font-mono text-xs overflow-y-auto max-h-[420px] pr-1">
              {tcpLogs.map((log) => (
                <div
                  key={log.id}
                  className={`p-3 border rounded-lg flex flex-col space-y-1.5 ${
                    log.direction === 'INBOUND'
                      ? 'bg-[#F8F9FB] border-emerald-300'
                      : log.direction === 'OUTBOUND'
                      ? 'bg-[#F8F9FB] border-[#4055A8]/40'
                      : 'bg-white border-[#E4E7EC]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      {log.direction === 'INBOUND' ? (
                        <ArrowDownLeft className="w-3.5 h-3.5 text-[#16805D]" />
                      ) : (
                        <ArrowUpRight className="w-3.5 h-3.5 text-[#4055A8]" />
                      )}
                      <span className="font-bold text-[#202631]">{log.action}</span>
                      <span className="text-[10px] text-[#667085] px-1 py-0.5 rounded bg-white border border-[#E4E7EC]">
                        {log.direction}
                      </span>
                    </div>
                    <span className="text-[#667085] text-[10px]">{log.timestamp}</span>
                  </div>

                  <div className="text-[11px] text-[#667085] flex items-center space-x-3">
                    <span>
                      Header: <strong className="text-[#4055A8]">{log.headerHex}</strong>
                    </span>
                    <span>
                      Length: <strong className="text-[#202631]">{log.length} B</strong>
                    </span>
                  </div>

                  <pre className="text-[10px] text-[#202631] bg-white p-2 rounded overflow-x-auto border border-[#E4E7EC]">
                    {JSON.stringify(log.payload, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Interactive TCP Packet Transmitter */}
      <Card
        title="Interactive Raw TCP Packet Transmitter"
        subtitle="Simulate client binary socket transmission, peer pairing, and message forwarding over port 9000"
      >
        <form onSubmit={handleSendTcpSimulation} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
            <div>
              <label className="block text-[#202631] font-semibold mb-1">TCP Action</label>
              <select
                value={tcpAction}
                onChange={(e) => setTcpAction(e.target.value)}
                className="w-full bg-white border border-[#E4E7EC] rounded-lg px-3 py-2 text-[#202631] focus:outline-none focus:border-[#4055A8] shadow-sm"
              >
                <option value="PING">PING (Latency Check)</option>
                <option value="ECHO">ECHO (Loopback Verification)</option>
                <option value="IDENTIFY">IDENTIFY (Register Client ID)</option>
                <option value="PAIR">PAIR (Direct Peer Pairing)</option>
                <option value="FORWARD">FORWARD (Paired-Client Forwarding)</option>
              </select>
            </div>

            <div>
              <label className="block text-[#202631] font-semibold mb-1">Origin Client ID</label>
              <input
                type="text"
                value={tcpClientId}
                onChange={(e) => setTcpClientId(e.target.value)}
                className="w-full bg-white border border-[#E4E7EC] rounded-lg px-3 py-2 text-[#202631] focus:outline-none focus:border-[#4055A8] shadow-sm"
              />
            </div>

            <div>
              <label className="block text-[#202631] font-semibold mb-1">Target Client ID (For PAIR / FORWARD)</label>
              <input
                type="text"
                value={tcpTargetId}
                onChange={(e) => setTcpTargetId(e.target.value)}
                className="w-full bg-white border border-[#E4E7EC] rounded-lg px-3 py-2 text-[#202631] focus:outline-none focus:border-[#4055A8] shadow-sm"
              />
            </div>
          </div>

          {tcpAction === 'FORWARD' && (
            <div>
              <label className="block text-xs font-mono text-[#202631] font-semibold mb-1">
                JSON Forward Payload
              </label>
              <textarea
                rows={2}
                value={tcpPayload}
                onChange={(e) => setTcpPayload(e.target.value)}
                className="w-full bg-white border border-[#E4E7EC] rounded-lg px-3 py-2 text-xs font-mono text-[#202631] focus:outline-none focus:border-[#4055A8] shadow-sm"
              />
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-[#E4E7EC]">
            <span className="text-xs text-[#667085] font-mono">
              Prefixes 4-byte header length (!I) automatically before transmission.
            </span>
            <button
              type="submit"
              className="px-4 py-2 bg-[#4055A8] hover:bg-[#34468B] text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 active:scale-[0.97] transition shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Transmit TCP Frame</span>
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}

