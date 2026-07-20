/**
 * Smoke-test OpenRouter text+image + optional Sheet webhook.
 * Usage: node scripts/test-product-ai-pipeline.cjs
 */
require('dotenv').config({ quiet: true, override: true });
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const KEY = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY;
const TEXT_MODEL = process.env.OPENROUTER_TEXT_MODEL || 'google/gemini-2.5-flash';
const IMAGE_MODEL = process.env.OPENROUTER_IMAGE_MODEL || 'google/gemini-3.1-flash-image';
const WEBHOOK = process.env.PRODUCT_SHEET_WEBHOOK_URL || '';
const SHEET_ID = process.env.PRODUCT_SHEET_ID || '1zuRmrjaMjTsvN7j822b5w6v3NR3Dh_TclhFyFKXx5h4';

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchBuffer(res.headers.location).then(resolve, reject);
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

async function openRouter(body) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://errayhany.com',
      'X-Title': 'Errayhany Product Pipeline Test',
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${JSON.stringify(json).slice(0, 400)}`);
  return json;
}

function extractJson(text) {
  const cleaned = String(text || '').replace(/```json|```/g, '').trim();
  try { return JSON.parse(cleaned); } catch (_) {}
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch (_) { return null; }
}

async function main() {
  if (!KEY) {
    console.error('MISSING OPENROUTER_API_KEY');
    process.exit(2);
  }

  // Prefer a local product image if present
  let imageBuf = null;
  const localDir = path.join(ROOT, 'public', 'product-images');
  if (fs.existsSync(localDir)) {
    const file = fs.readdirSync(localDir).find((f) => /\.(jpe?g|png|webp)$/i.test(f));
    if (file) {
      imageBuf = fs.readFileSync(path.join(localDir, file));
      console.log('Using local image', file, imageBuf.length);
    }
  }
  if (!imageBuf) {
    const url = 'https://errayhany.com/logo-512.png';
    imageBuf = await fetchBuffer(url);
    console.log('Using fallback image', url, imageBuf.length);
  }

  const dataUrl = `data:image/jpeg;base64,${imageBuf.toString('base64')}`;

  console.log('1) TEXT model', TEXT_MODEL);
  const textRes = await openRouter({
    model: TEXT_MODEL,
    temperature: 0.3,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Analyse this product photo. Reply ONLY JSON:
{"french_title":"...","arabic_title":"...","short_description_fr":"<ul><li>...</li></ul>","description_arabic":"..."}
Name hint: USB hub test. Price: 23 MAD. Ref: TEST-HUB-01`,
        },
        { type: 'image_url', image_url: { url: dataUrl } },
      ],
    }],
  });
  const textContent = textRes?.choices?.[0]?.message?.content;
  const copy = extractJson(typeof textContent === 'string' ? textContent : JSON.stringify(textContent));
  console.log('TEXT_OK', Boolean(copy), copy?.french_title || String(textContent).slice(0, 120));

  console.log('2) IMAGE model', IMAGE_MODEL, '(1 clean sample)');
  const imgRes = await openRouter({
    model: IMAGE_MODEL,
    modalities: ['image', 'text'],
    messages: [{
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Create one clean ecommerce product photo from the reference. Minimal text, white background, product centered.',
        },
        { type: 'image_url', image_url: { url: dataUrl } },
      ],
    }],
  });
  const msg = imgRes?.choices?.[0]?.message;
  const images = msg?.images || [];
  let gotImage = images.length > 0;
  if (!gotImage && Array.isArray(msg?.content)) {
    gotImage = msg.content.some((p) => String(p?.image_url?.url || '').startsWith('data:image'));
  }
  console.log('IMAGE_OK', gotImage, 'images_field', images.length);

  if (WEBHOOK) {
    console.log('3) Sheet webhook test');
    const payload = {
      sheetId: SHEET_ID,
      sheet1: {
        reference_clean: 'TEST-HUB-01',
        SellerSKU: 'ERY-TEST-HUB-01',
        Jumia_Price: 23,
        French_Title: copy?.french_title || 'Test Hub',
        Arabic_Title: copy?.arabic_title || 'اختبار',
        Feature_Bullets: copy?.short_description_fr || '',
        description_french: 'Pipeline smoke test',
        description_arabic: copy?.description_arabic || 'اختبار المسار',
        Creation_date: new Date().toISOString(),
        Meta_Title: 'Test',
        Meta_Description: 'Test',
        Woo_Title: 'Test',
        image_url1: 'https://errayhany.com/logo-512.png',
      },
      uploadTemplate: {
        ParentSKU: 'TEST-HUB-01',
        Name: copy?.french_title || 'Test Hub',
        Name_AR: copy?.arabic_title || 'اختبار',
        Description: 'Pipeline smoke test',
        Description_AR: copy?.description_arabic || 'اختبار',
        short_description: copy?.short_description_fr || '',
        SellerSKU: 'ERY-TEST-HUB-01',
        Price_MAD: 23,
        MainImage: 'https://errayhany.com/logo-512.png',
        Stock: 1,
        Brand: 'Generic',
        color_family: 'Multicolore',
        color: 'Multicolore',
        product_weight: 1,
        variation: '...',
      },
    };
    const wh = await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });
    const whText = await wh.text();
    console.log('SHEET_STATUS', wh.status, whText.slice(0, 200));
  } else {
    console.log('3) Sheet webhook skipped (not set)');
  }

  console.log('DONE');
}

main().catch((e) => {
  console.error('FAIL', e.message);
  process.exit(1);
});
