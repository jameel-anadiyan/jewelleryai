import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import 'dotenv/config';
import OpenAI from 'openai';

export const config = {
  maxDuration: 60,
};

export interface Variation {
  index: number;
  name: string;
  description: string;
  motifTreatment?: string;
  stoneCount: number;
  stoneLayout: string;
  setting: string;
  sizeMm: string;
  goldVsOriginal: string;
  imagePrompt: string;
}

export interface OriginalAnalysis {
  productType: string;
  metal: string;
  motif: string;
  stoneCount: number;
  stoneLayout: string;
  summary: string;
}

let openaiClient: OpenAI | null = null;

function getOpenAI(customKey?: string): OpenAI {
  const apiKey =
    customKey ||
    process.env.OPENAI_API_KEY ||
    process.env.VITE_OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY is missing. Please add OPENAI_API_KEY in Vercel Environment Variables, or click "OpenAI Key" in the top bar to set it.'
    );
  }

  if (customKey) {
    return new OpenAI({
      apiKey: customKey,
      timeout: 120000,
    });
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey,
      timeout: 120000,
    });
  }
  return openaiClient;
}

async function withRetry<T>(name: string, fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      if (attempt > maxRetries) {
        console.error(`[Retry Failed] ${name} failed after ${maxRetries + 1} attempts`);
        throw err;
      }
      const delay = Math.pow(2, attempt) * 1000;
      console.warn(`[Retry Warning] ${name} attempt ${attempt} failed (${err.message}). Retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

function safeParseJson(raw: string): any {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  return JSON.parse(cleaned);
}

function getAnalysisSystemPrompt(
  count: number,
  clusterRhodiumFill = false,
  headShapeVariance = false
): string {
  const isCluster =
    clusterRhodiumFill === true ||
    (clusterRhodiumFill as any) === 'true' ||
    (clusterRhodiumFill as any) === 1 ||
    (clusterRhodiumFill as any) === '1';

  const isHeadVariance =
    headShapeVariance === true ||
    (headShapeVariance as any) === 'true' ||
    (headShapeVariance as any) === 1 ||
    (headShapeVariance as any) === '1';

  const clusterRhodiumInstruction = isCluster
    ? `\n   - CRITICAL STONE SETTING & RHODIUM GAP FILL: The diamonds must be seated closely nearby like a tight cluster or in a line cluster, feeling and appearing as one continuous diamond surface. The stones must be set in high-polish white rhodium plating with bright-cut micro-prongs to seamlessly fill all diamond gaps between stones, making the rhodium and diamonds blend into a unified, gapless cluster part.`
    : '';

  const headShapeVarianceInstruction = isHeadVariance
    ? `\n   - CRITICAL 40%-50% HEAD SHAPE DIVERGENCE: The head / centerpiece motif outline and silhouette MUST have a 40% to 50% geometric shape difference from the reference photo and across the 10 variations. Substantially transform the physical shape and contour of the head/cluster (for example, morphing a rounded or oval head into an angular geometric hexagon, an elongated marquise/navette apex, an asymmetric fluid petal curve, a pointed chevron crest, an open teardrop halo, or an interlocking crossover head) while strictly retaining the exact ${count} diamonds and lightweight wire construction.`
    : '';

  return `You are a senior fine-jewellery designer for SWA Diamonds. You receive one product photo and its exact diamond count per piece: ${count}.

MOTIF & GEOMETRY LOCK (follow strictly):
1. Before designing, name the reference's core motif and geometry in a few words, for example "geometric square", "heart / love", "infinity", "flower", "butterfly", "evil eye", "star and moon", "leaf", "knot", or "crossline X". Also list its signature details. Return this in original.motif.
2. Return EXACTLY 10 distinct, production-viable variations numbered 1 to 10.
3. CRITICAL MANDATORY REQUIREMENT — USE GEOMETRY OF SAME TYPE & MAINTAIN HEAD SIZE:
   All 10 variations MUST strictly share and preserve the EXACT SAME GEOMETRIC TYPE and EXACT HEAD SIZE as the reference piece!
   - Maintain the exact head size of the reference image: the centerpiece head/cluster must match the reference photo's head scale and proportion precisely — do not make it larger or smaller.
   - If the reference has a geometric square, rectangular, or cushion head, ALL 10 variations must maintain that geometric square / rectangular centerpiece silhouette and head size.
   - If the reference is an oval, round cluster, or floral motif, all 10 variations must strictly preserve that geometric type and head size.
   - Vary the shank architecture, split-wire contours, bypass curves, gallery openwork, shoulder diamond rows, and cluster seating while KEEPING the centerpiece head in the SAME GEOMETRIC TYPE and SAME HEAD SIZE.
4. Original designs only: no brand look-alikes, no logos or text.

Rules for every variation:
- EXACTLY ${count} diamonds per piece, all the same size as the original. No extra accent stones. No coloured stones unless the original has them.
- HEAD SIZE: Maintain the exact head size and centerpiece scale of the reference image.
- Lightweight: thin wire (about 1.0-1.2 mm), open and airy shapes, no heavy solid metal.
- Same design family: same mood and proportions, two-tone if the original is two-tone, same band or earring-back type.${clusterRhodiumInstruction}${headShapeVarianceInstruction}

For each variation return:
- index: integer (1 to 10)
- name: 2-3 words distinctive jewellery name matching its specific archetype
- description: max 2 sentences describing the design concept and its unique shape
- motifTreatment: one line explaining how this design interprets the motif
- stoneCount: must equal ${count}
- stoneLayout: exact placement of every stone in this specific design
- setting: cluster with rhodium gap fill, prong, bezel, channel, micro-prong, etc.
- sizeMm: estimated dimensions e.g. 18 x 6
- goldVsOriginal: lighter, about the same, or more
- imagePrompt: vivid visual description detailing its specific unique construction, wire curves, and stone placement

Return only JSON matching:
original: { productType, metal, motif, stoneCount, stoneLayout, summary },
variations: [ array of 10 design objects ]`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-openai-key, x-app-password');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method Not Allowed' } });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    let {
      photoBase64,
      mimeType = 'image/jpeg',
      diamondCount = 10,
      countFor = 'piece',
      sku = '',
      stoneSize = '',
      metal = 'same',
      mustKeep = '',
      clusterRhodiumFill = false,
      headShapeVariance = false,
    } = body || {};

    diamondCount = Number(diamondCount) || 10;
    if (!photoBase64) {
      return res.status(400).json({
        error: { code: 'missing_image', message: 'Reference jewellery photo is required.' },
      });
    }

    // Clean up base64 prefix if present
    const cleanBase64 = photoBase64.replace(/^data:image\/[a-z]+;base64,/, '');
    const perPieceCount = countFor === 'pair' ? Math.max(1, Math.round(diamondCount / 2)) : diamondCount;
    const textModel = process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini';

    const isClusterRhodium =
      clusterRhodiumFill === true ||
      (clusterRhodiumFill as any) === 'true' ||
      (clusterRhodiumFill as any) === 1 ||
      (clusterRhodiumFill as any) === '1';

    const isHeadVariance =
      headShapeVariance === true ||
      (headShapeVariance as any) === 'true' ||
      (headShapeVariance as any) === 1 ||
      (headShapeVariance as any) === '1';

    const customKey =
      (req.headers['x-openai-key'] as string) ||
      body?.openaiApiKey ||
      undefined;

    const openai = getOpenAI(customKey);

    const clusterRhodiumNote = isClusterRhodium
      ? ' MANDATORY REQUIREMENT: Close Cluster & White Rhodium Gap Fill is ENABLED. All diamonds must sit together in a tight cluster or line cluster with high-polish white rhodium seamlessly filling diamond gaps into one continuous diamond surface.'
      : '';

    const headShapeVarianceNote = isHeadVariance
      ? ' MANDATORY REQUIREMENT: 40%-50% geometric shape difference in the head silhouette across designs.'
      : '';

    const imagePart = {
      type: 'image_url' as const,
      image_url: {
        url: `data:${mimeType};base64,${cleanBase64}`,
        detail: 'high' as const,
      },
    };

    const userPrompt = [
      {
        type: 'text' as const,
        text: `Analyze this reference jewellery item. Diamond count per piece: ${perPieceCount} (total entered: ${diamondCount}, for: ${countFor}). SKU: ${sku || 'None'}. Stone size: ${stoneSize || 'estimate'}. Metal request: ${metal || 'same as photo'}. Must keep: ${mustKeep || 'none'}.${clusterRhodiumNote}${headShapeVarianceNote} Generate original summary and 10 completely distinct, non-repeating design variations (1 to 10). Return valid JSON.`,
      },
      imagePart,
    ];

    // Single fast request returning all 10 distinct variations in ~3 seconds
    const fetchAnalysis = async () => {
      const response = await openai.chat.completions.create({
        model: textModel,
        messages: [
          { role: 'system', content: getAnalysisSystemPrompt(perPieceCount, isClusterRhodium, isHeadVariance) },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.75,
      });
      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No content returned from analysis model');
      return safeParseJson(content);
    };

    const data = await withRetry('analyze10Variations', fetchAnalysis);

    const original: OriginalAnalysis = data.original || {
      productType: 'Jewellery',
      metal: 'Gold',
      motif: 'Fine Jewellery Motif',
      stoneCount: perPieceCount,
      stoneLayout: 'Cluster / pavé arrangement',
      summary: `Fine jewellery piece with ${perPieceCount} diamonds.`,
    };

    const rawList: any[] = Array.isArray(data.variations) ? data.variations : [];

    // Ensure we have exactly 10 variations with proper indices and defaults
    const finalVariations: Variation[] = rawList.slice(0, 10).map((v, i) => {
      const stoneLayout = isClusterRhodium
        ? (v.stoneLayout?.toLowerCase().includes('cluster')
            ? v.stoneLayout
            : `Tight cluster of ${perPieceCount} diamonds seated closely together with white rhodium filling diamond gaps`)
        : (v.stoneLayout || `${perPieceCount} round diamonds in setting`);

      const setting = isClusterRhodium
        ? (v.setting?.toLowerCase().includes('rhodium')
            ? v.setting
            : 'Tight cluster with high-polish white rhodium gap fill')
        : (v.setting || 'Prong');

      const imagePrompt = isClusterRhodium
        ? (v.imagePrompt?.toLowerCase().includes('rhodium')
            ? v.imagePrompt
            : `${v.imagePrompt || `Fine jewellery design #${i + 1}`} The ${perPieceCount} diamonds are set close together in a dense cluster with bright-cut white rhodium plating filling every gap between stones, creating one continuous diamond surface.`)
        : (v.imagePrompt || `Fine jewellery sketch of ${v.name || 'piece'} with ${perPieceCount} diamonds.`);

      return {
        index: i + 1,
        name: v.name || `Design Concept ${i + 1}`,
        description: v.description || 'Lightweight fine jewellery wire structure with sparkling diamond accents.',
        motifTreatment: v.motifTreatment || original.motif || '',
        stoneCount: perPieceCount,
        stoneLayout,
        setting,
        sizeMm: v.sizeMm || '16 x 6',
        goldVsOriginal: v.goldVsOriginal || 'about the same',
        imagePrompt,
      };
    });

    // If fewer than 10 were returned by the LLM, synthesize remaining to guarantee 10
    const geometricTreatments = [
      'Contour Wire Shank',
      'Dual-Rail Bypass Band',
      'Cathedral Raised Setting',
      'Openwork Filigree Gallery',
      'Knife-Edge Tapered Band',
      'Split-Shoulder Architecture',
      'Interlocking Wrap Frame',
      'Floating Pavé Under-Gallery',
      'Articulated Stepped Shoulders',
      'Sleek Tension Crossover',
    ];

    while (finalVariations.length < 10) {
      const idx = finalVariations.length + 1;
      const treatment = geometricTreatments[(idx - 1) % geometricTreatments.length];
      finalVariations.push({
        index: idx,
        name: `${original.motif || 'Geometric'} ${treatment}`,
        description: `Refined variation maintaining the exact ${original.motif || 'master'} geometry with ${treatment.toLowerCase()}.`,
        motifTreatment: `${original.motif || 'Master'} geometry with ${treatment.toLowerCase()}`,
        stoneCount: perPieceCount,
        stoneLayout: isClusterRhodium
          ? `Tight cluster of ${perPieceCount} diamonds with white rhodium gap fill`
          : `${perPieceCount} round diamonds placed in ${original.motif || 'geometric'} setting`,
        setting: isClusterRhodium
          ? 'Tight cluster with white rhodium gap fill'
          : 'Micro-prong',
        sizeMm: '16 x 5',
        goldVsOriginal: 'about the same',
        imagePrompt: isClusterRhodium
          ? `Professional fine jewellery design sketch of ${original.motif || 'geometric'} piece with ${treatment.toLowerCase()} and ${perPieceCount} round diamonds in a dense cluster setting filled with bright-cut white rhodium.`
          : `Professional fine jewellery design sketch of ${original.motif || 'geometric'} piece with ${treatment.toLowerCase()} and ${perPieceCount} round brilliant diamonds.`,
      });
    }

    const jobId = crypto.randomBytes(8).toString('hex');

    return res.status(200).json({
      jobId,
      original,
      variations: finalVariations,
      diamondCount: perPieceCount,
      countFor,
      sku,
      clusterRhodiumFill: isClusterRhodium,
      headShapeVariance: isHeadVariance,
    });
  } catch (err: any) {
    console.error('[API analyze Error]', err);
    return res.status(500).json({
      error: {
        code: err?.code || 'internal_error',
        message: err?.message || 'An error occurred during analysis.',
      },
    });
  }
}
