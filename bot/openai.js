/**
 * OpenAI helpers for product landing-page copy (AR/FR) and studio product
 * images. Used by the Telegram enrichment pipeline when OPENAI_API_KEY is set
 * (so the bot works fully on OpenAI, without an OpenRouter key).
 */
import axios from 'axios';
import FormData from 'form-data';
import { normalizeCatalogImages } from './imageNormalize.js';
import { composeWhiteStudioProduct } from './studioImage.js';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_IMAGE_URL = 'https://api.openai.com/v1/images/edits';
const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini';
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';

function apiKey() {
  return process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || '';
}

export function isOpenAIConfigured() {
  return Boolean(apiKey());
}

function headers() {
  return {
    Authorization: `Bearer ${apiKey()}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Human-readable reason for an OpenAI failure (invalid key, no access to the
 * image model, rate limit…) instead of the opaque "Request failed with status
 * code 401".
 */
function describeApiError(e) {
  const status = e?.response?.status;
  const body = e?.response?.data;
  const providerMsg =
    body?.error?.message ||
    (typeof body?.error === 'string' ? body.error : '') ||
    body?.message ||
    (typeof body === 'string' ? body : '');
  if (status && providerMsg) return `OpenAI ${status}: ${String(providerMsg).slice(0, 220)}`;
  if (status) return `OpenAI ${status}: ${JSON.stringify(body || {}).slice(0, 220)}`;
  if (e?.code === 'ECONNABORTED') return `OpenAI timeout: ${e.message}`;
  return e?.message || 'unknown OpenAI error';
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

/**
 * Generate bilingual landing-page copy from product photo + seller caption.
 * Optional amazonMeta (title/description/features) improves copy when scraping Amazon.
 */
export async function generateLandingPageCopy({
  imageBuffer,
  imageBuffers,
  name,
  price,
  ref,
  amazonMeta = null,
}) {
  if (!isOpenAIConfigured()) {
    throw new Error('OPENAI_API_KEY missing');
  }

  const amazonBlock = amazonMeta
    ? `
Données Amazon (source produit):
- Titre Amazon: ${amazonMeta.title || ''}
- ASIN: ${amazonMeta.asin || ''}
- Features: ${(amazonMeta.features || []).slice(0, 8).join(' | ')}
- Description: ${String(amazonMeta.description || '').slice(0, 1200)}
`
    : '';

  const prompt = `Tu es un expert e-commerce grossiste au Maroc (Errayhany / Jumia / WhatsApp).
Analyse ${amazonMeta ? 'les données Amazon + ' : ''}toutes les photos produit et rédige le contenu d'une PAGE D'ATTERRISSAGE de conversion (AR + FR).

Données vendeur:
- Nom: ${name}
- Prix: ${price} MAD
- Référence: ${ref}
${amazonBlock}
Réponds UNIQUEMENT en JSON valide avec exactement ces clés:
{
  "french_title": "titre FR SEO max 120 chars (PAS de chiffres)",
  "arabic_title": "عنوان عربي SEO max 120 (بدون أرقام)",
  "woo_title": "titre court FR max 80",
  "short_description_fr": "HTML <ul><li>...</li></ul> 4-6 bullets FR (bénéfices vente)",
  "short_description_ar": "HTML <ul><li>...</li></ul> 4-6 bullets AR",
  "description_french": "HTML paragraphe + liste FR (landing longue, 80-160 mots)",
  "description_arabic": "HTML فقرة + قائمة عربية (landing طويلة)",
  "meta_title": "meta title FR max 60",
  "meta_description": "meta description FR max 155",
  "hero_line_fr": "accroche hero FR max 90 chars",
  "hero_line_ar": "سطر بطولي عربي max 90",
  "brand": "marque détectée ou Generic",
  "color": "couleur principale ou Multicolore",
  "barcode": "code-barres exact visible sur une photo, sinon chaîne vide",
  "faq_fr": [{"q":"...","a":"..."},{"q":"...","a":"..."},{"q":"...","a":"..."}],
  "faq_ar": [{"q":"...","a":"..."},{"q":"...","a":"..."},{"q":"...","a":"..."}]
}

Règles:
- Ton grossiste Maroc, clair, vendeur, sans claims médicaux.
- Titres FR/AR: AUCUN chiffre (ni dimensions).
- Examine toutes les photos. Recopie le code-barres caractère par caractère seulement s'il est clairement lisible; ne l'invente jamais.
- FAQ: paiement COD, délai livraison 24-72h, commande en gros WhatsApp.
- Contenu brand-neutral (pas de marque Amazon).
- Pas de markdown hors JSON. Pas de texte hors JSON.`;

  const content = [{ type: 'text', text: prompt }];
  const refs = (imageBuffers?.length ? imageBuffers : [imageBuffer])
    .filter(Boolean)
    .slice(0, 4);
  for (const buffer of refs) {
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:image/jpeg;base64,${buffer.toString('base64')}`,
      },
    });
  }

  let data;
  try {
    ({ data } = await axios.post(
      OPENAI_URL,
      {
        model: TEXT_MODEL,
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content }],
      },
      { headers: headers(), timeout: 90000 }
    ));
  } catch (e) {
    throw new Error(describeApiError(e));
  }

  const text = data?.choices?.[0]?.message?.content || '';
  const parsed = extractJson(text);
  if (!parsed) {
    throw new Error(`OpenAI landing copy: invalid JSON (${String(text).slice(0, 200)})`);
  }
  return parsed;
}

