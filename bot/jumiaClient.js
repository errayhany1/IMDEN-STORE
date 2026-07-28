/**
 * Jumia Vendor API client (OAuth Self Authorization).
 * Token: POST /token  |  Orders: GET /orders, GET /orders/items
 * Base: https://vendor-api.jumia.com
 */
import axios from 'axios';

const JUMIA_API_BASE = (
  process.env.JUMIA_API_BASE
  || 'https://vendor-api.jumia.com'
).replace(/\/+$/, '');

const CLIENT_ID = (
  process.env.JUMIA_CLIENT_ID
  || process.env.JUMIA_USER_ID
  || ''
).trim();

const REFRESH_TOKEN = (
  process.env.JUMIA_REFRESH_TOKEN
  || process.env.JUMIA_API_KEY
  || ''
).trim();

const tokenState = {
  accessToken: null,
  refreshToken: REFRESH_TOKEN,
  expiresAt: 0,
};

export function isJumiaConfigured() {
  return Boolean(CLIENT_ID && (tokenState.refreshToken || REFRESH_TOKEN));
}

function pick(...values) {
  for (const value of values) {
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

async function getAccessToken() {
  if (!isJumiaConfigured()) {
    const error = new Error('jumia_not_configured');
    error.statusCode = 503;
    throw error;
  }

  const now = Date.now();
  if (tokenState.accessToken && tokenState.expiresAt > now + 60_000) {
    return tokenState.accessToken;
  }

  const refreshToken = tokenState.refreshToken || REFRESH_TOKEN;
  const { data } = await axios.post(
    `${JUMIA_API_BASE}/token`,
    new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 30_000,
    },
  );

  tokenState.accessToken = data?.access_token;
  tokenState.expiresAt = now + (Number(data?.expires_in) || 3600) * 1000;
  if (data?.refresh_token) tokenState.refreshToken = data.refresh_token;

  if (!tokenState.accessToken) {
    throw new Error('jumia_token_missing');
  }
  return tokenState.accessToken;
}

async function jumiaGet(path, params = {}) {
  const token = await getAccessToken();
  const { data } = await axios.get(`${JUMIA_API_BASE}${path}`, {
    params,
    headers: { Authorization: `Bearer ${token}` },
    timeout: 30_000,
  });
  return data;
}

function unwrapOrders(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  return asArray(
    payload.orders
    || payload.Orders
    || payload.data
    || payload.items
    || payload.Results
    || [],
  );
}

function unwrapItems(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  return asArray(
    payload.items
    || payload.orderItems
    || payload.OrderItems
    || payload.data
    || payload.Results
    || [],
  );
}

/** Recent orders created after ISO timestamp (defaults to last hour). */
export async function getRecentOrders({ createdAfter, size = 50 } = {}) {
  const after = createdAfter || new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const data = await jumiaGet('/orders', {
    created_after: after,
    size: Math.min(300, Math.max(1, Number(size) || 50)),
    sort: 'DESC',
  });
  return unwrapOrders(data);
}

/** Fetch one order by id (list filter + fallback scan of recent). */
export async function getOrder(orderId) {
  const id = String(orderId || '').trim();
  if (!id) return null;

  try {
    const byId = await jumiaGet('/orders', { order_ids: id, size: 10 });
    const match = unwrapOrders(byId).find((order) => String(orderIdOf(order)) === id);
    if (match) return match;
  } catch {
    // Fall through to recent scan / single-resource attempt.
  }

  try {
    const single = await jumiaGet(`/orders/${encodeURIComponent(id)}`);
    if (single && (single.id || single.orderId || single.OrderId)) return single;
    const nested = unwrapOrders(single)[0];
    if (nested) return nested;
  } catch {
    // ignore
  }

  const recent = await getRecentOrders({
    createdAfter: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    size: 100,
  });
  return recent.find((order) => String(orderIdOf(order)) === id) || null;
}

export async function getOrderItems(orderId) {
  const id = String(orderId || '').trim();
  if (!id) return [];
  const data = await jumiaGet('/orders/items', { order_ids: id });
  return unwrapItems(data).filter((item) => {
    const parent = pick(item.orderId, item.OrderId, item.order_id);
    return !parent || parent === id;
  });
}

export function orderIdOf(order) {
  return pick(order?.id, order?.orderId, order?.OrderId, order?.order_id);
}

function mapItems(items) {
  return asArray(items).map((item) => ({
    sku: pick(
      item.sellerSku,
      item.SellerSku,
      item.sku,
      item.Sku,
      item.seller_sku,
      item.productSku,
    ),
    quantity: Math.max(1, Number(item.quantity ?? item.Quantity ?? item.qty ?? 1) || 1),
    unitPrice: Math.max(
      0,
      Number(
        item.unitPrice
        ?? item.UnitPrice
        ?? item.paidPrice
        ?? item.PaidPrice
        ?? item.itemPrice
        ?? item.price
        ?? item.Price
        ?? 0,
      ) || 0,
    ),
  })).filter((item) => item.sku);
}

/**
 * Map Jumia order + items into the same shape used by syncOrderToTifawt.
 */
export function mapJumiaOrderToTifawt(order, items = []) {
  const jumiaId = orderIdOf(order);
  const shipping = order?.shippingAddress || order?.ShippingAddress || order?.address || {};
  const customer = order?.customer || order?.Customer || {};

  const firstName = pick(
    order?.customerFirstName,
    order?.CustomerFirstName,
    customer.firstName,
    customer.FirstName,
    shipping.firstName,
  );
  const lastName = pick(
    order?.customerLastName,
    order?.CustomerLastName,
    customer.lastName,
    customer.LastName,
    shipping.lastName,
  );
  const name = pick(
    [firstName, lastName].filter(Boolean).join(' '),
    order?.customerName,
    order?.CustomerName,
    customer.name,
    shipping.name,
    'Jumia Customer',
  );

  const phone = pick(
    order?.customerPhone,
    order?.CustomerPhone,
    order?.phone,
    order?.Phone,
    customer.phone,
    customer.Phone,
    shipping.phone,
    shipping.Phone,
  );

  const address = pick(
    order?.addressShipping,
    order?.AddressShipping,
    shipping.address,
    shipping.Address,
    shipping.address1,
    shipping.street,
    [shipping.address1, shipping.address2].filter(Boolean).join(', '),
    order?.shippingAddressFull,
  );

  const city = pick(
    order?.addressShippingCity,
    order?.AddressShippingCity,
    shipping.city,
    shipping.City,
    order?.city,
    order?.City,
    'المغرب',
  );

  const lineItems = mapItems(items.length ? items : (order?.items || order?.orderItems || []));

  return {
    orderId: `JUMIA-${jumiaId}`,
    name,
    phone,
    address,
    city,
    items: lineItems,
  };
}

/** Load order + items and return Tifawt-ready payload. */
export async function fetchJumiaOrderForTifawt(orderId) {
  const order = await getOrder(orderId);
  if (!order) {
    const error = new Error('jumia_order_not_found');
    error.statusCode = 404;
    throw error;
  }
  const items = await getOrderItems(orderIdOf(order) || orderId);
  return mapJumiaOrderToTifawt(order, items);
}
