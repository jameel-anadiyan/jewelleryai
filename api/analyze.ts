import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import {
  OriginalAnalysis,
  Variation,
  getAnalysisSystemPrompt,
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
    let {
      photoBase64,
      mimeType = 'image/jpeg',
      diamondCount = 10,
      countFor = 'piece',
      sku = '',
      stoneSize = '',
      metal = 'same',
      mustKeep = '',
      quality = 'medium',
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

    const customKey =
      (req.headers['x-openai-key'] as string) ||
      body?.openaiApiKey ||
      undefined;

    const openai = getOpenAI(customKey);

    const clusterRhodiumNote = clusterRhodiumFill
      ? ' MANDATORY SETTING: Diamonds seated closely in a tight cluster or line cluster, white rhodium filling diamond gaps seamlessly as one unified diamond surface.'
      : '';

    const headShapeVarianceNote = headShapeVariance
      ? ' MANDATORY SETTING: 40%-50% geometric shape difference in the head silhouette across designs.'
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
        text: `Analyze this reference jewellery item. Diamond count per piece: ${perPieceCount} (total entered: ${diamondCount}, for: ${countFor}). SKU: ${sku || 'None'}. Stone size: ${stoneSize || 'estimate'}. Metal request: ${metal || 'same as photo'}. Must keep: ${mustKeep || 'none'}.${clusterRhodiumNote}${headShapeVarianceNote} Generate original summary and variations 1 to 25. Return valid JSON.`,
      },
      imagePart,
    ];

    const userPromptBatch2 = [
      {
        type: 'text' as const,
        text: `Based on this reference jewellery item with diamond count per piece: ${perPieceCount}. Metal: ${metal || 'same'}.${clusterRhodiumNote}${headShapeVarianceNote} Generate variations 26 to 50 exploring alternative geometric, asymmetric, and sculpted modern wirework variations. Return valid JSON.`,
      },
      imagePart,
    ];

    // Execute both batches in parallel for high speed and to stay well under Vercel's timeout
    const fetchBatch1 = async () => {
      const response = await openai.chat.completions.create({
        model: textModel,
        messages: [
          { role: 'system', content: getAnalysisSystemPrompt(perPieceCount, 1, clusterRhodiumFill, headShapeVariance) },
          { role: 'user', content: userPromptBatch1 },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      });
      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No content returned for batch 1');
      return JSON.parse(content);
    };

    const fetchBatch2 = async () => {
      const response = await openai.chat.completions.create({
        model: textModel,
        messages: [
          { role: 'system', content: getAnalysisSystemPrompt(perPieceCount, 2, clusterRhodiumFill, headShapeVariance) },
          { role: 'user', content: userPromptBatch2 },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.75,
      });
      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No content returned for batch 2');
      return JSON.parse(content);
    };

    const [data1, data2] = await withRetry('analyze50Variations', () => Promise.all([fetchBatch1(), fetchBatch2()]));

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

    // Ensure we have 50 variations with proper indices and defaults
    const finalVariations: Variation[] = combinedRaw.slice(0, 50).map((v, i) => ({
      index: i + 1,
      name: v.name || `Design Concept ${i + 1}`,
      description: v.description || 'Lightweight fine jewellery wire structure with sparkling diamond accents.',
      motifTreatment: v.motifTreatment || original.motif || '',
      stoneCount: perPieceCount,
      stoneLayout: v.stoneLayout || `${perPieceCount} round diamonds in refined wire setting`,
      setting: v.setting || (clusterRhodiumFill ? 'Tight cluster / line cluster with rhodium fill' : 'Prong'),
      sizeMm: v.sizeMm || '16 x 6',
      goldVsOriginal: v.goldVsOriginal || 'about the same',
      imagePrompt: v.imagePrompt || `Fine jewellery sketch of ${v.name || 'ring'} with ${perPieceCount} diamonds.`,
    }));

    // If fewer than 50 were returned by the LLM, synthesize remaining to guarantee 50
    while (finalVariations.length < 50) {
      const idx = finalVariations.length + 1;
      finalVariations.push({
        index: idx,
        name: `Silhouette Accent ${idx}`,
        description: `Fluid geometric wire variation interpreting the ${original.motif || 'core'} motif.`,
        motifTreatment: `Modern wire accent ${idx}`,
        stoneCount: perPieceCount,
        stoneLayout: `${perPieceCount} round diamonds placed along the curve`,
        setting: clusterRhodiumFill ? 'Tight cluster with rhodium gap fill' : 'Micro-prong',
        sizeMm: '16 x 5',
        goldVsOriginal: 'lighter',
        imagePrompt: `Professional fine jewellery design sketch of ${original.motif} with ${perPieceCount} round brilliant diamonds.`,
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
      clusterRhodiumFill,
      headShapeVariance,
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