async function generateOneImage({ imageBuffers, prompt }) {
  const refs = (imageBuffers || []).filter(Boolean).slice(0, 4);
  if (!refs.length) {
    throw new Error('No reference images for AI generation');
  }

  const form = new FormData();
  form.append('model', IMAGE_MODEL);
  form.append('prompt', prompt);
  form.append('size', process.env.OPENAI_IMAGE_SIZE || '1024x1024');
  // The GPT image models accept the `image` field repeated (up to 16).
  refs.forEach((buf, i) => {
    form.append('image', buf, { filename: `ref-${i + 1}.jpg`, contentType: 'image/jpeg' });
  });

  let data;
  try {
    ({ data } = await axios.post(OPENAI_IMAGE_URL, form, {
      headers: { Authorization: `Bearer ${apiKey()}`, ...form.getHeaders() },
      timeout: Number(process.env.OPENAI_IMAGE_TIMEOUT_MS || 120000),
      maxBodyLength: Infinity,
    }));
  } catch (e) {
    throw new Error(describeApiError(e));
  }

  // GPT image models always return base64 (no temporary URL).
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error(`OpenAI image empty: ${JSON.stringify(data || {}).slice(0, 220)}`);
  }
  return Buffer.from(b64, 'base64');
}

/**
 * Website-ready studio product images via OpenAI (gpt-image-1), mirroring the
 * OpenRouter path: generate white-background cutouts from the seller photo(s),
 * then trim + add soft studio shadows. Lets the bot produce professional images
 * for owners who use OpenAI instead of OpenRouter.
 */
export async function generateProductImages({
  imageBuffer,
  imageBuffers,
  titleFr,
  price,
  oldPrice,
  mode = 'photo',
}) {
  if (!isOpenAIConfigured()) {
    throw new Error('OPENAI_API_KEY missing — cannot generate professional product images');
  }

  const refs = (imageBuffers && imageBuffers.length)
    ? imageBuffers.filter(Boolean)
    : (imageBuffer ? [imageBuffer] : []);
  if (!refs.length) {
    throw new Error('No reference photo for AI image generation');
  }

  const cutoutCount = Math.min(Number(process.env.AI_IMAGE_COUNT || 2), 3);

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
      console.error('OpenAI cutout image gen failed:', e.message);
    }
  }

  if (!cutouts.length) {
    try {
      const buf = await generateOneImage({ imageBuffers: refs, prompt: `${base}\nFront hero, fill the frame.` });
      if (buf) cutouts.push(buf);
    } catch (e) {
      lastError = e;
      console.error('OpenAI cutout retry failed:', e.message);
    }
  }

  if (!cutouts.length) {
    throw new Error(lastError ? lastError.message : 'OpenAI returned no product image');
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
