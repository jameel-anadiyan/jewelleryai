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
    ? `\n\n*** CRITICAL MANDATORY REQUIREMENT - CLOSE CLUSTER & WHITE RHODIUM GAP FILL ***:
The user has enabled Close Cluster & Rhodium Gap Fill.
For EVERY SINGLE variation:
1. The stones MUST be seated closely nearby like a tight cluster or in a line cluster, feeling and appearing as one single unified diamond surface.
2. stoneLayout MUST specify: "Tight cluster of ${count} diamonds seated closely together with white rhodium filling all diamond gaps" or "Dense continuous line cluster with high-polish white rhodium gap fill".
3. setting MUST be: "Tight cluster with high-polish white rhodium plating filling all diamond gaps" or "Tight line cluster with bright-cut micro-prongs and rhodium fill".
4. imagePrompt MUST describe: "The ${count} diamonds are set close together in a dense cluster with bright-cut white rhodium plating filling every gap between stones, creating the visual appearance of one solid, gapless, brilliant diamond surface."
Do NOT spread or scatter diamonds individually across open wire.`
    : '';

  const headShapeVarianceInstruction = isHeadVariance
    ? `\n\n*** CRITICAL 40%-50% HEAD SILHOUETTE TRANSFORMATION (STRICTLY NO 5%-10% TWEAKS) ***:
The user has enabled 40%-50% Head Shape Difference.
CRITICAL: DO NOT return minor 5%-10% tweaks or replicas of the reference photo.
Every variation MUST feature a radically transformed head silhouette and centerpiece contour that is 40% to 50% visually and geometrically different from the reference photo:
- If the original piece has a round/oval head, morph it into sharp geometric hexagons, faceted octagons, elongated pointed navette/marquise apex, sweeping asymmetric bypass wave petal, pointed architectural chevron crest, or open crossover teardrop loops.
- Redesign the wireframe shank and mounting architecture to complement this new silhouette.
- In each variation's name, description, and imagePrompt, clearly state this distinct transformed silhouette so each design stands out as a bold, new, independent designer creation.`
    : `\n\nDESIGN DIVERSITY REQUIREMENT:
Provide clear, visually interesting design variety (different wire swoops, bypass curves, and contour variations) rather than identical replicas.`;

  const startIndex = batch === 1 ? 1 : 11;
  const endIndex = batch === 1 ? 10 : 20;
  const batchTheme =
    batch === 1
      ? 'Focus on geometric, architectural, hexagonal, faceted, and elongated navette/marquise silhouette transformations (designs 1 to 10).'
      : 'Focus on dynamic fluid wave, asymmetric bypass swirl, pointed chevron crest, and modern sculpted wirework transformations (designs 11 to 20).';

  return `You are a senior master fine-jewellery designer for SWA Diamonds. You receive one product photo and its exact diamond count per piece: ${count}.

MOTIF FAMILY & DESIGN EVOLUTION:
1. Name the reference's core motif in a few words (e.g. "heart / love", "infinity", "floral petal", "butterfly", "star and moon", "leaf wave", "geometric knot"). List signature theme in original.motif.
2. Each variation must creatively reinterpret that theme with noticeable structural changes.
3. Return exactly 10 distinct, production-viable variations numbered from ${startIndex} to ${endIndex}. ${batchTheme}

Rules for every variation:
- EXACTLY ${count} diamonds per piece, all the same size as the original. No extra accent stones.
- Lightweight: thin wire (about 1.0-1.2 mm), open and airy shapes, no heavy solid metal.
- Same metal family: two-tone if the original is two-tone, yellow/rose/white gold to match.
- Original designs only: no brand look-alikes, no logos or text.${clusterRhodiumInstruction}${headShapeVarianceInstruction}

For each variation, return:
- index: integer (${startIndex} to ${endIndex})
- name: 2-3 words distinctive jewellery name (e.g. "Hexagonal Apex Cluster", "Navette Wave Ring", "Asymmetric Swirl Bypass")
- description: max 2 sentences describing the design concept and its head silhouette
- motifTreatment: one line on how this design interprets the motif with its unique head contour
- stoneCount: must equal ${count}
- stoneLayout: exact placement of every stone
- setting: cluster with rhodium gap fill, prong, bezel, micro-prong, etc.
- sizeMm: estimated dimensions e.g. 18 x 6
- goldVsOriginal: lighter, about the same, or more
- imagePrompt: detailed visual prompt for sketch generator

Return JSON matching:
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
      ? ' MANDATORY REQUIREMENT: 40%-50% geometric shape difference in the head silhouette across designs. Absolutely NO minor 5%-10% tweaks or copies of the reference photo.'
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
        text: `Analyze this reference jewellery item. Diamond count per piece: ${perPieceCount} (total entered: ${diamondCount}, for: ${countFor}). SKU: ${sku || 'None'}. Stone size: ${stoneSize || 'estimate'}. Metal request: ${metal || 'same as photo'}. Must keep: ${mustKeep || 'none'}.${clusterRhodiumNote}${headShapeVarianceNote} Generate original summary and variations 1 to 10 with geometric & architectural head transformations. Return valid JSON.`,
      },
      imagePart,
    ];

    const userPromptBatch2 = [
      {
        type: 'text' as const,
        text: `Based on this reference jewellery item with diamond count per piece: ${perPieceCount}. Metal: ${metal || 'same'}.${clusterRhodiumNote}${headShapeVarianceNote} Generate variations 11 to 20 exploring fluid asymmetric, pointed chevron crest, and sculpted wirework transformations. Return valid JSON.`,
      },
      imagePart,
    ];

    // Execute both batches in parallel (10 items each = 20 total) for ultra-fast generation (~5-8s)
    const fetchBatch1 = async () => {
      const response = await openai.chat.completions.create({
        model: textModel,
        messages: [
          { role: 'system', content: getAnalysisSystemPrompt(perPieceCount, 1, isClusterRhodium, isHeadVariance) },
          { role: 'user', content: userPromptBatch1 },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.75,
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
        temperature: 0.8,
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
    const fallbackShapes = [
      'Hexagonal Bevel Head',
      'Elongated Navette Apex',
      'Asymmetric Wave Bypass',
      'Pointed Chevron Crest',
      'Open Teardrop Halo',
      'Faceted Octagon Frame',
      'Sculpted Ribbon Crossover',
      'Floating Knife-Edge Apex',
    ];

    while (finalVariations.length < 20) {
      const idx = finalVariations.length + 1;
      const shape = fallbackShapes[idx % fallbackShapes.length];
      finalVariations.push({
        index: idx,
        name: `${shape} Concept ${idx}`,
        description: `40%-50% transformed silhouette featuring a ${shape.toLowerCase()} with airy wire architecture.`,
        motifTreatment: `${shape} reinterpretation of ${original.motif || 'core motif'}`,
        stoneCount: perPieceCount,
        stoneLayout: isClusterRhodium
          ? `Tight cluster of ${perPieceCount} diamonds with white rhodium gap fill in a ${shape.toLowerCase()}`
          : `${perPieceCount} round diamonds placed in ${shape.toLowerCase()}`,
        setting: isClusterRhodium
          ? 'Tight cluster with white rhodium gap fill'
          : 'Micro-prong',
        sizeMm: '16 x 5',
        goldVsOriginal: 'lighter',
        imagePrompt: isClusterRhodium
          ? `Professional fine jewellery design sketch of ${shape} with ${perPieceCount} round diamonds in a dense cluster setting filled with bright-cut white rhodium.`
          : `Professional fine jewellery design sketch of ${shape} with ${perPieceCount} round brilliant diamonds.`,
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
