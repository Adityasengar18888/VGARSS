import React, { useState } from 'react';
import {
  Cpu,
  Plus,
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Sliders,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { GanttChart } from '../components/gantt/GanttChart';
import { QueueSwimlanes } from '../components/queues/QueueSwimlanes';
import { ProcessControlBlock, ProcessDefinition } from '../types/process';
import { AlgorithmType, SimulationResponse, GanttEntry } from '../types/simulation';
import { WORKLOAD_PRESETS, WorkloadPreset } from '../services/presets';
import { ErrorState } from '../components/common/States';

interface ProcessSchedulerViewProps {
  simulation: SimulationResponse | null;
  currentTick: number;
  ganttHistory: GanttEntry[];
  processes: ProcessControlBlock[];
  readyQueue: string[];
  waitingQueue: string[];
  runningProcessId: string | null;
  isPlaying: boolean;
  onStep: () => void;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onCreateSimulation: (payload: any) => Promise<any>;
}

export function ProcessSchedulerView({
  simulation,
  currentTick,
  ganttHistory,
  processes,
  readyQueue,
  waitingQueue,
  runningProcessId,
  isPlaying,
  onStep,
  onPlay,
  onPause,
  onReset,
  onCreateSimulation,
}: ProcessSchedulerViewProps) {
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showPresetModal, setShowPresetModal] = useState<boolean>(false);

  // New simulation configuration parameters
  const [selectedAlgo, setSelectedAlgo] = useState<AlgorithmType>(
    (simulation?.algorithm as AlgorithmType) || 'ROUND_ROBIN'
  );
  const [timeQuantum, setTimeQuantum] = useState<number>(simulation?.time_quantum || 2);
  const [isPreemptive, setIsPreemptive] = useState<boolean>(true);
  const [agingInterval, setAgingInterval] = useState<number | undefined>(undefined);

  // New process modal inputs
  const [newPid, setNewPid] = useState<string>('P' + (processes.length + 1));
  const [newArrival, setNewArrival] = useState<number>(0);
  const [newBurst, setNewBurst] = useState<number>(4);
  const [newPriority, setNewPriority] = useState<number>(1);

  const [localError, setLocalError] = useState<string | null>(null);

  // Handle Preset Loading
  const handleLoadPreset = async (preset: WorkloadPreset) => {
    try {
      setLocalError(null);
      await onCreateSimulation({
        name: preset.name,
        algorithm: preset.recommendedAlgorithm,
        time_quantum: preset.timeQuantum || 2,
        is_preemptive: preset.recommendedAlgorithm === 'SRTF' || preset.recommendedAlgorithm === 'PRIORITY',
        processes: preset.processes,
        resources: preset.resources,
      });
      setSelectedAlgo(preset.recommendedAlgorithm);
      if (preset.timeQuantum) setTimeQuantum(preset.timeQuantum);
      setShowPresetModal(false);
    } catch (err: any) {
      setLocalError(err.message || 'Failed to load benchmark workload.');
    }
  };

  // Handle Ingesting new process into current or new workload
  const handleAddProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPid.trim() || newBurst <= 0) return;

    try {
      setLocalError(null);
      const existingDefs: ProcessDefinition[] = processes.map((p) => ({
        id: p.id,
        arrival_time: p.arrival_time,
        burst_time: p.burst_time,
        priority: p.priority,
      }));

      const updatedProcesses = [
        ...existingDefs,
        {
          id: newPid.trim().toUpperCase(),
          arrival_time: Number(newArrival),
          burst_time: Number(newBurst),
          priority: Number(newPriority),
        },
      ];

      await onCreateSimulation({
        name: simulation?.name || `${selectedAlgo} Simulation`,
        algorithm: selectedAlgo,
        time_quantum: timeQuantum,
        is_preemptive: isPreemptive,
        aging_interval: agingInterval || null,
        processes: updatedProcesses,
        resources: [],
      });

      setShowAddModal(false);
      setNewPid('P' + (updatedProcesses.length + 1));
      setNewArrival(currentTick);
      setNewBurst(4);
    } catch (err: any) {
      setLocalError(err.message || 'Failed to add process.');
    }
  };

  // Handle switching scheduling policy
  const handleApplyAlgorithm = async (algo: AlgorithmType) => {
    setSelectedAlgo(algo);
    if (!processes.length) return;
    try {
      setLocalError(null);
      await onCreateSimulation({
        name: `${algo} Workload`,
        algorithm: algo,
        time_quantum: timeQuantum,
        is_preemptive: algo === 'SRTF' || (algo === 'PRIORITY' && isPreemptive),
        aging_interval: agingInterval || null,
        processes: processes.map((p) => ({
          id: p.id,
          arrival_time: p.arrival_time,
          burst_time: p.burst_time,
          priority: p.priority,
        })),
        resources: [],
      });
    } catch (err: any) {
      setLocalError(err.message || 'Failed to update algorithm.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto select-none">
      {/* Top Header and Simulation Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-[#EEF2FF] border border-[#C7D2FE] flex items-center justify-center text-[#4055A8]">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#202631] tracking-tight">CPU Process Scheduler</h1>
              <p className="text-xs text-[#667085]">
                Discrete event simulator verifying FCFS, SJF, SRTF, Round Robin & Priority Scheduling
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowPresetModal(true)}
            className="px-3 py-2 bg-white hover:bg-[#F8FAFC] text-[#344054] border border-[#D0D5DD] rounded-lg text-xs font-semibold flex items-center space-x-1.5 active:scale-[0.97] transition shadow-2xs"
          >
            <span>Load OS Benchmark</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2 bg-[#4055A8] hover:bg-[#334488] text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 active:scale-[0.97] transition shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Process</span>
          </button>
        </div>
      </div>

      {localError && <ErrorState message={localError} onRetry={() => setLocalError(null)} />}

      {/* Algorithm Strategy Selection & Parameters Bar */}
      <Card className="bg-white border-[#E4E7EC]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-[#4055A8] shrink-0" />
            <span className="text-xs font-bold text-[#667085] font-mono uppercase tracking-wider">
              Scheduling Policy:
            </span>
            <div className="flex flex-wrap items-center gap-1.5 pl-2">
              {(['FCFS', 'SJF', 'SRTF', 'ROUND_ROBIN', 'PRIORITY'] as AlgorithmType[]).map((algo) => (
                <button
                  key={algo}
                  onClick={() => handleApplyAlgorithm(algo)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold active:scale-[0.97] transition ${
                    selectedAlgo === algo
                      ? 'bg-[#4055A8] text-white shadow-2xs'
                      : 'bg-white text-[#475467] hover:text-[#202631] hover:bg-[#F8FAFC] border border-[#D0D5DD]'
                  }`}
                >
                  {algo}
                </button>
              ))}
            </div>
          </div>

          {/* Contextual Algorithm Parameters */}
          <div className="flex items-center space-x-4 text-xs font-mono">
            {selectedAlgo === 'ROUND_ROBIN' && (
              <div className="flex items-center space-x-2 bg-[#F8FAFC] px-3 py-1 rounded-lg border border-[#E4E7EC]">
                <span className="text-[#667085]">Quantum (Q):</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={timeQuantum}
                  onChange={(e) => setTimeQuantum(Number(e.target.value))}
                  className="w-12 bg-white border border-[#D0D5DD] rounded px-1.5 py-0.5 text-center text-[#4055A8] font-bold focus:outline-none"
                />
              </div>
            )}

            {selectedAlgo === 'PRIORITY' && (
              <div className="flex items-center space-x-3 bg-[#F8FAFC] px-3 py-1 rounded-lg border border-[#E4E7EC]">
                <label className="flex items-center space-x-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPreemptive}
                    onChange={(e) => setIsPreemptive(e.target.checked)}
                    className="rounded text-[#4055A8]"
                  />
                  <span className="text-[#344054]">Preemptive</span>
                </label>
                <span className="text-[#D0D5DD]">|</span>
                <span className="text-[#667085]">Aging:</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  placeholder="Off"
                  value={agingInterval || ''}
                  onChange={(e) => setAgingInterval(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-12 bg-white border border-[#D0D5DD] rounded px-1 text-center text-[#4055A8] text-xs focus:outline-none"
                />
              </div>
            )}

            {/* Quick Play Controls */}
            <div className="flex items-center space-x-1.5 pl-2 border-l border-[#E4E7EC]">
              {isPlaying ? (
                <button
                  onClick={onPause}
                  className="px-2.5 py-1.5 bg-[#FEF6EE] hover:bg-[#FEDF89] text-[#B7791F] border border-[#FEDF89] rounded-lg text-xs flex items-center space-x-1 font-bold active:scale-[0.97] transition"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </button>
              ) : (
                <button
                  onClick={onPlay}
                  disabled={simulation?.status === 'COMPLETED'}
                  className="px-2.5 py-1.5 bg-[#ECFDF3] hover:bg-[#D1FADF] text-[#16805D] border border-[#A6F4C5] disabled:opacity-40 rounded-lg text-xs flex items-center space-x-1 font-bold active:scale-[0.97] transition"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Play</span>
                </button>
              )}
              <button
                onClick={onStep}
                disabled={isPlaying || simulation?.status === 'COMPLETED'}
                className="px-2.5 py-1.5 bg-[#EEF2FF] hover:bg-[#E0E7FF] text-[#4055A8] border border-[#C7D2FE] disabled:opacity-40 rounded-lg text-xs flex items-center space-x-1 font-bold active:scale-[0.97] transition"
              >
                <SkipForward className="w-3.5 h-3.5" />
                <span>+1 Tick</span>
              </button>
              <button
                onClick={onReset}
                className="p-1.5 bg-white hover:bg-[#F2F4F7] text-[#667085] hover:text-[#202631] border border-[#D0D5DD] rounded-lg active:scale-[0.97] transition"
                title="Reset simulation"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Interactive Gantt Chart */}
      <Card
        title="Gantt Timeline Chart"
        subtitle={`Execution visualization across discrete ticks (Current clock: T=${currentTick})`}
      >
        <GanttChart entries={ganttHistory} processes={processes} currentTick={currentTick} />
      </Card>

      {/* Queue Swimlanes */}
      <QueueSwimlanes
        processes={processes}
        readyQueueIds={readyQueue}
        waitingQueueIds={waitingQueue}
        runningProcessId={runningProcessId}
      />

      {/* Comprehensive Process Control Block (PCB) Metrics Table */}
      <Card
        title="Process Control Blocks (PCB) & Mathematical Metrics"
        subtitle="Turnaround, Waiting, and Response time calculations according to standard OS kernel formulas"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-[#E4E7EC] text-[#667085] uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Process ID</th>
                <th className="py-2.5 px-3">Arrival Time</th>
                <th className="py-2.5 px-3">Burst Time</th>
                <th className="py-2.5 px-3">Remaining</th>
                <th className="py-2.5 px-3">Priority</th>
                <th className="py-2.5 px-3">State</th>
                <th className="py-2.5 px-3">Start Time</th>
                <th className="py-2.5 px-3">Finish Time</th>
                <th className="py-2.5 px-3 text-[#4055A8]">Turnaround (TAT)</th>
                <th className="py-2.5 px-3 text-[#B7791F]">Wait (WT)</th>
                <th className="py-2.5 px-3 text-[#16805D]">Response (RT)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F4F7]">
              {processes.map((proc) => {
                return (
                  <tr key={proc.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="py-2.5 px-3 font-bold text-[#202631] flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#4055A8]" />
                      <span>{proc.id}</span>
                    </td>
                    <td className="py-2.5 px-3 text-[#475467]">{proc.arrival_time}</td>
                    <td className="py-2.5 px-3 text-[#475467]">{proc.burst_time}</td>
                    <td className="py-2.5 px-3 font-semibold text-[#202631]">{proc.remaining_time}</td>
                    <td className="py-2.5 px-3 text-[#475467]">{proc.priority}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
                          proc.state === 'RUNNING'
                            ? 'bg-[#ECFDF3] text-[#16805D] border-[#A6F4C5]'
                            : proc.state === 'READY'
                            ? 'bg-[#FEF6EE] text-[#B7791F] border-[#FEDF89]'
                            : proc.state === 'WAITING'
                            ? 'bg-[#FEF3F2] text-[#C0393A] border-[#FECDCA]'
                            : 'bg-[#F2F4F7] text-[#475467] border-[#D0D5DD]'
                        }`}
                      >
                        {proc.state}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[#667085]">{proc.start_time ?? '—'}</td>
                    <td className="py-2.5 px-3 text-[#667085]">{proc.completion_time ?? '—'}</td>
                    <td className="py-2.5 px-3 font-bold text-[#4055A8]">
                      {proc.state === 'TERMINATED' ? proc.turnaround_time : '—'}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-[#B7791F]">
                      {proc.state === 'TERMINATED' ? proc.waiting_time : '—'}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-[#16805D]">
                      {proc.start_time !== null && proc.start_time !== undefined
                        ? proc.response_time
                        : '—'}
                    </td>
                  </tr>
                );
              })}
              {processes.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-[#98A2B3] italic">
                    No processes admitted to this simulation run. Load a benchmark workload above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal: Add Process */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E4E7EC] rounded-xl shadow-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#F2F4F7]">
              <h3 className="text-base font-bold text-[#202631] flex items-center space-x-2">
                <Cpu className="w-4 h-4 text-[#4055A8]" />
                <span>Ingest Process Control Block</span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-[#667085] hover:text-[#202631] text-sm">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddProcess} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-[#344054] mb-1">Process ID</label>
                  <input
                    type="text"
                    required
                    value={newPid}
                    onChange={(e) => setNewPid(e.target.value)}
                    className="w-full bg-white border border-[#D0D5DD] rounded-lg px-3 py-2 text-xs font-mono text-[#202631] focus:border-[#4055A8] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-[#344054] mb-1">Priority (1 = High)</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    required
                    value={newPriority}
                    onChange={(e) => setNewPriority(Number(e.target.value))}
                    className="w-full bg-white border border-[#D0D5DD] rounded-lg px-3 py-2 text-xs font-mono text-[#202631] focus:border-[#4055A8] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-[#344054] mb-1">Arrival Tick</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={newArrival}
                    onChange={(e) => setNewArrival(Number(e.target.value))}
                    className="w-full bg-white border border-[#D0D5DD] rounded-lg px-3 py-2 text-xs font-mono text-[#202631] focus:border-[#4055A8] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-[#344054] mb-1">Burst Duration (Ticks)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={newBurst}
                    onChange={(e) => setNewBurst(Number(e.target.value))}
                    className="w-full bg-white border border-[#D0D5DD] rounded-lg px-3 py-2 text-xs font-mono text-[#202631] focus:border-[#4055A8] outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#F2F4F7]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-xs text-[#475467] hover:text-[#202631] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#4055A8] hover:bg-[#334488] text-white rounded-lg text-xs font-semibold active:scale-[0.97] transition"
                >
                  Admit to Workload
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Load Benchmark Preset */}
      {showPresetModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E4E7EC] rounded-xl shadow-2xl p-6 max-w-xl w-full space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#F2F4F7]">
              <h3 className="text-base font-bold text-[#202631]">
                Standard Silberschatz Benchmark Presets
              </h3>
              <button onClick={() => setShowPresetModal(false)} className="text-[#667085] hover:text-[#202631] text-sm">
                ✕
              </button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {WORKLOAD_PRESETS.map((preset) => (
                <div
                  key={preset.id}
                  onClick={() => handleLoadPreset(preset)}
                  className="p-3.5 bg-white hover:bg-[#F8FAFC] border border-[#E4E7EC] hover:border-[#4055A8] rounded-xl cursor-pointer active:scale-[0.97] transition flex flex-col space-y-2 group shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#202631] group-hover:text-[#4055A8]">
                      {preset.name}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#EEF2FF] text-[#4055A8] border border-[#C7D2FE] font-bold">
                      {preset.recommendedAlgorithm}
                    </span>
                  </div>
                  <p className="text-xs text-[#667085]">{preset.description}</p>
                  <div className="flex items-center space-x-2 text-[11px] font-mono text-[#98A2B3]">
                    <span>Processes: {preset.processes.map((p) => `${p.id}(B:${p.burst_time})`).join(', ')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
