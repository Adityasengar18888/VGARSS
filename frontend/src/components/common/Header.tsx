import {
  Cpu,
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  ChevronDown,
} from 'lucide-react';
import { VirtualGroup } from '../../types/groups';
import { ConnectionStatus } from '../../types/network';

interface HeaderProps {
  groups: VirtualGroup[];
  selectedGroup: VirtualGroup | null;
  onSelectGroup: (group: VirtualGroup) => void;
  currentTick: number;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStep: () => void;
  onReset: () => void;
  speedMs: number;
  onSpeedChange: (speed: number) => void;
  simulationStatus?: string;
  wsStatus: ConnectionStatus;
  wsLatency: number | null;
  apiLatency: number | null;
  apiStatus: 'checking' | 'connected' | 'disconnected';
  onOpenNewGroupModal?: () => void;
}

export function Header({
  groups,
  selectedGroup,
  onSelectGroup,
  currentTick,
  isPlaying,
  onPlay,
  onPause,
  onStep,
  onReset,
  speedMs,
  onSpeedChange,
  simulationStatus = 'INITIALIZED',
  wsStatus,
  wsLatency,
  apiLatency,
  apiStatus,
  onOpenNewGroupModal,
}: HeaderProps) {
  return (
    <header className="border-b border-slate-800 bg-slate-900 sticky top-0 z-40 px-6 py-3 flex flex-wrap items-center justify-between gap-4">
      {/* Brand & Group Selector */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
            <Cpu className="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-base font-bold text-slate-100 tracking-tight">VGARSS</span>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-sky-400 border border-slate-700 font-semibold tabular-nums">
                v2.0
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-[65ch]">OS Simulation & Network Kernel</p>
          </div>
        </div>

        {/* Group Selector Dropdown */}
        <div className="relative group">
          <button
            type="button"
            aria-label="Select Virtual Group"
            className="min-h-[44px] flex items-center space-x-2 bg-slate-950 border border-slate-800 hover:border-slate-700 px-3 py-2 rounded-lg text-xs cursor-pointer focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none active:scale-[0.97]"
          >
            <span className="text-slate-400">Group:</span>
            <span className="font-semibold text-slate-200 max-w-[140px] truncate">
              {selectedGroup ? selectedGroup.name : 'Select Group'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
          </button>
          <div className="absolute left-0 mt-1 w-60 bg-slate-900 border border-slate-800 rounded-lg py-2 hidden group-hover:block z-50">
            <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono border-b border-slate-800">
              Virtual Groups
            </div>
            <div className="max-h-48 overflow-y-auto py-1">
              {groups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => onSelectGroup(g)}
                  className={`w-full min-h-[44px] text-left px-3 py-2 text-xs hover:bg-slate-800 flex items-center justify-between focus-visible:ring-2 focus-visible:ring-sky-500 active:scale-[0.97] ${
                    selectedGroup?.id === g.id ? 'text-sky-400 bg-slate-800/60 font-semibold' : 'text-slate-300'
                  }`}
                >
                  <span className="truncate">{g.name}</span>
                  {selectedGroup?.id === g.id && (
                    <span className="text-[10px] font-mono font-bold text-sky-400">[SELECTED]</span>
                  )}
                </button>
              ))}
              {groups.length === 0 && (
                <div className="px-3 py-3 text-xs text-slate-400">No groups available</div>
              )}
            </div>
            {onOpenNewGroupModal && (
              <div className="p-2 border-t border-slate-800">
                <button
                  onClick={onOpenNewGroupModal}
                  className="w-full min-h-[44px] text-center py-2 px-3 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 rounded-lg text-xs font-semibold focus-visible:ring-2 focus-visible:ring-sky-500 active:scale-[0.97]"
                >
                  + Create Virtual Group
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Center Clock & Simulation Toolbar */}
      <div className="flex items-center space-x-3 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1">
        {/* Discrete Clock Display */}
        <div className="flex items-center space-x-2 pr-3 border-r border-slate-800">
          <span className="text-xs font-mono uppercase text-slate-400 font-semibold">
            CLOCK
          </span>
          <div className="flex items-center bg-slate-900 px-2 py-1 rounded border border-slate-800 font-mono text-xs font-semibold text-sky-400 tabular-nums">
            <span>T={String(currentTick).padStart(4, '0')}</span>
          </div>
          <span
            className={`text-xs font-mono uppercase px-2 py-1 rounded font-semibold border tabular-nums ${
              simulationStatus === 'RUNNING'
                ? 'bg-slate-900 text-emerald-300 border-slate-700'
                : simulationStatus === 'COMPLETED'
                ? 'bg-slate-900 text-slate-400 border-slate-800'
                : simulationStatus === 'PAUSED'
                ? 'bg-slate-900 text-amber-300 border-slate-700'
                : 'bg-slate-900 text-sky-300 border-slate-700'
            }`}
          >
            {simulationStatus}
          </span>
        </div>

        {/* Action Controls (All 44px min touch targets & active:scale-[0.97]) */}
        <div className="flex items-center space-x-2" role="toolbar" aria-label="Simulation Controls">
          {isPlaying ? (
            <button
              onClick={onPause}
              title="Pause Simulation Clock"
              aria-label="Pause Simulation Clock"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 hover:bg-slate-800 text-amber-400 border border-slate-700 rounded-lg focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none active:scale-[0.97]"
            >
              <Pause className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onPlay}
              disabled={simulationStatus === 'COMPLETED'}
              title="Auto-run simulation clock"
              aria-label="Play Simulation Clock"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 hover:bg-slate-800 text-emerald-400 border border-slate-700 disabled:opacity-40 disabled:hover:bg-transparent rounded-lg focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none active:scale-[0.97]"
            >
              <Play className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={onStep}
            disabled={isPlaying || simulationStatus === 'COMPLETED'}
            title="Step simulation forward by exactly 1 tick"
            aria-label="Step simulation forward by 1 tick"
            className="min-h-[44px] px-3 flex items-center space-x-1.5 hover:bg-slate-800 text-sky-400 border border-slate-700 disabled:opacity-40 disabled:hover:bg-transparent rounded-lg text-xs font-mono font-semibold focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none active:scale-[0.97]"
          >
            <SkipForward className="w-4 h-4" />
            <span>+1 Tick</span>
          </button>

          <button
            onClick={onReset}
            title="Reset simulation clocks and queues"
            aria-label="Reset Simulation"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-lg focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none active:scale-[0.97]"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Speed Selector */}
        <div className="hidden md:flex items-center space-x-2 pl-3 border-l border-slate-800 text-xs">
          <span className="text-xs text-slate-400 font-mono">Speed:</span>
          <select
            value={speedMs}
            onChange={(e) => onSpeedChange(Number(e.target.value))}
            aria-label="Simulation Speed"
            className="min-h-[44px] bg-slate-900 border border-slate-800 text-slate-200 text-xs font-mono rounded-lg px-2 py-1 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
          >
            <option value={100}>10x (100ms)</option>
            <option value={250}>4x (250ms)</option>
            <option value={500}>2x (500ms)</option>
            <option value={1000}>1x (1.0s)</option>
            <option value={2000}>0.5x (2.0s)</option>
          </select>
        </div>
      </div>

      {/* Network & Infrastructure Health Badges (Dual-channel text + geometric status) */}
      <div className="flex items-center space-x-3 text-xs">
        {/* REST API */}
        <div
          title={`REST API: ${apiStatus} (${apiLatency !== null ? `${apiLatency}ms` : 'N/A'})`}
          className="min-h-[44px] flex items-center space-x-2 px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono text-xs tabular-nums"
        >
          <span className="font-semibold text-slate-400">API</span>
          <span className="text-slate-500">|</span>
          <span className={apiStatus === 'connected' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
            {apiStatus === 'connected' ? (apiLatency !== null ? `${apiLatency}ms` : 'OK') : 'OFFLINE'}
          </span>
        </div>

        {/* WebSocket */}
        <div
          title={`WebSocket Telemetry Stream: ${wsStatus}`}
          className="min-h-[44px] flex items-center space-x-2 px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono text-xs tabular-nums"
        >
          <span className="font-semibold text-slate-400">WS</span>
          <span className="text-slate-500">|</span>
          <span
            className={
              wsStatus === 'connected'
                ? 'text-emerald-400 font-bold'
                : wsStatus === 'reconnecting'
                ? 'text-amber-400 font-bold'
                : 'text-rose-400 font-bold'
            }
          >
            {wsStatus === 'connected' ? (wsLatency !== null ? `${wsLatency}ms` : 'OK') : wsStatus.toUpperCase()}
          </span>
        </div>

        {/* Raw TCP Port 9000 */}
        <div
          title="Raw TCP Socket Server on Port 9000"
          className="hidden lg:flex min-h-[44px] items-center space-x-2 px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono text-xs tabular-nums"
        >
          <span className="font-semibold text-slate-400">TCP:9000</span>
          <span className="text-slate-500">|</span>
          <span className="text-sky-400 font-bold">ONLINE</span>
        </div>
      </div>
    </header>
  );
}
