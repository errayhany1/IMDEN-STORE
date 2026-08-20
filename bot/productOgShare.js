/**
 * Server-rendered Open Graph HTML for /p/{sku} links.
 * WhatsApp / Facebook crawlers do not run SPA JavaScript, so og:image must
 * be present in the first HTML response.
 */
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SITE_URL = (
  process.env.SITE_URL
  || process.env.VITE_SITE_URL
  || 'https://errayhany.com'
).replace(/\/+$/, '');

const BRAND = 'Errayhany';

const SOCIAL_BOT_RE = /facebookexternalhit|WhatsApp|Twitterbot|LinkedInBot|Slackbot|TelegramBot|Discordbot|Pinterest|Facebot/i;

let manifestCache = { loadedAt: 0, data: null };

function nocodbConfig() {
  return {
    url: (process.env.VITE_NOCODB_URL || process.env.NOCODB_URL || '').replace(/\/+$/, ''),
    token: process.env.VITE_NOCODB_API_TOKEN || process.env.NOCODB_API_TOKEN || '',
    table: process.env.VITE_NOCODB_TABLE_PRODUCTS || process.env.NOCODB_TABLE_PRODUCTS || '',
  };
}

export function isSocialPreviewBot(userAgent = '') {
  return SOCIAL_BOT_RE.test(String(userAgent || ''));
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function decodeSku(rawSku) {
  try {
    return decodeURIComponent(String(rawSku || '').trim());
  } catch {
    return String(rawSku || '').trim();
  }
}

function skuCandidates(rawSku) {
  const sku = decodeSku(rawSku);
  return Array.from(new Set([
    sku,
    sku.toUpperCase(),
    sku.startsWith('ERY-') ? sku : `ERY-${sku}`,
    sku.startsWith('ERY-') ? sku.slice(4) : sku,
  ].filter(Boolean)));
}

function isVisibleRecord(record) {
  return record?.POSTEBL === 'POSTEBL';
}

function loadImageManifest() {
  const now = Date.now();
  if (manifestCache.data && now - manifestCache.loadedAt < 5 * 60 * 1000) {
    return manifestCache.data;
  }

  const candidates = [
    '/usr/share/nginx/html/product-images-manifest.json',
    path.join(__dirname, '..', 'public', 'product-images-manifest.json'),
  ];

  for (const filePath of candidates) {
    try {
      if (!fs.existsSync(filePath)) continue;
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      manifestCache = { loadedAt: now, data: parsed };
      return parsed;
    } catch {
      // try next path
    }
  }

  manifestCache = { loadedAt: now, data: null };
  return null;
}

function imageFromManifest(record, manifest) {
  const recordId = String(record?.Id || record?.id || '');
  const entry = manifest?.products?.[recordId];
  const first = entry?.images?.find(Boolean);
  if (!first) return '';
  const rel = first.full || first.thumbnail || '';
  if (!rel) return '';
  return rel.startsWith('http') ? rel : `${SITE_URL}${rel.startsWith('/') ? rel : `/${rel}`}`;
}

function imageFromNoco(record, nocodbUrl) {
  const img = record?.Image1?.[0] || record?.Image2?.[0] || record?.Image3?.[0];
  if (!img) return '';
  const raw = img.url || img.signedUrl || '';
  if (!raw) return '';
  return raw.startsWith('http') ? raw : `${nocodbUrl}/${String(raw).replace(/^\//, '')}`;
}

function resolveProductImage(record) {
  const manifest = loadImageManifest();
  const fromManifest = imageFromManifest(record, manifest);
  if (fromManifest) return fromManifest;

  const { url: nocodbUrl } = nocodbConfig();
  const fromNoco = imageFromNoco(record, nocodbUrl);
  if (fromNoco) return fromNoco;

  const sku = encodeURIComponent(String(record?.SKU || '').trim());
  if (sku) return `${SITE_URL}/bot-api/public-images/p/${sku}/1.jpg`;

  return `${SITE_URL}/logo-512.png`;
}

function productTitle(record) {
  return String(
    record?.Arabic_Title
    || record?.Title
    || record?.French_Title
    || record?.Woo_Title
    || record?.SKU
    || 'منتج',
  ).trim();
}

function productDescription(record, title) {
  const plain = String(record?.description_arabic || record?.Description || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const price = Number(record?.price || record?.Price || 0);
  const priceText = price > 0 ? `${price} DH` : '';
  const base = plain || `${title}${priceText ? ` — ${priceText}` : ''}`;
  return base.slice(0, 160);
}

async function fetchProductRecord(rawSku) {
  const { url, token, table } = nocodbConfig();
  if (!url || !token || !table) return null;

  for (const candidate of skuCandidates(rawSku)) {
    try {
      const { data } = await axios.get(`${url}/api/v2/tables/${table}/records`, {
        headers: { 'xc-token': token, accept: 'application/json' },
        params: { limit: 5, where: `(SKU,eq,${candidate})` },
        timeout: 20000,
        validateStatus: () => true,
      });
      const hit = (data?.list || []).find(isVisibleRecord);
      if (hit) return hit;
    } catch {
      // try next candidate
    }
  }

  try {
    const { data } = await axios.get(`${url}/api/v2/tables/${table}/records`, {
      headers: { 'xc-token': token, accept: 'application/json' },
      params: { limit: 120, sort: '-Id' },
      timeout: 25000,
      validateStatus: () => true,
    });
    const needle = decodeSku(rawSku).toUpperCase();
    return (data?.list || []).find((record) => (
      isVisibleRecord(record)
      && String(record?.SKU || '').trim().toUpperCase() === needle
    )) || null;
  } catch {
    return null;
  }
}

export function renderProductOgHtml({ sku, record }) {
  const cleanSku = String(record?.SKU || decodeSku(sku)).trim();
  const encodedSku = encodeURIComponent(cleanSku);
  const pageUrl = `${SITE_URL}/p/${encodedSku}`;
  const title = productTitle(record);
  const metaTitle = `${title} | ${BRAND}`;
  const description = productDescription(record, title);
  const image = resolveProductImage(record);

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(metaTitle)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${escapeHtml(pageUrl)}">
  <meta property="og:site_name" content="${escapeHtml(BRAND)} Store">
  <meta property="og:title" content="${escapeHtml(metaTitle)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="product">
  <meta property="og:url" content="${escapeHtml(pageUrl)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:image:secure_url" content="${escapeHtml(image)}">
  <meta property="og:image:alt" content="${escapeHtml(title)}">
  <meta property="og:locale" content="ar_MA">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(metaTitle)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">
</head>
<body>
  <p><a href="${escapeHtml(pageUrl)}">${escapeHtml(title)}</a></p>
</body>
</html>`;
}

export function registerProductOgRoutes(app) {
  app.get('/og/p/:sku', async (req, res) => {
    try {
      const sku = decodeSku(req.params.sku);
      if (!sku) {
        return res.status(400).type('text/plain').send('missing_sku');
      }

      const record = await fetchProductRecord(sku);
      if (!record) {
        return res.status(404).type('text/plain').send('product_not_found');
      }

      res.set('Cache-Control', 'public, max-age=300, s-maxage=3600');
      return res.status(200).type('text/html; charset=utf-8').send(renderProductOgHtml({ sku, record }));
    } catch (error) {
      console.error('[og] product share failed:', error?.message || error);
      return res.status(502).type('text/plain').send('og_render_failed');
    }
  });
}
