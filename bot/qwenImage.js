import axios from 'axios';
import { normalizeCatalogImage } from './imageNormalize.js';

const QWEN_IMAGE_URL = (
  process.env.QWEN_IMAGE_URL
  || 'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
).trim();

function apiKey() {
  return String(process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY || '').trim();
}

export function isQwenImageConfigured() {
  return Boolean(apiKey());
}

/**
 * Optional secondary studio render. Failure is intentionally non-fatal:
 * Gemini remains primary and this output joins Telegram gallery approval.
 */
export async function generateQwenProductImage({ imageBuffers = [], title = 'Produit' } = {}) {
  if (!isQwenImageConfigured()) return null;
  const refs = imageBuffers.filter(Boolean).slice(0, 3);
  if (!refs.length) return null;

  const content = refs.map((buffer) => ({
    image: `data:image/jpeg;base64,${buffer.toString('base64')}`,
  }));
  content.push({
    text: `Create one professional ecommerce studio image for "${title}".
Use the input photos as the exact product identity. Preserve its shape, colors,
ports, logos, labels and accessories. Place only the product on a seamless pure
white background with realistic soft lighting and a subtle product-shaped shadow.
Centered square catalog composition. No hands, clutter, packaging frame, added
objects, text, price, badge, watermark, deformation or duplicate product.`,
  });

  const { data } = await axios.post(
    QWEN_IMAGE_URL,
    {
      model: process.env.QWEN_IMAGE_MODEL || 'qwen-image-2.0',
      input: { messages: [{ role: 'user', content }] },
      parameters: {
        n: 1,
        size: '1024*1024',
        prompt_extend: true,
        watermark: false,
        negative_prompt: 'low quality, blur, distortion, extra objects, text, watermark, frame shadow',
      },
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        'Content-Type': 'application/json',
      },
      timeout: Number(process.env.QWEN_IMAGE_TIMEOUT_MS || 120000),
      maxBodyLength: Infinity,
    },
  );

  const outputUrl = data?.output?.choices?.[0]?.message?.content
    ?.find((part) => typeof part?.image === 'string')?.image;
  if (!outputUrl) throw new Error('Qwen image response did not contain an output URL');

  const response = await axios.get(outputUrl, {
    responseType: 'arraybuffer',
    timeout: 60000,
    maxContentLength: 20 * 1024 * 1024,
  });
  return normalizeCatalogImage(Buffer.from(response.data), { size: 1080 });
}
