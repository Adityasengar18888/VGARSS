import { useState, useEffect, type FormEvent } from 'react';
import { X, UserPlus, QrCode, Copy, Check, Clock, Link as LinkIcon, Trash2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../../services/api';
import { WorkspaceInvitation } from '../../types/chat';

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId?: string;
  onAddMember: (username: string, role: string) => Promise<void>;
}

export function InviteMemberModal({ isOpen, onClose, workspaceId, onAddMember }: InviteMemberModalProps) {
  const [activeTab, setActiveTab] = useState<'qr' | 'username'>('qr');

  // Direct Username State
  const [username, setUsername] = useState('');
  const [directRole, setDirectRole] = useState('MEMBER');
  const [isSubmittingDirect, setIsSubmittingDirect] = useState(false);
  const [directError, setDirectError] = useState<string | null>(null);

  // QR Code & Link Invitation State
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [expiresInHours, setExpiresInHours] = useState<number | undefined>(24);
  const [maxUses, setMaxUses] = useState<number>(0);
  const [activeInvitation, setActiveInvitation] = useState<WorkspaceInvitation | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);

  // Load existing active invitations when opening
  useEffect(() => {
    if (isOpen && workspaceId && activeTab === 'qr') {
      loadLatestInvitation();
    }
  }, [isOpen, workspaceId, activeTab]);

  const loadLatestInvitation = async () => {
    if (!workspaceId) return;
    try {
      const list = await api.listWorkspaceInvitations(workspaceId);
      const active = list.find((i) => !i.revoked_at);
      if (active) {
        setActiveInvitation(active);
      }
    } catch {
      // ignore
    }
  };

  if (!isOpen) return null;

  const handleGenerateInvitation = async () => {
    if (!workspaceId) return;
    setIsGenerating(true);
    setQrError(null);
    try {
      const inv = await api.createWorkspaceInvitation(workspaceId, {
        role: inviteRole,
        expires_in_hours: expiresInHours,
        max_uses: maxUses,
      });
      setActiveInvitation(inv);
    } catch (err: any) {
      setQrError(err.message || 'Failed to generate invitation.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevoke = async () => {
    if (!workspaceId || !activeInvitation) return;
    try {
      await api.revokeWorkspaceInvitation(workspaceId, activeInvitation.id);
      setActiveInvitation(null);
    } catch (err: any) {
      setQrError(err.message || 'Failed to revoke invitation.');
    }
  };

  const handleCopyLink = () => {
    if (!activeInvitation) return;
    navigator.clipboard.writeText(activeInvitation.invite_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDirectSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setIsSubmittingDirect(true);
    setDirectError(null);
    try {
      await onAddMember(username.trim(), directRole);
      setUsername('');
      onClose();
    } catch (err: any) {
      setDirectError(err.message || 'Failed to add member.');
    } finally {
      setIsSubmittingDirect(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-md bg-white border border-[#E4E7EC] rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="h-12 border-b border-[#E4E7EC] px-4 flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center space-x-2">
            <UserPlus className="w-4 h-4 text-[#4055A8]" />
            <span className="font-semibold text-sm text-[#202631]">Invite Team Members</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#667085] hover:text-[#202631] transition"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#E4E7EC] bg-[#FAFAFC]">
          <button
            type="button"
            onClick={() => setActiveTab('qr')}
            className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center space-x-1.5 border-b-2 transition-colors ${
              activeTab === 'qr'
                ? 'border-[#4055A8] text-[#4055A8] bg-white'
                : 'border-transparent text-[#667085] hover:text-[#202631]'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>QR Code & Link</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('username')}
            className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center space-x-1.5 border-b-2 transition-colors ${
              activeTab === 'username'
                ? 'border-[#4055A8] text-[#4055A8] bg-white'
                : 'border-transparent text-[#667085] hover:text-[#202631]'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add by Username</span>
          </button>
        </div>

        {/* Tab 1: QR Code & Link Invitation */}
        {activeTab === 'qr' && (
          <div className="p-5 text-xs space-y-4">
            {qrError && (
              <div className="p-2.5 rounded bg-[#FEF3F2] border border-[#FECDCA] text-[#B42318] text-xs">
                {qrError}
              </div>
            )}

            {activeInvitation ? (
              <div className="flex flex-col items-center space-y-4">
                {/* QR Code Container */}
                <div className="p-3 bg-white border border-[#E4E7EC] rounded-xl shadow-xs">
                  <QRCodeSVG
                    value={activeInvitation.invite_url}
                    size={160}
                    level="M"
                    fgColor="#202631"
                    bgColor="#FFFFFF"
                  />
                </div>

                <div className="text-center">
                  <p className="font-semibold text-[#202631]">Scan with any phone camera to join</p>
                  <p className="text-[11px] text-[#667085] mt-0.5">
                    Role: <span className="font-semibold text-[#4055A8]">{activeInvitation.role}</span> •
                    Uses: <span className="font-mono">{activeInvitation.uses_count}</span>
                    {activeInvitation.max_uses > 0 ? ` / ${activeInvitation.max_uses}` : ' (Unlimited)'}
                  </p>
                </div>

                {/* Shareable Link Input with Copy */}
                <div className="w-full flex items-center space-x-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      readOnly
                      value={activeInvitation.invite_url}
                      className="w-full pl-8 pr-3 py-1.5 bg-[#F8FAFC] border border-[#D0D5DD] rounded-lg text-[#202631] font-mono text-[11px] select-all outline-none"
                    />
                    <LinkIcon className="w-3.5 h-3.5 text-[#667085] absolute left-2.5 top-2" />
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-3 py-1.5 bg-[#4055A8] hover:bg-[#334488] text-white font-semibold rounded-lg flex items-center space-x-1.5 transition active:scale-[0.97]"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                {/* Revoke / Regenerate Controls */}
                <div className="w-full pt-3 border-t border-[#F2F4F7] flex items-center justify-between text-[11px]">
                  <span className="text-[#667085] flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-[#98A2B3]" />
                    <span>
                      {activeInvitation.expires_at
                        ? `Expires: ${new Date(activeInvitation.expires_at).toLocaleDateString()}`
                        : 'Never expires'}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={handleRevoke}
                    className="text-[#C0393A] hover:text-[#912018] font-semibold flex items-center space-x-1 transition"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Revoke Link</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5">
                <p className="text-[#475467] leading-relaxed">
                  Generate a secure QR code and shareable invitation URL to onboard teammates into this workspace.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#344054] font-medium mb-1">Default Role</label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="w-full bg-white border border-[#D0D5DD] rounded-lg px-2.5 py-1.5 text-[#202631] outline-none focus:border-[#4055A8]"
                    >
                      <option value="MEMBER">Member (Chat & Tasks)</option>
                      <option value="ADMIN">Admin (Manage Workspace)</option>
                      <option value="GUEST">Guest (Read-Only)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[#344054] font-medium mb-1">Expiration</label>
                    <select
                      value={expiresInHours === undefined ? 'never' : expiresInHours}
                      onChange={(e) => setExpiresInHours(e.target.value === 'never' ? undefined : Number(e.target.value))}
                      className="w-full bg-white border border-[#D0D5DD] rounded-lg px-2.5 py-1.5 text-[#202631] outline-none focus:border-[#4055A8]"
                    >
                      <option value={1}>1 hour</option>
                      <option value={24}>24 hours</option>
                      <option value={168}>7 days</option>
                      <option value="never">Never</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[#344054] font-medium mb-1">Max Usage Limit</label>
                  <select
                    value={maxUses}
                    onChange={(e) => setMaxUses(Number(e.target.value))}
                    className="w-full bg-white border border-[#D0D5DD] rounded-lg px-2.5 py-1.5 text-[#202631] outline-none focus:border-[#4055A8]"
                  >
                    <option value={0}>Unlimited uses</option>
                    <option value={1}>1 use only (Single teammate)</option>
                    <option value={5}>5 uses</option>
                    <option value={10}>10 uses (Small team)</option>
                    <option value={50}>50 uses (Organization)</option>
                  </select>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleGenerateInvitation}
                    disabled={isGenerating}
                    className="w-full py-2.5 bg-[#4055A8] hover:bg-[#334488] disabled:bg-[#D0D5DD] text-white font-semibold rounded-lg flex items-center justify-center space-x-1.5 transition active:scale-[0.98]"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>{isGenerating ? 'Generating QR Matrix...' : 'Generate QR Code & Link'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Direct Username Add */}
        {activeTab === 'username' && (
          <form onSubmit={handleDirectSubmit} className="p-5 space-y-4 text-xs">
            {directError && (
              <div className="p-2.5 rounded bg-[#FEF3F2] border border-[#FECDCA] text-[#B42318] text-xs">
                {directError}
              </div>
            )}

            <div>
              <label className="block text-[#344054] font-medium mb-1">Username *</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. bob, charlie"
                required
                className="w-full bg-white border border-[#D0D5DD] rounded-lg px-3 py-2 text-[#202631] placeholder-[#98A2B3] focus:border-[#4055A8] focus:ring-1 focus:ring-[#4055A8] outline-none transition"
              />
            </div>

            <div>
              <label className="block text-[#344054] font-medium mb-1">Workspace Role</label>
              <select
                value={directRole}
                onChange={(e) => setDirectRole(e.target.value)}
                className="w-full bg-white border border-[#D0D5DD] rounded-lg px-2.5 py-2 text-[#202631] focus:border-[#4055A8] outline-none transition"
              >
                <option value="MEMBER">Member (Chat & Task Creation)</option>
                <option value="ADMIN">Admin (Manage Channels & Members)</option>
                <option value="GUEST">Guest (Read-Only)</option>
              </select>
            </div>

            <div className="pt-2 flex items-center justify-end space-x-2 border-t border-[#F2F4F7]">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 text-[#475467] hover:text-[#202631] font-medium transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingDirect || !username.trim()}
                className="px-4 py-2 rounded-lg bg-[#4055A8] hover:bg-[#334488] disabled:bg-[#D0D5DD] text-white font-semibold active:scale-[0.97] transition"
              >
                {isSubmittingDirect ? 'Adding...' : 'Add Member'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
