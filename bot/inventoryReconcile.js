/**
 * Compare Tifawt stocked products vs NocoDB catalog.
 * Used by CLI script and admin inventory sync API.
 */
import axios from 'axios';
import { tifawtApiRequest } from './tifawtClient.js';
import {
  toTifawtSku,
  parseTifawtSkuAliases,
  resolveTifawtOrderSku,
  normalizeAliasKey,
} from './tifawtSku.js';
import { getBotSetting } from './runtimeSettings.js';

const TIFAWT_SITE = (
  process.env.TIFAWT_SITE_URL
  || String(process.env.TIFAWT_API_BASE || 'https://errayhany.tifawt.ma/api/v1').replace(/\/api\/v1\/?$/, '')
).replace(/\/+$/, '');

const STORE_SITE = (
  process.env.SITE_URL
  || process.env.VITE_SITE_URL
  || 'https://errayhany.com'
).replace(/\/+$/, '');

function nocoImageUrl(record, nocodbUrl) {
  for (const key of ['Image1', 'Image2', 'Image3']) {
    const img = record?.[key]?.[0];
    if (!img) continue;
    const raw = img.signedUrl || img.url || img.path || '';
    if (!raw) continue;
    return raw.startsWith('http') ? raw : `${nocodbUrl}/${String(raw).replace(/^\//, '')}`;
  }
  const sku = encodeURIComponent(String(record?.SKU || '').trim());
  if (sku) return `${STORE_SITE}/bot-api/public-images/p/${sku}/1.jpg`;
  return '';
}

function tifawtImageUrl(product) {
  const raw = product?.image || product?.imageUrl || '';
  if (!raw) return '';
  if (raw.startsWith('http')) return raw;
  return `${TIFAWT_SITE}${raw.startsWith('/') ? raw : `/${raw}`}`;
}

function tifawtPickerRow(product) {
  return {
    tifawtSku: product.sku,
    tifawtName: product.name,
    tifawtStock: product.availableStock,
    tifawtPrice: product.price,
    tifawtImage: tifawtImageUrl(product),
  };
}

function nocodbConfig() {
  return {
    url: (process.env.VITE_NOCODB_URL || process.env.NOCODB_URL || '').replace(/\/+$/, ''),
    token: process.env.VITE_NOCODB_API_TOKEN || process.env.NOCODB_API_TOKEN || '',
    table: process.env.VITE_NOCODB_TABLE_PRODUCTS || process.env.NOCODB_TABLE_PRODUCTS || '',
  };
}

export function normSku(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

export function nocoKeys(record) {
  const keys = new Set();
  for (const raw of [record?.SKU, record?.SellerSKU, record?.reference_clean]) {
    const sku = String(raw || '').trim();
    if (!sku) continue;
    keys.add(normSku(sku));
    keys.add(normSku(toTifawtSku(sku)));
    if (!sku.toUpperCase().startsWith('ERY-')) keys.add(normSku(`ERY-${sku}`));
  }
  return keys;
}

export function tifawtInStock(product) {
  return Boolean(product?.inStock) && Number(product?.availableStock || 0) > 0;
}

export function nocoPublished(record) {
  return String(record?.POSTEBL || '').trim().toUpperCase() === 'POSTEBL';
}

const PAGE_SIZE = 100;
const PAGE_CONCURRENCY = 2;
const PAGE_RETRIES = 3;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetryableStatus(status) {
  return status === 429 || status === 408 || (status >= 500 && status < 600);
}

/**
 * NocoDB and Tifawt both rate-limit bursts, and a 429 here used to fail the
 * whole report. Pages go out a couple at a time and back off on 429/5xx.
 */
async function fetchPages(count, fetchPage) {
  const results = new Array(count);
  let next = 0;

  const worker = async () => {
    while (next < count) {
      const index = next;
      next += 1;
      let lastError = null;
      for (let attempt = 1; attempt <= PAGE_RETRIES; attempt += 1) {
        try {
          results[index] = await fetchPage(index);
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          const status = error?.statusCode || error?.response?.status;
          if (!isRetryableStatus(status) || attempt === PAGE_RETRIES) break;
          await sleep(500 * (2 ** (attempt - 1)));
        }
      }
      if (lastError) throw lastError;
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(PAGE_CONCURRENCY, count) }, worker),
  );
  return results.flatMap((list) => list || []);
}

export async function fetchAllNocoRecords() {
  const { url, token, table } = nocodbConfig();
  if (!url || !token || !table) {
    const error = new Error('nocodb_not_configured');
    error.statusCode = 503;
    throw error;
  }

  const fields = 'Id,SKU,SellerSKU,reference_clean,POSTEBL,Arabic_Title,French_Title,Title,Woo_Title,Image1,Image2,Image3,price';
  const getPage = async (offset) => {
    const { data, status } = await axios.get(`${url}/api/v2/tables/${table}/records`, {
      headers: { 'xc-token': token, accept: 'application/json' },
      params: { limit: PAGE_SIZE, offset, fields },
      timeout: 30000,
      validateStatus: () => true,
    });
    if (status >= 400) {
      const error = new Error(data?.msg || data?.message || `nocodb_http_${status}`);
      error.statusCode = status;
      throw error;
    }
    return data;
  };

  const firstPage = await getPage(0);
  const total = firstPage?.pageInfo?.totalRows || 0;
  const first = firstPage?.list || [];
  if (total <= PAGE_SIZE) return first;

  const remaining = Math.ceil((total - PAGE_SIZE) / PAGE_SIZE);
  const rest = await fetchPages(remaining, async (i) => {
    const page = await getPage(PAGE_SIZE * (i + 1));
    return page?.list || [];
  });
  return first.concat(rest);
}

