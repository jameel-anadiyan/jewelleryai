import React, { useState, useEffect } from 'react';
import { StudioJob } from '../types';
import {
  X,
  Search,
  History,
  Calendar,
  Gem,
  Trash2,
  FolderOpen,
  Cloud,
  RefreshCw,
} from 'lucide-react';
import {
  fetchHistoryFromSupabase,
  deleteRunFromSupabase,
} from '../services/supabase';

interface HistoryModalProps {
  history: StudioJob[];
  onClose: () => void;
  onSelectJob: (job: StudioJob) => void;
  onDeleteJob: (jobId: string) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  history: initialHistory,
  onClose,
  onSelectJob,
  onDeleteJob,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [combinedHistory, setCombinedHistory] = useState<StudioJob[]>(initialHistory);
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);

  // Load latest history directly from Supabase server on mount
  useEffect(() => {
    async function loadCloudHistory() {
      setIsLoadingCloud(true);
      try {
        const cloudJobs = await fetchHistoryFromSupabase();
        if (cloudJobs && cloudJobs.length > 0) {
          // Merge local and cloud runs, deduplicating by jobId
          const map = new Map<string, StudioJob>();
          initialHistory.forEach((j) => map.set(j.jobId, j));
          cloudJobs.forEach((j) => {
            const existing = map.get(j.jobId);
            if (!existing || (j.variations && j.variations.length >= (existing.variations?.length || 0))) {
              map.set(j.jobId, j);
            }
          });
          const merged = Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
          setCombinedHistory(merged);
        }
      } catch (err) {
        console.warn('Could not load cloud history:', err);
      } finally {
        setIsLoadingCloud(false);
      }
    }
    loadCloudHistory();
  }, [initialHistory]);

  const filteredHistory = combinedHistory.filter((job) => {
    const term = searchTerm.toLowerCase();
    const skuMatch = (job.sku || '').toLowerCase().includes(term);
    const summaryMatch = (job.original?.summary || '').toLowerCase().includes(term);
    const variationMatch = (job.variations || []).some((v) => (v.name || '').toLowerCase().includes(term));
    return skuMatch || summaryMatch || variationMatch;
  });

  const handleDelete = async (jobId: string) => {
    // Delete from Supabase server
    deleteRunFromSupabase(jobId).catch((e) => console.warn('Supabase delete error:', e));
    // Delete from local
    onDeleteJob(jobId);
    setCombinedHistory((prev) => prev.filter((j) => j.jobId !== jobId));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-3xl rounded-2xl glass-panel border border-gold-500/30 bg-[#0B0C10] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-gold-500/15 border border-gold-500/30 flex items-center justify-center text-gold-400">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-luxury">
                Past Studio Runs & Design History
              </h3>
              <p className="text-xs text-zinc-400 flex items-center space-x-1.5 mt-0.5">
                <Cloud className="w-3.5 h-3.5 text-emerald-400 inline" />
                <span>Connected to Supabase Server (eylkbycxhptmmqcpvloz)</span>
                {isLoadingCloud && (
                  <RefreshCw className="w-3 h-3 text-gold-400 animate-spin inline ml-1" />
                )}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search bar */}
        <div className="p-4 border-b border-zinc-800/80 bg-zinc-950/60">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search past runs by SKU, design name, or jewellery summary..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs focus:outline-none focus:border-gold-500"
            />
          </div>
        </div>

        {/* History list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredHistory.length === 0 ? (
            <div className="py-12 text-center text-zinc-500">
              <Gem className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">No past runs found</p>
              <p className="text-xs text-zinc-600 mt-1">
                Completed designs and sketches are saved automatically to your Supabase server
              </p>
            </div>
          ) : (
            filteredHistory.map((job) => {
              const readyCount = (job.variations || []).filter((v) => v.status === 'done' || v.imageBase64).length;
              const totalCount = job.variations?.length || 10;
              const dateStr = new Date(job.createdAt).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={job.jobId}
                  className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 hover:border-gold-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  {/* Left thumbnail and info */}
                  <div className="flex items-center space-x-3.5">
                    {job.photoUrl ? (
                      <img
                        src={job.photoUrl}
                        alt="Thumbnail"
                        className="w-14 h-14 object-cover rounded-lg bg-black border border-zinc-800 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center text-gold-500/40 flex-shrink-0">
                        <Gem className="w-6 h-6" />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center space-x-2 mb-0.5">
                        <span className="text-xs font-bold text-white">
                          SKU: {job.sku || 'SWA-Custom'}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gold-500/15 text-gold-300 border border-gold-500/30">
                          {job.diamondCount} Stones
                        </span>
                        <span className="text-[10px] text-zinc-500 capitalize">
                          {job.quality || 'medium'} quality
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 line-clamp-1">
                        {job.original?.summary || 'Custom jewellery variation run'}
                      </p>
                      <div className="flex items-center space-x-3 text-[11px] text-zinc-500 mt-1">
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>{dateStr}</span>
                        </span>
                        <span>•</span>
                        <span className="text-gold-400/90">{readyCount} of {totalCount} sketches saved</span>
                      </div>
                    </div>
                  </div>

                  {/* Right actions */}
                  <div className="flex items-center space-x-2 self-end sm:self-center">
                    <button
                      onClick={() => onSelectJob(job)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold gold-gradient-bg text-black hover:opacity-95 shadow-md shadow-gold-500/20"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>Restore Run</span>
                    </button>
                    <button
                      onClick={() => handleDelete(job.jobId)}
                      className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-red-950/60 text-zinc-400 hover:text-red-400 border border-zinc-700/60 hover:border-red-500/40 transition-colors"
                      title="Delete from history"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
