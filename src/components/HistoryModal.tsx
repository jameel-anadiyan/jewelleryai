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
  ZoomIn,
  Sparkles,
  Star,
  Ruler,
} from 'lucide-react';
import {
  fetchHistoryFromSupabase,
  deleteRunFromSupabase,
} from '../services/supabase';
import { downloadZip, downloadSinglePng } from '../services/export';

interface HistoryModalProps {
  history: StudioJob[];
  onClose: () => void;
  onSelectJob: (job: StudioJob) => void;
  onDeleteJob: (jobId: string) => void;
}

function getImageSrc(imageBase64?: string): string {
  if (!imageBase64) return '';
  if (imageBase64.startsWith('data:image/')) return imageBase64;
  return `data:image/png;base64,${imageBase64}`;
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
  const [downloadingJobId, setDownloadingJobId] = useState<string | null>(null);

  // Lightbox preview for any generated sketch in history
  const [selectedVariation, setSelectedVariation] = useState<{
    variation: Variation;
    job: StudioJob;
  } | null>(null);

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
            if (
              !existing ||
              (j.variations && j.variations.length >= (existing.variations?.length || 0))
            ) {
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
    const variationMatch = (job.variations || []).some((v) =>
      (v.name || '').toLowerCase().includes(term)
    );
    return skuMatch || summaryMatch || variationMatch;
  });

  const handleDelete = async (jobId: string) => {
    deleteRunFromSupabase(jobId).catch((e) => console.warn('Supabase delete error:', e));
    onDeleteJob(jobId);
    setCombinedHistory((prev) => prev.filter((j) => j.jobId !== jobId));
  };

  const handleDownloadZip = async (jobToDownload: StudioJob) => {
    try {
      setDownloadingJobId(jobToDownload.jobId);
      const count = await downloadZip(jobToDownload);
      if (count === 0) {
        alert('No generated sketches available to download for this run.');
      }
    } catch (err) {
      console.error('Failed to download ZIP:', err);
    } finally {
      setDownloadingJobId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-5xl rounded-2xl glass-panel border border-gold-500/30 bg-[#0B0C10] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-gold-500/15 border border-gold-500/30 flex items-center justify-center text-gold-400">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-luxury">
                Past Studio Runs & Generated Designs
              </h3>
              <p className="text-xs text-zinc-400 flex items-center space-x-1.5 mt-0.5">
                <Cloud className="w-3.5 h-3.5 text-emerald-400 inline" />
                <span>Connected to Supabase Server</span>
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
              placeholder="Search past runs by SKU, design name, diamond count, or summary..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs focus:outline-none focus:border-gold-500"
            />
          </div>
        </div>

        {/* History list */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {filteredHistory.length === 0 ? (
            <div className="py-16 text-center text-zinc-500">
              <Gem className="w-10 h-10 mx-auto mb-2 opacity-30 text-gold-400" />
              <p className="text-sm font-medium text-zinc-300">No past runs found</p>
              <p className="text-xs text-zinc-500 mt-1">
                Completed designs and generated sketches are saved automatically to your workspace and Supabase
              </p>
            </div>
          ) : (
            filteredHistory.map((job) => {
              const generatedVariations = (job.variations || []).filter(
                (v) => Boolean(v.imageBase64 && v.imageBase64.trim().length > 0)
              );
              const readyCount = generatedVariations.length;
              const totalCount = job.variations?.length || 10;
              const isDownloadingThis = downloadingJobId === job.jobId;

              const dateStr = new Date(job.createdAt).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              // Dimension text
              const dimText =
                job.headHeight && job.headWidth
                  ? `H: ${job.headHeight} mm  ×  W: ${job.headWidth} mm`
                  : job.masterMm || '';

              return (
                <div
                  key={job.jobId}
                  className="p-4 sm:p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 hover:border-gold-500/40 transition-all flex flex-col gap-3 group"
                >
                  {/* Top Bar: SKU, Stats, Date, and Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-zinc-800/60">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-white font-mono bg-zinc-800/80 px-2.5 py-1 rounded-md border border-zinc-700/60">
                          SKU: {job.sku || 'SWA-Custom'}
                        </span>
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-gold-500/15 text-gold-300 border border-gold-500/30 font-medium">
                          {job.diamondCount} Stones
                        </span>
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-medium flex items-center space-x-1">
                          <Sparkles className="w-3 h-3 text-emerald-400" />
                          <span>
                            {readyCount} of {totalCount} Sketches Generated
                          </span>
                        </span>
                        {dimText && (
                          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-zinc-800/80 text-amber-200 border border-amber-500/30 font-mono flex items-center space-x-1">
                            <Ruler className="w-3 h-3 text-amber-400" />
                            <span>{dimText}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-3 text-[11px] text-zinc-500 pt-0.5">
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>{dateStr}</span>
                        </span>
                        {job.quality && (
                          <>
                            <span>•</span>
                            <span className="capitalize">{job.quality} Quality</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2 self-start sm:self-center shrink-0">
                      <button
                        onClick={() => onSelectJob(job)}
                        className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold gold-gradient-bg text-black hover:opacity-95 shadow-md shadow-gold-500/20"
                        title="Restore this run and load all variations into the studio"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>Restore Run</span>
                      </button>

                      <button
                        onClick={() => handleDownloadZip(job)}
                        disabled={readyCount === 0 || isDownloadingThis}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white border border-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        title="Download all generated sketches as ZIP"
                      >
                        {isDownloadingThis ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-gold-400" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        <span className="hidden sm:inline">ZIP</span>
                      </button>

                      <button
                        onClick={() => handleDelete(job.jobId)}
                        className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-red-950/60 text-zinc-400 hover:text-red-400 border border-zinc-700/60 hover:border-red-500/40 transition-colors"
                        title="Delete run from history"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Jewellery Summary if available */}
                  {job.original?.summary && (
                    <p className="text-xs text-zinc-400 italic line-clamp-1">
                      "{job.original.summary}"
                    </p>
                  )}

                  {/* ALL GENERATED IMAGES GALLERY (No uploaded reference images) */}
                  {generatedVariations.length > 0 ? (
                    <div>
                      <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
                        <span className="font-semibold text-zinc-300 flex items-center space-x-1.5">
                          <Gem className="w-3.5 h-3.5 text-gold-400" />
                          <span>Generated Design Sketches ({readyCount})</span>
                        </span>
                        <span className="text-[11px] text-zinc-500">
                          Click sketch to view high-res
                        </span>
                      </div>

                      {/* Thumbnail Strip / Grid of Generated Sketches */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                        {generatedVariations.map((v) => (
                          <div
                            key={v.index}
                            onClick={() => setSelectedVariation({ variation: v, job })}
                            className="group/thumb relative aspect-square rounded-xl overflow-hidden bg-black/70 border border-zinc-800 hover:border-gold-500/80 cursor-pointer transition-all shadow-sm hover:shadow-gold-500/20"
                          >
                            <img
                              src={getImageSrc(v.imageBase64)}
                              alt={v.name || `Design Concept ${v.index}`}
                              className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-200"
                              loading="lazy"
                            />

                            {/* Card Index Badge */}
                            <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-xs text-[10px] font-bold text-gold-300 font-mono border border-gold-500/30">
                              #{v.index}
                            </div>

                            {/* Star Badge */}
                            {v.isStarred && (
                              <div className="absolute top-1.5 right-1.5 p-1 rounded bg-amber-500/90 text-black">
                                <Star className="w-2.5 h-2.5 fill-black" />
                              </div>
                            )}

                            {/* Hover Overlay with Concept Name & Zoom Icon */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover/thumb:opacity-100 transition-opacity flex flex-col justify-end p-2">
                              <span className="text-[11px] font-semibold text-white line-clamp-1">
                                {v.name || `Design ${v.index}`}
                              </span>
                              {v.sizeMm && (
                                <span className="text-[10px] text-gold-300 font-mono">
                                  {v.sizeMm}
                                </span>
                              )}
                              <span className="text-[10px] text-zinc-400 flex items-center space-x-1 mt-0.5">
                                <ZoomIn className="w-3 h-3 text-gold-400" />
                                <span>Inspect</span>
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-zinc-950/60 border border-dashed border-zinc-800 text-center">
                      <Gem className="w-6 h-6 mx-auto mb-1 text-zinc-600" />
                      <p className="text-xs text-zinc-400 font-medium">
                        No generated sketches saved for this run
                      </p>
                      <p className="text-[11px] text-zinc-600 mt-0.5">
                        Sketches appear here once generated
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* High-Resolution Lightbox for Generated Sketches from History */}
      {selectedVariation && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn"
          onClick={() => setSelectedVariation(null)}
        >
          <div
            className="relative max-w-2xl w-full bg-[#0D0E14] border border-gold-500/40 rounded-2xl p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Lightbox header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                  <span className="text-gold-400 font-mono">
                    #{selectedVariation.variation.index}
                  </span>
                  <span>{selectedVariation.variation.name}</span>
                </h4>
                <p className="text-xs text-zinc-400 mt-0.5 font-mono">
                  SKU: {selectedVariation.job.sku} • {selectedVariation.job.diamondCount} Stones
                  {selectedVariation.variation.sizeMm
                    ? ` • Head: ${selectedVariation.variation.sizeMm}`
                    : ''}
                </p>
              </div>
              <button
                onClick={() => setSelectedVariation(null)}
                className="p-1.5 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Generated Sketch Preview */}
            <div className="relative aspect-square max-h-[62vh] rounded-xl overflow-hidden bg-black border border-zinc-800 flex items-center justify-center">
              <img
                src={getImageSrc(selectedVariation.variation.imageBase64)}
                alt={selectedVariation.variation.name}
                className="max-w-full max-h-full object-contain"
              />
            </div>

            {/* Footer with Details & Download */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div className="text-xs text-zinc-400 line-clamp-2">
                {selectedVariation.variation.description ||
                  'High-detail AI generated jewellery design sketch.'}
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={() =>
                    downloadSinglePng(
                      selectedVariation.variation,
                      selectedVariation.job.sku
                    )
                  }
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold gold-gradient-bg text-black hover:opacity-95 shadow-md shadow-gold-500/20"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PNG</span>
                </button>
                <button
                  onClick={() => setSelectedVariation(null)}
                  className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
