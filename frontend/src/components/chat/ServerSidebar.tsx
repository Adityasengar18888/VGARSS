import { Plus, Cpu, LogOut } from 'lucide-react';
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
}

export function ServerSidebar({
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onOpenCreateWorkspace,
  currentUser,
  onOpenProfile,
  onSwitchDevUser,
  onLogout,
}: ServerSidebarProps) {
  return (
    <aside
      className="w-16 bg-[#F0F2F5] border-r border-[#E4E7EC] flex flex-col items-center py-3 select-none flex-shrink-0 z-20"
      aria-label="Workspaces Rail"
    >
      {/* VGARSS Core Brand Icon */}
      <div className="relative group mb-3">
        <button
          onClick={() => workspaces.length > 0 && onSelectWorkspace(workspaces[0].id)}
          className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-[#4055A8] hover:bg-[#334488] flex items-center justify-center text-white font-bold text-lg active:scale-[0.97] transition-all duration-150 shadow-xs"
          title="VGARSS 2.0 Collaboration Platform"
          aria-label="VGARSS Home"
        >
          <Cpu className="w-5 h-5 text-white" />
        </button>
        <span className="absolute -left-1 top-2.5 w-1 h-6 bg-[#4055A8] rounded-r-full" />
      </div>

      <div className="w-8 h-px bg-[#E4E7EC] my-1" />

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
            <div key={ws.id} className="relative group w-full flex justify-center">
              {/* Active Indicator Bar */}
              <div
                className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 bg-[#4055A8] rounded-r transition-all duration-200 ${
                  isActive ? 'h-8' : 'h-0 group-hover:h-3'
                }`}
              />
              <button
                onClick={() => onSelectWorkspace(ws.id)}
                className={`w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center font-bold text-xs tracking-wider active:scale-[0.97] transition-all duration-150 ${
                  isActive
                    ? 'rounded-xl bg-[#4055A8] text-white shadow-xs'
                    : 'rounded-xl bg-white text-[#344054] hover:bg-[#F8FAFC] hover:text-[#202631] border border-[#E4E7EC]'
                }`}
                title={ws.name}
                aria-label={`Select workspace ${ws.name}`}
              >
                {initials}
              </button>
            </div>
          );
        })}

        {/* Add Workspace Button */}
        <button
          onClick={onOpenCreateWorkspace}
          className="w-11 h-11 rounded-xl bg-white border border-dashed border-[#CBD5E1] text-[#667085] hover:text-[#4055A8] hover:border-[#4055A8] hover:bg-[#F8FAFC] flex items-center justify-center transition-all duration-150 active:scale-[0.97]"
          title="Create New Workspace"
          aria-label="Create New Workspace"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="w-8 h-px bg-[#E4E7EC] my-2" />

      {/* Dev User Fast Switcher */}
      <div className="flex flex-col items-center space-y-1 mb-3">
        <span className="text-[9px] font-mono font-semibold text-[#98A2B3] uppercase tracking-wider">Dev</span>
        <div className="flex flex-col space-y-1">
          {['alice', 'bob', 'charlie'].map((uname) => {
            const isCurrent = currentUser?.username === uname;
            return (
              <button
                key={uname}
                onClick={() => onSwitchDevUser(uname)}
                className={`w-7 h-7 rounded-full text-[10px] font-bold uppercase transition-all active:scale-[0.95] ${
                  isCurrent
                    ? 'bg-[#16805D] text-white ring-2 ring-[#16805D] ring-offset-2 ring-offset-[#F0F2F5]'
                    : 'bg-white border border-[#D0D5DD] text-[#475467] hover:bg-[#F2F4F7] hover:text-[#202631]'
                }`}
                title={`Switch active user identity to ${uname}`}
                aria-label={`Switch user to ${uname}`}
              >
                {uname[0]}
              </button>
            );
          })}
        </div>
      </div>

      {/* User Profile Avatar with Presence Bead */}
      <div className="relative group">
        <button
          onClick={onOpenProfile}
          className="relative w-10 h-10 rounded-full bg-white border border-[#D0D5DD] hover:border-[#4055A8] flex items-center justify-center text-sm font-semibold text-[#4055A8] transition shadow-xs active:scale-[0.97]"
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
            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
              currentUser?.presence_state === 'ONLINE'
                ? 'bg-[#16805D]'
                : currentUser?.presence_state === 'AWAY'
                ? 'bg-[#B7791F]'
                : currentUser?.presence_state === 'DND'
                ? 'bg-[#C0393A]'
                : 'bg-[#98A2B3]'
            }`}
          />
        </button>
      </div>

      {/* Quick Sign Out Button */}
      {onLogout && (
        <button
          onClick={onLogout}
          className="mt-2 p-1.5 rounded-lg text-[#98A2B3] hover:text-[#C0393A] hover:bg-[#FEF3F2] transition active:scale-[0.95]"
          title="Sign Out / Switch Account"
          aria-label="Sign Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      )}
    </aside>
  );
}
