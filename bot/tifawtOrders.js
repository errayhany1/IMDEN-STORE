/**
 * Read-only lookup of a customer's own orders in Tifawt ERP.
 *
 * The caller MUST have proven ownership of the phone number (SMS OTP) before
 * calling this: Tifawt's `search` is a fuzzy match, so every record is also
 * hard-filtered on an exact normalized phone match before it leaves the server,
 * and only non-sensitive fields are returned (no internal notes, driver
 * contacts, margins or payment references).
 */
import axios from 'axios';
import { API_BASE, isTifawtApiConfigured, withTifawtToken } from './tifawtClient.js';

/** `0612345678` for any Moroccan input format, otherwise digits only. */
export function normalizePhone(value = '') {
  let digits = String(value).replace(/\D/g, '');
  if (digits.startsWith('00212')) digits = digits.slice(5);
  else if (digits.startsWith('212')) digits = digits.slice(3);
  if (!digits.startsWith('0')) digits = `0${digits}`;
  return digits;
}

const samePhone = (a, b) => {
  const left = normalizePhone(a);
  const right = normalizePhone(b);
  return Boolean(left) && left === right;
};

/**
 * Lead status → customer-facing tracking step.
 * Tifawt keeps a lead until it is converted into a shipped order.
 */
const LEAD_STATUS = {
  PENDING: { key: 'pending', label: 'قيد المراجعة', step: 1 },
  SCHEDULED: { key: 'pending', label: 'مبرمج للاتصال', step: 1 },
  NO_ANSWER: { key: 'pending', label: 'في انتظار تأكيدك', step: 1 },
  CONFIRMED: { key: 'confirmed', label: 'تم التأكيد', step: 2 },
  CANCELLED: { key: 'cancelled', label: 'ملغي', step: 0 },
  DUPLICATE: { key: 'cancelled', label: 'طلب مكرر', step: 0 },
  REJECTED: { key: 'cancelled', label: 'ملغي', step: 0 },
};

const ORDER_STATUS = {
  PENDING: { key: 'confirmed', label: 'قيد التحضير', step: 2 },
  PROCESSING: { key: 'confirmed', label: 'قيد التحضير', step: 2 },
  READY: { key: 'confirmed', label: 'جاهز للشحن', step: 2 },
  SHIPPED: { key: 'shipped', label: 'تم الشحن', step: 3 },
  IN_TRANSIT: { key: 'shipped', label: 'في الطريق', step: 3 },
  OUT_FOR_DELIVERY: { key: 'shipped', label: 'خارج للتوصيل', step: 3 },
  DELIVERED: { key: 'delivered', label: 'تم التوصيل', step: 4 },
  RETURNED: { key: 'returned', label: 'مرتجع', step: 0 },
  REFUSED: { key: 'returned', label: 'مرفوض', step: 0 },
  CANCELLED: { key: 'cancelled', label: 'ملغي', step: 0 },
};

const mapStatus = (table, raw) => {
  const code = String(raw || '').toUpperCase();
  return table[code] || { key: 'pending', label: 'قيد المعالجة', step: 1 };
};

const mapProducts = (products = []) => (products || []).map((line) => ({
  name: line?.product?.name || line?.rawSku || 'منتج',
  sku: line?.product?.sku || line?.rawSku || '',
  quantity: Number(line?.quantity) || 1,
  unitPrice: Number(line?.unitPrice) || 0,
  totalPrice: Number(line?.totalPrice) || 0,
}));

const mapOrder = (order) => {
  const status = mapStatus(ORDER_STATUS, order.status);
  return {
    kind: 'order',
    id: `ORD-${order.id}`,
    reference: order.lead?.ticketName || `طلب #${order.id}`,
    status: status.key,
    statusLabel: status.label,
    step: status.step,
    trackingNumber: order.trackingNumber || '',
    shippingCompany: order.shippingCompany?.name || '',
    city: order.shippingCity?.name || '',
    total: Number(order.totalAmount) || 0,
    shippingFee: Number(order.shippingFee) || 0,
    address: order.customerAddress || '',
    createdAt: order.createdAt || null,
    shippedAt: order.shippedAt || null,
    deliveredAt: order.deliveredAt || null,
    products: mapProducts(order.lead?.products),
  };
};

const mapLead = (lead) => {
  const status = mapStatus(LEAD_STATUS, lead.status);
  return {
    kind: 'lead',
    id: `LEAD-${lead.id}`,
    reference: lead.ticketName || `طلب #${lead.id}`,
    status: status.key,
    statusLabel: status.label,
    step: status.step,
    trackingNumber: '',
    shippingCompany: '',
    city: lead.shippingCity?.name || '',
    total: Number(lead.totalAmount) || 0,
    shippingFee: Number(lead.shippingFee) || 0,
    address: lead.customerAddress || '',
    createdAt: lead.createdAt || null,
    shippedAt: null,
    deliveredAt: null,
    products: mapProducts(lead.products),
  };
};

async function search(path, phone, token) {
  const { data } = await axios.get(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { search: phone, limit: 50 },
    timeout: 30000,
  });
  return Array.isArray(data?.data) ? data.data : [];
}

/**
 * @param {string} verifiedPhone phone already proven via SMS OTP
 * @returns {Promise<{ ok: boolean, orders?: object[], error?: string }>}
 */
export async function getCustomerOrders(verifiedPhone) {
  if (!isTifawtApiConfigured()) {
    return { ok: false, error: 'tifawt_not_configured' };
  }
  const phone = normalizePhone(verifiedPhone);
  if (!/^0[5-7]\d{8}$/.test(phone)) {
    return { ok: false, error: 'invalid_phone' };
  }

  const [orders, leads] = await withTifawtToken(async (token) => Promise.all([
    search('/orders', phone, token),
    search('/leads', phone, token),
  ]));

  const mine = orders.filter((o) => samePhone(o.customerPhone, phone));
  // A lead that already became an order is shown once, via the order.
  const convertedLeadIds = new Set(mine.map((o) => o.leadId).filter(Boolean));

  const mappedOrders = mine.map(mapOrder);
  const mappedLeads = leads
    .filter((l) => samePhone(l.customerPhone, phone))
    .filter((l) => !convertedLeadIds.has(l.id) && !l.order)
    // Internal dedupe/rejection artifacts are meaningless to the customer.
    .filter((l) => !['DUPLICATE', 'REJECTED'].includes(String(l.status || '').toUpperCase()))
    .map(mapLead);

  const all = [...mappedOrders, ...mappedLeads].sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  );

  return { ok: true, orders: all };
}
