/**
 * OpenRouter helpers for product text + image generation.
 */
import axios from 'axios';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const TEXT_MODEL = process.env.OPENROUTER_TEXT_MODEL || 'google/gemini-2.5-flash';
const IMAGE_MODEL = process.env.OPENROUTER_IMAGE_MODEL || 'google/gemini-2.5-flash-image';

function apiKey() {
  return process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY || '';
}

function headers() {
  return {
    Authorization: `Bearer ${apiKey()}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://errayhany.com',
    'X-Title': 'Errayhany Product Bot',
  };
}

function extractJson(text) {
  if (!text) return null;
  const cleaned = String(text).replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}

function extractImageBuffers(message) {
  const out = [];
  const content = message?.content;
  const images = message?.images || [];

  for (const img of images) {
    const url = img?.image_url?.url || img?.imageUrl?.url || img?.url;
    if (typeof url === 'string' && url.startsWith('data:image')) {
      const b64 = url.split(',')[1];
      if (b64) out.push(Buffer.from(b64, 'base64'));
    }
  }

  if (Array.isArray(content)) {
    for (const part of content) {
      const url = part?.image_url?.url || part?.imageUrl?.url;
      if (typeof url === 'string' && url.startsWith('data:image')) {
        const b64 = url.split(',')[1];
        if (b64) out.push(Buffer.from(b64, 'base64'));
      }
    }
  }

  return out;
}

export async function generateProductCopy({ imageBuffer, name, price, ref }) {
  const dataUrl = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
  const prompt = `Tu es un expert e-commerce Maroc (Jumia / vente en gros électronique).
Analyse la photo du produit et génère du contenu bilingue FR/AR.

Produit donné par le vendeur:
- Nom: ${name}
- Prix: ${price} MAD
- Référence: ${ref}

Réponds UNIQUEMENT en JSON valide avec exactement ces clés:
{
  "french_title": "titre FR SEO max 120 chars",
  "arabic_title": "عنوان عربي SEO max 120",
  "short_description_fr": "HTML <ul><li>...</li></ul> 3-5 bullets FR",
  "short_description_ar": "HTML <ul><li>...</li></ul> 3-5 bullets AR",
  "description_french": "description longue FR 80-160 mots",
  "description_arabic": "وصف مفصل عربي 80-160 كلمة",
  "meta_title": "meta title FR",
  "meta_description": "meta description FR max 160",
  "woo_title": "titre court Woo FR",
  "brand": "marque si visible sinon Generic",
  "color": "couleur principale ou Multicolore"
}`;

  const { data } = await axios.post(
    OPENROUTER_URL,
    {
      model: TEXT_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      temperature: 0.4,
    },
    { headers: headers(), timeout: 120000 }
  );

  const text = data?.choices?.[0]?.message?.content;
  const parsed = extractJson(typeof text === 'string' ? text : JSON.stringify(text));
  if (!parsed) throw new Error('OpenRouter text: invalid JSON');
  return parsed;
}

async function generateOneImage({ imageBuffer, prompt }) {
  const dataUrl = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
  const { data } = await axios.post(
    OPENROUTER_URL,
    {
      model: IMAGE_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      modalities: ['image', 'text'],
    },
    { headers: headers(), timeout: 180000 }
  );

  const message = data?.choices?.[0]?.message;
  const buffers = extractImageBuffers(message);
  if (!buffers.length) {
    throw new Error(`OpenRouter image empty: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return buffers[0];
}

/**
 * Returns 4 AI images: [clean, promo1, promo2, promo3]
 * Real photo is kept separately by caller as last image.
 */
export async function generateProductImages({ imageBuffer, titleFr, price }) {
  const base = `Use the product in the reference photo. Keep the same product shape/colors. Square ecommerce photo, studio lighting, white/light background.`;

  const prompts = [
    `${base}
Create IMAGE 1 — CLEAN SAMPLE:
- Minimal text (almost none)
- Product centered, premium look
- No busy badges, no heavy watermarks`,
    `${base}
Create IMAGE 2 — PROMO:
- Add elegant Arabic/French offer badges: "جملة" and price "${price} DH"
- Attractive marketplace style, not cluttered`,
    `${base}
Create IMAGE 3 — PROMO:
- Lifestyle/use-context with soft brand accents
- Small offer ribbon "Offre Grossiste / عرض جملة"`,
    `${base}
Create IMAGE 4 — PROMO:
- Feature callouts for product "${titleFr || 'Produit'}"
- Clear wholesale CTA style, Moroccan ecommerce`,
  ];

  const results = [];
  for (const prompt of prompts) {
    try {
      const buf = await generateOneImage({ imageBuffer, prompt });
      results.push(buf);
    } catch (e) {
      console.error('Image gen failed:', e.message);
      results.push(null);
    }
  }
  return results;
}

export function isOpenRouterConfigured() {
  return Boolean(apiKey());
}
