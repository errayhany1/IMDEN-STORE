/**
 * Storefront colors come from Tifawt sibling SKUs (SOURIS-X11-BLACK / -WHITE).
 * Tifawt does not expose a dedicated variants API; color is the SKU suffix.
 */
import { API_BASE, tifawtApiRequest } from './tifawtClient.js';
import { toTifawtSku } from './tifawtSku.js';
import {
  colorLabelArabic,
  colorLabelFromSkuRemainder,
  stripTrailingSkuColorTokens,
} from './colorVariants.js';

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();
const rateLimits = new Map();
const MAX_PER_MINUTE = 30;
const TIFAWT_ORIGIN = String(API_BASE || '').replace(/\/api\/v1\/?$/, '');

function publicImage(path) {
  const raw = String(path || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${TIFAWT_ORIGIN}/${raw.replace(/^\//, '')}`;
}

export function tifawtColorFamilySku(rawSku) {
  return stripTrailingSkuColorTokens(toTifawtSku(rawSku));
}

export function tifawtSkuColorLabel(familySku, sku) {
  const family = String(familySku || '').toUpperCase();
  const current = toTifawtSku(sku);
  if (!family || !current || current === family) return '';
  if (!current.startsWith(`${family}-`)) return '';
  return colorLabelFromSkuRemainder(current.slice(family.length + 1));
}

function mapVariant(row, familySku) {
  const sku = String(row?.sku || '').trim();
  const label = tifawtSkuColorLabel(familySku, sku);
  if (!label) return null;
  const image = publicImage(row.image);
  return {
    id: row.id,
    sku,
    code: sku.slice(familySku.length + 1),
    colorFr: label,
    colorAr: colorLabelArabic(label),
    images: image ? [image] : [],
    inStock: row.inStock !== false && Number(row.availableStock || 0) > 0,
    stock: Number(row.availableStock || 0) || 0,
    price: Number(row.price || 0) || 0,
  };
}

async function searchProducts(query) {
  const res = await tifawtApiRequest('get', '/products', {
    params: { search: query, limit: 50 },
    timeout: 20000,
  });
  if (res.status >= 400) return [];
  const list = res.data?.data || res.data?.products || [];
  return Array.isArray(list) ? list : [];
}

export async function listTifawtColorVariants(rawSku) {
  const familySku = tifawtColorFamilySku(rawSku);
  if (!familySku) return [];
  const cached = cache.get(familySku);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.variants;

  const rows = await searchProducts(familySku);
  const variants = rows
    .map((row) => mapVariant(row, familySku))
    .filter(Boolean)
    .sort((a, b) => a.colorFr.localeCompare(b.colorFr, 'fr'));
  const unique = [];
  const seen = new Set();
  for (const variant of variants) {
    if (seen.has(variant.sku)) continue;
    seen.add(variant.sku);
    unique.push(variant);
  }
  const result = unique.length >= 2 ? unique : [];
  cache.set(familySku, { at: Date.now(), variants: result });
  return result;
}

function allowed(req) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const hits = (rateLimits.get(ip) || []).filter((time) => now - time < 60_000);
  if (hits.length >= MAX_PER_MINUTE) return false;
  hits.push(now);
  rateLimits.set(ip, hits);
  return true;
}

export function registerTifawtColorRoutes(app) {
  app.get('/api/catalog/colors', async (req, res) => {
    if (!allowed(req)) return res.status(429).json({ ok: false, error: 'too_many_color_lookups' });
    const sku = String(req.query?.sku || '').trim();
    if (!sku) return res.status(400).json({ ok: false, error: 'sku_required' });
    try {
      const variants = await listTifawtColorVariants(sku);
      return res.json({
        ok: true,
        sku,
        familySku: tifawtColorFamilySku(sku),
        variants,
      });
    } catch (error) {
      console.warn('[tifawt-colors]', error?.message || error);
      return res.json({ ok: true, sku, variants: [] });
    }
  });
}
