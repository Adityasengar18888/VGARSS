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
  theme = 'dark',
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

  const title = activeChannel
    ? `#${activeChannel.name}`
    : activeDm
    ? `@${activeDm.recipient.display_name || activeDm.recipient.username}`
    : 'Select a conversation';

  const subtitle = activeChannel
    ? activeChannel.topic
    : activeDm
    ? activeDm.recipient.presence_state === 'ONLINE'
      ? 'Active now'
      : 'Offline'
    : '';

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
    <div className="flex-1 flex flex-col bg-[#080808] text-[#F2F2F2] overflow-hidden relative font-sans" aria-label="Conversation Panel">
      {/* Top Header Bar */}
      <header className="h-12 border-b border-[#222222] px-4 flex items-center justify-between bg-[#0C0C0C] select-none flex-shrink-0 z-10">
        <div className="flex items-center space-x-2.5 truncate">
          <div className="flex items-center space-x-1.5 font-bold text-[#F2F2F2] text-xs truncate font-mono">
            {activeChannel && <Hash className="w-4 h-4 text-[#707070]" />}
            <span className="truncate">{title}</span>
          </div>
          {subtitle && (
            <>
              <span className="text-[#333333]">|</span>
              <span className="text-xs text-[#707070] truncate max-w-md">{subtitle}</span>
            </>
          )}
        </div>

        {/* Right utility buttons */}
        <div className="flex items-center space-x-2">
          {activeChannel?.channel_type === 'SIMULATION' && onNavigateToScheduler && (
            <button
              onClick={onNavigateToScheduler}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-[3px] bg-[#171717] hover:bg-[#222222] border border-[#292929] text-[#E8E8E8] text-xs font-mono transition active:scale-[0.97]"
              title="Open Live CPU Scheduler & Gantt Chart"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Scheduler View</span>
              <ArrowUpRight className="w-3 h-3 ml-0.5" />
            </button>
          )}

          <button
            onClick={onToggleRightDrawer}
            className={`p-1.5 rounded-[3px] transition active:scale-[0.97] ${
              isRightDrawerOpen
                ? 'bg-[#1C1C1C] text-[#F2F2F2] border border-[#333333]'
                : 'text-[#707070] hover:text-[#F2F2F2] hover:bg-[#141414]'
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
              className="text-xs font-mono text-[#A1A1A1] hover:text-white bg-[#141414] border border-[#242424] px-3 py-1 rounded-[3px] hover:border-[#383838] transition active:scale-[0.97]"
            >
              Load previous messages
            </button>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 select-none text-[#707070]">
            <div className="w-12 h-12 rounded-xl bg-[#111111] border border-[#242424] flex items-center justify-center mb-3 text-[#E8E8E8]">
              <Hash className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-[#F2F2F2]">Welcome to {title}!</h3>
            <p className="text-xs text-[#707070] max-w-sm mt-1">
              This is the start of the conversation. Send real-time messages or convert communications into OS simulation tasks.
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
                  className="flex items-center space-x-2 py-1.5 px-3 rounded bg-[#111111] border-l-2 border-[#E8E8E8] text-xs font-mono text-[#A1A1A1]"
                >
                  <span className="text-[#555555] text-[10px]">{timeStr}</span>
                  <span className="flex-1 text-[11px] text-[#F2F2F2]">{msg.content}</span>
                  {taskMatch && onSelectTaskId && (
                    <button
                      onClick={() => onSelectTaskId(taskMatch[1])}
                      className="px-2 py-0.5 rounded bg-[#171717] border border-[#292929] text-[10px] text-[#E8E8E8] font-bold hover:bg-[#222222] active:scale-[0.97] transition flex-shrink-0"
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
                className="group relative flex items-start space-x-3 hover:bg-[#111111]/70 -mx-2 px-2 py-1.5 rounded transition"
              >
                {/* Sender Avatar */}
                <div className="w-8 h-8 rounded-[3px] bg-[#171717] border border-[#292929] flex items-center justify-center text-xs font-bold font-mono text-[#F2F2F2] flex-shrink-0 mt-0.5">
                  {msg.sender_username ? msg.sender_username[0].toUpperCase() : 'U'}
                </div>

                {/* Message Body */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 flex-wrap">
                    <span className="font-bold text-xs text-[#F2F2F2] truncate">
                      {msg.sender_display_name || msg.sender_username || 'Anonymous'}
                    </span>
                    <span className="text-[10px] font-mono text-[#555555]">{timeStr}</span>
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

                  <div className="text-xs text-[#D8D8D8] mt-0.5 leading-relaxed break-words whitespace-pre-wrap max-w-[65ch]">
                    {msg.content}
                  </div>
                </div>

                {/* Floating Quick Action Bar */}
                <div className="opacity-0 group-hover:opacity-100 transition absolute right-2 -top-2 bg-[#171717] border border-[#292929] rounded-[3px] shadow-sm flex items-center p-0.5 space-x-0.5 z-10 font-mono text-[10px]">
                  <button
                    onClick={() => onOpenCreateTaskModal(msg.content, msg.id)}
                    className="px-2 py-0.5 hover:bg-[#222222] text-[#A1A1A1] hover:text-[#F2F2F2] rounded flex items-center space-x-1 active:scale-[0.97] transition"
                    title="Convert Message into OS Task"
                  >
                    <PlusCircle className="w-3 h-3 text-[#E8E8E8]" />
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
        <div className="px-4 py-1 text-[11px] text-[#707070] font-mono">
          {typingNames.join(', ')} {typingNames.length === 1 ? 'is' : 'are'} typing...
        </div>
      )}

      {/* Message Composer Dock */}
      <div className="p-3 border-t border-[#1E1E1E] bg-[#0A0A0A]">
        <form
          onSubmit={handleSubmit}
          className="relative rounded-[3px] bg-[#111111] border border-[#242424] focus-within:border-[#E8E8E8] transition shadow-xs"
        >
          <textarea
            value={inputContent}
            onChange={(e) => setInputContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${title}... (Enter to send, Shift+Enter for newline)`}
            rows={2}
            className="w-full bg-transparent px-3.5 py-2.5 text-xs text-[#F2F2F2] placeholder-[#555555] resize-none outline-none font-sans"
            disabled={!activeChannel && !activeDm}
          />

          {/* Composer Footer Actions */}
          <div className="flex items-center justify-between px-2.5 py-1.5 border-t border-[#1C1C1C] bg-[#0E0E0E] rounded-b-[3px]">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => onOpenCreateTaskModal(inputContent)}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-[2px] bg-[#171717] hover:bg-[#222222] text-[#E8E8E8] text-[10px] font-mono font-semibold border border-[#292929] active:scale-[0.97] transition"
                title="Create an OS Process Task"
              >
                <PlusCircle className="w-3 h-3 text-[#E8E8E8]" />
                <span>Create Task</span>
              </button>
              <span className="text-[10px] text-[#555555] font-mono hidden sm:inline">
                Supports bold, code snippets, and task dispatch
              </span>
            </div>

            <button
              type="submit"
              disabled={!inputContent.trim() || isSubmitting}
              className={`p-2 min-w-[34px] min-h-[34px] rounded-[3px] active:scale-[0.97] transition flex items-center justify-center ${
                inputContent.trim() && !isSubmitting
                  ? 'bg-[#E8E8E8] text-[#080808] hover:bg-white'
                  : 'bg-[#1C1C1C] text-[#555555] cursor-not-allowed'
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
