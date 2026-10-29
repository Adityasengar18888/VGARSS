/**
 * Classical Operating System Benchmark Presets for VGARSS
 * Based on Abraham Silberschatz, Peter B. Galvin, and Greg Gagne — Operating System Concepts
 */
import { ProcessDefinition } from '../types/process';
import { ResourceDefinition } from '../types/resources';
import { AlgorithmType } from '../types/simulation';

export interface WorkloadPreset {
  id: string;
  name: string;
  description: string;
  recommendedAlgorithm: AlgorithmType;
  timeQuantum?: number;
  processes: ProcessDefinition[];
  resources: ResourceDefinition[];
}

export const WORKLOAD_PRESETS: WorkloadPreset[] = [
  {
    id: 'silberschatz-5.1',
    name: 'Silberschatz Ex. 5.1 Standard Workload',
    description: 'Classical multi-process workload demonstrating non-preemptive vs preemptive trade-offs (P1: 24ms, P2: 3ms, P3: 3ms).',
    recommendedAlgorithm: 'ROUND_ROBIN',
    timeQuantum: 4,
    processes: [
      { id: 'P1', arrival_time: 0, burst_time: 24, priority: 3 },
      { id: 'P2', arrival_time: 0, burst_time: 3, priority: 1 },
      { id: 'P3', arrival_time: 0, burst_time: 3, priority: 2 },
    ],
    resources: [
      { id: 'R1', name: 'Disk I/O Mutex', total_capacity: 1, resource_type: 'MUTEX', order_rank: 1 },
    ],
  },
  {
    id: 'convoy-effect',
    name: 'FCFS Convoy Effect Demonstration',
    description: 'A heavy CPU-bound process arrives first, holding up lightweight interactive processes and deteriorating average waiting time.',
    recommendedAlgorithm: 'FCFS',
    timeQuantum: 2,
    processes: [
      { id: 'P_CPU', arrival_time: 0, burst_time: 20, priority: 2 },
      { id: 'P_UI1', arrival_time: 1, burst_time: 2, priority: 1 },
      { id: 'P_UI2', arrival_time: 2, burst_time: 2, priority: 1 },
      { id: 'P_NET', arrival_time: 3, burst_time: 3, priority: 1 },
    ],
    resources: [
      { id: 'MUTEX_DB', name: 'Database Mutex', total_capacity: 1, resource_type: 'MUTEX', order_rank: 1 },
    ],
  },
  {
    id: 'priority-aging',
    name: 'Priority Scheduling & Starvation Mitigation',
    description: 'Demonstrates low-priority processes awaiting dispatch while higher priority bursts arrive, mitigated by dynamic aging.',
    recommendedAlgorithm: 'PRIORITY',
    timeQuantum: 3,
    processes: [
      { id: 'P_LOW', arrival_time: 0, burst_time: 8, priority: 5 },
      { id: 'P_MED1', arrival_time: 2, burst_time: 4, priority: 3 },
      { id: 'P_HIGH', arrival_time: 3, burst_time: 3, priority: 1 },
      { id: 'P_MED2', arrival_time: 5, burst_time: 4, priority: 2 },
    ],
    resources: [
      { id: 'SEM_MEM', name: 'Buffer Pool Semaphore', total_capacity: 2, resource_type: 'SEMAPHORE', order_rank: 1 },
    ],
  },
  {
    id: 'circular-wait-deadlock',
    name: 'Coffman Circular Wait Deadlock Scenario',
    description: 'Classic 2-process 2-resource deadlock condition where P1 holds R1 and needs R2, while P2 holds R2 and needs R1.',
    recommendedAlgorithm: 'ROUND_ROBIN',
    timeQuantum: 2,
    processes: [
      { id: 'P1', arrival_time: 0, burst_time: 10, priority: 1 },
      { id: 'P2', arrival_time: 0, burst_time: 10, priority: 1 },
    ],
    resources: [
      { id: 'R1', name: 'Shared Memory Mutex A', total_capacity: 1, resource_type: 'MUTEX', order_rank: 1 },
      { id: 'R2', name: 'Shared File Mutex B', total_capacity: 1, resource_type: 'MUTEX', order_rank: 2 },
    ],
  },
];