export async function fetchAllTifawtProducts() {
  const getPage = async (page) => {
    const { data, status } = await tifawtApiRequest('get', '/products', {
      params: { limit: PAGE_SIZE, page },
      timeout: 30000,
    });
    if (status >= 400) {
      const error = new Error(data?.message || `tifawt_http_${status}`);
      error.statusCode = status;
      if (status === 401) error.code = 'tifawt_unauthorized';
      throw error;
    }
    return data;
  };

  const firstPage = await getPage(1);
  const first = firstPage?.data || [];
  const totalPages = firstPage?.meta?.totalPages || firstPage?.pagination?.totalPages || 1;
  if (totalPages <= 1) return first;

  const rest = await fetchPages(totalPages - 1, async (i) => {
    const page = await getPage(i + 2);
    return page?.data || [];
  });
  return first.concat(rest);
}

function buildTifawtIndex(tifawtProducts) {
  const bySku = new Map();
  for (const product of tifawtProducts) {
    bySku.set(normSku(product.sku), product);
    bySku.set(normSku(toTifawtSku(product.sku)), product);
  }
  return bySku;
}

function buildNocoIndex(nocoRecords) {
  const byKey = new Map();
  for (const record of nocoRecords) {
    for (const key of nocoKeys(record)) {
      if (!byKey.has(key)) byKey.set(key, record);
    }
  }
  return byKey;
}

export function findNocoForTifawt(tp, { nocoByKey, nocoRecords, aliases }) {
  const candidates = [tp.sku, toTifawtSku(tp.sku), aliases.get(toTifawtSku(tp.sku))];
  for (const candidate of candidates) {
    const key = normSku(candidate);
    if (nocoByKey.has(key)) return { record: nocoByKey.get(key), via: candidate };
  }
  const needle = normSku(toTifawtSku(tp.sku)).replace(/[^A-Z0-9]/g, '');
  if (!needle) return null;
  for (const record of nocoRecords) {
    for (const key of nocoKeys(record)) {
      if (key.replace(/[^A-Z0-9]/g, '') === needle) return { record, via: 'fuzzy' };
    }
  }
  return null;
}

export function findTifawtForNoco(record, { tifawtBySku, aliases }) {
  for (const key of nocoKeys(record)) {
    const hit = tifawtBySku.get(key);
    if (hit) return { product: hit, via: 'direct', alias: false };
  }
  const resolved = resolveTifawtOrderSku(record?.SKU, aliases);
  const aliasHit = tifawtBySku.get(normSku(resolved));
  if (aliasHit) return { product: aliasHit, via: resolved, alias: true };
  return null;
}

export function reconcileInventory({ nocoRecords, tifawtProducts, aliasesRaw = '' } = {}) {
  const { url: nocodbUrl } = nocodbConfig();
  const aliases = aliasesRaw instanceof Map
    ? aliasesRaw
    : parseTifawtSkuAliases(aliasesRaw || getBotSetting('tifawtSkuAliases') || '');

  const nocoByKey = buildNocoIndex(nocoRecords);
  const tifawtBySku = buildTifawtIndex(tifawtProducts);
  const tifawtStocked = tifawtProducts.filter(tifawtInStock);

  const matchedOk = [];
  const tifawtStockedNotInNoco = [];
  const enableOnSite = [];

  for (const tp of tifawtStocked) {
    const hit = findNocoForTifawt(tp, { nocoByKey, nocoRecords, aliases });
    if (!hit) {
      tifawtStockedNotInNoco.push({
        tifawtId: tp.id,
        tifawtSku: tp.sku,
        tifawtName: tp.name,
        tifawtStock: tp.availableStock,
        tifawtPrice: tp.price,
        tifawtImage: tifawtImageUrl(tp),
        suggestedNocoSku: tp.sku.toUpperCase().startsWith('ERY-') ? tp.sku : `ERY-${tp.sku}`,
      });
      continue;
    }
    const record = hit.record;
    const row = {
      tifawtId: tp.id,
      tifawtSku: tp.sku,
      tifawtName: tp.name,
      tifawtStock: tp.availableStock,
      tifawtImage: tifawtImageUrl(tp),
      nocoId: record.Id,
      nocoSku: record.SKU,
      nocoName: record.Arabic_Title || record.French_Title || record.Title || record.Woo_Title,
      nocoImage: nocoImageUrl(record, nocodbUrl),
      nocoStatus: record.POSTEBL,
      matchVia: hit.via,
    };
    if (nocoPublished(record)) matchedOk.push(row);
    else enableOnSite.push(row);
  }

  const nocoPosteblUnlinked = [];
  for (const record of nocoRecords) {
    if (!nocoPublished(record)) continue;
    const link = findTifawtForNoco(record, { tifawtBySku, aliases });
    if (link) continue;
    nocoPosteblUnlinked.push({
      nocoId: record.Id,
      nocoSku: record.SKU,
      nocoName: record.Arabic_Title || record.French_Title || record.Title || record.Woo_Title,
      nocoImage: nocoImageUrl(record, nocodbUrl),
      nocoPrice: record.price || record.Price,
      aliasHint: aliases.get(normalizeAliasKey(record.SKU)) || '',
    });
  }

  const tifawtPicker = tifawtStocked
    .map(tifawtPickerRow)
    .sort((a, b) => String(a.tifawtSku).localeCompare(String(b.tifawtSku), 'en'));

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      nocoAll: nocoRecords.length,
      nocoPublished: nocoRecords.filter(nocoPublished).length,
      tifawtAll: tifawtProducts.length,
      tifawtInStock: tifawtStocked.length,
      matchedOk: matchedOk.length,
      tifawtStockedNotInNoco: tifawtStockedNotInNoco.length,
      nocoPosteblUnlinked: nocoPosteblUnlinked.length,
      enableOnSite: enableOnSite.length,
    },
    matchedOk,
    tifawtStockedNotInNoco,
    nocoPosteblUnlinked,
    enableOnSite,
    tifawtPicker,
    aliases: Object.fromEntries(aliases),
  };
}

