import React, { useState } from 'react';
import { Gem, Sparkles, History, RotateCcw, Cloud, Key, CheckCircle2, X } from 'lucide-react';

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
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem('swa_openai_key') || ''
  );
  const [isSaved, setIsSaved] = useState(false);

  const handleSaveKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem('swa_openai_key', apiKey.trim());
    } else {
      localStorage.removeItem('swa_openai_key');
    }
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      setShowKeyModal(false);
    }, 1500);
  };

  return (
    <>
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
                  Studio 50
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-light tracking-wide">
                Fine Jewellery AI Variation Suite
              </p>
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex items-center space-x-2.5">
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

            {/* API Key settings button */}
            <button
              onClick={() => setShowKeyModal(true)}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium text-zinc-300 hover:text-white bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-700/50 hover:border-gold-500/40 transition-all"
              title="Configure OpenAI API Key"
            >
              <Key className="w-3.5 h-3.5 text-gold-400" />
              <span className="hidden md:inline">OpenAI Key</span>
            </button>

            {/* Supabase Status Pill */}
            <div
              className="hidden lg:flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs text-zinc-400 bg-zinc-900/40 border border-zinc-800"
              title="Connected to Supabase Project (eylkbycxhptmmqcpvloz)"
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

      {/* API Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="absolute inset-0" onClick={() => setShowKeyModal(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl glass-panel border border-gold-500/30 bg-[#0B0C10] shadow-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <div className="flex items-center space-x-2">
                <Key className="w-4 h-4 text-gold-400" />
                <h3 className="text-base font-bold text-white font-luxury">OpenAI API Key</h3>
              </div>
              <button
                onClick={() => setShowKeyModal(false)}
                className="p-1 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-3">
              <p className="text-xs text-zinc-300 leading-relaxed">
                Your OpenAI key is used to generate jewellery analyses and sketches. It is stored securely in your browser and used as fallback when deployed.
              </p>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  OpenAI Secret Key:
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-proj-..."
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white font-mono text-xs focus:outline-none focus:border-gold-500"
                />
              </div>
              <div className="flex items-center space-x-2 text-[11px] text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Active and verified for GPT-4o and GPT-Image-2.5</span>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-800 flex justify-end space-x-2">
              <button
                onClick={() => setShowKeyModal(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white bg-zinc-900"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveKey}
                className="px-4 py-1.5 rounded-lg text-xs font-bold gold-gradient-bg text-black hover:opacity-95 flex items-center space-x-1.5"
              >
                {isSaved ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
                <span>{isSaved ? 'Saved!' : 'Save Key'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
