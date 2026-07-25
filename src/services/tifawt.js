/**
 * Push store orders to Tifawt ERP (Lead Source API).
 * Failures are logged only — never block checkout.
 *
 * Stock is owned by Tifawt: we only send sku + quantity + unitPrice.
 * The website / NocoDB must NOT decrement inventory.
 */

const TIFAWT_LEAD_URL = (
  import.meta.env.VITE_TIFAWT_LEAD_URL
  || ''
).trim();

export function buildTifawtPayload({
  name,
  phone,
  address,
  city,
  items = [],
}) {
  return {
    customerName: String(name || '').trim() || 'بدون اسم',
    customerPhone: String(phone || '').trim(),
    customerAddress: String(address || '').trim(),
    city: String(city || '').trim() || 'المغرب',
    products: (items || []).map((item) => ({
      sku: String(item.ref || item.sku || item.SKU || item.id || 'UNKNOWN').trim(),
      quantity: Number(item.qty ?? item.quantity ?? 1) || 1,
      unitPrice: Number(item.price ?? item.unitPrice ?? 0) || 0,
    })),
  };
}

/**
 * Send order to Tifawt Lead Source API.
 * @returns {{ ok?: boolean, skipped?: boolean, status?: number, error?: string }}
 */
export async function pushOrderToTifawt(orderInput) {
  if (!TIFAWT_LEAD_URL) {
    console.warn('[Tifawt] VITE_TIFAWT_LEAD_URL missing — order not synced');
    return { skipped: true, reason: 'no_url' };
  }

  const payload = buildTifawtPayload(orderInput);

  try {
    const res = await fetch(TIFAWT_LEAD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[Tifawt] sync failed:', res.status, text);
      return { ok: false, status: res.status, error: text || res.statusText };
    }
    console.log('[Tifawt] order synced:', payload.customerName, payload.customerPhone);
    return { ok: true, status: res.status };
  } catch (err) {
    console.error('[Tifawt] sync error:', err?.message || err);
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * After a successful NocoDB order save: push to Tifawt only.
 * Inventory deduction happens inside Tifawt, not on the site.
 */
export async function syncOrderSideEffects({
  name,
  phone,
  address,
  city,
  items,
}) {
  const tifawt = await pushOrderToTifawt({ name, phone, address, city, items });
  return { tifawt };
}
