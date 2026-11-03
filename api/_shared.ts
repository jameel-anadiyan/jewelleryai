import 'dotenv/config';
import OpenAI from 'openai';
import { z } from 'zod';

export const QualityEnum = z.enum(['low', 'medium', 'high']);
export type Quality = z.infer<typeof QualityEnum>;

export const CountForEnum = z.enum(['piece', 'pair']);
export type CountFor = z.infer<typeof CountForEnum>;

export const VariationSchema = z.object({
  index: z.number().int().min(1).max(60),
  name: z.string().min(1),
  description: z.string().min(1),
  motifTreatment: z.string().default(''),
  stoneCount: z.number().int().min(1),
  stoneLayout: z.string().min(1),
  setting: z.string().min(1),
  sizeMm: z.string().min(1),
  goldVsOriginal: z.string().min(1),
  imagePrompt: z.string().min(1),
});

export type Variation = z.infer<typeof VariationSchema>;

export const OriginalAnalysisSchema = z.object({
  productType: z.string(),
  metal: z.string(),
  motif: z.string().default(''),
  stoneCount: z.number(),
  stoneLayout: z.string(),
  summary: z.string(),
});

export type OriginalAnalysis = z.infer<typeof OriginalAnalysisSchema>;

export const AnalysisResponseSchema = z.object({
  original: OriginalAnalysisSchema.optional(),
  variations: z.array(VariationSchema).min(1).max(60),
});

export type AnalysisResponse = z.infer<typeof AnalysisResponseSchema>;

let openaiClient: OpenAI | null = null;

export function getOpenAI(customKey?: string): OpenAI {
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

export function getAnalysisSystemPrompt(
  count: number,
  batch: 1 | 2 = 1,
  clusterRhodiumFill = false,
  headShapeVariance = false
): string {
  const clusterRhodiumInstruction = clusterRhodiumFill
    ? `\n   - CRITICAL STONE SETTING & RHODIUM GAP FILL: The diamonds must be seated closely nearby like a tight cluster or in a line cluster, feeling and appearing as one continuous diamond surface. The stones must be set in high-polish white rhodium plating with bright-cut micro-prongs to seamlessly fill all diamond gaps between stones, making the rhodium and diamonds blend into a unified, gapless cluster part.`
    : '';

  const headShapeVarianceInstruction = headShapeVariance
    ? `\n   - CRITICAL 40%-50% HEAD SHAPE DIVERGENCE: The head / centerpiece motif outline and silhouette MUST have a 40% to 50% geometric shape difference from the reference photo and across variations. Substantially transform the physical shape and contour of the head/cluster (for example, morphing a rounded or oval head into an angular geometric hexagon, an elongated marquise/navette apex, an asymmetric fluid petal curve, a pointed chevron crest, an open teardrop halo, or an interlocking crossover head) while strictly retaining the exact ${count} diamonds and lightweight wire construction.`
    : '';

  const startIndex = batch === 1 ? 1 : 26;
  const endIndex = batch === 1 ? 25 : 50;
  const batchTheme =
    batch === 1
      ? 'Focus on delicate, classic, romantic, and organic interpretations of the motif with graceful wire curves.'
      : 'Focus on bold geometric, contemporary, architectural, asymmetric, and sculpted modern wirework interpretations.';

  return `You are a senior master fine-jewellery designer for SWA Diamonds. You receive one product photo and its exact diamond count per piece: ${count}.

MOTIF LOCK (follow strictly):
1. Name the reference's core motif in a few words (e.g. "heart / love", "infinity", "flower", "butterfly", "star and moon", "leaf", "knot", "crossline X", "geometric square"). List signature details in original.motif.
2. All variations MUST stay in that motif family, so a customer recognises each one as the same theme at a glance.
3. Change how the motif is drawn: outline or pavé-filled, single or paired or interlocked, upright or tilted, open or closed, rounded or geometric, inside a loop or standing alone.
4. Keep the original's signature details wherever they fit.
5. Never add motifs from other themes.
6. For each variation, describe its specific interpretation in motifTreatment.
7. Return exactly 25 distinct variations numbered from ${startIndex} to ${endIndex}. ${batchTheme}

Rules for every variation:
- EXACTLY ${count} diamonds per piece, all the same size as the original. No extra accent stones.
- Lightweight: thin wire (about 1.0-1.2 mm), open and airy shapes, no heavy solid metal.
- Same design family: same mood and proportions, two-tone if the original is two-tone.
- Original designs only: no brand look-alikes, no logos or text.${clusterRhodiumInstruction}${headShapeVarianceInstruction}

For each variation, return:
- index: integer (${startIndex} to ${endIndex})
- name: 2-3 words distinctive jewellery name
- description: max 2 sentences describing the design concept
- motifTreatment: one line on how this design interprets the motif
- stoneCount: must equal ${count}
- stoneLayout: exact placement of every stone
- setting: prong, bezel, channel, pave, micro-prong, etc.
- sizeMm: estimated dimensions e.g. 18 x 6
- goldVsOriginal: lighter, about the same, or more
- imagePrompt: detailed visual prompt for sketch generator

Return JSON matching the schema with:
${batch === 1 ? 'original: { productType, metal, motif, stoneCount, stoneLayout, summary },' : ''}
variations: [ array of 25 design objects ]`;
}

export function buildImagePrompt(
  variation: Variation,
  count: number,
  motif: string,
  clusterRhodiumFill = false,
  headShapeVariance = false
): string {
  const clusterRhodiumText = clusterRhodiumFill
    ? ` Stone arrangement: The stones must be seated closely nearby like a tight cluster or in a line cluster. The diamonds are set in bright-cut white rhodium plating designed to seamlessly fill all diamond gaps, making the diamonds and rhodium feel like one unified diamond cluster part.`
    : '';

  const headShapeText = headShapeVariance
    ? ` Head / Centerpiece Shape: Feature a distinct 40%-50% geometric shape difference in the head silhouette compared to conventional forms (e.g. bold geometric contour, asymmetric petal contour, pointed navette/chevron apex, or sculpted open loop).`
    : '';

  const cleanMotif = motif.trim() || 'original jewellery motif';
  const cleanTreatment = variation.motifTreatment?.trim() || variation.name;

  return `Use the attached product photo as the reference for scale, metal colours and design family. Draw ONE new jewellery design.
Motif: ${cleanMotif}. Keep it instantly recognisable in this design (${cleanTreatment}). Do not add any other motif.
Design: ${variation.name} - ${variation.description}
Details: ${variation.imagePrompt}${headShapeText}
Stones: EXACTLY ${count} round brilliant diamonds, laid out as: ${variation.stoneLayout}.${clusterRhodiumText} Draw every diamond clearly with facet lines so each one can be counted. No other stones.
Setting: ${variation.setting}.${clusterRhodiumFill ? ' Stones seated in tight cluster or line cluster with white rhodium filling diamond gaps.' : ''} Lightweight construction in thin wire.
Style: professional jewellery design sketch, fine pencil and ink lines on white paper with soft watercolour shading in gold and white gold. Same viewing angle as the reference photo. One design only, centred, plain white background, no text, no hands, no props.`;
}

export async function withRetry<T>(name: string, fn: () => Promise<T>, maxRetries = 2): Promise<T> {
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
