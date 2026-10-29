import React, { useState } from 'react';
import { Card } from '../components/common/Card';
import { ConnectionStatus, RawTcpLogEntry } from '../types/network';
import {
  Activity,
  Send,
  Radio,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  CheckCircle,
  Network,
} from 'lucide-react';

interface NetworkMonitorViewProps {
  wsStatus: ConnectionStatus;
  wsLatency: number | null;
  wsEvents: Array<{ type: string; timestamp: string; seq?: number; payload?: any }>;
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
  const [tcpLogs, setTcpLogs] = useState<RawTcpLogEntry[]>([
    {
      id: 'tcp-init-1',
      direction: 'INBOUND',
      action: 'HEARTBEAT_ACK',
      headerHex: '00 00 00 1E',
      length: 30,
      timestamp: new Date().toLocaleTimeString(),
      payload: { status: 'healthy', socket_clients_paired: 2 },
    },
    {
      id: 'tcp-init-2',
      direction: 'OUTBOUND',
      action: 'PING',
      headerHex: '00 00 00 14',
      length: 20,
      timestamp: new Date().toLocaleTimeString(),
      payload: { client_id: 'client_tcp_alpha', timestamp: Date.now() },
    },
  ]);

  // Form State for Interactive TCP Simulation
  const [tcpAction, setTcpAction] = useState<string>('PING');
  const [tcpClientId, setTcpClientId] = useState<string>('client_desktop_01');
  const [tcpTargetId, setTcpTargetId] = useState<string>('client_mobile_02');
  const [tcpPayload, setTcpPayload] = useState<string>('{"signal": "DISPATCH_TASK"}');

  const handleSendTcpSimulation = (e: React.FormEvent) => {
    e.preventDefault();
    const payloadBytes = new TextEncoder().encode(tcpPayload).length + 42;
    const hexLen = payloadBytes.toString(16).padStart(8, '0').match(/.{1,2}/g)?.join(' ').toUpperCase() || '00 00 00 2A';

    const outbound: RawTcpLogEntry = {
      id: `tcp-${Date.now()}-out`,
      direction: 'OUTBOUND',
      action: tcpAction,
      headerHex: hexLen,
      length: payloadBytes,
      timestamp: new Date().toLocaleTimeString(),
      payload: {
        origin: tcpClientId,
        target: tcpAction === 'PAIR' || tcpAction === 'FORWARD' ? tcpTargetId : undefined,
        body: tcpPayload,
      },
    };

    const inbound: RawTcpLogEntry = {
      id: `tcp-${Date.now()}-in`,
      direction: 'INBOUND',
      action: `${tcpAction}_ACK`,
      headerHex: '00 00 00 24',
      length: 36,
      timestamp: new Date(Date.now() + 12).toLocaleTimeString(),
      payload: {
        status: 'DELIVERED',
        routed_via: 'tcp_port_9000_broker',
        peer_acked: true,
      },
    };

    setTcpLogs((prev) => [inbound, outbound, ...prev.slice(0, 15)]);
  };

