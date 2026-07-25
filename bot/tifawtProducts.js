/**
 * Create products in Tifawt ERP from the Telegram bot.
 * Sends: image + name + selling price + SKU (reference).
 * Auth: email/password login → Bearer accessToken (cached in memory).
 */
import axios from 'axios';
import FormData from 'form-data';
import {
  API_BASE,
  BUSINESS_ID,
  getTifawtToken,
  isTifawtApiConfigured,
} from './tifawtClient.js';

export function isTifawtProductSyncConfigured() {
  return isTifawtApiConfigured();
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
    const token = await getTifawtToken();
    return await attempt(token);
  } catch (err) {
    const status = err?.response?.status;
    if (status === 401) {
      const token = await getTifawtToken({ force: true });
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
