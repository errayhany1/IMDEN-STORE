/**
 * OpenRouter helpers for product text + image generation.
 */
import axios from 'axios';
import { normalizeCatalogImages } from './imageNormalize.js';
import { composeWhiteStudioProduct } from './studioImage.js';

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

/**
 * Turn an axios error into a human-readable reason that names the real cause
 * (invalid key, insufficient credits, rate limit, model error…) instead of the
 * opaque "Request failed with status code 401".
 */
function describeApiError(e) {
  const status = e?.response?.status;
  const body = e?.response?.data;
  const providerMsg =
    body?.error?.message ||
    (typeof body?.error === 'string' ? body.error : '') ||
    body?.message ||
    (typeof body === 'string' ? body : '');
  if (status && providerMsg) return `OpenRouter ${status}: ${String(providerMsg).slice(0, 220)}`;
  if (status) return `OpenRouter ${status}: ${JSON.stringify(body || {}).slice(0, 220)}`;
  if (e?.code === 'ECONNABORTED') return `OpenRouter timeout: ${e.message}`;
  return e?.message || 'unknown OpenRouter error';
}

/**
 * Single entry point for OpenRouter chat calls. Surfaces the real failure
 * reason and also catches the case where OpenRouter answers HTTP 200 but the
 * body carries an { error } object (provider outages, moderation, no credits) —
 * previously this slipped through and later blew up as "invalid JSON" / "image
 * empty", hiding the true cause.
 */
async function callOpenRouter(payload, { timeout = 45000 } = {}) {
  if (!isOpenRouterConfigured()) {
    throw new Error('OPENROUTER_API_KEY missing');
  }
  let data;
  try {
    ({ data } = await axios.post(OPENROUTER_URL, payload, { headers: headers(), timeout }));
  } catch (e) {
    throw new Error(describeApiError(e));
  }
  if (data?.error) {
    const msg = data.error.message || (typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
    throw new Error(`OpenRouter error: ${String(msg).slice(0, 220)}`);
  }
  return data;
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

export async function generateProductCopy({
  imageBuffer,
  imageBuffers,
  name,
  price,
  ref,
  amazonMeta = null,
}) {
  const amazonBlock = amazonMeta
    ? `
Données Amazon (source produit):
- Titre Amazon: ${amazonMeta.title || ''}
- ASIN: ${amazonMeta.asin || ''}
- Features: ${(amazonMeta.features || []).slice(0, 8).join(' | ')}
- Description: ${String(amazonMeta.description || '').slice(0, 1200)}
`
    : '';
  const prompt = `Tu es un expert e-commerce Maroc (Jumia / vente en gros électronique).
Analyse ${amazonMeta ? 'les données Amazon + ' : ''}toutes les photos du produit et génère du contenu bilingue FR/AR.

Produit donné par le vendeur:
- Nom: ${name}
- Prix: ${price} MAD
- Référence: ${ref}
${amazonBlock}
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
  "color": "couleur principale ou Multicolore",
  "barcode": "code-barres exact visible sur une photo, sinon chaîne vide"
}`;

  const content = [{ type: 'text', text: prompt }];
  const refs = (imageBuffers?.length ? imageBuffers : [imageBuffer])
    .filter(Boolean)
    .slice(0, 4);
  for (const buffer of refs) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${buffer.toString('base64')}` },
    });
  }

  const data = await callOpenRouter(
    {
      model: TEXT_MODEL,
      messages: [{ role: 'user', content }],
      temperature: 0.4,
    },
    { timeout: 45000 }
  );

  const text = data?.choices?.[0]?.message?.content;
  const parsed = extractJson(typeof text === 'string' ? text : JSON.stringify(text));
  if (!parsed) throw new Error('OpenRouter text: invalid JSON');
  return parsed;
}

/**
 * Lightweight vision pass for the Tifawt-only path. It never generates copy or
 * new images; it only reads a clearly visible barcode from up to four photos.
 */
export async function detectProductBarcode(imageBuffers = []) {
  if (!isOpenRouterConfigured()) return '';
  const refs = imageBuffers.filter(Boolean).slice(0, 4);
  if (!refs.length) return '';

  const content = [{
    type: 'text',
    text: `Inspect all product photos and read the barcode printed on the product or packaging.
Return ONLY valid JSON: {"barcode":"..."}.
Copy every visible character exactly. Never guess. If no barcode is clearly readable, return {"barcode":""}.`,
  }];
  for (const buffer of refs) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${buffer.toString('base64')}` },
    });
  }

  const data = await callOpenRouter(
    {
      model: TEXT_MODEL,
      messages: [{ role: 'user', content }],
      temperature: 0,
    },
    { timeout: 45000 }
  );
  const text = data?.choices?.[0]?.message?.content;
  const parsed = extractJson(typeof text === 'string' ? text : JSON.stringify(text));
  return String(parsed?.barcode || '').trim().replace(/[^a-zA-Z0-9-]/g, '').slice(0, 64);
}

