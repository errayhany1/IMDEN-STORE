/**
 * Every-three-days marketing digest for newly published catalogue products.
 *
 * Recipients are a dedicated, consented Brevo list. Brevo marketing campaigns
 * provide its standard unsubscribe footer; never use order exports here.
 */
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

const DAY = 24 * 60 * 60 * 1000;
const SITE_URL = String(process.env.PUBLIC_SITE_URL || 'https://errayhany.com').replace(/\/+$/, '');
const STATE_FILE = process.env.PRODUCT_DIGEST_STATE_FILE || '/data/product-digest-state.json';

const enabled = () => String(process.env.PRODUCT_DIGEST_ENABLED || '').toLowerCase() === 'true';
const apiKey = () => String(process.env.BREVO_API_KEY || process.env.SIB_API_KEY || '').trim();
const listId = () => Number(process.env.PRODUCT_DIGEST_BREVO_LIST_ID || 0);

function nocoConfig() {
  return {
    url: String(process.env.NOCODB_URL || process.env.VITE_NOCODB_URL || '').replace(/\/+$/, ''),
    token: String(process.env.NOCODB_API_TOKEN || process.env.VITE_NOCODB_API_TOKEN || '').trim(),
    table: String(process.env.NOCODB_TABLE_PRODUCTS || process.env.VITE_NOCODB_TABLE_PRODUCTS || '').trim(),
  };
}

const esc = (value) => String(value || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function slugify(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').trim()
    .replace(/[\s-]+/g, '-').replace(/^-+|-+$/g, '');
}

function imageUrl(row) {
  const source = row.Image1?.[0] || row.Image1 || row.image?.[0] || row.image;
  return source?.url || source?.signedUrl || source || '';
}

function mapProduct(row) {
  const sku = String(row.SKU || row.Ref || row.Id || row.id || '').trim();
  const name = String(row.Arabic_Title || row.Title || row.French_Title || sku).trim();
  return {
    sku,
    name,
    price: Number(row.price ?? row.Price ?? 0) || 0,
    image: imageUrl(row),
    url: `${SITE_URL}/p/${encodeURIComponent(sku)}/${slugify(name)}`,
    createdAt: row.CreatedAt || row.created_at || '',
  };
}

async function readState() {
  try {
    return JSON.parse(await fs.readFile(STATE_FILE, 'utf8'));
  } catch {
    return { sentSkus: [], lastSentAt: '' };
  }
}

async function writeState(state) {
  await fs.mkdir(path.dirname(STATE_FILE), { recursive: true });
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

async function fetchNewProducts(since) {
  const config = nocoConfig();
  if (!config.url || !config.token || !config.table) throw new Error('product_digest_nocodb_not_configured');
  const { data } = await axios.get(`${config.url}/api/v2/tables/${config.table}/records`, {
    headers: { 'xc-token': config.token },
    params: { where: '(POSTEBL,eq,POSTEBL)', sort: '-CreatedAt', limit: 100 },
    timeout: 30000,
  });
  return (data?.list || [])
    .map(mapProduct)
    .filter((product) => product.sku && product.image && product.createdAt && new Date(product.createdAt) >= since);
}

function html(products) {
  const cards = products.map((product) => `
    <td width="50%" style="padding:7px;vertical-align:top">
      <a href="${esc(product.url)}" style="color:#0b2a5b;text-decoration:none">
        <img src="${esc(product.image)}" alt="${esc(product.name)}" width="230" style="display:block;width:100%;max-width:230px;height:auto;margin:auto;border-radius:10px" />
        <strong style="display:block;padding:10px 3px 4px;font-size:14px">${esc(product.name)}</strong>
        <span style="font-weight:bold">${esc(product.price)} درهم</span>
      </a>
    </td>`).join('');
  return `<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;background:#eef2f7;font-family:Arial,sans-serif;color:#172033">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:18px"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:14px;overflow:hidden">
      <tr><td style="padding:24px;background:#0b2a5b;color:#fff;text-align:center"><h1 style="margin:0;font-size:24px">وصلت منتجات جديدة بالجملة</h1><p style="margin:9px 0 0">اكتشف أحدث عروض Errayhany Grossiste</p></td></tr>
      <tr><td style="padding:16px"><table width="100%" cellpadding="0" cellspacing="0"><tr>${cards}</tr></table></td></tr>
      <tr><td style="padding:18px;text-align:center"><a href="${SITE_URL}" style="background:#0b2a5b;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold">تصفح الكتالوج</a></td></tr>
    </table></td></tr></table></body></html>`;
}

async function createCampaign(products) {
  const response = await axios.post('https://api.brevo.com/v3/emailCampaigns', {
    name: `منتجات جديدة — ${new Date().toISOString().slice(0, 10)}`,
    subject: `منتجات جديدة بالجملة من Errayhany (${products.length})`,
    sender: { name: 'Errayhany Grossiste', email: 'offers@errayhany.com' },
    type: 'classic',
    htmlContent: html(products),
    recipients: { listIds: [listId()] },
  }, { headers: { 'api-key': apiKey(), 'content-type': 'application/json' }, timeout: 30000 });
  await axios.post(`https://api.brevo.com/v3/emailCampaigns/${response.data.id}/sendNow`, {}, {
    headers: { 'api-key': apiKey() }, timeout: 30000,
  });
  return response.data.id;
}

export async function runProductDigest({ force = false } = {}) {
  if (!enabled() && !force) return { skipped: 'disabled' };
  if (!apiKey() || !listId()) return { skipped: 'brevo_marketing_list_not_configured' };
  const state = await readState();
  if (!force && state.lastSentAt && Date.now() - new Date(state.lastSentAt).getTime() < 3 * DAY) {
    return { skipped: 'not_due' };
  }
  const products = (await fetchNewProducts(new Date(Date.now() - 3 * DAY)))
    .filter((product) => !state.sentSkus.includes(product.sku))
    .slice(0, Math.max(1, Math.min(12, Number(process.env.PRODUCT_DIGEST_MAX_PRODUCTS || 8))));
  if (!products.length) return { skipped: 'no_new_products' };
  const campaignId = await createCampaign(products);
  await writeState({
    lastSentAt: new Date().toISOString(),
    sentSkus: [...new Set([...state.sentSkus, ...products.map((product) => product.sku)])].slice(-500),
  });
  return { sent: true, campaignId, products: products.length };
}

export function startProductDigest() {
  const interval = Math.max(3 * DAY, Number(process.env.PRODUCT_DIGEST_INTERVAL_MS || 3 * DAY));
  if (!enabled()) return;
  const run = () => runProductDigest().then((result) => console.log('[product-digest]', result))
    .catch((error) => console.error('[product-digest] failed:', error?.response?.data || error?.message));
  setTimeout(run, 20_000);
  setInterval(run, interval);
}
