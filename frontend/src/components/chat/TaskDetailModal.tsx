import { useState } from 'react';
import {
  X,
  Cpu,
  User,
  Layers,
  ArrowRight,
  MessageSquare,
  AlertTriangle,
  Lock,
  Unlock,
  AlertOctagon,
} from 'lucide-react';
import { TaskItem, WorkspaceMember, WorkspaceResource } from '../../types/chat';

interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: TaskItem | null;
  members: WorkspaceMember[];
  availableResources: WorkspaceResource[];
  onUpdateStatus: (taskId: string, newStatus: string, action?: string) => Promise<void>;
  onAssignUser: (taskId: string, userId: string) => Promise<void>;
  onAcquireResource: (taskId: string, resourceId: string, mode: 'EXCLUSIVE' | 'SHARED') => Promise<void>;
  onReleaseResource: (taskId: string, resourceId: string) => Promise<void>;
  onNavigateToConversation: (channelId?: string | null, messageId?: string | null) => void;
  onNavigateToScheduler: () => void;
  onNavigateToDeadlock: () => void;
}

export function TaskDetailModal({
  isOpen,
  onClose,
  task,
  members,
  availableResources,
  onUpdateStatus,
  onAssignUser,
  onAcquireResource,
  onReleaseResource,
  onNavigateToConversation,
  onNavigateToScheduler,
  onNavigateToDeadlock,
}: TaskDetailModalProps) {
  const [selectedResId, setSelectedResId] = useState<string>('');
  const [selectedMode, setSelectedMode] = useState<'EXCLUSIVE' | 'SHARED'>('EXCLUSIVE');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!isOpen || !task) return null;

  const priorityColor =
    task.priority === 'CRITICAL'
      ? 'text-[#EF4444] bg-[#1E0F0F] border-[#441C1C]'
      : task.priority === 'HIGH'
      ? 'text-[#F59E0B] bg-[#1E180E] border-[#423018]'
      : task.priority === 'MEDIUM'
      ? 'text-[#E8E8E8] bg-[#1E1E1E] border-[#383838]'
      : 'text-[#A1A1A1] bg-[#141414] border-[#292929]';

  const statusColor =
    task.status === 'RUNNING'
      ? 'text-[#22C55E] bg-[#0E1E12] border-[#1C4424]'
      : task.status === 'READY'
      ? 'text-[#F59E0B] bg-[#1E180E] border-[#423018]'
      : task.status === 'WAITING'
      ? 'text-[#EF4444] bg-[#1E0F0F] border-[#441C1C]'
      : task.status === 'TERMINATED'
      ? 'text-[#707070] bg-[#141414] border-[#292929]'
      : 'text-[#E8E8E8] bg-[#1A1A1A] border-[#333333]';

  const handleAcquire = async () => {
    if (!selectedResId) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      await onAcquireResource(task.id, selectedResId, selectedMode);
      setSelectedResId('');
    } catch (e: any) {
      setActionError(e.message || 'Failed to acquire resource.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRelease = async (resId: string) => {
    setIsSubmitting(true);
    setActionError(null);
    try {
      await onReleaseResource(task.id, resId);
    } catch (e: any) {
      setActionError(e.message || 'Failed to release resource.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (newStatus: string, action?: string) => {
    setIsSubmitting(true);
    setActionError(null);
    try {
      await onUpdateStatus(task.id, newStatus, action);
    } catch (e: any) {
      setActionError(e.message || 'Failed to update task status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in select-none"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl bg-[#111111] border border-[#292929] rounded-[4px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden font-mono">
        {/* Header */}
        <div className="h-14 border-b border-[#222222] px-5 flex items-center justify-between bg-[#141414]">
          <div className="flex items-center space-x-3">
            <span className="font-mono text-xs text-[#F2F2F2] font-bold bg-[#1C1C1C] px-2 py-0.5 rounded-[2px] border border-[#333333]">
              {task.id}
            </span>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-[2px] border ${statusColor}`}>
              {task.status}
            </span>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-[2px] border ${priorityColor}`}>
              {task.priority}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded text-[#707070] hover:text-[#F2F2F2] transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {actionError && (
            <div className="p-3 rounded-[3px] bg-[#1E0F0F] border border-[#441C1C] text-xs text-[#EF4444] flex items-center space-x-2">
              <AlertOctagon className="w-4 h-4 flex-shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          {/* Title & Description */}
          <div>
            <h2 className="text-base font-bold text-[#F2F2F2] font-sans">{task.title}</h2>
            {task.description && (
              <p className="mt-1 text-xs text-[#A1A1A1] leading-relaxed max-w-[65ch] font-sans">{task.description}</p>
            )}
          </div>

          {/* Source Conversation Link Banner */}
          <div className="p-3.5 rounded-[3px] bg-[#171717] border border-[#292929] flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <MessageSquare className="w-4 h-4 text-[#A1A1A1]" />
              <div>
                <div className="text-xs font-semibold text-[#F2F2F2]">Originating Conversation</div>
                <div className="text-[11px] text-[#707070] font-mono">
                  Created from chat message by {task.creator_name}
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                onClose();
                onNavigateToConversation(task.channel_id, task.source_message_id);
              }}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-[3px] bg-[#E8E8E8] hover:bg-white text-[#080808] text-xs font-bold uppercase transition active:scale-95 shadow-xs"
            >
              <span>Go to Chat</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Process Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-2.5 rounded-[3px] bg-[#171717] border border-[#292929]">
              <div className="text-[10px] font-mono uppercase text-[#707070]">Arrival Tick</div>
              <div className="text-sm font-bold text-[#F2F2F2] font-mono mt-0.5">
                {task.arrival_time ?? 0}
              </div>
            </div>

            <div className="p-2.5 rounded-[3px] bg-[#171717] border border-[#292929]">
              <div className="text-[10px] font-mono uppercase text-[#707070]">Burst Ticks</div>
              <div className="text-sm font-bold text-[#F2F2F2] font-mono mt-0.5">
                {task.estimated_burst_ticks}
              </div>
            </div>

            <div className="p-2.5 rounded-[3px] bg-[#171717] border border-[#292929]">
              <div className="text-[10px] font-mono uppercase text-[#707070]">Remaining Ticks</div>
              <div className="text-sm font-bold text-[#F59E0B] font-mono mt-0.5">
                {task.remaining_burst_ticks ?? task.estimated_burst_ticks}
              </div>
            </div>

            <div className="p-2.5 rounded-[3px] bg-[#171717] border border-[#292929]">
              <div className="text-[10px] font-mono uppercase text-[#707070]">Waiting Time</div>
              <div className="text-sm font-bold text-[#E8E8E8] font-mono mt-0.5">
                {task.waiting_ticks ?? 0} ticks
              </div>
            </div>
          </div>

          {/* Assignee & Owner Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-[11px] font-mono font-semibold uppercase text-[#707070] mb-1.5">
                Task Owner / Creator
              </label>
              <div className="flex items-center space-x-2 px-3 py-2 rounded-[3px] bg-[#171717] border border-[#292929] text-xs text-[#F2F2F2]">
                <User className="w-3.5 h-3.5 text-[#A1A1A1]" />
                <span className="font-medium">{task.creator_name}</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono font-semibold uppercase text-[#707070] mb-1.5">
                Assigned Member
              </label>
              <select
                value={task.assignee_id || ''}
                onChange={(e) => onAssignUser(task.id, e.target.value)}
                className="w-full px-3 py-2 rounded-[3px] bg-[#141414] border border-[#292929] text-xs text-[#F2F2F2] focus:border-[#E8E8E8] outline-none transition"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.display_name || m.username} ({m.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Resources & Synchronization Section */}
          <div className="p-4 rounded-[3px] bg-[#171717] border border-[#292929] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-bold text-[#F2F2F2]">
                <Layers className="w-4 h-4 text-[#A1A1A1]" />
                <span>Synchronized Shared Resources</span>
              </div>
              <button
                onClick={() => {
                  onClose();
                  onNavigateToDeadlock();
                }}
                className="text-[11px] text-[#EF4444] hover:text-[#F87171] font-semibold flex items-center space-x-1"
              >
                <AlertTriangle className="w-3 h-3" />
                <span>Deadlock Lab</span>
              </button>
            </div>

            {/* Held Resources */}
            <div>
              <div className="text-[11px] font-mono text-[#707070] mb-1">Currently Held Locks:</div>
              {task.held_resources && task.held_resources.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {task.held_resources.map((resId) => {
                    const resObj = availableResources.find((r) => r.id === resId);
                    return (
                      <span
                        key={resId}
                        className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-[2px] bg-[#0E1E12] border border-[#1C4424] text-[#22C55E] text-xs font-mono font-semibold"
                      >
                        <Lock className="w-3 h-3" />
                        <span>{resObj ? resObj.name : resId}</span>
                        <button
                          onClick={() => handleRelease(resId)}
                          disabled={isSubmitting}
                          className="ml-1 text-[#707070] hover:text-[#EF4444]"
                          title="Release Resource"
                        >
                          <Unlock className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-[#707070]">No resources currently held by this task.</div>
              )}
            </div>

            {/* Acquire Resource Inline Form */}
            {task.status !== 'TERMINATED' && (
              <div className="pt-2 border-t border-[#292929] flex items-center space-x-2">
                <select
                  value={selectedResId}
                  onChange={(e) => setSelectedResId(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 rounded-[2px] bg-[#141414] border border-[#292929] text-xs text-[#F2F2F2] focus:border-[#E8E8E8] outline-none"
                >
                  <option value="">Select Resource to Acquire...</option>
                  {availableResources.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.resource_type}, {r.available_units}/{r.total_capacity} free)
                    </option>
                  ))}
                </select>

                <select
                  value={selectedMode}
                  onChange={(e) => setSelectedMode(e.target.value as any)}
                  className="px-2.5 py-1.5 rounded-[2px] bg-[#141414] border border-[#292929] text-xs text-[#F2F2F2] focus:border-[#E8E8E8] outline-none"
                >
                  <option value="EXCLUSIVE">EXCLUSIVE (Mutex)</option>
                  <option value="SHARED">SHARED (Semaphore)</option>
                </select>

                <button
                  onClick={handleAcquire}
                  disabled={!selectedResId || isSubmitting}
                  className="px-3 py-1.5 rounded-[2px] bg-[#222222] hover:bg-[#2A2A2A] border border-[#333333] disabled:opacity-50 text-[#F2F2F2] text-xs font-semibold transition active:scale-95"
                >
                  Acquire
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="h-16 border-t border-[#222222] px-5 flex items-center justify-between bg-[#141414]">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                onClose();
                onNavigateToScheduler();
              }}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-[3px] border border-[#333333] bg-[#171717] hover:bg-[#222222] text-xs font-semibold text-[#F2F2F2] transition active:scale-95"
            >
              <Cpu className="w-3.5 h-3.5 text-[#A1A1A1]" />
              <span>CPU Scheduler</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            {task.status === 'NEW' && (
              <button
                onClick={() => handleStatusChange('READY', 'ADMIT')}
                disabled={isSubmitting}
                className="px-3.5 py-1.5 rounded-[3px] bg-[#16805D] hover:bg-[#0E543D] text-white text-xs font-semibold active:scale-95 transition"
              >
                Admit to READY
              </button>
            )}

            {task.status === 'READY' && (
              <button
                onClick={() => handleStatusChange('RUNNING', 'DISPATCH')}
                disabled={isSubmitting}
                className="px-3.5 py-1.5 rounded-[3px] bg-[#E8E8E8] hover:bg-white text-[#080808] text-xs font-bold active:scale-95 transition"
              >
                Dispatch to CPU
              </button>
            )}

            {task.status === 'RUNNING' && (
              <button
                onClick={() => handleStatusChange('TERMINATED', 'COMPLETE')}
                disabled={isSubmitting}
                className="px-3.5 py-1.5 rounded-[3px] bg-[#16805D] hover:bg-[#0E543D] text-white text-xs font-semibold active:scale-95 transition"
              >
                Complete Task
              </button>
            )}

            {task.status !== 'TERMINATED' && (
              <button
                onClick={() => handleStatusChange('TERMINATED', 'CANCEL')}
                disabled={isSubmitting}
                className="px-3.5 py-1.5 rounded-[3px] border border-[#441C1C] bg-[#1E0F0F] hover:bg-[#2A1414] text-[#EF4444] text-xs font-semibold active:scale-95 transition"
              >
                Abort Task
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
