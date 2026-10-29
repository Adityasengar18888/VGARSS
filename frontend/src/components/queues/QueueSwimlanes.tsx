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
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 select-none">
      {/* 1. CPU RUNNING */}
      <div className="bg-white border border-[#E4E7EC] rounded-xl p-3 flex flex-col min-h-[160px] shadow-2xs">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#F2F4F7]">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-[#16805D]">
            <span className="w-2 h-2 rounded-full bg-[#16805D]" />
            <span>CPU Dispatcher</span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#ECFDF3] text-[#16805D] border border-[#A6F4C5] font-bold">
            {runningProcess ? 'BUSY' : 'IDLE'}
          </span>
        </div>

        {runningProcess ? (
          <div className="p-3 bg-[#ECFDF3] border border-[#A6F4C5] rounded-lg flex flex-col space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold font-mono text-[#16805D]">{runningProcess.id}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white text-[#16805D] font-bold border border-[#A6F4C5]">
                Prio {runningProcess.priority}
              </span>
            </div>
            <div className="text-xs text-[#344054] font-mono flex items-center justify-between pt-1">
              <span>Rem Burst:</span>
              <span className="font-bold text-[#202631]">{runningProcess.remaining_time}</span>
            </div>
            <div className="w-full bg-white h-1.5 rounded-full overflow-hidden border border-[#A6F4C5]">
              <div
                className="bg-[#16805D] h-full rounded-full transition-all"
                style={{
                  width: `${Math.round(
                    ((runningProcess.burst_time - runningProcess.remaining_time) / runningProcess.burst_time) * 100
                  )}%`,
                }}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4 text-[#98A2B3] text-xs">
            <span>CPU Core Idle</span>
            <span className="text-[10px] text-[#D0D5DD] mt-0.5">Awaiting dispatch</span>
          </div>
        )}
      </div>

      {/* 2. READY QUEUE */}
      <div className="bg-white border border-[#E4E7EC] rounded-xl p-3 flex flex-col min-h-[160px] shadow-2xs">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#F2F4F7]">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-[#B7791F]">
            <Clock className="w-3.5 h-3.5 text-[#B7791F]" />
            <span>Ready Queue</span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#FEF6EE] text-[#B7791F] border border-[#FEDF89] font-bold">
            {readyProcesses.length}
          </span>
        </div>

        <div className="flex-1 space-y-1.5 overflow-y-auto max-h-48 pr-1">
          {readyProcesses.length === 0 ? (
            <div className="h-full flex items-center justify-center text-[#98A2B3] text-xs text-center py-6">
              Queue empty
            </div>
          ) : (
            readyProcesses.map((p, idx) => (
              <div
                key={p.id}
                className="p-2 rounded-lg bg-[#F8FAFC] border border-[#E4E7EC] flex items-center justify-between text-xs"
              >
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-[10px] text-[#98A2B3]">#{idx + 1}</span>
                  <span className="font-mono font-bold text-[#202631]">{p.id}</span>
                </div>
                <div className="flex items-center space-x-2 text-[10px] font-mono text-[#667085]">
                  <span>Burst: {p.burst_time}</span>
                  <span className="px-1 py-0.2 rounded bg-white border border-[#D0D5DD]">Prio {p.priority}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 3. WAITING / BLOCKED QUEUE */}
      <div className="bg-white border border-[#E4E7EC] rounded-xl p-3 flex flex-col min-h-[160px] shadow-2xs">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#F2F4F7]">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-[#C0393A]">
            <ShieldAlert className="w-3.5 h-3.5 text-[#C0393A]" />
            <span>Blocked / Waiting</span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#FEF3F2] text-[#C0393A] border border-[#FECDCA] font-bold">
            {waitingProcesses.length}
          </span>
        </div>

        <div className="flex-1 space-y-1.5 overflow-y-auto max-h-48 pr-1">
          {waitingProcesses.length === 0 ? (
            <div className="h-full flex items-center justify-center text-[#98A2B3] text-xs text-center py-6">
              No blocked processes
            </div>
          ) : (
            waitingProcesses.map((p) => (
              <div
                key={p.id}
                className="p-2 rounded-lg bg-[#FEF3F2] border border-[#FECDCA] flex items-center justify-between text-xs"
              >
                <span className="font-mono font-bold text-[#B42318]">{p.id}</span>
                <span className="text-[10px] font-mono text-[#B42318]">Wait: {p.waiting_time}t</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 4. TERMINATED / COMPLETED */}
      <div className="bg-white border border-[#E4E7EC] rounded-xl p-3 flex flex-col min-h-[160px] shadow-2xs">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#F2F4F7]">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-[#475467]">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#16805D]" />
            <span>Terminated Pool</span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#F2F4F7] text-[#475467] border border-[#D0D5DD] font-bold">
            {terminatedProcesses.length}
          </span>
        </div>

        <div className="flex-1 space-y-1.5 overflow-y-auto max-h-48 pr-1">
          {terminatedProcesses.length === 0 ? (
            <div className="h-full flex items-center justify-center text-[#98A2B3] text-xs text-center py-6">
              None completed
            </div>
          ) : (
            terminatedProcesses.map((p) => (
              <div
                key={p.id}
                className="p-2 rounded-lg bg-[#F8FAFC] border border-[#E4E7EC] flex items-center justify-between text-xs"
              >
                <span className="font-mono font-bold text-[#475467] line-through">{p.id}</span>
                <span className="text-[10px] font-mono text-[#16805D] font-bold">TAT: {p.turnaround_time}t</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
