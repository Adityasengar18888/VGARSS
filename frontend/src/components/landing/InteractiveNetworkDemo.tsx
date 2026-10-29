import React, { useState } from 'react';
import { Send, CheckCircle2, ArrowRight, ShieldCheck, Cpu, Radio } from 'lucide-react';

export const InteractiveNetworkDemo: React.FC = () => {
  const [signalText, setSignalText] = useState('SYNC_RESOURCES_LOCK_MUTEX_0');
  const [stage, setStage] = useState<'idle' | 'framing' | 'routing' | 'persisted' | 'delivered'>('idle');
  const [metrics, setMetrics] = useState({ bytes: 48, rtt: 12, seq: 108 });

  const runSimulation = () => {
    if (stage !== 'idle') return;
    setStage('framing');
    setMetrics({ bytes: signalText.length + 32, rtt: Math.floor(10 + Math.random() * 8), seq: metrics.seq + 1 });

    setTimeout(() => {
      setStage('routing');
      setTimeout(() => {
        setStage('persisted');
        setTimeout(() => {
          setStage('delivered');
          setTimeout(() => setStage('idle'), 3500);
        }, 600);
      }, 700);
    }, 600);
  };

  return (
    <div className="border border-[#292929] bg-[#0C0C0C] rounded-md p-5 sm:p-7 font-mono">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-[#1E1E1E]">
        <div className="flex items-center space-x-2 text-xs text-[#A1A1A1]">
          <Radio className="w-3.5 h-3.5 text-[#E8E8E8]" />
          <span className="uppercase text-[10px] tracking-technical text-[#707070]">INTERACTIVE PACKET TRACER</span>
        </div>
        <div className="text-[11px] text-[#707070]">
          STATE:{' '}
          <span
            className={`uppercase font-bold ${
              stage === 'delivered' ? 'text-[#22C55E]' : stage === 'idle' ? 'text-[#707070]' : 'text-[#E8E8E8]'
            }`}
          >
            {stage}
          </span>
        </div>
      </div>

      {/* Signal Input Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-6">
        <div className="relative flex-1">
          <input
            type="text"
            value={signalText}
            onChange={(e) => setSignalText(e.target.value)}
            disabled={stage !== 'idle'}
            maxLength={40}
            className="w-full bg-[#141414] border border-[#292929] text-[#F2F2F2] px-3.5 py-2 rounded text-xs focus:border-[#E8E8E8] transition font-mono outline-none"
            placeholder="Enter payload string..."
          />
        </div>
        <button
          onClick={runSimulation}
          disabled={stage !== 'idle' || !signalText.trim()}
          className="flex items-center justify-center space-x-2 px-4 py-2 bg-[#E8E8E8] hover:bg-white text-[#080808] font-bold text-xs rounded transition active:scale-95 disabled:opacity-40"
        >
          <span>TRANSMIT</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Step Visualizer */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs mb-4">
        {/* Step 1: Encapsulation */}
        <div
          className={`p-3.5 rounded border transition-colors ${
            stage === 'framing'
              ? 'border-[#F2F2F2] bg-[#1A1A1A] text-[#F2F2F2]'
              : stage !== 'idle'
              ? 'border-[#222222] bg-[#111111] text-[#A1A1A1]'
              : 'border-[#1C1C1C] bg-[#0E0E0E] text-[#555555]'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5 text-[10px] text-[#707070]">
            <span>NODE 01</span>
            <Cpu className="w-3 h-3 text-[#A1A1A1]" />
          </div>
          <div className="font-bold text-[#F2F2F2] text-xs">CLIENT ENCAPSULATION</div>
          <div className="text-[10px] text-[#707070] mt-1 font-mono">Length: {metrics.bytes} Bytes</div>
        </div>

        {/* Step 2: Transport */}
        <div
          className={`p-3.5 rounded border transition-colors ${
            stage === 'routing'
              ? 'border-[#F2F2F2] bg-[#1A1A1A] text-[#F2F2F2]'
              : stage === 'persisted' || stage === 'delivered'
              ? 'border-[#222222] bg-[#111111] text-[#A1A1A1]'
              : 'border-[#1C1C1C] bg-[#0E0E0E] text-[#555555]'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5 text-[10px] text-[#707070]">
            <span>NODE 02</span>
            <ArrowRight className="w-3 h-3 text-[#A1A1A1]" />
          </div>
          <div className="font-bold text-[#F2F2F2] text-xs">WSS DISPATCH</div>
          <div className="text-[10px] text-[#707070] mt-1 font-mono">Stream: /ws/v2</div>
        </div>

        {/* Step 3: Server Engine */}
        <div
          className={`p-3.5 rounded border transition-colors ${
            stage === 'persisted'
              ? 'border-[#F2F2F2] bg-[#1A1A1A] text-[#F2F2F2]'
              : stage === 'delivered'
              ? 'border-[#222222] bg-[#111111] text-[#A1A1A1]'
              : 'border-[#1C1C1C] bg-[#0E0E0E] text-[#555555]'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5 text-[10px] text-[#707070]">
            <span>NODE 03</span>
            <ShieldCheck className="w-3 h-3 text-[#A1A1A1]" />
          </div>
          <div className="font-bold text-[#F2F2F2] text-xs">PERSISTENCE</div>
          <div className="text-[10px] text-[#707070] mt-1 font-mono">PostgreSQL Commit</div>
        </div>

        {/* Step 4: Peer Ingestion */}
        <div
          className={`p-3.5 rounded border transition-colors ${
            stage === 'delivered'
              ? 'border-[#22C55E] bg-[#152319] text-[#F2F2F2]'
              : 'border-[#1C1C1C] bg-[#0E0E0E] text-[#555555]'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5 text-[10px] text-[#707070]">
            <span>NODE 04</span>
            <CheckCircle2
              className={`w-3 h-3 ${stage === 'delivered' ? 'text-[#22C55E]' : 'text-[#555555]'}`}
            />
          </div>
          <div className="font-bold text-[#F2F2F2] text-xs">PEER ACKNOWLEDGED</div>
          <div className="text-[10px] text-[#707070] mt-1 font-mono">RTT: {metrics.rtt}ms</div>
        </div>
      </div>

      <div className="text-[10px] text-[#666666] flex items-center justify-between">
        <span>* Conceptual diagnostic demonstrator. Real message deliveries occur via authoritative backend sessions.</span>
        <span className="uppercase text-[#888888] font-mono">SEQ #{metrics.seq}</span>
      </div>
    </div>
  );
};
