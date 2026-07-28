/**
 * Lightweight admin client for /bot-api admin routes.
 */
import axios from 'axios';

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'imden2026';

function headers() {
  return {
    'Content-Type': 'application/json',
    'X-Admin-Password': ADMIN_PASSWORD,
  };
}

export async function fetchTifawtOrders({ search = '', status = 'all', limit = 50 } = {}) {
  const { data } = await axios.get('/bot-api/api/admin/tifawt/orders', {
    headers: headers(),
    params: { search: search || undefined, status, limit },
    timeout: 30000,
  });
  return data;
}

export async function markTifawtReturn(orderId, reason = '') {
  const { data } = await axios.post(
    `/bot-api/api/admin/tifawt/orders/${orderId}/return`,
    { reason },
    { headers: headers(), timeout: 30000 },
  );
  return data;
}

export async function fetchJumiaAdminOrders() {
  const { data } = await axios.get('/bot-api/api/admin/jumia/orders', {
    headers: headers(),
    timeout: 60000,
  });
  return data;
}

export async function jumiaAdminShip(orderId) {
  const { data } = await axios.post(
    `/bot-api/api/admin/jumia/orders/${orderId}/ship`,
    {},
    { headers: headers(), timeout: 60000 },
  );
  return data;
}

export async function jumiaAdminCancel(orderId) {
  const { data } = await axios.post(
    `/bot-api/api/admin/jumia/orders/${orderId}/cancel`,
    {},
    { headers: headers(), timeout: 60000 },
  );
  return data;
}

export async function publishProductToJumia(sku) {
  const { data } = await axios.post(
    `/bot-api/api/admin/products/${encodeURIComponent(sku)}/publish-jumia`,
    {},
    { headers: headers(), timeout: 90000 },
  );
  return data;
}
