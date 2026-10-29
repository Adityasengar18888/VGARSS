import { useState } from 'react';
import { X, User, LogOut } from 'lucide-react';
import { UserProfile } from '../../types/chat';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  onUpdatePresence: (state: string, statusMessage?: string) => Promise<void>;
  onSwitchUser: (username: string) => Promise<void>;
  onLogout?: () => void;
}

export function ProfileModal({ isOpen, onClose, currentUser, onUpdatePresence, onSwitchUser, onLogout }: ProfileModalProps) {
  const [presenceState, setPresenceState] = useState(currentUser?.presence_state || 'ONLINE');
  const [statusMessage, setStatusMessage] = useState(currentUser?.status_message || '');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen || !currentUser) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdatePresence(presenceState, statusMessage);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-md bg-white border border-[#E4E7EC] rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="h-12 border-b border-[#E4E7EC] px-4 flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center space-x-2">
            <User className="w-4 h-4 text-[#4055A8]" />
            <span className="font-semibold text-sm text-[#202631]">User Profile & Presence</span>
          </div>
          <button onClick={onClose} className="p-1 rounded text-[#667085] hover:text-[#202631] transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {/* Identity card */}
          <div className="flex items-center space-x-3 p-3 rounded-lg bg-[#F8FAFC] border border-[#E4E7EC]">
            <div className="w-12 h-12 rounded-full bg-[#EEF2FF] border border-[#C7D2FE] flex items-center justify-center text-lg font-bold text-[#4055A8]">
              {currentUser.username[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm text-[#202631] truncate">{currentUser.display_name || currentUser.username}</div>
              <div className="text-[11px] text-[#667085] font-mono truncate">@{currentUser.username} • {currentUser.email}</div>
            </div>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="p-1.5 rounded-lg text-[#C0393A] hover:bg-[#FEF3F2] border border-transparent hover:border-[#FECDCA] transition"
                title="Log Out"
                aria-label="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Presence State Selector */}
          <div>
            <label className="block text-[#344054] font-medium mb-1">Presence State</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { state: 'ONLINE', label: 'Online', color: 'bg-[#16805D]' },
                { state: 'AWAY', label: 'Away', color: 'bg-[#B7791F]' },
                { state: 'DND', label: 'Do Not Disturb', color: 'bg-[#C0393A]' },
              ].map((p) => (
                <button
                  key={p.state}
                  type="button"
                  onClick={() => setPresenceState(p.state as any)}
                  className={`flex items-center space-x-1.5 p-2 rounded-lg border text-left transition ${
                    presenceState === p.state
                      ? 'bg-[#EEF2FF] border-[#4055A8] text-[#4055A8] font-bold'
                      : 'bg-white border-[#D0D5DD] text-[#475467] hover:bg-[#F8FAFC]'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${p.color}`} />
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Status Message */}
          <div>
            <label className="block text-[#344054] font-medium mb-1">Status Message</label>
            <input
              type="text"
              value={statusMessage}
              onChange={(e) => setStatusMessage(e.target.value)}
              placeholder="e.g. Profiling Round Robin time quantum..."
              className="w-full bg-white border border-[#D0D5DD] rounded-lg px-3 py-2 text-[#202631] placeholder-[#98A2B3] focus:border-[#4055A8] focus:ring-1 focus:ring-[#4055A8] outline-none transition"
            />
          </div>

          {/* Fast Switch Dev Identities */}
          <div className="pt-2 border-t border-[#F2F4F7]">
            <label className="block text-[#344054] font-medium mb-1.5">Switch Dev Test Identity</label>
            <div className="flex space-x-2">
              {['alice', 'bob', 'charlie'].map((uname) => (
                <button
                  key={uname}
                  type="button"
                  onClick={async () => {
                    await onSwitchUser(uname);
                    onClose();
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-center text-xs font-semibold capitalize transition active:scale-[0.97] ${
                    currentUser.username === uname
                      ? 'bg-[#16805D] text-white shadow-2xs'
                      : 'bg-[#F2F4F7] hover:bg-[#E4E7EC] text-[#475467]'
                  }`}
                >
                  {uname}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end space-x-2 border-t border-[#F2F4F7]">
            <button type="button" onClick={onClose} className="px-3 py-2 text-[#475467] hover:text-[#202631] font-medium transition">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 rounded-lg bg-[#4055A8] hover:bg-[#334488] disabled:bg-[#D0D5DD] text-white font-semibold active:scale-[0.97] transition"
            >
              {isSaving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
