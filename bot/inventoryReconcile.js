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

export async function fetchAllNocoRecords() {
  const { url, token, table } = nocodbConfig();
  if (!url || !token || !table) {
    const error = new Error('nocodb_not_configured');
    error.statusCode = 503;
    throw error;
  }

  let all = [];
  let offset = 0;
  while (true) {
    const { data } = await axios.get(`${url}/api/v2/tables/${table}/records`, {
      headers: { 'xc-token': token, accept: 'application/json' },
      params: { limit: 100, offset, sort: '-Id' },
      timeout: 30000,
    });
    const list = data?.list || [];
    all = all.concat(list);
    if (list.length < 100) break;
    offset += 100;
  }
  return all;
}

export async function fetchAllTifawtProducts() {
  let page = 1;
  let all = [];
  while (true) {
    const { data, status } = await tifawtApiRequest('get', '/products', {
      params: { limit: 100, page },
      timeout: 30000,
    });
    if (status >= 400) {
      const error = new Error(data?.message || `tifawt_http_${status}`);
      error.statusCode = status;
      error.code = status === 401 ? 'tifawt_unauthorized' : undefined;
      throw error;
    }
    const list = data?.data || [];
    all = all.concat(list);
    const totalPages = data?.meta?.totalPages || data?.pagination?.totalPages;
    if (!list.length || (totalPages && page >= totalPages)) break;
    if (list.length < 100) break;
    page += 1;
    if (page > 200) break;
  }
  return all;
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

export async function loadInventoryReconcile() {
  const [nocoRecords, tifawtProducts] = await Promise.all([
    fetchAllNocoRecords(),
    fetchAllTifawtProducts(),
  ]);
  return reconcileInventory({ nocoRecords, tifawtProducts });
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
