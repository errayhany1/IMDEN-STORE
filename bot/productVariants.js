import axios from 'axios';
import { colorLabelArabic } from './colorVariants.js';

export const PRODUCT_VARIANTS_TABLE = (
  process.env.NOCODB_TABLE_PRODUCT_VARIANTS
  || process.env.VITE_NOCODB_TABLE_PRODUCT_VARIANTS
  || 'my006z3z2ataq7u'
).trim();

function config() {
  return {
    url: (process.env.VITE_NOCODB_URL || process.env.NOCODB_URL || '').replace(/\/+$/, ''),
    token: process.env.VITE_NOCODB_API_TOKEN || process.env.NOCODB_API_TOKEN || '',
  };
}

function recordsUrl() {
  const { url } = config();
  return `${url}/api/v2/tables/${PRODUCT_VARIANTS_TABLE}/records`;
}

export function isProductVariantsConfigured() {
  const { url, token } = config();
  return Boolean(url && token && PRODUCT_VARIANTS_TABLE);
}

async function findVariant(productId, colorCode) {
  if (!isProductVariantsConfigured()) return null;
  const { token } = config();
  const { data } = await axios.get(recordsUrl(), {
    params: {
      where: `(Product_ID,eq,${Number(productId)})~and(Color_Code,eq,${String(colorCode)})`,
      limit: 1,
    },
    headers: { 'xc-token': token },
    timeout: 30_000,
  });
  return data?.list?.[0] || null;
}

/**
 * Idempotently persist a color variant. Re-generation patches the same row,
 * so the website and Jumia keep a stable identity.
 */
export async function upsertProductVariant({
  productId,
  colorLabel,
  colorCode,
  jumiaSku,
  imageFiles = [],
  active = null,
}) {
  if (!isProductVariantsConfigured()) {
    throw new Error('product_variants_not_configured');
  }
  const { token } = config();
  const existing = await findVariant(productId, colorCode);
  const payload = {
    Product_ID: Number(productId),
    Color_Name_AR: colorLabelArabic(colorLabel),
    Color_Name_FR: String(colorLabel || '').trim(),
    Color_Code: String(colorCode || '').trim(),
    Jumia_SKU: String(jumiaSku || '').trim(),
  };
  // Existing live variants stay visible while replacement images await
  // approval. New rows start hidden until Jumia publishing succeeds.
  if (!existing || active != null) {
    payload.Active = String(active || 'PENDING').toUpperCase();
  }
  imageFiles.filter(Boolean).slice(0, 7).forEach((file, index) => {
    payload[`Image${index + 1}`] = [file];
  });

  if (existing?.Id || existing?.id) {
    payload.Id = existing.Id || existing.id;
    const { data } = await axios.patch(recordsUrl(), payload, {
      headers: { 'xc-token': token, 'Content-Type': 'application/json' },
      timeout: 30_000,
    });
    return { row: data, rowId: payload.Id, mode: 'updated' };
  }

  const { data } = await axios.post(recordsUrl(), payload, {
    headers: { 'xc-token': token, 'Content-Type': 'application/json' },
    timeout: 30_000,
  });
  return { row: data, rowId: data?.Id || data?.id, mode: 'created' };
}

export async function setProductVariantActive(rowId, active, { error = '' } = {}) {
  if (!rowId || !isProductVariantsConfigured()) return null;
  const { token } = config();
  const status = error
    ? `ERROR: ${String(error).slice(0, 180)}`
    : (active ? 'ACTIVE' : 'INACTIVE');
  const { data } = await axios.patch(recordsUrl(), {
    Id: Number(rowId),
    Active: status,
  }, {
    headers: { 'xc-token': token, 'Content-Type': 'application/json' },
    timeout: 30_000,
  });
  return data;
}

/** All color rows for a product, regardless of Active status. */
export async function listProductVariantsByProductId(productId) {
  if (!isProductVariantsConfigured() || !productId) return [];
  const { token } = config();
  const { data } = await axios.get(recordsUrl(), {
    params: {
      where: `(Product_ID,eq,${Number(productId)})`,
      limit: 100,
      sort: 'Id',
    },
    headers: { 'xc-token': token },
    timeout: 30_000,
  });
  return data?.list || [];
}

/** Jumia Seller SKUs linked to a product via ProductVariants. */
export async function listJumiaColorSkusByProductId(productId) {
  const rows = await listProductVariantsByProductId(productId);
  return [...new Set(
    rows
      .map((row) => String(row.Jumia_SKU || '').trim().toUpperCase())
      .filter(Boolean),
  )];
}

/**
 * Pure helper: which ProductVariants rows should be deactivated when the
 * current generation keeps only `keepColorCodes`.
 */
export function selectStaleProductVariants(rows = [], keepColorCodes = []) {
  const keep = new Set(
    (Array.isArray(keepColorCodes) ? keepColorCodes : [])
      .map((code) => String(code || '').trim().toUpperCase())
      .filter(Boolean),
  );
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const code = String(row?.Color_Code || '').trim().toUpperCase();
      const rowId = row?.Id || row?.id;
      const status = String(row?.Active || '').trim().toUpperCase();
      return {
        rowId,
        code,
        jumiaSku: String(row?.Jumia_SKU || '').trim(),
        status,
      };
    })
    .filter((row) => {
      if (!row.rowId) return false;
      if (row.code && keep.has(row.code)) return false;
      if (row.status === 'INACTIVE' || row.status.startsWith('ERROR:')) return false;
      return true;
    });
}

/**
 * Mark every color row that is no longer part of the current generation as
 * INACTIVE so the storefront and stock sync stop treating it as live.
 */
export async function deactivateRemovedProductVariants(productId, keepColorCodes = []) {
  const rows = await listProductVariantsByProductId(productId);
  const stale = selectStaleProductVariants(rows, keepColorCodes);
  const deactivated = [];
  for (const row of stale) {
    await setProductVariantActive(row.rowId, false);
    deactivated.push({
      rowId: row.rowId,
      code: row.code,
      jumiaSku: row.jumiaSku,
    });
  }
  return deactivated;
}
