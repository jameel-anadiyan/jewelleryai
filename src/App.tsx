import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { StudioJob, Variation } from './types';
import { Navbar } from './components/Navbar';
import { UploadPanel, AnalysisRequestPayload } from './components/UploadPanel';
import { ReferenceSummaryCard } from './components/ReferenceSummaryCard';
import { GridToolbar } from './components/GridToolbar';
import { VariationCard } from './components/VariationCard';
import { LightboxModal } from './components/LightboxModal';
import { HistoryModal } from './components/HistoryModal';
import { ToastData, ToastNotification } from './components/ToastNotification';
import {
  loadActiveJob,
  saveActiveJob,
  clearActiveJob,
  getHistory,
  deleteHistoryItem,
} from './services/storage';
import { downloadZip } from './services/export';
import { syncRunToSupabase, saveDesignToSupabase } from './services/supabase';

const MAX_PARALLEL = 4;

export const App: React.FC = () => {
  const [job, setJob] = useState<StudioJob | null>(null);
  const [history, setHistory] = useState<StudioJob[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [filterStarredOnly, setFilterStarredOnly] = useState<boolean>(false);
  const [activeLightboxVariation, setActiveLightboxVariation] = useState<Variation | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastData[]>([]);

  // Track generating card indexes to manage UI spinners
  const [generatingIndexes, setGeneratingIndexes] = useState<Set<number>>(new Set());

  // Ref to always access current job in async queue
  const jobRef = useRef<StudioJob | null>(null);
  jobRef.current = job;

  // Add toast helper
  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // 1. Initial Load: Restore from IndexedDB
  useEffect(() => {
    async function initStorage() {
      try {
        const cached = await loadActiveJob();
        if (cached) {
          setJob(cached);
          addToast('info', 'Restored previous studio session from local storage.');
        }
        const hist = await getHistory();
        setHistory(hist);
      } catch (err) {
        console.error('Initialization error:', err);
      }
    }
    initStorage();
  }, []);

  // Update storage whenever job changes
  const updateJobState = (updater: (prev: StudioJob) => StudioJob) => {
    setJob((prev) => {
      if (!prev) return null;
      const next = updater(prev);
      saveActiveJob(next);
      return next;
    });
  };

  // Auth headers helper with user's OpenAI key if saved in browser
  const getAuthHeaders = (): Record<string, string> => {
    const key = localStorage.getItem('swa_openai_key') || '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (key) {
      headers['x-openai-key'] = key.trim();
    }
    return headers;
  };

  // 2. Generate a single card's image
  const generateSingleCard = async (
    jobId: string,
    index: number,
    quality?: 'low' | 'medium' | 'high'
  ): Promise<boolean> => {
    setGeneratingIndexes((prev) => new Set(prev).add(index));

    updateJobState((current) => ({
      ...current,
      variations: current.variations.map((v) =>
        v.index === index ? { ...v, status: 'generating', errorMessage: undefined } : v
      ),
    }));

    const currentVar = job?.variations.find((v) => v.index === index);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          jobId,
          index,
          quality,
          variation: currentVar,
          diamondCount: job?.diamondCount,
          motif: job?.original?.motif,
          clusterRhodiumFill: job?.clusterRhodiumFill,
          headShapeVariance: job?.headShapeVariance,
          photoBase64: job?.photoBase64 || job?.photoUrl,
        }),
      });

      let data: any = null;
      const responseText = await response.text();
      try {
        data = JSON.parse(responseText);
      } catch {
        // Response is not JSON (e.g. Vercel 500/504 plain text error)
      }

      if (!response.ok) {
        const errorMsg = data?.error?.message || responseText || `Server returned status ${response.status}`;
        throw new Error(errorMsg);
      }

      const updatedVar: Variation = {
        ...currentVar!,
        status: 'done' as const,
        imageBase64: data.imageBase64,
        errorMessage: undefined,
      };

      // Save design directly to Supabase server history
      saveDesignToSupabase(jobId, updatedVar).catch((e) =>
        console.warn('Supabase design save note:', e)
      );

      updateJobState((current) => {
        const updatedVariations = current.variations.map((v) =>
          v.index === index ? updatedVar : v
        );
        const updatedJob = { ...current, variations: updatedVariations };

        // Check if all are done to trigger celebratory confetti
        const allDone = updatedVariations.every((v) => v.status === 'done');
        if (allDone) {
          confetti({
            particleCount: 100,
            spread: 80,
            origin: { y: 0.6 },
            colors: ['#D4AF37', '#FFF1D0', '#AA8542', '#38bdf8'],
          });
          addToast('success', `✨ All ${updatedVariations.length} jewellery sketches rendered successfully!`);
          syncRunToSupabase(updatedJob).catch((e) => console.log('Supabase sync note:', e));
        }

        return updatedJob;
      });

      return true;
    } catch (err: any) {
      console.error(`Failed to generate card ${index}:`, err);
      updateJobState((current) => ({
        ...current,
        variations: current.variations.map((v) =>
          v.index === index
            ? { ...v, status: 'failed' as const, errorMessage: err.message || 'Generation failed' }
            : v
        ),
      }));
      return false;
    } finally {
      setGeneratingIndexes((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }
  };

  // 3. Concurrency Queue (Runs cards concurrently)
  const runParallelGenerations = async (jobId: string, indexes: number[], quality: 'low' | 'medium' | 'high') => {
    const queue = [...indexes];
    const workers = Array.from({ length: Math.min(MAX_PARALLEL, queue.length) }, async () => {
      while (queue.length > 0) {
        const targetIndex = queue.shift();
        if (targetIndex !== undefined) {
          await generateSingleCard(jobId, targetIndex, quality);
        }
      }
    });
    await Promise.all(workers);
  };

  // 4. Analysis trigger from UploadPanel
  const handleStartAnalysis = async (payload: AnalysisRequestPayload, previewUrl: string) => {
    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      let data: any = null;
      const responseText = await response.text();
      try {
        data = JSON.parse(responseText);
      } catch {
        // Response is not JSON
      }

      if (!response.ok) {
        const errorMsg = data?.error?.message || responseText || 'Failed to analyze jewellery reference.';
        throw new Error(errorMsg);
      }

      const quality = payload.quality || 'medium';

      const initialVariations: Variation[] = (data.variations || []).map((v: any) => ({
        ...v,
        status: 'waiting' as const,
        isStarred: false,
      }));

      const newJob: StudioJob = {
        jobId: data.jobId,
        photoUrl: previewUrl,
        photoBase64: payload.photoBase64,
        sku: data.sku || 'SWA',
        diamondCount: data.diamondCount,
        countFor: data.countFor,
        stoneSize: payload.stoneSize || '',
        metal: payload.metal || 'same',
        mustKeep: payload.mustKeep || '',
        quality,
        clusterRhodiumFill: Boolean(data.clusterRhodiumFill),
        headShapeVariance: Boolean(data.headShapeVariance),
        original: data.original,
        variations: initialVariations,
        createdAt: Date.now(),
      };

      setJob(newJob);
      await saveActiveJob(newJob);

      // Save initial run directly to Supabase server
      syncRunToSupabase(newJob).catch((e) => console.log('Supabase sync note:', e));

      // Refresh history list
      const hist = await getHistory();
      setHistory(hist);

      addToast('success', `Analysis complete! ${initialVariations.length} concepts generated. Rendering sketches...`);

      // Kick off parallel image generation for all 50 cards
      const indexesToGenerate = initialVariations.map((v) => v.index);
      runParallelGenerations(newJob.jobId, indexesToGenerate, quality);
    } catch (err: any) {
      console.error('Analysis error:', err);
      addToast('error', err.message || 'An unexpected error occurred during analysis.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 5. Card actions
  const handleRegenerateCard = (index: number) => {
    if (!job) return;
    addToast('info', `Regenerating sketch for variation #${index}...`);
    generateSingleCard(job.jobId, index, job.quality);
  };

  const handleToggleStar = (index: number) => {
    updateJobState((current) => {
      const updated = current.variations.map((v) =>
        v.index === index ? { ...v, isStarred: !v.isStarred } : v
      );
      return { ...current, variations: updated };
    });
  };

  // 6. Downloads
  const handleDownloadAllZip = async () => {
    if (!job) return;
    addToast('info', 'Preparing complete collection ZIP with CSV and JSON...');
    const count = await downloadZip(job, false);
    addToast('success', `Exported ${count} jewellery design files to ZIP.`);
  };

  const handleDownloadStarredZip = async () => {
    if (!job) return;
    const count = await downloadZip(job, true);
    if (count === 0) {
      addToast('info', 'No starred designs to download. Star some cards first!');
    } else {
      addToast('success', `Exported ${count} starred designs to ZIP.`);
    }
  };

  // 7. Reset / New Upload
  const handleReset = async () => {
    if (window.confirm('Start a new upload? The current run will remain saved in your History.')) {
      await clearActiveJob();
      setJob(null);
      setGeneratingIndexes(new Set());
      setFilterStarredOnly(false);
      const hist = await getHistory();
      setHistory(hist);
    }
  };

  // 8. History select & delete
  const handleSelectHistoryJob = (selected: StudioJob) => {
    setJob(selected);
    saveActiveJob(selected);
    setShowHistoryModal(false);
    addToast('info', `Restored run for SKU: ${selected.sku || 'SWA'}`);
  };

  const handleDeleteHistoryJob = async (jobId: string) => {
    await deleteHistoryItem(jobId);
    const updated = await getHistory();
    setHistory(updated);
    if (job?.jobId === jobId) {
      await clearActiveJob();
      setJob(null);
    }
    addToast('info', 'Job deleted from history.');
  };

  // Filtered cards
  const displayedVariations = job
    ? filterStarredOnly
      ? job.variations.filter((v) => v.isStarred)
      : job.variations
    : [];

  const completedCount = job ? job.variations.filter((v) => v.status === 'done').length : 0;
  const starredCount = job ? job.variations.filter((v) => v.isStarred).length : 0;
  const isGeneratingImages = generatingIndexes.size > 0;

  return (
    <div className="min-h-screen bg-[#0B0C10] text-[#E0E2EC] flex flex-col font-sans selection:bg-gold-500/30 selection:text-gold-200">
      {/* Navbar */}
      <Navbar
        hasActiveJob={Boolean(job)}
        onReset={handleReset}
        onOpenHistory={() => setShowHistoryModal(true)}
        historyCount={history.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {!job ? (
          /* Step 1: Upload Panel */
          <UploadPanel onStartAnalysis={handleStartAnalysis} isLoading={isAnalyzing} />
        ) : (
          /* Step 2: Results Studio View */
          <div>
            {/* Reference info summary card */}
            <ReferenceSummaryCard
              job={job}
              onViewPhoto={() => {
                // Open reference image in lightbox preview
                setActiveLightboxVariation({
                  index: 0,
                  name: 'Master Reference Jewellery',
                  description: job.original.summary,
                  stoneCount: job.diamondCount,
                  stoneLayout: job.original.stoneLayout,
                  setting: 'Original Setting',
                  sizeMm: 'Original',
                  goldVsOriginal: 'Original',
                  imagePrompt: '',
                  status: 'done',
                  imageBase64: job.photoUrl.replace(/^data:image\/\w+;base64,/, ''),
                });
              }}
            />

            {/* Toolbar with Progress & Exports */}
            <GridToolbar
              completedCount={completedCount}
              totalCount={job.variations.length}
              starredCount={starredCount}
              isGenerating={isGeneratingImages}
              filterStarredOnly={filterStarredOnly}
              onToggleFilter={() => setFilterStarredOnly(!filterStarredOnly)}
              onDownloadAllZip={handleDownloadAllZip}
              onDownloadStarredZip={handleDownloadStarredZip}
              onNewUpload={handleReset}
            />

            {/* Variation Grid (Mobile: 1 column, Tablet: 2 cols, Desktop: 3 cols, Wide: 4 cols) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {displayedVariations.map((v) => (
                <VariationCard
                  key={v.index}
                  variation={v}
                  sku={job.sku}
                  onRegenerate={handleRegenerateCard}
                  onToggleStar={handleToggleStar}
                  onOpenLightbox={(item) => setActiveLightboxVariation(item)}
                />
              ))}
            </div>

            {/* Filter empty message */}
            {displayedVariations.length === 0 && filterStarredOnly && (
              <div className="py-16 text-center text-zinc-500 glass-panel rounded-2xl p-8 border border-zinc-800">
                <p className="text-sm font-medium">No starred designs found.</p>
                <p className="text-xs text-zinc-600 mt-1">
                  Click the ★ icon on any card to mark it as best, or turn off the Starred filter.
                </p>
                <button
                  onClick={() => setFilterStarredOnly(false)}
                  className="mt-4 px-4 py-2 rounded-lg text-xs font-semibold bg-zinc-800 text-zinc-300 hover:text-white"
                >
                  Show All Designs
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Lightbox Modal */}
      {activeLightboxVariation && job && (
        <LightboxModal
          variation={activeLightboxVariation}
          allVariations={job.variations}
          referencePhotoUrl={job.photoUrl}
          sku={job.sku}
          onClose={() => setActiveLightboxVariation(null)}
          onSelectVariation={(selected) => setActiveLightboxVariation(selected)}
          onToggleStar={handleToggleStar}
        />
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <HistoryModal
          history={history}
          onClose={() => setShowHistoryModal(false)}
          onSelectJob={handleSelectHistoryJob}
          onDeleteJob={handleDeleteHistoryJob}
        />
      )}

      {/* Toast Notifications */}
      <ToastNotification toasts={toasts} onDismiss={handleDismissToast} />
    </div>
  );
};

export default App;