const RECONCILE_TTL_MS = 5 * 60 * 1000;
/** After a failure, report it instead of hammering the upstream on every poll. */
const RECONCILE_RETRY_COOLDOWN_MS = 30 * 1000;

let reconcileCache = null;
let reconcileCacheTime = 0;
let reconcileInFlight = null;
let reconcileFailure = null;

async function runReconcile() {
  const [nocoRecords, tifawtProducts] = await Promise.all([
    fetchAllNocoRecords(),
    fetchAllTifawtProducts(),
  ]);
  reconcileCache = reconcileInventory({ nocoRecords, tifawtProducts });
  reconcileCacheTime = Date.now();
  reconcileFailure = null;
  return reconcileCache;
}

function startReconcile() {
  if (reconcileInFlight) return reconcileInFlight;
  reconcileFailure = null;
  reconcileInFlight = runReconcile().finally(() => { reconcileInFlight = null; });
  // Background callers never await this chain. Without a handler attached here
  // a failed refresh becomes an unhandled rejection, which kills the whole
  // container (tracking API + nginx) instead of just failing this one request.
  reconcileInFlight.catch((error) => {
    console.error('[inventory] reconcile failed:', error?.message || error);
    reconcileFailure = { error, at: Date.now() };
  });
  return reconcileInFlight;
}

function isReconcileFresh() {
  return Boolean(reconcileCache) && (Date.now() - reconcileCacheTime) < RECONCILE_TTL_MS;
}

export function inventoryReconcileError() {
  return reconcileFailure?.error || null;
}

/**
 * `background` returns immediately: cached data when available, otherwise a
 * `loading` marker the caller polls on. Foreground callers await the refresh.
 */
export async function loadInventoryReconcile({ background = false, force = false } = {}) {
  if (force) {
    reconcileCache = null;
    reconcileCacheTime = 0;
    reconcileFailure = null;
  }

  if (isReconcileFresh()) {
    return { status: 'ready', stale: false, ...reconcileCache };
  }

  const cooling = reconcileFailure
    && (Date.now() - reconcileFailure.at) < RECONCILE_RETRY_COOLDOWN_MS;
  if (!reconcileInFlight && cooling) {
    if (reconcileCache) return { status: 'ready', stale: true, ...reconcileCache };
    throw reconcileFailure.error;
  }

  const run = startReconcile();

  if (background) {
    return reconcileCache
      ? { status: 'ready', stale: true, ...reconcileCache }
      : { status: 'loading' };
  }

  return { status: 'ready', stale: false, ...(await run) };
}

export function toCsv(rows, headers) {
  const esc = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [headers.join(','), ...rows.map((row) => headers.map((h) => esc(row[h])).join(','))].join('\n');
}

export function reconcileToCsvFiles(reconcile) {
  return {
    tifawtStockedNotInNoco: toCsv(reconcile.tifawtStockedNotInNoco, [
      'tifawtSku', 'tifawtName', 'tifawtStock', 'tifawtPrice', 'suggestedNocoSku',
    ]),
    nocoPosteblUnlinked: toCsv(reconcile.nocoPosteblUnlinked, [
      'nocoId', 'nocoSku', 'nocoName', 'nocoPrice', 'aliasHint',
    ]),
    matchedOk: toCsv(reconcile.matchedOk, [
      'tifawtSku', 'tifawtName', 'tifawtStock', 'nocoId', 'nocoSku', 'nocoName',
    ]),
  };
}
