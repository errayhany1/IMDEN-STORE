/**
 * Map store Category_ID → Tifawt product-categories id and sync on publish.
 *
 * Configure mapping in Bot Control → tifawtCategoryMap, one line per category:
 *   1=12
 *   2=15
 * (store Category_ID = Tifawt category id)
 *
 * Run `node scripts/setup-tifawt-categories.mjs` to create categories in Tifawt
 * and print the mapping lines automatically.
 */
import axios from 'axios';
import { getBotSetting } from './runtimeSettings.js';
import { STORE_CATEGORY_BY_ID, TIFAWT_CATEGORY_NAME_FR } from './storeCategories.js';
import {
  API_BASE,
  BUSINESS_ID,
  getTifawtToken,
  isTifawtApiConfigured,
} from './tifawtClient.js';

export function normalizeCategoryName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Match store Category_ID → Tifawt category id by English (or French) names.
 */
export function buildStoreToTifawtCategoryMap(tifawtCategories) {
  const byName = new Map();
  for (const cat of tifawtCategories || []) {
    const key = normalizeCategoryName(cat?.name);
    if (key && cat?.id) byName.set(key, Number(cat.id));
  }

  const map = new Map();
  for (const [storeIdRaw, enName] of Object.entries(STORE_CATEGORY_BY_ID)) {
    const storeId = Number(storeIdRaw);
    const frName = TIFAWT_CATEGORY_NAME_FR[storeId];
    const tifawtId = byName.get(normalizeCategoryName(enName))
      || (frName ? byName.get(normalizeCategoryName(frName)) : null);
    if (tifawtId) map.set(storeId, tifawtId);
  }
  return map;
}

export function parseTifawtCategoryMap(text = '') {
  const map = new Map();
  for (const line of String(text || '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [left, right] = trimmed.split('=').map((part) => part.trim());
    const storeId = Number(left);
    const tifawtId = Number(right);
    if (Number.isFinite(storeId) && Number.isFinite(tifawtId) && tifawtId > 0) {
      map.set(storeId, tifawtId);
    }
  }
  return map;
}

export function tifawtCategoryMapToText(map) {
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([storeId, tifawtId]) => `${storeId}=${tifawtId}`)
    .join('\n');
}

export function resolveTifawtCategoryId(storeCategoryId, categoryMap = null) {
  const storeId = Number(storeCategoryId);
  if (!Number.isFinite(storeId)) return null;

  const manual = parseTifawtCategoryMap(getBotSetting('tifawtCategoryMap') || '');
  if (manual.has(storeId)) return manual.get(storeId);

  if (categoryMap instanceof Map && categoryMap.has(storeId)) {
    return categoryMap.get(storeId);
  }
  if (categoryMap && typeof categoryMap === 'object' && categoryMap[storeId] != null) {
    return Number(categoryMap[storeId]);
  }
  return null;
}

async function findProductBySku(sku, token) {
  const { data, status } = await axios.get(`${API_BASE}/products`, {
    params: { search: sku, limit: 20 },
    headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
    timeout: 30000,
    validateStatus: () => true,
  });
  if (status >= 400) return null;
  const list = data?.data || data?.products || data?.items || data?.list || [];
  if (!Array.isArray(list)) return null;
  const needle = String(sku).trim().toLowerCase();
  return list.find((p) => String(p.sku || '').trim().toLowerCase() === needle) || null;
}

/**
 * PATCH an existing Tifawt product with the mapped categoryId.
 * @returns {{ ok: boolean, skipped?: boolean, reason?: string, tifawtCategoryId?: number }}
 */
export async function syncTifawtCategoryForProduct({
  sku,
  storeCategoryId,
  categoryMap = null,
  tifawtCategoryId: explicitTifawtCategoryId = null,
}) {
  if (!isTifawtApiConfigured()) {
    return { ok: false, skipped: true, reason: 'no_credentials' };
  }
  const tifawtCategoryId = explicitTifawtCategoryId
    || resolveTifawtCategoryId(storeCategoryId, categoryMap);
  if (!tifawtCategoryId) {
    return { ok: false, skipped: true, reason: 'no_mapping' };
  }
  const cleanSku = String(sku || '').trim();
  if (!cleanSku) {
    return { ok: false, skipped: true, reason: 'no_sku' };
  }

  let token = await getTifawtToken();
  let existing = await findProductBySku(cleanSku, token);
  if (!existing?.id) {
    token = await getTifawtToken({ force: true });
    existing = await findProductBySku(cleanSku, token);
  }
  if (!existing?.id) {
    return { ok: false, skipped: true, reason: 'product_not_found', tifawtCategoryId };
  }

  const patchOnce = async (authToken) => axios.patch(
    `${API_BASE}/products/${existing.id}`,
    { categoryId: tifawtCategoryId },
    {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
      validateStatus: () => true,
    },
  );

  let res = await patchOnce(token);
  if (res.status === 401) {
    token = await getTifawtToken({ force: true });
    res = await patchOnce(token);
  }
  if (res.status >= 400) {
    return {
      ok: false,
      error: res.data?.message || `HTTP ${res.status}`,
      tifawtCategoryId,
    };
  }
  return { ok: true, tifawtCategoryId, productId: existing.id };
}

export async function listTifawtProductCategories(token = null) {
  const fetchOnce = async (authToken) => axios.get(`${API_BASE}/product-categories`, {
    headers: { Authorization: `Bearer ${authToken}` },
    timeout: 30000,
    validateStatus: () => true,
  });

  let authToken = token || await getTifawtToken();
  let { data, status } = await fetchOnce(authToken);
  if (status === 401 && !token) {
    authToken = await getTifawtToken({ force: true });
    ({ data, status } = await fetchOnce(authToken));
  }
  if (status >= 400) {
    throw new Error(data?.message || `HTTP ${status}`);
  }
  return Array.isArray(data) ? data : (data?.data || []);
}

export async function createTifawtProductCategory(name) {
  const token = await getTifawtToken();
  const body = { name: String(name).trim() };
  if (Number.isFinite(BUSINESS_ID) && BUSINESS_ID > 0) {
    body.businessId = BUSINESS_ID;
  }
  const { data, status } = await axios.post(`${API_BASE}/product-categories`, body, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    timeout: 30000,
    validateStatus: () => true,
  });
  if (status >= 400) {
    throw new Error(data?.message || `HTTP ${status}`);
  }
  return data;
}
