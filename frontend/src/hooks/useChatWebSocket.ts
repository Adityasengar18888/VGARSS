import { useState, useEffect, useRef, useCallback } from 'react';
import { ChatMessage } from '../types/chat';
import { MessageReceiptEvent } from '../types/messageLifecycle';
import { getWebSocketBaseUrl } from '../config';

export interface ChatWebSocketOptions {
  token: string | null;
  workspaceId: string | null;
  activeTargetId?: string | null;
  onMessageReceived?: (msg: ChatMessage) => void;
  onPresenceUpdate?: (userId: string, state: string) => void;
  onTypingEvent?: (data: { target_id: string; user_id: string; username: string; display_name: string }) => void;
  onTaskEvent?: (task: any) => void;
  onReceiptEvent?: (event: MessageReceiptEvent) => void;
  onWorkspaceAdded?: (data: { workspace_id: string; workspace_name: string; role?: string }) => void;
}

export function useChatWebSocket({
  token,
  workspaceId,
  activeTargetId,
  onMessageReceived,
  onPresenceUpdate,
  onTypingEvent,
  onTaskEvent,
  onReceiptEvent,
  onWorkspaceAdded,
}: ChatWebSocketOptions) {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [latency, setLatency] = useState<number | null>(null);
  const [activeTypers, setActiveTypers] = useState<Record<string, string>>({}); // userId -> displayName

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const pingIntervalRef = useRef<any>(null);
  const typingTimersRef = useRef<Record<string, any>>({});
  const lastSeqRef = useRef<Record<string, number>>({});
  const lastPingTimestamp = useRef<number>(0);
  const reconnectAttempts = useRef<number>(0);
  const activeTargetIdRef = useRef<string | null | undefined>(activeTargetId);
  activeTargetIdRef.current = activeTargetId;

  const getWsUrl = useCallback(() => {
    const baseWs = getWebSocketBaseUrl();
    const url = `${baseWs}/ws/v2`;
    const params = new URLSearchParams();
    if (token) params.set('token', token);
    if (workspaceId) params.set('workspace_id', workspaceId);
    return `${url}?${params.toString()}`;
  }, [token, workspaceId]);

  const sendEvent = useCallback((eventObj: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(eventObj));
      return true;
    }
    return false;
  }, []);

  const sendTyping = useCallback((targetId: string, isChannel: boolean = true) => {
    sendEvent({
      type: 'TYPING_START',
      target_id: targetId,
      is_channel: isChannel,
    });
  }, [sendEvent]);

  const requestCatchup = useCallback((targetId: string, sinceSeq: number) => {
    sendEvent({
      type: 'CATCHUP_REQUEST',
      target_id: targetId,
      since_seq: sinceSeq,
    });
  }, [sendEvent]);

  // Connect loop
  useEffect(() => {
    if (!token || !workspaceId) {
      setStatus('disconnected');
      return;
    }

    let isUnmounted = false;

    const connect = () => {
      if (isUnmounted) return;
      setStatus('connecting');

      const url = getWsUrl();
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isUnmounted) {
          ws.close();
          return;
        }
        setStatus('connected');
        reconnectAttempts.current = 0;

        // Immediate initial ping for instant latency telemetry
        lastPingTimestamp.current = performance.now();
        sendEvent({ type: 'PING' });

        // Start ping interval
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          lastPingTimestamp.current = performance.now();
          sendEvent({ type: 'PING' });
        }, 15000);

        // Catch up on active target if disconnected previously
        const currentActive = activeTargetIdRef.current;
        if (currentActive && lastSeqRef.current[currentActive] !== undefined) {
          requestCatchup(currentActive, lastSeqRef.current[currentActive]);
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const eventType = data.type;

          if (eventType === 'PONG') {
            const rtt = Math.round(performance.now() - lastPingTimestamp.current);
            setLatency(rtt);
          } else if (eventType === 'AUTH_SUCCESS') {
            setStatus('connected');
          } else if (eventType === 'PRESENCE_UPDATE') {
            if (onPresenceUpdate && data.user_id && data.presence_state) {
              onPresenceUpdate(data.user_id, data.presence_state);
            }
          } else if (eventType === 'TYPING_EVENT') {
            const typerId = data.user_id;
            const typerName = data.display_name || data.username;
            if (data.target_id === activeTargetIdRef.current) {
              setActiveTypers((prev) => ({ ...prev, [typerId]: typerName }));

              // Clear indicator after 3 seconds of silence
              if (typingTimersRef.current[typerId]) {
                clearTimeout(typingTimersRef.current[typerId]);
              }
              typingTimersRef.current[typerId] = setTimeout(() => {
                setActiveTypers((prev) => {
                  const copy = { ...prev };
                  delete copy[typerId];
                  return copy;
                });
              }, 3000);
            }
            if (onTypingEvent) onTypingEvent(data);
          } else if (eventType === 'CHAT_MESSAGE_RECV') {
            const msg: ChatMessage = data.payload;
            const target = data.channel_id || data.conversation_id;
            if (target && data.seq) {
              lastSeqRef.current[target] = Math.max(lastSeqRef.current[target] || 0, data.seq);
            }
            if (onMessageReceived) onMessageReceived(msg);
          } else if (eventType === 'TASK_CREATED' || eventType === 'TASK_STATE_CHANGED') {
            if (onTaskEvent) onTaskEvent(data.payload);
          } else if (
            eventType === 'MESSAGE_DELIVERED_UPDATE' ||
            eventType === 'MESSAGE_READ_UPDATE' ||
            eventType === 'MESSAGE_DELIVERY_UPDATE'
          ) {
            if (onReceiptEvent) onReceiptEvent(data);
          } else if (eventType === 'WORKSPACE_ADDED') {
            if (onWorkspaceAdded) onWorkspaceAdded(data);
          }
        } catch {
          // ignore parsing error
        }
      };

      ws.onclose = (ev: CloseEvent) => {
        setStatus('disconnected');
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        // Do not reconnect on auth failure (1008 Policy Violation or auth error)
        if (ev.code === 1008 || (ev.reason && ev.reason.toLowerCase().includes('auth'))) {
          console.warn('[VGARSS WS] Authentication failed; halting reconnect attempts.');
          return;
        }
        if (!isUnmounted) {
          const backoff = Math.min(1000 * Math.pow(1.5, reconnectAttempts.current), 15000);
          reconnectAttempts.current += 1;
          reconnectTimeoutRef.current = setTimeout(connect, backoff);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      isUnmounted = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      Object.values(typingTimersRef.current).forEach((t) => clearTimeout(t));
      if (wsRef.current) wsRef.current.close();
    };
  }, [token, workspaceId, getWsUrl, sendEvent, requestCatchup, onMessageReceived, onPresenceUpdate, onTypingEvent, onTaskEvent]);

  return {
    status,
    latency,
    activeTypers,
    sendTyping,
    sendEvent,
    requestCatchup,
  };
}

