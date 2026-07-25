/**
 * Standalone order-tracking API (no Telegram).
 * Runs beside nginx in the storefront container so /bot-api works
 * without depending on the separate imden-bot service network.
 */
import express from 'express';
import { getCustomerOrders, normalizePhone } from './tifawtOrders.js';
import { verifyFirebaseIdToken, verifyPhoneIdToken } from './firebasePhoneToken.js';
import { resolveLinkedPhone } from './linkedCustomerPhone.js';
import { isTifawtApiConfigured } from './tifawtClient.js';

const app = express();
app.use(express.json({ limit: '256kb' }));

const PORT = Number(process.env.TRACKING_PORT || process.env.PORT || 3001);

const trackingHits = new Map();
const TRACKING_WINDOW_MS = 60_000;
const TRACKING_MAX_PER_WINDOW = 20;

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
