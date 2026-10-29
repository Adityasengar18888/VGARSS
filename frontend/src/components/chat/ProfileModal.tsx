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

export function ProfileModal({ isOpen, onClose, currentUser, onUpdatePresence, onLogout }: ProfileModalProps) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none font-sans">
      <div className="w-full max-w-md bg-[#111111] border border-[#292929] rounded-[4px] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="h-12 border-b border-[#222222] px-4 flex items-center justify-between bg-[#0C0C0C]">
          <div className="flex items-center space-x-2">
            <User className="w-4 h-4 text-[#E8E8E8]" />
            <span className="font-bold text-xs tracking-editorial text-[#F2F2F2]">
              USER PROFILE & PRESENCE <span className="font-mono text-[10px] text-[#707070] font-normal">// IDENTITY</span>
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded text-[#707070] hover:text-[#F2F2F2] hover:bg-[#1A1A1A] transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs font-mono">
          {/* Identity card */}
          <div className="flex items-center space-x-3 p-3 rounded-[3px] bg-[#141414] border border-[#242424]">
            <div className="w-11 h-11 rounded-full bg-[#1C1C1C] border border-[#292929] flex items-center justify-center text-base font-bold text-[#F2F2F2]">
              {currentUser.username[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-xs text-[#F2F2F2] truncate font-sans">
                {currentUser.display_name || currentUser.username}
              </div>
              <div className="text-[10px] text-[#707070] truncate">
                @{currentUser.username} • {currentUser.email}
              </div>
            </div>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="p-1.5 rounded text-[#707070] hover:text-[#EF4444] hover:bg-[#1C1212] transition"
                title="Log Out"
                aria-label="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Presence State Selector */}
          <div>
            <label className="block text-[10px] uppercase text-[#707070] mb-1.5">Presence State</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { state: 'ONLINE', label: 'Online', color: 'bg-[#22C55E]' },
                { state: 'AWAY', label: 'Away', color: 'bg-[#F59E0B]' },
                { state: 'DND', label: 'Do Not Disturb', color: 'bg-[#EF4444]' },
              ].map((p) => (
                <button
                  key={p.state}
                  type="button"
                  onClick={() => setPresenceState(p.state as any)}
                  className={`flex items-center space-x-1.5 p-2 rounded-[3px] border text-left transition ${
                    presenceState === p.state
                      ? 'bg-[#1C1C1C] border-[#E8E8E8] text-[#F2F2F2] font-bold'
                      : 'bg-[#141414] border-[#242424] text-[#707070] hover:text-[#A1A1A1]'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${p.color}`} />
                  <span className="text-[10px]">{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Status Message */}
          <div>
            <label className="block text-[10px] uppercase text-[#707070] mb-1.5">Status Message</label>
            <input
              type="text"
              value={statusMessage}
              onChange={(e) => setStatusMessage(e.target.value)}
              placeholder="e.g. Profiling Round Robin time quantum..."
              className="w-full bg-[#171717] border border-[#292929] rounded-[3px] px-3 py-2 text-[#F2F2F2] placeholder-[#555555] focus:border-[#E8E8E8] outline-none font-sans"
            />
          </div>

          <div className="pt-2 flex items-center justify-end space-x-2 border-t border-[#1C1C1C]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-[#707070] hover:text-[#F2F2F2] transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 rounded-[3px] bg-[#E8E8E8] hover:bg-white disabled:opacity-40 text-[#080808] font-bold active:scale-95 transition uppercase tracking-wider"
            >
              {isSaving ? 'SAVING...' : 'SAVE SETTINGS'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
