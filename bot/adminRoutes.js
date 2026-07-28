/**
 * Shared admin HTTP routes for /bot-api (tracking) and optionally the bot.
 * Auth: header `X-Admin-Password` must match ADMIN_PASSWORD / VITE_ADMIN_PASSWORD.
 */
import axios from 'axios';
import {
  listTifawtOrdersAdmin,
  markTifawtOrderReturned,
} from './tifawtAdminOrders.js';
import {
  createJumiaProduct,
  getRecentOrders,
  getOrderItems,
  isJumiaConfigured,
  mapJumiaOrderToTifawt,
  normalizeJumiaOrderId,
  orderIdOf as jumiaOrderIdOf,
  shipJumiaOrder,
  cancelJumiaOrder,
  printJumiaLabels,
  setJumiaProductActive,
} from './jumiaClient.js';

function adminPassword() {
  return (
    process.env.ADMIN_PASSWORD
    || process.env.VITE_ADMIN_PASSWORD
    || 'imden2026'
  );
}

function requireAdmin(req, res) {
  const provided = String(
    req.headers['x-admin-password']
    || req.headers['x-admin-secret']
    || req.body?.password
    || '',
  ).trim();
  if (!provided || provided !== adminPassword()) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return false;
  }
  return true;
}

function nocodbConfig() {
  const url = (process.env.VITE_NOCODB_URL || process.env.NOCODB_URL || '').replace(/\/$/, '');
  const token = process.env.VITE_NOCODB_API_TOKEN || process.env.NOCODB_API_TOKEN || '';
  const table = process.env.VITE_NOCODB_TABLE_PRODUCTS || process.env.NOCODB_TABLE_PRODUCTS || '';
  return { url, token, table };
}

