import React, { useState, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  Upload,
  X,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  Cloud,
} from 'lucide-react';
import { CostEstimator } from './CostEstimator';

export interface AnalysisRequestPayload {
  photoBase64: string;
  mimeType: string;
  diamondCount: number;
  countFor: 'piece' | 'pair';
  sku: string;
  stoneSize: string;
  metal: string;
  mustKeep: string;
  quality: 'low' | 'medium' | 'high';
  clusterRhodiumFill: boolean;
  headShapeVariance: boolean;
  masterMm?: string;
}

interface UploadPanelProps {
  onStartAnalysis: (payload: AnalysisRequestPayload, previewUrl: string) => Promise<void>;
  isLoading: boolean;
  currentUser?: User | null;
  onSignInGoogle?: () => void;
}

export const UploadPanel: React.FC<UploadPanelProps> = ({
  onStartAnalysis,
  isLoading,
  currentUser,
  onSignInGoogle,
}) => {
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [diamondCount, setDiamondCount] = useState<number | ''>(10);
  const [countFor, setCountFor] = useState<'piece' | 'pair'>('piece');
  const [sku, setSku] = useState<string>('SWA-28035');
  const [stoneSize, setStoneSize] = useState<string>('1.1 mm');
  const [metal, setMetal] = useState<string>('same');
  const [mustKeep, setMustKeep] = useState<string>('Bypass wire band, lightweight airy structure');
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('medium');
  const [clusterRhodiumFill, setClusterRhodiumFill] = useState<boolean>(false);
  const [headShapeVariance, setHeadShapeVariance] = useState<boolean>(false);
  const [masterMm, setMasterMm] = useState<string>('');

  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File validation
  const validateAndSetFile = (file: File) => {
    setErrorMessage('');
    const validMimes = ['image/jpeg', 'image/png', 'image/webp'];

    if (!validMimes.includes(file.type)) {
      setErrorMessage('Invalid file type. Please upload a JPG, PNG, or WebP photo.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('File exceeds 10 MB limit. Please upload a smaller photo.');
      return;
    }

    setPhoto(file);
    const url = URL.createObjectURL(file);
    setPhotoPreview(url);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleRemovePhoto = () => {
    setPhoto(null);
    setPhotoPreview('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Validation rules
  const countNumber = typeof diamondCount === 'number' ? diamondCount : parseInt(diamondCount as string, 10);
  const isCountValid = !isNaN(countNumber) && countNumber >= 1 && countNumber <= 200;
  const isFormValid = Boolean(photo) && isCountValid && !isLoading;

  const compressImageIfNeeded = async (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const maxDim = 1024;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(file);

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) return resolve(file);
            const optimizedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(optimizedFile);
          },
          'image/jpeg',
          0.82
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      };
      img.src = objectUrl;
    });
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photo) {
      setErrorMessage('Please select or drop a product jewellery photo.');
      return;
    }

    if (!isCountValid) {
      setErrorMessage('Diamond count must be between 1 and 200.');
      return;
    }

    setErrorMessage('');

    const optimizedPhoto = await compressImageIfNeeded(photo);
    const photoBase64 = await fileToBase64(optimizedPhoto);

    await onStartAnalysis(
      {
        photoBase64,
        mimeType: optimizedPhoto.type || 'image/jpeg',
        diamondCount: countNumber,
        countFor,
        sku: sku.trim(),
        stoneSize: stoneSize.trim(),
        metal,
        mustKeep: mustKeep.trim(),
        quality,
        clusterRhodiumFill,
        headShapeVariance,
        masterMm: masterMm.trim(),
      },
      photoPreview
    );
  };

  // Load a demo sample photo
  const handleLoadSample = async () => {
    try {
      // Create a high-quality SVG diamond ring on canvas
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 800;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Dark luxury background
      ctx.fillStyle = '#0f1118';
      ctx.fillRect(0, 0, 800, 800);

      // Subtle radial light
      const grad = ctx.createRadialGradient(400, 400, 50, 400, 400, 380);
      grad.addColorStop(0, 'rgba(212, 175, 55, 0.15)');
      grad.addColorStop(1, 'rgba(15, 17, 24, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 800, 800);

      // Gold bypass ring shank
      ctx.lineWidth = 14;
      ctx.strokeStyle = '#D4AF37';
      ctx.beginPath();
      ctx.arc(400, 430, 160, 0.2 * Math.PI, 1.8 * Math.PI, false);
      ctx.stroke();

      // Bypass curve loop
      ctx.beginPath();
      ctx.bezierCurveTo(340, 280, 440, 240, 470, 340);
      ctx.stroke();

      // Draw 10 sparkling diamonds
      const diamondPositions = [
        { x: 350, y: 310 }, { x: 375, y: 295 }, { x: 405, y: 285 }, { x: 435, y: 290 }, { x: 460, y: 305 },
        { x: 475, y: 335 }, { x: 470, y: 365 }, { x: 445, y: 385 }, { x: 415, y: 395 }, { x: 385, y: 385 }
      ];

      diamondPositions.forEach((pos) => {
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = '#00F0FF';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 8.5, 0, 2 * Math.PI);
        ctx.fill();

        ctx.strokeStyle = '#99E6FF';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], 'swa_bypass_10diamonds_ref.png', { type: 'image/png' });
          validateAndSetFile(file);
          setDiamondCount(10);
          setCountFor('piece');
          setSku('SWA-28035');
          setStoneSize('1.1 mm');
          setMetal('two-tone');
          setMustKeep('Bypass curve loop, 10 pavé round brilliant diamonds');
        }
      }, 'image/png');
    } catch (err) {
      console.error('Failed to create sample', err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 sm:px-6">
      {/* Header section */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-gold-500/10 border border-gold-500/25 text-gold-400 text-xs font-semibold uppercase tracking-wider mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI CAD & Concept Generator</span>
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white font-luxury tracking-tight mb-3">
          Jewellery Variation Studio
        </h1>
        <p className="text-sm sm:text-base text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          Upload a master jewellery piece, specify the stone count, and receive 10 new, production-viable concepts with full CAD specifications and high-resolution pencil sketches.
        </p>
      </div>

      {/* Supabase & Google Auth Status Banner */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs">
        <div className="flex items-center space-x-2 text-zinc-300">
          <Cloud className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          {currentUser ? (
            <span>
              Connected to Supabase as{' '}
              <strong className="text-white font-semibold">{currentUser.email}</strong>. Runs and designs auto-sync to cloud history.
            </span>
          ) : (
            <span className="text-zinc-400">
              Designs save locally and to Supabase server. Sign in with Google to tie designs to your personal account.
            </span>
          )}
        </div>
        {!currentUser && onSignInGoogle && (
          <button
            type="button"
            onClick={onSignInGoogle}
            className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white font-medium transition-all text-xs"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.41 7.34 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.24C.45 8.15 0 9.99 0 12s.45 3.85 1.24 5.42l4.04-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.59 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>Sign In</span>
          </button>
        )}
      </div>

      {/* Main form card */}
      <form onSubmit={handleSubmit} className="glass-panel rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl relative">
        {/* Error message */}
        {errorMessage && (
          <div className="flex items-center space-x-3 p-4 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Top bar with Sample Demo button */}
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
          <span className="text-xs uppercase tracking-wider font-semibold text-zinc-400">
            Step 1: Reference Photo & Specifications
          </span>
          <button
            type="button"
            onClick={handleLoadSample}
            className="flex items-center space-x-1.5 text-xs text-gold-400 hover:text-gold-300 font-medium px-2.5 py-1 rounded-md bg-gold-500/10 hover:bg-gold-500/20 border border-gold-500/30 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Try Sample Demo Ring</span>
          </button>
        </div>

        {/* Dropzone */}
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-2">
            Reference Product Photo <span className="text-gold-400">*</span>
            <span className="text-zinc-500 font-normal ml-2">(JPG, PNG, WebP up to 10 MB)</span>
          </label>

          {!photoPreview ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ${
                isDragOver
                  ? 'border-gold-400 bg-gold-500/10 scale-[1.01]'
                  : 'border-zinc-700/80 hover:border-gold-500/50 bg-zinc-900/40 hover:bg-zinc-900/70'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-14 h-14 rounded-full bg-gold-500/10 border border-gold-500/25 flex items-center justify-center mx-auto mb-3 text-gold-400">
                <Upload className="w-6 h-6 animate-pulse-slow" />
              </div>
              <p className="text-sm font-medium text-white mb-1">
                Drag and drop your jewellery photo here, or <span className="text-gold-400 underline">browse</span>
              </p>
              <p className="text-xs text-zinc-500">
                Supports clear studio shots, CAD renders, or clean white background photos
              </p>
            </div>
          ) : (
            <div className="relative rounded-xl overflow-hidden border border-gold-500/30 bg-zinc-950 p-3 flex items-center space-x-4">
              <img
                src={photoPreview}
                alt="Reference Preview"
                className="w-24 h-24 sm:w-28 sm:h-28 object-contain rounded-lg bg-zinc-900 border border-zinc-800"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <p className="text-sm font-semibold text-white truncate">
                    {photo?.name || 'reference_photo.png'}
                  </p>
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  Size: {photo ? (photo.size / (1024 * 1024)).toFixed(2) : '1.0'} MB • Status: Ready for analysis
                </p>
                <div className="mt-2 flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-gold-400 hover:text-gold-300 underline font-medium"
                  >
                    Change photo
                  </button>
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="text-xs text-red-400 hover:text-red-300 font-medium"
                  >
                    Remove
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-zinc-900/80 text-zinc-400 hover:text-white hover:bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Diamond Count and Count For */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Diamond Count */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Diamond Count <span className="text-gold-400">*</span>
              <span className="text-zinc-500 font-normal ml-1">(Required, 1–200)</span>
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                max="200"
                value={diamondCount}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                  setDiamondCount(val);
                }}
                className={`w-full px-4 py-2.5 rounded-xl bg-zinc-900/90 border text-white font-mono text-sm focus:outline-none focus:ring-2 transition-all ${
                  isCountValid
                    ? 'border-zinc-700 focus:border-gold-500 focus:ring-gold-500/20'
                    : 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                }`}
                placeholder="e.g. 10"
                required
              />
              <span className="absolute right-3.5 top-2.5 text-xs text-zinc-500 pointer-events-none">
                Stones
              </span>
            </div>
            {!isCountValid && (
              <p className="text-xs text-red-400 mt-1">Please enter a count between 1 and 200.</p>
            )}
            <p className="text-[11px] text-zinc-500 mt-1">
              Every variation prompt will enforce this exact stone count.
            </p>
          </div>

          {/* Count is for */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Count Is For <span className="text-gold-400">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCountFor('piece')}
                className={`px-4 py-2.5 rounded-xl text-xs font-medium border transition-all ${
                  countFor === 'piece'
                    ? 'bg-gold-500/20 border-gold-500/50 text-gold-300 font-semibold'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                One Piece (Ring / Pendant)
              </button>
              <button
                type="button"
                onClick={() => setCountFor('pair')}
                className={`px-4 py-2.5 rounded-xl text-xs font-medium border transition-all ${
                  countFor === 'pair'
                    ? 'bg-gold-500/20 border-gold-500/50 text-gold-300 font-semibold'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                The Pair (Earrings)
              </button>
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              {countFor === 'pair' && isCountValid
                ? `Earrings mode: Each earring sketch will have exactly ${Math.max(1, Math.round(countNumber / 2))} stones.`
                : 'Standard mode: The design will feature exactly this number of stones.'}
            </p>
          </div>
        </div>

        {/* Secondary parameters: SKU, Stone size, Metal, Master MM */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {/* Master MM */}
          <div>
            <label className="block text-xs font-semibold text-zinc-200 mb-1 flex items-center justify-between">
              <span>Master MM</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-gold-500/15 text-gold-300 font-mono">In Picture</span>
            </label>
            <input
              type="text"
              value={masterMm}
              onChange={(e) => setMasterMm(e.target.value)}
              placeholder="e.g. 4.9 x 2.6 mm"
              className="w-full px-3.5 py-2 rounded-xl bg-zinc-900/80 border border-zinc-700/80 text-white text-xs focus:outline-none focus:border-gold-500 font-mono"
            />
            <p className="text-[10px] text-zinc-500 mt-1">Shows inside the picture as text</p>
          </div>

          {/* SKU */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              SKU or Style Name
            </label>
            <input
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="e.g. 28035"
              className="w-full px-3.5 py-2 rounded-xl bg-zinc-900/80 border border-zinc-700/80 text-white text-xs focus:outline-none focus:border-gold-500"
            />
            <p className="text-[10px] text-zinc-500 mt-1">Used in file names & CSV</p>
          </div>

          {/* Stone Size */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Stone Size (Optional)
            </label>
            <input
              type="text"
              value={stoneSize}
              onChange={(e) => setStoneSize(e.target.value)}
              placeholder="e.g. 1.0 mm or 0.02 ct"
              className="w-full px-3.5 py-2 rounded-xl bg-zinc-900/80 border border-zinc-700/80 text-white text-xs focus:outline-none focus:border-gold-500"
            />
            <p className="text-[10px] text-zinc-500 mt-1">Leave blank for AI estimate</p>
          </div>

          {/* Metal */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Metal Color
            </label>
            <select
              value={metal}
              onChange={(e) => setMetal(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-zinc-900/80 border border-zinc-700/80 text-white text-xs focus:outline-none focus:border-gold-500"
            >
              <option value="same">Same as photo</option>
              <option value="yellow">18K Yellow Gold</option>
              <option value="rose">18K Rose Gold</option>
              <option value="white">18K White Gold</option>
              <option value="two-tone">Two-Tone (Yellow & White)</option>
            </select>
            <p className="text-[10px] text-zinc-500 mt-1">Color palette for sketch</p>
          </div>
        </div>

        {/* Must keep notes */}
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1">
            Must Keep Notes (Design Constraints)
          </label>
          <input
            type="text"
            value={mustKeep}
            onChange={(e) => setMustKeep(e.target.value)}
            placeholder="e.g. bypass band, screw back, lightweight wire, maintain cluster center"
            className="w-full px-3.5 py-2 rounded-xl bg-zinc-900/80 border border-zinc-700/80 text-white text-xs focus:outline-none focus:border-gold-500"
          />
          <p className="text-[10px] text-zinc-500 mt-1">
            Features that must remain consistent across all 10 variations
          </p>
        </div>

        {/* Close Cluster & Rhodium Gap Fill Checkbox Option */}
        <div
          className={`p-4 rounded-xl border transition-all duration-300 ${
            clusterRhodiumFill
              ? 'bg-gold-500/10 border-gold-400/50 shadow-lg shadow-gold-500/5'
              : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
          }`}
        >
          <div className="flex items-start space-x-3.5">
            <div className="pt-0.5">
              <input
                type="checkbox"
                id="clusterRhodiumFill"
                checked={clusterRhodiumFill}
                onChange={(e) => setClusterRhodiumFill(e.target.checked)}
                className="w-5 h-5 rounded border-zinc-700 text-gold-500 focus:ring-gold-400 bg-zinc-900 cursor-pointer accent-gold-500"
              />
            </div>
            <div
              className="flex-1 cursor-pointer select-none"
              onClick={() => setClusterRhodiumFill(!clusterRhodiumFill)}
            >
              <div className="flex items-center space-x-2">
                <label htmlFor="clusterRhodiumFill" className="text-sm font-bold text-white cursor-pointer flex items-center space-x-2">
                  <span>Close Cluster & Rhodium Gap Fill</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold uppercase tracking-wider border ${
                    clusterRhodiumFill
                      ? 'bg-gold-500/25 border-gold-400/50 text-gold-200'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                  }`}>
                    {clusterRhodiumFill ? 'Active in Prompt' : 'Optional Setting'}
                  </span>
                </label>
              </div>
              <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                Seat stones closely nearby in a cluster or continuous line. Diamonds are set in high-polish white rhodium to seamlessly fill diamond gaps and appear as one unified diamond surface.
              </p>

              {clusterRhodiumFill && (
                <div className="mt-2.5 p-2.5 rounded-lg bg-zinc-950/80 border border-gold-500/30 text-[11px] text-gold-200 flex items-start space-x-2">
                  <Sparkles className="w-3.5 h-3.5 text-gold-400 mt-0.5 flex-shrink-0" />
                  <span>
                    <strong>Added to AI Prompt:</strong> "The stones need to be seated nearby like a tight cluster or in a line cluster, feeling as one part with diamonds set in white rhodium to seamlessly fill the diamond gap."
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 40%-50% Head Shape Difference Checkbox Option */}
        <div
          className={`p-4 rounded-xl border transition-all duration-300 ${
            headShapeVariance
              ? 'bg-blue-500/10 border-blue-400/50 shadow-lg shadow-blue-500/5'
              : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
          }`}
        >
          <div className="flex items-start space-x-3.5">
            <div className="pt-0.5">
              <input
                type="checkbox"
                id="headShapeVariance"
                checked={headShapeVariance}
                onChange={(e) => setHeadShapeVariance(e.target.checked)}
                className="w-5 h-5 rounded border-zinc-700 text-blue-500 focus:ring-blue-400 bg-zinc-900 cursor-pointer accent-blue-500"
              />
            </div>
            <div
              className="flex-1 cursor-pointer select-none"
              onClick={() => setHeadShapeVariance(!headShapeVariance)}
            >
              <div className="flex items-center space-x-2">
                <label htmlFor="headShapeVariance" className="text-sm font-bold text-white cursor-pointer flex items-center space-x-2">
                  <span>40%–50% Head Shape Difference</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold uppercase tracking-wider border ${
                    headShapeVariance
                      ? 'bg-blue-500/25 border-blue-400/50 text-blue-200'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                  }`}>
                    {headShapeVariance ? 'Active in Prompt' : 'Optional Setting'}
                  </span>
                </label>
              </div>
              <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                Feature a distinct 40% to 50% geometric shape difference in the head silhouette compared to conventional forms (e.g. bold geometric contour, asymmetric petal contour, pointed navette/chevron apex, or sculpted open loop).
              </p>

              {headShapeVariance && (
                <div className="mt-2.5 p-2.5 rounded-lg bg-zinc-950/80 border border-blue-500/30 text-[11px] text-blue-200 flex items-start space-x-2">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <span>
                    <strong>Added to AI Prompt:</strong> "Head / Centerpiece Shape: Feature a distinct 40%-50% geometric shape difference in the head silhouette compared to conventional forms (e.g. bold geometric contour, asymmetric petal contour, pointed navette/chevron apex, or sculpted open loop)."
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quality selection and Cost display */}
        <div className="pt-2 border-t border-zinc-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <span className="text-xs text-zinc-400 font-medium">Render Quality:</span>
            <div className="inline-flex rounded-lg bg-zinc-900 p-0.5 border border-zinc-800">
              {(['low', 'medium', 'high'] as const).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuality(q)}
                  className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-all ${
                    quality === q
                      ? 'bg-gold-500/20 text-gold-300 font-bold border border-gold-500/40'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <CostEstimator quality={quality} />
        </div>

        {/* Submit button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={!isFormValid}
            className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm tracking-wide transition-all duration-300 flex items-center justify-center space-x-2 ${
              isFormValid
                ? 'gold-gradient-bg text-black hover:opacity-95 shadow-lg shadow-gold-500/20 cursor-pointer scale-[1.005]'
                : 'bg-zinc-800/80 text-zinc-500 cursor-not-allowed border border-zinc-700/50'
            }`}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                <span>Analysing Jewellery Structure & Generating 10 Concepts...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate 10 Design Variations</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
