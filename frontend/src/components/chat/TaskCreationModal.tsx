import React, { useState } from 'react';
import { X, PlusCircle, AlertCircle, Layers } from 'lucide-react';
import { WorkspaceMember, Channel, WorkspaceResource } from '../../types/chat';

interface TaskCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  channels: Channel[];
  members: WorkspaceMember[];
  resources?: WorkspaceResource[];
  initialTitle?: string;
  initialMessageId?: string;
  initialChannelId?: string;
  onCreateTask: (payload: {
    workspace_id: string;
    channel_id?: string;
    source_message_id?: string;
    title: string;
    description: string;
    assignee_id?: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    arrival_time?: number;
    estimated_burst_ticks: number;
    deadline?: string;
    required_resources?: string[];
  }) => Promise<void>;
}

export function TaskCreationModal({
  isOpen,
  onClose,
  workspaceId,
  channels,
  members,
  resources = [],
  initialTitle = '',
  initialMessageId,
  initialChannelId,
  onCreateTask,
}: TaskCreationModalProps) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState('');
  const [channelId, setChannelId] = useState(initialChannelId || channels[0]?.id || '');
  const [assigneeId, setAssigneeId] = useState(members[0]?.user_id || '');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [arrivalTime, setArrivalTime] = useState<number>(0);
  const [estimatedBurstTicks, setEstimatedBurstTicks] = useState<number>(6);
  const [deadline, setDeadline] = useState<string>('');
  const [selectedResources, setSelectedResources] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleResource = (resId: string) => {
    setSelectedResources((prev) =>
      prev.includes(resId) ? prev.filter((r) => r !== resId) : [...prev, resId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Task title is required.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await onCreateTask({
        workspace_id: workspaceId,
        channel_id: channelId || undefined,
        source_message_id: initialMessageId || undefined,
        title: title.trim(),
        description: description.trim(),
        assignee_id: assigneeId || undefined,
        priority,
        arrival_time: arrivalTime,
        estimated_burst_ticks: estimatedBurstTicks,
        deadline: deadline.trim() || undefined,
        required_resources: selectedResources,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-lg bg-white border border-[#E4E7EC] rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="h-12 border-b border-[#E4E7EC] px-4 flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center space-x-2">
            <PlusCircle className="w-4 h-4 text-[#B7791F]" />
            <span className="font-semibold text-sm text-[#202631]">Create OS Collaborative Task</span>
          </div>
          <button onClick={onClose} className="p-1 rounded text-[#667085] hover:text-[#202631] transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
          {error && (
            <div className="p-2.5 rounded bg-[#FEF3F2] border border-[#FECDCA] text-[#B42318] flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-[#344054] font-medium mb-1">Task Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Profile kernel buffer overflow"
              className="w-full bg-white border border-[#D0D5DD] rounded-lg px-3 py-2 text-[#202631] placeholder-[#98A2B3] focus:border-[#4055A8] focus:ring-1 focus:ring-[#4055A8] outline-none transition"
              required
            />
          </div>

          <div>
            <label className="block text-[#344054] font-medium mb-1">Description / Notes</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Action items, steps to reproduce, or resource requirements..."
              rows={2}
              className="w-full bg-white border border-[#D0D5DD] rounded-lg px-3 py-2 text-[#202631] placeholder-[#98A2B3] focus:border-[#4055A8] focus:ring-1 focus:ring-[#4055A8] outline-none resize-none transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#344054] font-medium mb-1">Assignee</label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full bg-white border border-[#D0D5DD] rounded-lg px-2.5 py-2 text-[#202631] focus:border-[#4055A8] outline-none transition"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.display_name || m.username} ({m.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[#344054] font-medium mb-1">Channel Announcement</label>
              <select
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                className="w-full bg-white border border-[#D0D5DD] rounded-lg px-2.5 py-2 text-[#202631] focus:border-[#4055A8] outline-none transition"
              >
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[#344054] font-medium mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full bg-white border border-[#D0D5DD] rounded-lg px-2.5 py-2 text-[#202631] focus:border-[#4055A8] outline-none transition"
              >
                <option value="LOW">Low (4)</option>
                <option value="MEDIUM">Medium (3)</option>
                <option value="HIGH">High (2)</option>
                <option value="CRITICAL">Critical (1)</option>
              </select>
            </div>

            <div>
              <label className="block text-[#344054] font-medium mb-1">Arrival Tick</label>
              <input
                type="number"
                min={0}
                max={1000}
                value={arrivalTime}
                onChange={(e) => setArrivalTime(parseInt(e.target.value) || 0)}
                className="w-full bg-white border border-[#D0D5DD] rounded-lg px-3 py-2 text-[#202631] focus:border-[#4055A8] outline-none font-mono transition"
              />
            </div>

            <div>
              <label className="block text-[#344054] font-medium mb-1">CPU Burst</label>
              <div className="flex items-center space-x-1">
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={estimatedBurstTicks}
                  onChange={(e) => setEstimatedBurstTicks(parseInt(e.target.value) || 1)}
                  className="w-full bg-white border border-[#D0D5DD] rounded-lg px-3 py-2 text-[#202631] focus:border-[#4055A8] outline-none font-mono transition"
                />
                <span className="text-[#667085] text-[10px] font-mono">ticks</span>
              </div>
            </div>

            <div>
              <label className="block text-[#344054] font-medium mb-1">Deadline</label>
              <input
                type="text"
                placeholder="e.g. 10 ticks"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full bg-white border border-[#D0D5DD] rounded-lg px-3 py-2 text-[#202631] focus:border-[#4055A8] outline-none text-xs font-mono transition"
              />
            </div>
          </div>

          {/* Required Resources Selection */}
          {resources.length > 0 && (
            <div>
              <label className="block text-[#344054] font-medium mb-1">
                Required Synchronization Resources
              </label>
              <div className="flex flex-wrap gap-2">
                {resources.map((r) => {
                  const isSelected = selectedResources.includes(r.id);
                  return (
                    <button
                      type="button"
                      key={r.id}
                      onClick={() => toggleResource(r.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono flex items-center space-x-1.5 border transition active:scale-[0.97] ${
                        isSelected
                          ? 'bg-[#FEF6EE] border-[#FEDF89] text-[#B7791F] font-bold'
                          : 'bg-white border-[#D0D5DD] text-[#475467] hover:bg-[#F8FAFC]'
                      }`}
                    >
                      <Layers className="w-3 h-3 text-[#B7791F]" />
                      <span>{r.name}</span>
                      <span className="text-[9px] text-[#98A2B3]">({r.resource_type})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-2 flex items-center justify-end space-x-2 border-t border-[#F2F4F7]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-lg text-[#475467] hover:text-[#202631] font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-[#B7791F] hover:bg-[#936118] text-white font-semibold active:scale-[0.97] transition"
            >
              {isSubmitting ? 'Creating...' : 'Create & Announce Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
