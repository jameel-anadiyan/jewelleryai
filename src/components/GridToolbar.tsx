import React from 'react';
import { Download, Star, RotateCcw, CheckCircle2, Clock } from 'lucide-react';

interface GridToolbarProps {
  completedCount: number;
  totalCount: number;
  starredCount: number;
  isGenerating: boolean;
  filterStarredOnly: boolean;
  onToggleFilter: () => void;
  onDownloadAllZip: () => void;
  onDownloadStarredZip: () => void;
  onNewUpload: () => void;
}

export const GridToolbar: React.FC<GridToolbarProps> = ({
  completedCount,
  totalCount,
  starredCount,
  isGenerating,
  filterStarredOnly,
  onToggleFilter,
  onDownloadAllZip,
  onDownloadStarredZip,
  onNewUpload,
}) => {
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  return (
    <div className="glass-panel rounded-xl p-4 sm:p-5 mb-6 border border-gold-500/20 bg-zinc-950/80">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Progress status */}
        <div className="flex-1 max-w-md">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-zinc-300 flex items-center space-x-1.5">
              {isGenerating ? (
                <>
                  <Clock className="w-3.5 h-3.5 text-gold-400 animate-spin" />
                  <span>Generating Sketches with GPT Image 2.5...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Sketches Ready</span>
                </>
              )}
            </span>
            <span className="font-mono text-gold-400 font-bold">
              {completedCount} of {totalCount} ready ({progressPercent}%)
            </span>
          </div>

          {/* Luxury Progress Bar */}
          <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden relative border border-zinc-700/50">
            <div
              className="h-full gold-gradient-bg transition-all duration-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Center / Right: Filter & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Starred filter button */}
          <button
            onClick={onToggleFilter}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
              filterStarredOnly
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${starredCount > 0 ? 'text-amber-400 fill-amber-400' : ''}`} />
            <span>Starred ({starredCount})</span>
          </button>

          {/* Download Starred ZIP */}
          <button
            onClick={onDownloadStarredZip}
            disabled={starredCount === 0}
            className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border transition-all ${
              starredCount > 0
                ? 'bg-zinc-900 hover:bg-zinc-800 border-gold-500/40 text-gold-300 hover:text-gold-200 cursor-pointer'
                : 'bg-zinc-900/40 border-zinc-800/50 text-zinc-600 cursor-not-allowed'
            }`}
            title="Download starred designs as ZIP with CSV and JSON"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Download Starred</span>
            <span className="sm:hidden">Starred</span>
            <span>({starredCount})</span>
          </button>

          {/* Download All ZIP */}
          <button
            onClick={onDownloadAllZip}
            disabled={completedCount === 0}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold border transition-all ${
              completedCount > 0
                ? 'gold-gradient-bg text-black hover:opacity-95 shadow-md shadow-gold-500/20 cursor-pointer'
                : 'bg-zinc-800 text-zinc-500 border-zinc-700/50 cursor-not-allowed'
            }`}
            title="Download all variations as ZIP with CSV and JSON"
          >
            <Download className="w-3.5 h-3.5 text-black" />
            <span>Download All ({completedCount})</span>
          </button>

          {/* Reset New Upload */}
          <button
            onClick={onNewUpload}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition-all ml-1"
            title="Start a new jewellery upload"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Upload</span>
          </button>
        </div>
      </div>
    </div>
  );
};
