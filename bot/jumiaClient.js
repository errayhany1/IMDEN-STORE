/**
 * Jumia Vendor API client (OAuth Self Authorization).
 * Token: POST /token  |  Orders: GET /orders, GET /orders/items
 * Products: POST api-pim-services /api/product-set (same OAuth token)
 * Base: https://vendor-api.jumia.com
 */
import axios from 'axios';
import { getBotSetting } from './runtimeSettings.js';
import { buildJumiaOffer } from './jumiaPricing.js';
import { ensurePublicImageUrls } from './jumiaPublicImages.js';
import { resolveTifawtOrderSku } from './tifawtSku.js';

const JUMIA_API_BASE = (
  process.env.JUMIA_API_BASE
  || 'https://vendor-api.jumia.com'
).replace(/\/+$/, '');

const JUMIA_PIM_API = (
  process.env.JUMIA_PIM_API
  || 'https://api-pim-services.jumia.com'
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

const SHOP_ID = (
  process.env.JUMIA_SHOP_ID
  || 'a74ac8a0-03f7-490b-8e45-cf9433b75d2c'
).trim();

const BUSINESS_CLIENT = (
  process.env.JUMIA_BUSINESS_CLIENT
  || 'jumia-ma'
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
      validateStatus: () => true,
    },
  );

  if (!data?.access_token) {
    const err = new Error(data?.error || 'jumia_token_missing');
    err.statusCode = data?.error === 'invalid_grant' ? 503 : 502;
    err.details = data;
    throw err;
  }

  tokenState.accessToken = data.access_token;
  tokenState.expiresAt = now + (Number(data?.expires_in) || 3600) * 1000;
  if (data?.refresh_token) tokenState.refreshToken = data.refresh_token;

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

  const lineItems = mapItems(items.length ? items : (order?.items || order?.orderItems || []))
    .map((item) => ({
      ...item,
      sku: resolveTifawtOrderSku(item.sku, getBotSetting('tifawtSkuAliases') || ''),
    }))
    .filter((item) => item.sku);

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

/** Parse "1045133 - Generic" or bare code → "1045133". */
export function parseJumiaCode(value, fallback = '') {
  const text = String(value || '').trim();
  const match = text.match(/^(\d+)/);
  if (match) return match[1];
  return String(fallback || '').trim();
}

function asHtml(value, fallback = '<p></p>') {
  const text = String(value || '').trim();
  if (!text) return fallback;
  if (/<[a-z][\s\S]*>/i.test(text)) return text;
  return `<p>${text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')}</p>`;
}

