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
  batch: 1 | 2 = 1,
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
    ? `\n   - CRITICAL 40%-50% HEAD SHAPE DIVERGENCE: The head / centerpiece motif outline and silhouette MUST have a 40% to 50% geometric shape difference from the reference photo and across the variations. Substantially transform the physical shape and contour of the head/cluster (for example, morphing a rounded or oval head into an angular geometric hexagon, an elongated marquise/navette apex, an asymmetric fluid petal curve, a pointed chevron crest, an open teardrop halo, or an interlocking crossover head) while strictly retaining the exact ${count} diamonds and lightweight wire construction.`
    : '';

  const startIndex = batch === 1 ? 1 : 11;
  const endIndex = batch === 1 ? 10 : 20;

  return `You are a senior fine-jewellery designer for SWA Diamonds. You receive one product photo and its exact diamond count per piece: ${count}.

MOTIF LOCK (follow strictly):
1. Before designing, name the reference's core motif in a few words, for example "heart / love", "infinity", "flower", "butterfly", "evil eye", "star and moon", "leaf", "knot", "crossline X" or "geometric square". Also list its signature details, such as an open outline, a bypass band, a two-tone split or crossing lines. Return this in original.motif.
2. All variations MUST stay in that motif family, so a customer recognises each one as the same theme at a glance:
   - Love or heart: every design is heart-based. Examples: open heart, double or interlocked hearts, heart inside a loop, tilted heart, heart with an arrow, heart knot, two half-hearts meeting.
   - Infinity: every design is infinity-based. Examples: classic infinity, double or stacked infinity, infinity with a small heart, twisted-ribbon infinity, infinity knot, open-ended infinity.
   - Any other motif: use the same approach. Vary the interpretation; never swap the theme.
3. Change how the motif is drawn, not what it is: outline or pavé-filled, single or paired or interlocked, upright or tilted, open or closed, rounded or geometric, inside a loop or standing alone, or combined with the original construction (bypass, crossover, spiral).
4. Keep the original's signature details wherever they fit, so the set still feels related to it.
5. Never add motifs from other themes. No flowers, stars, butterflies or letters unless the reference already has them.
6. If the reference mixes two motifs (for example heart and infinity), keep both in every design, or keep the main one dominant in every design.
7. For each variation, describe its specific interpretation in motifTreatment (one line on how this design interprets the motif).
8. Before answering, check each variation: does it read as the same motif at a glance, and does it have exactly ${count} stones? Replace any that fail.
9. Return exactly 10 distinct variations numbered from ${startIndex} to ${endIndex}.

Rules for every variation:
- EXACTLY ${count} diamonds per piece, all the same size as the original. No extra accent stones. No coloured stones unless the original has them.
- Lightweight: thin wire (about 1.0-1.2 mm), open and airy shapes, no heavy solid metal.
- Same design family: same mood and proportions, two-tone if the original is two-tone, same band or earring-back type.
- Original designs only: no brand look-alikes, no logos or text.${clusterRhodiumInstruction}${headShapeVarianceInstruction}

For each variation return: name (2-3 words), description (max 2 sentences), motifTreatment (one line explaining how this design interprets the motif), stoneCount (must equal ${count}), stoneLayout (where each stone sits), setting, sizeMm (estimate), goldVsOriginal (lighter, about the same or more), and imagePrompt (a vivid visual description of the design for an image model).
Return only JSON that matches the schema:
${batch === 1 ? 'original: { productType, metal, motif, stoneCount, stoneLayout, summary },' : ''}
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

    const userPromptBatch1 = [
      {
        type: 'text' as const,
        text: `Analyze this reference jewellery item. Diamond count per piece: ${perPieceCount} (total entered: ${diamondCount}, for: ${countFor}). SKU: ${sku || 'None'}. Stone size: ${stoneSize || 'estimate'}. Metal request: ${metal || 'same as photo'}. Must keep: ${mustKeep || 'none'}.${clusterRhodiumNote}${headShapeVarianceNote} Generate original summary and variations 1 to 10. Return valid JSON.`,
      },
      imagePart,
    ];

    const userPromptBatch2 = [
      {
        type: 'text' as const,
        text: `Based on this reference jewellery item with diamond count per piece: ${perPieceCount}. Metal: ${metal || 'same'}.${clusterRhodiumNote}${headShapeVarianceNote} Generate variations 11 to 20 exploring creative wirework and silhouette interpretations. Return valid JSON.`,
      },
      imagePart,
    ];

    // Execute both batches in parallel (10 items each = 20 total) for ultra-fast generation
    const fetchBatch1 = async () => {
      const response = await openai.chat.completions.create({
        model: textModel,
        messages: [
          { role: 'system', content: getAnalysisSystemPrompt(perPieceCount, 1, isClusterRhodium, isHeadVariance) },
          { role: 'user', content: userPromptBatch1 },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      });
      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No content returned for batch 1');
      return safeParseJson(content);
    };

    const fetchBatch2 = async () => {
      const response = await openai.chat.completions.create({
        model: textModel,
        messages: [
          { role: 'system', content: getAnalysisSystemPrompt(perPieceCount, 2, isClusterRhodium, isHeadVariance) },
          { role: 'user', content: userPromptBatch2 },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.75,
      });
      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No content returned for batch 2');
      return safeParseJson(content);
    };

    const [data1, data2] = await withRetry('analyze20Variations', () => Promise.all([fetchBatch1(), fetchBatch2()]));

    const original: OriginalAnalysis = data1.original || {
      productType: 'Jewellery',
      metal: 'Gold',
      motif: 'Fine Jewellery Motif',
      stoneCount: perPieceCount,
      stoneLayout: 'Cluster / pavé arrangement',
      summary: `Fine jewellery piece with ${perPieceCount} diamonds.`,
    };

    const list1: any[] = Array.isArray(data1.variations) ? data1.variations : [];
    const list2: any[] = Array.isArray(data2.variations) ? data2.variations : [];

    const combinedRaw = [...list1, ...list2];

    // Ensure we have exactly 20 variations with proper indices and defaults
    const finalVariations: Variation[] = combinedRaw.slice(0, 20).map((v, i) => {
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

    // If fewer than 20 were returned by the LLM, synthesize remaining to guarantee 20
    while (finalVariations.length < 20) {
      const idx = finalVariations.length + 1;
      finalVariations.push({
        index: idx,
        name: `Silhouette Accent ${idx}`,
        description: `Fluid wire variation interpreting the ${original.motif || 'core'} motif.`,
        motifTreatment: `Modern wire accent ${idx}`,
        stoneCount: perPieceCount,
        stoneLayout: isClusterRhodium
          ? `Tight cluster of ${perPieceCount} diamonds with white rhodium gap fill`
          : `${perPieceCount} round diamonds placed along the curve`,
        setting: isClusterRhodium
          ? 'Tight cluster with white rhodium gap fill'
          : 'Micro-prong',
        sizeMm: '16 x 5',
        goldVsOriginal: 'lighter',
        imagePrompt: isClusterRhodium
          ? `Professional fine jewellery design sketch of ${original.motif} with ${perPieceCount} round diamonds in a dense cluster setting filled with bright-cut white rhodium.`
          : `Professional fine jewellery design sketch of ${original.motif} with ${perPieceCount} round brilliant diamonds.`,
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
