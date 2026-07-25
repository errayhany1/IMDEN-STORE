/**
 * Push an existing NocoDB product to Tifawt using ORIGINAL name/SKU/images.
 *
 * Usage:
 *   node scripts/push-product-to-tifawt.mjs ERY-PG9128
 *   node scripts/push-product-to-tifawt.mjs PG9128 "Original caption name"
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', 'bot', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { createTifawtProduct } = await import('../bot/tifawtProducts.js');
const { buildSellerSku } = await import('../bot/productEnrichment.js');

const NOCODB_URL = process.env.VITE_NOCODB_URL || process.env.NOCODB_URL;
const NOCODB_TOKEN = process.env.VITE_NOCODB_API_TOKEN || process.env.NOCODB_API_TOKEN;
const NOCODB_TABLE = process.env.VITE_NOCODB_TABLE_PRODUCTS || process.env.NOCODB_TABLE_PRODUCTS;

const rawSku = process.argv[2];
if (!rawSku) {
  console.error('Usage: node scripts/push-product-to-tifawt.mjs <SKU> [originalName]');
  process.exit(1);
}

const http = axios.create({ timeout: 120000 });

async function findProduct(sku) {
  const candidates = Array.from(new Set([
    sku,
    buildSellerSku(sku),
    String(sku).replace(/^ERY-/i, ''),
  ]));
  for (const candidate of candidates) {
    const { data } = await http.get(`${NOCODB_URL}/api/v2/tables/${NOCODB_TABLE}/records`, {
      headers: { 'xc-token': NOCODB_TOKEN, accept: 'application/json' },
      params: { where: `(SKU,eq,${candidate})`, limit: 5 },
    });
    if (data?.list?.length) return data.list[0];
  }
  return null;
}

function imageUrl(file) {
  if (!file) return '';
  return file.signedUrl || (file.url?.startsWith('http') ? file.url : `${NOCODB_URL}/${file.url || ''}`);
}

async function downloadBuffer(url) {
  const { data } = await http.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(data);
}

const row = await findProduct(rawSku);
if (!row) {
  console.error('Product not found for', rawSku);
  process.exit(1);
}

const slots = [row.Image1, row.Image2, row.Image3, row.Image4, row.Image5]
  .flatMap((slot) => (Array.isArray(slot) ? slot : slot ? [slot] : []))
  .filter(Boolean);

// Tifawt gets originals only — prefer real-* uploads.
const preferred = slots.filter((f) => /real-/i.test(f.title || f.name || ''));
const files = (preferred.length ? preferred : slots).slice(0, 4);

const buffers = [];
for (const file of files) {
  const url = imageUrl(file);
  if (!url) continue;
  console.log('Downloading', file.title || file.name || url.slice(0, 60));
  buffers.push(await downloadBuffer(url));
}

if (!buffers.length) {
  console.error('No images available to send to Tifawt');
  process.exit(1);
}

const tifawtSku = String(row.SKU || rawSku).replace(/^ERY-/i, '').trim() || String(rawSku);
const name = String(process.argv[3] || row.Title || tifawtSku).trim();
const price = Number(row.price) || 0;
const barcode = String(row.Barcode || '').trim();

console.log(`Configured: ${Boolean(process.env.TIFAWT_EMAIL && process.env.TIFAWT_PASSWORD)}`);
console.log(`Pushing to Tifawt: ${name} | ${price} DH | ${tifawtSku} | ${buffers.length} images`);

const result = await createTifawtProduct({
  name,
  sku: tifawtSku,
  price,
  barcode,
  imageBuffers: buffers,
  imageFileName: `${tifawtSku}-1.jpg`,
});

console.log(JSON.stringify({
  ok: result?.ok,
  skipped: result?.skipped,
  reason: result?.reason,
  error: result?.error,
  status: result?.status,
  imageCount: result?.imageCount,
  id: result?.data?.id || result?.data?.data?.id || null,
}, null, 2));
if (!result?.ok) process.exit(1);