async function generateOneImage({ imageBuffers, prompt }) {
  const refs = (imageBuffers || []).filter(Boolean).slice(0, 4);
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

  const data = await callOpenRouter(
    {
      model: IMAGE_MODEL,
      messages: [{ role: 'user', content }],
      modalities: ['image', 'text'],
    },
    { timeout: 60000 }
  );

  const message = data?.choices?.[0]?.message;
  const buffers = extractImageBuffers(message);
  if (!buffers.length) {
    throw new Error(`OpenRouter image empty: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return buffers[0];
}

/**
 * Returns website-ready product images:
 * 1) AI cleans the product (white plate)
 * 2) We trim margins, enlarge to fill the square, and add soft studio shadows
 *
 * @param {{
 *   imageBuffer?: Buffer,
 *   imageBuffers?: Buffer[],
 *   titleFr?: string,
 *   price?: number|string,
 *   oldPrice?: number|string,
 *   mode?: 'amazon'|'photo',
 * }} opts
 */
export async function generateProductImages({
  imageBuffer,
  imageBuffers,
  titleFr,
  price,
  oldPrice,
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

  const cutoutCount = Math.min(
    Number(process.env.AI_IMAGE_COUNT || 2),
    3
  );

  const base = `You are a professional ecommerce product photographer for Errayhany (Morocco wholesale).
Use the product in the reference photo(s) as the ONLY product.
Keep exact identity: shape, color, ports, branding marks. Do NOT invent a different product.
Output a square 1:1 photo on a PLAIN seamless WHITE background.
The product must FILL the frame (about 85–90% of the image) — large, centered, tight crop, minimal empty margins.
Soft realistic studio lighting and a soft natural contact shadow under the product.
No text, no badges, no props, no hands, no clutter, no colored backdrop.`;

  const angleHints = [
    'Front / hero angle, product filling the frame.',
    'Slight 3/4 alternate angle or useful detail view, same white background, product still fills the frame.',
  ];

  const cutouts = [];
  let lastError = null;
  for (let i = 0; i < cutoutCount; i++) {
    const prompt = `${base}\n${angleHints[i % angleHints.length]}${titleFr ? `\nProduct: ${titleFr}` : ''}\nMode hint: ${mode}.`;
    try {
      const buf = await generateOneImage({ imageBuffers: refs, prompt });
      if (buf) cutouts.push(buf);
    } catch (e) {
      lastError = e;
      console.error('Cutout image gen failed:', e.message);
    }
  }

  if (!cutouts.length) {
    try {
      const buf = await generateOneImage({ imageBuffers: refs, prompt: `${base}\nFront hero, fill the frame.` });
      if (buf) cutouts.push(buf);
    } catch (e) {
      lastError = e;
      console.error('Cutout retry failed:', e.message);
    }
  }

  // Surface the real reason (auth, credits, rate limit, moderation…) instead of
  // silently returning an empty gallery, so the caller can report it to the user.
  if (!cutouts.length) {
    throw new Error(lastError ? lastError.message : 'OpenRouter returned no product image');
  }

  const clean = await normalizeCatalogImages(cutouts);
  const finished = [];
  for (const cutout of clean) {
    try {
      finished.push(await composeWhiteStudioProduct(cutout, { price, oldPrice }));
    } catch (e) {
      console.error('White studio finish failed:', e.message);
      finished.push(cutout);
    }
  }
  return finished;
}

export function isOpenRouterConfigured() {
  return Boolean(apiKey());
}
