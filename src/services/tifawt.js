/**
 * Storefront → order-sync service.
 *
 * Tifawt must never be called directly from the browser: its endpoint is a
 * credential and a browser retry can otherwise create duplicate leads.  The
 * bot service owns the ERP call, retries transient failures and coalesces
 * duplicate submissions using the stable checkout id.
 */

const ORDER_SYNC_PATH = '/bot-api/api/orders/sync';

export function createStoreOrderId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `WEB-${crypto.randomUUID()}`;
  }
  return `WEB-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function syncOrderSideEffects({ orderId, name, phone, address, city, items }) {
  if (!orderId) throw new Error('missing_store_order_id');

  const response = await fetch(ORDER_SYNC_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // The service uses this key for idempotency. It is not a secret.
      'X-Store-Order-Id': orderId,
    },
    body: JSON.stringify({ orderId, name, phone, address, city, items }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `order_sync_http_${response.status}`);
  }
  return body;
}
