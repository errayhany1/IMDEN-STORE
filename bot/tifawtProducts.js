/**
 * Create products in Tifawt ERP from the Telegram bot.
 * Sends: image + name + selling price + SKU (reference).
 * Auth: email/password login → Bearer accessToken (cached in memory).
 */
import axios from 'axios';
import FormData from 'form-data';

const API_BASE = (
  process.env.TIFAWT_API_BASE
  || 'https://errayhany.tifawt.ma/api/v1'
).replace(/\/$/, '');

const BUSINESS_ID = Number(process.env.TIFAWT_BUSINESS_ID || 1);
const EMAIL = (process.env.TIFAWT_EMAIL || '').trim();
const PASSWORD = process.env.TIFAWT_PASSWORD || '';
/** Optional short-lived token (from browser session) — used if password login unavailable. */
const STATIC_TOKEN = (process.env.TIFAWT_ACCESS_TOKEN || '').trim();

let cachedToken = STATIC_TOKEN;
let tokenFetchedAt = STATIC_TOKEN ? Date.now() : 0;
/** Soft TTL — re-login after 6h or on 401. */
const TOKEN_TTL_MS = Number(process.env.TIFAWT_TOKEN_TTL_MS || 6 * 60 * 60 * 1000);

export function isTifawtProductSyncConfigured() {
  return Boolean((EMAIL && PASSWORD) || STATIC_TOKEN || cachedToken);
}

async function login() {
  if (!EMAIL || !PASSWORD) {
    if (STATIC_TOKEN) {
      cachedToken = STATIC_TOKEN;
      tokenFetchedAt = Date.now();
      return STATIC_TOKEN;
    }
    throw new Error('TIFAWT_EMAIL / TIFAWT_PASSWORD missing');
  }
  const { data } = await axios.post(
    `${API_BASE}/auth/login`,
    { email: EMAIL, password: PASSWORD },
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    }
  );
  const token = data?.accessToken;
  if (!token) {
    throw new Error('Tifawt login: no accessToken in response');
  }
  cachedToken = token;
  tokenFetchedAt = Date.now();
  return token;
}

async function getToken({ force = false } = {}) {
  const fresh = cachedToken
    && !force
    && (Date.now() - tokenFetchedAt) < TOKEN_TTL_MS;
  if (fresh) return cachedToken;
  return login();
}

/**
 * Create a product in Tifawt.
 * @param {{
 *   name: string,
 *   sku: string,
 *   price: number,
 *   imageBuffer?: Buffer,
 *   imageFileName?: string,
 * }} product
 */
export async function createTifawtProduct(product) {
  if (!isTifawtProductSyncConfigured()) {
    return { skipped: true, reason: 'no_credentials' };
  }

  const name = String(product.name || '').trim();
  const sku = String(product.sku || '').trim();
  const price = Number(product.price);
  if (!name || !sku || !Number.isFinite(price)) {
    throw new Error('Tifawt product requires name, sku, and numeric price');
  }

  const attempt = async (token) => {
    const form = new FormData();
    form.append('name', name);
    form.append('sku', sku);
    form.append('price', String(price));
    if (Number.isFinite(BUSINESS_ID) && BUSINESS_ID > 0) {
      form.append('businessId', String(BUSINESS_ID));
    }
    if (product.imageBuffer?.length) {
      form.append('image', product.imageBuffer, {
        filename: product.imageFileName || `${sku}.jpg`,
        contentType: 'image/jpeg',
      });
    }

    const { data, status } = await axios.post(
      `${API_BASE}/products`,
      form,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          ...form.getHeaders(),
        },
        timeout: 60000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }
    );
    return { ok: true, status, data };
  };

  try {
    const token = await getToken();
    return await attempt(token);
  } catch (err) {
    const status = err?.response?.status;
    if (status === 401) {
      const token = await getToken({ force: true });
      return attempt(token);
    }
    const msg = err?.response?.data?.message || err?.message || String(err);
    console.error('Tifawt create product failed:', status, msg);
    return {
      ok: false,
      status,
      error: msg,
      details: err?.response?.data || null,
    };
  }
}
