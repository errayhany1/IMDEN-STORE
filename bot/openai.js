/**
 * OpenAI helpers for product landing-page copy (AR/FR).
 * Used by the Telegram enrichment pipeline when OPENAI_API_KEY is set.
 */
import axios from 'axios';
import { getBotSetting } from './runtimeSettings.js';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

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
  "color_variants": ["chaque variante visuelle distincte, en français"],
  "barcode": "code-barres exact visible sur une photo, sinon chaîne vide",
  "packaging_specs": ["spec lue sur la boîte 1", "spec 2", "spec 3", "spec 4", "spec 5", "spec 6"],
  "faq_fr": [{"q":"...","a":"..."},{"q":"...","a":"..."},{"q":"...","a":"..."}],
  "faq_ar": [{"q":"...","a":"..."},{"q":"...","a":"..."},{"q":"...","a":"..."}]
}

Règles:
- Ton grossiste Maroc, clair, vendeur, sans claims médicaux.
- Titres FR/AR: AUCUN chiffre (ni dimensions).
- Examine toutes les photos. Recopie le code-barres caractère par caractère seulement s'il est clairement lisible; ne l'invente jamais.
- color_variants: liste uniquement les variantes réellement visibles. Une combinaison bicolore reste UNE variante ("Blanc et Noir", "Noir et Bleu"). Exemple: unités Blanc/Noir, Noir/Bleu et Bleu => ["Blanc et Noir","Noir et Bleu","Bleu"]. N'invente aucune couleur.
- packaging_specs: lis le texte sur l'emballage (modèle, RGB, USB-C, voltage…) — FR/EN court, max 6, factuel; si peu de texte, 3-5 specs évidentes du produit.
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

  const { data } = await axios.post(
    OPENAI_URL,
    {
      model: getBotSetting('openaiTextModel'),
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
