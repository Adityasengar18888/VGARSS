import { X, Settings } from 'lucide-react';
import { Workspace, WorkspaceMember, Channel } from '../../types/chat';

interface WorkspaceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: Workspace | null;
  members: WorkspaceMember[];
  channels: Channel[];
}

export function WorkspaceSettingsModal({ isOpen, onClose, workspace, members, channels }: WorkspaceSettingsModalProps) {
  if (!isOpen || !workspace) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 select-none">
      <div className="w-full max-w-lg bg-[#111111] border border-[#292929] rounded-[4px] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="h-12 border-b border-[#222222] px-4 flex items-center justify-between bg-[#141414]">
          <div className="flex items-center space-x-2">
            <Settings className="w-4 h-4 text-[#A1A1A1]" />
            <span className="font-mono font-bold text-xs uppercase tracking-wider text-[#F2F2F2]">
              Workspace Settings &mdash; {workspace.name}
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded text-[#707070] hover:text-[#F2F2F2] transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs font-mono">
          {/* Metadata */}
          <div className="p-3.5 rounded-[3px] bg-[#171717] border border-[#292929] space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-[#A1A1A1]">Workspace Slug</span>
              <span className="text-[#F2F2F2] bg-[#0E0E0E] px-2 py-0.5 rounded-[2px] border border-[#292929] font-medium">
                {workspace.slug}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#A1A1A1]">Your Role</span>
              <span className="text-[#22C55E] bg-[#0E0E0E] px-2 py-0.5 rounded-[2px] border border-[#292929] font-semibold uppercase text-[10px]">
                {workspace.role}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#A1A1A1]">Total Channels</span>
              <span className="text-[#F2F2F2] font-bold">{channels.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#A1A1A1]">Total Members</span>
              <span className="text-[#F2F2F2] font-bold">{members.length}</span>
            </div>
          </div>

          {/* Members List */}
          <div>
            <div className="text-[10px] uppercase text-[#707070] font-semibold tracking-wider mb-2">
              Members & Permissions
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1 p-1 bg-[#141414] rounded-[3px] border border-[#292929]">
              {members.map((m) => (
                <div key={m.user_id} className="flex items-center justify-between p-2 rounded-[2px] hover:bg-[#1A1A1A] transition">
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-[2px] bg-[#222222] text-[#F2F2F2] flex items-center justify-center font-bold text-[10px] border border-[#333333]">
                      {(m.display_name || m.username)[0].toUpperCase()}
                    </span>
                    <div>
                      <span className="font-semibold text-[#F2F2F2] text-[11px] block">{m.display_name || m.username}</span>
                      <span className="text-[#707070] text-[9px]">@{m.username}</span>
                    </div>
                  </div>
                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded-[2px] bg-[#222222] text-[#A1A1A1] border border-[#2D2D2D]">
                    {m.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-3 bg-[#141414] border-t border-[#222222] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-[3px] bg-[#222222] hover:bg-[#2A2A2A] text-[#F2F2F2] font-mono text-xs border border-[#333333] transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
