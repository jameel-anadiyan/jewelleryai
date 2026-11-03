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
    ? `\n\n*** CRITICAL MANDATORY REQUIREMENT - TIGHT CLUSTER & WHITE RHODIUM GAP FILL ***:
The user has enabled Close Cluster & Rhodium Gap Fill.
For EVERY SINGLE variation:
1. The stones MUST be seated closely nearby like a tight cluster or in a line cluster, feeling and appearing as one single unified diamond surface.
2. stoneLayout MUST specify: "Tight cluster of ${count} diamonds seated closely together with white rhodium filling all diamond gaps" or "Dense continuous line cluster with high-polish white rhodium gap fill".
3. setting MUST be: "Tight cluster with high-polish white rhodium plating filling all diamond gaps" or "Tight line cluster with bright-cut micro-prongs and rhodium fill".
4. imagePrompt MUST describe: "The ${count} diamonds are set close together in a dense cluster / line cluster with bright-cut white rhodium plating filling every gap between stones, creating the visual appearance of one solid, gapless, brilliant diamond surface."
Do NOT spread or scatter diamonds individually across open wire.`
    : '';

  const headShapeVarianceInstruction = isHeadVariance
    ? `\n\n*** CRITICAL 40%-50% HEAD SHAPE DIVERGENCE ***:
The head / centerpiece motif outline and silhouette MUST have a 40% to 50% geometric shape difference from the reference photo and across variations. Substantially transform the physical shape and contour of the head/cluster (for example, morphing a rounded or oval head into an angular geometric hexagon, an elongated marquise/navette apex, an asymmetric fluid petal curve, a pointed chevron crest, an open teardrop halo, or an interlocking crossover head) while strictly retaining the exact ${count} diamonds and lightweight wire construction.`
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

  const clusterHeader = isCluster
    ? `MANDATORY STONE SETTING REQUIREMENT: All ${count} round diamonds MUST be set tightly grouped together in a dense cluster or dense continuous line cluster. High-polish bright white rhodium plating seamlessly fills every gap between stones, making the diamonds and rhodium blend into one unified, gapless, radiant diamond cluster surface. Do NOT scatter or spread diamonds individually across open wire.\n`
    : '';

  const headShapeHeader = isHeadVariance
    ? `HEAD SILHOUETTE DIVERGENCE: Substantially transform the centerpiece head outline with 40%-50% geometric shape difference (angular hexagonal contour, fluid petal curve, pointed navette/chevron apex, or sculpted open loop) while retaining lightweight wire construction.\n`
    : '';

  const cleanMotif = motif.trim() || 'original jewellery motif';
  const cleanTreatment = variation.motifTreatment?.trim() || variation.name;

  const stoneLayoutText = isCluster
    ? `All ${count} diamonds grouped closely in a tight cluster or dense continuous line cluster with high-polish white rhodium filling diamond gaps seamlessly.`
    : variation.stoneLayout;

  const settingText = isCluster
    ? `Tight cluster setting with bright-cut white rhodium plating seamlessly filling all diamond gaps into one continuous diamond surface.`
    : variation.setting;

  return `${clusterHeader}${headShapeHeader}Jewellery design sketch: Draw ONE new fine jewellery piece in the SWA Diamonds design family.
Motif: ${cleanMotif} (${cleanTreatment}). Keep the motif theme instantly recognisable.
Design: ${variation.name} - ${variation.description}
Details: ${variation.imagePrompt}
Stones: EXACTLY ${count} round brilliant diamonds. Layout: ${stoneLayoutText}. Draw every diamond facet clearly with fine lines so each stone can be counted. No other stones.
Setting: ${settingText} Lightweight construction in thin gold wire (~1.0-1.2 mm).
Style: Professional high-end fine jewellery presentation sketch, fine pencil and ink lines on white paper with soft watercolour shading in gold and white rhodium. Centred, plain white background, single piece, no hands, no props, no text.`;
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
