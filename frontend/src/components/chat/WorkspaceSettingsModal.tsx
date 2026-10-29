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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-lg bg-white border border-[#E4E7EC] rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="h-12 border-b border-[#E4E7EC] px-4 flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center space-x-2">
            <Settings className="w-4 h-4 text-[#4055A8]" />
            <span className="font-semibold text-sm text-[#202631]">Workspace Settings — {workspace.name}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded text-[#667085] hover:text-[#202631] transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {/* Metadata */}
          <div className="p-3.5 rounded-lg bg-[#F8FAFC] border border-[#E4E7EC] space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-[#667085]">Workspace Slug</span>
              <span className="font-mono text-[#4055A8] bg-white px-2 py-0.5 rounded border border-[#D0D5DD] font-medium">
                {workspace.slug}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#667085]">Your Role</span>
              <span className="font-mono text-[#16805D] bg-white px-2 py-0.5 rounded border border-[#D0D5DD] font-semibold">
                {workspace.role}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#667085]">Total Channels</span>
              <span className="text-[#202631] font-bold">{channels.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#667085]">Total Members</span>
              <span className="text-[#202631] font-bold">{members.length}</span>
            </div>
          </div>

          {/* Members List */}
          <div>
            <div className="text-[11px] font-mono uppercase text-[#667085] font-semibold mb-2">Members & Permissions</div>
            <div className="max-h-48 overflow-y-auto space-y-1 p-1 bg-[#F8FAFC] rounded-lg border border-[#E4E7EC]">
              {members.map((m) => (
                <div key={m.user_id} className="flex items-center justify-between p-2 rounded-lg hover:bg-white transition shadow-2xs">
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-full bg-[#EEF2FF] text-[#4055A8] flex items-center justify-center font-bold text-[10px]">
                      {m.username[0].toUpperCase()}
                    </span>
                    <div>
                      <span className="text-[#202631] font-semibold">{m.display_name || m.username}</span>
                      <span className="text-[#98A2B3] text-[10px] ml-1.5 font-mono">@{m.username}</span>
                    </div>
                  </div>
                  <span className="font-mono text-[10px] text-[#475467] px-1.5 py-0.5 rounded bg-white border border-[#D0D5DD] font-medium">
                    {m.role}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 flex justify-end border-t border-[#F2F4F7]">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-[#F2F4F7] hover:bg-[#E4E7EC] text-[#202631] font-semibold transition active:scale-[0.97]"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
