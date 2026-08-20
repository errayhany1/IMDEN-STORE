/**
 * Lightweight admin client for /bot-api admin routes.
 */
import axios from 'axios';

function headers() {
  return {
    'Content-Type': 'application/json',
  };
}

export async function createAdminSession(password) {
  const { data } = await axios.post(
    '/bot-api/api/admin/session',
    { password },
    { headers: headers(), timeout: 30000 },
  );
  return data;
}

export async function verifyAdminSession() {
  const { data } = await axios.get('/bot-api/api/admin/session', {
    headers: headers(),
    timeout: 15000,
  });
  return data;
}

export async function destroyAdminSession() {
  const { data } = await axios.delete('/bot-api/api/admin/session', {
    headers: headers(),
    timeout: 15000,
  });
  return data;
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

export async function setJumiaProductStockAdmin(sku, stock = 100) {
  const { data } = await axios.post(
    `/bot-api/api/admin/products/${encodeURIComponent(sku)}/jumia-stock`,
    { stock },
    { headers: headers(), timeout: 60000 },
  );
  return data;
}

export async function fetchBotSettings() {
  const { data } = await axios.get('/bot-api/api/admin/bot/settings', {
    headers: headers(),
    timeout: 30000,
  });
  return data;
}

export async function saveBotSettings(settings) {
  const { data } = await axios.patch(
    '/bot-api/api/admin/bot/settings',
    { settings },
    { headers: headers(), timeout: 30000 },
  );
  return data;
}

export async function resetBotSettings() {
  const { data } = await axios.post(
    '/bot-api/api/admin/bot/settings/reset',
    {},
    { headers: headers(), timeout: 30000 },
  );
  return data;
}

export async function fetchInventoryReconcile() {
  const { data } = await axios.get('/bot-api/api/admin/inventory/reconcile', {
    headers: headers(),
    timeout: 120000,
  });
  return data;
}

export async function linkInventorySku({ nocoSku, tifawtSku }) {
  const { data } = await axios.post(
    '/bot-api/api/admin/inventory/link',
    { nocoSku, tifawtSku },
    { headers: headers(), timeout: 30000 },
  );
  return data;
}

export async function unlinkInventorySku({ nocoSku }) {
  const { data } = await axios.post(
    '/bot-api/api/admin/inventory/unlink',
    { nocoSku },
    { headers: headers(), timeout: 30000 },
  );
  return data;
}

export async function setInventoryNocoStatus({ nocoId, postebl }) {
  const { data } = await axios.post(
    '/bot-api/api/admin/inventory/noco-status',
    { nocoId, postebl },
    { headers: headers(), timeout: 30000 },
  );
  return data;
}

export function inventoryExportUrl(kind) {
  return `/bot-api/api/admin/inventory/export/${kind}`;
}
