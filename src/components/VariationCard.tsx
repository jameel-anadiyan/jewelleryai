import React from 'react';
import { Variation } from '../types';
import {
  Download,
  RotateCw,
  Star,
  AlertCircle,
  Gem,
  Maximize2,
  Layers,
  Ruler,
  Scale,
} from 'lucide-react';
import { downloadSinglePng } from '../services/export';

interface VariationCardProps {
  variation: Variation;
  sku: string;
  onRegenerate: (index: number) => void;
  onToggleStar: (index: number) => void;
  onOpenLightbox: (variation: Variation) => void;
}

export const VariationCard: React.FC<VariationCardProps> = ({
  variation,
  sku,
  onRegenerate,
  onToggleStar,
  onOpenLightbox,
}) => {
  const padIndex = String(variation.index).padStart(2, '0');

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    downloadSinglePng(variation, sku);
  };

  const handleRegenerate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRegenerate(variation.index);
  };

  const handleStar = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleStar(variation.index);
  };

  return (
    <div className="glass-panel rounded-2xl overflow-hidden border border-gold-500/20 bg-zinc-950/80 flex flex-col justify-between glass-panel-hover transition-all duration-300 group">
      {/* Top Header */}
      <div className="p-4 pb-3 flex items-center justify-between border-b border-zinc-800/80">
        <div className="flex items-center space-x-2">
          <span className="w-6 h-6 rounded-md bg-gold-500/15 border border-gold-500/30 flex items-center justify-center font-mono text-xs font-bold text-gold-300">
            {padIndex}
          </span>
          <h4 className="text-sm font-bold text-white tracking-wide truncate max-w-[180px] sm:max-w-[200px]" title={variation.name}>
            {variation.name}
          </h4>
        </div>

        {/* Favorite Star Button */}
        <button
          onClick={handleStar}
          className={`p-1.5 rounded-lg border transition-all ${
            variation.isStarred
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm shadow-amber-500/20'
              : 'bg-zinc-900/60 border-zinc-800 text-zinc-500 hover:text-amber-400 hover:bg-zinc-800'
          }`}
          title={variation.isStarred ? 'Starred as Best' : 'Mark as Best'}
        >
          <Star className={`w-4 h-4 ${variation.isStarred ? 'fill-amber-400 text-amber-400' : ''}`} />
        </button>
      </div>

      {/* Image Area */}
      <div className="relative aspect-square w-full bg-[#0E1017] flex items-center justify-center overflow-hidden border-b border-zinc-800/80">
        {/* Waiting state */}
        {variation.status === 'waiting' && (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-zinc-950/50 relative">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-3 text-zinc-600">
              <Gem className="w-8 h-8 opacity-40 animate-pulse" />
            </div>
            <p className="text-xs font-medium text-zinc-400 mb-1">Queued for Sketch</p>
            <p className="text-[10px] text-zinc-600 max-w-[160px]">
              Ready for GPT Image 2.5 parallel renderer
            </p>
          </div>
        )}

        {/* Generating state */}
        {variation.status === 'generating' && (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-zinc-950 via-zinc-900/40 to-zinc-950 relative overflow-hidden">
            <div className="absolute inset-0 bg-gold-500/5 animate-pulse" />
            <div className="relative w-16 h-16 flex items-center justify-center mb-3">
              <div className="absolute inset-0 rounded-full border-2 border-gold-500/20 border-t-gold-400 animate-spin" />
              <Gem className="w-7 h-7 text-gold-400 animate-bounce" />
            </div>
            <p className="text-xs font-bold text-gold-300 mb-1">Rendering Sketch...</p>
            <p className="text-[10px] text-zinc-400 max-w-[170px]">
              Drawing fine ink & watercolour details
            </p>
          </div>
        )}

        {/* Done state with sketch */}
        {variation.status === 'done' && variation.imageBase64 && (
          <div
            onClick={() => onOpenLightbox(variation)}
            className="w-full h-full cursor-pointer relative group/img overflow-hidden"
          >
            <img
              src={`data:image/png;base64,${variation.imageBase64}`}
              alt={variation.name}
              className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-500"
            />
            {/* Hover overlay with zoom button */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity duration-200 flex items-center justify-center">
              <div className="px-3 py-1.5 rounded-lg bg-black/80 backdrop-blur-md border border-white/20 text-white text-xs font-medium flex items-center space-x-1.5 shadow-xl">
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Enlarge Sketch</span>
              </div>
            </div>
          </div>
        )}

        {/* Failed state */}
        {variation.status === 'failed' && (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-red-950/20">
            <AlertCircle className="w-10 h-10 text-red-400 mb-2" />
            <p className="text-xs font-semibold text-red-300 mb-1">Rendering Failed</p>
            <p className="text-[10px] text-zinc-400 mb-3 max-w-[180px] line-clamp-2">
              {variation.errorMessage || 'Timeout or API rate limit'}
            </p>
            <button
              onClick={handleRegenerate}
              className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 text-xs font-medium flex items-center space-x-1.5 transition-all"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Retry Card</span>
            </button>
          </div>
        )}
      </div>

      {/* Description & Specifications */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          {/* Description */}
          <p className="text-xs text-zinc-300 leading-relaxed mb-2.5 line-clamp-2">
            {variation.description}
          </p>

          {/* Motif Treatment line (Motif Lock) */}
          {variation.motifTreatment && (
            <div className="flex items-center space-x-1.5 text-[11px] text-purple-200 bg-purple-950/30 border border-purple-500/20 rounded-lg px-2.5 py-1 mb-2.5 font-medium">
              <span className="text-purple-400 font-bold uppercase text-[9px] tracking-wider">Motif:</span>
              <span className="truncate">{variation.motifTreatment}</span>
            </div>
          )}

          {/* Stone count line (PLAN.md line 94) */}
          <div className="flex items-center space-x-1.5 text-xs text-gold-300 bg-gold-500/10 border border-gold-500/20 rounded-lg px-2.5 py-1.5 mb-3 font-medium">
            <Gem className="w-3.5 h-3.5 flex-shrink-0 text-gold-400" />
            <span className="truncate">
              {variation.stoneCount} stones • {variation.stoneLayout}
            </span>
          </div>

          {/* Specs grid (PLAN.md line 95) */}
          <div className="grid grid-cols-3 gap-2 text-[11px] mb-3">
            <div className="p-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300" title={`Setting: ${variation.setting}`}>
              <div className="flex items-center space-x-1 text-zinc-500 mb-0.5">
                <Layers className="w-2.5 h-2.5" />
                <span className="text-[9px] uppercase tracking-wider">Setting</span>
              </div>
              <span className="font-medium truncate block capitalize">{variation.setting}</span>
            </div>

            <div className="p-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300" title={`Size: ${variation.sizeMm} mm`}>
              <div className="flex items-center space-x-1 text-zinc-500 mb-0.5">
                <Ruler className="w-2.5 h-2.5" />
                <span className="text-[9px] uppercase tracking-wider">Size</span>
              </div>
              <span className="font-medium truncate block">{variation.sizeMm} mm</span>
            </div>

            <div className="p-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300" title={`Gold vs Original: ${variation.goldVsOriginal}`}>
              <div className="flex items-center space-x-1 text-zinc-500 mb-0.5">
                <Scale className="w-2.5 h-2.5" />
                <span className="text-[9px] uppercase tracking-wider">Gold</span>
              </div>
              <span className="font-medium truncate block capitalize">{variation.goldVsOriginal}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-2">
          {/* Download PNG */}
          <button
            onClick={handleDownload}
            disabled={variation.status !== 'done'}
            className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all ${
              variation.status === 'done'
                ? 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-700 hover:border-gold-500/50'
                : 'bg-zinc-900/40 text-zinc-600 border border-zinc-800/40 cursor-not-allowed'
            }`}
            title="Download PNG named {sku}_{nn}_{slug}.png"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download PNG</span>
          </button>

          {/* Regenerate Button */}
          <button
            onClick={handleRegenerate}
            disabled={variation.status === 'generating'}
            className="py-1.5 px-2.5 rounded-lg text-xs font-medium bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-all flex items-center space-x-1"
            title="Regenerate only this card's image"
          >
            <RotateCw className={`w-3.5 h-3.5 ${variation.status === 'generating' ? 'animate-spin text-gold-400' : ''}`} />
            <span className="hidden sm:inline">Regen</span>
          </button>
        </div>
      </div>
    </div>
  );
};
