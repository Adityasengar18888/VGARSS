import React, { useState, useEffect } from 'react';
import { Play, RotateCcw, Activity } from 'lucide-react';

interface AsciiNetworkArtProps {
  className?: string;
}

export const AsciiNetworkArt: React.FC<AsciiNetworkArtProps> = ({ className = '' }) => {
  const [activeStage, setActiveStage] = useState<number>(1);
  const [isTransmitting, setIsTransmitting] = useState<boolean>(false);
  const [packetSeq, setPacketSeq] = useState<number>(1042);
  const [latencyMs, setLatencyMs] = useState<number>(14);

  // Auto progression or manual interactive transmission
  useEffect(() => {
    if (isTransmitting) {
      const stepTime = 600;
      const t1 = setTimeout(() => setActiveStage(2), stepTime * 1);
      const t2 = setTimeout(() => setActiveStage(3), stepTime * 2);
      const t3 = setTimeout(() => setActiveStage(4), stepTime * 3);
      const t4 = setTimeout(() => {
        setActiveStage(5);
        setIsTransmitting(false);
        setPacketSeq((s) => s + 1);
      }, stepTime * 4);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(t4);
      };
    } else {
      // Gentle cyclical pulse when idle
      const interval = setInterval(() => {
        setActiveStage((prev) => (prev % 5) + 1);
      }, 2400);
      return () => clearInterval(interval);
    }
  }, [isTransmitting]);

  const handleTrigger = () => {
    if (isTransmitting) return;
    setActiveStage(1);
    setIsTransmitting(true);
    setLatencyMs(Math.floor(10 + Math.random() * 8));
  };

  return (
    <div className={`border border-[#292929] bg-[#0E0E0E] rounded-md p-5 sm:p-7 font-mono select-none ${className}`}>
      {/* Header telemetry bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-[#222222] text-xs">
        <div className="flex items-center space-x-2 text-[#A1A1A1]">
          <Activity className="w-3.5 h-3.5 text-[#E8E8E8]" />
          <span className="uppercase tracking-technical text-[10px] text-[#707070]">TOPOLOGY MAP</span>
          <span className="text-[#333333]">/</span>
          <span className="text-[#F2F2F2]">VGARSS-NET-ASCII::FRAME</span>
        </div>
        <div className="flex items-center space-x-4 text-[11px]">
          <span className="text-[#707070]">
            SEQ: <span className="text-[#E8E8E8]">#{packetSeq}</span>
          </span>
          <span className="text-[#707070]">
            RTT: <span className="text-[#22C55E]">{latencyMs}ms</span>
          </span>
          <button
            onClick={handleTrigger}
            disabled={isTransmitting}
            className="flex items-center space-x-1.5 px-2.5 py-1 bg-[#1A1A1A] hover:bg-[#252525] border border-[#292929] text-[#F2F2F2] rounded text-[10px] uppercase tracking-wider transition active:scale-95 disabled:opacity-50"
            title="Inject simulated test packet"
          >
            {isTransmitting ? (
              <>
                <RotateCcw className="w-3 h-3 animate-spin text-[#A1A1A1]" />
                <span>ROUTING...</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 text-[#E8E8E8]" />
                <span>TRANSMIT PACKET</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ASCII Architecture Flow Diagram */}
      <div className="overflow-x-auto py-2 text-xs leading-relaxed text-[#707070]">
        <pre className="inline-block whitespace-pre font-mono text-[11px] sm:text-xs">
{`
  ┌───────────────┐         ┌───────────────┐         ┌───────────────┐         ┌───────────────┐         ┌───────────────┐
  │   [01] USER   │  ====>  │  [02] SIGNAL  │  ====>  │   [03] NODE   │  ====>  │  [04] SERVER  │  ====>  │ [05] RECEIVER │
  │ SENDER CLIENT │         │ WEBSOCKET TX  │         │ ASYNC ROUTING │         │ PERSIST / ACK │         │ PEER RENDER   │
  └───────┬───────┘         └───────┬───────┘         └───────┬───────┘         └───────┬───────┘         └───────┬───────┘
          │                         │                         │                         │                         │
`}
        </pre>

        {/* Dynamic ASCII State Visualization */}
        <div className="grid grid-cols-5 gap-2 sm:gap-3 text-center my-2">
          {/* Node 1 */}
          <div
            className={`p-2.5 sm:p-3 border rounded transition-all duration-300 ${
              activeStage === 1
                ? 'border-[#F2F2F2] bg-[#1C1C1C] text-[#F2F2F2] shadow-sm'
                : 'border-[#222222] bg-[#121212] text-[#707070]'
            }`}
          >
            <div className="text-[10px] tracking-technical text-[#707070]">STAGE 01</div>
            <div className="text-xs font-bold text-[#F2F2F2] mt-0.5">ORIGIN</div>
            <div className="text-[10px] mt-1 font-mono text-[#A1A1A1]">Frame Encapsulated</div>
            <div className="mt-2 text-[9px] text-[#22C55E] flex items-center justify-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
              <span>P2P Ready</span>
            </div>
          </div>

          {/* Node 2 */}
          <div
            className={`p-2.5 sm:p-3 border rounded transition-all duration-300 ${
              activeStage === 2
                ? 'border-[#F2F2F2] bg-[#1C1C1C] text-[#F2F2F2] shadow-sm'
                : 'border-[#222222] bg-[#121212] text-[#707070]'
            }`}
          >
            <div className="text-[10px] tracking-technical text-[#707070]">STAGE 02</div>
            <div className="text-xs font-bold text-[#F2F2F2] mt-0.5">TRANSIT</div>
            <div className="text-[10px] mt-1 font-mono text-[#A1A1A1]">WSS Stream (80B)</div>
            <div className="mt-2 text-[9px] text-[#A1A1A1]">Ping: {latencyMs}ms</div>
          </div>

          {/* Node 3 */}
          <div
            className={`p-2.5 sm:p-3 border rounded transition-all duration-300 ${
              activeStage === 3
                ? 'border-[#F2F2F2] bg-[#1C1C1C] text-[#F2F2F2] shadow-sm'
                : 'border-[#222222] bg-[#121212] text-[#707070]'
            }`}
          >
            <div className="text-[10px] tracking-technical text-[#707070]">STAGE 03</div>
            <div className="text-xs font-bold text-[#F2F2F2] mt-0.5">HUB ROUTE</div>
            <div className="text-[10px] mt-1 font-mono text-[#A1A1A1]">Fanout Engine</div>
            <div className="mt-2 text-[9px] text-[#E8E8E8]">Seq #{packetSeq}</div>
          </div>

          {/* Node 4 */}
          <div
            className={`p-2.5 sm:p-3 border rounded transition-all duration-300 ${
              activeStage === 4
                ? 'border-[#F2F2F2] bg-[#1C1C1C] text-[#F2F2F2] shadow-sm'
                : 'border-[#222222] bg-[#121212] text-[#707070]'
            }`}
          >
            <div className="text-[10px] tracking-technical text-[#707070]">STAGE 04</div>
            <div className="text-xs font-bold text-[#F2F2F2] mt-0.5">AUTHORITY</div>
            <div className="text-[10px] mt-1 font-mono text-[#A1A1A1]">DB Persistence</div>
            <div className="mt-2 text-[9px] text-[#22C55E]">✓ Persisted</div>
          </div>

          {/* Node 5 */}
          <div
            className={`p-2.5 sm:p-3 border rounded transition-all duration-300 ${
              activeStage === 5
                ? 'border-[#F2F2F2] bg-[#1C1C1C] text-[#F2F2F2] shadow-sm'
                : 'border-[#222222] bg-[#121212] text-[#707070]'
            }`}
          >
            <div className="text-[10px] tracking-technical text-[#707070]">STAGE 05</div>
            <div className="text-xs font-bold text-[#F2F2F2] mt-0.5">RECEIPT</div>
            <div className="text-[10px] mt-1 font-mono text-[#A1A1A1]">Peer ACK Dispatched</div>
            <div className="mt-2 text-[9px] text-[#22C55E]">✓✓ DELIVERED</div>
          </div>
        </div>

        <pre className="inline-block whitespace-pre font-mono text-[11px] sm:text-xs text-[#555555] mt-1">
{`  └───────────────────────────────────────────────────────────────────────────────────────────────────┘
   [DIAGNOSTIC] TCP Port: 9000 (Raw Framing) | WS Route: /ws/v2 | Protocol: VGARSS Binary/JSON Framing`}
        </pre>
      </div>

      {/* Technical Disclaimer Annotation */}
      <div className="mt-3 pt-3 border-t border-[#1C1C1C] flex flex-col sm:flex-row items-start sm:items-center justify-between text-[11px] text-[#707070] gap-2">
        <p className="max-w-2xl">
          <strong className="text-[#A1A1A1]">Note:</strong> This ASCII diagram is an illustrative representation of
          logical packet encapsulation, client-server WebSocket transport, and synchronous delivery acknowledgement.
        </p>
        <span className="text-[#555555] text-[10px] uppercase font-mono tracking-wider shrink-0">
          STATUS: ONLINE • SYNC MONITORED
        </span>
      </div>
    </div>
  );
};
