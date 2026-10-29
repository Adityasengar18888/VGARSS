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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-md bg-white border border-[#E4E7EC] rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="h-12 border-b border-[#E4E7EC] px-4 flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center space-x-2">
            <Building className="w-4 h-4 text-[#4055A8]" />
            <span className="font-semibold text-sm text-[#202631]">Create New Workspace</span>
          </div>
          <button onClick={onClose} className="p-1 rounded text-[#667085] hover:text-[#202631] transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
          {error && <div className="p-2.5 rounded bg-[#FEF3F2] border border-[#FECDCA] text-[#B42318]">{error}</div>}

          <div>
            <label className="block text-[#344054] font-medium mb-1">Workspace Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Distributed Kernel Lab"
              className="w-full bg-white border border-[#D0D5DD] rounded-lg px-3 py-2 text-[#202631] placeholder-[#98A2B3] focus:border-[#4055A8] focus:ring-1 focus:ring-[#4055A8] outline-none transition"
              required
            />
          </div>

          <div>
            <label className="block text-[#344054] font-medium mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Focus area, research goals, or team scope..."
              rows={2}
              className="w-full bg-white border border-[#D0D5DD] rounded-lg px-3 py-2 text-[#202631] placeholder-[#98A2B3] focus:border-[#4055A8] focus:ring-1 focus:ring-[#4055A8] outline-none resize-none transition"
            />
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
              {isSubmitting ? 'Creating...' : 'Create Workspace'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
