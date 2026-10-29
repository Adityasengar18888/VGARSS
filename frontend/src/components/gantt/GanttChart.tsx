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
    <div className="flex flex-col space-y-3 select-none font-mono">
      {/* Zoom and Legend Bar */}
      <div className="flex flex-wrap items-center justify-between text-xs gap-3">
        <div className="flex items-center space-x-3 text-[11px]">
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-[2px] bg-[#22C55E] border border-[#1C4424]" />
            <span className="text-[#A1A1A1]">Running Burst</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-[2px] bg-[#F59E0B] border border-[#423018]" />
            <span className="text-[#A1A1A1]">Ready Wait</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-[2px] bg-[#EF4444] border border-[#441C1C]" />
            <span className="text-[#A1A1A1]">Resource Blocked</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-[2px] bg-[#141414] border border-[#292929]" />
            <span className="text-[#707070]">Idle / Not Arrived</span>
          </div>
        </div>

        {/* Zoom toggles */}
        <div className="flex items-center space-x-1 bg-[#141414] p-1 rounded-[3px] border border-[#292929] font-mono text-[11px]">
          <span className="text-[#707070] px-1.5">Zoom:</span>
          <button
            onClick={() => setZoom(0.5)}
            className={`px-2 py-0.5 rounded-[2px] transition ${zoom === 0.5 ? 'bg-[#E8E8E8] text-[#080808] font-bold' : 'text-[#A1A1A1] hover:text-[#F2F2F2]'}`}
          >
            0.5x
          </button>
          <button
            onClick={() => setZoom(1)}
            className={`px-2 py-0.5 rounded-[2px] transition ${zoom === 1 ? 'bg-[#E8E8E8] text-[#080808] font-bold' : 'text-[#A1A1A1] hover:text-[#F2F2F2]'}`}
          >
            1x
          </button>
          <button
            onClick={() => setZoom(2)}
            className={`px-2 py-0.5 rounded-[2px] transition ${zoom === 2 ? 'bg-[#E8E8E8] text-[#080808] font-bold' : 'text-[#A1A1A1] hover:text-[#F2F2F2]'}`}
          >
            2x
          </button>
        </div>
      </div>

      {/* Main Gantt Grid Container */}
      <div className="relative border border-[#292929] rounded-[4px] bg-[#0E0E0E] overflow-x-auto p-4 shadow-xs">
        {/* Tick Timeline Header */}
        <div className="flex items-center pb-2 border-b border-[#222222] mb-2">
          <div className="w-20 shrink-0 text-[#707070] font-mono text-[11px] font-bold uppercase tracking-wider pl-2">
            Process
          </div>
          <div className="flex items-center">
            {tickColumns.map((t) => (
              <div
                key={t}
                style={{ width: `${tickWidth}px` }}
                className={`shrink-0 text-center font-mono text-[11px] ${
                  t === currentTick - 1 ? 'text-[#F2F2F2] font-bold border-b-2 border-[#E8E8E8]' : 'text-[#555555]'
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
                <div className="w-20 shrink-0 flex items-center space-x-1.5 pl-2 font-mono text-xs font-bold text-[#F2F2F2]">
                  <span className="w-2 h-2 rounded-full bg-[#E8E8E8]" />
                  <span>{proc.id}</span>
                </div>
                <div className="flex items-center relative">
                  {tickColumns.map((t) => {
                    const entry = entries.find((e) => e.tick === t);
                    const isRunning = entry?.process_id === proc.id;
                    const isArrived = proc.arrival_time <= t;
                    const isCompleted = proc.completion_time !== null && proc.completion_time !== undefined && t >= proc.completion_time;

                    let bgClass = 'bg-[#141414] border-[#222222] text-transparent';

                    if (isRunning) {
                      bgClass = 'bg-[#0E1E12] border-[#1C4424] text-[#22C55E] font-bold';
                    } else if (isArrived && !isCompleted && t < currentTick) {
                      bgClass = 'bg-[#1E180E] border-[#423018] text-[#F59E0B] font-semibold';
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
                        className={`shrink-0 border rounded-[2px] mx-[1px] flex items-center justify-center font-mono text-[10px] transition-all cursor-pointer ${bgClass} hover:ring-1 hover:ring-[#E8E8E8]`}
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
          <div className="mt-3 pt-2.5 border-t border-[#222222] text-xs font-mono text-[#A1A1A1] flex items-center space-x-4">
            <span className="text-[#F2F2F2] font-bold">T={hoveredEntry.tick}</span>
            <span>Process: <span className="text-[#F2F2F2] font-bold">{hoveredEntry.pid}</span></span>
            <span>State: <span className="text-[#F59E0B] font-semibold">{hoveredEntry.state}</span></span>
          </div>
        )}
      </div>
    </div>
  );
}
