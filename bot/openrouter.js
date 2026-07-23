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
    { headers: headers(), timeout: 45000 }
  );

  const text = data?.choices?.[0]?.message?.content;
  const parsed = extractJson(typeof text === 'string' ? text : JSON.stringify(text));
  if (!parsed) throw new Error('OpenRouter text: invalid JSON');
  return parsed;
}

async function generateOneImage({ imageBuffers, prompt }) {
  const refs = (imageBuffers || []).filter(Boolean).slice(0, 3);
  if (!refs.length) {
    throw new Error('No reference images for AI generation');
  }

  const content = [{ type: 'text', text: prompt }];
  for (const buf of refs) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${buf.toString('base64')}` },
    });
  }

  const { data } = await axios.post(
    OPENROUTER_URL,
    {
      model: IMAGE_MODEL,
      messages: [{ role: 'user', content }],
      modalities: ['image', 'text'],
    },
    { headers: headers(), timeout: 60000 }
  );

  const message = data?.choices?.[0]?.message;
  const buffers = extractImageBuffers(message);
  if (!buffers.length) {
    throw new Error(`OpenRouter image empty: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return buffers[0];
}

/**
 * Returns AI product images from seller reference photo(s).
 * Caller keeps the real photo separately as the last gallery image.
 *
 * @param {{ imageBuffer?: Buffer, imageBuffers?: Buffer[], titleFr?: string, price?: number|string, mode?: 'amazon'|'photo' }} opts
 */
export async function generateProductImages({
  imageBuffer,
  imageBuffers,
  titleFr,
  price,
  mode = 'photo',
}) {
  if (!isOpenRouterConfigured()) {
    throw new Error('OPENROUTER_API_KEY missing — cannot generate professional product images');
  }

  const refs = (imageBuffers && imageBuffers.length)
    ? imageBuffers.filter(Boolean)
    : (imageBuffer ? [imageBuffer] : []);
  if (!refs.length) {
    throw new Error('No reference photo for AI image generation');
  }

  const productLabel = titleFr || 'Produit';
  const base = `You are a professional ecommerce product photographer for a Moroccan wholesale catalog (Errayhany).
Use the product shown in the reference photo(s) as the ONLY product.
Keep the same product identity: shape, color, ports, proportions, branding marks.
Do NOT invent a different product. Do NOT add unrelated objects.
Output a square high-end marketplace photo, sharp focus, soft studio lighting.`;

  const prompts = mode === 'amazon'
    ? [
      `${base}
Create IMAGE 1 — CLEAN STUDIO:
- Pure white / very light seamless background
- Product centered, premium catalog look
- No text, no badges, no watermarks, no logos added`,
      `${base}
Create IMAGE 2 — WHOLESALE PROMO:
- Same product, clean studio base
- Subtle elegant badges only: "جملة" and "${price} DH"
- Not cluttered, marketplace-ready`,
    ]
    : [
      `${base}
Create IMAGE 1 — PROFESSIONAL STUDIO HERO (mandatory):
- Clean white seamless background
- Centered hero product shot, commercial catalog quality
- Remove messy background / hands / clutter from the reference if present
- Keep realistic materials and true colors
- No text, no price tags, no watermarks`,
      `${base}
Create IMAGE 2 — ANGLE / DETAIL:
- Same product, slight alternate angle or useful detail view
- Same studio lighting and white background
- No text overlays`,
      `${base}
Create IMAGE 3 — WHOLESALE CARD:
- Same product on clean studio background
- Small elegant offer accents: "جملة" + "${price} DH"
- Title hint for "${productLabel}" only if it stays readable and minimal`,
    ];

  // Photo-only path needs at least 1 professional image; keep count modest for bot stability.
  const defaultCount = mode === 'amazon' ? 2 : 2;
  const limited = prompts.slice(0, Number(process.env.AI_IMAGE_COUNT || defaultCount));
  const results = [];
  for (const prompt of limited) {
    try {
      const buf = await generateOneImage({ imageBuffers: refs, prompt });
      results.push(buf);
    } catch (e) {
      console.error('Image gen failed:', e.message);
      results.push(null);
    }
  }

  // Ensure at least one successful image when possible: one retry on the hero prompt.
  if (!results.some(Boolean)) {
    try {
      const buf = await generateOneImage({ imageBuffers: refs, prompt: prompts[0] });
      results[0] = buf;
    } catch (e) {
      console.error('Hero image retry failed:', e.message);
    }
  }

  return results.filter(Boolean);
}

export function isOpenRouterConfigured() {
  return Boolean(apiKey());
}
