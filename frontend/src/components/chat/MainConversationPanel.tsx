import React, { useState, useRef, useEffect } from 'react';
import {
  Hash,
  Send,
  PlusCircle,
  Users,
  Cpu,
  ArrowUpRight,
} from 'lucide-react';
import { Channel, DirectConversation, ChatMessage } from '../../types/chat';
import { MessageLifecycleState } from '../../types/messageLifecycle';
import { MessageTransmissionAnimation } from './MessageTransmissionAnimation';

interface MainConversationPanelProps {
  activeChannel: Channel | null;
  activeDm: DirectConversation | null;
  messages: ChatMessage[];
  hasMoreMessages: boolean;
  onLoadOlderMessages: () => void;
  onSendMessage: (content: string, clientMsgId?: string) => Promise<void>;
  onOpenCreateTaskModal: (initialContent?: string, initialMessageId?: string) => void;
  onNavigateToScheduler?: () => void;
  onToggleRightDrawer: () => void;
  isRightDrawerOpen: boolean;
  activeTypers: Record<string, string>;
  onSendTyping: () => void;
  tasks?: any[];
  onSelectTaskId?: (taskId: string) => void;
  currentUserId?: string;
  getMessageState?: (msg: ChatMessage) => MessageLifecycleState;
  onRetryMessage?: (clientMsgId: string) => void;
  theme?: 'light' | 'dark';
}

