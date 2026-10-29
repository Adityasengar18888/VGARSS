/**
 * Scheduling Engine & Simulation Models for VGARSS
 */
import { ProcessControlBlock, ProcessDefinition } from './process';
import { ResourceDefinition } from './resources';

export type AlgorithmType = 'FCFS' | 'SJF' | 'SRTF' | 'ROUND_ROBIN' | 'PRIORITY';

export type SimulationStatus = 'INITIALIZED' | 'RUNNING' | 'PAUSED' | 'COMPLETED';

export interface GanttEntry {
  tick: number;
  process_id: string | null;
  state: string;
}

export interface SimulationMetrics {
  total_ticks: number;
  busy_ticks: number;
  idle_ticks: number;
  cpu_utilization: number;
  throughput: number;
  avg_waiting_time: number;
  avg_turnaround_time: number;
  avg_response_time: number;
}

export interface SimulationCreatePayload {
  name: string;
  algorithm: AlgorithmType;
  time_quantum?: number;
  aging_interval?: number | null;
  is_preemptive?: boolean;
  processes: ProcessDefinition[];
  resources: ResourceDefinition[];
}

export interface SimulationResponse {
  id: string;
  group_id: string;
  name: string;
  algorithm: string;
  time_quantum: number;
  status: SimulationStatus;
  current_tick: number;
  cpu_utilization: number;
  avg_waiting_time: number;
  avg_turnaround_time: number;
  avg_response_time: number;
  throughput: number;
  processes?: ProcessControlBlock[];
  created_at?: string;
}

export interface SimulationStepResponse {
  simulation_id: string;
  tick: number;
  status: SimulationStatus;
  running_process_id: string | null;
  ready_queue: string[];
  waiting_queue: string[];
  terminated_processes: string[];
  metrics: SimulationMetrics;
  gantt_entry: GanttEntry;
}

