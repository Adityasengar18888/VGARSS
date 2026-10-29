import { useState } from 'react';
import { MessageSquare, Plus, Cpu, X } from 'lucide-react';
import { WorkspaceMember, TaskItem } from '../../types/chat';

interface RightDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  members: WorkspaceMember[];
  tasks: TaskItem[];
  onOpenDmWithUser: (userId: string) => void;
  onOpenCreateTask: () => void;
  onUpdateTaskStatus: (taskId: string, status: string) => void;
  onNavigateToScheduler: () => void;
  onSelectTask?: (task: TaskItem) => void;
}

export function RightDrawer({
  isOpen,
  onClose,
  members,
  tasks,
  onOpenDmWithUser,
  onOpenCreateTask,
  onUpdateTaskStatus,
  onNavigateToScheduler,
  onSelectTask,
}: RightDrawerProps) {
  const [activeTab, setActiveTab] = useState<'members' | 'tasks'>('members');

  if (!isOpen) return null;

  const onlineMembers = members.filter((m) => m.presence_state === 'ONLINE');
  const offlineMembers = members.filter((m) => m.presence_state !== 'ONLINE');

  return (
    <aside
      className="w-64 bg-[#0D0D0D] border-l border-[#222222] flex flex-col select-none flex-shrink-0 z-10 font-sans"
      aria-label="Context Information Drawer"
    >
      {/* Header Tabs */}
      <div className="h-12 border-b border-[#222222] px-3 flex items-center justify-between bg-[#0C0C0C]">
        <div className="flex items-center space-x-1 font-mono">
          <button
            onClick={() => setActiveTab('members')}
            className={`px-2 py-1 rounded-[2px] text-[11px] font-semibold transition active:scale-[0.97] ${
              activeTab === 'members'
                ? 'bg-[#1C1C1C] text-[#F2F2F2] border border-[#333333]'
                : 'text-[#707070] hover:text-[#F2F2F2]'
            }`}
          >
            Members ({members.length})
          </button>
          <button
            onClick={() => setActiveTab('tasks')}
            className={`px-2 py-1 rounded-[2px] text-[11px] font-semibold transition active:scale-[0.97] ${
              activeTab === 'tasks'
                ? 'bg-[#1C1C1C] text-[#F2F2F2] border border-[#333333]'
                : 'text-[#707070] hover:text-[#F2F2F2]'
            }`}
          >
            Tasks ({tasks.length})
          </button>
        </div>

        <button
          onClick={onClose}
          className="text-[#707070] hover:text-[#F2F2F2] p-1 rounded hover:bg-[#1A1A1A] transition"
          title="Close Drawer"
          aria-label="Close Drawer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content Stream */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 no-scrollbar">
        {activeTab === 'members' ? (
          <>
            {/* Online Members */}
            <div>
              <div className="text-[10px] font-mono font-semibold uppercase tracking-technical text-[#707070] mb-1.5">
                Online — {onlineMembers.length}
              </div>
              <div className="space-y-1">
                {onlineMembers.map((m) => (
                  <div
                    key={m.user_id}
                    onClick={() => onOpenDmWithUser(m.user_id)}
                    className="flex items-center justify-between p-1.5 rounded-[3px] hover:bg-[#141414] transition group cursor-pointer"
                    title={`Click to send direct message to ${m.display_name || m.username}`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <span className="relative flex-shrink-0">
                        <span className="w-6 h-6 rounded-full bg-[#171717] border border-[#292929] flex items-center justify-center text-[10px] font-mono font-bold text-[#F2F2F2]">
                          {m.username[0].toUpperCase()}
                        </span>
                        <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-[#22C55E] border border-[#0D0D0D]" />
                      </span>
                      <div className="truncate">
                        <div className="text-xs font-semibold text-[#F2F2F2] truncate">
                          {m.display_name || m.username}
                        </div>
                        <div className="text-[9px] text-[#707070] font-mono uppercase">{m.role}</div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDmWithUser(m.user_id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[#222222] text-[#707070] hover:text-[#F2F2F2] transition"
                      title={`Direct message ${m.username}`}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Offline Members */}
            {offlineMembers.length > 0 && (
              <div>
                <div className="text-[10px] font-mono font-semibold uppercase tracking-technical text-[#555555] mb-1.5">
                  Offline — {offlineMembers.length}
                </div>
                <div className="space-y-1">
                  {offlineMembers.map((m) => (
                    <div
                      key={m.user_id}
                      onClick={() => onOpenDmWithUser(m.user_id)}
                      className="flex items-center justify-between p-1.5 rounded-[3px] hover:bg-[#141414] transition group opacity-60 hover:opacity-100 cursor-pointer"
                      title={`Click to send direct message to ${m.display_name || m.username}`}
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <span className="relative flex-shrink-0">
                          <span className="w-6 h-6 rounded-full bg-[#141414] border border-[#222222] flex items-center justify-center text-[10px] font-mono font-bold text-[#707070]">
                            {m.username[0].toUpperCase()}
                          </span>
                          <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-[#555555] border border-[#0D0D0D]" />
                        </span>
                        <div className="truncate">
                          <div className="text-xs font-semibold text-[#A1A1A1] truncate">
                            {m.display_name || m.username}
                          </div>
                          <div className="text-[9px] text-[#555555] font-mono uppercase">{m.role}</div>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenDmWithUser(m.user_id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[#222222] text-[#707070] hover:text-[#F2F2F2] transition"
                        title={`Direct message ${m.username}`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          /* Tasks Tab */
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-semibold uppercase tracking-technical text-[#707070]">
                Coordinated Tasks
              </span>
              <button
                onClick={onOpenCreateTask}
                className="flex items-center space-x-1 text-[11px] font-mono font-semibold text-[#E8E8E8] hover:text-white transition active:scale-[0.97]"
              >
                <Plus className="w-3 h-3" />
                <span>New Task</span>
              </button>
            </div>

            {tasks.length === 0 ? (
              <div className="text-center py-6 text-[#555555] text-xs font-mono">
                No active tasks. Convert a chat message to create one!
              </div>
            ) : (
              tasks.map((t) => {
                const isCritical = t.priority === 'CRITICAL';
                const isHigh = t.priority === 'HIGH';

                return (
                  <div
                    key={t.id}
                    className="p-2.5 rounded-[3px] bg-[#111111] border border-[#222222] space-y-1.5 hover:border-[#333333] transition"
                  >
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => onSelectTask?.(t)}
                        className="font-mono text-[10px] text-[#A1A1A1] hover:text-[#F2F2F2] font-bold"
                        title="View Task Details"
                      >
                        {t.id}
                      </button>
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.2 rounded border font-semibold ${
                          isCritical
                            ? 'text-[#EF4444] bg-[#221212] border-[#441A1A]'
                            : isHigh
                            ? 'text-[#F59E0B] bg-[#221B10] border-[#44331A]'
                            : 'text-[#A1A1A1] bg-[#171717] border-[#292929]'
                        }`}
                      >
                        {t.priority}
                      </span>
                    </div>

                    <button
                      onClick={() => onSelectTask?.(t)}
                      className="text-xs font-semibold text-[#F2F2F2] line-clamp-2 text-left hover:text-[#E8E8E8] transition w-full"
                    >
                      {t.title}
                    </button>

                    <div className="flex items-center justify-between text-[10px] text-[#707070] font-mono">
                      <span>Est: {t.estimated_burst_ticks} ticks</span>
                      <span className="px-1.5 py-0.2 rounded border border-[#292929] bg-[#141414] text-[#A1A1A1] font-semibold">
                        {t.status}
                      </span>
                    </div>

                    {/* Quick State Actions */}
                    <div className="pt-1.5 flex items-center justify-between border-t border-[#1C1C1C] font-mono text-[10px]">
                      <button
                        onClick={onNavigateToScheduler}
                        className="text-[#A1A1A1] hover:text-white flex items-center space-x-1"
                      >
                        <Cpu className="w-3 h-3" />
                        <span>Scheduler</span>
                      </button>

                      {t.status === 'NEW' && (
                        <button
                          onClick={() => onUpdateTaskStatus(t.id, 'READY')}
                          className="text-[#22C55E] hover:text-white font-bold active:scale-[0.97] transition"
                        >
                          Admit to READY
                        </button>
                      )}
                      {t.status === 'READY' && (
                        <button
                          onClick={() => onUpdateTaskStatus(t.id, 'RUNNING')}
                          className="text-[#E8E8E8] hover:text-white font-bold active:scale-[0.97] transition"
                        >
                          Dispatch CPU
                        </button>
                      )}
                      {t.status === 'RUNNING' && (
                        <button
                          onClick={() => onUpdateTaskStatus(t.id, 'TERMINATED')}
                          className="text-[#707070] hover:text-[#F2F2F2] font-bold active:scale-[0.97] transition"
                        >
                          Mark Done
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
