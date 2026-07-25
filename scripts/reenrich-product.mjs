/**
 * Re-run AI enrichment for an existing NocoDB product (title/description/AI images).
 *
 * Usage:
 *   node scripts/reenrich-product.mjs ERY-PG9128
 *   node scripts/reenrich-product.mjs PG9128
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import FormData from 'form-data';
import {
  enrichProduct,
  buildNocoRecordFromEnrichment,
  buildSellerSku,
} from '../bot/productEnrichment.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', 'bot', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const NOCODB_URL = process.env.VITE_NOCODB_URL || process.env.NOCODB_URL;
const NOCODB_TOKEN = process.env.VITE_NOCODB_API_TOKEN || process.env.NOCODB_API_TOKEN;
const NOCODB_TABLE = process.env.VITE_NOCODB_TABLE_PRODUCTS || process.env.NOCODB_TABLE_PRODUCTS;

const rawSku = process.argv[2];
if (!rawSku) {
  console.error('Usage: node scripts/reenrich-product.mjs <SKU>');
  process.exit(1);
}

const sellerSku = buildSellerSku(rawSku);
const http = axios.create({ timeout: 120000 });

async function uploadToNocoDB(buffer, fileName) {
  const form = new FormData();
  form.append('file', buffer, { filename: fileName, contentType: 'image/jpeg' });
  const uploadRes = await http.post(`${NOCODB_URL}/api/v2/storage/upload`, form, {
    headers: { 'xc-token': NOCODB_TOKEN, ...form.getHeaders() },
  });
  return uploadRes.data[0];
}

async function findProduct(sku) {
  const candidates = Array.from(new Set([sku, buildSellerSku(sku), String(sku).replace(/^ERY-/i, '')]));
  for (const candidate of candidates) {
    const { data } = await http.get(`${NOCODB_URL}/api/v2/tables/${NOCODB_TABLE}/records`, {
      headers: { 'xc-token': NOCODB_TOKEN, accept: 'application/json' },
      params: { where: `(SKU,eq,${candidate})`, limit: 5 },
    });
    if (data?.list?.length) return data.list[0];
  }
  const { data } = await http.get(`${NOCODB_URL}/api/v2/tables/${NOCODB_TABLE}/records`, {
    headers: { 'xc-token': NOCODB_TOKEN, accept: 'application/json' },
    params: { limit: 30, sort: '-Id' },
  });
  return (data?.list || []).find((r) => String(r.SKU || '').toUpperCase().includes(String(sku).toUpperCase())) || null;
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

console.log(`Found #${row.Id} ${row.SKU} — ${row.Title}`);

const sourceFiles = [row.Image1, row.Image2, row.Image3, row.Image4, row.Image5]
  .flatMap((slot) => (Array.isArray(slot) ? slot : slot ? [slot] : []))
  .filter(Boolean);

if (!sourceFiles.length) {
  console.error('No images on the product to enrich from');
  process.exit(1);
}

// Prefer original seller photos (real-*) as AI input; fall back to everything else.
const realFirst = [
  ...sourceFiles.filter((f) => /real[-_]/i.test(String(f.title || f.name || f.url || ''))),
  ...sourceFiles.filter((f) => !/real[-_]|ai[-_]|specs[-_]/i.test(String(f.title || f.name || f.url || ''))),
];
const preferredSources = realFirst.length ? realFirst : sourceFiles;

const originalBuffers = [];
for (const file of preferredSources.slice(0, 4)) {
  const url = imageUrl(file);
  if (!url) continue;
  console.log('Downloading', file.title || file.name || url.slice(0, 80));
  originalBuffers.push(await downloadBuffer(url));
}

const enrichment = await enrichProduct({
  originalBuffers,
  name: row.Title || row.Arabic_Title || row.French_Title || sellerSku,
  price: Number(row.price) || 0,
  oldPrice: Number(row.old_price || row.Old_Price || 0) || 0,
  ref: String(row.SKU || sellerSku).replace(/^ERY-/i, ''),
  amazonUrl: row.Amazon_URL || '',
  uploadToNocoDB,
  nocodbUrl: NOCODB_URL,
  syncSheet: false,
});

const patch = buildNocoRecordFromEnrichment({
  price: Number(row.price) || 0,
  name: row.Title || enrichment.copy?.arabic_title || sellerSku,
  enrichment,
});
patch.Id = row.Id;

await http.patch(`${NOCODB_URL}/api/v2/tables/${NOCODB_TABLE}/records`, patch, {
  headers: { 'xc-token': NOCODB_TOKEN, 'Content-Type': 'application/json' },
});

console.log(JSON.stringify({
  id: row.Id,
  sku: enrichment.sellerSku,
  skippedAi: enrichment.skippedAi,
  hasAiImages: enrichment.hasAiImages,
  aiFailures: enrichment.aiFailures || [],
  frenchTitle: enrichment.copy?.french_title || null,
  arabicTitle: enrichment.copy?.arabic_title || null,
  imageCount: enrichment.nocoImages?.length || 0,
  barcode: enrichment.barcode || '',
}, null, 2));
