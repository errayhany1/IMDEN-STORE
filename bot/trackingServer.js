/**
 * Standalone order-tracking API (no Telegram).
 * Runs beside nginx in the storefront container so /bot-api works
 * without depending on the separate imden-bot service network.
 */
import express from 'express';
import axios from 'axios';
import { getCustomerOrders, normalizePhone } from './tifawtOrders.js';
import { verifyFirebaseIdToken, verifyPhoneIdToken } from './firebasePhoneToken.js';
import { resolveLinkedPhone } from './linkedCustomerPhone.js';
import { isTifawtApiConfigured } from './tifawtClient.js';
import {
  fetchJumiaOrderForTifawt,
  getRecentOrders,
  isJumiaConfigured,
  mapJumiaOrderToTifawt,
  getOrderItems,
  orderIdOf as jumiaOrderIdOf,
  shipJumiaOrder,
  cancelJumiaOrder,
  printJumiaLabels,
  normalizeJumiaOrderId,
} from './jumiaClient.js';
import { registerAdminRoutes } from './adminRoutes.js';
import { registerPublicImageRoutes } from './jumiaPublicImages.js';
import { resolveTifawtOrderSku } from './tifawtSku.js';
import { getBotSetting, startBotSettingsSync } from './runtimeSettings.js';
import {
  createBundledTifawtLead,
  isBundledTifawtLeadConfigured,
} from './tifawtLeadCreate.js';

startBotSettingsSync();

const app = express();
// Public Jumia images: register before the small JSON body limit so uploads can be multi-MB.
registerPublicImageRoutes(app);
app.use(express.json({ limit: '256kb' }));
registerAdminRoutes(app);

const PORT = Number(process.env.TRACKING_PORT || process.env.PORT || 3001);
const TIFAWT_LEAD_URL = (
  process.env.TIFAWT_LEAD_URL
  || process.env.VITE_TIFAWT_LEAD_URL
  || ''
).trim();
const JUMIA_POLL_MS = Math.max(0, Number(process.env.JUMIA_POLL_MS || 120_000) || 0);
const TELEGRAM_NOTIFY_BOT_TOKEN = (
  process.env.TELEGRAM_NOTIFY_BOT_TOKEN
  || process.env.VITE_TELEGRAM_BOT_TOKEN
  || process.env.TELEGRAM_BOT_TOKEN
  || ''
).trim();
const TELEGRAM_NOTIFY_CHAT_ID = (
  process.env.TELEGRAM_NOTIFY_CHAT_ID
  || process.env.VITE_TELEGRAM_CHAT_ID
  || process.env.TELEGRAM_CHAT_ID
  || ''
).trim();

const trackingHits = new Map();
const TRACKING_WINDOW_MS = 60_000;
const TRACKING_MAX_PER_WINDOW = 20;

// The storefront container receives /bot-api requests. Keep the idempotency
// cache here as well as in server.js, otherwise a checkout would 404 before
// reaching the separate Telegram bot service.
const ORDER_SYNC_TTL_MS = 24 * 60 * 60 * 1000;
const syncedStoreOrders = new Map();
const inFlightStoreOrders = new Map();

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function cleanupOrderSyncCache() {
  const cutoff = Date.now() - ORDER_SYNC_TTL_MS;
  for (const [key, value] of syncedStoreOrders) {
    if (value.completedAt < cutoff) syncedStoreOrders.delete(key);
  }
}

function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  const aliases = getBotSetting('tifawtSkuAliases') || '';
  return items.map((item) => ({
    sku: resolveTifawtOrderSku(
      item?.ref || item?.sku || item?.SKU || item?.id,
      aliases,
    ),
    quantity: Math.max(1, Number(item?.qty ?? item?.quantity ?? 1) || 1),
    unitPrice: Math.max(0, Number(item?.price ?? item?.unitPrice ?? 0) || 0),
  })).filter((item) => item.sku);
}

