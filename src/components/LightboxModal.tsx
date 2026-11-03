import React, { useState } from 'react';
import { Variation } from '../types';
import {
  X,
  Download,
  Star,
  ChevronLeft,
  ChevronRight,
  Gem,
  Layers,
  Ruler,
  Scale,
  Split,
} from 'lucide-react';
import { downloadSinglePng } from '../services/export';

interface LightboxModalProps {
  variation: Variation;
  allVariations: Variation[];
  referencePhotoUrl: string;
  sku: string;
  onClose: () => void;
  onSelectVariation: (variation: Variation) => void;
  onToggleStar: (index: number) => void;
}

export const LightboxModal: React.FC<LightboxModalProps> = ({
  variation,
  allVariations,
  referencePhotoUrl,
  sku,
  onClose,
  onSelectVariation,
  onToggleStar,
}) => {
  const [showComparison, setShowComparison] = useState(false);

  const currentIndex = allVariations.findIndex((v) => v.index === variation.index);
  const prevVariation = currentIndex > 0 ? allVariations[currentIndex - 1] : null;
  const nextVariation = currentIndex < allVariations.length - 1 ? allVariations[currentIndex + 1] : null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowLeft' && prevVariation) onSelectVariation(prevVariation);
    if (e.key === 'ArrowRight' && nextVariation) onSelectVariation(nextVariation);
  };

  return (
    <div
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/90 backdrop-blur-md animate-fadeIn"
    >
      {/* Background backdrop click */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative z-10 w-full max-w-5xl rounded-2xl glass-panel border border-gold-500/30 bg-[#0B0C10] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Top Header */}
        <div className="p-4 sm:px-6 flex items-center justify-between border-b border-zinc-800">
          <div className="flex items-center space-x-3">
            <span className="w-7 h-7 rounded-lg bg-gold-500/20 border border-gold-500/40 text-gold-300 font-mono text-xs font-bold flex items-center justify-center">
              {String(variation.index).padStart(2, '0')}
            </span>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white font-luxury">
                {variation.name}
              </h3>
              <p className="text-xs text-zinc-400">
                {variation.stoneCount} Stones • {variation.setting} setting
              </p>
            </div>
          </div>

          {/* Action buttons in header */}
          <div className="flex items-center space-x-2">
            {/* Compare with original toggle */}
            <button
              onClick={() => setShowComparison(!showComparison)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                showComparison
                  ? 'bg-gold-500/20 border-gold-500/50 text-gold-300'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              <Split className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Compare Reference</span>
            </button>

            {/* Star toggle */}
            <button
              onClick={() => onToggleStar(variation.index)}
              className={`p-1.5 rounded-lg border transition-all ${
                variation.isStarred
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-amber-400'
              }`}
            >
              <Star className={`w-4 h-4 ${variation.isStarred ? 'fill-amber-400 text-amber-400' : ''}`} />
            </button>

            {/* Download PNG */}
            {variation.imageBase64 && (
              <button
                onClick={() => downloadSinglePng(variation, sku)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold gold-gradient-bg text-black hover:opacity-95"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Download</span>
              </button>
            )}

            {/* Close button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body: Image & Specs */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Image preview area (2 cols) */}
          <div className="lg:col-span-2 flex flex-col items-center justify-center relative bg-zinc-950/80 rounded-xl border border-zinc-800/80 p-2 min-h-[360px]">
            {showComparison ? (
              <div className="grid grid-cols-2 gap-3 w-full h-full max-h-[500px]">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 mb-1">
                    Original Reference
                  </span>
                  <div className="w-full h-full rounded-lg overflow-hidden border border-zinc-800 bg-black flex items-center justify-center">
                    <img
                      src={referencePhotoUrl}
                      alt="Original"
                      className="max-h-[440px] w-full object-contain"
                    />
                  </div>
                </div>

                <div className="flex flex-col items-center">
                  <span className="text-[10px] uppercase font-bold text-gold-400 mb-1">
                    Variation Concept
                  </span>
                  <div className="w-full h-full rounded-lg overflow-hidden border border-gold-500/30 bg-black flex items-center justify-center">
                    {variation.imageBase64 ? (
                      <img
                        src={`data:image/png;base64,${variation.imageBase64}`}
                        alt={variation.name}
                        className="max-h-[440px] w-full object-contain"
                      />
                    ) : (
                      <span className="text-xs text-zinc-500">Image pending</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center max-h-[500px]">
                {variation.imageBase64 ? (
                  <img
                    src={`data:image/png;base64,${variation.imageBase64}`}
                    alt={variation.name}
                    className="max-h-[500px] w-full object-contain rounded-lg shadow-2xl"
                  />
                ) : (
                  <div className="p-8 text-center text-zinc-500">
                    <Gem className="w-12 h-12 mx-auto mb-2 opacity-30 animate-pulse" />
                    <span>Sketch not generated yet</span>
                  </div>
                )}
              </div>
            )}

            {/* Navigation arrows */}
            {prevVariation && (
              <button
                onClick={() => onSelectVariation(prevVariation)}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/70 hover:bg-black border border-white/20 text-white transition-all shadow-lg"
                title="Previous variation"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}

            {nextVariation && (
              <button
                onClick={() => onSelectVariation(nextVariation)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/70 hover:bg-black border border-white/20 text-white transition-all shadow-lg"
                title="Next variation"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Right: Specifications & CAD Notes */}
          <div className="space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div>
                <h4 className="text-xs uppercase tracking-wider font-semibold text-zinc-400 mb-1">
                  Design Narrative
                </h4>
                <p className="text-sm text-zinc-200 leading-relaxed mb-3">
                  {variation.description}
                </p>

                {variation.motifTreatment && (
                  <div className="p-2.5 rounded-lg bg-purple-950/25 border border-purple-500/30 text-xs mb-3">
                    <span className="text-purple-400 font-bold uppercase text-[9px] tracking-wider block mb-0.5">
                      Motif Treatment:
                    </span>
                    <p className="text-purple-100 font-medium">{variation.motifTreatment}</p>
                  </div>
                )}
              </div>

              {/* Stone placement */}
              <div className="p-3.5 rounded-xl bg-gold-500/10 border border-gold-500/25">
                <div className="flex items-center space-x-1.5 text-gold-400 font-bold text-xs mb-1">
                  <Gem className="w-3.5 h-3.5" />
                  <span>Diamond Distribution</span>
                </div>
                <p className="text-xs text-gold-200 font-medium">
                  {variation.stoneCount} round brilliant stones • {variation.stoneLayout}
                </p>
              </div>

              {/* Specifications table */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  <span className="text-zinc-400 flex items-center space-x-1.5">
                    <Layers className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Setting Style</span>
                  </span>
                  <span className="font-semibold text-white capitalize">{variation.setting}</span>
                </div>

                <div className="flex justify-between items-center p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  <span className="text-zinc-400 flex items-center space-x-1.5">
                    <Ruler className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Estimated Size</span>
                  </span>
                  <span className="font-semibold text-white">{variation.sizeMm} mm</span>
                </div>

                <div className="flex justify-between items-center p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  <span className="text-zinc-400 flex items-center space-x-1.5">
                    <Scale className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Gold Weight Estimate</span>
                  </span>
                  <span className="font-semibold text-gold-300 capitalize">{variation.goldVsOriginal}</span>
                </div>
              </div>

              {/* CAD notes */}
              <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800 text-[11px] text-zinc-400 leading-normal">
                <span className="font-semibold text-zinc-300 block mb-0.5">Fabrication Advice:</span>
                Lightweight construction requires wire profile ~1.0–1.2 mm. Check prongs and pavilion clearances in CAD before wax printing.
              </div>
            </div>

            {/* Bottom thumbnail strip of all variations */}
            <div className="pt-3 border-t border-zinc-800">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold block mb-2">
                All Variations ({allVariations.length})
              </span>
              <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-thin">
                {allVariations.map((v) => (
                  <button
                    key={v.index}
                    onClick={() => onSelectVariation(v)}
                    className={`w-12 h-12 flex-shrink-0 rounded-md overflow-hidden border relative ${
                      v.index === variation.index
                        ? 'border-gold-400 ring-2 ring-gold-500/30'
                        : 'border-zinc-800 hover:border-zinc-600 opacity-60 hover:opacity-100'
                    }`}
                  >
                    {v.imageBase64 ? (
                      <img
                        src={`data:image/png;base64,${v.imageBase64}`}
                        alt={v.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-[10px] text-zinc-600 font-mono">
                        {v.index}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
