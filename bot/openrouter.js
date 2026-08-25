/**
 * OpenRouter helpers for product text + image generation.
 */
import axios from 'axios';
import { normalizeCatalogImages } from './imageNormalize.js';
import { getBotSetting } from './runtimeSettings.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
// Gemini 2.5 produced the original AQ10/AQ3 professional studio results.
const textModel = () => getBotSetting('openrouterTextModel');
const imageModel = () => getBotSetting('openrouterImageModel');
const factsModel = () => getBotSetting('openrouterFactsModel') || textModel();

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
  const amazonRewriteRules = amazonMeta
    ? `
Règles impératives de réécriture Amazon:
- Utilise Amazon uniquement pour les faits techniques du produit. Réécris le contenu entièrement, sans copier ses formulations commerciales.
- Retire pays, villes, marchés étrangers, vendeur, boutique, Amazon, Prime et disponibilité.
- N'inclus aucun prix, devise ou symbole monétaire (USD, dollar, EUR, euro, GBP, etc.); le prix MAD est géré séparément.
- Retire livraison, expédition, délais, importation, retours, remboursement, promotions et garanties non confirmées par le vendeur.
- N'essaie pas de traduire ces mentions: omets-les. Garde uniquement caractéristiques, usages, compatibilités et contenu du produit.
- Le texte final doit être naturel pour Errayhany au Maroc et ne doit jamais sembler extrait d'une marketplace étrangère.
`
    : '';
  const prompt = `Tu es un expert e-commerce Maroc (Jumia / vente en gros électronique).
Analyse ${amazonMeta ? 'les données Amazon + ' : ''}toutes les photos du produit et génère du contenu bilingue FR/AR.

Produit donné par le vendeur:
- Nom: ${name}
- Prix: ${price} MAD
- Référence: ${ref}
${amazonBlock}
${amazonRewriteRules}
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
  "color_variants": ["chaque variante visuelle distincte, en français"],
  "barcode": "code-barres exact visible sur une photo, sinon chaîne vide",
  "packaging_specs": ["spec lue sur la boîte 1", "spec 2", "spec 3", "spec 4", "spec 5", "spec 6"]
}

Règles packaging_specs:
- Lis le TEXTE visible sur l'emballage / la boîte / les étiquettes (modèle, RGB, USB-C, voltage, autonomie, dimensions, features…).
- Français ou anglais court, max 6 lignes, factuelles uniquement.
- Si peu de texte lisible, déduis 3-5 specs techniques évidentes du produit photographié.
- N'invente pas de certifications ou chiffres absents de la photo.
Règles color_variants:
- Observe uniquement les unités/couleurs réellement visibles sur les photos.
- Une combinaison bicolore est UNE variante: "Blanc et Noir", "Noir et Bleu".
- Ne la découpe pas en deux couleurs simples.
- Exemples: trois unités Blanc/Noir, Noir/Bleu et Bleu => ["Blanc et Noir","Noir et Bleu","Bleu"].
- Si une seule variante est visible, retourne un tableau d'un élément. N'invente jamais une couleur.`;

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
      model: textModel(),
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
 * Single paid vision pass. Local templates render the final AR/FR copy, so
 * product photos are not sent to a second paid text provider.
 */
