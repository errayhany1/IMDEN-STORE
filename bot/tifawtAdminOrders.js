/**
 * Admin helpers for listing Tifawt orders and marking customer returns.
 * Return flow: DELIVERED → PENDING_RETURN (terminal in Tifawt API).
 */
import axios from 'axios';
import { API_BASE, isTifawtApiConfigured, withTifawtToken } from './tifawtClient.js';

const RETURNABLE = new Set(['DELIVERED', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY']);

const STATUS_LABELS = {
  PENDING: 'قيد التحضير',
  PROCESSING: 'قيد المعالجة',
  READY: 'جاهز للشحن',
  SHIPPED: 'تم الشحن',
  IN_TRANSIT: 'في الطريق',
  OUT_FOR_DELIVERY: 'خارج للتوصيل',
  DELIVERED: 'تم التوصيل',
  PENDING_RETURN: 'مرتجع (قيد الإرجاع)',
  RETURNED: 'مرتجع',
  REFUSED: 'مرفوض',
  CANCELLED: 'ملغي',
};

function mapProducts(products = []) {
  return (products || []).map((line) => ({
    name: line?.product?.name || line?.rawSku || 'منتج',
    sku: line?.product?.sku || line?.rawSku || '',
    quantity: Number(line?.quantity) || 1,
    unitPrice: Number(line?.unitPrice) || 0,
    totalPrice: Number(line?.totalPrice) || 0,
  }));
}

export function mapTifawtOrderAdmin(order) {
  const status = String(order?.status || '').toUpperCase();
  return {
    id: order.id,
    leadId: order.leadId || order.lead?.id || null,
    reference: order.lead?.ticketName || order.trackingNumber || `ORD-${order.id}`,
    externalOrderId: order.lead?.externalOrderId || null,
    status,
    statusLabel: STATUS_LABELS[status] || status || '—',
    canReturn: RETURNABLE.has(status),
    isReturned: status === 'PENDING_RETURN' || status === 'RETURNED' || status === 'REFUSED',
    customerName: order.customerName || '',
    customerPhone: order.customerPhone || '',
    address: order.customerAddress || '',
    city: order.shippingCity?.name || '',
    total: Number(order.totalAmount) || 0,
    shippingFee: Number(order.shippingFee) || 0,
    trackingNumber: order.trackingNumber || '',
    shippingCompany: order.shippingCompany?.name || '',
    shippingStatus: order.shippingStatus || '',
    returnReason: order.returnReason || '',
    createdAt: order.createdAt || null,
    deliveredAt: order.deliveredAt || null,
    returnedAt: order.returnedAt || null,
    products: mapProducts(order.lead?.products),
  };
}

/**
 * @param {{ limit?: number, page?: number, search?: string, status?: string }} opts
 */
export async function listTifawtOrdersAdmin(opts = {}) {
  if (!isTifawtApiConfigured()) {
    return { ok: false, error: 'tifawt_not_configured' };
  }
  const limit = Math.min(100, Math.max(1, Number(opts.limit) || 50));
  const page = Math.max(1, Number(opts.page) || 1);
  const params = { limit, page };
  if (opts.search) params.search = String(opts.search).trim();
  if (opts.status && opts.status !== 'all') params.status = String(opts.status).toUpperCase();

  const data = await withTifawtToken(async (token) => {
    const res = await axios.get(`${API_BASE}/orders`, {
      headers: { Authorization: `Bearer ${token}` },
      params,
      timeout: 30000,
    });
    return res.data;
  });

  const rows = Array.isArray(data?.data) ? data.data : [];
  return {
    ok: true,
    orders: rows.map(mapTifawtOrderAdmin),
    meta: data?.meta || { total: rows.length, page, limit },
  };
}

/**
 * Mark an order as customer-returned (PENDING_RETURN).
 * @param {number|string} orderId
 * @param {{ reason?: string }} [opts]
 */
export async function markTifawtOrderReturned(orderId, opts = {}) {
  if (!isTifawtApiConfigured()) {
    return { ok: false, error: 'tifawt_not_configured' };
  }
  const id = Number(orderId);
  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false, error: 'invalid_order_id' };
  }

  const body = { status: 'PENDING_RETURN' };
  const reason = String(opts.reason || '').trim();
  if (reason) body.returnReason = reason;

  try {
    const updated = await withTifawtToken(async (token) => {
      const res = await axios.patch(
        `${API_BASE}/orders/${id}/status`,
        body,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );
      return res.data;
    });
    return { ok: true, order: mapTifawtOrderAdmin(updated) };
  } catch (error) {
    const message = error?.response?.data?.message || error?.message || 'return_failed';
    const statusCode = error?.response?.status || 502;
    return {
      ok: false,
      error: message,
      statusCode,
      details: error?.response?.data || null,
    };
  }
}
