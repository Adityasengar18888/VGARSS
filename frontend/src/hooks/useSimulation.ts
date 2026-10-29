/**
 * Comprehensive Simulation Management Hook for VGARSS
 * Handles simulation state, tick stepping, automated playback, and Gantt tracking
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../services/api';
import {
  SimulationResponse,
  SimulationStepResponse,
  SimulationMetrics,
  GanttEntry,
  SimulationCreatePayload,
} from '../types/simulation';
import { ProcessControlBlock } from '../types/process';

const DEFAULT_METRICS: SimulationMetrics = {
  total_ticks: 0,
  busy_ticks: 0,
  idle_ticks: 0,
  cpu_utilization: 0,
  throughput: 0,
  avg_waiting_time: 0,
  avg_turnaround_time: 0,
  avg_response_time: 0,
};

export function useSimulation(groupId: string | null) {
  const [simulation, setSimulation] = useState<SimulationResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speedMs, setSpeedMs] = useState<number>(500);

  const [currentTick, setCurrentTick] = useState<number>(0);
  const [metrics, setMetrics] = useState<SimulationMetrics>(DEFAULT_METRICS);
  const [ganttHistory, setGanttHistory] = useState<GanttEntry[]>([]);
  const [processes, setProcesses] = useState<ProcessControlBlock[]>([]);
  const [readyQueue, setReadyQueue] = useState<string[]>([]);
  const [waitingQueue, setWaitingQueue] = useState<string[]>([]);
  const [runningProcessId, setRunningProcessId] = useState<string | null>(null);

  const playTimerRef = useRef<any>(null);
  const isPlayingRef = useRef<boolean>(isPlaying);
  isPlayingRef.current = isPlaying;

  // Load existing simulation or recent run
  const refreshSimulation = useCallback(
    async (simId?: string) => {
      if (!groupId) return;
      setLoading(true);
      setError(null);
      try {
        if (simId) {
          const res = await api.getSimulation(groupId, simId);
          setSimulation(res);
          setCurrentTick(res.current_tick);
          if (res.processes) setProcesses(res.processes);
        } else {
          const list = await api.listSimulations(groupId);
          if (list.length > 0) {
            const latest = list[0];
            const full = await api.getSimulation(groupId, latest.id);
            setSimulation(full);
            setCurrentTick(full.current_tick);
            if (full.processes) setProcesses(full.processes);
          } else {
            setSimulation(null);
          }
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load simulation.');
      } finally {
        setLoading(false);
      }
    },
    [groupId]
  );

  useEffect(() => {
    refreshSimulation();
  }, [refreshSimulation]);

  // Step 1 Tick forward
  const step = useCallback(async () => {
    if (!groupId || !simulation) return;
    try {
      const stepRes: SimulationStepResponse = await api.stepSimulation(groupId, simulation.id);
      setCurrentTick(stepRes.tick);
      setRunningProcessId(stepRes.running_process_id);
      setReadyQueue(stepRes.ready_queue);
      setWaitingQueue(stepRes.waiting_queue);
      setMetrics(stepRes.metrics);

      if (stepRes.gantt_entry) {
        setGanttHistory((prev) => [...prev, stepRes.gantt_entry]);
      }

      // Update local process statuses
      setProcesses((prev) =>
        prev.map((p) => {
          if (p.id === stepRes.running_process_id) {
            return { ...p, state: 'RUNNING', remaining_time: Math.max(0, p.remaining_time - 1) };
          }
          if (stepRes.ready_queue.includes(p.id)) {
            return { ...p, state: 'READY' };
          }
          if (stepRes.waiting_queue.includes(p.id)) {
            return { ...p, state: 'WAITING' };
          }
          if (stepRes.terminated_processes.includes(p.id)) {
            return { ...p, state: 'TERMINATED', remaining_time: 0 };
          }
          return p;
        })
      );

      if (stepRes.status === 'COMPLETED') {
        setIsPlaying(false);
      }
      return stepRes;
    } catch (err: any) {
      setIsPlaying(false);
      setError(err.message || 'Simulation step error.');
    }
  }, [groupId, simulation]);

  // Auto-play loop
  useEffect(() => {
    if (isPlaying) {
      playTimerRef.current = setInterval(() => {
        step();
      }, speedMs);
    } else {
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current);
        playTimerRef.current = null;
      }
    }

    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    };
  }, [isPlaying, speedMs, step]);

  const play = () => setIsPlaying(true);
  const pause = () => setIsPlaying(false);

  const reset = async () => {
    pause();
    if (groupId && simulation) {
      try {
        const res = await api.resetSimulation(groupId, simulation.id);
        setSimulation(res);
        setCurrentTick(0);
        setMetrics(DEFAULT_METRICS);
        setGanttHistory([]);
        setReadyQueue([]);
        setWaitingQueue([]);
        setRunningProcessId(null);
        if (res.processes) setProcesses(res.processes);
        return;
      } catch {
        // Fallback to local reset
      }
    }
    setCurrentTick(0);
    setMetrics(DEFAULT_METRICS);
    setGanttHistory([]);
    setReadyQueue([]);
    setWaitingQueue([]);
    setRunningProcessId(null);
    if (simulation) {
      await refreshSimulation(simulation.id);
    }
  };

  const changePolicy = async (payload: {
    algorithm: string;
    time_quantum?: number;
    is_preemptive?: boolean;
    aging_interval?: number | null;
  }) => {
    if (!groupId || !simulation) return;
    try {
      const res = await api.updateSimulationPolicy(groupId, simulation.id, payload);
      setSimulation(res);
      return res;
    } catch (err: any) {
      setError(err.message || 'Failed to update scheduling policy.');
      throw err;
    }
  };

  const addProcess = async (payload: {
    id: string;
    arrival_time: number;
    burst_time: number;
    priority?: number;
  }) => {
    if (!groupId || !simulation) return;
    try {
      const res = await api.addProcess(groupId, simulation.id, payload);
      await refreshSimulation(simulation.id);
      return res;
    } catch (err: any) {
      setError(err.message || 'Failed to submit process.');
      throw err;
    }
  };

  const create = async (payload: SimulationCreatePayload) => {
    if (!groupId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.createSimulation(groupId, payload);
      setSimulation(res);
      setCurrentTick(0);
      setGanttHistory([]);
      setReadyQueue([]);
      setWaitingQueue([]);
      setRunningProcessId(null);
      setMetrics(DEFAULT_METRICS);
      if (res.processes) setProcesses(res.processes);
      return res;
    } catch (err: any) {
      setError(err.message || 'Failed to create simulation.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Sync state from WebSocket event
  const applyWsTelemetry = useCallback((payload: any) => {
    if (payload.tick !== undefined) {
      setCurrentTick(payload.tick);
    }
    if (payload.metrics) {
      setMetrics(payload.metrics);
    }
    if (payload.running_process_id !== undefined) {
      setRunningProcessId(payload.running_process_id);
    }
    if (payload.ready_queue) {
      setReadyQueue(payload.ready_queue);
    }
    if (payload.waiting_queue) {
      setWaitingQueue(payload.waiting_queue);
    }
    if (payload.gantt_entry) {
      setGanttHistory((prev) => {
        if (prev.some((g) => g.tick === payload.gantt_entry.tick)) {
          return prev;
        }
        return [...prev, payload.gantt_entry];
      });
    }
  }, []);

  return {
    simulation,
    loading,
    error,
    isPlaying,
    speedMs,
    currentTick,
    metrics,
    ganttHistory,
    processes,
    readyQueue,
    waitingQueue,
    runningProcessId,
    setSpeedMs,
    step,
    play,
    pause,
    reset,
    create,
    changePolicy,
    addProcess,
    refresh: refreshSimulation,
    applyWsTelemetry,
  };
}

