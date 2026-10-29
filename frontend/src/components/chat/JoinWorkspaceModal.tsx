import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { InvitationPreview } from '../../types/chat';
import { Users, AlertTriangle, ArrowRight, X, Building2 } from 'lucide-react';

interface JoinWorkspaceModalProps {
  inviteCode: string | null;
  onClose: () => void;
  onJoined: (workspaceId: string) => void;
}

export function JoinWorkspaceModal({ inviteCode, onClose, onJoined }: JoinWorkspaceModalProps) {
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!inviteCode) return;
    setLoading(true);
    setError(null);
    api
      .previewInvitation(inviteCode)
      .then((data) => {
        setPreview(data);
        if (!data.is_valid) {
          setError(data.invalid_reason || 'This invitation link is no longer valid.');
        }
      })
      .catch((err) => {
        setError(err.message || 'Invitation not found.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [inviteCode]);

  if (!inviteCode) return null;

  const handleJoin = async () => {
    if (!preview) return;
    setJoining(true);
    setError(null);
    try {
      const res = await api.joinWorkspaceViaInvitation(inviteCode);
      onJoined(res.workspace_id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to join workspace.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-sm bg-white border border-[#E4E7EC] rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Top Decorative Header */}
        <div className="h-12 border-b border-[#E4E7EC] px-4 flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-[#4055A8]" />
            <span className="font-semibold text-xs text-[#202631]">Workspace Invitation</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#667085] hover:text-[#202631] transition"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 text-center">
          {loading ? (
            <div className="py-8 space-y-2">
              <div className="w-8 h-8 rounded-full border-2 border-[#4055A8] border-t-transparent animate-spin mx-auto" />
              <p className="text-xs text-[#667085]">Retrieving workspace invitation...</p>
            </div>
          ) : error ? (
            <div className="py-4 space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#FEF3F2] text-[#B42318] flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#202631]">Invalid Invitation</h3>
                <p className="text-xs text-[#667085] mt-1">{error}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 px-4 py-2 bg-[#F2F4F7] hover:bg-[#E4E7EC] text-[#202631] font-semibold text-xs rounded-lg transition"
              >
                Dismiss
              </button>
            </div>
          ) : preview ? (
            <div className="space-y-4">
              {/* Workspace Avatar */}
              <div className="w-14 h-14 rounded-2xl bg-[#EEF2FF] border border-[#C7D2FE] text-[#4055A8] font-bold text-xl flex items-center justify-center mx-auto shadow-xs">
                {preview.workspace_name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>

              <div>
                <h3 className="text-base font-bold text-[#202631] tracking-tight">{preview.workspace_name}</h3>
                <p className="text-xs text-[#667085] mt-1 line-clamp-2">
                  {preview.workspace_description || 'Collaborative workspace for real-time scheduling & messaging.'}
                </p>
              </div>

              {/* Metadata Chip */}
              <div className="inline-flex items-center space-x-3 px-3 py-1.5 bg-[#F8FAFC] border border-[#E4E7EC] rounded-full text-[11px] text-[#475467]">
                <span className="flex items-center space-x-1">
                  <Users className="w-3.5 h-3.5 text-[#667085]" />
                  <span>{preview.member_count} member{preview.member_count === 1 ? '' : 's'}</span>
                </span>
                <span className="text-[#D0D5DD]">•</span>
                <span className="capitalize font-semibold text-[#4055A8]">{preview.role.toLowerCase()} role</span>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleJoin}
                  disabled={joining}
                  className="w-full py-2.5 px-4 bg-[#4055A8] hover:bg-[#334488] disabled:bg-[#D0D5DD] text-white font-semibold text-xs rounded-lg flex items-center justify-center space-x-1.5 transition active:scale-[0.98] shadow-sm"
                >
                  <span>{joining ? 'Joining Workspace...' : 'Accept Invitation & Join'}</span>
                  {!joining && <ArrowRight className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
