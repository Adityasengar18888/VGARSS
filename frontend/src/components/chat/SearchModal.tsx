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
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/75 backdrop-blur-sm p-4 select-none font-sans">
      <div className="w-full max-w-xl bg-[#111111] border border-[#292929] rounded-[4px] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Search Input Bar */}
        <form onSubmit={handleSearch} className="h-12 border-b border-[#222222] px-3.5 flex items-center space-x-2 bg-[#0C0C0C]">
          <Search className="w-4 h-4 text-[#707070]" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search messages, tasks, and system events in workspace..."
            className="flex-1 bg-transparent text-xs text-[#F2F2F2] placeholder-[#555555] outline-none font-mono"
          />
          <button type="button" onClick={onClose} className="p-1 rounded text-[#707070] hover:text-[#F2F2F2] hover:bg-[#1A1A1A] transition">
            <X className="w-4 h-4" />
          </button>
        </form>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-1 font-mono text-xs no-scrollbar">
          {loading ? (
            <div className="p-6 text-center text-xs text-[#707070]">Searching workspace index...</div>
          ) : results.length === 0 && query ? (
            <div className="p-6 text-center text-xs text-[#707070]">No matching messages or tasks found.</div>
          ) : results.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#707070]">
              Type keywords and press <kbd className="bg-[#1C1C1C] px-1 py-0.5 rounded text-[#A1A1A1] border border-[#292929]">Enter</kbd> to search.
            </div>
          ) : (
            results.map((res) => (
              <button
                key={`${res.type}-${res.id}`}
                onClick={() => {
                  onSelectResult(res);
                  onClose();
                }}
                className="w-full text-left p-2.5 rounded-[3px] hover:bg-[#171717] transition group flex items-start space-x-2.5 active:scale-[0.99] border border-transparent hover:border-[#222222]"
              >
                <div className="p-1.5 rounded bg-[#171717] border border-[#292929] text-[#E8E8E8] flex-shrink-0 mt-0.5">
                  {res.type === 'task' ? <CheckSquare className="w-3.5 h-3.5 text-[#F59E0B]" /> : <MessageSquare className="w-3.5 h-3.5 text-[#A1A1A1]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#F2F2F2] truncate">{res.title}</span>
                    <span className="text-[10px] text-[#555555]">{new Date(res.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="text-xs text-[#707070] line-clamp-1 mt-0.5 font-sans">{res.snippet}</div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[#707070] group-hover:text-[#F2F2F2] flex-shrink-0 self-center opacity-0 group-hover:opacity-100 transition" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
