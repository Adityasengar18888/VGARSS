import { useState } from 'react';
import { Plus, UserPlus } from 'lucide-react';
import { Card } from '../components/common/Card';
import { VirtualGroup } from '../types/groups';
import { api } from '../services/api';
import { ErrorState } from '../components/common/States';

interface VirtualGroupsViewProps {
  groups: VirtualGroup[];
  selectedGroup: VirtualGroup | null;
  onSelectGroup: (group: VirtualGroup) => void;
  onRefreshGroups: () => void;
}

export function VirtualGroupsView({
  groups,
  selectedGroup,
  onSelectGroup,
  onRefreshGroups,
}: VirtualGroupsViewProps) {
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState<boolean>(false);
  const [targetGroupId, setTargetGroupId] = useState<string | null>(null);

  const [newGroupName, setNewGroupName] = useState<string>('');
  const [newGroupDesc, setNewGroupDesc] = useState<string>('');
  const [memberUsername, setMemberUsername] = useState<string>('');
  const [memberRole, setMemberRole] = useState<'ADMIN' | 'MEMBER' | 'VIEWER'>('MEMBER');

  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const created = await api.createGroup({
        name: newGroupName.trim(),
        description: newGroupDesc.trim() || undefined,
      });
      setShowCreateModal(false);
      setNewGroupName('');
      setNewGroupDesc('');
      onRefreshGroups();
      onSelectGroup(created);
    } catch (err: any) {
      setActionError(err.message || 'Failed to create group.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetGroupId || !memberUsername.trim()) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await api.addGroupMember(targetGroupId, {
        username: memberUsername.trim(),
        role: memberRole,
      });
      setShowAddMemberModal(false);
      setMemberUsername('');
      onRefreshGroups();
    } catch (err: any) {
      setActionError(err.message || 'Failed to add group member.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">Virtual Groups & Partition Isolation</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-[65ch]">
            Isolate simulation kernels, PCB memory pools, and concurrency state per collaborative domain.
          </p>
        </div>
        <button
          onClick={() => {
            setActionError(null);
            setShowCreateModal(true);
          }}
          className="min-h-[44px] px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-2 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
        >
          <Plus className="w-4 h-4" />
          <span>New Virtual Group</span>
        </button>
      </div>

      {actionError && <ErrorState message={actionError} onRetry={() => setActionError(null)} />}

      {/* Reworked Section: Replaced 3-column card grid with structured list/table layout */}
      <Card
        title="Active Virtual Groups"
        subtitle="Configured isolation domains with member role permissions and context selection"
      >
        <div className="space-y-3">
          {groups.map((group) => {
            const isCurrent = selectedGroup?.id === group.id;
            return (
              <div
                key={group.id}
                className={`p-4 rounded-lg border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  isCurrent
                    ? 'border-sky-500 bg-slate-950'
                    : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                }`}
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-sm font-bold text-slate-100 truncate">{group.name}</h3>
                    {isCurrent && (
                      <span className="text-[10px] font-mono text-sky-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-700 font-semibold">
                        ACTIVE CONTEXT
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 max-w-[65ch]">
                    {group.description || 'Dedicated simulation cluster and resource isolation boundary.'}
                  </p>
                  <div className="flex items-center space-x-4 text-[11px] font-mono text-slate-400 pt-1">
                    <span>ID: {group.id.slice(0, 8)}...</span>
                    <span>Role: {group.user_role || 'ADMIN'}</span>
                    <span>Created: {new Date(group.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-3 shrink-0">
                  <button
                    onClick={() => {
                      setTargetGroupId(group.id);
                      setActionError(null);
                      setShowAddMemberModal(true);
                    }}
                    className="min-h-[44px] px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono font-semibold flex items-center space-x-1.5 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>+ Member</span>
                  </button>

                  <button
                    onClick={() => onSelectGroup(group)}
                    disabled={isCurrent}
                    className={`min-h-[44px] px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-1.5 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none ${
                      isCurrent
                        ? 'bg-slate-800 text-slate-500 cursor-default'
                        : 'bg-sky-600 hover:bg-sky-500 text-white'
                    }`}
                  >
                    <span>{isCurrent ? 'Current Context' : 'Select Group'}</span>
                  </button>
                </div>
              </div>
            );
          })}

          {groups.length === 0 && (
            <div className="py-8 text-center text-xs text-slate-400">
              No virtual groups found. Create a new group to isolate simulation processes.
            </div>
          )}
        </div>
      </Card>

      {/* Modal: Create Virtual Group */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-slate-100">Create Virtual Group</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-200 text-sm active:scale-[0.97]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Group Name <span className="text-sky-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cluster Beta - Round Robin Evaluation"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full min-h-[44px] bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Simulation partition purpose and experiment notes..."
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="min-h-[44px] px-3 py-2 text-xs text-slate-400 hover:text-white active:scale-[0.97]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="min-h-[44px] px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold disabled:opacity-50 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
                >
                  {actionLoading ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Group Member */}
      {showAddMemberModal && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-slate-100">Add Member to Group</h3>
              <button
                onClick={() => setShowAddMemberModal(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-200 text-sm active:scale-[0.97]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Username <span className="text-sky-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. bob_tester"
                  value={memberUsername}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full min-h-[44px] bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Role
                </label>
                <select
                  value={memberRole}
                  onChange={(e: any) => setMemberRole(e.target.value)}
                  className="w-full min-h-[44px] bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
                >
                  <option value="MEMBER">MEMBER (Read & Execute Simulations)</option>
                  <option value="ADMIN">ADMIN (Full Group Configuration)</option>
                  <option value="VIEWER">VIEWER (Read-only Telemetry)</option>
                </select>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="min-h-[44px] px-3 py-2 text-xs text-slate-400 hover:text-white active:scale-[0.97]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="min-h-[44px] px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold disabled:opacity-50 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
                >
                  {actionLoading ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
