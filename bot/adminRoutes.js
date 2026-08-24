/**
 * Shared admin HTTP routes for /bot-api (tracking) and optionally the bot.
 * Auth: header `X-Admin-Password` must match ADMIN_PASSWORD / VITE_ADMIN_PASSWORD.
 */
import axios from 'axios';
import crypto from 'crypto';
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
  setJumiaProductStock,
} from './jumiaClient.js';
import { ensurePublicImagesForSku } from './jumiaPublicImages.js';
import { resolveJumiaStock } from './jumiaPricing.js';
import {
  getBotSetting,
  publicBotSettingsPayload,
  refreshBotSettings,
  resetBotSettings,
  updateBotSettings,
} from './runtimeSettings.js';
import { registerInventoryAdminRoutes } from './inventoryAdmin.js';
import { registerSocialPublishRoutes } from './socialPublish.js';

function adminPassword() {
  const configured = (
    process.env.ADMIN_PASSWORD
    || process.env.VITE_ADMIN_PASSWORD
    || ''
  );
  if (configured) return configured;
  return process.env.NODE_ENV === 'production' ? '' : 'imden2026';
}

const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const ADMIN_COOKIE_PATH = '/';

function sessionSecret() {
  return String(
    process.env.ADMIN_SESSION_SECRET
    || process.env.BOT_SETTINGS_ENCRYPTION_KEY
    || adminPassword()
    || 'dev-admin-session',
  );
}

function issueSessionToken() {
  const exp = Date.now() + ADMIN_SESSION_TTL_MS;
  const payload = Buffer.from(JSON.stringify({ exp, v: 1 })).toString('base64url');
  const sig = crypto.createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return false;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
  try {
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return false;
  } catch {
    return false;
  }
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof data.exp === 'number' && data.exp > Date.now();
  } catch {
    return false;
  }
}

function adminSessionCookie(token, req, maxAgeSec) {
  const secure = String(req.headers['x-forwarded-proto'] || '').toLowerCase() === 'https';
  const parts = [
    `admin_session=${token}`,
    `Path=${ADMIN_COOKIE_PATH}`,
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSec}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}
const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 6;

function loginKey(req) {
  // nginx overwrites X-Real-IP with the socket peer; unlike a client-supplied
  // X-Forwarded-For chain, this value cannot be rotated to bypass throttling.
  return String(req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown').trim();
}

function isLoginRateLimited(req) {
  const key = loginKey(req);
  const cutoff = Date.now() - LOGIN_WINDOW_MS;
  const attempts = (loginAttempts.get(key) || []).filter((time) => time > cutoff);
  loginAttempts.set(key, attempts);
  return attempts.length >= LOGIN_MAX_ATTEMPTS;
}

function recordLoginFailure(req) {
  const key = loginKey(req);
  const attempts = loginAttempts.get(key) || [];
  attempts.push(Date.now());
  loginAttempts.set(key, attempts);
}

function parseCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || '')
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf('=');
        return index < 0
          ? [part, '']
          : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      }),
  );
}

function passwordMatches(provided) {
  const expected = Buffer.from(String(adminPassword()));
  const actual = Buffer.from(String(provided || ''));
  return expected.length > 0
    && expected.length === actual.length
    && crypto.timingSafeEqual(expected, actual);
}

function activeSession(req) {
  return verifySessionToken(parseCookies(req).admin_session);
}

