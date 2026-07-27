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

const app = express();
app.use(express.json({ limit: '256kb' }));

const PORT = Number(process.env.TRACKING_PORT || process.env.PORT || 3001);
const TIFAWT_LEAD_URL = (
  process.env.TIFAWT_LEAD_URL
  || process.env.VITE_TIFAWT_LEAD_URL
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
  return items.map((item) => ({
    sku: String(item?.ref || item?.sku || item?.SKU || item?.id || '').trim(),
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
  if (!TIFAWT_LEAD_URL) {
    const error = new Error('tifawt_not_configured');
    error.statusCode = 503;
    throw error;
  }
  if (!orderId || !String(name || '').trim() || !String(phone || '').trim() || !products.length) {
    const error = new Error('invalid_order_payload');
    error.statusCode = 400;
    throw error;
  }

  cleanupOrderSyncCache();
  if (syncedStoreOrders.has(orderId)) return { ok: true, duplicate: true, orderId };
  if (inFlightStoreOrders.has(orderId)) return inFlightStoreOrders.get(orderId);

  const task = (async () => {
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
        return { ok: true, orderId, status: result.status };
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

function trackingRateLimited(key) {
  const now = Date.now();
  const hits = (trackingHits.get(key) || []).filter((t) => now - t < TRACKING_WINDOW_MS);
  hits.push(now);
  trackingHits.set(key, hits);
  if (trackingHits.size > 5000) trackingHits.clear();
  return hits.length > TRACKING_MAX_PER_WINDOW;
}

app.get('/health', (_req, res) => {
  res.status(isTifawtApiConfigured() ? 200 : 503).json({
    ok: isTifawtApiConfigured(),
    service: 'imden-tracking',
    tifawt: isTifawtApiConfigured(),
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
  console.log(`📦 Tracking API on 127.0.0.1:${PORT} (tifawt=${isTifawtApiConfigured()})`);
});
