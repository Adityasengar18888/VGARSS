import { Plus, Cpu, LogOut, Compass } from 'lucide-react';
import { Workspace, UserProfile } from '../../types/chat';

interface ServerSidebarProps {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  onSelectWorkspace: (wsId: string) => void;
  onOpenCreateWorkspace: () => void;
  currentUser: UserProfile | null;
  onOpenProfile: () => void;
  onSwitchDevUser: (username: string) => void;
  totalUnreadCount?: number;
  onLogout?: () => void;
  onViewLanding?: () => void;
}

export function ServerSidebar({
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onOpenCreateWorkspace,
  currentUser,
  onOpenProfile,
  onLogout,
  onViewLanding,
}: ServerSidebarProps) {
  return (
    <aside
      className="w-16 bg-[#0A0A0A] border-r border-[#222222] flex flex-col items-center py-3 select-none flex-shrink-0 z-20 font-mono"
      aria-label="Workspaces Rail"
    >
      {/* VGARSS Core Brand Icon */}
      <div className="relative group mb-3">
        <button
          onClick={() => workspaces.length > 0 && onSelectWorkspace(workspaces[0].id)}
          className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-[3px] bg-[#171717] hover:bg-[#222222] border border-[#292929] flex items-center justify-center text-[#F2F2F2] font-bold text-lg active:scale-[0.97] transition shadow-xs"
          title="VGARSS 2.0 Collaboration Platform"
          aria-label="VGARSS Home"
        >
          <Cpu className="w-5 h-5 text-[#F2F2F2]" />
        </button>
        <span className="absolute -left-1 top-3 w-1 h-5 bg-[#E8E8E8] rounded-r" />
      </div>

      <div className="w-8 h-px bg-[#1C1C1C] my-1" />

      {/* Workspaces List */}
      <div className="flex-1 w-full overflow-y-auto space-y-2.5 flex flex-col items-center py-2 no-scrollbar">
        {workspaces.map((ws) => {
          const isActive = ws.id === activeWorkspaceId;
          const initials = ws.name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();

          return (
            <div key={ws.id} className="relative group w-full flex flex-col items-center">
              {/* Active Indicator Bar */}
              <div
                className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 bg-[#E8E8E8] rounded-r transition-all duration-200 ${
                  isActive ? 'h-8' : 'h-0 group-hover:h-3'
                }`}
              />
              <button
                onClick={() => onSelectWorkspace(ws.id)}
                className={`w-11 h-11 min-w-[44px] min-h-[44px] flex flex-col items-center justify-center font-bold active:scale-[0.97] transition-all rounded-[3px] ${
                  isActive
                    ? 'bg-[#E8E8E8] text-[#080808] shadow-xs'
                    : 'bg-[#141414] text-[#A1A1A1] hover:bg-[#1E1E1E] hover:text-[#F2F2F2] border border-[#242424]'
                }`}
                title={ws.name}
                aria-label={`Select workspace ${ws.name}`}
              >
                <span className="text-xs tracking-wider">{initials}</span>
              </button>
              <span
                className={`text-[9px] text-center truncate max-w-[56px] mt-0.5 leading-tight ${
                  isActive ? 'text-[#F2F2F2] font-bold' : 'text-[#707070]'
                }`}
              >
                {ws.name.replace("'s Workspace", '').slice(0, 8)}
              </span>

              {/* Workspace Name Flyout Tooltip */}
              <div className="absolute left-14 top-1/2 -translate-y-1/2 z-50 pointer-events-none hidden group-hover:flex items-center pl-2">
                <div className="bg-[#1C1C1C] text-[#F2F2F2] text-[11px] font-mono py-1 px-2.5 rounded border border-[#292929] shadow-lg whitespace-nowrap">
                  {ws.name}
                </div>
              </div>
            </div>
          );
        })}

        {/* Add Workspace Button */}
        <button
          onClick={onOpenCreateWorkspace}
          className="w-11 h-11 rounded-[3px] bg-[#111111] border border-dashed border-[#292929] text-[#707070] hover:text-[#F2F2F2] hover:border-[#E8E8E8] hover:bg-[#171717] flex items-center justify-center transition active:scale-[0.97]"
          title="Create New Workspace"
          aria-label="Create New Workspace"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="w-8 h-px bg-[#1C1C1C] my-2" />

      {/* View Public Specs & Landing */}
      {onViewLanding && (
        <button
          onClick={onViewLanding}
          className="mb-2 w-10 h-10 rounded-[3px] bg-[#141414] hover:bg-[#1E1E1E] border border-[#242424] flex items-center justify-center text-[#707070] hover:text-[#F2F2F2] transition active:scale-95"
          title="System Architecture & Specifications"
          aria-label="View Landing Page"
        >
          <Compass className="w-4 h-4" />
        </button>
      )}

      {/* User Profile Avatar with Presence Bead */}
      <div className="relative group">
        <button
          onClick={onOpenProfile}
          className="relative w-10 h-10 rounded-full bg-[#171717] border border-[#292929] hover:border-[#E8E8E8] flex items-center justify-center text-xs font-mono font-semibold text-[#F2F2F2] transition active:scale-[0.97]"
          title={currentUser ? `${currentUser.display_name} (${currentUser.presence_state})` : 'Profile Settings'}
          aria-label="User Profile"
        >
          {currentUser?.avatar_url ? (
            <img src={currentUser.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            <span>{currentUser?.username?.[0]?.toUpperCase() || 'U'}</span>
          )}

          {/* Presence Ring Bead */}
          <span
            className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-[#0A0A0A] ${
              currentUser?.presence_state === 'ONLINE'
                ? 'bg-[#22C55E]'
                : currentUser?.presence_state === 'AWAY'
                ? 'bg-[#F59E0B]'
                : currentUser?.presence_state === 'DND'
                ? 'bg-[#EF4444]'
                : 'bg-[#707070]'
            }`}
          />
        </button>
      </div>

      {/* Quick Sign Out Button */}
      {onLogout && (
        <button
          onClick={onLogout}
          className="mt-2 p-1.5 rounded text-[#707070] hover:text-[#EF4444] hover:bg-[#1A1111] transition active:scale-[0.95]"
          title="Sign Out / Switch Account"
          aria-label="Sign Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      )}
    </aside>
  );
}
