import type { VercelRequest, VercelResponse } from '@vercel/node';
import { toFile } from 'openai';
import {
  Quality,
  Variation,
  buildImagePrompt,
  getOpenAI,
  withRetry,
} from './_shared.js';

export const config = {
  maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-app-password');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method Not Allowed' } });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const {
      jobId,
      index,
      quality: qualityParam,
      variation,
      diamondCount = 10,
      motif = '',
      clusterRhodiumFill = false,
      headShapeVariance = false,
      photoBase64,
    } = body || {};

    if (!variation) {
      return res.status(400).json({ error: { message: 'Variation details required' } });
    }

    const imageModel = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2.5-sunburst';
    const size = (process.env.IMAGE_SIZE as any) || '1024x1024';
    const quality = (qualityParam || process.env.IMAGE_QUALITY || 'medium') as Quality;

    const count = diamondCount || variation.stoneCount || 10;
    const prompt = buildImagePrompt(variation as Variation, count, motif, clusterRhodiumFill, headShapeVariance);

    const cleanBase64 = photoBase64 ? photoBase64.replace(/^data:image\/[a-z]+;base64,/, '') : '';

    const imageBuffer = await withRetry(`generateCardImage #${index}`, async () => {
      try {
        if (cleanBase64) {
          const buffer = Buffer.from(cleanBase64, 'base64');
          const file = await toFile(buffer, 'reference_photo.png', { type: 'image/png' });
          const editResponse = await getOpenAI().images.edit({
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
          // Text-to-image generator if reference photo not attached
          const genResponse = await getOpenAI().images.generate({
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
        // Fallback to flare if sunburst encounters an issue
        if (cleanBase64) {
          const buffer = Buffer.from(cleanBase64, 'base64');
          const file = await toFile(buffer, 'reference_photo.png', { type: 'image/png' });
          const flareResponse = await getOpenAI().images.edit({
            model: 'gpt-image-2.5-flare',
            image: file,
            prompt,
            size,
          });
          const flareB64 = flareResponse.data?.[0]?.b64_json;
          if (flareB64) return flareB64;
        } else {
          const flareResponse = await getOpenAI().images.generate({
            model: 'gpt-image-2.5-flare',
            prompt,
            size,
          });
          const flareB64 = flareResponse.data?.[0]?.b64_json;
          if (flareB64) return flareB64;
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
