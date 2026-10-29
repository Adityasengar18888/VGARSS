/**
 * Concurrency, Mutex, Semaphore & Deadlock Models for VGARSS
 */

export type ResourceType = 'MUTEX' | 'SEMAPHORE';
export type ResourceMode = 'EXCLUSIVE' | 'SHARED';

export interface ResourceDefinition {
  id: string;
  name: string;
  total_capacity: number;
  resource_type: ResourceType;
  order_rank: number;
}

export interface ResourceStatus {
  id: string;
  name: string;
  type: string;
  total_capacity: number;
  available_units: number;
  exclusive_holder: string | null;
  shared_holders: string[];
  wait_queue: string[];
  order_rank: number;
}

export interface DeadlockStatus {
  deadlock_detected: boolean;
  cycle_processes?: string[];
  involved_resources?: string[];
  description?: string;
}

export interface ResourceAcquirePayload {
  process_id: string;
  resource_id: string;
  mode: ResourceMode;
  units: number;
}

export interface ResourceReleasePayload {
  process_id: string;
  resource_id: string;
  units?: number;
}

