import type { Variation } from '../types';

export interface CalculatedDimensions {
  masterText: string;
  actualText: string;
  masterHeight?: number;
  masterWidth?: number;
  actualHeight?: number;
  actualWidth?: number;
}

/**
 * Extracts numeric height and width from a string or number.
 * Supports "4.9 x 2.6", "4.9 * 2.6", "4.9 , 2.6", "H: 4.9 W: 2.6", or single numbers.
 */
export function parseDimensions(
  val?: string | number,
  fallbackHeight?: string | number,
  fallbackWidth?: string | number
): { height?: number; width?: number } {
  let h: number | undefined;
  let w: number | undefined;

  if (fallbackHeight !== undefined && fallbackHeight !== '') {
    const parsed = parseFloat(String(fallbackHeight));
    if (!isNaN(parsed) && parsed > 0) h = parsed;
  }

  if (fallbackWidth !== undefined && fallbackWidth !== '') {
    const parsed = parseFloat(String(fallbackWidth));
    if (!isNaN(parsed) && parsed > 0) w = parsed;
  }

  if ((h === undefined || w === undefined) && val !== undefined && val !== '') {
    const str = String(val).trim();
    const match = str.match(/([\d.]+)\s*(?:[x×*,|]|by)\s*([\d.]+)/i);
    if (match) {
      if (h === undefined) {
        const ph = parseFloat(match[1]);
        if (!isNaN(ph)) h = ph;
      }
      if (w === undefined) {
        const pw = parseFloat(match[2]);
        if (!isNaN(pw)) w = pw;
      }
    } else {
      const single = str.match(/([\d.]+)/);
      if (single && h === undefined) {
        const ph = parseFloat(single[1]);
        if (!isNaN(ph)) h = ph;
      }
    }
  }

  return { height: h, width: w };
}

/**
 * Calculates the actual design head dimensions for a generated variation.
 *
 * Rules:
 * 1. Master MM is the reference dimension given by the user (e.g. 4.9 x 2.6 mm).
 * 2. Actual Size is NOT given as user input; it is calculated according to the generated design:
 *    - Wireframe / Halo add-on: expands head by ~+5% to +14%
 *    - Bypass wire curves / split shoulders: lengthens by ~+4% to +10%
 *    - Stepped tiers / filigree under-gallery: expands by ~+6% to +12%
 *    - Tight cluster / seamless rhodium fill: minimal deviation (-2% to +2%)
 *    - Rhombus / navette elongation: taller (+8% to +12%), slightly narrower (-2% to -4%)
 *    - East-west / wide horizontal cluster: wider (+8% to +14%), slightly shorter (-2% to -4%)
 * 3. Deviation is constrained within realistic fine jewellery tolerances (<= 18%).
 */
