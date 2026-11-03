import type { VercelRequest, VercelResponse } from '@vercel/node';
import 'dotenv/config';
import OpenAI, { toFile } from 'openai';

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
  clusterRhodiumFill = false,
  headShapeVariance = false,
  metal = 'gold'
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

  const clusterHeader = isCluster
    ? `CRITICAL STONE SETTING & RHODIUM FILL REQUIREMENT:
The user requires Close Cluster & White Rhodium Gap Fill. The stones need to be seated nearby like a tight cluster or in a line cluster, feeling as one part with diamonds set in high-polish white rhodium to seamlessly fill the diamond gap.
ALL ${count} round diamonds MUST be set packed tightly together in a dense cluster or continuous line cluster. High-polish bright white rhodium plating seamlessly fills all gaps between the stones, unifying them into one solid, continuous, sparkling diamond surface. Do NOT scatter or spread diamonds individually across open wire.\n`
    : '';

  const headShapeHeader = isHeadVariance
    ? `MANDATORY 40%-50% HEAD SILHOUETTE TRANSFORMATION:
DO NOT replicate the shape or head contour of the reference photo. Draw a dramatic 40% to 50% transformed centerpiece silhouette: ${variation.name} - ${variation.description}.
Sculpt this distinct geometric head outline with lightweight, airy wire architecture.\n`
    : '';

  const cleanMotif = (motif || '').trim() || 'fine jewellery motif';
  const cleanTreatment = (variation.motifTreatment || '').trim() || variation.name;

  const stoneLayoutText = isCluster
    ? `All ${count} diamonds grouped closely in a tight cluster with high-polish white rhodium seamlessly filling every diamond gap.`
    : variation.stoneLayout;

  const settingText = isCluster
    ? `Tight cluster setting with high-polish bright white rhodium plating seamlessly filling all diamond gaps into one continuous radiant diamond surface.`
    : variation.setting;

  let detailsText = variation.imagePrompt || '';
  if (isCluster && !detailsText.toLowerCase().includes('rhodium')) {
    detailsText = `Tight cluster setting with white rhodium gap fill: The ${count} stones are seated nearby in a dense cluster, feeling as one part with high-polish white rhodium seamlessly filling the diamond gaps. ${detailsText}`;
  }

  const metalText = metal && metal !== 'same' ? `${metal} with white rhodium accents` : '18K gold with white rhodium accents';

  return `${clusterHeader}${headShapeHeader}Jewellery design sketch: Draw ONE new fine jewellery piece in the SWA Diamonds design family.
Motif Family: ${cleanMotif} (${cleanTreatment}).
Design: ${variation.name} - ${variation.description}
Head Silhouette & Architecture: ${detailsText}
Metal: ${metalText}, lightweight construction in thin wire (~1.0-1.2 mm).
Stones: EXACTLY ${count} round brilliant diamonds. Layout: ${stoneLayoutText}. Draw every diamond facet clearly with fine lines so each stone can be counted. No other stones.
Setting: ${settingText}
Style: Professional high-end fine jewellery presentation sketch, fine pencil and ink lines on white paper with soft watercolour shading in gold and white rhodium. Centred, plain white background, single piece, no hands, no props, no text.`;
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
      photoBase64,
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

    const imageModel = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2.5-sunburst';
    const size = (process.env.IMAGE_SIZE as any) || '1024x1024';

    const count = Number(diamondCount) || safeVariation.stoneCount || 10;
    const prompt = buildImagePrompt(safeVariation, count, motif, isClusterRhodium, isHeadVariance, metal);

    const cleanBase64 = photoBase64 ? photoBase64.replace(/^data:image\/[a-z]+;base64,/, '') : '';

    const customKey =
      (req.headers['x-openai-key'] as string) ||
      body?.openaiApiKey ||
      undefined;

    const openai = getOpenAI(customKey);

    const imageBuffer = await withRetry(`generateCardImage #${index}`, async () => {
      try {
        // If 40%-50% Head Shape Difference is enabled, generate fresh sketch from scratch
        // so it does NOT copy the reference photo's silhouette (which would only give 5%-10% change).
        // If headShapeVariance is false and a reference photo exists, use images.edit.
        const shouldUseEdit = Boolean(cleanBase64 && !isHeadVariance);

        if (shouldUseEdit) {
          const buffer = Buffer.from(cleanBase64, 'base64');
          const file = await toFile(buffer, 'reference_photo.png', { type: 'image/png' });
          const editResponse = await openai.images.edit({
            model: imageModel,
            image: file,
            prompt,
            size,
          });

          const b64 = editResponse.data?.[0]?.b64_json;
          if (b64) return b64;
          const url = editResponse.data?.[0]?.url;
          if (url) {
            const resp = await fetch(url);
            const arrayBuf = await resp.arrayBuffer();
            return Buffer.from(arrayBuf).toString('base64');
          }
        } else {
          // Fresh sketch generation embodying the 40%-50% transformed silhouette
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
        }
        throw new Error('Images API response contained neither b64_json nor URL');
      } catch (err: any) {
        console.warn(`[Generate Warning] Model ${imageModel} error: ${err.message}. Retrying fallback...`);
        const shouldUseEditFallback = Boolean(cleanBase64 && !isHeadVariance);
        if (shouldUseEditFallback) {
          const buffer = Buffer.from(cleanBase64, 'base64');
          const file = await toFile(buffer, 'reference_photo.png', { type: 'image/png' });
          const flareResponse = await openai.images.edit({
            model: 'gpt-image-2.5-flare',
            image: file,
            prompt,
            size,
          });
          const flareB64 = flareResponse.data?.[0]?.b64_json;
          if (flareB64) return flareB64;
          const flareUrl = flareResponse.data?.[0]?.url;
          if (flareUrl) {
            const resp = await fetch(flareUrl);
            const arrayBuf = await resp.arrayBuffer();
            return Buffer.from(arrayBuf).toString('base64');
          }
        } else {
          const flareResponse = await openai.images.generate({
            model: 'gpt-image-2.5-flare',
            prompt,
            size,
          });
          const flareB64 = flareResponse.data?.[0]?.b64_json;
          if (flareB64) return flareB64;
          const flareUrl = flareResponse.data?.[0]?.url;
          if (flareUrl) {
            const resp = await fetch(flareUrl);
            const arrayBuf = await resp.arrayBuffer();
            return Buffer.from(arrayBuf).toString('base64');
          }
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
