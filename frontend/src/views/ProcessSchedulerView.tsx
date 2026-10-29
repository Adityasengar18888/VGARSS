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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 font-mono">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-[3px] bg-[#171717] border border-[#292929] flex items-center justify-center text-[#F2F2F2]">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#F2F2F2] tracking-tight font-sans">CPU Process Scheduler</h1>
              <p className="text-xs text-[#A1A1A1]">
                Discrete event simulator verifying FCFS, SJF, SRTF, Round Robin & Priority Scheduling
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowPresetModal(true)}
            className="px-3 py-2 bg-[#141414] hover:bg-[#1E1E1E] text-[#F2F2F2] border border-[#292929] rounded-[3px] text-xs font-mono font-semibold flex items-center space-x-1.5 active:scale-95 transition shadow-xs"
          >
            <span>Load OS Benchmark</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2 bg-[#E8E8E8] hover:bg-white text-[#080808] rounded-[3px] text-xs font-mono font-bold uppercase tracking-wider flex items-center space-x-1.5 active:scale-95 transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Process</span>
          </button>
        </div>
      </div>

      {localError && <ErrorState message={localError} onRetry={() => setLocalError(null)} />}

      {/* Algorithm Strategy Selection & Parameters Bar */}
      <Card className="bg-[#111111] border-[#292929]">
        <div className="flex flex-wrap items-center justify-between gap-4 font-mono">
          <div className="flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-[#A1A1A1] shrink-0" />
            <span className="text-xs font-bold text-[#A1A1A1] uppercase tracking-wider">
              Policy:
            </span>
            <div className="flex flex-wrap items-center gap-1.5 pl-2">
              {(['FCFS', 'SJF', 'SRTF', 'ROUND_ROBIN', 'PRIORITY'] as AlgorithmType[]).map((algo) => (
                <button
                  key={algo}
                  onClick={() => handleApplyAlgorithm(algo)}
                  className={`px-3 py-1 rounded-[3px] text-xs font-bold active:scale-95 transition ${
                    selectedAlgo === algo
                      ? 'bg-[#E8E8E8] text-[#080808] shadow-xs'
                      : 'bg-[#141414] text-[#A1A1A1] hover:text-[#F2F2F2] hover:bg-[#1E1E1E] border border-[#292929]'
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
              <div className="flex items-center space-x-2 bg-[#171717] px-3 py-1 rounded-[3px] border border-[#292929]">
                <span className="text-[#A1A1A1]">Quantum (Q):</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={timeQuantum}
                  onChange={(e) => setTimeQuantum(Number(e.target.value))}
                  className="w-12 bg-[#0E0E0E] border border-[#292929] rounded-[2px] px-1.5 py-0.5 text-center text-[#F2F2F2] font-bold focus:border-[#E8E8E8] outline-none"
                />
              </div>
            )}

            {selectedAlgo === 'PRIORITY' && (
              <div className="flex items-center space-x-3 bg-[#171717] px-3 py-1 rounded-[3px] border border-[#292929]">
                <label className="flex items-center space-x-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPreemptive}
                    onChange={(e) => setIsPreemptive(e.target.checked)}
                    className="rounded text-[#E8E8E8]"
                  />
                  <span className="text-[#F2F2F2]">Preemptive</span>
                </label>
                <span className="text-[#292929]">|</span>
                <span className="text-[#A1A1A1]">Aging:</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  placeholder="Off"
                  value={agingInterval || ''}
                  onChange={(e) => setAgingInterval(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-12 bg-[#0E0E0E] border border-[#292929] rounded-[2px] px-1 text-center text-[#F2F2F2] text-xs focus:border-[#E8E8E8] outline-none"
                />
              </div>
            )}

            {/* Quick Play Controls */}
            <div className="flex items-center space-x-1.5 pl-2 border-l border-[#222222]">
              {isPlaying ? (
                <button
                  onClick={onPause}
                  className="px-2.5 py-1.5 bg-[#1E180E] hover:bg-[#2A2012] text-[#F59E0B] border border-[#423018] rounded-[3px] text-xs flex items-center space-x-1 font-bold active:scale-95 transition"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </button>
              ) : (
                <button
                  onClick={onPlay}
                  disabled={simulation?.status === 'COMPLETED'}
                  className="px-2.5 py-1.5 bg-[#0E1E12] hover:bg-[#142A1A] text-[#22C55E] border border-[#1C4424] disabled:opacity-40 rounded-[3px] text-xs flex items-center space-x-1 font-bold active:scale-95 transition"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Play</span>
                </button>
              )}
              <button
                onClick={onStep}
                disabled={isPlaying || simulation?.status === 'COMPLETED'}
                className="px-2.5 py-1.5 bg-[#171717] hover:bg-[#222222] text-[#F2F2F2] border border-[#292929] disabled:opacity-40 rounded-[3px] text-xs flex items-center space-x-1 font-bold active:scale-95 transition"
              >
                <SkipForward className="w-3.5 h-3.5" />
                <span>+1 Tick</span>
              </button>
              <button
                onClick={onReset}
                className="p-1.5 bg-[#141414] hover:bg-[#1E1E1E] text-[#A1A1A1] hover:text-[#F2F2F2] border border-[#292929] rounded-[3px] active:scale-95 transition"
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
              <tr className="border-b border-[#222222] text-[#707070] uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Process ID</th>
                <th className="py-2.5 px-3">Arrival Time</th>
                <th className="py-2.5 px-3">Burst Time</th>
                <th className="py-2.5 px-3">Remaining</th>
                <th className="py-2.5 px-3">Priority</th>
                <th className="py-2.5 px-3">State</th>
                <th className="py-2.5 px-3">Start Time</th>
                <th className="py-2.5 px-3">Finish Time</th>
                <th className="py-2.5 px-3 text-[#E8E8E8]">Turnaround (TAT)</th>
                <th className="py-2.5 px-3 text-[#F59E0B]">Wait (WT)</th>
                <th className="py-2.5 px-3 text-[#22C55E]">Response (RT)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A1A1A]">
              {processes.map((proc) => {
                return (
                  <tr key={proc.id} className="hover:bg-[#141414] transition-colors">
                    <td className="py-2.5 px-3 font-bold text-[#F2F2F2] flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#E8E8E8]" />
                      <span>{proc.id}</span>
                    </td>
                    <td className="py-2.5 px-3 text-[#A1A1A1]">{proc.arrival_time}</td>
                    <td className="py-2.5 px-3 text-[#A1A1A1]">{proc.burst_time}</td>
                    <td className="py-2.5 px-3 font-semibold text-[#F2F2F2]">{proc.remaining_time}</td>
                    <td className="py-2.5 px-3 text-[#A1A1A1]">{proc.priority}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-[2px] font-bold border ${
                          proc.state === 'RUNNING'
                            ? 'bg-[#0E1E12] text-[#22C55E] border-[#1C4424]'
                            : proc.state === 'READY'
                            ? 'bg-[#1E180E] text-[#F59E0B] border-[#423018]'
                            : proc.state === 'WAITING'
                            ? 'bg-[#1E0F0F] text-[#EF4444] border-[#441C1C]'
                            : 'bg-[#141414] text-[#707070] border-[#292929]'
                        }`}
                      >
                        {proc.state}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[#707070]">{proc.start_time ?? '—'}</td>
                    <td className="py-2.5 px-3 text-[#707070]">{proc.completion_time ?? '—'}</td>
                    <td className="py-2.5 px-3 font-bold text-[#E8E8E8]">
                      {proc.state === 'TERMINATED' ? proc.turnaround_time : '—'}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-[#F59E0B]">
                      {proc.state === 'TERMINATED' ? proc.waiting_time : '—'}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-[#22C55E]">
                      {proc.start_time !== null && proc.start_time !== undefined
                        ? proc.response_time
                        : '—'}
                    </td>
                  </tr>
                );
              })}
              {processes.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-[#707070] italic">
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-[#292929] rounded-[4px] shadow-2xl p-6 max-w-md w-full space-y-4 font-mono">
            <div className="flex items-center justify-between pb-3 border-b border-[#222222]">
              <h3 className="text-sm font-bold text-[#F2F2F2] flex items-center space-x-2">
                <Cpu className="w-4 h-4 text-[#A1A1A1]" />
                <span>Ingest Process Control Block</span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-[#707070] hover:text-[#F2F2F2] text-sm">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddProcess} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-[#A1A1A1] mb-1">Process ID</label>
                  <input
                    type="text"
                    required
                    value={newPid}
                    onChange={(e) => setNewPid(e.target.value)}
                    className="w-full bg-[#141414] border border-[#292929] rounded-[2px] px-3 py-2 text-xs font-mono text-[#F2F2F2] focus:border-[#E8E8E8] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-[#A1A1A1] mb-1">Priority (1 = High)</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    required
                    value={newPriority}
                    onChange={(e) => setNewPriority(Number(e.target.value))}
                    className="w-full bg-[#141414] border border-[#292929] rounded-[2px] px-3 py-2 text-xs font-mono text-[#F2F2F2] focus:border-[#E8E8E8] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-[#A1A1A1] mb-1">Arrival Tick</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={newArrival}
                    onChange={(e) => setNewArrival(Number(e.target.value))}
                    className="w-full bg-[#141414] border border-[#292929] rounded-[2px] px-3 py-2 text-xs font-mono text-[#F2F2F2] focus:border-[#E8E8E8] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-[#A1A1A1] mb-1">Burst Duration (Ticks)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={newBurst}
                    onChange={(e) => setNewBurst(Number(e.target.value))}
                    className="w-full bg-[#141414] border border-[#292929] rounded-[2px] px-3 py-2 text-xs font-mono text-[#F2F2F2] focus:border-[#E8E8E8] outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#222222]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-xs text-[#A1A1A1] hover:text-[#F2F2F2] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#E8E8E8] hover:bg-white text-[#080808] rounded-[2px] text-xs font-bold uppercase transition active:scale-95"
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-[#292929] rounded-[4px] shadow-2xl p-6 max-w-xl w-full space-y-4 font-mono">
            <div className="flex items-center justify-between pb-3 border-b border-[#222222]">
              <h3 className="text-sm font-bold text-[#F2F2F2]">
                Standard Silberschatz Benchmark Presets
              </h3>
              <button onClick={() => setShowPresetModal(false)} className="text-[#707070] hover:text-[#F2F2F2] text-sm">
                ✕
              </button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {WORKLOAD_PRESETS.map((preset) => (
                <div
                  key={preset.id}
                  onClick={() => handleLoadPreset(preset)}
                  className="p-3.5 bg-[#141414] hover:bg-[#1A1A1A] border border-[#292929] hover:border-[#E8E8E8] rounded-[3px] cursor-pointer active:scale-95 transition flex flex-col space-y-2 group shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#F2F2F2] group-hover:text-white">
                      {preset.name}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-[2px] bg-[#1E1E1E] text-[#F2F2F2] border border-[#333333] font-bold">
                      {preset.recommendedAlgorithm}
                    </span>
                  </div>
                  <p className="text-xs text-[#A1A1A1] font-sans">{preset.description}</p>
                  <div className="flex items-center space-x-2 text-[11px] font-mono text-[#707070]">
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