function stripHtml(value = '') {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Jumia PIM rejects description under 50 chars (plain text length).
 * Pad with title / short copy so create never fails on short AI/Noco text.
 */
function ensureJumiaDescriptionHtml({ description, shortDescription, name, min = 50, max = 9000 }) {
  let html = asHtml(description, asHtml(name));
  let plain = stripHtml(html);
  if (plain.length < min) {
    const extras = [
      name,
      stripHtml(shortDescription),
      'Produit neuf, prêt à l’expédition au Maroc.',
      'Qualité vérifiée — compatible usage quotidien.',
      'Livraison Jumia. Contenu et accessoires selon fiche produit.',
    ].filter(Boolean);
    const parts = [plain, ...extras].filter(Boolean);
    plain = parts.join(' ').replace(/\s+/g, ' ').trim();
    while (plain.length < min) {
      plain = `${plain} ${name || 'Produit'}`.trim();
    }
    html = asHtml(plain.slice(0, max));
  } else if (plain.length > max) {
    html = asHtml(plain.slice(0, max));
  }
  return html;
}

/**
 * Create a product via Jumia PIM (same path Vendor Center uses).
 * OAuth Self Auth access token works with api-pim-services.
 *
 * Pricing: NocoDB wholesale → tier profit + 5 DH + 15% Jumia gross-up.
 * List price = sale + 50..100 (discount feel). Stock 100 / 0 if NO POSTEBL.
 *
 * @param {object} product - same shape as sheet payload fields
 * @returns {{ productSetSid, productSids, sellerSku, countryStatuses, offer }}
 */
export async function createJumiaProduct(product = {}) {
  if (!isJumiaConfigured()) {
    return { skipped: true, reason: 'jumia_not_configured' };
  }

  const sellerSku = pick(product.sellerSku, product.SellerSKU, product.parentSku);
  if (!sellerSku) {
    return { skipped: true, reason: 'missing_seller_sku' };
  }

  const name = pick(product.frenchTitle, product.name, product.Name, sellerSku);
  const shortDescription = asHtml(
    pick(product.shortFr, product.short_description, product.shortDescription),
    asHtml(name),
  );
  const description = ensureJumiaDescriptionHtml({
    description: pick(product.descriptionFr, product.description, product.Description),
    shortDescription,
    name,
  });
  const brandCode = parseJumiaCode(
    pick(product.brand, product.Brand, getBotSetting('jumiaDefaultBrand')),
    '1045133',
  );
  const categoryCode = parseJumiaCode(
    pick(product.jumiaCategory, product.category, product.PrimaryCategory, getBotSetting('jumiaDefaultCategory')),
    '1000040',
  );
  const rawImages = asArray(product.imageUrls || product.images)
    .map((url) => String(url || '').trim())
    .filter((url) => /^https?:\/\//i.test(url));
  if (!rawImages.length) {
    return { skipped: true, reason: 'missing_images' };
  }

  // Jumia must fetch permanent URLs; NocoDB signed S3 links expire → Not Live.
  const publicImageSku = pick(product.publicImageSku, sellerSku);
  const publicImageStartIndex = Math.max(1, Number(product.publicImageStartIndex) || 1);
  const images = await ensurePublicImageUrls(rawImages, {
    sku: publicImageSku,
    startIndex: publicImageStartIndex,
  });
  if (!images.length) {
    return {
      skipped: true,
      reason: 'images_not_public',
      detail: 'Could not host permanent public image URLs for Jumia',
    };
  }

  const wholesale = Math.max(
    0,
    Number(product.wholesalePrice ?? product.price ?? product.Price_MAD ?? 0) || 0,
  );
  const postebl = pick(product.postebl, product.POSTEBL, product.stockStatus);
  const offer = buildJumiaOffer({
    wholesale,
    postebl,
    sku: sellerSku,
  });
  const listPrice = offer.listPrice;
  const salePrice = offer.salePrice;
  const stock = offer.stock;
  const color = pick(product.color, 'Multicolore') || 'Multicolore';
  const colorFamily = pick(product.colorFamily, color) || color;
  const variation = pick(product.variation, '...') || '...';
  const weight = String(product.productWeight ?? product.product_weight ?? 1);

  const countryCode = BUSINESS_CLIENT.startsWith('jumia-')
    ? BUSINESS_CLIENT.replace(/^jumia-/, '').toUpperCase()
    : BUSINESS_CLIENT.toUpperCase();

  const body = {
    brandCode,
    categoryCode,
    images,
    parentSKU: pick(product.referenceClean, product.parentSku, sellerSku) || sellerSku,
    attributes: [
      { name: 'name', values: [name] },
      { name: 'description', values: [description] },
      { name: 'short_description', values: [shortDescription] },
      { name: 'product_weight', values: [weight] },
      { name: 'color_family', values: [colorFamily] },
      { name: 'color', values: [color] },
    ],
    variations: [{
      sellerSKU: sellerSku,
      price: listPrice,
      stock,
      quantity: stock,
      currency: 'MAD',
      salePrice,
      saleStartDate: offer.saleStartDate,
      saleEndDate: offer.saleEndDate,
      variation,
      businessClients: [{
        countryCode,
        price: listPrice,
        salePrice,
        stock,
        quantity: stock,
        saleStartDate: offer.saleStartDate,
        saleEndDate: offer.saleEndDate,
      }],
    }],
    newVariations: [],
  };

  const token = await getAccessToken();
  const { data, status } = await axios.post(
    `${JUMIA_PIM_API}/api/product-set`,
    body,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        X_MASTER_SHOP_SID: SHOP_ID,
        X_SHOP_SID_LIST: SHOP_ID,
      },
      timeout: 60_000,
      validateStatus: () => true,
    },
  );

  if (status < 200 || status >= 300) {
    const err = new Error(
      data?.message || data?.error || `jumia_create_http_${status}`,
    );
    err.statusCode = status;
    err.details = data;
    throw err;
  }

  const productSetSid = data?.productSetSid || '';
  const productSids = asArray(data?.productSids);
  let countryStatuses = [];
  if (productSetSid) {
    try {
      const detail = await axios.get(
        `${JUMIA_PIM_API}/api/product-set/${productSetSid}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            X_MASTER_SHOP_SID: SHOP_ID,
            X_SHOP_SID_LIST: SHOP_ID,
          },
          timeout: 30_000,
        },
      );
      countryStatuses = asArray(detail.data?.products?.[0]?.productCountries).map((c) => ({
        code: c?.businessClient?.code,
        productStatus: c?.productStatus,
        qcStatus: c?.qcStatus,
        status: c?.status,
      }));
    } catch {
      // detail is optional
    }
  }

  // PIM create often leaves Vendor Center stock as "-" — push via stock feed.
  let stockFeed = null;
  try {
    stockFeed = await pushJumiaStockFeed({
      sellerSku,
      stock,
      productSid: productSids[0] || '',
    });
  } catch (e) {
    console.warn('[jumia] stock feed after create failed:', e.message);
    stockFeed = { ok: false, error: e.message };
  }

  return {
    skipped: false,
    status,
    productSetSid,
    productSids,
    sellerSku,
    countryStatuses,
    offer,
    imageUrls: images,
    stock,
    stockFeed,
    errors: data?.errors || null,
  };
}

async function jumiaRequest(method, path, { params, body } = {}) {
  const token = await getAccessToken();
  const { data, status } = await axios({
    method,
    url: `${JUMIA_API_BASE}${path}`,
    params,
    data: body,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    timeout: 60_000,
    validateStatus: () => true,
  });
  if (status < 200 || status >= 300) {
    const err = new Error(
      data?.message || data?.error || `jumia_http_${status}`,
    );
    err.statusCode = status;
    err.details = data;
    throw err;
  }
  return data;
}

async function pimRequest(method, path, body) {
  const token = await getAccessToken();
  const { data, status } = await axios({
    method,
    url: `${JUMIA_PIM_API}${path}`,
    data: body,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      X_MASTER_SHOP_SID: SHOP_ID,
      X_SHOP_SID_LIST: SHOP_ID,
    },
    timeout: 60_000,
    validateStatus: () => true,
  });
  if (status < 200 || status >= 300) {
    const err = new Error(
      data?.message || data?.error || `jumia_pim_http_${status}`,
    );
    err.statusCode = status;
    err.details = data;
    throw err;
  }
  return data;
}

export function normalizeJumiaOrderId(value) {
  return String(value || '')
    .trim()
    .replace(/^JUMIA[-_]/i, '');
}

export function orderItemIdOf(item) {
  return pick(
    item?.id,
    item?.orderItemId,
    item?.OrderItemId,
    item?.order_item_id,
    item?.itemId,
  );
}

/** Find a catalog variation by Seller SKU. */
export async function findJumiaProductBySellerSku(sellerSku) {
  const sku = String(sellerSku || '').trim();
  if (!sku) return null;

  const data = await jumiaGet('/catalog/products', {
    sellerSku: sku,
    size: 20,
  });
  const products = asArray(data?.products || data);
  for (const product of products) {
    const variation = asArray(product?.variations).find((v) => {
      const vSku = pick(v?.sellerSku, v?.SellerSku);
      return vSku.toLowerCase() === sku.toLowerCase();
    });
    if (variation) {
      return {
        product,
        variation,
        id: variation.id,
        sellerSku: pick(variation.sellerSku, sku),
        status: variation.businessClients?.[0]?.status || '',
        visible: variation.businessClients?.[0]?.visible,
      };
    }
  }

  // Fallback scan recent products if sellerSku filter is unsupported.
  const recent = await jumiaGet('/catalog/products', { size: 50 });
  for (const product of asArray(recent?.products || recent)) {
    const variation = asArray(product?.variations).find((v) => {
      const vSku = pick(v?.sellerSku, v?.SellerSku);
      return vSku.toLowerCase() === sku.toLowerCase();
    });
    if (variation) {
      return {
        product,
        variation,
        id: variation.id,
        sellerSku: pick(variation.sellerSku, sku),
        status: variation.businessClients?.[0]?.status || '',
        visible: variation.businessClients?.[0]?.visible,
      };
    }
  }
  return null;
}

/**
 * Activate / deactivate a product on Jumia MA (PIM country status).
 * active=true → ACTIVE, false → INACTIVE.
 */
export async function setJumiaProductActive(sellerSku, active = true) {
  const found = await findJumiaProductBySellerSku(sellerSku);
  if (!found?.id) {
    const error = new Error('jumia_product_not_found');
    error.statusCode = 404;
    throw error;
  }

  const status = active ? 'ACTIVE' : 'INACTIVE';
  const data = await pimRequest(
    'post',
    '/api/products/country/bulk-update-status',
    {
      productSids: [found.id],
      businessClientCode: BUSINESS_CLIENT,
      status,
    },
  );

  return {
    ok: true,
    sellerSku: found.sellerSku,
    productSid: found.id,
    status,
    summary: data?.summary || null,
  };
}

/** Push stock via Vendor API feed (100 in stock / 0 when NO POSTEBL). */
export async function pushJumiaStockFeed({ sellerSku, stock = 100, productSid = '' } = {}) {
  const sku = String(sellerSku || '').trim();
  if (!sku) {
    const error = new Error('missing_seller_sku');
    error.statusCode = 400;
    throw error;
  }
  const qty = Math.max(0, Number(stock) || 0);
  const product = { sellerSku: sku, stock: qty };
  if (productSid) product.id = productSid;

  const data = await jumiaRequest('post', '/feeds/products/stock', {
    body: { products: [product] },
  });
  return {
    ok: true,
    sellerSku: sku,
    productSid: productSid || null,
    stock: qty,
    feedId: data?.feedId || null,
  };
}

/** Push stock via Vendor API feed (100 in stock / 0 when NO POSTEBL). */
export async function setJumiaProductStock(sellerSku, stock = 100) {
  const found = await findJumiaProductBySellerSku(sellerSku);
  if (!found?.id) {
    // Still try by sellerSku alone — catalog index can lag right after create.
    return pushJumiaStockFeed({ sellerSku, stock });
  }
  return pushJumiaStockFeed({
    sellerSku: found.sellerSku,
    stock,
    productSid: found.id,
  });
}

async function resolveOrderItemIds(orderId) {
  const id = normalizeJumiaOrderId(orderId);
  const items = await getOrderItems(id);
  const ids = items.map(orderItemIdOf).filter(Boolean);
  if (!ids.length) {
    const error = new Error('jumia_order_items_empty');
    error.statusCode = 404;
    throw error;
  }
  return { orderId: id, items, itemIds: ids };
}

/** Pack Jumia order items with the first available shipment provider. */
export async function packJumiaOrder(orderId) {
  const { orderId: id, itemIds } = await resolveOrderItemIds(orderId);
  const providers = await jumiaRequest('get', '/orders/shipment-providers', {
    params: { order_item_ids: itemIds },
  });
  const list = asArray(
    providers?.shipmentProviders
    || providers?.providers
    || providers?.data
    || providers,
  );
  const providerId = pick(
    list[0]?.id,
    list[0]?.shipmentProviderId,
    list[0]?.code,
  );
  if (!providerId) {
    const error = new Error('jumia_no_shipment_provider');
    error.statusCode = 422;
    error.details = providers;
    throw error;
  }

  const packed = await jumiaRequest('post', '/v2/orders/pack', {
    body: {
      packages: [{
        orderItemIds: itemIds,
        orderItems: itemIds,
        shipmentProviderId: providerId,
      }],
    },
  });

  return { ok: true, orderId: id, itemIds, providerId, packed };
}

/** Mark packed items as Ready To Ship. */
export async function readyToShipJumiaOrder(orderId) {
  const { orderId: id, itemIds } = await resolveOrderItemIds(orderId);
  const result = await jumiaRequest('post', '/orders/ready-to-ship', {
    body: { orderItemIds: itemIds },
  });
  return { ok: true, orderId: id, itemIds, result };
}

/**
 * Pack then Ready-To-Ship (common seller flow).
 * Returns both steps; pack failure stops before RTS.
 */
export async function shipJumiaOrder(orderId) {
  const packed = await packJumiaOrder(orderId);
  const ready = await readyToShipJumiaOrder(orderId);
  return { ok: true, orderId: packed.orderId, packed, ready };
}

/** Cancel all items of a Jumia order. */
export async function cancelJumiaOrder(orderId) {
  const { orderId: id, itemIds } = await resolveOrderItemIds(orderId);
  const result = await jumiaRequest('put', '/orders/cancel', {
    body: { orderItemIds: itemIds },
  });
  return { ok: true, orderId: id, itemIds, result };
}

/** Shipping labels (base64 PDF when API returns them). */
export async function printJumiaLabels(orderId) {
  const { orderId: id, itemIds } = await resolveOrderItemIds(orderId);
  const result = await jumiaRequest('post', '/orders/print-labels', {
    body: { orderItemIds: itemIds },
  });
  return { ok: true, orderId: id, itemIds, result };
}
