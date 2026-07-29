/**
 * OpenRouter helpers for product text + image generation.
 */
import axios from 'axios';
import { normalizeCatalogImages } from './imageNormalize.js';
import { composeWhiteStudioProduct } from './studioImage.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const TEXT_MODEL = process.env.OPENROUTER_TEXT_MODEL || 'google/gemini-2.5-flash';
// Lite is substantially cheaper and one generation is enough: deterministic
// Sharp post-processing handles crop/background/shadow after the model call.
const IMAGE_MODEL = process.env.OPENROUTER_IMAGE_MODEL || 'google/gemini-3.1-flash-lite-image';

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
  "barcode": "code-barres exact visible sur une photo, sinon chaîne vide",
  "packaging_specs": ["spec lue sur la boîte 1", "spec 2", "spec 3", "spec 4", "spec 5", "spec 6"]
}
Règles packaging_specs:
- Lis le TEXTE visible sur l'emballage / la boîte / les étiquettes (modèle, RGB, USB-C, voltage, autonomie, dimensions, features…).
- Français ou anglais court, max 6 lignes, factuelles uniquement.
- Si peu de texte lisible, déduis 3-5 specs techniques évidentes du produit photographié.
- N'invente pas de certifications ou chiffres absents de la photo.`;

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
      response_format: { type: 'json_object' },
      max_tokens: 1800,
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
      response_format: { type: 'json_object' },
      max_tokens: 120,
    },
    { headers: headers(), timeout: 45000 }
  );
  const text = data?.choices?.[0]?.message?.content;
  const parsed = extractJson(typeof text === 'string' ? text : JSON.stringify(text));
  return String(parsed?.barcode || '').trim().replace(/[^a-zA-Z0-9-]/g, '').slice(0, 64);
}

async function generateOneImage({ imageBuffers, prompt }) {
  // Two references are enough to preserve identity while avoiding the image
  // token cost of sending the whole Telegram album to the generation model.
  const refs = (imageBuffers || []).filter(Boolean).slice(0, 2);
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
      image_config: { aspect_ratio: '1:1' },
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
 * Returns exactly one website-ready product image:
 * 1) AI isolates the product once
 * 2) deterministic code removes the white plate, crops it, and adds one
 *    silhouette-following contact shadow
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

  const base = `You are a professional ecommerce product photographer for Errayhany (Morocco wholesale).
Use the product in the reference photo(s) as the ONLY product.
Keep exact identity: shape, color, ports, logos, button labels, branding marks. Do NOT invent a different product.
If the reference shows PACKAGING / a cardboard BOX: recreate the REAL PRODUCT illustrated on the box (the device itself), NOT the box — clean packshot like premium Jumia listings (remotes, gadgets on pure white).
Output a square 1:1 photo on a PLAIN seamless WHITE background (#FFFFFF only).
CRITICAL framing: the product must FILL about 82–90% of the frame but must NOT touch any edge.
Center the product. Use even realistic studio lighting.
NO SHADOW and NO frame: do not add a rectangular/card shadow, drop shadow, floor shadow, glow, border, panel, platform, table, or grey background. Our software adds the final subtle product-shaped shadow later.
No text overlays, no badges, no props, no hands, no clutter, no colored backdrop.`;

  const prompt = `${base}
Hero packshot: front or clearest catalog angle, exact same product only.${titleFr ? `\nProduct: ${titleFr}` : ''}
Mode hint: ${mode}. Return one image only.`;

  try {
    const generated = await generateOneImage({ imageBuffers: refs, prompt });
    const [clean] = await normalizeCatalogImages([generated]);
    if (!clean) return [];
    // Do not retry a rejected image: retries double spend and commonly repeat
    // the same defect. The existing gallery approval keeps raw photos safe.
    return [await composeWhiteStudioProduct(clean, { price, oldPrice })];
  } catch (e) {
    console.error('Single studio image generation rejected:', e.message);
    return [];
  }
}

export function isOpenRouterConfigured() {
  return Boolean(apiKey());
}