export function MainConversationPanel({
  activeChannel,
  activeDm,
  messages,
  hasMoreMessages,
  onLoadOlderMessages,
  onSendMessage,
  onOpenCreateTaskModal,
  onNavigateToScheduler,
  onToggleRightDrawer,
  isRightDrawerOpen,
  activeTypers,
  onSendTyping,
  onSelectTaskId,
  currentUserId,
  getMessageState,
  onRetryMessage,
  theme = 'light',
}: MainConversationPanelProps) {
  const [inputContent, setInputContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const resolveLifecycleState = (msg: ChatMessage): MessageLifecycleState => {
    if (getMessageState) return getMessageState(msg);
    if (msg.delivery_status === 'READ') return 'read';
    if (msg.delivery_status === 'DELIVERED') return 'delivered';
    if (msg.status === 'pending' || msg.status === 'sending') return 'sending';
    if (msg.status === 'failed') return 'failed';
    if (msg.status === 'retrying') return 'retrying';
    if (msg.status === 'queued') return 'queued';
    return 'sent';
  };

  const title = activeChannel ? `#${activeChannel.name}` : activeDm ? `@${activeDm.recipient.display_name || activeDm.recipient.username}` : 'Select a conversation';
  const subtitle = activeChannel ? activeChannel.topic : activeDm ? (activeDm.recipient.presence_state === 'ONLINE' ? 'Active now' : 'Offline') : '';

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputContent.trim() || isSubmitting) return;

    const content = inputContent.trim();
    setInputContent('');
    setIsSubmitting(true);
    try {
      const clientMsgId = `cli-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      await onSendMessage(content, clientMsgId);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    } else {
      onSendTyping();
    }
  };

  const typingNames = Object.values(activeTypers);

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden relative" aria-label="Conversation Panel">
      {/* Top Header Bar */}
      <header className="h-12 border-b border-[#E4E7EC] px-4 flex items-center justify-between bg-white select-none flex-shrink-0 z-10 shadow-2xs">
        <div className="flex items-center space-x-2.5 truncate">
          <div className="flex items-center space-x-1.5 font-bold text-[#202631] text-xs truncate">
            {activeChannel && <Hash className="w-4 h-4 text-[#98A2B3]" />}
            <span className="truncate">{title}</span>
          </div>
          {subtitle && (
            <>
              <span className="text-[#D0D5DD]">|</span>
              <span className="text-xs text-[#667085] truncate max-w-md">{subtitle}</span>
            </>
          )}
        </div>

        {/* Right utility buttons */}
        <div className="flex items-center space-x-2">
          {activeChannel?.channel_type === 'SIMULATION' && onNavigateToScheduler && (
            <button
              onClick={onNavigateToScheduler}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-[#EEF2FF] hover:bg-[#E0E7FF] border border-[#C7D2FE] text-[#4055A8] text-xs font-semibold transition active:scale-[0.97]"
              title="Open Live CPU Scheduler & Gantt Chart"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Scheduler View</span>
              <ArrowUpRight className="w-3 h-3 ml-0.5" />
            </button>
          )}

          <button
            onClick={onToggleRightDrawer}
            className={`p-1.5 rounded-lg transition active:scale-[0.97] ${
              isRightDrawerOpen
                ? 'bg-[#EEF2FF] text-[#4055A8] border border-[#C7D2FE]'
                : 'text-[#667085] hover:text-[#202631] hover:bg-[#F2F4F7]'
            }`}
            title="Toggle Members & Tasks Drawer"
            aria-label="Toggle Context Drawer"
          >
            <Users className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Message Feed Stream */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
        role="log"
        aria-live="polite"
      >
        {/* Load older messages button */}
        {hasMoreMessages && (
          <div className="flex justify-center py-1">
            <button
              onClick={onLoadOlderMessages}
              className="text-xs font-mono text-[#4055A8] hover:text-[#334488] bg-[#F8FAFC] border border-[#D0D5DD] px-3 py-1 rounded-full hover:border-[#98A2B3] transition active:scale-[0.97]"
            >
              Load previous messages
            </button>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 select-none text-[#667085]">
            <div className="w-12 h-12 rounded-2xl bg-[#F8FAFC] border border-[#E4E7EC] flex items-center justify-center mb-3 text-[#4055A8]">
              <Hash className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-[#202631]">Welcome to {title}!</h3>
            <p className="text-xs text-[#667085] max-w-sm mt-1">
              This is the start of the conversation. You can send messages, collaborate with team members, or turn messages into OS simulation tasks.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isSystem = msg.message_type === 'SYSTEM_EVENT';
            const timeStr = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            if (isSystem) {
              const taskMatch = msg.content.match(/(TSK-[A-F0-9]+)/);
              return (
                <div
                  key={msg.id}
                  className="flex items-center space-x-2 py-1.5 px-3 rounded-lg bg-[#FEF6EE] border-l-2 border-[#B7791F] text-xs font-mono text-[#202631]"
                >
                  <span className="text-[#98A2B3] text-[10px]">{timeStr}</span>
                  <span className="flex-1 text-[11px]">{msg.content}</span>
                  {taskMatch && onSelectTaskId && (
                    <button
                      onClick={() => onSelectTaskId(taskMatch[1])}
                      className="px-2 py-0.5 rounded bg-white border border-[#D0D5DD] text-[10px] text-[#B7791F] font-bold hover:bg-[#F8FAFC] active:scale-[0.97] transition flex-shrink-0 shadow-2xs"
                    >
                      Task Detail &rarr;
                    </button>
                  )}
                </div>
              );
            }

            const isOutgoing = Boolean(
              (currentUserId && msg.sender_id === currentUserId) ||
              msg.status === 'pending' ||
              msg.status === 'sending' ||
              msg.status === 'queued' ||
              msg.status === 'retrying' ||
              msg.status === 'failed'
            );

            return (
              <div
                key={msg.id}
                className="group relative flex items-start space-x-3 hover:bg-[#F8FAFC] -mx-2 px-2 py-1.5 rounded-lg transition"
              >
                {/* Sender Avatar */}
                <div className="w-8 h-8 rounded-full bg-[#EEF2FF] border border-[#C7D2FE] flex items-center justify-center text-xs font-bold text-[#4055A8] flex-shrink-0 mt-0.5">
                  {msg.sender_username ? msg.sender_username[0].toUpperCase() : 'U'}
                </div>

                {/* Message Body */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 flex-wrap">
                    <span className="font-bold text-xs text-[#202631] truncate">
                      {msg.sender_display_name || msg.sender_username || 'Anonymous'}
                    </span>
                    <span className="text-[10px] font-mono text-[#98A2B3]">{timeStr}</span>
                    {isOutgoing && (
                      <MessageTransmissionAnimation
                        messageId={msg.id || msg.client_msg_id || 'opt'}
                        state={resolveLifecycleState(msg)}
                        isOutgoing={isOutgoing}
                        compact={false}
                        theme={theme}
                        onRetry={() => {
                          const retryId = msg.client_msg_id || msg.id;
                          if (onRetryMessage && retryId) onRetryMessage(retryId);
                        }}
                      />
                    )}
                  </div>

                  <div className="text-xs text-[#344054] mt-0.5 leading-relaxed break-words whitespace-pre-wrap max-w-[65ch]">
                    {msg.content}
                  </div>
                </div>

                {/* Floating Quick Action Bar */}
                <div className="opacity-0 group-hover:opacity-100 transition absolute right-2 -top-2 bg-white border border-[#E4E7EC] rounded-lg shadow-sm flex items-center p-0.5 space-x-0.5 z-10">
                  <button
                    onClick={() => onOpenCreateTaskModal(msg.content, msg.id)}
                    className="p-1 hover:bg-[#FEF6EE] text-[#475467] hover:text-[#B7791F] rounded text-[11px] flex items-center space-x-1 active:scale-[0.97] transition"
                    title="Convert Message into OS Task"
                  >
                    <PlusCircle className="w-3 h-3 text-[#B7791F]" />
                    <span>Create Task</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing Indicator Bar */}
      {typingNames.length > 0 && (
        <div className="px-4 py-1 text-[11px] text-[#667085] font-mono font-medium">
          {typingNames.join(', ')} {typingNames.length === 1 ? 'is' : 'are'} typing...
        </div>
      )}

      {/* Message Composer Dock */}
      <div className="p-3 border-t border-[#E4E7EC] bg-[#F8FAFC]">
        <form onSubmit={handleSubmit} className="relative rounded-xl bg-white border border-[#D0D5DD] focus-within:border-[#4055A8] focus-within:ring-1 focus-within:ring-[#4055A8] transition shadow-2xs">
          <textarea
            value={inputContent}
            onChange={(e) => setInputContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${title}... (Enter to send, Shift+Enter for newline)`}
            rows={2}
            className="w-full bg-transparent px-3 py-2 text-xs text-[#202631] placeholder-[#98A2B3] resize-none outline-none font-sans"
            disabled={!activeChannel && !activeDm}
          />

          {/* Composer Footer Actions */}
          <div className="flex items-center justify-between px-2.5 py-1.5 border-t border-[#F2F4F7] bg-[#FAFAFC] rounded-b-xl">
            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={() => onOpenCreateTaskModal(inputContent)}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-white hover:bg-[#FEF6EE] text-[#B7791F] text-[11px] font-semibold border border-[#D0D5DD] active:scale-[0.97] transition shadow-2xs"
                title="Create an OS Process Task"
              >
                <PlusCircle className="w-3 h-3 text-[#B7791F]" />
                <span>Create Task</span>
              </button>
              <span className="text-[10px] text-[#98A2B3] font-mono hidden sm:inline">
                Supports bold, code snippets, and task dispatch
              </span>
            </div>

            <button
              type="submit"
              disabled={!inputContent.trim() || isSubmitting}
              className={`p-2 min-w-[36px] min-h-[36px] rounded-lg active:scale-[0.97] transition ${
                inputContent.trim() && !isSubmitting
                  ? 'bg-[#4055A8] text-white hover:bg-[#334488]'
                  : 'bg-[#F2F4F7] text-[#98A2B3] cursor-not-allowed'
              }`}
              title="Send Message (Enter)"
              aria-label="Send Message"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
