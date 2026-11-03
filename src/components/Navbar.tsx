import React from 'react';
import { Gem, Sparkles, History, RotateCcw, Cloud } from 'lucide-react';

interface NavbarProps {
  hasActiveJob: boolean;
  onReset: () => void;
  onOpenHistory: () => void;
  historyCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  hasActiveJob,
  onReset,
  onOpenHistory,
  historyCount,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-gold-500/20 bg-[#0B0C10]/85 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand identity */}
        <div className="flex items-center space-x-3.5">
          <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-gold-400/20 via-gold-500/10 to-transparent border border-gold-400/30 text-gold-400 shadow-lg shadow-gold-500/10">
            <Gem className="w-6 h-6 animate-pulse-slow" />
            <Sparkles className="w-3.5 h-3.5 absolute -top-1 -right-1 text-gold-300" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl font-bold tracking-wider font-luxury text-white">
                SWA DIAMONDS
              </span>
              <span className="text-[10px] tracking-widest uppercase px-2 py-0.5 rounded-full bg-gold-500/15 border border-gold-500/30 text-gold-300 font-semibold">
                Studio
              </span>
            </div>
            <p className="text-xs text-zinc-400 font-light tracking-wide">
              Fine Jewellery AI Variation Suite
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-3">
          {/* History button */}
          <button
            onClick={onOpenHistory}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-medium text-zinc-300 hover:text-gold-200 bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-700/50 hover:border-gold-500/40 transition-all duration-200"
            title="View Past Studio Runs"
          >
            <History className="w-4 h-4 text-gold-400" />
            <span className="hidden sm:inline">History</span>
            {historyCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-gold-500/20 text-gold-300 font-bold">
                {historyCount}
              </span>
            )}
          </button>

          {/* Supabase Status Pill */}
          <div
            className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs text-zinc-400 bg-zinc-900/40 border border-zinc-800"
            title="Connected to Supabase Project"
          >
            <Cloud className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px]">Supabase Cloud</span>
          </div>

          {/* New Run Reset button */}
          {hasActiveJob && (
            <button
              onClick={onReset}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-medium text-zinc-200 hover:text-white bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 transition-all duration-200"
            >
              <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
              <span>New Upload</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
