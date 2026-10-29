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
      className="w-64 bg-[#F8F9FB] border-l border-[#E4E7EC] flex flex-col select-none flex-shrink-0 z-10"
      aria-label="Context Information Drawer"
    >
      {/* Header Tabs */}
      <div className="h-12 border-b border-[#E4E7EC] px-3 flex items-center justify-between bg-white">
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setActiveTab('members')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition active:scale-[0.97] ${
              activeTab === 'members'
                ? 'bg-[#EEF2FF] text-[#4055A8] border border-[#C7D2FE]'
                : 'text-[#667085] hover:text-[#202631]'
            }`}
          >
            Members ({members.length})
          </button>
          <button
            onClick={() => setActiveTab('tasks')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition active:scale-[0.97] ${
              activeTab === 'tasks'
                ? 'bg-[#FEF6EE] text-[#B7791F] border border-[#FEDF89]'
                : 'text-[#667085] hover:text-[#202631]'
            }`}
          >
            Tasks ({tasks.length})
          </button>
        </div>

        <button
          onClick={onClose}
          className="text-[#667085] hover:text-[#202631] p-1 rounded-md hover:bg-[#F2F4F7] transition"
          title="Close Drawer"
          aria-label="Close Drawer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content Stream */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {activeTab === 'members' ? (
          <>
            {/* Online Members */}
            <div>
              <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#667085] mb-1.5">
                Online — {onlineMembers.length}
              </div>
              <div className="space-y-1">
                {onlineMembers.map((m) => (
                  <div
                    key={m.user_id}
                    className="flex items-center justify-between p-1.5 rounded-lg hover:bg-white hover:shadow-2xs transition group"
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <span className="relative flex-shrink-0">
                        <span className="w-6 h-6 rounded-full bg-[#EEF2FF] border border-[#C7D2FE] flex items-center justify-center text-[10px] text-[#4055A8] font-bold">
                          {m.username[0].toUpperCase()}
                        </span>
                        <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-[#16805D] border border-white" />
                      </span>
                      <div className="truncate">
                        <div className="text-xs font-semibold text-[#202631] truncate">
                          {m.display_name || m.username}
                        </div>
                        <div className="text-[10px] text-[#667085] font-mono">{m.role}</div>
                      </div>
                    </div>

                    <button
                      onClick={() => onOpenDmWithUser(m.user_id)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[#EEF2FF] text-[#667085] hover:text-[#4055A8] transition"
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
                <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#98A2B3] mb-1.5">
                  Offline — {offlineMembers.length}
                </div>
                <div className="space-y-1">
                  {offlineMembers.map((m) => (
                    <div
                      key={m.user_id}
                      className="flex items-center justify-between p-1.5 rounded-lg hover:bg-white hover:shadow-2xs transition group opacity-75 hover:opacity-100"
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <span className="relative flex-shrink-0">
                          <span className="w-6 h-6 rounded-full bg-[#F2F4F7] border border-[#E4E7EC] flex items-center justify-center text-[10px] text-[#667085] font-bold">
                            {m.username[0].toUpperCase()}
                          </span>
                          <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-[#98A2B3] border border-white" />
                        </span>
                        <div className="truncate">
                          <div className="text-xs font-semibold text-[#475467] truncate">
                            {m.display_name || m.username}
                          </div>
                          <div className="text-[10px] text-[#98A2B3] font-mono">{m.role}</div>
                        </div>
                      </div>

                      <button
                        onClick={() => onOpenDmWithUser(m.user_id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[#EEF2FF] text-[#667085] hover:text-[#4055A8] transition"
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
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#667085]">
                Coordinated Tasks
              </span>
              <button
                onClick={onOpenCreateTask}
                className="flex items-center space-x-1 text-[11px] font-semibold text-[#B7791F] hover:text-[#936118] transition active:scale-[0.97]"
              >
                <Plus className="w-3 h-3" />
                <span>New Task</span>
              </button>
            </div>

            {tasks.length === 0 ? (
              <div className="text-center py-6 text-[#98A2B3] text-xs">
                No active tasks in this workspace. Convert a chat message to create one!
              </div>
            ) : (
              tasks.map((t) => {
                const priorityColor =
                  t.priority === 'CRITICAL'
                    ? 'text-[#B42318] bg-[#FEF3F2] border-[#FECDCA]'
                    : t.priority === 'HIGH'
                    ? 'text-[#B7791F] bg-[#FEF6EE] border-[#FEDF89]'
                    : t.priority === 'MEDIUM'
                    ? 'text-[#4055A8] bg-[#EEF2FF] border-[#C7D2FE]'
                    : 'text-[#475467] bg-[#F2F4F7] border-[#E4E7EC]';

                const statusColor =
                  t.status === 'RUNNING'
                    ? 'text-[#16805D] bg-[#ECFDF3] border-[#A6F4C5]'
                    : t.status === 'READY'
                    ? 'text-[#B7791F] bg-[#FEF6EE] border-[#FEDF89]'
                    : t.status === 'WAITING'
                    ? 'text-[#C0393A] bg-[#FEF3F2] border-[#FECDCA]'
                    : 'text-[#475467] bg-[#F2F4F7] border-[#E4E7EC]';

                return (
                  <div
                    key={t.id}
                    className="p-2.5 rounded-lg bg-white border border-[#E4E7EC] space-y-1.5 hover:border-[#CBD5E1] transition shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => onSelectTask?.(t)}
                        className="font-mono text-[10px] text-[#4055A8] font-bold hover:underline"
                        title="View Task Details"
                      >
                        {t.id}
                      </button>
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border font-semibold ${priorityColor}`}>
                        {t.priority}
                      </span>
                    </div>

                    <button
                      onClick={() => onSelectTask?.(t)}
                      className="text-xs font-semibold text-[#202631] line-clamp-2 text-left hover:text-[#4055A8] transition w-full"
                    >
                      {t.title}
                    </button>

                    <div className="flex items-center justify-between text-[10px] text-[#667085] font-mono">
                      <span>Est: {t.estimated_burst_ticks} ticks</span>
                      <span className={`px-1.5 py-0.5 rounded border font-semibold ${statusColor}`}>{t.status}</span>
                    </div>

                    {/* Quick State Actions */}
                    <div className="pt-1.5 flex items-center justify-between border-t border-[#F2F4F7]">
                      <button
                        onClick={onNavigateToScheduler}
                        className="text-[10px] text-[#4055A8] hover:text-[#334488] font-semibold flex items-center space-x-0.5"
                      >
                        <Cpu className="w-3 h-3" />
                        <span>Scheduler</span>
                      </button>

                      {t.status === 'NEW' && (
                        <button
                          onClick={() => onUpdateTaskStatus(t.id, 'READY')}
                          className="text-[10px] text-[#16805D] hover:text-[#0E543D] font-bold active:scale-[0.97] transition"
                        >
                          Admit to READY
                        </button>
                      )}
                      {t.status === 'READY' && (
                        <button
                          onClick={() => onUpdateTaskStatus(t.id, 'RUNNING')}
                          className="text-[10px] text-[#4055A8] hover:text-[#334488] font-bold active:scale-[0.97] transition"
                        >
                          Dispatch CPU
                        </button>
                      )}
                      {t.status === 'RUNNING' && (
                        <button
                          onClick={() => onUpdateTaskStatus(t.id, 'TERMINATED')}
                          className="text-[10px] text-[#667085] hover:text-[#202631] font-bold active:scale-[0.97] transition"
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
