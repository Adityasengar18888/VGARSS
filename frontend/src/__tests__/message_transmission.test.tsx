import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import { MessageDeliveryStatus } from '../components/chat/MessageDeliveryStatus';
import { MessageTransmissionAnimation } from '../components/chat/MessageTransmissionAnimation';
import { useMessageLifecycle } from '../hooks/useMessageLifecycle';
import { api } from '../services/api';
import { ChatMessage } from '../types/chat';

describe('MessageDeliveryStatus Component', () => {
  it('renders queued state with accessible title', () => {
    render(<MessageDeliveryStatus state="queued" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Message queued');
  });

  it('renders sending and retrying states with animated indicator', () => {
    const { rerender } = render(<MessageDeliveryStatus state="sending" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Sending message');

    rerender(<MessageDeliveryStatus state="retrying" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Retrying message');
  });

  it('renders sent, delivered, and read states with proper checkmarks', () => {
    const { rerender } = render(<MessageDeliveryStatus state="sent" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Message sent and confirmed by server');

    rerender(<MessageDeliveryStatus state="delivered" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Message delivered to recipient');

    rerender(<MessageDeliveryStatus state="read" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Message read by recipient');
  });

  it('renders failed state with retry button and calls onRetry', () => {
    const onRetry = vi.fn();
    render(<MessageDeliveryStatus state="failed" onRetry={onRetry} />);

    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Message failed to send');
    const retryBtn = screen.getByRole('button', { name: /retry/i });
    expect(retryBtn).toBeInTheDocument();

    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('MessageTransmissionAnimation Component', () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
  });

  it('renders SVG neural network graph with nodes and directed paths for active transmission', () => {
    const { container } = render(
      <MessageTransmissionAnimation
        messageId="msg-101"
        state="sending"
        theme="light"
      />
    );

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('aria-hidden', 'true');

    // Origin node (first circle) and intermediate/destination nodes
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBeGreaterThanOrEqual(4);

    // Edges (lines or paths)
    const lines = container.querySelectorAll('line');
    expect(lines.length).toBeGreaterThanOrEqual(3);
  });

  it('honors prefers-reduced-motion: reduce by rendering accessible static status instead of canvas', () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query.includes('prefers-reduced-motion: reduce'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { container } = render(
      <MessageTransmissionAnimation
        messageId="msg-reduced-1"
        state="sent"
        theme="light"
      />
    );

    // In reduced motion mode, it switches to static status indicator
    expect(screen.getByRole('status')).toBeInTheDocument();
    // No animating SVG graph rendered
    expect(container.querySelector('svg.overflow-visible')).not.toBeInTheDocument();
  });

  it('displays retry button when transmission state is failed', () => {
    const onRetry = vi.fn();
    render(
      <MessageTransmissionAnimation
        messageId="msg-fail-1"
        state="failed"
        onRetry={onRetry}
        theme="light"
      />
    );

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    expect(retryBtn).toBeInTheDocument();

    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('useMessageLifecycle Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('manages message sending lifecycle: sending -> sent', async () => {
    const mockPostChannel = vi.spyOn(api, 'postChannelMessage').mockResolvedValueOnce({
      id: 'srv-msg-1',
      workspace_id: 'ws-1',
      channel_id: 'ch-1',
      sender_id: 'user-alice',
      message_type: 'USER_TEXT',
      content: 'Synaptic Hello',
      created_at: new Date().toISOString(),
      delivery_status: 'SENT',
    } as ChatMessage);

    const { result } = renderHook(() =>
      useMessageLifecycle({ currentUserId: 'user-alice' })
    );

    let sentMsg: ChatMessage | undefined;
    await act(async () => {
      sentMsg = await result.current.sendMessage({
        content: 'Synaptic Hello',
        channelId: 'ch-1',
        clientMsgId: 'cli-test-1',
      });
    });

    expect(mockPostChannel).toHaveBeenCalledWith('ch-1', 'Synaptic Hello', 'cli-test-1');
    expect(sentMsg?.id).toBe('srv-msg-1');

    // Both client ID and server ID should reflect 'sent'
    expect(result.current.getMessageState({ client_msg_id: 'cli-test-1' } as ChatMessage)).toBe('sent');
    expect(result.current.getMessageState({ id: 'srv-msg-1' } as ChatMessage)).toBe('sent');
  });

  it('updates state to delivered and then read upon receiving receipts', () => {
    const { result } = renderHook(() =>
      useMessageLifecycle({ currentUserId: 'user-alice' })
    );

    act(() => {
      result.current.setLifecycleState('msg-rec-1', 'sent');
    });
    expect(result.current.getMessageState({ id: 'msg-rec-1' } as ChatMessage)).toBe('sent');

    // Receive DELIVERED event
    act(() => {
      result.current.handleReceiptUpdate({
        message_id: 'msg-rec-1',
        status: 'delivered',
        channel_id: 'ch-1',
        timestamp: new Date().toISOString(),
      });
    });
    expect(result.current.getMessageState({ id: 'msg-rec-1' } as ChatMessage)).toBe('delivered');

    // Receive READ event
    act(() => {
      result.current.handleReceiptUpdate({
        message_id: 'msg-rec-1',
        status: 'read',
        channel_id: 'ch-1',
        timestamp: new Date().toISOString(),
      });
    });
    expect(result.current.getMessageState({ id: 'msg-rec-1' } as ChatMessage)).toBe('read');

    // Later redundant DELIVERED should not downgrade READ
    act(() => {
      result.current.handleReceiptUpdate({
        message_id: 'msg-rec-1',
        status: 'delivered',
        channel_id: 'ch-1',
        timestamp: new Date().toISOString(),
      });
    });
    expect(result.current.getMessageState({ id: 'msg-rec-1' } as ChatMessage)).toBe('read');
  });

  it('recipient client automatically acknowledges incoming peer messages', () => {
    const onSendEvent = vi.fn().mockReturnValue(true);
    const { result } = renderHook(() =>
      useMessageLifecycle({ currentUserId: 'user-bob', onSendEvent })
    );

    const peerMessage: ChatMessage = {
      id: 'msg-from-alice',
      workspace_id: 'ws-1',
      channel_id: 'ch-1',
      sender_id: 'user-alice', // peer
      message_type: 'USER_TEXT',
      content: 'Hey Bob!',
      reply_count: 0,
      is_edited: false,
      is_pinned: false,
      seq: 1,
      created_at: new Date().toISOString(),
    };

    act(() => {
      result.current.acknowledgeIncomingMessage(peerMessage, true);
    });

    // Should emit both MESSAGE_DELIVERED and MESSAGE_READ
    expect(onSendEvent).toHaveBeenCalledWith({
      type: 'MESSAGE_DELIVERED',
      message_id: 'msg-from-alice',
      channel_id: 'ch-1',
      conversation_id: undefined,
    });
    expect(onSendEvent).toHaveBeenCalledWith({
      type: 'MESSAGE_READ',
      message_id: 'msg-from-alice',
      channel_id: 'ch-1',
      conversation_id: undefined,
    });
  });

  it('recipient does NOT acknowledge own messages', () => {
    const onSendEvent = vi.fn();
    const { result } = renderHook(() =>
      useMessageLifecycle({ currentUserId: 'user-alice', onSendEvent })
    );

    const ownMessage: ChatMessage = {
      id: 'msg-own',
      workspace_id: 'ws-1',
      channel_id: 'ch-1',
      sender_id: 'user-alice', // self
      message_type: 'USER_TEXT',
      content: 'Self note',
      reply_count: 0,
      is_edited: false,
      is_pinned: false,
      seq: 2,
      created_at: new Date().toISOString(),
    };

    act(() => {
      result.current.acknowledgeIncomingMessage(ownMessage, true);
    });

    expect(onSendEvent).not.toHaveBeenCalled();
  });

  it('retries failed message with the exact same clientMsgId', async () => {
    const mockPostDm = vi.spyOn(api, 'postDmMessage')
      .mockRejectedValueOnce(new Error('Network offline'))
      .mockResolvedValueOnce({
        id: 'srv-dm-1',
        workspace_id: 'ws-1',
        conversation_id: 'dm-1',
        sender_id: 'user-alice',
        message_type: 'USER_TEXT',
        content: 'Trying again',
        created_at: new Date().toISOString(),
        delivery_status: 'SENT',
      } as ChatMessage);

    const { result } = renderHook(() =>
      useMessageLifecycle({ currentUserId: 'user-alice' })
    );

    // Initial send fails
    await act(async () => {
      try {
        await result.current.sendMessage({
          content: 'Trying again',
          conversationId: 'dm-1',
          clientMsgId: 'cli-retry-1',
        });
      } catch {
        // expected
      }
    });

    expect(result.current.getMessageState({ client_msg_id: 'cli-retry-1' } as ChatMessage)).toBe('failed');

    // Retry sending
    await act(async () => {
      await result.current.retryMessage('cli-retry-1');
    });

    expect(mockPostDm).toHaveBeenCalledTimes(2);
    expect(mockPostDm).toHaveBeenNthCalledWith(2, 'dm-1', 'Trying again', 'cli-retry-1');
    expect(result.current.getMessageState({ client_msg_id: 'cli-retry-1' } as ChatMessage)).toBe('sent');
  });
});
