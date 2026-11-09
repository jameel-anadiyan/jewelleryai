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
  headShapeVariance = false,
  headLength?: number,
  headWidth?: number
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

  let headDimensionsInstruction = '';
  if (headLength && headWidth) {
    const minL = (headLength * 0.8).toFixed(1);
    const maxL = (headLength * 1.2).toFixed(1);
    const minW = (headWidth * 0.8).toFixed(1);
    const maxW = (headWidth * 1.2).toFixed(1);
    const ratio = headLength / headWidth;
    const isNonSquare = Math.abs(ratio - 1) > 0.15;
    const shapeLabel = ratio > 1.25 ? 'elongated / slender' : ratio < 0.8 ? 'wide' : 'proportional';

    headDimensionsInstruction = `\n   - CRITICAL REQUIREMENT — HEAD DIMENSION LIMITS & STRICT BAN ON SQUARE SHAPES:
     * User-specified target dimensions: Length ${headLength} mm, Width ${headWidth} mm (Aspect Ratio: ${ratio.toFixed(2)}:1, ${shapeLabel} proportion).
     * ${isNonSquare ? `STRICT BAN: DO NOT GENERATE SQUARE, CIRCULAR, OR 1:1 EQUILATERAL DESIGNS. Length (${headLength} mm) is ${(ratio).toFixed(1)}x greater than width (${headWidth} mm). ALL 10 variations MUST feature an elongated, slender head silhouette (e.g. elegant marquise/navette contour, tapered oval, elongated bypass, slender vertical ribbon). Drawing a square (1:1) or round head is a strict failure.` : ''}
     * ABSOLUTE 20% LIMIT: Head length for all variations MUST stay strictly between ${minL} mm and ${maxL} mm. Head width MUST stay strictly between ${minW} mm and ${maxW} mm. Never exceed 20% deviation!
     * Each variation's sizeMm MUST be written as "[length] x [width]" conforming to these limits (e.g. "${headLength} x ${headWidth}").
     * Each variation's imagePrompt MUST explicitly specify: "Elongated centerpiece measuring ${headLength} mm by ${headWidth} mm (strictly non-square, adhering to the 20% dimension limit)".`;
  }

  return `You are a senior fine-jewellery designer for SWA Diamonds. You receive one product photo and its exact diamond count per piece: ${count}.

MOTIF LOCK & COMPLETE DIVERSITY (follow strictly):
1. Before designing, name the reference's core motif in a few words, for example "heart / love", "infinity", "flower", "butterfly", "evil eye", "star and moon", "leaf", "knot", "crossline X" or "geometric rectangle / navette". Also list its signature details. Return this in original.motif.
2. Return EXACTLY 10 distinct, production-viable variations numbered 1 to 10.
3. CRITICAL REQUIREMENT — DO NOT REPEAT THE SAME DESIGN:
   Every single variation MUST have a distinctly different shape, wireframe structure, and silhouette so no two cards look alike! Spread the 10 designs across these 10 distinct architectural forms:
   - Design 1: Minimalist Solitary Contour (sleek fluid wire silhouette with focal cluster)
   - Design 2: Asymmetric Bypass Wrap (sweeping bypass band crossing around the center)
   - Design 3: Angular Elongated Frame (crisp slender faceted contour adhering to the dimension ratio, never square)
   - Design 4: Open Organic Petals (delicate openwork wire petal silhouette)
   - Design 5: Elongated Navette / Marquise (slender tapered pointed apex contour)
   - Design 6: Twisted Crossover / Infinity Ribbon (interlocking dual-wire weave)
   - Design 7: Pointed Chevron Crest (sculpted V-crest cathedral cluster)
   - Design 8: Open Teardrop Loop (graceful asymmetric pear halo contour)
   - Design 9: Diagonal Tension Arch (open split-shank with cluster suspended diagonally)
   - Design 10: Dynamic Spiral Wave (multi-level swirling contour with fluid motion)
4. Original designs only: no brand look-alikes, no logos or text.

Rules for every variation:
- EXACTLY ${count} diamonds per piece, all the same size as the original. No extra accent stones. No coloured stones unless the original has them.
- Lightweight: thin wire (about 1.0-1.2 mm), open and airy shapes, no heavy solid metal.
- Same design family: same mood and proportions, two-tone if the original is two-tone, same band or earring-back type.${clusterRhodiumInstruction}${headShapeVarianceInstruction}${headDimensionsInstruction}

For each variation return:
- index: integer (1 to 10)
- name: 2-3 words distinctive jewellery name matching its specific archetype
- description: max 2 sentences describing the design concept and its unique shape
- motifTreatment: one line explaining how this design interprets the motif
- stoneCount: must equal ${count}
- stoneLayout: exact placement of every stone in this specific design
- setting: cluster with rhodium gap fill, prong, bezel, channel, micro-prong, etc.
- sizeMm: estimated dimensions e.g. 18 x 6 (keeping within the ±20% head dimension limit)
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
      headLength,
      headWidth,
    } = body || {};

    diamondCount = Number(diamondCount) || 10;
    const numHeadLength = headLength ? Number(headLength) : undefined;
    const numHeadWidth = headWidth ? Number(headWidth) : undefined;
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

    const headDimensionsNote = (numHeadLength && numHeadWidth)
      ? ` MANDATORY HEAD DIMENSIONS & STRICT BAN ON SQUARE/ROUND SHAPES: Specified Head Length: ${numHeadLength} mm, Head Width: ${numHeadWidth} mm (aspect ratio ${(numHeadLength / numHeadWidth).toFixed(2)}:1). ${Math.abs(numHeadLength / numHeadWidth - 1) > 0.15 ? 'STRICT BAN: DO NOT GENERATE SQUARE, CIRCULAR, OR 1:1 EQUILATERAL HEADS. Every variation MUST feature an elongated centerpiece silhouette.' : ''} All variations must strictly adhere to these head dimensions within a ±20% limit (Length: ${(numHeadLength * 0.8).toFixed(1)}–${(numHeadLength * 1.2).toFixed(1)} mm, Width: ${(numHeadWidth * 0.8).toFixed(1)}–${(numHeadWidth * 1.2).toFixed(1)} mm). The change in length and width CANNOT exceed 20%.`
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
        text: `Analyze this reference jewellery item. Diamond count per piece: ${perPieceCount} (total entered: ${diamondCount}, for: ${countFor}). SKU: ${sku || 'None'}. Stone size: ${stoneSize || 'estimate'}. Metal request: ${metal || 'same as photo'}. Must keep: ${mustKeep || 'none'}.${clusterRhodiumNote}${headShapeVarianceNote}${headDimensionsNote} Generate original summary and 10 completely distinct, non-repeating design variations (1 to 10). Return valid JSON.`,
      },
      imagePart,
    ];

    // Single fast request returning all 10 distinct variations in ~3 seconds
    const fetchAnalysis = async () => {
      const response = await openai.chat.completions.create({
        model: textModel,
        messages: [
          { role: 'system', content: getAnalysisSystemPrompt(perPieceCount, isClusterRhodium, isHeadVariance, numHeadLength, numHeadWidth) },
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
        sizeMm: v.sizeMm || (numHeadLength && numHeadWidth ? `${numHeadLength} x ${numHeadWidth}` : '16 x 6'),
        goldVsOriginal: v.goldVsOriginal || 'about the same',
        imagePrompt,
      };
    });

    // If fewer than 10 were returned by the LLM, synthesize remaining to guarantee 10
    const archetypes = [
      { name: 'Minimalist Solitary Contour', desc: 'Clean fluid wire silhouette with focal cluster' },
      { name: 'Asymmetric Bypass Wrap', desc: 'Sweeping bypass band crossing around the center' },
      { name: 'Angular Elongated Frame', desc: 'Crisp slender faceted architectural head frame' },
      { name: 'Open Floral Petals', desc: 'Delicate openwork wire petal silhouette' },
      { name: 'Elongated Navette Apex', desc: 'Slender tapered pointed apex contour' },
      { name: 'Twisted Crossover Ribbon', desc: 'Interlocking dual-wire weave construction' },
      { name: 'Pointed Chevron Crest', desc: 'Sculpted V-crest cathedral cluster' },
      { name: 'Open Teardrop Loop', desc: 'Graceful asymmetric pear halo contour' },
      { name: 'Diagonal Tension Arch', desc: 'Open split-shank with cluster suspended diagonally' },
      { name: 'Dynamic Spiral Wave', desc: 'Multi-level swirling contour with fluid motion' },
    ];

    while (finalVariations.length < 10) {
      const idx = finalVariations.length + 1;
      const arc = archetypes[(idx - 1) % archetypes.length];
      finalVariations.push({
        index: idx,
        name: `${arc.name} #${idx}`,
        description: `${arc.desc} interpreting the ${original.motif || 'core'} motif.`,
        motifTreatment: `${arc.name} variation`,
        stoneCount: perPieceCount,
        stoneLayout: isClusterRhodium
          ? `Tight cluster of ${perPieceCount} diamonds with white rhodium gap fill`
          : `${perPieceCount} round diamonds placed in ${arc.name.toLowerCase()}`,
        setting: isClusterRhodium
          ? 'Tight cluster with white rhodium gap fill'
          : 'Micro-prong',
        sizeMm: numHeadLength && numHeadWidth ? `${numHeadLength} x ${numHeadWidth}` : '16 x 5',
        goldVsOriginal: 'lighter',
        imagePrompt: isClusterRhodium
          ? `Professional fine jewellery design sketch of ${arc.name} with ${perPieceCount} round diamonds in a dense cluster setting filled with bright-cut white rhodium.`
          : `Professional fine jewellery design sketch of ${arc.name} with ${perPieceCount} round brilliant diamonds.`,
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
      headLength: numHeadLength,
      headWidth: numHeadWidth,
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