function isTransient(error) {
  const status = error?.response?.status;
  return !status || status === 408 || status === 429 || status >= 500;
}

function parseOrderMetadata(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function orderInputFromRequest(req) {
  const body = req.body || {};
  // NocoDB sends `{ data: { rows: [...] } }`; the storefront sends the
  // compact shape directly. Both paths deliberately converge here.
  const row = body?.data?.rows?.[0] || body;
  const isNocoRow = Boolean(row?.['Customer Name'] || row?.['Order Metadata']);
  if (!isNocoRow) {
    return {
      orderId: req.get('X-Store-Order-Id') || body.orderId,
      name: body.name,
      phone: body.phone,
      address: body.address,
      city: body.city,
      items: body.items,
    };
  }

  const items = parseOrderMetadata(row['Order Metadata']);
  return {
    orderId: req.get('X-Store-Order-Id') || row['Store Order ID'] || items?.[0]?.storeOrderId || row.Id || row.id,
    name: row['Customer Name'],
    phone: row['Customer Phone'],
    address: row['Delivery Address'],
    city: row.City,
    items,
  };
}

async function syncOrderToTifawt({ orderId, name, phone, address, city, items }) {
  const products = normalizeItems(items);
  if (!orderId || !String(name || '').trim() || !String(phone || '').trim() || !products.length) {
    const error = new Error('invalid_order_payload');
    error.statusCode = 400;
    throw error;
  }

  cleanupOrderSyncCache();
  if (syncedStoreOrders.has(orderId)) return { ok: true, duplicate: true, orderId };
  if (inFlightStoreOrders.has(orderId)) return inFlightStoreOrders.get(orderId);

  const task = (async () => {
    // Authenticated /leads keeps every line on one ticket. The public Lead
    // Source endpoint creates a separate lead per products[] entry.
    if (isBundledTifawtLeadConfigured()) {
      const result = await createBundledTifawtLead({
        orderId,
        name,
        phone,
        address,
        city,
        items,
      });
      syncedStoreOrders.set(orderId, { completedAt: Date.now() });
      console.log(
        `[orders] Tifawt bundled lead ${orderId} leadId=${result.leadId} products=${result.productCount}${result.duplicate ? ' (duplicate)' : ''}`,
      );
      return result;
    }

    if (!TIFAWT_LEAD_URL) {
      const error = new Error('tifawt_not_configured');
      error.statusCode = 503;
      throw error;
    }
    if (products.length > 1) {
      const error = new Error(
        'tifawt_multi_product_requires_api: set TIFAWT_EMAIL and TIFAWT_PASSWORD so the order stays one lead',
      );
      error.statusCode = 503;
      throw error;
    }

    let lastError;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const result = await axios.post(TIFAWT_LEAD_URL, {
          customerName: String(name).trim(),
          customerPhone: String(phone).trim(),
          customerAddress: String(address || '').trim(),
          city: String(city || 'المغرب').trim(),
          products,
        }, {
          headers: { 'Content-Type': 'application/json', 'X-Store-Order-Id': orderId },
          timeout: 30000,
        });
        syncedStoreOrders.set(orderId, { completedAt: Date.now() });
        console.log(`[orders] Tifawt synced ${orderId} (${result.status})`);
        return { ok: true, orderId, status: result.status, duplicate: false };
      } catch (error) {
        lastError = error;
        if (!isTransient(error) || attempt === 3) break;
        await wait(500 * (2 ** (attempt - 1)));
      }
    }
    throw lastError || new Error('tifawt_sync_failed');
  })();

  inFlightStoreOrders.set(orderId, task);
  try {
    return await task;
  } finally {
    inFlightStoreOrders.delete(orderId);
  }
}

