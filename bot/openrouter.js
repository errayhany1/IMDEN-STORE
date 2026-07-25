/**
 * OpenRouter helpers for product text + image generation.
 */
import axios from 'axios';
import { normalizeCatalogImages } from './imageNormalize.js';
import { getActiveTemplatesForProduct } from './imageTemplates.js';

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

  const { data } = await axios.post(
    OPENROUTER_URL,
    {
      model: TEXT_MODEL,
      messages: [{ role: 'user', content }],
      temperature: 0.4,
    },
    { headers: headers(), timeout: 45000 }
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

  const { data } = await axios.post(
    OPENROUTER_URL,
    {
      model: TEXT_MODEL,
      messages: [{ role: 'user', content }],
      temperature: 0,
    },
    { headers: headers(), timeout: 45000 }
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
 * Returns AI product images from seller reference photo(s), using the
 * active catalog templates, then normalized to a fixed square size.
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

  const productLabel = titleFr || 'Produit';
  const templates = getActiveTemplatesForProduct({ oldPrice });
  const base = `You are a professional ecommerce product photographer for a Moroccan wholesale catalog (Errayhany).
Use the product shown in the reference photo(s) as the ONLY product.
Keep the same product identity: shape, color, ports, proportions, branding marks.
Do NOT invent a different product. Do NOT add unrelated objects.
Output MUST be a square 1:1 high-end marketplace photo, sharp focus, soft studio lighting.
Exact framing: product centered, consistent margins on all sides.`;

  // Prefer selected templates; fall back to classic prompts if none loaded.
  const prompts = templates.length
    ? templates.map((tpl) => `${base}\n${tpl.prompt({ title: productLabel, price, oldPrice })}`)
    : mode === 'amazon'
      ? [
        `${base}\nCLEAN STUDIO white background, no text.`,
        `${base}\nWHOLESALE PROMO with جملة and ${price} DH.`,
      ]
      : [
        `${base}\nPROFESSIONAL STUDIO HERO, white background, no text.`,
        `${base}\nANGLE / DETAIL, same studio look, no text.`,
      ];

  const defaultCount = Math.min(prompts.length, Number(process.env.AI_IMAGE_COUNT || 2));
  const limited = prompts.slice(0, defaultCount);
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

  if (!results.some(Boolean) && prompts[0]) {
    try {
      const buf = await generateOneImage({ imageBuffers: refs, prompt: prompts[0] });
      results[0] = buf;
    } catch (e) {
      console.error('Hero image retry failed:', e.message);
    }
  }

  const raw = results.filter(Boolean);
  return normalizeCatalogImages(raw);
}

export function isOpenRouterConfigured() {
  return Boolean(apiKey());
}
