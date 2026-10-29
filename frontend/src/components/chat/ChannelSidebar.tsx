import {
  Hash,
  Lock,
  Plus,
  Search,
  Cpu,
  Layers,
  Activity,
  BarChart2,
  ChevronDown,
  UserPlus,
  Radio,
  Flame,
  AlertTriangle,
} from 'lucide-react';
import { Workspace, Channel, DirectConversation } from '../../types/chat';

export type SystemViewTab = 'chat' | 'scheduler' | 'resources' | 'deadlock' | 'network' | 'analytics';

interface ChannelSidebarProps {
  activeWorkspace: Workspace | null;
  channels: Channel[];
  activeChannelId: string | null;
  onSelectChannel: (channelId: string) => void;
  onOpenCreateChannel: () => void;
  dms: DirectConversation[];
  activeDmId: string | null;
  onSelectDm: (dmId: string) => void;
  activeViewTab: SystemViewTab;
  onSelectViewTab: (tab: SystemViewTab) => void;
  onOpenSearch: () => void;
  onOpenInviteMember: () => void;
  onOpenWorkspaceSettings: () => void;
  wsStatus: 'connecting' | 'connected' | 'disconnected';
  apiLatency: number | null;
}

export function ChannelSidebar({
  activeWorkspace,
  channels,
  activeChannelId,
  onSelectChannel,
  onOpenCreateChannel,
  dms,
  activeDmId,
  onSelectDm,
  activeViewTab,
  onSelectViewTab,
  onOpenSearch,
  onOpenInviteMember,
  onOpenWorkspaceSettings,
  wsStatus,
  apiLatency,
}: ChannelSidebarProps) {
  return (
    <aside
      className="w-60 bg-[#F8F9FB] border-r border-[#E4E7EC] flex flex-col select-none flex-shrink-0 z-10"
      aria-label="Navigation Sidebar"
    >
      {/* Workspace Header Dropdown */}
      <div className="h-12 border-b border-[#E4E7EC] px-3.5 flex items-center justify-between hover:bg-[#F2F4F7] transition cursor-pointer group">
        <div className="flex items-center space-x-2 truncate">
          <span className="font-bold text-xs text-[#202631] truncate">
            {activeWorkspace?.name || 'VGARSS 2.0'}
          </span>
          {activeWorkspace && (
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white text-[#4055A8] border border-[#CBD5E1] font-bold">
              {activeWorkspace.role}
            </span>
          )}
        </div>
        <button
          onClick={onOpenWorkspaceSettings}
          className="text-[#667085] group-hover:text-[#202631] p-1 hover:bg-white rounded transition"
          title="Workspace Settings"
          aria-label="Workspace Settings"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Search Button */}
      <div className="p-2.5">
        <button
          onClick={onOpenSearch}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white border border-[#D0D5DD] text-[#667085] text-xs hover:border-[#98A2B3] hover:text-[#202631] transition shadow-2xs"
          aria-label="Search Workspace"
        >
          <div className="flex items-center space-x-2">
            <Search className="w-3.5 h-3.5 text-[#98A2B3]" />
            <span>Search messages & tasks</span>
          </div>
          <kbd className="font-mono text-[10px] bg-[#F2F4F7] px-1 py-0.5 rounded text-[#475467] border border-[#E4E7EC]">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Scrollable Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-2 space-y-4 py-1.5">
        {/* Systems Consoles (OS & CN Dedicated Views) */}
        <div>
          <div className="px-2 mb-1 flex items-center justify-between text-[11px] font-bold text-[#667085] uppercase tracking-wider font-mono">
            <span>Systems Consoles</span>
            <Radio className="w-3 h-3 text-[#4055A8]" />
          </div>
          <div className="space-y-0.5">
            <button
              onClick={() => onSelectViewTab('scheduler')}
              className={`w-full flex items-center space-x-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition active:scale-[0.98] ${
                activeViewTab === 'scheduler'
                  ? 'bg-[#EEF2FF] text-[#4055A8] font-bold border-l-2 border-[#4055A8]'
                  : 'text-[#475467] hover:text-[#202631] hover:bg-[#F2F4F7]'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-[#4055A8]" />
              <span>Process Scheduler</span>
            </button>

            <button
              onClick={() => onSelectViewTab('resources')}
              className={`w-full flex items-center space-x-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition active:scale-[0.98] ${
                activeViewTab === 'resources'
                  ? 'bg-[#FEF6EE] text-[#B7791F] font-bold border-l-2 border-[#B7791F]'
                  : 'text-[#475467] hover:text-[#202631] hover:bg-[#F2F4F7]'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-[#B7791F]" />
              <span>Resources & Locks</span>
            </button>

            <button
              onClick={() => onSelectViewTab('deadlock')}
              className={`w-full flex items-center space-x-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition active:scale-[0.98] ${
                activeViewTab === 'deadlock'
                  ? 'bg-[#FEF3F2] text-[#C0393A] font-bold border-l-2 border-[#C0393A]'
                  : 'text-[#475467] hover:text-[#202631] hover:bg-[#F2F4F7]'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-[#C0393A]" />
              <span>Deadlock Lab</span>
            </button>

            <button
              onClick={() => onSelectViewTab('network')}
              className={`w-full flex items-center space-x-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition active:scale-[0.98] ${
                activeViewTab === 'network'
                  ? 'bg-[#EEF2FF] text-[#4055A8] font-bold border-l-2 border-[#4055A8]'
                  : 'text-[#475467] hover:text-[#202631] hover:bg-[#F2F4F7]'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-[#4055A8]" />
              <span>Network Inspector</span>
            </button>

            <button
              onClick={() => onSelectViewTab('analytics')}
              className={`w-full flex items-center space-x-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition active:scale-[0.98] ${
                activeViewTab === 'analytics'
                  ? 'bg-[#ECFDF3] text-[#16805D] font-bold border-l-2 border-[#16805D]'
                  : 'text-[#475467] hover:text-[#202631] hover:bg-[#F2F4F7]'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5 text-[#16805D]" />
              <span>Performance Analytics</span>
            </button>
          </div>
        </div>

        {/* Group Channels Section */}
        <div>
          <div className="px-2 mb-1 flex items-center justify-between text-[11px] font-bold text-[#667085] uppercase tracking-wider font-mono">
            <span>Channels</span>
            <button
              onClick={onOpenCreateChannel}
              className="text-[#667085] hover:text-[#4055A8] p-0.5 rounded hover:bg-white transition"
              title="Create Channel"
              aria-label="Create Channel"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-0.5">
            {channels.map((ch) => {
              const isSelected = activeViewTab === 'chat' && ch.id === activeChannelId;
              return (
                <button
                  key={ch.id}
                  onClick={() => {
                    onSelectChannel(ch.id);
                    onSelectViewTab('chat');
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition group active:scale-[0.98] ${
                    isSelected
                      ? 'bg-white text-[#202631] font-bold shadow-xs border border-[#E4E7EC]'
                      : 'text-[#475467] hover:text-[#202631] hover:bg-[#F2F4F7]'
                  }`}
                >
                  <div className="flex items-center space-x-2 truncate">
                    {ch.channel_type === 'SIMULATION' ? (
                      <Flame className="w-3.5 h-3.5 text-[#B7791F] flex-shrink-0" />
                    ) : ch.is_private ? (
                      <Lock className="w-3.5 h-3.5 text-[#98A2B3] flex-shrink-0" />
                    ) : (
                      <Hash className="w-3.5 h-3.5 text-[#98A2B3] flex-shrink-0 group-hover:text-[#475467]" />
                    )}
                    <span className="truncate">{ch.name}</span>
                  </div>

                  {ch.unread_count > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-[#4055A8] text-white font-bold text-[10px]">
                      {ch.unread_count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Direct Messages Section */}
        <div>
          <div className="px-2 mb-1 flex items-center justify-between text-[11px] font-bold text-[#667085] uppercase tracking-wider font-mono">
            <span>Direct Messages</span>
            <button
              onClick={onOpenInviteMember}
              className="text-[#667085] hover:text-[#4055A8] p-0.5 rounded hover:bg-white transition"
              title="Invite Teammates"
              aria-label="Invite Teammates"
            >
              <UserPlus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-0.5">
            {dms.map((dm) => {
              const isSelected = activeViewTab === 'chat' && dm.id === activeDmId;
              const isOnline = dm.recipient.presence_state === 'ONLINE';

              return (
                <button
                  key={dm.id}
                  onClick={() => {
                    onSelectDm(dm.id);
                    onSelectViewTab('chat');
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition group active:scale-[0.98] ${
                    isSelected
                      ? 'bg-white text-[#202631] font-bold shadow-xs border border-[#E4E7EC]'
                      : 'text-[#475467] hover:text-[#202631] hover:bg-[#F2F4F7]'
                  }`}
                >
                  <div className="flex items-center space-x-2 truncate">
                    <span className="relative flex-shrink-0">
                      <span className="w-5 h-5 rounded-full bg-[#EEF2FF] border border-[#C7D2FE] flex items-center justify-center text-[10px] text-[#4055A8] font-bold">
                        {dm.recipient.username[0].toUpperCase()}
                      </span>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white ${
                          isOnline ? 'bg-[#16805D]' : 'bg-[#98A2B3]'
                        }`}
                      />
                    </span>
                    <span className="truncate">{dm.recipient.display_name || dm.recipient.username}</span>
                  </div>

                  {dm.unread_count > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-[#4055A8] text-white font-bold text-[10px]">
                      {dm.unread_count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Network Status & Latency Bar */}
      <div className="border-t border-[#E4E7EC] px-3 py-2 bg-white flex items-center justify-between text-[11px] font-mono">
        <div className="flex items-center space-x-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              wsStatus === 'connected'
                ? 'bg-[#16805D]'
                : wsStatus === 'connecting'
                ? 'bg-[#B7791F]'
                : 'bg-[#C0393A]'
            }`}
          />
          <span className="text-[#667085] uppercase text-[10px] font-semibold">{wsStatus}</span>
        </div>
        {apiLatency !== null && (
          <span className="text-[#98A2B3] text-[10px]">{apiLatency}ms</span>
        )}
      </div>
    </aside>
  );
}
