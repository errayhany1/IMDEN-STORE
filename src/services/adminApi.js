/**
 * Admin client for /bot-api. Auth is the dashboard password sent as
 * X-Admin-Password on every request (cookies alone die after each deploy).
 */
import axios from 'axios';

const ADMIN_PW_KEY = 'admin_pw';

export function getAdminPassword() {
  if (typeof sessionStorage === 'undefined') return '';
  return (
    sessionStorage.getItem(ADMIN_PW_KEY)
    || import.meta.env.VITE_ADMIN_PASSWORD
    || ''
  );
}

export function setAdminPassword(password) {
  if (typeof sessionStorage === 'undefined') return;
  const value = String(password || '').trim();
  if (value) sessionStorage.setItem(ADMIN_PW_KEY, value);
  else sessionStorage.removeItem(ADMIN_PW_KEY);
}

const adminAxios = axios.create({
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

adminAxios.interceptors.request.use((config) => {
  const password = getAdminPassword();
  if (password) {
    config.headers['X-Admin-Password'] = password;
  }
  // Let the browser set multipart boundary when sending FormData.
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    if (config.headers && typeof config.headers.delete === 'function') {
      config.headers.delete('Content-Type');
    } else if (config.headers) {
      delete config.headers['Content-Type'];
    }
  }
  return config;
});

export async function createAdminSession(password) {
  if (password) setAdminPassword(password);
  const { data } = await adminAxios.post(
    '/bot-api/api/admin/session',
    { password: password || getAdminPassword() },
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
  try {
    const { data } = await adminAxios.delete('/bot-api/api/admin/session', {
      timeout: 15000,
    });
    return data;
  } finally {
    setAdminPassword('');
    sessionStorage.removeItem('admin_auth');
  }
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

export async function fetchInventoryReconcile({ force = false } = {}) {
  const { data } = await adminAxios.get('/bot-api/api/admin/inventory/reconcile', {
    params: force ? { force: '1' } : undefined,
    timeout: 60000,
  });
  return data;
}

export async function linkInventorySku({ nocoSku, tifawtSku, nocoId }) {
  const { data } = await adminAxios.post(
    '/bot-api/api/admin/inventory/link',
    { nocoSku, tifawtSku, nocoId },
    { timeout: 45000 },
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

export async function downloadInventoryExport(kind) {
  const { data, headers } = await adminAxios.get(
    `/bot-api/api/admin/inventory/export/${kind}`,
    { timeout: 180000, responseType: 'blob' },
  );
  const name = {
    'noco-unlinked': 'postebl-unlinked.csv',
    'tifawt-not-noco': 'tifawt-without-nocodb.csv',
    matched: 'matched.csv',
  }[kind] || 'export.csv';
  const type = headers['content-type'] || 'text/csv';
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function fetchSocialPlatformStatus() {
  const { data } = await adminAxios.get('/bot-api/api/admin/social/status', {
    timeout: 20000,
  });
  return data;
}

export async function fetchSocialPosts(limit = 40) {
  const { data } = await adminAxios.get('/bot-api/api/admin/social/posts', {
    params: { limit },
    timeout: 20000,
  });
  return data;
}

export async function uploadSocialMedia(file) {
  const body = new FormData();
  body.append('file', file);
  const { data } = await adminAxios.post('/bot-api/api/admin/social/upload', body, {
    timeout: 600000,
  });
  return data;
}

export async function publishSocialPost(payload) {
  const { data } = await adminAxios.post(
    '/bot-api/api/admin/social/publish',
    payload,
    { timeout: 600000 },
  );
  return data;
}
