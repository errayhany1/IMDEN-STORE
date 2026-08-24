/**
 * Admin actions for inventory ↔ Tifawt linking.
 */
import axios from 'axios';
import {
  getBotSetting,
  updateBotSettings,
  refreshBotSettings,
} from './runtimeSettings.js';
import {
  parseTifawtSkuAliases,
  normalizeAliasKey,
  toTifawtSku,
} from './tifawtSku.js';
import { tifawtApiRequest } from './tifawtClient.js';

function nocodbConfig() {
  return {
    url: (process.env.VITE_NOCODB_URL || process.env.NOCODB_URL || '').replace(/\/+$/, ''),
    token: process.env.VITE_NOCODB_API_TOKEN || process.env.NOCODB_API_TOKEN || '',
    table: process.env.VITE_NOCODB_TABLE_PRODUCTS || process.env.NOCODB_TABLE_PRODUCTS || '',
  };
}

function aliasesToText(map) {
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([from, to]) => `${from}=${to}`)
    .join('\n');
}

function readAliasMap() {
  return parseTifawtSkuAliases(getBotSetting('tifawtSkuAliases') || '');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function patchNocoRecord(payload, { retries = 4 } = {}) {
  const { url, token, table } = nocodbConfig();
  if (!url || !token || !table) {
    const error = new Error('nocodb_not_configured');
    error.statusCode = 503;
    throw error;
  }

  let lastError = null;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const { data, status: httpStatus } = await axios.patch(
      `${url}/api/v2/tables/${table}/records`,
      [payload],
      {
        headers: { 'xc-token': token, 'Content-Type': 'application/json' },
        timeout: 30000,
        validateStatus: () => true,
      },
    );
    if (httpStatus < 400) return data?.[0] || null;
    lastError = new Error(data?.msg || data?.message || `nocodb_http_${httpStatus}`);
    lastError.statusCode = httpStatus;
    if (httpStatus !== 429 && httpStatus !== 408 && !(httpStatus >= 500 && httpStatus < 600)) {
      throw lastError;
    }
    await sleep(600 * (2 ** (attempt - 1)));
  }
  throw lastError;
}

