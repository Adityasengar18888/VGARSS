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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none font-sans">
      <div className="w-full max-w-md bg-[#111111] border border-[#292929] rounded-[4px] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="h-12 border-b border-[#222222] px-4 flex items-center justify-between bg-[#0C0C0C]">
          <div className="flex items-center space-x-2">
            <UserPlus className="w-4 h-4 text-[#E8E8E8]" />
            <span className="font-bold text-xs tracking-editorial text-[#F2F2F2]">
              INVITE TEAM MEMBERS <span className="font-mono text-[10px] text-[#707070] font-normal">// QR ONBOARDING</span>
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#707070] hover:text-[#F2F2F2] hover:bg-[#1A1A1A] transition"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#222222] bg-[#0A0A0A] font-mono text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('qr')}
            className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center space-x-1.5 border-b-2 transition-colors ${
              activeTab === 'qr'
                ? 'border-[#E8E8E8] text-[#F2F2F2] bg-[#141414]'
                : 'border-transparent text-[#707070] hover:text-[#A1A1A1]'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>[QR CODE & LINK]</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('username')}
            className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center space-x-1.5 border-b-2 transition-colors ${
              activeTab === 'username'
                ? 'border-[#E8E8E8] text-[#F2F2F2] bg-[#141414]'
                : 'border-transparent text-[#707070] hover:text-[#A1A1A1]'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>[ADD BY USERNAME]</span>
          </button>
        </div>

        {/* Tab 1: QR Code & Link Invitation */}
        {activeTab === 'qr' && (
          <div className="p-5 text-xs space-y-4">
            {qrError && (
              <div className="p-2.5 rounded bg-[#1F1212] border border-[#4A1E1E] text-[#EF4444] text-xs font-mono">
                {qrError}
              </div>
            )}

            {activeInvitation ? (
              <div className="flex flex-col items-center space-y-4">
                {/* QR Code Container */}
                <div className="p-3 bg-white border border-[#292929] rounded-[4px] shadow-sm">
                  <QRCodeSVG
                    value={activeInvitation.invite_url}
                    size={160}
                    level="M"
                    fgColor="#080808"
                    bgColor="#FFFFFF"
                  />
                </div>

                <div className="text-center font-mono">
                  <p className="font-bold text-xs text-[#F2F2F2]">SCAN VIA PHONE CAMERA TO JOIN</p>
                  <p className="text-[10px] text-[#707070] mt-0.5">
                    ROLE: <span className="text-[#E8E8E8] font-bold">{activeInvitation.role}</span> • USES:{' '}
                    <span className="text-[#A1A1A1]">{activeInvitation.uses_count}</span>
                    {activeInvitation.max_uses > 0 ? ` / ${activeInvitation.max_uses}` : ' (UNLIMITED)'}
                  </p>
                </div>

                {/* Shareable Link Input with Copy */}
                <div className="w-full flex items-center space-x-2 font-mono">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      readOnly
                      value={activeInvitation.invite_url}
                      className="w-full pl-8 pr-3 py-2 bg-[#171717] border border-[#292929] rounded-[3px] text-[#F2F2F2] text-[11px] select-all outline-none"
                    />
                    <LinkIcon className="w-3.5 h-3.5 text-[#707070] absolute left-2.5 top-2.5" />
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-3.5 py-2 bg-[#E8E8E8] hover:bg-white text-[#080808] font-bold rounded-[3px] flex items-center space-x-1.5 transition active:scale-95 text-xs"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-[#22C55E]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'COPIED' : 'COPY'}</span>
                  </button>
                </div>

                {/* Revoke / Regenerate Controls */}
                <div className="w-full pt-3 border-t border-[#1C1C1C] flex items-center justify-between text-[10px] font-mono">
                  <span className="text-[#707070] flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-[#555555]" />
                    <span>
                      {activeInvitation.expires_at
                        ? `EXPIRES: ${new Date(activeInvitation.expires_at).toLocaleDateString()}`
                        : 'NEVER EXPIRES'}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={handleRevoke}
                    className="text-[#EF4444] hover:text-white font-bold flex items-center space-x-1 transition"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>REVOKE TOKEN</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5 font-mono text-xs">
                <p className="text-[#A1A1A1] leading-relaxed">
                  Generate a cryptographic QR code and shareable invitation token to admit peers into this workspace.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase text-[#707070] mb-1">Default Role</label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="w-full bg-[#171717] border border-[#292929] rounded-[3px] px-2.5 py-2 text-[#F2F2F2] outline-none focus:border-[#E8E8E8]"
                    >
                      <option value="MEMBER">Member (Chat & Tasks)</option>
                      <option value="ADMIN">Admin (Manage Workspace)</option>
                      <option value="GUEST">Guest (Read-Only)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase text-[#707070] mb-1">Expiration</label>
                    <select
                      value={expiresInHours === undefined ? 'never' : expiresInHours}
                      onChange={(e) => setExpiresInHours(e.target.value === 'never' ? undefined : Number(e.target.value))}
                      className="w-full bg-[#171717] border border-[#292929] rounded-[3px] px-2.5 py-2 text-[#F2F2F2] outline-none focus:border-[#E8E8E8]"
                    >
                      <option value={1}>1 hour</option>
                      <option value={24}>24 hours</option>
                      <option value={168}>7 days</option>
                      <option value="never">Never</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-[#707070] mb-1">Max Usage Limit</label>
                  <select
                    value={maxUses}
                    onChange={(e) => setMaxUses(Number(e.target.value))}
                    className="w-full bg-[#171717] border border-[#292929] rounded-[3px] px-2.5 py-2 text-[#F2F2F2] outline-none focus:border-[#E8E8E8]"
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
                    className="w-full py-2.5 bg-[#E8E8E8] hover:bg-white disabled:opacity-40 text-[#080808] font-bold rounded-[3px] flex items-center justify-center space-x-1.5 transition active:scale-95 uppercase tracking-wider"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>{isGenerating ? 'GENERATING QR MATRIX...' : 'GENERATE QR CODE & LINK'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Direct Username Add */}
        {activeTab === 'username' && (
          <form onSubmit={handleDirectSubmit} className="p-5 space-y-4 font-mono text-xs">
            {directError && (
              <div className="p-2.5 rounded bg-[#1F1212] border border-[#4A1E1E] text-[#EF4444] text-xs">
                {directError}
              </div>
            )}

            <div>
              <label className="block text-[10px] uppercase text-[#707070] mb-1">Target Username *</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. ironman, charlie"
                required
                className="w-full bg-[#171717] border border-[#292929] rounded-[3px] px-3 py-2 text-[#F2F2F2] placeholder-[#555555] focus:border-[#E8E8E8] outline-none transition"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase text-[#707070] mb-1">Workspace Role</label>
              <select
                value={directRole}
                onChange={(e) => setDirectRole(e.target.value)}
                className="w-full bg-[#171717] border border-[#292929] rounded-[3px] px-2.5 py-2 text-[#F2F2F2] focus:border-[#E8E8E8] outline-none transition"
              >
                <option value="MEMBER">Member (Chat & Task Creation)</option>
                <option value="ADMIN">Admin (Manage Channels & Members)</option>
                <option value="GUEST">Guest (Read-Only)</option>
              </select>
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
                type="submit"
                disabled={isSubmittingDirect || !username.trim()}
                className="px-4 py-2 rounded-[3px] bg-[#E8E8E8] hover:bg-white disabled:opacity-40 text-[#080808] font-bold active:scale-95 transition uppercase tracking-wider"
              >
                {isSubmittingDirect ? 'ADDING...' : 'ADD MEMBER'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
