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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none font-sans">
      <div className="w-full max-w-lg bg-[#111111] border border-[#292929] rounded-[4px] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="h-12 border-b border-[#222222] px-4 flex items-center justify-between bg-[#0C0C0C]">
          <div className="flex items-center space-x-2">
            <PlusCircle className="w-4 h-4 text-[#E8E8E8]" />
            <span className="font-bold text-xs tracking-editorial text-[#F2F2F2]">
              CREATE OS COLLABORATIVE TASK <span className="font-mono text-[10px] text-[#707070] font-normal">// PCB</span>
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded text-[#707070] hover:text-[#F2F2F2] hover:bg-[#1A1A1A] transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs font-mono">
          {error && (
            <div className="p-2.5 rounded bg-[#1F1212] border border-[#4A1E1E] text-[#EF4444] flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-[10px] uppercase text-[#707070] mb-1">Task Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Profile kernel buffer overflow"
              className="w-full bg-[#171717] border border-[#292929] rounded-[3px] px-3 py-2 text-[#F2F2F2] placeholder-[#555555] focus:border-[#E8E8E8] outline-none transition"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase text-[#707070] mb-1">Description / Notes</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Action items, steps to reproduce, or resource requirements..."
              rows={2}
              className="w-full bg-[#171717] border border-[#292929] rounded-[3px] px-3 py-2 text-[#F2F2F2] placeholder-[#555555] focus:border-[#E8E8E8] outline-none resize-none transition font-sans"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase text-[#707070] mb-1">Assignee</label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full bg-[#171717] border border-[#292929] rounded-[3px] px-2.5 py-2 text-[#F2F2F2] focus:border-[#E8E8E8] outline-none transition"
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
              <label className="block text-[10px] uppercase text-[#707070] mb-1">Channel Announcement</label>
              <select
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                className="w-full bg-[#171717] border border-[#292929] rounded-[3px] px-2.5 py-2 text-[#F2F2F2] focus:border-[#E8E8E8] outline-none transition"
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
              <label className="block text-[10px] uppercase text-[#707070] mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full bg-[#171717] border border-[#292929] rounded-[3px] px-2.5 py-2 text-[#F2F2F2] focus:border-[#E8E8E8] outline-none transition"
              >
                <option value="LOW">Low (4)</option>
                <option value="MEDIUM">Medium (3)</option>
                <option value="HIGH">High (2)</option>
                <option value="CRITICAL">Critical (1)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase text-[#707070] mb-1">Arrival Tick</label>
              <input
                type="number"
                min={0}
                max={1000}
                value={arrivalTime}
                onChange={(e) => setArrivalTime(parseInt(e.target.value) || 0)}
                className="w-full bg-[#171717] border border-[#292929] rounded-[3px] px-3 py-2 text-[#F2F2F2] focus:border-[#E8E8E8] outline-none font-mono transition"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase text-[#707070] mb-1">CPU Burst</label>
              <div className="flex items-center space-x-1">
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={estimatedBurstTicks}
                  onChange={(e) => setEstimatedBurstTicks(parseInt(e.target.value) || 1)}
                  className="w-full bg-[#171717] border border-[#292929] rounded-[3px] px-3 py-2 text-[#F2F2F2] focus:border-[#E8E8E8] outline-none font-mono transition"
                />
                <span className="text-[#707070] text-[10px] font-mono">ticks</span>
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase text-[#707070] mb-1">Deadline</label>
              <input
                type="text"
                placeholder="e.g. 10 ticks"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full bg-[#171717] border border-[#292929] rounded-[3px] px-3 py-2 text-[#F2F2F2] focus:border-[#E8E8E8] outline-none text-xs font-mono transition"
              />
            </div>
          </div>

          {/* Required Resources Selection */}
          {resources.length > 0 && (
            <div>
              <label className="block text-[10px] uppercase text-[#707070] mb-1.5">
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
                      className={`px-2.5 py-1.5 rounded-[3px] text-[10px] font-mono flex items-center space-x-1.5 border transition active:scale-[0.97] ${
                        isSelected
                          ? 'bg-[#1C1C1C] border-[#E8E8E8] text-[#F2F2F2] font-bold'
                          : 'bg-[#141414] border-[#292929] text-[#707070] hover:text-[#A1A1A1]'
                      }`}
                    >
                      <Layers className="w-3 h-3 text-[#A1A1A1]" />
                      <span>{r.name}</span>
                      <span className="text-[9px] text-[#555555]">({r.resource_type})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-2 flex items-center justify-end space-x-2 border-t border-[#1C1C1C]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-[3px] text-[#707070] hover:text-[#F2F2F2] transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-[3px] bg-[#E8E8E8] hover:bg-white text-[#080808] font-bold active:scale-95 transition uppercase tracking-wider"
            >
              {isSubmitting ? 'CREATING...' : 'CREATE & DISPATCH TASK'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
