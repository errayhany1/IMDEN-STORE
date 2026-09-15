/**
 * Storefront colors come from Tifawt sibling SKUs (SOURIS-X11-BLACK / -WHITE)
 * and optional color/couleur fields on those rows.
 */
import { API_BASE, tifawtApiRequest } from './tifawtClient.js';
import { fetchAllTifawtProducts } from './inventoryReconcile.js';
import { toTifawtSku } from './tifawtSku.js';
import {
  colorLabelArabic,
  colorLabelFromSkuRemainder,
  colorSwatchHex,
  isSkuColorToken,
  normalizeColorLabel,
  stripTrailingSkuColorTokens,
} from './colorVariants.js';

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();
const rateLimits = new Map();
const MAX_PER_MINUTE = 40;
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

function knownColorLabel(value) {
  const label = normalizeColorLabel(value);
  if (!label) return '';
  const parts = label.split(/\s+et\s+/i);
  if (!parts.length || parts.some((part) => !isSkuColorToken(part))) return '';
  return label;
}

export function colorLabelFromTifawtRow(row, familySku) {
  const fromSku = tifawtSkuColorLabel(familySku, row?.sku);
  if (fromSku) return fromSku;
  const fromField = knownColorLabel(row?.color || row?.couleur || row?.colorName || row?.colour);
  if (fromField) return fromField;
  const tokens = String(row?.name || '').split(/[\s/|_-]+/).filter(Boolean);
  if (tokens.length && isSkuColorToken(tokens[tokens.length - 1])) {
    return colorLabelFromSkuRemainder(tokens[tokens.length - 1]);
  }
  return '';
}

function mapVariant(row, familySku) {
  const sku = String(row?.sku || '').trim();
  const label = colorLabelFromTifawtRow(row, familySku);
  if (!sku || !label) return null;
  const image = publicImage(row.image || row.imageUrl);
  const remainder = toTifawtSku(sku).startsWith(`${familySku}-`)
    ? toTifawtSku(sku).slice(familySku.length + 1)
    : label.toUpperCase().replace(/\s+ET\s+/g, '-');
  return {
    id: row.id,
    sku,
    code: remainder,
    colorFr: label,
    colorAr: colorLabelArabic(label),
    hexes: colorSwatchHex(label),
    images: image ? [image] : [],
    inStock: row.inStock !== false && Number(row.availableStock || 0) > 0,
    stock: Number(row.availableStock || 0) || 0,
    price: Number(row.price || 0) || 0,
  };
}

function uniqueSorted(variants) {
  const unique = [];
  const seen = new Set();
  const sorted = [...variants].sort((a, b) => a.colorFr.localeCompare(b.colorFr, 'fr'));
  for (const variant of sorted) {
    if (seen.has(variant.sku)) continue;
    seen.add(variant.sku);
    unique.push(variant);
  }
  return unique;
}

export function groupTifawtColorFamilies(rows) {
  const buckets = new Map();
  for (const row of rows || []) {
    const sku = String(row?.sku || '').trim();
    if (!sku) continue;
    const family = tifawtColorFamilySku(sku);
    if (!family) continue;
    if (!buckets.has(family)) buckets.set(family, []);
    buckets.get(family).push(row);
  }

  const families = {};
  const bySku = {};
  for (const [family, members] of buckets) {
    const variants = uniqueSorted(members.map((row) => mapVariant(row, family)).filter(Boolean));
    if (variants.length < 2) continue;
    families[family] = variants;
    bySku[family] = family;
    bySku[`ERY-${family}`] = family;
    for (const variant of variants) {
      const sku = String(variant.sku || '').toUpperCase();
      bySku[sku] = family;
      bySku[toTifawtSku(sku)] = family;
      bySku[`ERY-${toTifawtSku(sku)}`] = family;
    }
  }
  return { families, bySku };
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

async function getTifawtColorMap() {
  const cached = cache.get('map');
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;
  const rows = await fetchAllTifawtProducts();
  const value = groupTifawtColorFamilies(rows);
  cache.set('map', { at: Date.now(), value });
  return value;
}

export async function listTifawtColorVariants(rawSku) {
  const familySku = tifawtColorFamilySku(rawSku);
  if (!familySku) return [];

  try {
    const map = await getTifawtColorMap();
    if (map.families[familySku]) return map.families[familySku];
  } catch (error) {
    console.warn('[tifawt-colors] color-map fallback', error?.message || error);
  }

  const cached = cache.get(familySku);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.variants;

  const rows = await searchProducts(familySku);
  const result = uniqueSorted(rows.map((row) => mapVariant(row, familySku)).filter(Boolean));
  const variants = result.length >= 2 ? result : [];
  cache.set(familySku, { at: Date.now(), variants });
  return variants;
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

  app.get('/api/catalog/color-map', async (req, res) => {
    if (!allowed(req)) return res.status(429).json({ ok: false, error: 'too_many_color_lookups' });
    try {
      const map = await getTifawtColorMap();
      return res.json({ ok: true, ...map });
    } catch (error) {
      console.warn('[tifawt-colors] color-map', error?.message || error);
      return res.json({ ok: true, families: {}, bySku: {} });
    }
  });
}
