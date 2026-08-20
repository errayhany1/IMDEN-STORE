/**
 * Admin actions for inventory ↔ Tifawt linking.
 */
import axios from 'axios';
import {
  getBotSetting,
  updateBotSettings,
} from './runtimeSettings.js';
import {
  parseTifawtSkuAliases,
  normalizeAliasKey,
  toTifawtSku,
} from './tifawtSku.js';

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

export async function linkNocoToTifawt({ nocoSku, tifawtSku }) {
  const from = normalizeAliasKey(nocoSku);
  const to = toTifawtSku(tifawtSku);
  if (!from || !to) {
    const error = new Error('invalid_link_payload');
    error.statusCode = 400;
    throw error;
  }
  const map = readAliasMap();
  map.set(from, to);
  await updateBotSettings({ tifawtSkuAliases: aliasesToText(map) });
  return { ok: true, from, to, aliases: Object.fromEntries(map) };
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

  const { data, status: httpStatus } = await axios.patch(
    `${url}/api/v2/tables/${table}/records`,
    [payload],
    {
      headers: { 'xc-token': token, 'Content-Type': 'application/json' },
      timeout: 30000,
      validateStatus: () => true,
    },
  );
  if (httpStatus >= 400) {
    const error = new Error(data?.msg || data?.message || 'nocodb_update_failed');
    error.statusCode = httpStatus;
    throw error;
  }
  return { ok: true, nocoId: id, postebl: status, record: data?.[0] || null };
}

export function registerInventoryAdminRoutes(app, { requireAdmin }) {
  app.get('/api/admin/inventory/reconcile', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const { loadInventoryReconcile } = await import('./inventoryReconcile.js');
      const result = await loadInventoryReconcile();
      return res.json({ ok: true, ...result });
    } catch (error) {
      console.error('[admin] inventory reconcile failed:', error?.message || error);
      return res.status(error?.statusCode || 502).json({
        ok: false,
        error: error?.message || 'inventory_reconcile_failed',
      });
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
