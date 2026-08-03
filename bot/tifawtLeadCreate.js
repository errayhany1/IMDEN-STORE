/**
 * Create one Tifawt lead that contains every ordered product.
 *
 * The public Lead Source endpoint treats each entry in `products[]` as its own
 * lead (rowIndex → separate leadId). Authenticated POST /leads accepts multiple
 * `{ productId, quantity, unitPrice }` lines on a single ticket.
 */
import axios from 'axios';
import {
  API_BASE,
  BUSINESS_ID,
  isTifawtApiConfigured,
  withTifawtToken,
} from './tifawtClient.js';
import { resolveTifawtOrderSku } from './tifawtSku.js';
import { getBotSetting } from './runtimeSettings.js';

const productCache = new Map();

async function findProductBySku(sku, token) {
  const key = String(sku || '').trim().toUpperCase();
  if (!key) return null;
  if (productCache.has(key)) return productCache.get(key);

  const { data, status } = await axios.get(`${API_BASE}/products`, {
    params: { search: key, limit: 30 },
    headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
    timeout: 30000,
    validateStatus: () => true,
  });
  if (status >= 400) {
    productCache.set(key, null);
    return null;
  }
  const list = Array.isArray(data?.data) ? data.data : [];
  const exact = list.find((p) => String(p.sku || '').trim().toUpperCase() === key) || null;
  productCache.set(key, exact);
  return exact;
}

async function findShippingCityId(cityName, token) {
  const needle = String(cityName || '').trim().toLowerCase();
  if (!needle || needle === 'المغرب' || needle === 'morocco') return null;
  const { data, status } = await axios.get(`${API_BASE}/shipping-cities`, {
    params: { search: cityName, limit: 50 },
    headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
    timeout: 30000,
    validateStatus: () => true,
  });
  if (status >= 400) return null;
  const list = Array.isArray(data?.data) ? data.data : [];
  const exact = list.find((c) => String(c.name || '').trim().toLowerCase() === needle);
  if (exact?.id) return Number(exact.id);
  const partial = list.find((c) => String(c.name || '').toLowerCase().includes(needle)
    || needle.includes(String(c.name || '').toLowerCase()));
  return partial?.id ? Number(partial.id) : null;
}

async function findExistingLeadByExternalId(orderId, token) {
  const externalOrderId = String(orderId || '').trim();
  if (!externalOrderId) return null;
  const { data, status } = await axios.get(`${API_BASE}/leads`, {
    params: { search: externalOrderId, limit: 20 },
    headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
    timeout: 30000,
    validateStatus: () => true,
  });
  if (status >= 400) return null;
  const list = Array.isArray(data?.data) ? data.data : [];
  return list.find((lead) => String(lead.externalOrderId || '').trim() === externalOrderId) || null;
}

/**
 * @param {{
 *   orderId: string,
 *   name: string,
 *   phone: string,
 *   address?: string,
 *   city?: string,
 *   items?: Array<{ ref?: string, sku?: string, qty?: number, quantity?: number, price?: number, unitPrice?: number }>,
 * }} order
 */
export async function createBundledTifawtLead(order) {
  if (!isTifawtApiConfigured()) {
    const error = new Error('tifawt_api_not_configured');
    error.statusCode = 503;
    throw error;
  }

  const orderId = String(order?.orderId || '').trim();
  const name = String(order?.name || '').trim();
  const phone = String(order?.phone || '').trim();
  const address = String(order?.address || '').trim();
  const city = String(order?.city || '').trim();
  const aliases = getBotSetting('tifawtSkuAliases') || '';
  const rawItems = Array.isArray(order?.items) ? order.items : [];

  if (!orderId || !name || !phone || !rawItems.length) {
    const error = new Error('invalid_order_payload');
    error.statusCode = 400;
    throw error;
  }

  return withTifawtToken(async (token) => {
    const existing = await findExistingLeadByExternalId(orderId, token);
    if (existing?.id) {
      return {
        ok: true,
        duplicate: true,
        orderId,
        leadId: existing.id,
        productCount: Array.isArray(existing.products) ? existing.products.length : undefined,
      };
    }

    const missing = [];
    const products = [];
    for (const item of rawItems) {
      const sku = resolveTifawtOrderSku(
        item?.ref || item?.sku || item?.SKU || item?.id,
        aliases,
      );
      if (!sku) continue;
      const product = await findProductBySku(sku, token);
      if (!product?.id) {
        missing.push(sku);
        continue;
      }
      const quantity = Math.max(1, Number(item?.qty ?? item?.quantity ?? 1) || 1);
      const unitPrice = Math.max(
        0,
        Number(item?.price ?? item?.unitPrice ?? product.price ?? 0) || 0,
      );
      products.push({ productId: Number(product.id), quantity, unitPrice });
    }

    if (!products.length) {
      const error = new Error(
        missing.length
          ? `tifawt_products_not_found:${missing.join(',')}`
          : 'tifawt_products_empty',
      );
      error.statusCode = 422;
      error.missing = missing;
      throw error;
    }

    const shippingCityId = await findShippingCityId(city, token);
    const body = {
      customerName: name,
      customerPhone: phone,
      customerAddress: address || city || 'المغرب',
      businessId: Number.isFinite(BUSINESS_ID) && BUSINESS_ID > 0 ? BUSINESS_ID : 1,
      externalOrderId: orderId,
      ticketName: orderId,
      products,
    };
    if (shippingCityId) body.shippingCityId = shippingCityId;
    if (missing.length) {
      body.internalNote = `منتجات غير موجودة في تيفاوت وتم تخطيها: ${missing.join(', ')}`;
    }

    const { data, status } = await axios.post(`${API_BASE}/leads`, body, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      timeout: 30000,
      validateStatus: () => true,
    });

    if (status === 409 || /already exists|duplicate/i.test(String(data?.message || ''))) {
      const again = await findExistingLeadByExternalId(orderId, token);
      if (again?.id) {
        return {
          ok: true,
          duplicate: true,
          orderId,
          leadId: again.id,
          productCount: Array.isArray(again.products) ? again.products.length : undefined,
        };
      }
    }

    if (status >= 400) {
      const error = new Error(data?.message || `tifawt_lead_http_${status}`);
      error.statusCode = status;
      error.details = data?.details || data;
      throw error;
    }

    const leadId = data?.id || data?.data?.id;
    return {
      ok: true,
      duplicate: false,
      orderId,
      leadId,
      productCount: products.length,
      missing,
      status,
    };
  });
}

export function isBundledTifawtLeadConfigured() {
  return isTifawtApiConfigured();
}
