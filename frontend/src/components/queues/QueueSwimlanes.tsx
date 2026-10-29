import { ProcessControlBlock } from '../../types/process';
import { Clock, CheckCircle2, ShieldAlert } from 'lucide-react';

interface QueueSwimlanesProps {
  processes: ProcessControlBlock[];
  readyQueueIds: string[];
  waitingQueueIds: string[];
  runningProcessId: string | null;
}

export function QueueSwimlanes({
  processes,
  readyQueueIds,
  waitingQueueIds,
  runningProcessId,
}: QueueSwimlanesProps) {
  const runningProcess = processes.find((p) => p.id === runningProcessId);
  const readyProcesses = readyQueueIds.map((id) => processes.find((p) => p.id === id)).filter(Boolean) as ProcessControlBlock[];
  const waitingProcesses = waitingQueueIds.map((id) => processes.find((p) => p.id === id)).filter(Boolean) as ProcessControlBlock[];
  const terminatedProcesses = processes.filter((p) => p.state === 'TERMINATED');

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 select-none font-mono">
      {/* 1. CPU RUNNING */}
      <div className="bg-[#111111] border border-[#292929] rounded-[4px] p-3 flex flex-col min-h-[160px] shadow-xs">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#222222]">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-[#22C55E]">
            <span className="w-2 h-2 rounded-full bg-[#22C55E]" />
            <span>CPU Dispatcher</span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-[2px] bg-[#0E1E12] text-[#22C55E] border border-[#1C4424] font-bold">
            {runningProcess ? 'BUSY' : 'IDLE'}
          </span>
        </div>

        {runningProcess ? (
          <div className="p-3 bg-[#0E1E12] border border-[#1C4424] rounded-[3px] flex flex-col space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold font-mono text-[#22C55E]">{runningProcess.id}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-[2px] bg-[#142A1A] text-[#22C55E] font-bold border border-[#1C4424]">
                Prio {runningProcess.priority}
              </span>
            </div>
            <div className="text-xs text-[#A1A1A1] font-mono flex items-center justify-between pt-1">
              <span>Rem Burst:</span>
              <span className="font-bold text-[#F2F2F2]">{runningProcess.remaining_time}</span>
            </div>
            <div className="w-full bg-[#142A1A] h-1.5 rounded-full overflow-hidden border border-[#1C4424]">
              <div
                className="bg-[#22C55E] h-full rounded-full transition-all"
                style={{
                  width: `${Math.round(
                    ((runningProcess.burst_time - runningProcess.remaining_time) / runningProcess.burst_time) * 100
                  )}%`,
                }}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4 text-[#707070] text-xs">
            <span>CPU Core Idle</span>
            <span className="text-[10px] text-[#555555] mt-0.5">Awaiting dispatch</span>
          </div>
        )}
      </div>

      {/* 2. READY QUEUE */}
      <div className="bg-[#111111] border border-[#292929] rounded-[4px] p-3 flex flex-col min-h-[160px] shadow-xs">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#222222]">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-[#F59E0B]">
            <Clock className="w-3.5 h-3.5 text-[#F59E0B]" />
            <span>Ready Queue</span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-[2px] bg-[#1E180E] text-[#F59E0B] border border-[#423018] font-bold">
            {readyProcesses.length}
          </span>
        </div>

        <div className="flex-1 space-y-1.5 overflow-y-auto max-h-48 pr-1">
          {readyProcesses.length === 0 ? (
            <div className="h-full flex items-center justify-center text-[#707070] text-xs text-center py-6">
              Queue empty
            </div>
          ) : (
            readyProcesses.map((p, idx) => (
              <div
                key={p.id}
                className="p-2 rounded-[3px] bg-[#171717] border border-[#292929] flex items-center justify-between text-xs"
              >
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-[10px] text-[#707070]">#{idx + 1}</span>
                  <span className="font-mono font-bold text-[#F2F2F2]">{p.id}</span>
                </div>
                <div className="flex items-center space-x-2 text-[10px] font-mono text-[#A1A1A1]">
                  <span>Burst: {p.burst_time}</span>
                  <span className="px-1 py-0.2 rounded-[2px] bg-[#222222] border border-[#333333]">Prio {p.priority}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 3. WAITING / BLOCKED QUEUE */}
      <div className="bg-[#111111] border border-[#292929] rounded-[4px] p-3 flex flex-col min-h-[160px] shadow-xs">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#222222]">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-[#EF4444]">
            <ShieldAlert className="w-3.5 h-3.5 text-[#EF4444]" />
            <span>Blocked / Waiting</span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-[2px] bg-[#1E0F0F] text-[#EF4444] border border-[#441C1C] font-bold">
            {waitingProcesses.length}
          </span>
        </div>

        <div className="flex-1 space-y-1.5 overflow-y-auto max-h-48 pr-1">
          {waitingProcesses.length === 0 ? (
            <div className="h-full flex items-center justify-center text-[#707070] text-xs text-center py-6">
              No blocked processes
            </div>
          ) : (
            waitingProcesses.map((p) => (
              <div
                key={p.id}
                className="p-2 rounded-[3px] bg-[#1E0F0F] border border-[#441C1C] flex items-center justify-between text-xs"
              >
                <span className="font-mono font-bold text-[#EF4444]">{p.id}</span>
                <span className="text-[10px] font-mono text-[#F87171]">Wait: {p.waiting_time}t</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 4. TERMINATED / COMPLETED */}
      <div className="bg-[#111111] border border-[#292929] rounded-[4px] p-3 flex flex-col min-h-[160px] shadow-xs">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#222222]">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-[#A1A1A1]">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E]" />
            <span>Terminated Pool</span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-[2px] bg-[#1A1A1A] text-[#A1A1A1] border border-[#333333] font-bold">
            {terminatedProcesses.length}
          </span>
        </div>

        <div className="flex-1 space-y-1.5 overflow-y-auto max-h-48 pr-1">
          {terminatedProcesses.length === 0 ? (
            <div className="h-full flex items-center justify-center text-[#707070] text-xs text-center py-6">
              None completed
            </div>
          ) : (
            terminatedProcesses.map((p) => (
              <div
                key={p.id}
                className="p-2 rounded-[3px] bg-[#171717] border border-[#292929] flex items-center justify-between text-xs"
              >
                <span className="font-mono font-bold text-[#707070] line-through">{p.id}</span>
                <span className="text-[10px] font-mono text-[#22C55E] font-bold">TAT: {p.turnaround_time}t</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