export function calculateActualHeadDimension(
  jobOrMaster: {
    masterMm?: string;
    masterHeight?: number | string;
    masterWidth?: number | string;
    headHeight?: number | string;
    headWidth?: number | string;
  },
  variation?: Partial<Variation>
): CalculatedDimensions {
  const masterH = jobOrMaster.masterHeight ?? jobOrMaster.headHeight;
  const masterW = jobOrMaster.masterWidth ?? jobOrMaster.headWidth;
  const { height: mH, width: mW } = parseDimensions(jobOrMaster.masterMm, masterH, masterW);

  // If no master dimensions are given, fallback to variation's own sizeMm or default
  if (!mH && !mW) {
    const { height: vH, width: vW } = parseDimensions(variation?.sizeMm);
    if (vH && vW) {
      return {
        masterText: '',
        actualText: `${vH} × ${vW} mm`,
        actualHeight: vH,
        actualWidth: vW,
      };
    }
    return {
      masterText: '',
      actualText: variation?.sizeMm ? `${variation.sizeMm}` : '',
    };
  }

  const baseH = mH || 5.0;
  const baseW = mW || (mH ? Math.round(mH * 0.55 * 10) / 10 : 3.0);

  // If variation is undefined, return baseline
  if (!variation) {
    return {
      masterText: mW ? `${baseH} × ${baseW} mm` : `${baseH} mm`,
      actualText: mW ? `${baseH} × ${baseW} mm` : `${baseH} mm`,
      masterHeight: baseH,
      masterWidth: baseW,
      actualHeight: baseH,
      actualWidth: baseW,
    };
  }

  // Analyze design text attributes for physical head geometry expansion
  const textCorpus = [
    variation.name || '',
    variation.description || '',
    variation.motifTreatment || '',
    variation.setting || '',
    variation.stoneLayout || '',
  ]
    .join(' ')
    .toLowerCase();

  let deltaHFactor = 0;
  let deltaWFactor = 0;

  // 1. Outer wire halo or nested double wire border
  if (
    textCorpus.includes('halo') ||
    textCorpus.includes('wireframe') ||
    textCorpus.includes('double wire') ||
    textCorpus.includes('border')
  ) {
    deltaHFactor += 0.08;
    deltaWFactor += 0.09;
  }

  // 2. Bypass wrapping curves or split-wire shoulders
  if (
    textCorpus.includes('bypass') ||
    textCorpus.includes('wrap') ||
    textCorpus.includes('split') ||
    textCorpus.includes('ribbon')
  ) {
    deltaHFactor += 0.05;
    deltaWFactor += 0.04;
  }

  // 3. Stepped geometric tiers or raised galleries
  if (
    textCorpus.includes('stepped') ||
    textCorpus.includes('tier') ||
    textCorpus.includes('filigree') ||
    textCorpus.includes('gallery')
  ) {
    deltaHFactor += 0.06;
    deltaWFactor += 0.08;
  }

  // 4. Elongated rhombus, navette, diagonal or marquise cluster
  if (
    textCorpus.includes('rhombus') ||
    textCorpus.includes('diagonal') ||
    textCorpus.includes('navette') ||
    textCorpus.includes('elongated')
  ) {
    deltaHFactor += 0.09;
    deltaWFactor -= 0.03;
  }

  // 5. East-west or wide horizontal layout
  if (
    textCorpus.includes('east-west') ||
    textCorpus.includes('horizontal') ||
    textCorpus.includes('wide') ||
    textCorpus.includes('quadrant')
  ) {
    deltaHFactor -= 0.02;
    deltaWFactor += 0.10;
  }

  // 6. Tight cluster / seamless rhodium fill
  if (
    textCorpus.includes('tight') ||
    textCorpus.includes('seamless') ||
    textCorpus.includes('rhodium fill') ||
    textCorpus.includes('flush')
  ) {
    deltaHFactor -= 0.02;
    deltaWFactor -= 0.01;
  }

  // Seed with variation index to ensure subtle distinctness across all 10 cards
  const indexOffset = (((variation.index || 1) * 7) % 9 - 4) * 0.015;
  deltaHFactor += indexOffset;
  deltaWFactor += ((variation.index || 1) % 4 - 1.5) * 0.018;

  // Clamp factor to fine jewelry realistic variance limit (between -8% and +16%)
  deltaHFactor = Math.max(-0.08, Math.min(0.16, deltaHFactor));
  deltaWFactor = Math.max(-0.08, Math.min(0.16, deltaWFactor));

  // Compute calculated actual dimensions rounded to 1 decimal place
  const actualH = Math.round((baseH * (1 + deltaHFactor)) * 10) / 10;
  const actualW = Math.round((baseW * (1 + deltaWFactor)) * 10) / 10;

  const masterText = mW ? `${baseH} × ${baseW} mm` : `${baseH} mm`;
  const actualText = mW ? `${actualH} × ${actualW} mm` : `${actualH} mm`;

  return {
    masterText,
    actualText,
    masterHeight: baseH,
    masterWidth: baseW,
    actualHeight: actualH,
    actualWidth: actualW,
  };
}
