import { useState, useCallback, useRef } from 'react';
import { ChatMessage } from '../types/chat';
import { MessageLifecycleState, MessageReceiptEvent } from '../types/messageLifecycle';
import { api } from '../services/api';

interface UseMessageLifecycleOptions {
  currentUserId?: string;
  onSendEvent?: (eventObj: any) => boolean;
}

export function useMessageLifecycle({ currentUserId, onSendEvent }: UseMessageLifecycleOptions = {}) {
  // Map of messageId or clientMsgId -> current lifecycle state
  const [lifecycleMap, setLifecycleMap] = useState<Record<string, MessageLifecycleState>>({});
  
  // Pending messages cache for retry without re-prompting content
  const pendingPayloadsRef = useRef<Record<string, {
    content: string;
    channelId?: string | null;
    conversationId?: string | null;
    clientMsgId: string;
  }>>({});

  // Update lifecycle state for a given ID (syncs client_msg_id & server_id)
  const setLifecycleState = useCallback((id: string, state: MessageLifecycleState) => {
    setLifecycleMap((prev) => ({ ...prev, [id]: state }));
  }, []);

  // Get current state for a message
  const getMessageState = useCallback((msg: ChatMessage): MessageLifecycleState => {
    if (msg.id && lifecycleMap[msg.id]) {
      return lifecycleMap[msg.id];
    }
    if (msg.client_msg_id && lifecycleMap[msg.client_msg_id]) {
      return lifecycleMap[msg.client_msg_id];
    }
    if (msg.delivery_status === 'READ') return 'read';
    if (msg.delivery_status === 'DELIVERED') return 'delivered';
    if (msg.status === 'pending') return 'sending';
    if (msg.status === 'failed') return 'failed';
    return 'sent';
  }, [lifecycleMap]);

  // Dispatch a new message with neural lifecycle tracking
  const sendMessage = useCallback(async ({
    content,
    channelId,
    conversationId,
    clientMsgId: existingClientMsgId,
  }: {
    content: string;
    channelId?: string | null;
    conversationId?: string | null;
    clientMsgId?: string;
  }): Promise<ChatMessage> => {
    const clientMsgId = existingClientMsgId || `cli-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Store payload for idempotent retry
    pendingPayloadsRef.current[clientMsgId] = {
      content,
      channelId,
      conversationId,
      clientMsgId,
    };

    // Transition: queued -> sending
    setLifecycleState(clientMsgId, 'sending');

    try {
      let serverMsg: ChatMessage;
      if (channelId) {
        serverMsg = await api.postChannelMessage(channelId, content, clientMsgId);
      } else if (conversationId) {
        serverMsg = await api.postDmMessage(conversationId, content, clientMsgId);
      } else {
        throw new Error('Must specify channelId or conversationId.');
      }

      // Transition: sent (Server acknowledged & persisted)
      setLifecycleState(clientMsgId, 'sent');
      if (serverMsg.id) {
        setLifecycleState(serverMsg.id, 'sent');
      }
      return serverMsg;
    } catch (err) {
      setLifecycleState(clientMsgId, 'failed');
      throw err;
    }
  }, [setLifecycleState]);

  // Retry sending a failed message
  const retryMessage = useCallback(async (clientMsgId: string) => {
    const payload = pendingPayloadsRef.current[clientMsgId];
    if (!payload) return;

    setLifecycleState(clientMsgId, 'retrying');
    try {
      return await sendMessage({
        content: payload.content,
        channelId: payload.channelId,
        conversationId: payload.conversationId,
        clientMsgId: payload.clientMsgId,
      });
    } catch (err) {
      setLifecycleState(clientMsgId, 'failed');
      throw err;
    }
  }, [sendMessage, setLifecycleState]);

  // Handle incoming real-time receipt updates
  const handleReceiptUpdate = useCallback((event: MessageReceiptEvent) => {
    const { message_id, status } = event;
    if (!message_id) return;

    const stateToApply: MessageLifecycleState = status === 'read' ? 'read' : 'delivered';
    setLifecycleMap((prev) => {
      // Once marked 'read', don't downgrade back to 'delivered'
      if (prev[message_id] === 'read' && stateToApply === 'delivered') {
        return prev;
      }
      return { ...prev, [message_id]: stateToApply };
    });
  }, []);

  // Recipient client automatic delivery & read acknowledgement
  const acknowledgeIncomingMessage = useCallback((msg: ChatMessage, isConversationVisible: boolean = true) => {
    // Only acknowledge messages sent by peers (not our own)
    if (!currentUserId || !msg.sender_id || msg.sender_id === currentUserId) return;
    if (!onSendEvent || !msg.id) return;

    // 1. Emit DELIVERED acknowledgement immediately upon socket receipt
    onSendEvent({
      type: 'MESSAGE_DELIVERED',
      message_id: msg.id,
      channel_id: msg.channel_id,
      conversation_id: msg.conversation_id,
    });

    // 2. If user currently has this conversation open and active, also emit READ acknowledgement
    if (isConversationVisible) {
      onSendEvent({
        type: 'MESSAGE_READ',
        message_id: msg.id,
        channel_id: msg.channel_id,
        conversation_id: msg.conversation_id,
      });
    }
  }, [currentUserId, onSendEvent]);

  return {
    getMessageState,
    sendMessage,
    retryMessage,
    handleReceiptUpdate,
    acknowledgeIncomingMessage,
    setLifecycleState,
  };
}
