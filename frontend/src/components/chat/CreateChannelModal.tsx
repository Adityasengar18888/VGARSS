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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none font-sans">
      <div className="w-full max-w-md bg-[#111111] border border-[#292929] rounded-[4px] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="h-12 border-b border-[#222222] px-4 flex items-center justify-between bg-[#0C0C0C]">
          <div className="flex items-center space-x-2">
            <Hash className="w-4 h-4 text-[#E8E8E8]" />
            <span className="font-bold text-xs tracking-editorial text-[#F2F2F2]">
              CREATE NEW CHANNEL <span className="font-mono text-[10px] text-[#707070] font-normal">// TOPIC STREAM</span>
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded text-[#707070] hover:text-[#F2F2F2] hover:bg-[#1A1A1A] transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs font-mono">
          {error && <div className="p-2.5 rounded bg-[#1F1212] border border-[#4A1E1E] text-[#EF4444] text-xs">{error}</div>}

          <div>
            <label className="block text-[10px] uppercase text-[#707070] mb-1">Channel Name *</label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-[#707070] font-mono">#</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="new-channel"
                className="w-full bg-[#171717] border border-[#292929] rounded-[3px] pl-7 pr-3 py-2 text-[#F2F2F2] placeholder-[#555555] focus:border-[#E8E8E8] outline-none transition"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase text-[#707070] mb-1">Topic / Purpose</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="What is this channel about?"
              className="w-full bg-[#171717] border border-[#292929] rounded-[3px] px-3 py-2 text-[#F2F2F2] placeholder-[#555555] focus:border-[#E8E8E8] outline-none transition font-sans"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase text-[#707070] mb-1">Channel Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setChannelType('TEXT')}
                className={`p-2.5 rounded-[3px] border text-left transition ${
                  channelType === 'TEXT'
                    ? 'border-[#E8E8E8] bg-[#1C1C1C] text-[#F2F2F2] font-semibold'
                    : 'border-[#292929] bg-[#141414] text-[#707070] hover:text-[#A1A1A1]'
                }`}
              >
                <div className="flex items-center space-x-1.5 font-bold mb-0.5">
                  <Hash className="w-3.5 h-3.5" />
                  <span>Discussion</span>
                </div>
                <div className="text-[10px] text-[#555555]">Standard text collaboration</div>
              </button>

              <button
                type="button"
                onClick={() => setChannelType('SIMULATION')}
                className={`p-2.5 rounded-[3px] border text-left transition ${
                  channelType === 'SIMULATION'
                    ? 'border-[#F59E0B] bg-[#221A10] text-[#F59E0B] font-semibold'
                    : 'border-[#292929] bg-[#141414] text-[#707070] hover:text-[#A1A1A1]'
                }`}
              >
                <div className="flex items-center space-x-1.5 font-bold mb-0.5">
                  <Flame className="w-3.5 h-3.5" />
                  <span>Simulation</span>
                </div>
                <div className="text-[10px] text-[#555555]">Tied to CPU scheduler lab</div>
              </button>
            </div>
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
              disabled={isSubmitting || !name.trim()}
              className="px-4 py-2 rounded-[3px] bg-[#E8E8E8] hover:bg-white disabled:opacity-40 text-[#080808] font-bold active:scale-95 transition uppercase tracking-wider"
            >
              {isSubmitting ? 'CREATING...' : 'CREATE CHANNEL'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
