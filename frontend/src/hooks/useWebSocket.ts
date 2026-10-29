/**
 * Resilient WebSocket Hook for VGARSS Telemetry
 * Supports group isolation, token auth, sequence tracking, backoff reconnection, and heartbeats
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { ConnectionStatus, NetworkTelemetryEvent } from '../types/network';
import { getWebSocketBaseUrl } from '../config';

interface UseWebSocketOptions {
  groupId: string | null;
  token: string | null;
  onEvent?: (event: NetworkTelemetryEvent) => void;
  maxEvents?: number;
}

export function useWebSocket({ groupId, token, onEvent, maxEvents = 100 }: UseWebSocketOptions) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [lastSeq, setLastSeq] = useState<number>(0);
  const [latency, setLatency] = useState<number | null>(null);
  const [events, setEvents] = useState<NetworkTelemetryEvent[]>([]);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const pingIntervalRef = useRef<any>(null);
  const pingStartTimeRef = useRef<number | null>(null);
  const retryCountRef = useRef<number>(0);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch {
        // ignore
      }
    }

    const host = getWebSocketBaseUrl();
    let url = `${host}/ws`;

    if (groupId) {
      url = `${host}/ws/groups/${groupId}`;
      const params = new URLSearchParams();
      if (token) params.set('token', token);
      if (lastSeq > 0) params.set('last_seq', String(lastSeq));
      url = `${url}?${params.toString()}`;
    }

    setStatus('checking');

    try {
      const ws = new WebSocket(url);
      socketRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        retryCountRef.current = 0;

        // Periodic Heartbeat Ping every 15s
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            pingStartTimeRef.current = performance.now();
            ws.send(JSON.stringify({ type: 'PING', timestamp: new Date().toISOString() }));
          }
        }, 15000);
      };

      ws.onmessage = (event) => {
        try {
          const data: NetworkTelemetryEvent = JSON.parse(event.data);

          if (data.seq !== undefined && data.seq > 0) {
            setLastSeq((prev) => Math.max(prev, data.seq!));
          }

          if (data.type === 'PONG') {
            if (pingStartTimeRef.current) {
              setLatency(Math.round(performance.now() - pingStartTimeRef.current));
            }
          }

          setEvents((prev) => [...prev.slice(-maxEvents + 1), data]);

          if (onEventRef.current) {
            onEventRef.current(data);
          }
        } catch {
          // non-json raw packet
        }
      };

      ws.onerror = () => {
        setStatus('error');
      };

      ws.onclose = () => {
        setStatus('disconnected');
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

        // Exponential backoff reconnect
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 16000);
        retryCountRef.current += 1;
        setStatus('reconnecting');
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      };
    } catch {
      setStatus('error');
    }
  }, [groupId, token, lastSeq, maxEvents]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [connect]);

  const sendPing = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      pingStartTimeRef.current = performance.now();
      socketRef.current.send(JSON.stringify({ type: 'PING', timestamp: new Date().toISOString() }));
    }
  }, []);

  const resync = useCallback(
    (fromSeq?: number) => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({ type: 'RESYNC', last_seq: fromSeq !== undefined ? fromSeq : lastSeq })
        );
      }
    },
    [lastSeq]
  );

  return {
    status,
    lastSeq,
    latency,
    events,
    reconnect: connect,
    sendPing,
    resync,
  };
}

