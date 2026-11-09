import React, { useState, useEffect } from 'react';
import { StudioJob, Variation } from '../types';
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
  Download,
  Maximize2,
  Sparkles,
} from 'lucide-react';
import {
  fetchHistoryFromSupabase,
  deleteRunFromSupabase,
} from '../services/supabase';
import { downloadZip } from '../services/export';

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
  const [previewVariation, setPreviewVariation] = useState<Variation | null>(null);

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
            const cloudGeneratedCount = (j.variations || []).filter((v) => v.imageBase64).length;
            const existingGeneratedCount = (existing?.variations || []).filter((v) => v.imageBase64).length;

            if (!existing || cloudGeneratedCount >= existingGeneratedCount) {
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

  const handleDownloadZip = async (job: StudioJob, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await downloadZip(job);
    } catch (err) {
      console.error('Failed to download ZIP:', err);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fadeIn">
        <div className="absolute inset-0" onClick={onClose} />

        <div className="relative z-10 w-full max-w-4xl rounded-2xl glass-panel border border-gold-500/30 bg-[#0B0C10] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
          {/* Header */}
          <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-gold-500/15 border border-gold-500/30 flex items-center justify-center text-gold-400">
                <History className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-luxury">
                  Past Generated Designs History
                </h3>
                <p className="text-xs text-zinc-400 flex items-center space-x-1.5 mt-0.5">
                  <Cloud className="w-3.5 h-3.5 text-emerald-400 inline" />
                  <span>Synced to Supabase Cloud Server (eylkbycxhptmmqcpvloz)</span>
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
                placeholder="Search generated designs by SKU, concept name, or jewellery summary..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs focus:outline-none focus:border-gold-500"
              />
            </div>
          </div>

          {/* History list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {filteredHistory.length === 0 ? (
              <div className="py-12 text-center text-zinc-500">
                <Gem className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">No past runs found</p>
                <p className="text-xs text-zinc-600 mt-1">
                  Generated design sketches are automatically stored and preserved in your Supabase server
                </p>
              </div>
            ) : (
              filteredHistory.map((job) => {
                const generatedVariations = (job.variations || []).filter(
                  (v) => Boolean(v.imageBase64)
                );
                const totalCount = job.variations?.length || 10;
                const readyCount = generatedVariations.length;
                const dateStr = new Date(job.createdAt).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={job.jobId}
                    className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:border-gold-500/40 transition-all flex flex-col space-y-3 group"
                  >
                    {/* Top Row: Info & Action Buttons */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/60">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-white font-mono">
                            {job.sku || 'SWA-Custom'}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gold-500/15 text-gold-300 border border-gold-500/30 font-medium">
                            {job.diamondCount} Stones
                          </span>
                          {job.headLength && job.headWidth && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 font-mono">
                              Head: {job.headLength} × {job.headWidth} mm (±20% max)
                            </span>
                          )}
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center space-x-1">
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>{readyCount} of {totalCount} Generated Sketches</span>
                          </span>
                        </div>
                        <p className="text-xs text-zinc-300 line-clamp-1">
                          {job.original?.summary || 'Custom jewellery variation concepts'}
                        </p>
                        <div className="flex items-center space-x-3 text-[11px] text-zinc-500 mt-1">
                          <span className="flex items-center space-x-1">
                            <Calendar className="w-3 h-3" />
                            <span>{dateStr}</span>
                          </span>
                          <span>•</span>
                          <span className="capitalize">{job.quality || 'medium'} quality</span>
                        </div>
                      </div>

                      {/* Right Action buttons */}
                      <div className="flex items-center space-x-2 self-end sm:self-center">
                        {readyCount > 0 && (
                          <button
                            type="button"
                            onClick={(e) => handleDownloadZip(job, e)}
                            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white border border-zinc-700 transition-all"
                            title="Download all generated pictures in a ZIP archive"
                          >
                            <Download className="w-3.5 h-3.5 text-gold-400" />
                            <span className="hidden md:inline">Download ZIP</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onSelectJob(job)}
                          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold gold-gradient-bg text-black hover:opacity-95 shadow-md shadow-gold-500/20"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                          <span>Open in Studio</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(job.jobId)}
                          className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-red-950/60 text-zinc-400 hover:text-red-400 border border-zinc-700/60 hover:border-red-500/40 transition-colors"
                          title="Delete from history"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Gallery Strip of ALL GENERATED PICTURES */}
                    {readyCount > 0 ? (
                      <div>
                        <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-2 font-medium">
                          <span>Generated Design Sketches ({readyCount} saved):</span>
                          <span className="text-[10px] text-zinc-500">Click any sketch to enlarge</span>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2 overflow-x-auto py-1">
                          {generatedVariations.map((v) => {
                            const imgSrc = v.imageBase64?.startsWith('data:')
                              ? v.imageBase64
                              : `data:image/png;base64,${v.imageBase64}`;

                            return (
                              <div
                                key={v.index}
                                onClick={() => setPreviewVariation(v)}
                                className="group/thumb relative aspect-square rounded-lg overflow-hidden bg-black/60 border border-zinc-800 hover:border-gold-400/80 cursor-pointer transition-all shadow-sm"
                                title={`${v.name} (#${v.index})`}
                              >
                                <img
                                  src={imgSrc}
                                  alt={v.name}
                                  className="w-full h-full object-contain p-1 transition-transform group-hover/thumb:scale-105"
                                />
                                <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/75 text-[9px] font-mono text-gold-300 font-bold">
                                  #{v.index}
                                </div>
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                                  <Maximize2 className="w-4 h-4 text-white drop-shadow-md" />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="py-3 px-4 rounded-lg bg-zinc-950/60 border border-zinc-800/80 text-xs text-zinc-500 italic">
                        Sketches are generating or pending for this run.
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Enlarged Single Generated Picture Lightbox */}
      {previewVariation && previewVariation.imageBase64 && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn"
          onClick={() => setPreviewVariation(null)}
        >
          <div
            className="relative max-w-lg w-full rounded-2xl bg-zinc-950 border border-gold-500/40 p-5 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-gold-500/20 text-gold-300 font-bold mr-2">
                  #{previewVariation.index}
                </span>
                <span className="text-sm font-bold text-white font-luxury">
                  {previewVariation.name}
                </span>
              </div>
              <button
                onClick={() => setPreviewVariation(null)}
                className="p-1 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="w-full aspect-square bg-black rounded-xl overflow-hidden border border-zinc-800 flex items-center justify-center p-2">
              <img
                src={
                  previewVariation.imageBase64.startsWith('data:')
                    ? previewVariation.imageBase64
                    : `data:image/png;base64,${previewVariation.imageBase64}`
                }
                alt={previewVariation.name}
                className="w-full h-full object-contain"
              />
            </div>

            <div className="text-xs text-zinc-300 space-y-1">
              <p className="line-clamp-2">{previewVariation.description}</p>
              <div className="flex items-center space-x-3 text-[11px] text-zinc-400 pt-1">
                <span>Stones: {previewVariation.stoneCount}</span>
                <span>•</span>
                <span>Setting: {previewVariation.setting}</span>
                <span>•</span>
                <span>Size: {previewVariation.sizeMm}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
