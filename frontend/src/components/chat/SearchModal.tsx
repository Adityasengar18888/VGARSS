import React, { useState, useEffect } from 'react';
import { Search, X, MessageSquare, CheckSquare, ArrowRight } from 'lucide-react';
import { api } from '../../services/api';
import { SearchResult } from '../../types/chat';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  onSelectResult: (result: SearchResult) => void;
}

export function SearchModal({ isOpen, onClose, workspaceId, onSelectResult }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const data = await api.searchWorkspace(workspaceId, query.trim());
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/40 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-xl bg-white border border-[#E4E7EC] rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Search Input Bar */}
        <form onSubmit={handleSearch} className="h-12 border-b border-[#E4E7EC] px-3.5 flex items-center space-x-2 bg-white">
          <Search className="w-4 h-4 text-[#98A2B3]" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search messages, tasks, and system events in workspace..."
            className="flex-1 bg-transparent text-sm text-[#202631] placeholder-[#98A2B3] outline-none"
          />
          <button type="button" onClick={onClose} className="p-1 rounded text-[#667085] hover:text-[#202631] transition">
            <X className="w-4 h-4" />
          </button>
        </form>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-1">
          {loading ? (
            <div className="p-6 text-center text-xs text-[#667085]">Searching workspace index...</div>
          ) : results.length === 0 && query ? (
            <div className="p-6 text-center text-xs text-[#667085]">No matching messages or tasks found.</div>
          ) : results.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#667085]">
              Type keywords and press <kbd className="font-mono bg-[#F2F4F7] px-1 py-0.5 rounded text-[#475467] border border-[#E4E7EC]">Enter</kbd> to search.
            </div>
          ) : (
            results.map((res) => (
              <button
                key={`${res.type}-${res.id}`}
                onClick={() => {
                  onSelectResult(res);
                  onClose();
                }}
                className="w-full text-left p-2.5 rounded-lg hover:bg-[#F8FAFC] transition group flex items-start space-x-2.5 active:scale-[0.99]"
              >
                <div className="p-1.5 rounded-lg bg-[#F8FAFC] border border-[#E4E7EC] text-[#4055A8] flex-shrink-0 mt-0.5">
                  {res.type === 'task' ? <CheckSquare className="w-3.5 h-3.5 text-[#B7791F]" /> : <MessageSquare className="w-3.5 h-3.5 text-[#4055A8]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#202631] truncate">{res.title}</span>
                    <span className="text-[10px] font-mono text-[#98A2B3]">{new Date(res.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="text-xs text-[#667085] line-clamp-1 mt-0.5">{res.snippet}</div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[#98A2B3] group-hover:text-[#4055A8] flex-shrink-0 self-center opacity-0 group-hover:opacity-100 transition" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