export async function extractProductFacts({
  imageBuffer,
  imageBuffers,
  name,
  ref,
  amazonMeta = null,
}) {
  if (!isOpenRouterConfigured()) throw new Error('OPENROUTER_API_KEY missing');
  const amazonFacts = amazonMeta
    ? `\nAmazon facts (technical corroboration only): ${JSON.stringify({
      title: amazonMeta.title || '',
      features: (amazonMeta.features || []).slice(0, 8),
      description: String(amazonMeta.description || '').slice(0, 1200),
    })}`
    : '';
  const prompt = `Read these product photos once and return only factual JSON.
Seller name: ${name || ''}
Reference: ${ref || ''}${amazonFacts}
Return exactly:
{"brand":"visible brand or Generic","model":"visible model or empty","color":"main visible color or Multicolore","title_fr":"short factual French title","title_ar":"short factual Arabic title","uses_fr":["facts"],"uses_ar":["facts"],"packaging_specs":["facts read from labels"],"color_variants":["only visible variants"],"barcode":"only if clearly readable","confidence":0}
Never invent certifications, measurements, compatibility, barcode, or a brand.`;
  const content = [{ type: 'text', text: prompt }];
  const refs = (imageBuffers?.length ? imageBuffers : [imageBuffer])
    .filter(Boolean)
    .slice(0, 3);
  for (const buffer of refs) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${buffer.toString('base64')}` },
    });
  }
  const { data } = await axios.post(
    OPENROUTER_URL,
    {
      model: factsModel(),
      messages: [{ role: 'user', content }],
      temperature: 0,
      response_format: { type: 'json_object' },
      max_tokens: 900,
    },
    { headers: headers(), timeout: 45000 },
  );
  const text = data?.choices?.[0]?.message?.content;
  const facts = extractJson(typeof text === 'string' ? text : JSON.stringify(text));
  if (!facts) throw new Error('OpenRouter facts: invalid JSON');
  return {
    facts,
    usage: {
      provider: 'openrouter',
      model: factsModel(),
      promptTokens: Number(data?.usage?.prompt_tokens || 0),
      completionTokens: Number(data?.usage?.completion_tokens || 0),
      totalTokens: Number(data?.usage?.total_tokens || 0),
      // Conservative default for flash-lite-class text calls. Exact provider
      // billing remains available in OpenRouter; this is a guardrail estimate.
      cost: (
        (Number(data?.usage?.prompt_tokens || 0) / 1_000_000) * 0.03
        + (Number(data?.usage?.completion_tokens || 0) / 1_000_000) * 0.13
      ),
    },
  };
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
      model: textModel(),
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
      model: imageModel(),
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
 * One direct professional studio image using the original Gemini 2.5 method.
 * The separate local U²-Net path provides the non-generative second image.
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
  const base = `You are a professional ecommerce product photographer.
Use the reference photo(s) as the source of truth for the product.
Keep the exact same product identity, shape, colors, ports, logos, labels and included accessories.
Do NOT invent a different product and do NOT add unrelated objects.
Output a square high-end marketplace photo with sharp focus and soft realistic studio lighting.`;

  const prompt = `${base}
Create one PROFESSIONAL STUDIO HERO for "${productLabel}":
- Clean white seamless studio background
- Centered commercial catalog composition
- Remove the original messy background, hands and clutter
- Preserve realistic materials, proportions and true colors
- Use a subtle natural product shadow, never a rectangular frame shadow
- No text, price tags, badges or watermarks
Mode hint: ${mode}. Return one image only.`;

  try {
    const generated = await generateOneImage({ imageBuffers: refs, prompt });
    const [clean] = await normalizeCatalogImages([generated]);
    if (!clean) return [];
    // Preserve the direct Gemini studio rendering used by the first products.
    // No automatic paid retry; Telegram approval remains the quality gate.
    return [clean];
  } catch (e) {
    console.error('Single studio image generation rejected:', e.message);
    return [];
  }
}

/**
 * Produce one Jumia-only image containing exactly one visible color variant.
 * The caller invokes this only after the seller confirms the detected list.
 */
export async function generateJumiaColorImage({
  imageBuffers,
  titleFr = 'Produit',
  targetColor,
}) {
  if (!isOpenRouterConfigured()) throw new Error('OPENROUTER_API_KEY missing');
  // Color variants can be spread across several seller photos.
  const refs = (imageBuffers || []).filter(Boolean).slice(0, 4);
  if (!refs.length) throw new Error('No reference photo for color image generation');
  const color = String(targetColor || '').trim();
  if (!color) throw new Error('Target color missing');

  const prompt = `You are a professional ecommerce product photographer.
The reference photos may show several units of the exact same model in different colors.
Create one square 1080x1080 Jumia catalog image for "${titleFr}", variant "${color}".
- Show EXACTLY ONE product unit, in the declared color or color combination "${color}".
- Remove every other color variant, duplicate unit, hand, packaging clutter and original background.
- Preserve the exact model, geometry, proportions, ports, screen, logos, labels and included accessories.
- For a two-tone variant, preserve both named colors in their correct visible areas.
- Do not recolor screens, logos, connectors, metal parts or unrelated functional details.
- Pure seamless white background, centered composition, sharp focus and subtle natural product shadow.
- No text, badges, prices, borders or watermarks.
- Never merge features from two units and never invent a color not supported by the references.
Return one image only.`;

  const generated = await generateOneImage({ imageBuffers: refs, prompt });
  const [clean] = await normalizeCatalogImages([generated]);
  if (!clean) throw new Error(`Color image rejected: ${color}`);
  return clean;
}

export function isOpenRouterConfigured() {
  return Boolean(apiKey());
}
