import React, { useState } from 'react';
import { StudioJob } from '../types';
import { ChevronDown, ChevronUp, Eye } from 'lucide-react';

interface ReferenceSummaryCardProps {
  job: StudioJob;
  onViewPhoto: (photoUrl: string) => void;
  onUpdateMasterMm?: (newMm: string) => void;
}

export const ReferenceSummaryCard: React.FC<ReferenceSummaryCardProps> = ({ job, onViewPhoto, onUpdateMasterMm }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditingMm, setIsEditingMm] = useState(false);
  const [mmInput, setMmInput] = useState(job.masterMm || '');

  return (
    <div className="glass-panel rounded-xl p-4 sm:p-5 mb-6 border border-gold-500/20 bg-zinc-950/70">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left: Thumbnail & Details */}
        <div className="flex items-center space-x-4">
          <div
            onClick={() => onViewPhoto(job.photoUrl)}
            className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border border-gold-500/30 bg-zinc-900 cursor-pointer group flex-shrink-0"
          >
            <img
              src={job.photoUrl}
              alt="Reference jewellery"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
              <Eye className="w-4 h-4" />
            </div>
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs uppercase tracking-wider font-bold text-gold-400">
                Master Reference
              </span>
              {job.sku && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                  SKU: {job.sku}
                </span>
              )}
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-gold-500/15 text-gold-300 border border-gold-500/30">
                {job.diamondCount} Stones / {job.countFor === 'pair' ? 'Earring' : 'Piece'}
              </span>
              {job.original.motif && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center space-x-1">
                  <span>🔒 Motif Lock: {job.original.motif}</span>
                </span>
              )}

              {/* Master MM Display & Quick Edit */}
              {isEditingMm ? (
                <div className="flex items-center space-x-1">
                  <input
                    type="text"
                    value={mmInput}
                    onChange={(e) => setMmInput(e.target.value)}
                    placeholder="e.g. 4.9 x 2.6 mm"
                    className="px-2 py-0.5 text-[11px] font-mono rounded bg-zinc-900 border border-gold-500 text-white focus:outline-none w-32"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingMm(false);
                      if (onUpdateMasterMm) onUpdateMasterMm(mmInput);
                    }}
                    className="px-2 py-0.5 text-[10px] font-bold rounded bg-gold-500 text-black hover:opacity-90"
                  >
                    Apply MM
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingMm(false)}
                    className="px-1.5 py-0.5 text-[10px] text-zinc-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMmInput(job.masterMm || '');
                    setIsEditingMm(true);
                  }}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded border font-mono transition-all flex items-center space-x-1 cursor-pointer ${
                    job.masterMm
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:border-emerald-400'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-gold-300 hover:border-gold-500/50'
                  }`}
                  title="Click to edit Master MM shown within pictures"
                >
                  <span>📏 {job.masterMm ? `Master MM: ${job.masterMm}` : '+ Add Master MM to Pictures'}</span>
                </button>
              )}
              {job.clusterRhodiumFill && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  ✨ Close Cluster & Rhodium Fill
                </span>
              )}
              {job.headShapeVariance && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40">
                  ✨ 40%–50% Head Shape Difference
                </span>
              )}
            </div>

            <h3 className="text-base font-bold text-white capitalize mt-0.5">
              {job.original.productType || 'Fine Jewellery'} • {job.original.metal}
            </h3>

            <p className="text-xs text-zinc-400 line-clamp-1 mt-0.5">
              {job.original.summary}
            </p>
          </div>
        </div>

        {/* Right: Expand Toggle */}
        <div className="flex items-center space-x-3 self-end sm:self-center">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center space-x-1.5 text-xs text-zinc-400 hover:text-white px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 transition-all"
          >
            <span>{isExpanded ? 'Less Specs' : 'Full Analysis'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded detailed specifications */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-zinc-800/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {job.original.motif && (
            <div className="p-3 rounded-lg bg-purple-950/20 border border-purple-500/30">
              <span className="text-purple-400 block mb-1 font-semibold">🔒 Locked Motif Family</span>
              <span className="text-zinc-100 font-medium">{job.original.motif}</span>
            </div>
          )}

          <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
            <span className="text-zinc-500 block mb-1">Detected Stone Layout</span>
            <span className="text-zinc-200 font-medium">{job.original.stoneLayout}</span>
          </div>

          <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
            <span className="text-zinc-500 block mb-1">Must Keep Instructions</span>
            <span className="text-zinc-200 font-medium">{job.mustKeep || 'None specified'}</span>
          </div>

          <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
            <span className="text-zinc-500 block mb-1">Variation Criteria</span>
            <span className="text-gold-300 font-medium">
              10 Lightweight concepts • Thin wire (1.0-1.2mm) • Exact {job.diamondCount} stones
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
