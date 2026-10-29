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
      ? 'text-[#B42318] bg-[#FEF3F2] border-[#FECDCA]'
      : task.priority === 'HIGH'
      ? 'text-[#B7791F] bg-[#FEF6EE] border-[#FEDF89]'
      : task.priority === 'MEDIUM'
      ? 'text-[#4055A8] bg-[#EEF2FF] border-[#C7D2FE]'
      : 'text-[#475467] bg-[#F2F4F7] border-[#E4E7EC]';

  const statusColor =
    task.status === 'RUNNING'
      ? 'text-[#16805D] bg-[#ECFDF3] border-[#A6F4C5]'
      : task.status === 'READY'
      ? 'text-[#B7791F] bg-[#FEF6EE] border-[#FEDF89]'
      : task.status === 'WAITING'
      ? 'text-[#C0393A] bg-[#FEF3F2] border-[#FECDCA]'
      : task.status === 'TERMINATED'
      ? 'text-[#475467] bg-[#F2F4F7] border-[#E4E7EC]'
      : 'text-[#4055A8] bg-[#EEF2FF] border-[#C7D2FE]';

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in select-none"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl bg-white border border-[#E4E7EC] rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="h-14 border-b border-[#E4E7EC] px-5 flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center space-x-3">
            <span className="font-mono text-xs text-[#4055A8] font-bold bg-[#EEF2FF] px-2 py-0.5 rounded border border-[#C7D2FE]">
              {task.id}
            </span>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${statusColor}`}>
              {task.status}
            </span>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${priorityColor}`}>
              {task.priority}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded text-[#667085] hover:text-[#202631] transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {actionError && (
            <div className="p-3 rounded-lg bg-[#FEF3F2] border border-[#FECDCA] text-xs text-[#B42318] flex items-center space-x-2">
              <AlertOctagon className="w-4 h-4 flex-shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          {/* Title & Description */}
          <div>
            <h2 className="text-base font-bold text-[#202631]">{task.title}</h2>
            {task.description && (
              <p className="mt-1 text-xs text-[#667085] leading-relaxed max-w-[65ch]">{task.description}</p>
            )}
          </div>

          {/* Source Conversation Link Banner */}
          <div className="p-3.5 rounded-lg bg-[#F8FAFC] border border-[#E4E7EC] flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <MessageSquare className="w-4 h-4 text-[#4055A8]" />
              <div>
                <div className="text-xs font-semibold text-[#202631]">Originating Conversation</div>
                <div className="text-[11px] text-[#667085] font-mono">
                  Created from chat message by {task.creator_name}
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                onClose();
                onNavigateToConversation(task.channel_id, task.source_message_id);
              }}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-[#4055A8] hover:bg-[#334488] text-white text-xs font-semibold transition active:scale-[0.97]"
            >
              <span>Go to Chat</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Process Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E4E7EC]">
              <div className="text-[10px] font-mono uppercase text-[#667085]">Arrival Tick</div>
              <div className="text-sm font-bold text-[#202631] font-mono mt-0.5">
                {task.arrival_time ?? 0}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E4E7EC]">
              <div className="text-[10px] font-mono uppercase text-[#667085]">Burst Ticks</div>
              <div className="text-sm font-bold text-[#202631] font-mono mt-0.5">
                {task.estimated_burst_ticks}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E4E7EC]">
              <div className="text-[10px] font-mono uppercase text-[#667085]">Remaining Ticks</div>
              <div className="text-sm font-bold text-[#B7791F] font-mono mt-0.5">
                {task.remaining_burst_ticks ?? task.estimated_burst_ticks}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E4E7EC]">
              <div className="text-[10px] font-mono uppercase text-[#667085]">Waiting Time</div>
              <div className="text-sm font-bold text-[#4055A8] font-mono mt-0.5">
                {task.waiting_ticks ?? 0} ticks
              </div>
            </div>
          </div>

          {/* Assignee & Owner Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-[11px] font-mono font-semibold uppercase text-[#667085] mb-1.5">
                Task Owner / Creator
              </label>
              <div className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#E4E7EC] text-xs text-[#202631]">
                <User className="w-3.5 h-3.5 text-[#4055A8]" />
                <span className="font-medium">{task.creator_name}</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono font-semibold uppercase text-[#667085] mb-1.5">
                Assigned Member
              </label>
              <select
                value={task.assignee_id || ''}
                onChange={(e) => onAssignUser(task.id, e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white border border-[#D0D5DD] text-xs text-[#202631] focus:border-[#4055A8] outline-none transition"
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
          <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E4E7EC] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-bold text-[#202631]">
                <Layers className="w-4 h-4 text-[#B7791F]" />
                <span>Synchronized Shared Resources</span>
              </div>
              <button
                onClick={() => {
                  onClose();
                  onNavigateToDeadlock();
                }}
                className="text-[11px] text-[#C0393A] hover:text-[#912018] font-semibold flex items-center space-x-1"
              >
                <AlertTriangle className="w-3 h-3" />
                <span>Deadlock Lab</span>
              </button>
            </div>

            {/* Held Resources */}
            <div>
              <div className="text-[11px] font-mono text-[#667085] mb-1">Currently Held Locks:</div>
              {task.held_resources && task.held_resources.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {task.held_resources.map((resId) => {
                    const resObj = availableResources.find((r) => r.id === resId);
                    return (
                      <span
                        key={resId}
                        className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-[#ECFDF3] border border-[#A6F4C5] text-[#16805D] text-xs font-mono font-semibold"
                      >
                        <Lock className="w-3 h-3" />
                        <span>{resObj ? resObj.name : resId}</span>
                        <button
                          onClick={() => handleRelease(resId)}
                          disabled={isSubmitting}
                          className="ml-1 text-[#667085] hover:text-[#C0393A]"
                          title="Release Resource"
                        >
                          <Unlock className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-[#98A2B3]">No resources currently held by this task.</div>
              )}
            </div>

            {/* Acquire Resource Inline Form */}
            {task.status !== 'TERMINATED' && (
              <div className="pt-2 border-t border-[#E4E7EC] flex items-center space-x-2">
                <select
                  value={selectedResId}
                  onChange={(e) => setSelectedResId(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-white border border-[#D0D5DD] text-xs text-[#202631] focus:border-[#4055A8] outline-none"
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
                  className="px-2.5 py-1.5 rounded-lg bg-white border border-[#D0D5DD] text-xs text-[#202631] focus:border-[#4055A8] outline-none"
                >
                  <option value="EXCLUSIVE">EXCLUSIVE (Mutex)</option>
                  <option value="SHARED">SHARED (Semaphore)</option>
                </select>

                <button
                  onClick={handleAcquire}
                  disabled={!selectedResId || isSubmitting}
                  className="px-3 py-1.5 rounded-lg bg-[#B7791F] hover:bg-[#936118] disabled:opacity-50 text-white text-xs font-semibold transition active:scale-[0.97]"
                >
                  Acquire
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="h-16 border-t border-[#E4E7EC] px-5 flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                onClose();
                onNavigateToScheduler();
              }}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-[#D0D5DD] bg-white hover:bg-[#F2F4F7] text-xs font-semibold text-[#202631] transition active:scale-[0.97]"
            >
              <Cpu className="w-3.5 h-3.5 text-[#4055A8]" />
              <span>CPU Scheduler</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            {task.status === 'NEW' && (
              <button
                onClick={() => handleStatusChange('READY', 'ADMIT')}
                disabled={isSubmitting}
                className="px-3.5 py-1.5 rounded-lg bg-[#16805D] hover:bg-[#0E543D] text-white text-xs font-semibold active:scale-[0.97] transition"
              >
                Admit to READY
              </button>
            )}

            {task.status === 'READY' && (
              <button
                onClick={() => handleStatusChange('RUNNING', 'DISPATCH')}
                disabled={isSubmitting}
                className="px-3.5 py-1.5 rounded-lg bg-[#4055A8] hover:bg-[#334488] text-white text-xs font-semibold active:scale-[0.97] transition"
              >
                Dispatch to CPU
              </button>
            )}

            {task.status === 'RUNNING' && (
              <button
                onClick={() => handleStatusChange('TERMINATED', 'COMPLETE')}
                disabled={isSubmitting}
                className="px-3.5 py-1.5 rounded-lg bg-[#16805D] hover:bg-[#0E543D] text-white text-xs font-semibold active:scale-[0.97] transition"
              >
                Complete Task
              </button>
            )}

            {task.status !== 'TERMINATED' && (
              <button
                onClick={() => handleStatusChange('TERMINATED', 'CANCEL')}
                disabled={isSubmitting}
                className="px-3.5 py-1.5 rounded-lg border border-[#FECDCA] bg-[#FEF3F2] hover:bg-[#FEE4E2] text-[#B42318] text-xs font-semibold active:scale-[0.97] transition"
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
