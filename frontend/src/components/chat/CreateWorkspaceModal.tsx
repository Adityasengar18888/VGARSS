import React, { useState } from 'react';
import { X, Building } from 'lucide-react';

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateWorkspace: (payload: { name: string; description?: string }) => Promise<void>;
}

export function CreateWorkspaceModal({ isOpen, onClose, onCreateWorkspace }: CreateWorkspaceModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onCreateWorkspace({ name: name.trim(), description: description.trim() });
      setName('');
      setDescription('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create workspace.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none font-sans">
      <div className="w-full max-w-md bg-[#111111] border border-[#292929] rounded-[4px] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="h-12 border-b border-[#222222] px-4 flex items-center justify-between bg-[#0C0C0C]">
          <div className="flex items-center space-x-2">
            <Building className="w-4 h-4 text-[#E8E8E8]" />
            <span className="font-bold text-xs tracking-editorial text-[#F2F2F2]">
              CREATE NEW WORKSPACE <span className="font-mono text-[10px] text-[#707070] font-normal">// MULTI-TENANT</span>
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded text-[#707070] hover:text-[#F2F2F2] hover:bg-[#1A1A1A] transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs font-mono">
          {error && <div className="p-2.5 rounded bg-[#1F1212] border border-[#4A1E1E] text-[#EF4444] text-xs">{error}</div>}

          <div>
            <label className="block text-[10px] uppercase text-[#707070] mb-1">Workspace Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Distributed Kernel Lab"
              className="w-full bg-[#171717] border border-[#292929] rounded-[3px] px-3 py-2 text-[#F2F2F2] placeholder-[#555555] focus:border-[#E8E8E8] outline-none transition"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase text-[#707070] mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Focus area, research goals, or team scope..."
              rows={2}
              className="w-full bg-[#171717] border border-[#292929] rounded-[3px] px-3 py-2 text-[#F2F2F2] placeholder-[#555555] focus:border-[#E8E8E8] outline-none resize-none transition font-sans"
            />
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
              {isSubmitting ? 'CREATING...' : 'CREATE WORKSPACE'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
