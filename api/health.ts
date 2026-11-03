import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({
    ok: true,
    service: 'jewellery-variation-studio',
    model: process.env.OPENAI_TEXT_MODEL || 'gpt-4o',
    imageModel: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2.5-sunburst',
    time: new Date().toISOString(),
  });
}
