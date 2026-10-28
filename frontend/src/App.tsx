import { useState, useEffect } from 'react';
import {
  Activity,
  Cpu,
  Network,
  ShieldCheck,
  Server,
  RefreshCw,
  Terminal,
  Lock,
  Layers,
  CheckCircle2,
  PlayCircle,
  PauseCircle,
  RotateCcw
} from 'lucide-react';

interface HealthData {
  status: string;
  version: string;
  timestamp: string;
  environment: string;
  ports: {
    rest_api: number;
    websocket: number;
    raw_tcp: number;
  };
}

export default function App() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [apiLatency, setApiLatency] = useState<number | null>(null);
  const [apiStatus, setApiStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [wsLogs, setWsLogs] = useState<string[]>([]);
  const [selectedAlgo, setSelectedAlgo] = useState<string>('ROUND_ROBIN');

  // Check Backend Health
  const checkHealth = async () => {
    setApiStatus('checking');
    const startTime = performance.now();
    try {
      const res = await fetch('http://127.0.0.1:8000/api/v1/health');
      const latency = Math.round(performance.now() - startTime);
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
        setApiLatency(latency);
        setApiStatus('connected');
      } else {
        setApiStatus('disconnected');
      }
    } catch {
      setApiStatus('disconnected');
      setApiLatency(null);
    }
  };

  // Connect WebSocket
  useEffect(() => {
    checkHealth();
    let socket: WebSocket | null = null;
    try {
      socket = new WebSocket('ws://127.0.0.1:8000/ws');
      socket.onopen = () => {
        setWsStatus('connected');
        setWsLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] WebSocket Handshake Succeeded (/ws)`]);
      };
      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          setWsLogs((prev) => [...prev.slice(-8), `[${new Date().toLocaleTimeString()}] Telemetry: ${msg.event || 'DATA'}`]);
        } catch {
          setWsLogs((prev) => [...prev.slice(-8), `[${new Date().toLocaleTimeString()}] Raw: ${event.data}`]);
        }
      };
      socket.onerror = () => {
        setWsStatus('disconnected');
      };
      socket.onclose = () => {
        setWsStatus('disconnected');
      };
    } catch {
      setWsStatus('disconnected');
    }

    return () => {
      if (socket) socket.close();
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-50 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-semibold tracking-tight text-white">VGARSS</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800">
                {health ? `${health.environment} (v${health.version})` : 'v0.1.0-dev'}
              </span>
            </div>
            <p className="text-xs text-slate-400">Virtual Group Resource Synchronization & Scheduling</p>
          </div>
        </div>

        {/* Live Service Indicators */}
        <div className="flex items-center space-x-4 text-xs font-mono">
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-md bg-slate-900 border border-slate-800">
            <Server className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">REST API:</span>
            <span
              className={`flex items-center space-x-1 ${
                apiStatus === 'connected' ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  apiStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span>{apiStatus === 'connected' ? `ONLINE (${apiLatency}ms)` : 'CHECKING'}</span>
            </span>
          </div>

          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-md bg-slate-900 border border-slate-800">
            <Network className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">WebSocket:</span>
            <span
              className={`flex items-center space-x-1 ${
                wsStatus === 'connected' ? 'text-emerald-400' : 'text-slate-400'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  wsStatus === 'connected' ? 'bg-emerald-400' : 'bg-slate-500'
                }`}
              />
              <span className="uppercase">{wsStatus}</span>
            </span>
          </div>

          <button
            onClick={checkHealth}
            className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            title="Refresh Health Diagnostics"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Environment Readiness Banner */}
        <div className="rounded-xl border border-emerald-900/40 bg-gradient-to-r from-emerald-950/30 via-slate-900/60 to-cyan-950/30 p-5 backdrop-blur shadow-sm">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h2 className="text-base font-semibold text-emerald-300">
                  Antigravity Development Environment Initialized
                </h2>
              </div>
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                All development prerequisites (Node 22 LTS, Python 3.12, Git 2.50, Vite, Tailwind CSS, FastAPI, and Antigravity Skills) are configured and operational.
              </p>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-emerald-950/80 text-emerald-300 border border-emerald-700">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>PHASES 1–7 READY</span>
              </span>
            </div>
          </div>
        </div>

        {/* Diagnostic Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Node & Network Ports */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
            <div className="flex items-center space-x-2 text-cyan-400 text-sm font-semibold">
              <Network className="w-4 h-4" />
              <h3>Network Communication Stack</h3>
            </div>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between items-center py-1.5 px-2.5 rounded bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-400">REST API Server</span>
                <span className="text-cyan-400 font-semibold">Port 8000 (HTTP)</span>
              </div>
              <div className="flex justify-between items-center py-1.5 px-2.5 rounded bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-400">WebSocket Telemetry</span>
                <span className="text-cyan-400 font-semibold">Port 8000 (/ws)</span>
              </div>
              <div className="flex justify-between items-center py-1.5 px-2.5 rounded bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-400">Raw TCP Socket Server</span>
                <span className="text-indigo-400 font-semibold">Port 9000 (Framed)</span>
              </div>
            </div>
          </div>

          {/* OS Scheduling Engines */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
            <div className="flex items-center space-x-2 text-amber-400 text-sm font-semibold">
              <Layers className="w-4 h-4" />
              <h3>OS Scheduling Core</h3>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="grid grid-cols-2 gap-2">
                {['ROUND_ROBIN', 'FCFS', 'SJF_NON_PREEMPTIVE', 'SRTF_PREEMPTIVE', 'PRIORITY'].map((algo) => (
                  <button
                    key={algo}
                    onClick={() => setSelectedAlgo(algo)}
                    className={`py-1.5 px-2 rounded border text-left font-mono transition-colors cursor-pointer text-[11px] ${
                      selectedAlgo === algo
                        ? 'border-amber-500 bg-amber-950/40 text-amber-300 font-semibold'
                        : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {algo}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Concurrency & Sync */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
            <div className="flex items-center space-x-2 text-rose-400 text-sm font-semibold">
              <Lock className="w-4 h-4" />
              <h3>Synchronization & Deadlock</h3>
            </div>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between items-center py-1.5 px-2.5 rounded bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-400">Mutex Primitives</span>
                <span className="text-emerald-400">Supported (Binary)</span>
              </div>
              <div className="flex justify-between items-center py-1.5 px-2.5 rounded bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-400">Counting Semaphores</span>
                <span className="text-emerald-400">Supported (K tokens)</span>
              </div>
              <div className="flex justify-between items-center py-1.5 px-2.5 rounded bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-400">Deadlock Detection</span>
                <span className="text-rose-400">Cycle Detection (RAG)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Simulation Sandbox Preview */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-white font-medium text-sm">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>Simulation Kernel Control Toolbar</span>
            </div>
            <div className="flex items-center space-x-2 text-xs font-mono">
              <span className="text-slate-400">Current Strategy:</span>
              <span className="text-cyan-400 font-semibold">{selectedAlgo}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center space-x-3 pt-1">
            <button
              onClick={() => alert('Simulation Kernel initialized. Full execution engine ready for Phase 8.')}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition cursor-pointer shadow-sm shadow-cyan-600/30"
            >
              <PlayCircle className="w-4 h-4" />
              <span>Start Simulation</span>
            </button>
            <button
              onClick={() => alert('Step action triggered.')}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer"
            >
              <PauseCircle className="w-4 h-4" />
              <span>Step Tick (1 unit)</span>
            </button>
            <button
              onClick={() => alert('State reset triggered.')}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset Queues</span>
            </button>
          </div>

          {/* Process Queue State Preview */}
          <div className="grid grid-cols-5 gap-3 pt-2 text-xs">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-sky-400 font-mono text-[11px] font-semibold">1. NEW</span>
              <p className="text-slate-400 text-[11px]">Admitted processes awaiting scheduling pool.</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-amber-400 font-mono text-[11px] font-semibold">2. READY</span>
              <p className="text-slate-400 text-[11px]">In Ready Queue awaiting CPU dispatch.</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-emerald-400 font-mono text-[11px] font-semibold">3. RUNNING</span>
              <p className="text-slate-400 text-[11px]">Currently executing on simulated CPU.</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-rose-400 font-mono text-[11px] font-semibold">4. WAITING</span>
              <p className="text-slate-400 text-[11px]">Blocked on Mutex or Semaphore.</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-400 font-mono text-[11px] font-semibold">5. TERMINATED</span>
              <p className="text-slate-400 text-[11px]">Completed execution with metrics logged.</p>
            </div>
          </div>
        </div>

        {/* Telemetry Console */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-2">
          <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span>Telemetry & Event Log</span>
          </div>
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 font-mono text-xs text-slate-400 space-y-1 min-h-[90px]">
            {wsLogs.length === 0 ? (
              <div className="text-slate-500 italic">Awaiting network telemetry events...</div>
            ) : (
              wsLogs.map((log, idx) => (
                <div key={idx} className="text-emerald-400/90">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-3 px-6 text-center text-xs text-slate-500">
        VGARSS &copy; 2026 &mdash; Computer Networks &amp; Operating Systems Systems Engineering Platform
      </footer>
    </div>
  );
}
