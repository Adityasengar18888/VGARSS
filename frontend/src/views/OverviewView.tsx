import { Card } from '../components/common/Card';
import { GanttChart } from '../components/gantt/GanttChart';
import { QueueSwimlanes } from '../components/queues/QueueSwimlanes';
import { SimulationResponse, SimulationMetrics, GanttEntry } from '../types/simulation';
import { ProcessControlBlock } from '../types/process';
import { ResourceStatus } from '../types/resources';
import { NetworkTelemetryEvent } from '../types/network';

interface OverviewViewProps {
  simulation: SimulationResponse | null;
  metrics: SimulationMetrics;
  currentTick: number;
  ganttHistory: GanttEntry[];
  processes: ProcessControlBlock[];
  readyQueue: string[];
  waitingQueue: string[];
  runningProcessId: string | null;
  resources: ResourceStatus[];
  recentEvents: NetworkTelemetryEvent[];
  onNavigateToScheduler: () => void;
}

export function OverviewView({
  simulation,
  metrics,
  currentTick,
  ganttHistory,
  processes,
  readyQueue,
  waitingQueue,
  runningProcessId,
  resources,
  recentEvents,
  onNavigateToScheduler,
}: OverviewViewProps) {
  const runningCount = runningProcessId ? 1 : 0;
  const readyCount = readyQueue.length;
  const waitingCount = waitingQueue.length;
  const terminatedCount = processes.filter((p) => p.state === 'TERMINATED').length;

  return (
    <div className="space-y-6">
      {/* Top Section Header (One Singular Focal Point: Kernel Infrastructure State) */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">System Infrastructure Overview</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-[65ch]">
            Real-time operating system kernel state, process execution queues, and hardware utilization.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs font-mono text-slate-400">Active Algorithm:</span>
          <span className="text-xs font-bold font-mono px-3 py-1.5 rounded-lg bg-slate-900 text-sky-400 border border-slate-700">
            {simulation ? simulation.algorithm : 'ROUND_ROBIN'}
          </span>
        </div>
      </div>

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1: Active Processes */}
        <Card className="flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase font-mono tracking-wider">Processes</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-slate-100 tracking-tight tabular-nums">
              {processes.length}
            </div>
            <div className="flex items-center space-x-2 mt-2 text-[10px] font-mono tabular-nums">
              <span className="text-emerald-400 font-bold">{runningCount} Run</span>
              <span className="text-slate-600">|</span>
              <span className="text-amber-400 font-bold">{readyCount} Rdy</span>
              <span className="text-slate-600">|</span>
              <span className="text-rose-400 font-bold">{waitingCount} Wait</span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400 font-bold">{terminatedCount} Done</span>
            </div>
          </div>
        </Card>

        {/* KPI 2: CPU Utilization */}
        <Card className="flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase font-mono tracking-wider">CPU Utilization</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-emerald-400 tracking-tight tabular-nums">
              {metrics.cpu_utilization.toFixed(1)}%
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-2">
              <div
                className="bg-emerald-400 h-full rounded-full"
                style={{ width: `${Math.min(100, metrics.cpu_utilization)}%` }}
              />
            </div>
          </div>
        </Card>

        {/* KPI 3: Average Waiting Time */}
        <Card className="flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase font-mono tracking-wider">Avg Waiting Time</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-slate-100 tracking-tight tabular-nums">
              {metrics.avg_waiting_time.toFixed(2)}
              <span className="text-xs font-normal text-slate-400 ml-1">ticks</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 font-mono max-w-[65ch]">Normalized queue latency</p>
          </div>
        </Card>

        {/* KPI 4: Avg Turnaround Time */}
        <Card className="flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase font-mono tracking-wider">Avg Turnaround</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-slate-100 tracking-tight tabular-nums">
              {metrics.avg_turnaround_time.toFixed(2)}
              <span className="text-xs font-normal text-slate-400 ml-1">ticks</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 font-mono max-w-[65ch]">Arrival to completion duration</p>
          </div>
        </Card>

        {/* KPI 5: Throughput */}
        <Card className="flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase font-mono tracking-wider">Throughput</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-sky-400 tracking-tight tabular-nums">
              {metrics.throughput.toFixed(3)}
              <span className="text-xs font-normal text-slate-400 ml-1">p/tick</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 font-mono tabular-nums max-w-[65ch]">
              {terminatedCount} completed / {metrics.total_ticks} ticks
            </p>
          </div>
        </Card>
      </div>

      {/* Live Queue Swimlanes */}
      <QueueSwimlanes
        processes={processes}
        readyQueueIds={readyQueue}
        waitingQueueIds={waitingQueue}
        runningProcessId={runningProcessId}
      />

      {/* Mini-Gantt Timeline Preview */}
      <Card
        title="Live Gantt Execution Timeline"
        subtitle="Real-time CPU execution intervals and process state transitions"
        actions={
          <button
            onClick={onNavigateToScheduler}
            className="min-h-[44px] px-3 py-2 text-xs font-mono text-sky-400 hover:text-sky-300 font-semibold active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
          >
            Open Full Scheduler →
          </button>
        }
      >
        <GanttChart entries={ganttHistory} processes={processes} currentTick={currentTick} />
      </Card>

      {/* Bottom Grid: Shared Resources & Recent Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Resource Locks */}
        <Card
          title="Shared Synchronization Resources"
          subtitle="Real-time mutex lock ownership and counting semaphore capacity"
        >
          <div className="space-y-3">
            {resources.map((res) => {
              const isLocked = res.type === 'MUTEX' && res.exclusive_holder !== null;
              return (
                <div
                  key={res.id}
                  className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between"
                >
                  <div>
                    <p className="text-xs font-bold text-slate-200">{res.name}</p>
                    <p className="text-[10px] font-mono text-slate-400">
                      Type: {res.type} | ID: {res.id}
                    </p>
                  </div>

                  <div className="text-right">
                    {res.type === 'MUTEX' ? (
                      <div>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
                            isLocked
                              ? 'bg-slate-900 text-amber-300 border-amber-800'
                              : 'bg-slate-900 text-emerald-300 border-emerald-800'
                          }`}
                        >
                          {isLocked ? `LOCKED (${res.exclusive_holder})` : 'UNLOCKED'}
                        </span>
                        {res.wait_queue.length > 0 && (
                          <p className="text-[10px] text-rose-400 font-mono mt-1">
                            Waiters: {res.wait_queue.join(', ')}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div>
                        <span className="text-xs font-mono font-bold text-slate-200 tabular-nums">
                          {res.available_units} / {res.total_capacity} Tokens
                        </span>
                        <div className="w-24 bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
                          <div
                            className="bg-sky-400 h-full rounded-full"
                            style={{ width: `${(res.available_units / res.total_capacity) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {resources.length === 0 && (
              <div className="py-6 text-center text-xs text-slate-400 font-medium">
                No active shared resources in this simulation.
              </div>
            )}
          </div>
        </Card>

        {/* Real-Time Telemetry Stream */}
        <Card
          title="Telemetry Event Stream"
          subtitle="Authenticated WebSocket events and sequence updates"
        >
          <div className="space-y-2 font-mono text-xs overflow-y-auto max-h-56 pr-1">
            {recentEvents.slice(-6).map((ev, i) => (
              <div
                key={i}
                className="p-2 bg-slate-950 border border-slate-800 rounded flex items-center justify-between text-[11px]"
              >
                <div className="flex items-center space-x-2 truncate">
                  <span className="text-sky-400 font-bold shrink-0 tabular-nums">#{ev.seq || '—'}</span>
                  <span className="text-slate-300 font-semibold truncate">{ev.type}</span>
                </div>
                <span className="text-slate-500 text-[10px] shrink-0 tabular-nums">
                  {new Date(ev.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
            {recentEvents.length === 0 && (
              <div className="py-6 text-center text-xs text-slate-400 font-medium">
                Awaiting telemetry frames...
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