async function findNocoRecordByIdOrSku({ nocoId, nocoSku }) {
  const { url, token, table } = nocodbConfig();
  if (!url || !token || !table) {
    const error = new Error('nocodb_not_configured');
    error.statusCode = 503;
    throw error;
  }

  const fields = 'Id,SKU,SellerSKU,reference_clean,Arabic_Title,French_Title,Title,Woo_Title,POSTEBL';
  const id = Number(nocoId);
  if (id) {
    const { data, status } = await axios.get(`${url}/api/v2/tables/${table}/records`, {
      headers: { 'xc-token': token, accept: 'application/json' },
      params: { where: `(Id,eq,${id})`, limit: 1, fields },
      timeout: 30000,
      validateStatus: () => true,
    });
    if (status === 429) {
      const error = new Error('nocodb_http_429');
      error.statusCode = 429;
      throw error;
    }
    if (status < 400 && data?.list?.[0]) return data.list[0];
  }

  const sku = String(nocoSku || '').trim();
  if (!sku) return null;
  const escaped = sku.replace(/"/g, '\\"');
  const { data, status } = await axios.get(`${url}/api/v2/tables/${table}/records`, {
    headers: { 'xc-token': token, accept: 'application/json' },
    params: { where: `(SKU,eq,${escaped})`, limit: 5, fields },
    timeout: 30000,
    validateStatus: () => true,
  });
  if (status >= 400) {
    const error = new Error(data?.msg || data?.message || `nocodb_http_${status}`);
    error.statusCode = status;
    throw error;
  }
  const list = data?.list || [];
  return list.find((r) => String(r.SKU || '').trim().toUpperCase() === sku.toUpperCase()) || list[0] || null;
}

async function fetchTifawtProductBySku(sku) {
  const needle = String(sku || '').trim();
  if (!needle) return null;
  const { data, status } = await tifawtApiRequest('get', '/products', {
    params: { search: needle, limit: 30 },
    timeout: 30000,
  });
  if (status >= 400) {
    const error = new Error(data?.message || `tifawt_http_${status}`);
    error.statusCode = status;
    if (status === 401) error.code = 'tifawt_unauthorized';
    throw error;
  }
  const list = data?.data || data?.products || data?.items || data?.list || [];
  if (!Array.isArray(list)) return null;
  const want = needle.toLowerCase();
  return list.find((p) => String(p.sku || '').trim().toLowerCase() === want)
    || list.find((p) => String(p.sku || '').trim().toLowerCase() === toTifawtSku(needle).toLowerCase())
    || null;
}

/**
 * Link site SKU → Tifawt SKU, then copy Tifawt name + reference into NocoDB.
 */
export async function linkNocoToTifawt({ nocoSku, tifawtSku, nocoId } = {}) {
  const from = normalizeAliasKey(nocoSku);
  const to = toTifawtSku(tifawtSku);
  if (!from || !to) {
    const error = new Error('invalid_link_payload');
    error.statusCode = 400;
    throw error;
  }

  const tifawtProduct = await fetchTifawtProductBySku(to);
  if (!tifawtProduct) {
    const error = new Error('tifawt_product_not_found');
    error.statusCode = 404;
    throw error;
  }

  const tifawtName = String(tifawtProduct.name || '').trim();
  const tifawtRef = String(tifawtProduct.sku || to).trim();
  if (!tifawtName || !tifawtRef) {
    const error = new Error('tifawt_product_incomplete');
    error.statusCode = 502;
    throw error;
  }

  const record = await findNocoRecordByIdOrSku({ nocoId, nocoSku: from });
  if (!record?.Id) {
    const error = new Error('noco_product_not_found');
    error.statusCode = 404;
    throw error;
  }

  const nocoPatch = {
    Id: record.Id,
    // Keep catalog SKU (often ERY-…); store Tifawt reference on seller/ref fields.
    SellerSKU: tifawtRef,
    reference_clean: tifawtRef,
    Arabic_Title: tifawtName,
    Title: tifawtName,
  };
  if (!String(record.French_Title || '').trim()) nocoPatch.French_Title = tifawtName;
  if (!String(record.Woo_Title || '').trim()) nocoPatch.Woo_Title = tifawtName;

  const updated = await patchNocoRecord(nocoPatch);

  const map = readAliasMap();
  map.set(from, to);
  await updateBotSettings({ tifawtSkuAliases: aliasesToText(map) });

  try {
    const { invalidateInventoryReconcileCache } = await import('./inventoryReconcile.js');
    invalidateInventoryReconcileCache();
  } catch {
    /* ignore */
  }

  return {
    ok: true,
    from,
    to,
    nocoId: record.Id,
    tifawtName,
    tifawtRef,
    nocoUpdated: Boolean(updated),
    aliases: Object.fromEntries(map),
  };
}

export async function unlinkNocoSku({ nocoSku }) {
  const from = normalizeAliasKey(nocoSku);
  if (!from) {
    const error = new Error('invalid_unlink_payload');
    error.statusCode = 400;
    throw error;
  }
  const map = readAliasMap();
  const removed = map.get(from);
  map.delete(from);
  await updateBotSettings({ tifawtSkuAliases: aliasesToText(map) });
  try {
    const { invalidateInventoryReconcileCache } = await import('./inventoryReconcile.js');
    invalidateInventoryReconcileCache();
  } catch {
    /* ignore */
  }
  return { ok: true, removed: removed || null, aliases: Object.fromEntries(map) };
}

export async function setNocoProductPostebl({ nocoId, postebl }) {
  const { url, token, table } = nocodbConfig();
  if (!url || !token || !table) {
    const error = new Error('nocodb_not_configured');
    error.statusCode = 503;
    throw error;
  }
  const id = Number(nocoId);
  const status = String(postebl || '').trim().toUpperCase();
  if (!id || !['POSTEBL', 'NO POSTEBL', 'PAUSED'].includes(status)) {
    const error = new Error('invalid_postebl');
    error.statusCode = 400;
    throw error;
  }

  const payload = { Id: id, POSTEBL: status };
  if (status === 'NO POSTEBL') {
    payload.Category_ID = 15;
    payload.category_id = 15;
  }

  const record = await patchNocoRecord(payload);
  try {
    const { invalidateInventoryReconcileCache } = await import('./inventoryReconcile.js');
    invalidateInventoryReconcileCache();
  } catch {
    /* ignore */
  }
  return { ok: true, nocoId: id, postebl: status, record };
}

/**
 * Reported with HTTP 200 so a failed upstream never looks like the storefront
 * itself is down; the page reads `status` instead of the transport code.
 */
function reconcileFailurePayload(error) {
  const isTifawtAuth = error?.statusCode === 401 || error?.code === 'tifawt_unauthorized';
  const isRateLimit = error?.statusCode === 429 || /nocodb_http_429/i.test(error?.message || '');
  return {
    ok: false,
    status: 'error',
    error: isTifawtAuth
      ? 'tifawt_unauthorized'
      : (error?.message || 'inventory_reconcile_failed'),
    hint: isTifawtAuth
      ? 'تحقق من TIFAWT_EMAIL و TIFAWT_PASSWORD على سيرفر البوت (EasyPanel).'
      : isRateLimit
        ? 'NocoDB يرفض الطلبات الكثيرة مؤقتاً. انتظر دقيقة ثم اضغط إعادة المحاولة.'
        : '',
  };
}

export function registerInventoryAdminRoutes(app, { requireAdmin }) {
  app.get('/api/admin/inventory/reconcile', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const force = req.query.force === '1';
    try {
      // Polling / post-link force must not re-read settings from NocoDB; that
      // burst trips rate limits. Only refresh settings when explicitly asked.
      if (force && req.query.settings === '1') {
        await refreshBotSettings().catch((e) => {
          console.warn('[admin] settings refresh skipped:', e?.message || e);
        });
      }
      const {
        loadInventoryReconcile,
        inventoryReconcileError,
      } = await import('./inventoryReconcile.js');
      const result = await loadInventoryReconcile({ background: true, force });

      if (result.status === 'loading') {
        const failure = inventoryReconcileError();
        if (failure) return res.json(reconcileFailurePayload(failure));
        return res.json({ ok: true, status: 'loading' });
      }

      return res.json({ ok: true, ...result });
    } catch (error) {
      console.error('[admin] inventory reconcile failed:', error?.message || error);
      return res.json(reconcileFailurePayload(error));
    }
  });

  app.get('/api/admin/inventory/export/:kind', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const { loadInventoryReconcile, reconcileToCsvFiles } = await import('./inventoryReconcile.js');
      const reconcile = await loadInventoryReconcile();
      const files = reconcileToCsvFiles(reconcile);
      const kind = String(req.params.kind || '').trim();
      const map = {
        'tifawt-not-noco': {
          filename: 'tifawt-stocked-not-in-nocodb.csv',
          body: files.tifawtStockedNotInNoco,
        },
        'noco-unlinked': {
          filename: 'noco-postebl-unlinked-tifawt.csv',
          body: files.nocoPosteblUnlinked,
        },
        matched: {
          filename: 'tifawt-noco-matched-ok.csv',
          body: files.matchedOk,
        },
      };
      const entry = map[kind];
      if (!entry) return res.status(404).json({ ok: false, error: 'unknown_export_kind' });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${entry.filename}"`);
      return res.send(`\uFEFF${entry.body}`);
    } catch (error) {
      return res.status(error?.statusCode || 502).json({
        ok: false,
        error: error?.message || 'inventory_export_failed',
      });
    }
  });

  app.post('/api/admin/inventory/link', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const result = await linkNocoToTifawt(req.body || {});
      return res.json(result);
    } catch (error) {
      return res.status(error?.statusCode || 500).json({
        ok: false,
        error: error?.message || 'link_failed',
      });
    }
  });

  app.post('/api/admin/inventory/unlink', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const result = await unlinkNocoSku(req.body || {});
      return res.json(result);
    } catch (error) {
      return res.status(error?.statusCode || 500).json({
        ok: false,
        error: error?.message || 'unlink_failed',
      });
    }
  });

  app.post('/api/admin/inventory/noco-status', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const result = await setNocoProductPostebl(req.body || {});
      return res.json(result);
    } catch (error) {
      return res.status(error?.statusCode || 500).json({
        ok: false,
        error: error?.message || 'noco_status_failed',
      });
    }
  });
}
