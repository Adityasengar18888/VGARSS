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

  // Store active target & callback handlers in refs so they NEVER cause re-connections
  const activeTargetIdRef = useRef<string | null | undefined>(activeTargetId);
  activeTargetIdRef.current = activeTargetId;

  const onMessageReceivedRef = useRef(onMessageReceived);
  onMessageReceivedRef.current = onMessageReceived;

  const onPresenceUpdateRef = useRef(onPresenceUpdate);
  onPresenceUpdateRef.current = onPresenceUpdate;

  const onTypingEventRef = useRef(onTypingEvent);
  onTypingEventRef.current = onTypingEvent;

  const onTaskEventRef = useRef(onTaskEvent);
  onTaskEventRef.current = onTaskEvent;

  const onReceiptEventRef = useRef(onReceiptEvent);
  onReceiptEventRef.current = onReceiptEvent;

  const onWorkspaceAddedRef = useRef(onWorkspaceAdded);
  onWorkspaceAddedRef.current = onWorkspaceAdded;

  const sendEvent = useCallback((eventObj: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(eventObj));
        return true;
      } catch (err) {
        console.warn('[VGARSS WS] Send failed:', err);
      }
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

  // Connect loop - ONLY triggers when token or workspaceId changes
  useEffect(() => {
    if (!token || !workspaceId) {
      setStatus('disconnected');
      return;
    }

    let isUnmounted = false;

    const connect = () => {
      if (isUnmounted) return;
      setStatus('connecting');

      const baseWs = getWebSocketBaseUrl();
      const params = new URLSearchParams();
      params.set('token', token);
      params.set('workspace_id', workspaceId);
      const url = `${baseWs}/ws/v2?${params.toString()}`;

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

        // Start ping interval (10s keepalive to prevent proxy timeouts)
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          lastPingTimestamp.current = performance.now();
          sendEvent({ type: 'PING' });
        }, 10000);

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
            if (onPresenceUpdateRef.current && data.user_id && data.presence_state) {
              onPresenceUpdateRef.current(data.user_id, data.presence_state);
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
            if (onTypingEventRef.current) onTypingEventRef.current(data);
          } else if (eventType === 'CHAT_MESSAGE_RECV') {
            const msg: ChatMessage = data.payload;
            const target = data.channel_id || data.conversation_id;
            if (target && data.seq) {
              lastSeqRef.current[target] = Math.max(lastSeqRef.current[target] || 0, data.seq);
            }
            if (onMessageReceivedRef.current) onMessageReceivedRef.current(msg);
          } else if (eventType === 'TASK_CREATED' || eventType === 'TASK_STATE_CHANGED') {
            if (onTaskEventRef.current) onTaskEventRef.current(data.payload);
          } else if (
            eventType === 'MESSAGE_DELIVERED_UPDATE' ||
            eventType === 'MESSAGE_READ_UPDATE' ||
            eventType === 'MESSAGE_DELIVERY_UPDATE'
          ) {
            if (onReceiptEventRef.current) onReceiptEventRef.current(data);
          } else if (eventType === 'WORKSPACE_ADDED') {
            if (onWorkspaceAddedRef.current) onWorkspaceAddedRef.current(data);
          }
        } catch {
          // ignore parsing error
        }
      };

      ws.onclose = (ev: CloseEvent) => {
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        if (isUnmounted) return;

        setStatus('disconnected');
        // Do not reconnect on auth failure (1008 Policy Violation or auth error)
        if (ev.code === 1008 || (ev.reason && ev.reason.toLowerCase().includes('auth'))) {
          console.warn('[VGARSS WS] Authentication failed; halting reconnect attempts.');
          return;
        }

        const backoff = Math.min(1000 * Math.pow(1.5, reconnectAttempts.current), 15000);
        reconnectAttempts.current += 1;
        reconnectTimeoutRef.current = setTimeout(connect, backoff);
      };

      ws.onerror = () => {
        if (!isUnmounted) {
          ws.close();
        }
      };
    };

    connect();

    // Auto-reconnect immediately when device wakes up, tab regains focus, or network returns
    const handleWakeup = () => {
      if (isUnmounted) return;
      if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED || wsRef.current.readyState === WebSocket.CLOSING) {
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectAttempts.current = 0;
        connect();
      }
    };

    window.addEventListener('online', handleWakeup);
    window.addEventListener('focus', handleWakeup);
    document.addEventListener('visibilitychange', handleWakeup);

    return () => {
      isUnmounted = true;
      window.removeEventListener('online', handleWakeup);
      window.removeEventListener('focus', handleWakeup);
      document.removeEventListener('visibilitychange', handleWakeup);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      Object.values(typingTimersRef.current).forEach((t) => clearTimeout(t));
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [token, workspaceId, sendEvent, requestCatchup]);

  const forceReconnect = useCallback(() => {
    reconnectAttempts.current = 0;
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
    }
  }, []);

  return {
    status,
    latency,
    activeTypers,
    sendTyping,
    sendEvent,
    requestCatchup,
    forceReconnect,
  };
}
