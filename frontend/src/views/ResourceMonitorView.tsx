import { useState } from 'react';
import { Card } from '../components/common/Card';
import { ResourceStatus } from '../types/resources';
import { ProcessControlBlock } from '../types/process';
import { api } from '../services/api';
import { RefreshCw } from 'lucide-react';
import { ErrorState } from '../components/common/States';

interface ResourceMonitorViewProps {
  groupId: string | null;
  simId: string | null;
  resources: ResourceStatus[];
  processes: ProcessControlBlock[];
  onRefreshResources: () => void;
}

export function ResourceMonitorView({
  groupId,
  simId,
  resources,
  processes,
  onRefreshResources,
}: ResourceMonitorViewProps) {
  const [selectedPid, setSelectedPid] = useState<string>(processes[0]?.id || 'P1');
  const [selectedResId, setSelectedResId] = useState<string>(resources[0]?.id || 'R1');
  const [mode, setMode] = useState<'EXCLUSIVE' | 'SHARED'>('EXCLUSIVE');
  const [units, setUnits] = useState<number>(1);
  const [actionLog, setActionLog] = useState<Array<{ msg: string; status: 'ok' | 'err'; time: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAcquire = async () => {
    if (!groupId || !simId) {
      setError('Active workspace simulation not found. Create or select a simulation in Process Scheduler.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.acquireResource(groupId, simId, {
        process_id: selectedPid,
        resource_id: selectedResId,
        mode,
        units,
      });
      const logEntry = {
        msg: `${selectedPid} acquired ${selectedResId} (${mode}) → ${res.status}`,
        status: (res.status === 'BLOCKED' ? 'err' : 'ok') as 'ok' | 'err',
        time: new Date().toLocaleTimeString(),
      };
      setActionLog((prev) => [logEntry, ...prev.slice(0, 19)]);
      onRefreshResources();
    } catch (e: any) {
      setError(e.message || 'Acquisition failed.');
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
      });
      const logEntry = {
        msg: `${selectedPid} released ${selectedResId} → Next: ${res.awakened_processes?.join(', ') || 'None'}`,
        status: 'ok' as const,
        time: new Date().toLocaleTimeString(),
      };
      setActionLog((prev) => [logEntry, ...prev.slice(0, 19)]);
      onRefreshResources();
    } catch (e: any) {
      setError(e.message || 'Release failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 font-mono">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#F2F2F2] tracking-tight font-sans">Concurrency & Resource Synchronization</h2>
          <p className="text-xs text-[#A1A1A1] mt-1 max-w-[65ch]">
            Mutex mutual exclusion, counting semaphore limits, atomic acquisition, and critical section ownership.
          </p>
        </div>
        <button
          onClick={onRefreshResources}
          className="min-h-[40px] px-3.5 py-2 bg-[#141414] hover:bg-[#1E1E1E] text-[#F2F2F2] border border-[#292929] rounded-[3px] text-xs font-mono font-semibold flex items-center space-x-2 active:scale-95 shadow-xs"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[#E8E8E8]" />
          <span>Refresh State</span>
        </button>
      </div>

      {error && <ErrorState message={error} onRetry={() => setError(null)} />}

      {/* Shared Resources List */}
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
                className={`p-4 rounded-[3px] border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                  isLocked ? 'border-[#423018] bg-[#1E180E]' : 'border-[#292929] bg-[#141414]'
                }`}
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-sm font-bold text-[#F2F2F2]">{res.name}</h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-[2px] font-semibold bg-[#1C1C1C] text-[#E8E8E8] border border-[#333333]">
                      TYPE: {res.type}
                    </span>
                    <span className="text-[10px] font-mono text-[#707070]">ID: {res.id}</span>
                  </div>

                  {isMutex ? (
                    <div className="flex items-center space-x-4 text-xs font-mono text-[#A1A1A1] pt-1">
                      <span>
                        HOLDER:{' '}
                        <strong className="text-[#F2F2F2]">
                          {res.exclusive_holder ? res.exclusive_holder : 'NONE (AVAILABLE)'}
                        </strong>
                      </span>
                      <span>ORDER RANK: {res.order_rank}</span>
                    </div>
                  ) : (
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center space-x-3 text-xs font-mono">
                        <span className="text-[#A1A1A1]">TOKENS:</span>
                        <span className="font-bold text-[#22C55E] tabular-nums">
                          {res.available_units} / {res.total_capacity} AVAILABLE
                        </span>
                      </div>
                      <div className="w-48 bg-[#0E0E0E] h-1.5 rounded-full overflow-hidden border border-[#292929]">
                        <div
                          className="bg-[#22C55E] h-full rounded-full transition-all"
                          style={{ width: `${(res.available_units / res.total_capacity) * 100}%` }}
                        />
                      </div>
                      {res.shared_holders.length > 0 && (
                        <div className="text-[11px] text-[#A1A1A1] font-mono">
                          SHARED HOLDERS: {res.shared_holders.join(', ')}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Waiters Queue */}
                  <div className="flex items-center space-x-2 pt-2 text-xs font-mono">
                    <span className="text-[#707070] font-semibold">WAIT QUEUE:</span>
                    {res.wait_queue.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {res.wait_queue.map((w) => (
                          <span
                            key={w}
                            className="px-2 py-0.5 rounded-[2px] bg-[#1E0F0F] text-[#EF4444] border border-[#441C1C] text-[10px] font-bold"
                          >
                            {w}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[#707070]">NONE</span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <span
                    className={`inline-block text-xs font-mono px-3 py-1.5 rounded-[2px] font-bold border ${
                      isMutex
                        ? isLocked
                          ? 'bg-[#1E180E] text-[#F59E0B] border-[#423018]'
                          : 'bg-[#0E1E12] text-[#22C55E] border-[#1C4424]'
                        : 'bg-[#1C1C1C] text-[#E8E8E8] border-[#333333]'
                    }`}
                  >
                    {isMutex ? (isLocked ? `LOCKED (${res.exclusive_holder})` : 'UNLOCKED') : `${res.available_units} TOKENS FREE`}
                  </span>
                </div>
              </div>
            );
          })}

          {resources.length === 0 && (
            <div className="py-8 text-center text-xs text-[#707070]">
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
            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
              <div>
                <label className="block text-[#A1A1A1] font-mono mb-1 font-semibold">Process ID</label>
                <select
                  value={selectedPid}
                  onChange={(e) => setSelectedPid(e.target.value)}
                  className="w-full min-h-[40px] bg-[#141414] border border-[#292929] rounded-[2px] px-3 py-2 text-[#F2F2F2] font-mono focus:border-[#E8E8E8] outline-none shadow-xs"
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
                <label className="block text-[#A1A1A1] font-mono mb-1 font-semibold">Resource</label>
                <select
                  value={selectedResId}
                  onChange={(e) => setSelectedResId(e.target.value)}
                  className="w-full min-h-[40px] bg-[#141414] border border-[#292929] rounded-[2px] px-3 py-2 text-[#F2F2F2] font-mono focus:border-[#E8E8E8] outline-none shadow-xs"
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

            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
              <div>
                <label className="block text-[#A1A1A1] font-mono mb-1 font-semibold">Lock Mode</label>
                <select
                  value={mode}
                  onChange={(e: any) => setMode(e.target.value)}
                  className="w-full min-h-[40px] bg-[#141414] border border-[#292929] rounded-[2px] px-3 py-2 text-[#F2F2F2] font-mono focus:border-[#E8E8E8] outline-none shadow-xs"
                >
                  <option value="EXCLUSIVE">EXCLUSIVE (Mutex Write Lock)</option>
                  <option value="SHARED">SHARED (Read Lock)</option>
                </select>
              </div>

              <div>
                <label className="block text-[#A1A1A1] font-mono mb-1 font-semibold">Units (Tokens)</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={units}
                  onChange={(e) => setUnits(Number(e.target.value))}
                  className="w-full min-h-[40px] bg-[#141414] border border-[#292929] rounded-[2px] px-3 py-2 text-[#F2F2F2] font-mono focus:border-[#E8E8E8] outline-none shadow-xs"
                />
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                onClick={handleAcquire}
                disabled={loading}
                className="flex-1 min-h-[40px] py-2 px-4 bg-[#E8E8E8] hover:bg-white text-[#080808] font-bold uppercase rounded-[2px] text-xs disabled:opacity-50 active:scale-95 transition shadow-xs"
              >
                Acquire Lock
              </button>
              <button
                onClick={handleRelease}
                disabled={loading}
                className="flex-1 min-h-[40px] py-2 px-4 bg-[#141414] hover:bg-[#1E1E1E] text-[#F2F2F2] rounded-[2px] text-xs font-mono font-semibold border border-[#292929] disabled:opacity-50 active:scale-95 transition shadow-xs"
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
                className="p-2 bg-[#141414] border border-[#292929] rounded-[2px] flex items-center justify-between text-[11px]"
              >
                <div className="flex items-center space-x-2 truncate">
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-[2px] ${
                      item.status === 'ok'
                        ? 'bg-[#0E1E12] text-[#22C55E] border border-[#1C4424]'
                        : 'bg-[#1E0F0F] text-[#EF4444] border border-[#441C1C]'
                    }`}
                  >
                    {item.status === 'ok' ? 'OK' : 'ERR'}
                  </span>
                  <span className="text-[#F2F2F2] truncate">{item.msg}</span>
                </div>
                <span className="text-[#707070] text-[10px] shrink-0 ml-2 tabular-nums">{item.time}</span>
              </div>
            ))}
            {actionLog.length === 0 && (
              <div className="py-8 text-center text-xs text-[#707070]">
                Perform an acquire or release operation to inspect synchronization state transitions.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