function fileUrl(file, nocodbUrl) {
  if (!file) return '';
  const raw = file.signedUrl || file.url || file.path || '';
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${nocodbUrl}/${String(raw).replace(/^\//, '')}`;
}

function collectImageUrls(row, nocodbUrl) {
  const urls = [];
  for (const key of ['Image1', 'Image2', 'Image3', 'Image4', 'Image5']) {
    let col = row[key];
    if (!col) continue;
    if (typeof col === 'string') {
      try { col = JSON.parse(col); } catch { continue; }
    }
    const list = Array.isArray(col) ? col : [col];
    for (const f of list) {
      const u = fileUrl(f, nocodbUrl);
      if (u) urls.push(u);
    }
  }
  return [...new Set(urls)];
}

function buildSellerSku(raw) {
  const clean = String(raw || '').trim().replace(/^ERY[-_]?/i, '');
  if (!clean) return '';
  return clean.toUpperCase().startsWith('ERY-') ? clean.toUpperCase() : `ERY-${clean.toUpperCase()}`;
}

function rowToJumiaPayload(row, nocodbUrl) {
  const sku = buildSellerSku(row.SKU || row.Ref || row.sku);
  const imageUrls = collectImageUrls(row, nocodbUrl);
  return {
    sellerSku: sku,
    referenceClean: String(row.SKU || row.Ref || '').replace(/^ERY[-_]?/i, ''),
    price: Number(row.price || row.Price || 0) || 0,
    wholesalePrice: Number(row.price || row.Price || 0) || 0,
    postebl: row.POSTEBL || row.Postebl || 'POSTEBL',
    frenchTitle: row.French_Title || row.Title || row.title || sku,
    arabicTitle: row.Arabic_Title || row.Title || row.title || sku,
    shortFr: row.Short_FR || row.short_fr || '',
    shortAr: row.Short_AR || row.short_ar || '',
    descriptionFr: row.Description_FR || row.French_Description || row.Description || '',
    descriptionAr: row.Description_AR || row.Arabic_Description || '',
    brand: row.Brand || process.env.JUMIA_DEFAULT_BRAND || '1045133 - Generic',
    color: row.Color || 'Multicolore',
    colorFamily: row.Color_Family || row.Color || 'Multicolore',
    variation: row.Variation || '...',
    productWeight: row.Weight || 1,
    jumiaCategory: row.Jumia_Category || process.env.JUMIA_DEFAULT_CATEGORY || '1000040',
    imageUrls,
  };
}

async function findNocoProductBySku(sku) {
  const { url, token, table } = nocodbConfig();
  if (!url || !token || !table) {
    const err = new Error('nocodb_not_configured');
    err.statusCode = 503;
    throw err;
  }
  const needle = String(sku || '').trim();
  if (!needle) {
    const err = new Error('missing_sku');
    err.statusCode = 400;
    throw err;
  }
  const candidates = [
    needle,
    buildSellerSku(needle),
    needle.replace(/^ERY[-_]?/i, ''),
  ];

  for (const q of [...new Set(candidates.filter(Boolean))]) {
    const { data } = await axios.get(`${url}/api/v2/tables/${table}/records`, {
      headers: { 'xc-token': token },
      params: { where: `(SKU,eq,${q})`, limit: 5 },
      timeout: 30000,
    });
    const hit = (data?.list || []).find((r) => {
      const skuVal = String(r.SKU || '').toLowerCase();
      return candidates.some((c) => skuVal === String(c).toLowerCase());
    });
    if (hit) return hit;
  }

  // Fuzzy fallback scan (small catalogs)
  const { data } = await axios.get(`${url}/api/v2/tables/${table}/records`, {
    headers: { 'xc-token': token },
    params: { limit: 200 },
    timeout: 30000,
  });
  const lower = needle.toLowerCase().replace(/^ery-/, '');
  return (data?.list || []).find((r) => {
    const s = String(r.SKU || '').toLowerCase().replace(/^ery-/, '');
    return s === lower || s.includes(lower);
  }) || null;
}

/**
 * @param {import('express').Express} app
 */
export function registerAdminRoutes(app) {
  app.get('/api/admin/tifawt/orders', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const result = await listTifawtOrdersAdmin({
        limit: req.query.limit,
        page: req.query.page,
        search: req.query.search,
        status: req.query.status,
      });
      if (!result.ok) {
        return res.status(result.error === 'tifawt_not_configured' ? 503 : 400).json(result);
      }
      return res.json(result);
    } catch (error) {
      console.error('[admin] tifawt orders failed:', error?.response?.data || error.message);
      return res.status(502).json({ ok: false, error: 'tifawt_unavailable' });
    }
  });

  app.post('/api/admin/tifawt/orders/:id/return', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const result = await markTifawtOrderReturned(req.params.id, {
      reason: req.body?.reason,
    });
    if (!result.ok) {
      return res.status(result.statusCode || 400).json(result);
    }
    return res.json(result);
  });

  app.get('/api/admin/jumia/orders', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      if (!isJumiaConfigured()) {
        return res.status(503).json({ ok: false, error: 'jumia_not_configured' });
      }
      const createdAfter = req.query.createdAfter
        || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const orders = await getRecentOrders({ createdAfter });
      const mapped = [];
      for (const order of orders.slice(0, 40)) {
        const id = jumiaOrderIdOf(order);
        if (!id) continue;
        try {
          const items = await getOrderItems(id);
          mapped.push(mapJumiaOrderToTifawt(order, items));
        } catch (e) {
          mapped.push({
            orderId: `JUMIA-${id}`,
            name: '',
            phone: '',
            items: [],
            error: e.message,
          });
        }
      }
      return res.json({ ok: true, orders: mapped });
    } catch (error) {
      const jumiaError = error?.response?.data?.error || error?.message || 'jumia_unavailable';
      console.error('[admin] jumia orders failed:', error?.response?.data || error.message);
      // Use 503 (not 502): EasyPanel Traefik replaces upstream 502 bodies with its own HTML page.
      return res.status(503).json({
        ok: false,
        error: jumiaError === 'invalid_grant' ? 'jumia_token_expired' : jumiaError,
        hint: jumiaError === 'invalid_grant'
          ? 'Refresh token منتهي — افتح Vendor Center → Applications → lock وأنشئ توكن جديد على imden'
          : undefined,
      });
    }
  });

  app.post('/api/admin/jumia/orders/:orderId/ship', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const orderId = normalizeJumiaOrderId(req.params.orderId);
      const result = await shipJumiaOrder(orderId);
      return res.json(result);
    } catch (error) {
      return res.status(error?.statusCode || 502).json({
        ok: false,
        error: error?.message || 'ship_failed',
        details: error?.details || null,
      });
    }
  });

  app.post('/api/admin/jumia/orders/:orderId/cancel', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const orderId = normalizeJumiaOrderId(req.params.orderId);
      const result = await cancelJumiaOrder(orderId);
      return res.json(result);
    } catch (error) {
      return res.status(error?.statusCode || 502).json({
        ok: false,
        error: error?.message || 'cancel_failed',
        details: error?.details || null,
      });
    }
  });

  app.post('/api/admin/jumia/orders/:orderId/labels', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const orderId = normalizeJumiaOrderId(req.params.orderId);
      const result = await printJumiaLabels(orderId);
      return res.json(result);
    } catch (error) {
      return res.status(error?.statusCode || 502).json({
        ok: false,
        error: error?.message || 'labels_failed',
        details: error?.details || null,
      });
    }
  });

  /** Publish (create) a NocoDB product on Jumia PIM from current title/desc/images. */
  app.post('/api/admin/products/:sku/publish-jumia', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      if (!isJumiaConfigured()) {
        return res.status(503).json({ ok: false, error: 'jumia_not_configured' });
      }
      const { url } = nocodbConfig();
      const row = await findNocoProductBySku(req.params.sku);
      if (!row) {
        return res.status(404).json({ ok: false, error: 'product_not_found' });
      }
      const payload = rowToJumiaPayload(row, url);
      if (!payload.imageUrls.length) {
        return res.status(400).json({ ok: false, error: 'missing_images' });
      }
      const result = await createJumiaProduct(payload);
      if (result?.skipped) {
        return res.status(400).json({ ok: false, ...result });
      }
      if (result?.error) {
        return res.status(502).json({ ok: false, error: result.error, details: result.details });
      }
      return res.json({ ok: true, jumia: result, sellerSku: payload.sellerSku });
    } catch (error) {
      console.error('[admin] publish jumia failed:', error?.response?.data || error.message);
      return res.status(error?.statusCode || 502).json({
        ok: false,
        error: error?.message || 'publish_failed',
      });
    }
  });

  app.post('/api/admin/products/:sku/jumia-visibility', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const active = req.body?.active !== false;
      const sku = buildSellerSku(req.params.sku) || req.params.sku;
      const result = await setJumiaProductActive(sku, active);
      return res.json(result);
    } catch (error) {
      return res.status(error?.statusCode || 502).json({
        ok: false,
        error: error?.message || 'visibility_failed',
        details: error?.details || null,
      });
    }
  });
}