  return (
    <div className="space-y-6 font-mono">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#F2F2F2] tracking-tight font-sans">Computer Networks Telemetry Monitor</h2>
          <p className="text-xs text-[#A1A1A1] mt-1 max-w-[65ch]">
            Real-time WebSocket event frames, 4-byte big-endian TCP binary packet framing, and paired-client forwarding.
          </p>
        </div>

        {/* Filter Toolbar */}
        <div className="flex items-center space-x-1 bg-[#141414] p-1 rounded-[3px] border border-[#292929] text-xs">
          <Filter className="w-3.5 h-3.5 text-[#707070] ml-1.5" />
          <button
            onClick={() => setFilter('ALL')}
            className={`px-2.5 py-1 rounded-[2px] font-mono transition-colors ${
              filter === 'ALL' ? 'bg-[#E8E8E8] text-[#080808] font-bold' : 'text-[#707070] hover:text-[#F2F2F2]'
            }`}
          >
            All Protocols
          </button>
          <button
            onClick={() => setFilter('WS')}
            className={`px-2.5 py-1 rounded-[2px] font-mono transition-colors ${
              filter === 'WS' ? 'bg-[#E8E8E8] text-[#080808] font-bold' : 'text-[#707070] hover:text-[#F2F2F2]'
            }`}
          >
            WebSockets
          </button>
          <button
            onClick={() => setFilter('TCP')}
            className={`px-2.5 py-1 rounded-[2px] font-mono active:scale-95 transition-colors ${
              filter === 'TCP' ? 'bg-[#E8E8E8] text-[#080808] font-bold' : 'text-[#707070] hover:text-[#F2F2F2]'
            }`}
          >
            TCP:9000
          </button>
        </div>
      </div>

      {/* Network Health KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center justify-between text-[#707070] text-xs font-mono">
            <span>WebSocket Status</span>
            <Radio className="w-4 h-4 text-[#22C55E]" />
          </div>
          <div className="mt-3 flex items-center space-x-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                wsStatus === 'connected' ? 'bg-[#22C55E] animate-pulse' : 'bg-[#EF4444]'
              }`}
            />
            <span className="text-base font-bold font-mono text-[#F2F2F2] uppercase">{wsStatus}</span>
          </div>
          <p className="text-[10px] text-[#707070] mt-2 font-mono">Stream: wss://vgarss.onrender.com/ws/v2</p>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-[#707070] text-xs font-mono">
            <span>Round-Trip Latency</span>
            <Activity className="w-4 h-4 text-[#E8E8E8]" />
          </div>
          <div className="mt-3 text-2xl font-bold font-mono text-[#E8E8E8]">
            {wsLatency !== null ? `${wsLatency} ms` : '—'}
          </div>
          <p className="text-[10px] text-[#707070] mt-2 font-mono">Heartbeat Ping interval: 15s</p>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-[#707070] text-xs font-mono">
            <span>Event Sequence (Seq)</span>
            <CheckCircle className="w-4 h-4 text-[#22C55E]" />
          </div>
          <div className="mt-3 text-2xl font-bold font-mono text-[#F2F2F2]">#{lastSeq}</div>
          <p className="text-[10px] text-[#707070] mt-2 font-mono">Monotonic order per group</p>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-[#707070] text-xs font-mono">
            <span>TCP Socket Server</span>
            <Network className="w-4 h-4 text-[#E8E8E8]" />
          </div>
          <div className="mt-3 flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E] animate-pulse" />
            <span className="text-base font-bold font-mono text-[#F2F2F2]">PORT 9000</span>
          </div>
          <p className="text-[10px] text-[#707070] mt-2 font-mono">4-Byte Big-Endian Framing (!I)</p>
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
                  className="px-2.5 py-1 bg-[#141414] hover:bg-[#1E1E1E] text-[#F2F2F2] border border-[#292929] rounded-[2px] text-[11px] font-mono transition-colors shadow-xs"
                >
                  Send Ping
                </button>
                <button
                  onClick={onResyncWs}
                  className="px-2.5 py-1 bg-[#E8E8E8] hover:bg-white text-[#080808] font-bold rounded-[2px] text-[11px] font-mono transition-colors shadow-xs"
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
                  className="p-3 bg-[#141414] border border-[#292929] rounded-[3px] flex flex-col space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[#E8E8E8] font-bold">
                      {ev.seq ? `#${ev.seq} ` : ''}{ev.type}
                    </span>
                    <span className="text-[#707070] text-[10px]">
                      {new Date(ev.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  {ev.payload && (
                    <pre className="text-[10px] text-[#F2F2F2] bg-[#0E0E0E] p-2 rounded-[2px] overflow-x-auto border border-[#222222]">
                      {JSON.stringify(ev.payload, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
              {wsEvents.length === 0 && (
                <div className="py-12 text-center text-[#707070] text-xs">
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
                  className={`p-3 border rounded-[3px] flex flex-col space-y-1.5 ${
                    log.direction === 'INBOUND'
                      ? 'bg-[#141414] border-[#1C4424]'
                      : log.direction === 'OUTBOUND'
                      ? 'bg-[#141414] border-[#383838]'
                      : 'bg-[#141414] border-[#292929]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      {log.direction === 'INBOUND' ? (
                        <ArrowDownLeft className="w-3.5 h-3.5 text-[#22C55E]" />
                      ) : (
                        <ArrowUpRight className="w-3.5 h-3.5 text-[#E8E8E8]" />
                      )}
                      <span className="font-bold text-[#F2F2F2]">{log.action}</span>
                      <span className="text-[10px] text-[#A1A1A1] px-1 py-0.5 rounded-[2px] bg-[#1E1E1E] border border-[#2D2D2D]">
                        {log.direction}
                      </span>
                    </div>
                    <span className="text-[#707070] text-[10px]">{log.timestamp}</span>
                  </div>

                  <div className="text-[11px] text-[#707070] flex items-center space-x-3">
                    <span>
                      Header: <strong className="text-[#E8E8E8]">{log.headerHex}</strong>
                    </span>
                    <span>
                      Length: <strong className="text-[#F2F2F2]">{log.length} B</strong>
                    </span>
                  </div>

                  <pre className="text-[10px] text-[#F2F2F2] bg-[#0E0E0E] p-2 rounded-[2px] overflow-x-auto border border-[#222222]">
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
              <label className="block text-[#A1A1A1] font-semibold mb-1">TCP Action</label>
              <select
                value={tcpAction}
                onChange={(e) => setTcpAction(e.target.value)}
                className="w-full bg-[#141414] border border-[#292929] rounded-[2px] px-3 py-2 text-[#F2F2F2] focus:outline-none focus:border-[#E8E8E8] shadow-xs"
              >
                <option value="PING">PING (Latency Check)</option>
                <option value="ECHO">ECHO (Loopback Verification)</option>
                <option value="IDENTIFY">IDENTIFY (Register Client ID)</option>
                <option value="PAIR">PAIR (Direct Peer Pairing)</option>
                <option value="FORWARD">FORWARD (Paired-Client Forwarding)</option>
              </select>
            </div>

            <div>
              <label className="block text-[#A1A1A1] font-semibold mb-1">Origin Client ID</label>
              <input
                type="text"
                value={tcpClientId}
                onChange={(e) => setTcpClientId(e.target.value)}
                className="w-full bg-[#141414] border border-[#292929] rounded-[2px] px-3 py-2 text-[#F2F2F2] focus:outline-none focus:border-[#E8E8E8] shadow-xs"
              />
            </div>

            <div>
              <label className="block text-[#A1A1A1] font-semibold mb-1">Target Client ID (For PAIR / FORWARD)</label>
              <input
                type="text"
                value={tcpTargetId}
                onChange={(e) => setTcpTargetId(e.target.value)}
                className="w-full bg-[#141414] border border-[#292929] rounded-[2px] px-3 py-2 text-[#F2F2F2] focus:outline-none focus:border-[#E8E8E8] shadow-xs"
              />
            </div>
          </div>

          {tcpAction === 'FORWARD' && (
            <div>
              <label className="block text-xs font-mono text-[#A1A1A1] font-semibold mb-1">
                JSON Forward Payload
              </label>
              <textarea
                rows={2}
                value={tcpPayload}
                onChange={(e) => setTcpPayload(e.target.value)}
                className="w-full bg-[#141414] border border-[#292929] rounded-[2px] px-3 py-2 text-xs font-mono text-[#F2F2F2] focus:outline-none focus:border-[#E8E8E8] shadow-xs"
              />
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-[#222222]">
            <span className="text-xs text-[#707070] font-mono">
              Prefixes 4-byte header length (!I) automatically before transmission.
            </span>
            <button
              type="submit"
              className="px-4 py-2 bg-[#E8E8E8] hover:bg-white text-[#080808] rounded-[2px] text-xs font-bold uppercase flex items-center space-x-1.5 active:scale-95 transition shadow-xs"
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
