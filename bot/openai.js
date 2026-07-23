/**
 * OpenAI helpers for product landing-page copy (AR/FR).
 * Used by the Telegram enrichment pipeline when OPENAI_API_KEY is set.
 */
import axios from 'axios';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini';

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
Analyse ${amazonMeta ? 'les données Amazon + ' : ''}la photo produit et rédige le contenu d'une PAGE D'ATTERRISSAGE de conversion (AR + FR).

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
  "faq_fr": [{"q":"...","a":"..."},{"q":"...","a":"..."},{"q":"...","a":"..."}],
  "faq_ar": [{"q":"...","a":"..."},{"q":"...","a":"..."},{"q":"...","a":"..."}]
}

Règles:
- Ton grossiste Maroc, clair, vendeur, sans claims médicaux.
- Titres FR/AR: AUCUN chiffre (ni dimensions).
- FAQ: paiement COD, délai livraison 24-72h, commande en gros WhatsApp.
- Contenu brand-neutral (pas de marque Amazon).
- Pas de markdown hors JSON. Pas de texte hors JSON.`;

  const content = [{ type: 'text', text: prompt }];
  if (imageBuffer) {
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:image/jpeg;base64,${imageBuffer.toString('base64')}`,
      },
    });
  }

  const { data } = await axios.post(
    OPENAI_URL,
    {
      model: TEXT_MODEL,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content }],
    },
    { headers: headers(), timeout: 90000 }
  );

  const text = data?.choices?.[0]?.message?.content || '';
  const parsed = extractJson(text);
  if (!parsed) {
    throw new Error(`OpenAI landing copy: invalid JSON (${String(text).slice(0, 200)})`);
  }
  return parsed;
}
