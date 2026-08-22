/**
 * Lightweight admin client for /bot-api admin routes.
 */
import axios from 'axios';

const adminAxios = axios.create({
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

export async function createAdminSession(password) {
  const { data } = await adminAxios.post(
    '/bot-api/api/admin/session',
    { password },
    { timeout: 30000 },
  );
  return data;
}

export async function verifyAdminSession() {
  const { data } = await adminAxios.get('/bot-api/api/admin/session', {
    timeout: 15000,
  });
  return data;
}

export async function destroyAdminSession() {
  const { data } = await adminAxios.delete('/bot-api/api/admin/session', {
    timeout: 15000,
  });
  return data;
}

export async function fetchTifawtOrders({ search = '', status = 'all', limit = 50 } = {}) {
  const { data } = await adminAxios.get('/bot-api/api/admin/tifawt/orders', {
    params: { search: search || undefined, status, limit },
    timeout: 30000,
  });
  return data;
}

export async function markTifawtReturn(orderId, reason = '') {
  const { data } = await adminAxios.post(
    `/bot-api/api/admin/tifawt/orders/${orderId}/return`,
    { reason },
    { timeout: 30000 },
  );
  return data;
}

export async function fetchJumiaAdminOrders() {
  const { data } = await adminAxios.get('/bot-api/api/admin/jumia/orders', {
    timeout: 60000,
  });
  return data;
}

export async function jumiaAdminShip(orderId) {
  const { data } = await adminAxios.post(
    `/bot-api/api/admin/jumia/orders/${orderId}/ship`,
    {},
    { timeout: 60000 },
  );
  return data;
}

export async function jumiaAdminCancel(orderId) {
  const { data } = await adminAxios.post(
    `/bot-api/api/admin/jumia/orders/${orderId}/cancel`,
    {},
    { timeout: 60000 },
  );
  return data;
}

export async function publishProductToJumia(sku) {
  const { data } = await adminAxios.post(
    `/bot-api/api/admin/products/${encodeURIComponent(sku)}/publish-jumia`,
    {},
    { timeout: 90000 },
  );
  return data;
}

export async function setJumiaProductStockAdmin(sku, stock = 100) {
  const { data } = await adminAxios.post(
    `/bot-api/api/admin/products/${encodeURIComponent(sku)}/jumia-stock`,
    { stock },
    { timeout: 60000 },
  );
  return data;
}

export async function fetchBotSettings() {
  const { data } = await adminAxios.get('/bot-api/api/admin/bot/settings', {
    timeout: 30000,
  });
  return data;
}

export async function saveBotSettings(settings) {
  const { data } = await adminAxios.patch(
    '/bot-api/api/admin/bot/settings',
    { settings },
    { timeout: 30000 },
  );
  return data;
}

export async function resetBotSettings() {
  const { data } = await adminAxios.post(
    '/bot-api/api/admin/bot/settings/reset',
    {},
    { timeout: 30000 },
  );
  return data;
}

export async function fetchInventoryReconcile() {
  const { data } = await adminAxios.get('/bot-api/api/admin/inventory/reconcile', {
    timeout: 120000,
  });
  return data;
}

export async function linkInventorySku({ nocoSku, tifawtSku }) {
  const { data } = await adminAxios.post(
    '/bot-api/api/admin/inventory/link',
    { nocoSku, tifawtSku },
    { timeout: 30000 },
  );
  return data;
}

export async function unlinkInventorySku({ nocoSku }) {
  const { data } = await adminAxios.post(
    '/bot-api/api/admin/inventory/unlink',
    { nocoSku },
    { timeout: 30000 },
  );
  return data;
}

export async function setInventoryNocoStatus({ nocoId, postebl }) {
  const { data } = await adminAxios.post(
    '/bot-api/api/admin/inventory/noco-status',
    { nocoId, postebl },
    { timeout: 30000 },
  );
  return data;
}

export function inventoryExportUrl(kind) {
  return `/bot-api/api/admin/inventory/export/${kind}`;
}
