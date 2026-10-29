import React, { useState } from 'react';
import { X, Hash, Flame } from 'lucide-react';

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId?: string;
  onCreateChannel: (payload: { name: string; topic?: string; channel_type: 'TEXT' | 'SIMULATION'; is_private: boolean }) => Promise<void>;
}

export function CreateChannelModal({ isOpen, onClose, onCreateChannel }: CreateChannelModalProps) {
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [channelType, setChannelType] = useState<'TEXT' | 'SIMULATION'>('TEXT');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onCreateChannel({
        name: name.trim().toLowerCase().replace(/\s+/g, '-'),
        topic: topic.trim(),
        channel_type: channelType,
        is_private: false,
      });
      setName('');
      setTopic('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create channel.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-md bg-white border border-[#E4E7EC] rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="h-12 border-b border-[#E4E7EC] px-4 flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center space-x-2">
            <Hash className="w-4 h-4 text-[#4055A8]" />
            <span className="font-semibold text-sm text-[#202631]">Create New Channel</span>
          </div>
          <button onClick={onClose} className="p-1 rounded text-[#667085] hover:text-[#202631] transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
          {error && <div className="p-2.5 rounded bg-[#FEF3F2] border border-[#FECDCA] text-[#B42318]">{error}</div>}

          <div>
            <label className="block text-[#344054] font-medium mb-1">Channel Name *</label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-[#98A2B3] font-mono">#</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="new-channel"
                className="w-full bg-white border border-[#D0D5DD] rounded-lg pl-7 pr-3 py-2 text-[#202631] placeholder-[#98A2B3] focus:border-[#4055A8] focus:ring-1 focus:ring-[#4055A8] outline-none font-mono transition"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[#344054] font-medium mb-1">Topic / Purpose</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="What is this channel about?"
              className="w-full bg-white border border-[#D0D5DD] rounded-lg px-3 py-2 text-[#202631] placeholder-[#98A2B3] focus:border-[#4055A8] focus:ring-1 focus:ring-[#4055A8] outline-none transition"
            />
          </div>

          <div>
            <label className="block text-[#344054] font-medium mb-1">Channel Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setChannelType('TEXT')}
                className={`p-2.5 rounded-lg border text-left transition ${
                  channelType === 'TEXT'
                    ? 'border-[#4055A8] bg-[#EEF2FF] text-[#4055A8] font-semibold'
                    : 'border-[#D0D5DD] bg-white text-[#475467] hover:bg-[#F8FAFC]'
                }`}
              >
                <div className="flex items-center space-x-1.5 font-bold mb-0.5">
                  <Hash className="w-3.5 h-3.5" />
                  <span>Discussion</span>
                </div>
                <div className="text-[10px] text-[#667085]">Standard text collaboration</div>
              </button>

              <button
                type="button"
                onClick={() => setChannelType('SIMULATION')}
                className={`p-2.5 rounded-lg border text-left transition ${
                  channelType === 'SIMULATION'
                    ? 'border-[#B7791F] bg-[#FEF6EE] text-[#B7791F] font-semibold'
                    : 'border-[#D0D5DD] bg-white text-[#475467] hover:bg-[#F8FAFC]'
                }`}
              >
                <div className="flex items-center space-x-1.5 font-bold mb-0.5">
                  <Flame className="w-3.5 h-3.5" />
                  <span>OS Simulation</span>
                </div>
                <div className="text-[10px] text-[#667085]">Processes & CPU metrics</div>
              </button>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end space-x-2 border-t border-[#F2F4F7]">
            <button type="button" onClick={onClose} className="px-3 py-2 text-[#475467] hover:text-[#202631] font-medium transition">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-4 py-2 rounded-lg bg-[#4055A8] hover:bg-[#334488] disabled:bg-[#D0D5DD] text-white font-semibold active:scale-[0.97] transition"
            >
              {isSubmitting ? 'Creating...' : 'Create Channel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
