/**
 * Process Control Block (PCB) & Process Lifecycle Types for VGARSS
 */

export type ProcessState = 'NEW' | 'READY' | 'RUNNING' | 'WAITING' | 'TERMINATED';

export interface ProcessDefinition {
  id: string;
  arrival_time: number;
  burst_time: number;
  priority: number;
}

export interface ProcessControlBlock {
  id: string;
  arrival_time: number;
  burst_time: number;
  remaining_time: number;
  priority: number;
  state: ProcessState;
  start_time?: number | null;
  completion_time?: number | null;
  waiting_time: number;
  turnaround_time: number;
  response_time: number;
  admission_order?: number;
}

export const STATE_COLORS: Record<ProcessState, { bg: string; text: string; border: string; dot: string }> = {
  NEW: {
    bg: 'bg-sky-950/40',
    text: 'text-sky-300',
    border: 'border-sky-800/60',
    dot: 'bg-sky-400',
  },
  READY: {
    bg: 'bg-amber-950/40',
    text: 'text-amber-300',
    border: 'border-amber-800/60',
    dot: 'bg-amber-400',
  },
  RUNNING: {
    bg: 'bg-emerald-950/40',
    text: 'text-emerald-300',
    border: 'border-emerald-800/60',
    dot: 'bg-emerald-400',
  },
  WAITING: {
    bg: 'bg-rose-950/40',
    text: 'text-rose-300',
    border: 'border-rose-800/60',
    dot: 'bg-rose-500',
  },
  TERMINATED: {
    bg: 'bg-slate-900/60',
    text: 'text-slate-400',
    border: 'border-slate-800/60',
    dot: 'bg-slate-500',
  },
};

