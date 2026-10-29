import { useState } from 'react';
import { GanttEntry } from '../../types/simulation';
import { ProcessControlBlock } from '../../types/process';

interface GanttChartProps {
  entries: GanttEntry[];
  processes: ProcessControlBlock[];
  currentTick: number;
}

export function GanttChart({ entries, processes, currentTick }: GanttChartProps) {
  const [zoom, setZoom] = useState<number>(1); // 1 = 32px per tick, 2 = 48px, 0.5 = 20px
  const [hoveredEntry, setHoveredEntry] = useState<{ tick: number; pid: string | null; state: string } | null>(null);

  const fallbackProc: ProcessControlBlock = {
    id: 'P1',
    burst_time: 1,
    arrival_time: 0,
    priority: 1,
    remaining_time: 0,
    state: 'NEW',
    waiting_time: 0,
    turnaround_time: 0,
    response_time: 0,
    start_time: null,
    completion_time: null,
  };
  const processList: ProcessControlBlock[] = processes.length > 0 ? processes : [fallbackProc];
  const maxTick = Math.max(currentTick, entries.length > 0 ? Math.max(...entries.map((e) => e.tick)) + 1 : 12);
  const tickColumns = Array.from({ length: Math.max(16, maxTick) }, (_, i) => i);

  const tickWidth = zoom === 2 ? 48 : zoom === 0.5 ? 20 : 32;

  return (
    <div className="flex flex-col space-y-3 select-none">
      {/* Zoom and Legend Bar */}
      <div className="flex flex-wrap items-center justify-between text-xs gap-3">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-[#16805D] border border-[#16805D]" />
            <span className="text-[#475467]">Running Burst</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-[#FEF6EE] border border-[#FEDF89]" />
            <span className="text-[#475467]">Ready Wait</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-[#FEF3F2] border border-[#FECDCA]" />
            <span className="text-[#475467]">Resource Blocked</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-[#F8FAFC] border border-[#E4E7EC]" />
            <span className="text-[#98A2B3]">Idle / Not Arrived</span>
          </div>
        </div>

        {/* Zoom toggles */}
        <div className="flex items-center space-x-1 bg-white p-1 rounded-lg border border-[#D0D5DD] font-mono text-[11px] shadow-2xs">
          <span className="text-[#667085] px-1.5">Zoom:</span>
          <button
            onClick={() => setZoom(0.5)}
            className={`px-2 py-0.5 rounded transition ${zoom === 0.5 ? 'bg-[#EEF2FF] text-[#4055A8] font-bold' : 'text-[#667085] hover:text-[#202631]'}`}
          >
            0.5x
          </button>
          <button
            onClick={() => setZoom(1)}
            className={`px-2 py-0.5 rounded transition ${zoom === 1 ? 'bg-[#EEF2FF] text-[#4055A8] font-bold' : 'text-[#667085] hover:text-[#202631]'}`}
          >
            1x
          </button>
          <button
            onClick={() => setZoom(2)}
            className={`px-2 py-0.5 rounded transition ${zoom === 2 ? 'bg-[#EEF2FF] text-[#4055A8] font-bold' : 'text-[#667085] hover:text-[#202631]'}`}
          >
            2x
          </button>
        </div>
      </div>

      {/* Main Gantt Grid Container */}
      <div className="relative border border-[#E4E7EC] rounded-xl bg-white overflow-x-auto p-4 shadow-2xs">
        {/* Tick Timeline Header */}
        <div className="flex items-center pb-2 border-b border-[#F2F4F7] mb-2">
          <div className="w-20 shrink-0 text-[#667085] font-mono text-[11px] font-bold uppercase tracking-wider pl-2">
            Process
          </div>
          <div className="flex items-center">
            {tickColumns.map((t) => (
              <div
                key={t}
                style={{ width: `${tickWidth}px` }}
                className={`shrink-0 text-center font-mono text-[11px] ${
                  t === currentTick - 1 ? 'text-[#4055A8] font-bold border-b-2 border-[#4055A8]' : 'text-[#98A2B3]'
                }`}
              >
                {t}
              </div>
            ))}
          </div>
        </div>

        {/* Process Swimlanes */}
        <div className="space-y-2">
          {processList.map((proc) => {
            return (
              <div key={proc.id} className="flex items-center group">
                <div className="w-20 shrink-0 flex items-center space-x-1.5 pl-2 font-mono text-xs font-bold text-[#202631]">
                  <span className="w-2 h-2 rounded-full bg-[#4055A8]" />
                  <span>{proc.id}</span>
                </div>
                <div className="flex items-center relative">
                  {tickColumns.map((t) => {
                    const entry = entries.find((e) => e.tick === t);
                    const isRunning = entry?.process_id === proc.id;
                    const isArrived = proc.arrival_time <= t;
                    const isCompleted = proc.completion_time !== null && proc.completion_time !== undefined && t >= proc.completion_time;

                    let bgClass = 'bg-[#F8FAFC] border-[#E4E7EC] text-transparent';

                    if (isRunning) {
                      bgClass = 'bg-[#16805D] border-[#16805D] text-white font-bold shadow-2xs';
                    } else if (isArrived && !isCompleted && t < currentTick) {
                      bgClass = 'bg-[#FEF6EE] border-[#FEDF89] text-[#B7791F] font-semibold';
                    }

                    return (
                      <div
                        key={t}
                        style={{ width: `${tickWidth}px`, height: '28px' }}
                        onMouseEnter={() =>
                          setHoveredEntry({
                            tick: t,
                            pid: proc.id,
                            state: isRunning ? 'RUNNING' : isArrived && !isCompleted ? 'READY_WAIT' : 'IDLE',
                          })
                        }
                        onMouseLeave={() => setHoveredEntry(null)}
                        className={`shrink-0 border rounded-sm mx-[1px] flex items-center justify-center font-mono text-[10px] transition-all cursor-pointer ${bgClass} hover:ring-2 hover:ring-[#4055A8]/40`}
                      >
                        {isRunning && (zoom >= 1 ? proc.id : '')}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Hover inspection tooltip */}
        {hoveredEntry && (
          <div className="mt-3 pt-2.5 border-t border-[#F2F4F7] text-xs font-mono text-[#475467] flex items-center space-x-4">
            <span className="text-[#4055A8] font-bold">T={hoveredEntry.tick}</span>
            <span>Process: <span className="text-[#202631] font-bold">{hoveredEntry.pid}</span></span>
            <span>State: <span className="text-[#B7791F] font-semibold">{hoveredEntry.state}</span></span>
          </div>
        )}
      </div>
    </div>
  );
}