function requireAdmin(req, res) {
  if (activeSession(req)) return true;
  const provided = String(
    req.headers['x-admin-password']
    || req.headers['x-admin-secret']
    || req.body?.password
    || '',
  ).trim();
  if (!provided || !passwordMatches(provided)) {
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
  const sku = buildSellerSku(row.SellerSKU || row.SKU || row.Ref || row.sku);
  const imageUrls = collectImageUrls(row, nocodbUrl);
  return {
    sellerSku: sku,
    referenceClean: String(row.SKU || row.Ref || '').replace(/^ERY[-_]?/i, ''),
    price: Number(row.price || row.Price || row.OldPrice || 0) || 0,
    wholesalePrice: Number(row.price || row.Price || row.OldPrice || 0) || 0,
    postebl: row.POSTEBL || row.Postebl || 'POSTEBL',
    frenchTitle: row.French_Title || row.Title || row.title || sku,
    arabicTitle: row.Arabic_Title || row.Title || row.title || sku,
    shortFr: row.Short_FR || row.short_fr || '',
    shortAr: row.Short_AR || row.short_ar || '',
    descriptionFr: row.description_french || row.Description_FR || row.French_Description || row.Description || '',
    descriptionAr: row.description_arabic || row.Description_AR || row.Arabic_Description || '',
    brand: row.Brand || getBotSetting('jumiaDefaultBrand'),
    color: row.Color || getBotSetting('jumiaDefaultColor'),
    colorFamily: row.Color_Family || row.Color || getBotSetting('jumiaDefaultColorFamily'),
    variation: row.Variation || getBotSetting('jumiaDefaultVariation'),
    productWeight: row.Weight || getBotSetting('jumiaDefaultWeight'),
    jumiaCategory: row.Jumia_Category || getBotSetting('jumiaDefaultCategory'),
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
  app.post('/api/admin/session', (req, res) => {
    if (isLoginRateLimited(req)) {
      return res.status(429).json({ ok: false, error: 'too_many_attempts' });
    }
    if (!passwordMatches(req.body?.password)) {
      recordLoginFailure(req);
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }
    loginAttempts.delete(loginKey(req));
    const token = issueSessionToken();
    res.setHeader(
      'Set-Cookie',
      adminSessionCookie(token, req, Math.floor(ADMIN_SESSION_TTL_MS / 1000)),
    );
    return res.json({ ok: true });
  });

  app.get('/api/admin/session', (req, res) => (
    activeSession(req)
      ? res.json({ ok: true })
      : res.status(401).json({ ok: false, error: 'unauthorized' })
  ));

  app.delete('/api/admin/session', (req, res) => {
    res.setHeader('Set-Cookie', adminSessionCookie('', req, 0));
    return res.json({ ok: true });
  });

  app.get('/api/admin/bot/settings', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      await refreshBotSettings({ strict: true });
      return res.json({ ok: true, ...publicBotSettingsPayload() });
    } catch (error) {
      return res.status(503).json({ ok: false, error: error.message || 'settings_unavailable' });
    }
  });

  app.patch('/api/admin/bot/settings', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      await updateBotSettings(req.body?.settings || req.body || {});
      return res.json({ ok: true, ...publicBotSettingsPayload() });
    } catch (error) {
      console.error('[admin] bot settings update failed:', error.message);
      return res.status(500).json({ ok: false, error: 'settings_update_failed' });
    }
  });

  app.post('/api/admin/bot/settings/reset', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      await resetBotSettings();
      return res.json({ ok: true, ...publicBotSettingsPayload() });
    } catch (error) {
      console.error('[admin] bot settings reset failed:', error.message);
      return res.status(500).json({ ok: false, error: 'settings_reset_failed' });
    }
  });

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

  /**
   * Re-host NocoDB images under durable /public-images/p/{sku}/n.jpg URLs
   * (NocoDB-backed proxy — survives EasyPanel redeploys).
   */
  app.post('/api/admin/products/:sku/rehost-images', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const sku = buildSellerSku(req.params.sku) || req.params.sku;
      const result = await ensurePublicImagesForSku(sku);
      if (!result.ok) {
        return res.status(400).json(result);
      }
      return res.json(result);
    } catch (error) {
      return res.status(error?.statusCode || 502).json({
        ok: false,
        error: error?.message || 'rehost_failed',
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
      console.error('[admin] publish jumia failed:', error?.response?.data || error.details || error.message);
      return res.status(error?.statusCode || 502).json({
        ok: false,
        error: error?.message || 'publish_failed',
        details: error?.details || error?.response?.data || null,
      });
    }
  });

  app.post('/api/admin/products/:sku/jumia-stock', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      if (!isJumiaConfigured()) {
        return res.status(503).json({ ok: false, error: 'jumia_not_configured' });
      }
      const sku = buildSellerSku(req.params.sku) || req.params.sku;
      let stock = req.body?.stock;
      if (stock == null) {
        const row = await findNocoProductBySku(req.params.sku);
        stock = resolveJumiaStock(row?.POSTEBL || row?.Postebl || 'POSTEBL');
      }
      const result = await setJumiaProductStock(sku, stock);
      return res.json(result);
    } catch (error) {
      return res.status(error?.statusCode || 502).json({
        ok: false,
        error: error?.message || 'stock_failed',
        details: error?.details || null,
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

  registerInventoryAdminRoutes(app, { requireAdmin });
  registerSocialPublishRoutes(app, { requireAdmin });
}
