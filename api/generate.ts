import type { VercelRequest, VercelResponse } from '@vercel/node';
import 'dotenv/config';
import OpenAI from 'openai';

export const config = {
  maxDuration: 60,
};

export type Quality = 'low' | 'medium' | 'high';

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

function buildImagePrompt(
  variation: Variation,
  count: number,
  motif: string,
  metal = 'gold',
  clusterRhodiumFill = false,
  headShapeVariance = false,
  headLength?: number,
  headWidth?: number
): string {
  const isCluster =
    clusterRhodiumFill === true ||
    (clusterRhodiumFill as any) === 'true' ||
    (clusterRhodiumFill as any) === 1 ||
    (clusterRhodiumFill as any) === '1' ||
    Boolean(variation?.setting?.toLowerCase().includes('rhodium')) ||
    Boolean(variation?.setting?.toLowerCase().includes('cluster'));

  const isHeadVariance =
    headShapeVariance === true ||
    (headShapeVariance as any) === 'true' ||
    (headShapeVariance as any) === 1 ||
    (headShapeVariance as any) === '1';

  const clusterRhodiumText = isCluster
    ? ` Stone arrangement: The stones must be seated closely nearby like a tight cluster or in a line cluster. The diamonds are set in bright-cut white rhodium plating designed to seamlessly fill all diamond gaps, making the diamonds and rhodium feel like one unified diamond cluster surface.`
    : '';

  const headShapeText = isHeadVariance
    ? ` Head / Centerpiece Shape: Feature a distinct 40%-50% geometric shape difference in the head silhouette compared to conventional forms (e.g. bold geometric contour, asymmetric petal contour, pointed navette/chevron apex, or sculpted open loop).`
    : '';

  let dimensionsTopDirectives = '';
  let dimensionsDetailText = '';

  if (headLength && headWidth) {
    const minL = (headLength * 0.8).toFixed(1);
    const maxL = (headLength * 1.2).toFixed(1);
    const minW = (headWidth * 0.8).toFixed(1);
    const maxW = (headWidth * 1.2).toFixed(1);
    const ratio = headLength / headWidth;

    const shapeDirection = ratio > 1.25 ? 'elongated / slender' : ratio < 0.8 ? 'wide' : 'proportional';

    dimensionsTopDirectives = `CRITICAL MANDATORY REQUIREMENT — HEAD DIMENSION LIMITS (MAX 20% LIMIT):
The centerpiece head MUST be proportioned to Length: ${headLength} mm by Width: ${headWidth} mm (acceptable range: ${minL}–${maxL} mm length, ${minW}–${maxW} mm width; max 20% variation allowed, ${shapeDirection} silhouette).
Geometric square, rectangular, and faceted motifs are fully welcomed if the design qualifies, but the overall outer head dimensions MUST strictly conform to these ${headLength} x ${headWidth} mm limits (never expanding beyond the 20% limit of ${minL}–${maxL} mm length and ${minW}–${maxW} mm width).\n\n`;

    dimensionsDetailText = ` Head Dimensions: Centerpiece scaled to ${headLength} mm length by ${headWidth} mm width (strictly within ${minL}–${maxL} mm length, ${minW}–${maxW} mm width).`;
  }

  const cleanMotif = (motif || '').trim() || 'fine jewellery motif';
  const cleanTreatment = (variation.motifTreatment || '').trim() || variation.name;

  const metalDesc = metal.toLowerCase().includes('white')
    ? '18k white gold'
    : metal.toLowerCase().includes('rose')
    ? '18k rose gold'
    : metal.toLowerCase().includes('two')
    ? 'two-tone 18k yellow gold and white rhodium'
    : '18k yellow gold';

  return `${dimensionsTopDirectives}Draw a completely original, unique fine jewellery design sketch in the "${cleanMotif}" motif family.
Design Concept #${variation.index}: ${variation.name} - ${variation.description}${dimensionsDetailText}
Architectural Form & Distinctive Silhouette: ${variation.imagePrompt}${headShapeText}
Stones: EXACTLY ${count} round brilliant diamonds, uniquely arranged as: ${variation.stoneLayout}.${clusterRhodiumText} Draw every diamond clearly with facet lines so each one can be counted. No extra stones.
Setting: ${variation.setting}.${isCluster ? ' Stones seated in tight cluster or line cluster with white rhodium filling diamond gaps.' : ''} Lightweight construction in thin ${metalDesc} wire (~1.0-1.2 mm).
Style: professional high-jewellery design sketch, fine pencil and crisp ink linework on clean white textured paper with soft luminous watercolour shading in ${metalDesc} and white rhodium. Centered single piece, pure white background, no hands, no props, no text or watermarks.`;
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
    const {
      index,
      quality: qualityParam,
      variation,
      diamondCount = 10,
      motif = '',
      metal = 'gold',
      clusterRhodiumFill = false,
      headShapeVariance = false,
      headLength,
      headWidth,
    } = body || {};

    const isClusterRhodium =
      clusterRhodiumFill === true ||
      (clusterRhodiumFill as any) === 'true' ||
      (clusterRhodiumFill as any) === 1 ||
      (clusterRhodiumFill as any) === '1' ||
      Boolean(variation?.setting?.toLowerCase().includes('rhodium')) ||
      Boolean(variation?.setting?.toLowerCase().includes('cluster'));

    const isHeadVariance =
      headShapeVariance === true ||
      (headShapeVariance as any) === 'true' ||
      (headShapeVariance as any) === 1 ||
      (headShapeVariance as any) === '1';

    const safeVariation: Variation = variation || {
      index: Number(index) || 1,
      name: `Design Concept #${index || 1}`,
      description: 'Lightweight fine jewellery wire structure with sparkling diamond accents.',
      motifTreatment: motif || 'Fine jewellery motif',
      stoneCount: Number(diamondCount) || 10,
      stoneLayout: isClusterRhodium
        ? `Tight cluster of ${diamondCount || 10} diamonds with white rhodium filling all gaps`
        : `${diamondCount || 10} round diamonds in setting`,
      setting: isClusterRhodium ? 'Tight cluster with high-polish white rhodium gap fill' : 'Prong',
      sizeMm: '16 x 6',
      goldVsOriginal: 'about the same',
      imagePrompt: `Fine jewellery design sketch of concept #${index || 1} with ${diamondCount || 10} diamonds.`,
    };

    // Use fast gpt-image-2.5-flare by default for responsive generation; sunburst for high quality
    const defaultModel = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2.5-flare';
    const imageModel = qualityParam === 'high' ? 'gpt-image-2.5-sunburst' : defaultModel;
    const size = (process.env.IMAGE_SIZE as any) || '1024x1024';

    const count = Number(diamondCount) || safeVariation.stoneCount || 10;
    let numHeadLength = headLength ? Number(headLength) : undefined;
    let numHeadWidth = headWidth ? Number(headWidth) : undefined;

    // Fallback: parse dimensions from sizeMm if not passed directly
    if ((!numHeadLength || !numHeadWidth) && safeVariation.sizeMm) {
      const match = safeVariation.sizeMm.match(/([\d.]+)\s*[x×]\s*([\d.]+)/i);
      if (match) {
        numHeadLength = numHeadLength || parseFloat(match[1]);
        numHeadWidth = numHeadWidth || parseFloat(match[2]);
      }
    }

    const prompt = buildImagePrompt(
      safeVariation,
      count,
      motif,
      metal,
      isClusterRhodium,
      isHeadVariance,
      numHeadLength,
      numHeadWidth
    );

    const customKey =
      (req.headers['x-openai-key'] as string) ||
      body?.openaiApiKey ||
      undefined;

    const openai = getOpenAI(customKey);

    const imageBuffer = await withRetry(`generateCardImage #${index}`, async () => {
      try {
        const genResponse = await openai.images.generate({
          model: imageModel,
          prompt,
          size,
        });

        const b64 = genResponse.data?.[0]?.b64_json;
        if (b64) return b64;
        const url = genResponse.data?.[0]?.url;
        if (url) {
          const resp = await fetch(url);
          const arrayBuf = await resp.arrayBuffer();
          return Buffer.from(arrayBuf).toString('base64');
        }
        throw new Error('Images API response contained neither b64_json nor URL');
      } catch (err: any) {
        console.warn(`[Generate Warning] Model ${imageModel} error: ${err.message}. Retrying fallback...`);
        const fallbackModel = imageModel === 'gpt-image-2.5-flare' ? 'gpt-image-2.5-sunburst' : 'gpt-image-2.5-flare';
        const fallbackResponse = await openai.images.generate({
          model: fallbackModel,
          prompt,
          size,
        });
        const fallbackB64 = fallbackResponse.data?.[0]?.b64_json;
        if (fallbackB64) return fallbackB64;
        const fallbackUrl = fallbackResponse.data?.[0]?.url;
        if (fallbackUrl) {
          const resp = await fetch(fallbackUrl);
          const arrayBuf = await resp.arrayBuffer();
          return Buffer.from(arrayBuf).toString('base64');
        }
        throw err;
      }
    });

    return res.status(200).json({
      index,
      imageBase64: imageBuffer,
    });
  } catch (err: any) {
    console.error('[API generate Error]', err);
    return res.status(500).json({
      error: {
        code: err?.code || 'internal_error',
        message: err?.message || 'An error occurred during sketch generation.',
      },
    });
  }
}
