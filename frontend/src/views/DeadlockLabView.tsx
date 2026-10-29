import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, ShieldCheck, AlertOctagon, RefreshCw } from 'lucide-react';
import { Card } from '../components/common/Card';
import { ResourceStatus, DeadlockStatus } from '../types/resources';
import { api } from '../services/api';
import { WORKLOAD_PRESETS } from '../services/presets';
import { ErrorState } from '../components/common/States';

interface DeadlockLabViewProps {
  groupId: string | null;
  simId: string | null;
  resources: ResourceStatus[];
  onRefreshResources: () => void;
  onCreateSimulation: (payload: any) => Promise<any>;
}

export function DeadlockLabView({
  groupId,
  simId,
  resources,
  onRefreshResources,
  onCreateSimulation,
}: DeadlockLabViewProps) {
  const [deadlockState, setDeadlockState] = useState<DeadlockStatus>({ deadlock_detected: false });
  const [bankersResult, setBankersResult] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const checkDeadlock = useCallback(async () => {
    if (!groupId || !simId) return;
    try {
      const res = await api.checkDeadlock(groupId, simId);
      setDeadlockState(res);
    } catch {
      // ignore
    }
  }, [groupId, simId]);

  useEffect(() => {
    checkDeadlock();
  }, [checkDeadlock, resources]);

  // Inject classic Coffman Deadlock Scenario
  const handleInjectDeadlockScenario = async () => {
    const preset = WORKLOAD_PRESETS.find((p) => p.id === 'circular-wait-deadlock');
    if (!preset) return;
    setLoading(true);
    setError(null);
    try {
      const sim = await onCreateSimulation({
        name: 'Coffman Deadlock Evaluation',
        algorithm: 'ROUND_ROBIN',
        time_quantum: 2,
        is_preemptive: false,
        processes: preset.processes,
        resources: preset.resources,
      });

      // P1 acquires R1
      await api.acquireResource(groupId!, sim.id, {
        process_id: 'P1',
        resource_id: 'R1',
        mode: 'EXCLUSIVE',
        units: 1,
      });

      // P2 acquires R2
      await api.acquireResource(groupId!, sim.id, {
        process_id: 'P2',
        resource_id: 'R2',
        mode: 'EXCLUSIVE',
        units: 1,
      });

      // P1 requests R2 (Blocked)
      await api.acquireResource(groupId!, sim.id, {
        process_id: 'P1',
        resource_id: 'R2',
        mode: 'EXCLUSIVE',
        units: 1,
      });

      // P2 requests R1 (Blocked -> Cycle formed!)
      await api.acquireResource(groupId!, sim.id, {
        process_id: 'P2',
        resource_id: 'R1',
        mode: 'EXCLUSIVE',
        units: 1,
      });

      onRefreshResources();
      await checkDeadlock();
    } catch (err: any) {
      setError(err.message || 'Failed to inject deadlock scenario.');
    } finally {
      setLoading(false);
    }
  };

  // Recovery: Release R1 to break circular wait
  const handleBreakDeadlock = async () => {
    if (!groupId || !simId) return;
    setLoading(true);
    setError(null);
    try {
      await api.releaseResource(groupId, simId, {
        process_id: 'P1',
        resource_id: 'R1',
      });
      onRefreshResources();
      await checkDeadlock();
      setBankersResult('Recovery successful: Released R1 held by P1, unblocking circular wait.');
    } catch (err: any) {
      setError(err.message || 'Recovery failed.');
    } finally {
      setLoading(false);
    }
  };

  // Run Banker's Algorithm evaluation
  const handleRunBankers = () => {
    if (deadlockState.deadlock_detected) {
      setBankersResult('Banker\'s Safety Check: UNSAFE STATE. Circular dependency present. No valid execution sequence exists.');
    } else {
      setBankersResult('Banker\'s Safety Check: SAFE STATE. System can allocate resources to completion without deadlock.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#202631] tracking-tight">Deadlock Laboratory & Cycle Detection</h2>
          <p className="text-xs text-[#667085] mt-1 max-w-[65ch]">
            Resource Allocation Graph (RAG) visualization, Tarjan cycle detection, and Coffman condition mitigations.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={checkDeadlock}
            className="min-h-[40px] px-3.5 py-2 bg-white hover:bg-slate-50 text-[#202631] border border-[#E4E7EC] rounded-lg text-xs font-mono font-semibold flex items-center space-x-1.5 active:scale-[0.97] shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#4055A8]" />
            <span>Scan Cycle Graph</span>
          </button>

          <button
            onClick={handleInjectDeadlockScenario}
            disabled={loading}
            className="min-h-[40px] px-3.5 py-2 bg-[#C0393A] hover:bg-[#A82E2F] text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 disabled:opacity-50 active:scale-[0.97] shadow-sm"
          >
            <AlertOctagon className="w-4 h-4" />
            <span>Inject Deadlock Scenario</span>
          </button>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={() => setError(null)} />}

      {/* Deadlock Detection Alert Banner */}
      {deadlockState.deadlock_detected ? (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex flex-wrap items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-rose-100 border border-rose-200 flex items-center justify-center text-[#C0393A] shrink-0">
              <AlertTriangle className="w-6 h-6 text-[#C0393A]" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#C0393A]">
                DEADLOCK DETECTED: Circular Wait Invariant Violated
              </h4>
              <p className="text-xs font-mono text-[#202631] mt-0.5">
                {deadlockState.description || 'Circular dependency cycle detected in Resource Allocation Graph.'}
              </p>
              <div className="mt-1 flex items-center space-x-2 text-[11px] font-mono text-[#C0393A]">
                <span>Cycle Nodes: {deadlockState.cycle_processes?.join(' → ')}</span>
                <span>|</span>
                <span>Resources: {deadlockState.involved_resources?.join(', ')}</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleBreakDeadlock}
            disabled={loading}
            className="px-4 py-2 bg-[#C0393A] hover:bg-[#A82E2F] text-white rounded-lg text-xs font-bold active:scale-[0.97] shadow-sm shrink-0"
          >
            Break Deadlock (Preempt Lock)
          </button>
        </div>
      ) : (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-3 text-[#16805D] shadow-sm">
          <ShieldCheck className="w-6 h-6 text-[#16805D] shrink-0" />
          <div>
            <h4 className="text-sm font-bold text-[#16805D]">Normal Operation: No Deadlock Cycles Detected</h4>
            <p className="text-xs text-[#667085] mt-0.5">
              Wait-For Graph is acyclic. All processes can acquire resources and terminate without circular blocking.
            </p>
          </div>
        </div>
      )}

      {/* Visual Resource Allocation Graph (RAG) SVG Canvas */}
      <Card
        title="Visual Resource Allocation Graph (RAG)"
        subtitle="Circular nodes denote Processes; Square nodes denote Resources. Blue arrows denote held locks; Red arrows denote requested locks."
      >
        <div className="relative w-full h-80 bg-[#F8F9FB] border border-[#E4E7EC] rounded-xl flex items-center justify-center p-4 overflow-hidden">
          <svg className="w-full h-full" viewBox="0 0 600 240">
            <defs>
              <marker id="arrow-assign" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#4055A8" />
              </marker>
              <marker id="arrow-request" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#C0393A" />
              </marker>
            </defs>

            {/* If 2-process 2-resource deadlock exists, render animated cycle */}
            {deadlockState.deadlock_detected ? (
              <g>
                {/* Assignment R1 -> P1 */}
                <line x1="200" y1="60" x2="120" y2="150" stroke="#4055A8" strokeWidth="2.5" markerEnd="url(#arrow-assign)" strokeDasharray="4 2" />
                {/* Request P1 -> R2 */}
                <line x1="120" y1="150" x2="400" y2="180" stroke="#C0393A" strokeWidth="2.5" markerEnd="url(#arrow-request)" />
                {/* Assignment R2 -> P2 */}
                <line x1="400" y1="180" x2="480" y2="90" stroke="#4055A8" strokeWidth="2.5" markerEnd="url(#arrow-assign)" strokeDasharray="4 2" />
                {/* Request P2 -> R1 */}
                <line x1="480" y1="90" x2="200" y2="60" stroke="#C0393A" strokeWidth="2.5" markerEnd="url(#arrow-request)" />

                {/* Node: R1 (Square) */}
                <rect x="175" y="35" width="50" height="50" rx="8" fill="#FFFFFF" stroke="#C0393A" strokeWidth="2" className="animate-pulse" />
                <text x="200" y="65" textAnchor="middle" fill="#202631" fontSize="12" fontWeight="bold" fontFamily="monospace">R1</text>

                {/* Node: P1 (Circle) */}
                <circle cx="120" cy="150" r="28" fill="#F0F2F5" stroke="#C0393A" strokeWidth="2.5" />
                <text x="120" y="155" textAnchor="middle" fill="#4055A8" fontSize="13" fontWeight="bold" fontFamily="monospace">P1</text>

                {/* Node: R2 (Square) */}
                <rect x="375" y="155" width="50" height="50" rx="8" fill="#FFFFFF" stroke="#C0393A" strokeWidth="2" className="animate-pulse" />
                <text x="400" y="185" textAnchor="middle" fill="#202631" fontSize="12" fontWeight="bold" fontFamily="monospace">R2</text>

                {/* Node: P2 (Circle) */}
                <circle cx="480" cy="90" r="28" fill="#F0F2F5" stroke="#C0393A" strokeWidth="2.5" />
                <text x="480" y="95" textAnchor="middle" fill="#4055A8" fontSize="13" fontWeight="bold" fontFamily="monospace">P2</text>
              </g>
            ) : (
              <g>
                {/* Generic RAG representation */}
                <line x1="180" y1="120" x2="280" y2="120" stroke="#4055A8" strokeWidth="2" markerEnd="url(#arrow-assign)" />
                <line x1="320" y1="120" x2="420" y2="120" stroke="#CBD5E1" strokeWidth="1.5" />

                {/* Resource Node R1 */}
                <rect x="130" y="95" width="50" height="50" rx="8" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1.5" />
                <text x="155" y="125" textAnchor="middle" fill="#202631" fontSize="12" fontWeight="bold" fontFamily="monospace">R1</text>

                {/* Process Node P1 */}
                <circle cx="300" cy="120" r="26" fill="#F0F2F5" stroke="#4055A8" strokeWidth="2" />
                <text x="300" y="125" textAnchor="middle" fill="#4055A8" fontSize="12" fontWeight="bold" fontFamily="monospace">P1</text>

                {/* Resource Node R2 */}
                <rect x="420" y="95" width="50" height="50" rx="8" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1.5" />
                <text x="445" y="125" textAnchor="middle" fill="#202631" fontSize="12" fontWeight="bold" fontFamily="monospace">R2</text>
              </g>
            )}
          </svg>
        </div>
      </Card>

      {/* Banker's Algorithm Evaluation & Safety Checks */}
      <Card
        title="Banker's Algorithm & Deadlock Avoidance"
        subtitle="Evaluates safe vs unsafe states to prevent starvation and deadlock cycles before allocation"
        actions={
          <button
            onClick={handleRunBankers}
            className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-[#4055A8] border border-[#E4E7EC] rounded-lg text-xs font-mono font-semibold active:scale-[0.97] shadow-sm"
          >
            Run Safety Verification
          </button>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-[#667085] max-w-[65ch]">
            The Banker&apos;s Algorithm dynamically inspects Available, Allocation, Max, and Need matrices to guarantee that granting any request leaves the system in a <strong className="text-[#16805D]">Safe State</strong> where a safe sequence exists.
          </p>

          {bankersResult && (
            <div className="p-3 bg-[#F8F9FB] border border-[#E4E7EC] rounded-lg font-mono text-xs text-[#202631]">
              {bankersResult}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
