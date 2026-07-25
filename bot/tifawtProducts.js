/**
 * Create products in Tifawt ERP from the Telegram bot.
 * Tifawt always receives the seller's ORIGINAL payload:
 * - caption name (not AI title)
 * - caption SKU/reference as typed (not ERY- rewritten)
 * - original photos in the same order they were sent
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
 * @param {{
 *   name: string,
 *   sku: string,
 *   price: number,
 *   barcode?: string,
 *   imageBuffer?: Buffer,
 *   imageBuffers?: Buffer[],
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

  const imageBuffers = (
    product.imageBuffers?.length
      ? product.imageBuffers
      : (product.imageBuffer ? [product.imageBuffer] : [])
  ).filter((b) => b?.length);

  const attempt = async (token) => {
    const form = new FormData();
    form.append('name', name);
    form.append('sku', sku);
    form.append('price', String(price));
    if (product.barcode) {
      form.append('barcode', String(product.barcode).trim());
    }
    if (Number.isFinite(BUSINESS_ID) && BUSINESS_ID > 0) {
      form.append('businessId', String(BUSINESS_ID));
    }

    // Keep seller order: first photo is primary `image`, then extras as images[].
    imageBuffers.forEach((buf, index) => {
      const filename = index === 0
        ? (product.imageFileName || `${sku}-1.jpg`)
        : `${sku}-${index + 1}.jpg`;
      if (index === 0) {
        form.append('image', buf, { filename, contentType: 'image/jpeg' });
      }
      form.append('images[]', buf, { filename, contentType: 'image/jpeg' });
    });

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
    return { ok: true, status, data, imageCount: imageBuffers.length };
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
