/**
 * Create products in Tifawt ERP from the Telegram bot.
 * Tifawt always receives the seller's ORIGINAL payload:
 * - caption name (not AI title)
 * - caption SKU/reference as typed (not ERY- rewritten)
 * - original primary photo (Tifawt create API accepts only singular `image`)
 *
 * If the SKU already exists (409), we PATCH the existing product instead of
 * silently dropping the sync — that was why recent products looked "missing".
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

async function findProductBySku(sku, token) {
  const { data, status } = await axios.get(`${API_BASE}/products`, {
    params: { search: sku, limit: 20 },
    headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
    timeout: 30000,
    validateStatus: () => true,
  });
  if (status >= 400) return null;
  const list = data?.data || data?.products || data?.items || data?.list || [];
  if (!Array.isArray(list)) return null;
  const needle = String(sku).trim().toLowerCase();
  return list.find((p) => String(p.sku || '').trim().toLowerCase() === needle) || null;
}

function appendProductFields(form, product, { includeSku = true } = {}) {
  form.append('name', String(product.name || '').trim());
  if (includeSku) form.append('sku', String(product.sku || '').trim());
  form.append('price', String(product.price));
  if (product.barcode) {
    form.append('barcode', String(product.barcode).trim());
  }
  if (Number.isFinite(BUSINESS_ID) && BUSINESS_ID > 0) {
    form.append('businessId', String(BUSINESS_ID));
  }
  if (Number.isFinite(Number(product.categoryId)) && Number(product.categoryId) > 0) {
    form.append('categoryId', String(product.categoryId));
  }
  if (product.imageBuffers?.[0] || product.imageBuffer) {
    const buf = product.imageBuffers?.[0] || product.imageBuffer;
    form.append('image', buf, {
      filename: product.imageFileName || `${product.sku}-1.jpg`,
      contentType: 'image/jpeg',
    });
  }
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
 *   categoryId?: number,
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

  const payload = { ...product, name, sku, price, imageBuffers };

  const createAttempt = async (token) => {
    const form = new FormData();
    appendProductFields(form, payload, { includeSku: true });
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
        validateStatus: () => true,
      }
    );
    if (status === 401) {
      const err = new Error('Unauthorized');
      err.response = { status: 401, data };
      throw err;
    }
    if (status === 409 || /already exists|existe déjà|existe deja/i.test(String(data?.message || ''))) {
      return { conflict: true, status, data };
    }
    if (status >= 400) {
      return {
        ok: false,
        status,
        error: data?.message || `HTTP ${status}`,
        details: data || null,
      };
    }
    return { ok: true, status, data, imageCount: imageBuffers[0] ? 1 : 0, mode: 'created' };
  };

  const updateAttempt = async (token, existingId) => {
    const form = new FormData();
    // Do not resend SKU on update — it already identifies the row.
    appendProductFields(form, payload, { includeSku: false });
    const { data, status } = await axios.patch(
      `${API_BASE}/products/${existingId}`,
      form,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          ...form.getHeaders(),
        },
        timeout: 60000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        validateStatus: () => true,
      }
    );
    if (status === 401) {
      const err = new Error('Unauthorized');
      err.response = { status: 401, data };
      throw err;
    }
    if (status >= 400) {
      return {
        ok: false,
        status,
        error: data?.message || `HTTP ${status}`,
        details: data || null,
      };
    }
    return {
      ok: true,
      status,
      data,
      imageCount: imageBuffers[0] ? 1 : 0,
      mode: 'updated',
      existingId,
    };
  };

  try {
    let token = await getTifawtToken();
    let result;
    try {
      result = await createAttempt(token);
    } catch (err) {
      if (err?.response?.status === 401) {
        token = await getTifawtToken({ force: true });
        result = await createAttempt(token);
      } else {
        throw err;
      }
    }

    if (result?.ok || result?.ok === false && !result?.conflict) {
      if (result?.ok === false) {
        console.error('Tifawt create product failed:', result.status, result.error);
      }
      return result;
    }

    if (result?.conflict) {
      console.warn(`Tifawt SKU "${sku}" already exists — updating existing product`);
      let existing = await findProductBySku(sku, token);
      if (!existing?.id) {
        token = await getTifawtToken({ force: true });
        existing = await findProductBySku(sku, token);
      }
      if (!existing?.id) {
        return {
          ok: false,
          status: 409,
          error: `SKU already exists but product id not found for ${sku}`,
          details: result.data || null,
        };
      }
      try {
        return await updateAttempt(token, existing.id);
      } catch (err) {
        if (err?.response?.status === 401) {
          token = await getTifawtToken({ force: true });
          return updateAttempt(token, existing.id);
        }
        throw err;
      }
    }

    return result;
  } catch (err) {
    const status = err?.response?.status;
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