async function notifyTelegramJumiaOrder(mapped, syncResult) {
  if (!TELEGRAM_NOTIFY_BOT_TOKEN || !TELEGRAM_NOTIFY_CHAT_ID) return;
  if (syncResult?.duplicate) return;

  const lines = (mapped.items || []).map((item) => (
    `• ${item.sku} × ${item.quantity}${item.unitPrice ? ` (${item.unitPrice} DH)` : ''}`
  ));
  const text = [
    '🛒 طلب جديد من Jumia',
    `🆔 ${mapped.orderId}`,
    `👤 ${mapped.name}`,
    `📞 ${mapped.phone}`,
    mapped.city ? `📍 ${mapped.city}` : '',
    mapped.address ? `🏠 ${mapped.address}` : '',
    lines.length ? `📦 المنتجات:\n${lines.join('\n')}` : '',
    '',
    'أوامر البوت: 📦 تجهيز شحن Jumia / ❌ إلغاء طلب Jumia',
  ].filter(Boolean).join('\n');

  try {
    await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_NOTIFY_BOT_TOKEN}/sendMessage`,
      { chat_id: TELEGRAM_NOTIFY_CHAT_ID, text },
      { timeout: 15000 },
    );
  } catch (error) {
    console.error('[jumia] telegram notify failed:', error?.response?.data || error?.message);
  }
}

function trackingRateLimited(key) {
  const now = Date.now();
  const hits = (trackingHits.get(key) || []).filter((t) => now - t < TRACKING_WINDOW_MS);
  hits.push(now);
  trackingHits.set(key, hits);
  if (trackingHits.size > 5000) trackingHits.clear();
  return hits.length > TRACKING_MAX_PER_WINDOW;
}

function extractJumiaOrderId(body = {}) {
  return String(
    body?.payload?.OrderId
    ?? body?.payload?.orderId
    ?? body?.OrderId
    ?? body?.orderId
    ?? body?.order_id
    ?? body?.id
    ?? '',
  ).trim();
}

function isJumiaOrderCreatedEvent(body = {}) {
  const event = String(body?.event || body?.Event || body?.type || '').toLowerCase();
  if (!event) return Boolean(extractJumiaOrderId(body));
  return /^(on)?order[._-]?created$/i.test(event)
    || event === 'order.created'
    || event === 'onordercreated';
}

async function syncJumiaOrderId(orderId) {
  const payload = await fetchJumiaOrderForTifawt(orderId);
  const result = await syncOrderToTifawt(payload);
  await notifyTelegramJumiaOrder(payload, result);
  return result;
}

async function syncRecentJumiaOrders({ createdAfter } = {}) {
  if (!isJumiaConfigured()) {
    const error = new Error('jumia_not_configured');
    error.statusCode = 503;
    throw error;
  }
  if (!TIFAWT_LEAD_URL) {
    const error = new Error('tifawt_not_configured');
    error.statusCode = 503;
    throw error;
  }

  const orders = await getRecentOrders({ createdAfter });
  const results = [];
  for (const order of orders) {
    const id = jumiaOrderIdOf(order);
    if (!id) continue;
    try {
      const items = await getOrderItems(id);
      const mapped = mapJumiaOrderToTifawt(order, items);
      const result = await syncOrderToTifawt(mapped);
      await notifyTelegramJumiaOrder(mapped, result);
      results.push({ orderId: mapped.orderId, ...result });
    } catch (error) {
      results.push({
        orderId: `JUMIA-${id}`,
        ok: false,
        error: error?.message || 'sync_failed',
      });
    }
  }
  return { ok: true, count: results.length, results };
}

app.get('/health', (_req, res) => {
  const tifawtOk = isTifawtApiConfigured() || Boolean(TIFAWT_LEAD_URL);
  res.status(tifawtOk ? 200 : 503).json({
    ok: tifawtOk,
    service: 'imden-tracking',
    tifawt: tifawtOk,
    jumia: isJumiaConfigured(),
    jumiaPollMs: JUMIA_POLL_MS,
  });
});

app.get('/', (_req, res) => {
  res.json({ status: 'tracking ok', service: 'imden-tracking' });
});

/** Checkout → private server-side Tifawt bridge. */
app.post('/api/orders/sync', async (req, res) => {
  try {
    const result = await syncOrderToTifawt(orderInputFromRequest(req));
    return res.status(200).json(result);
  } catch (error) {
    console.error('[orders] Tifawt sync failed:', error?.response?.data || error?.message);
    return res.status(error?.statusCode || 502).json({
      ok: false,
      error: error?.statusCode ? error.message : 'tifawt_sync_failed',
    });
  }
});

/**
 * Jumia webhook callback (Order Created).
 * Payload example: { event: "onOrderCreated", payload: { OrderId: 190 } }
 */
app.post('/api/jumia/webhook', async (req, res) => {
  try {
    if (!isJumiaConfigured()) {
      return res.status(503).json({ ok: false, error: 'jumia_not_configured' });
    }

    const body = req.body || {};
    const orderId = extractJumiaOrderId(body);
    if (!orderId) {
      return res.status(400).json({ ok: false, error: 'missing_order_id' });
    }

    // StatusChanged etc. are acknowledged without creating a duplicate lead.
    if (!isJumiaOrderCreatedEvent(body)) {
      return res.status(200).json({ ok: true, ignored: true, orderId });
    }

    const result = await syncJumiaOrderId(orderId);
    return res.status(200).json(result);
  } catch (error) {
    console.error('[jumia] webhook sync failed:', error?.response?.data || error?.message);
    return res.status(error?.statusCode || 502).json({
      ok: false,
      error: error?.statusCode ? error.message : 'jumia_webhook_failed',
    });
  }
});

/** Manual / scheduled sync of recent Jumia orders into Tifawt. */
app.post('/api/jumia/sync', async (req, res) => {
  try {
    const createdAfter = req.body?.createdAfter
      || new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const result = await syncRecentJumiaOrders({ createdAfter });
    return res.status(200).json(result);
  } catch (error) {
    console.error('[jumia] sync failed:', error?.response?.data || error?.message);
    return res.status(error?.statusCode || 502).json({
      ok: false,
      error: error?.statusCode ? error.message : 'jumia_sync_failed',
    });
  }
});

/** Pack + Ready To Ship for a Jumia order. */
app.post('/api/jumia/orders/:orderId/ship', async (req, res) => {
  try {
    if (!isJumiaConfigured()) {
      return res.status(503).json({ ok: false, error: 'jumia_not_configured' });
    }
    const orderId = normalizeJumiaOrderId(req.params.orderId || req.body?.orderId);
    if (!orderId) return res.status(400).json({ ok: false, error: 'missing_order_id' });
    const result = await shipJumiaOrder(orderId);
    return res.status(200).json(result);
  } catch (error) {
    console.error('[jumia] ship failed:', error?.response?.data || error?.details || error?.message);
    return res.status(error?.statusCode || 502).json({
      ok: false,
      error: error?.message || 'jumia_ship_failed',
      details: error?.details || null,
    });
  }
});

/** Cancel all items of a Jumia order. */
app.post('/api/jumia/orders/:orderId/cancel', async (req, res) => {
  try {
    if (!isJumiaConfigured()) {
      return res.status(503).json({ ok: false, error: 'jumia_not_configured' });
    }
    const orderId = normalizeJumiaOrderId(req.params.orderId || req.body?.orderId);
    if (!orderId) return res.status(400).json({ ok: false, error: 'missing_order_id' });
    const result = await cancelJumiaOrder(orderId);
    return res.status(200).json(result);
  } catch (error) {
    console.error('[jumia] cancel failed:', error?.response?.data || error?.details || error?.message);
    return res.status(error?.statusCode || 502).json({
      ok: false,
      error: error?.message || 'jumia_cancel_failed',
      details: error?.details || null,
    });
  }
});

/** Print shipping labels (JSON/base64 from Jumia). */
app.post('/api/jumia/orders/:orderId/labels', async (req, res) => {
  try {
    if (!isJumiaConfigured()) {
      return res.status(503).json({ ok: false, error: 'jumia_not_configured' });
    }
    const orderId = normalizeJumiaOrderId(req.params.orderId || req.body?.orderId);
    if (!orderId) return res.status(400).json({ ok: false, error: 'missing_order_id' });
    const result = await printJumiaLabels(orderId);
    return res.status(200).json(result);
  } catch (error) {
    console.error('[jumia] labels failed:', error?.response?.data || error?.details || error?.message);
    return res.status(error?.statusCode || 502).json({
      ok: false,
      error: error?.message || 'jumia_labels_failed',
      details: error?.details || null,
    });
  }
});

app.post('/api/orders/track', async (req, res) => {
  const clientKey = req.headers['x-forwarded-for'] || req.ip || 'unknown';
  if (trackingRateLimited(String(clientKey))) {
    return res.status(429).json({ ok: false, error: 'rate_limited' });
  }

  const verified = await verifyPhoneIdToken(req.body?.idToken);
  if (!verified.ok) {
    return res.status(401).json({ ok: false, error: verified.error });
  }

  try {
    const result = await getCustomerOrders(verified.phone);
    if (!result.ok) {
      return res.status(result.error === 'tifawt_not_configured' ? 503 : 400).json(result);
    }
    return res.json({
      ok: true,
      phone: normalizePhone(verified.phone),
      orders: result.orders,
    });
  } catch (err) {
    console.error('[tracking] lookup failed:', err?.response?.data || err.message);
    return res.status(502).json({ ok: false, error: 'tifawt_unavailable' });
  }
});

app.post('/api/orders/account', async (req, res) => {
  const clientKey = req.headers['x-forwarded-for'] || req.ip || 'unknown';
  if (trackingRateLimited(`acct:${clientKey}`)) {
    return res.status(429).json({ ok: false, error: 'rate_limited' });
  }

  const identity = await verifyFirebaseIdToken(req.body?.idToken);
  if (!identity.ok) {
    return res.status(401).json({ ok: false, error: identity.error });
  }

  const linked = await resolveLinkedPhone({
    uid: identity.uid,
    authPhone: identity.phone,
    idToken: req.body?.idToken,
  });
  if (!linked.ok) {
    return res.status(403).json({
      ok: false,
      error: linked.error || 'phone_not_linked',
      requiresPhoneVerification: true,
    });
  }

  try {
    const result = await getCustomerOrders(linked.phone);
    if (!result.ok) {
      return res.status(result.error === 'tifawt_not_configured' ? 503 : 400).json(result);
    }
    return res.json({
      ok: true,
      phone: linked.phone,
      email: identity.email || '',
      orders: result.orders,
    });
  } catch (err) {
    console.error('[account] lookup failed:', err?.response?.data || err.message);
    return res.status(502).json({ ok: false, error: 'tifawt_unavailable' });
  }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(
    `📦 Tracking API on 127.0.0.1:${PORT} (tifawt=${Boolean(TIFAWT_LEAD_URL)} jumia=${isJumiaConfigured()} poll=${JUMIA_POLL_MS}ms notify=${Boolean(TELEGRAM_NOTIFY_BOT_TOKEN && TELEGRAM_NOTIFY_CHAT_ID)})`,
  );
});

if (JUMIA_POLL_MS > 0 && isJumiaConfigured()) {
  const poll = async () => {
    try {
      const createdAfter = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const result = await syncRecentJumiaOrders({ createdAfter });
      if (result.count) {
        console.log(`[jumia] poll synced ${result.count} order(s)`);
      }
    } catch (error) {
      console.error('[jumia] poll failed:', error?.response?.data || error?.message);
    }
  };
  setTimeout(poll, 15_000);
  setInterval(poll, JUMIA_POLL_MS);
}
