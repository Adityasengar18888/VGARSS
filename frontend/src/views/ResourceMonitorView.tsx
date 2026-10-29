import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Card } from '../components/common/Card';
import { ResourceStatus } from '../types/resources';
import { ProcessControlBlock } from '../types/process';
import { api } from '../services/api';
import { ErrorState } from '../components/common/States';

interface ResourceMonitorViewProps {
  resources: ResourceStatus[];
  processes: ProcessControlBlock[];
  groupId: string | null;
  simId: string | null;
  onRefreshResources: () => void;
}

export function ResourceMonitorView({
  resources,
  processes,
  groupId,
  simId,
  onRefreshResources,
}: ResourceMonitorViewProps) {
  const [selectedPid, setSelectedPid] = useState<string>(processes[0]?.id || 'P1');
  const [selectedResId, setSelectedResId] = useState<string>(resources[0]?.id || 'R1');
  const [mode, setMode] = useState<'EXCLUSIVE' | 'SHARED'>('EXCLUSIVE');
  const [units, setUnits] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLog, setActionLog] = useState<{ time: string; msg: string; status: 'ok' | 'err' }[]>([]);

  const handleAcquire = async () => {
    if (!groupId || !simId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.acquireResource(groupId, simId, {
        process_id: selectedPid,
        resource_id: selectedResId,
        mode,
        units,
      });
      const logMsg = res.granted
        ? `[GRANTED] Process ${selectedPid} acquired ${units} unit(s) of ${selectedResId}`
        : `[BLOCKED] Process ${selectedPid} blocked on ${selectedResId} (entered waiting queue)`;
      setActionLog((prev) => [
        { time: new Date().toLocaleTimeString(), msg: logMsg, status: res.granted ? 'ok' : 'err' },
        ...prev.slice(0, 19),
      ]);
      onRefreshResources();
    } catch (err: any) {
      setError(err.message || 'Acquisition failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRelease = async () => {
    if (!groupId || !simId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.releaseResource(groupId, simId, {
        process_id: selectedPid,
        resource_id: selectedResId,
        units,
      });
      const logMsg = `[RELEASED] Process ${selectedPid} released ${selectedResId}. Awakened: [${res.awakened_processes.join(
        ', '
      ) || 'none'}]`;
      setActionLog((prev) => [
        { time: new Date().toLocaleTimeString(), msg: logMsg, status: 'ok' },
        ...prev.slice(0, 19),
      ]);
      onRefreshResources();
    } catch (err: any) {
      setError(err.message || 'Release failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#202631] tracking-tight">Concurrency & Resource Synchronization</h2>
          <p className="text-xs text-[#667085] mt-1 max-w-[65ch]">
            Mutex mutual exclusion, counting semaphore limits, atomic acquisition, and critical section ownership.
          </p>
        </div>
        <button
          onClick={onRefreshResources}
          className="min-h-[44px] px-4 py-2 bg-white hover:bg-slate-50 text-[#202631] border border-[#E4E7EC] rounded-lg text-xs font-mono font-semibold flex items-center space-x-2 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-[#4055A8] focus-visible:outline-none shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[#4055A8]" />
          <span>Refresh Allocation State</span>
        </button>
      </div>

      {error && <ErrorState message={error} onRetry={() => setError(null)} />}

      {/* Reworked Section: Replaced 3-column card grid with structured list/table layout */}
      <Card
        title="Active Shared Resources"
        subtitle="Mutex locks and counting semaphores with holder registration and waiting queues"
      >
        <div className="space-y-3">
          {resources.map((res) => {
            const isMutex = res.type === 'MUTEX';
            const isLocked = isMutex && res.exclusive_holder !== null;

            return (
              <div
                key={res.id}
                className={`p-4 rounded-lg border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                  isLocked ? 'border-amber-300 bg-[#FFFDF7]' : 'border-[#E4E7EC] bg-white'
                }`}
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-sm font-bold text-[#202631]">{res.name}</h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded font-semibold bg-[#F5F6F8] text-[#4055A8] border border-[#E4E7EC]">
                      TYPE: {res.type}
                    </span>
                    <span className="text-[10px] font-mono text-[#667085]">ID: {res.id}</span>
                  </div>

                  {isMutex ? (
                    <div className="flex items-center space-x-4 text-xs font-mono text-[#667085] pt-1">
                      <span>
                        HOLDER:{' '}
                        <strong className="text-[#202631]">
                          {res.exclusive_holder ? res.exclusive_holder : 'NONE (AVAILABLE)'}
                        </strong>
                      </span>
                      <span>ORDER RANK: {res.order_rank}</span>
                    </div>
                  ) : (
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center space-x-3 text-xs font-mono">
                        <span className="text-[#667085]">TOKENS:</span>
                        <span className="font-bold text-[#4055A8] tabular-nums">
                          {res.available_units} / {res.total_capacity} AVAILABLE
                        </span>
                      </div>
                      <div className="w-48 bg-slate-100 h-2 rounded-full overflow-hidden border border-[#E4E7EC]">
                        <div
                          className="bg-[#4055A8] h-full rounded-full transition-all"
                          style={{ width: `${(res.available_units / res.total_capacity) * 100}%` }}
                        />
                      </div>
                      {res.shared_holders.length > 0 && (
                        <div className="text-[11px] text-[#667085] font-mono">
                          SHARED HOLDERS: {res.shared_holders.join(', ')}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Waiters Queue */}
                  <div className="flex items-center space-x-2 pt-2 text-xs font-mono">
                    <span className="text-[#667085] font-semibold">WAIT QUEUE:</span>
                    {res.wait_queue.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {res.wait_queue.map((w) => (
                          <span
                            key={w}
                            className="px-2 py-0.5 rounded bg-rose-50 text-[#C0393A] border border-rose-200 text-[10px] font-bold"
                          >
                            {w}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[#667085]">NONE</span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <span
                    className={`inline-block text-xs font-mono px-3 py-1.5 rounded-lg font-bold border ${
                      isMutex
                        ? isLocked
                          ? 'bg-amber-50 text-[#B7791F] border-amber-200'
                          : 'bg-emerald-50 text-[#16805D] border-emerald-200'
                        : 'bg-[#F5F6F8] text-[#4055A8] border-[#E4E7EC]'
                    }`}
                  >
                    {isMutex ? (isLocked ? `LOCKED (${res.exclusive_holder})` : 'UNLOCKED') : `${res.available_units} TOKENS FREE`}
                  </span>
                </div>
              </div>
            );
          })}

          {resources.length === 0 && (
            <div className="py-8 text-center text-xs text-[#667085]">
              No shared resources defined for the active simulation. Load the Circular Wait or Priority preset in Process Scheduler.
            </div>
          )}
        </div>
      </Card>

      {/* Interactive Resource Operation Control Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          title="Interactive Synchronization Terminal"
          subtitle="Directly test race conditions, atomic lock grants, and blocked waiting states"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-[#202631] font-mono mb-1 font-semibold">Process ID</label>
                <select
                  value={selectedPid}
                  onChange={(e) => setSelectedPid(e.target.value)}
                  className="w-full min-h-[44px] bg-white border border-[#E4E7EC] rounded-lg px-3 py-2 text-[#202631] font-mono focus-visible:ring-2 focus-visible:ring-[#4055A8] focus-visible:outline-none shadow-sm"
                >
                  {processes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id} ({p.state})
                    </option>
                  ))}
                  {processes.length === 0 && <option value="P1">P1</option>}
                </select>
              </div>

              <div>
                <label className="block text-[#202631] font-mono mb-1 font-semibold">Resource</label>
                <select
                  value={selectedResId}
                  onChange={(e) => setSelectedResId(e.target.value)}
                  className="w-full min-h-[44px] bg-white border border-[#E4E7EC] rounded-lg px-3 py-2 text-[#202631] font-mono focus-visible:ring-2 focus-visible:ring-[#4055A8] focus-visible:outline-none shadow-sm"
                >
                  {resources.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.type})
                    </option>
                  ))}
                  {resources.length === 0 && <option value="R1">R1</option>}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-[#202631] font-mono mb-1 font-semibold">Lock Mode</label>
                <select
                  value={mode}
                  onChange={(e: any) => setMode(e.target.value)}
                  className="w-full min-h-[44px] bg-white border border-[#E4E7EC] rounded-lg px-3 py-2 text-[#202631] font-mono focus-visible:ring-2 focus-visible:ring-[#4055A8] focus-visible:outline-none shadow-sm"
                >
                  <option value="EXCLUSIVE">EXCLUSIVE (Mutex Write Lock)</option>
                  <option value="SHARED">SHARED (Read Lock)</option>
                </select>
              </div>

              <div>
                <label className="block text-[#202631] font-mono mb-1 font-semibold">Units (Tokens)</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={units}
                  onChange={(e) => setUnits(Number(e.target.value))}
                  className="w-full min-h-[44px] bg-white border border-[#E4E7EC] rounded-lg px-3 py-2 text-[#202631] font-mono focus-visible:ring-2 focus-visible:ring-[#4055A8] focus-visible:outline-none shadow-sm"
                />
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                onClick={handleAcquire}
                disabled={loading}
                className="flex-1 min-h-[44px] py-2 px-4 bg-[#4055A8] hover:bg-[#34468B] text-white rounded-lg text-xs font-semibold disabled:opacity-50 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-[#4055A8] focus-visible:outline-none shadow-sm"
              >
                Acquire Lock / Token
              </button>
              <button
                onClick={handleRelease}
                disabled={loading}
                className="flex-1 min-h-[44px] py-2 px-4 bg-white hover:bg-slate-50 text-[#202631] rounded-lg text-xs font-semibold border border-[#E4E7EC] disabled:opacity-50 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-[#4055A8] focus-visible:outline-none shadow-sm"
              >
                Release Resource
              </button>
            </div>
          </div>
        </Card>

        {/* Lock Operation Log */}
        <Card title="Synchronization Audit Trail" subtitle="Recent acquisition, block, and release operations">
          <div className="space-y-2 font-mono text-xs overflow-y-auto max-h-56 pr-1">
            {actionLog.map((item, idx) => (
              <div
                key={idx}
                className="p-2 bg-[#F8F9FB] border border-[#E4E7EC] rounded flex items-center justify-between text-[11px]"
              >
                <div className="flex items-center space-x-2 truncate">
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      item.status === 'ok'
                        ? 'bg-emerald-50 text-[#16805D] border border-emerald-200'
                        : 'bg-rose-50 text-[#C0393A] border border-rose-200'
                    }`}
                  >
                    {item.status === 'ok' ? 'OK' : 'ERR'}
                  </span>
                  <span className="text-[#202631] truncate">{item.msg}</span>
                </div>
                <span className="text-[#667085] text-[10px] shrink-0 ml-2 tabular-nums">{item.time}</span>
              </div>
            ))}
            {actionLog.length === 0 && (
              <div className="py-8 text-center text-xs text-[#667085]">
                Perform an acquire or release operation to inspect synchronization state transitions.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
