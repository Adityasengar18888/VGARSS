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
  onReconnect?: () => void;
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
  onReconnect,
}: ChannelSidebarProps) {
  return (
    <aside
      className="w-60 bg-[#0D0D0D] border-r border-[#222222] flex flex-col select-none flex-shrink-0 z-10 font-sans"
      aria-label="Navigation Sidebar"
    >
      {/* Workspace Header Dropdown */}
      <div
        onClick={onOpenWorkspaceSettings}
        className="h-12 border-b border-[#222222] px-3.5 flex items-center justify-between hover:bg-[#141414] transition cursor-pointer group"
      >
        <div className="flex items-center space-x-2 truncate">
          <span className="font-bold text-xs text-[#F2F2F2] tracking-tight truncate">
            {activeWorkspace?.name || 'VGARSS 2.0'}
          </span>
          {activeWorkspace && (
            <span className="text-[9px] uppercase font-mono px-1 py-0.5 rounded bg-[#171717] text-[#A1A1A1] border border-[#292929] font-bold">
              {activeWorkspace.role}
            </span>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenWorkspaceSettings();
          }}
          className="text-[#707070] group-hover:text-[#F2F2F2] p-1 hover:bg-[#1A1A1A] rounded transition"
          title="Workspace Settings"
          aria-label="Workspace Settings"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Quick Search Button */}
      <div className="p-2.5">
        <button
          onClick={onOpenSearch}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-[3px] bg-[#141414] border border-[#242424] text-[#A1A1A1] text-xs hover:border-[#383838] hover:text-[#F2F2F2] transition shadow-xs"
          aria-label="Search Workspace"
        >
          <div className="flex items-center space-x-2">
            <Search className="w-3.5 h-3.5 text-[#707070]" />
            <span className="font-mono text-[11px]">Search system...</span>
          </div>
          <kbd className="font-mono text-[9px] bg-[#1E1E1E] px-1 py-0.5 rounded text-[#707070] border border-[#292929]">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Scrollable Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-2 space-y-4 py-1.5 no-scrollbar">
        {/* Systems Consoles (OS & CN Dedicated Views) */}
        <div>
          <div className="px-2 mb-1 flex items-center justify-between text-[10px] font-bold text-[#707070] uppercase tracking-technical font-mono">
            <span>Systems Consoles</span>
            <Radio className="w-3 h-3 text-[#A1A1A1]" />
          </div>
          <div className="space-y-0.5">
            <button
              onClick={() => onSelectViewTab('scheduler')}
              className={`w-full flex items-center space-x-2.5 px-2.5 py-1.5 rounded-[3px] text-xs font-medium transition active:scale-[0.98] ${
                activeViewTab === 'scheduler'
                  ? 'bg-[#1C1C1C] text-[#F2F2F2] font-bold border-l-2 border-[#E8E8E8]'
                  : 'text-[#A1A1A1] hover:text-[#F2F2F2] hover:bg-[#141414]'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-[#E8E8E8]" />
              <span>Process Scheduler</span>
            </button>

            <button
              onClick={() => onSelectViewTab('resources')}
              className={`w-full flex items-center space-x-2.5 px-2.5 py-1.5 rounded-[3px] text-xs font-medium transition active:scale-[0.98] ${
                activeViewTab === 'resources'
                  ? 'bg-[#1C1C1C] text-[#F2F2F2] font-bold border-l-2 border-[#E8E8E8]'
                  : 'text-[#A1A1A1] hover:text-[#F2F2F2] hover:bg-[#141414]'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-[#F59E0B]" />
              <span>Resources & Locks</span>
            </button>

            <button
              onClick={() => onSelectViewTab('deadlock')}
              className={`w-full flex items-center space-x-2.5 px-2.5 py-1.5 rounded-[3px] text-xs font-medium transition active:scale-[0.98] ${
                activeViewTab === 'deadlock'
                  ? 'bg-[#1C1C1C] text-[#F2F2F2] font-bold border-l-2 border-[#E8E8E8]'
                  : 'text-[#A1A1A1] hover:text-[#F2F2F2] hover:bg-[#141414]'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-[#EF4444]" />
              <span>Deadlock Lab</span>
            </button>

            <button
              onClick={() => onSelectViewTab('network')}
              className={`w-full flex items-center space-x-2.5 px-2.5 py-1.5 rounded-[3px] text-xs font-medium transition active:scale-[0.98] ${
                activeViewTab === 'network'
                  ? 'bg-[#1C1C1C] text-[#F2F2F2] font-bold border-l-2 border-[#E8E8E8]'
                  : 'text-[#A1A1A1] hover:text-[#F2F2F2] hover:bg-[#141414]'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-[#22C55E]" />
              <span>Network Inspector</span>
            </button>

            <button
              onClick={() => onSelectViewTab('analytics')}
              className={`w-full flex items-center space-x-2.5 px-2.5 py-1.5 rounded-[3px] text-xs font-medium transition active:scale-[0.98] ${
                activeViewTab === 'analytics'
                  ? 'bg-[#1C1C1C] text-[#F2F2F2] font-bold border-l-2 border-[#E8E8E8]'
                  : 'text-[#A1A1A1] hover:text-[#F2F2F2] hover:bg-[#141414]'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5 text-[#A1A1A1]" />
              <span>Performance Analytics</span>
            </button>
          </div>
        </div>

        {/* Group Channels Section */}
        <div>
          <div className="px-2 mb-1 flex items-center justify-between text-[10px] font-bold text-[#707070] uppercase tracking-technical font-mono">
            <span>Channels</span>
            <button
              onClick={onOpenCreateChannel}
              className="text-[#707070] hover:text-[#F2F2F2] p-0.5 rounded hover:bg-[#1A1A1A] transition"
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
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[3px] text-xs font-medium transition group active:scale-[0.98] ${
                    isSelected
                      ? 'bg-[#1C1C1C] text-[#F2F2F2] font-bold border border-[#2E2E2E]'
                      : 'text-[#A1A1A1] hover:text-[#F2F2F2] hover:bg-[#141414]'
                  }`}
                >
                  <div className="flex items-center space-x-2 truncate">
                    {ch.channel_type === 'SIMULATION' ? (
                      <Flame className="w-3.5 h-3.5 text-[#F59E0B] flex-shrink-0" />
                    ) : ch.is_private ? (
                      <Lock className="w-3.5 h-3.5 text-[#707070] flex-shrink-0" />
                    ) : (
                      <Hash className="w-3.5 h-3.5 text-[#707070] flex-shrink-0 group-hover:text-[#A1A1A1]" />
                    )}
                    <span className="truncate">{ch.name}</span>
                  </div>

                  {ch.unread_count > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-[#E8E8E8] text-[#080808] font-bold text-[10px] font-mono">
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
          <div className="px-2 mb-1 flex items-center justify-between text-[10px] font-bold text-[#707070] uppercase tracking-technical font-mono">
            <span>Direct Messages</span>
            <button
              onClick={onOpenInviteMember}
              className="text-[#707070] hover:text-[#F2F2F2] p-0.5 rounded hover:bg-[#1A1A1A] transition"
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
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[3px] text-xs font-medium transition group active:scale-[0.98] ${
                    isSelected
                      ? 'bg-[#1C1C1C] text-[#F2F2F2] font-bold border border-[#2E2E2E]'
                      : 'text-[#A1A1A1] hover:text-[#F2F2F2] hover:bg-[#141414]'
                  }`}
                >
                  <div className="flex items-center space-x-2 truncate">
                    <span className="relative flex-shrink-0">
                      <span className="w-5 h-5 rounded-full bg-[#171717] border border-[#292929] flex items-center justify-center text-[10px] text-[#F2F2F2] font-mono font-bold">
                        {dm.recipient.username[0].toUpperCase()}
                      </span>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#0D0D0D] ${
                          isOnline ? 'bg-[#22C55E]' : 'bg-[#707070]'
                        }`}
                      />
                    </span>
                    <span className="truncate">{dm.recipient.display_name || dm.recipient.username}</span>
                  </div>

                  {dm.unread_count > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-[#E8E8E8] text-[#080808] font-bold text-[10px] font-mono">
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
      <div
        onClick={onReconnect}
        title={wsStatus === 'connected' ? 'Live Telemetry Active' : 'Click to reconnect'}
        className="border-t border-[#222222] px-3 py-2 bg-[#090909] flex items-center justify-between text-[11px] font-mono cursor-pointer hover:bg-[#141414] transition"
      >
        <div className="flex items-center space-x-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              wsStatus === 'connected'
                ? 'bg-[#22C55E]'
                : wsStatus === 'connecting'
                ? 'bg-[#F59E0B] animate-pulse'
                : 'bg-[#EF4444]'
            }`}
          />
          <span className="text-[#A1A1A1] uppercase text-[10px] font-semibold">{wsStatus}</span>
        </div>
        {apiLatency !== null && <span className="text-[#707070] text-[10px]">{apiLatency}ms</span>}
      </div>
    </aside>
  );
}
