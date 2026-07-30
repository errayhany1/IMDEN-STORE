/**
 * Permanent public image URLs for Jumia PIM.
 *
 * Failure mode we solve:
 * - NocoDB S3 signed URLs expire (~2h) → Jumia QC OK but Not Live
 * - Disk-only `/public-images/{hash}.jpg` dies on every EasyPanel redeploy → images vanish again
 *
 * Durable design:
 * Jumia receives stable URLs:
 *   https://errayhany.com/bot-api/public-images/p/{sku}/{n}.jpg
 * On each request the storefront:
 *   1) serves a local cache file if present
 *   2) otherwise re-fetches a FRESH signed URL from NocoDB Image{n} and caches it
 * So redeploys wipe disk but images keep working as long as NocoDB still has attachments.
 */
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import express from 'express';
import axios from 'axios';
import sharp from 'sharp';

const CACHE_DIR = (
  process.env.JUMIA_IMAGE_CACHE_DIR
  || path.join(process.cwd(), 'data', 'jumia-public-images')
);

const SITE_URL = (
  process.env.PUBLIC_SITE_URL
  || 'https://errayhany.com'
).replace(/\/+$/, '');

/** Public base Jumia (and browsers) will fetch. Served by imden /bot-api. */
export function publicImageBaseUrl() {
  const override = (process.env.JUMIA_PUBLIC_IMAGE_BASE || '').trim().replace(/\/+$/, '');
  if (override) return override;
  return `${SITE_URL}/bot-api/public-images`;
}

function uploadSecret() {
  return (
    process.env.JUMIA_IMAGE_UPLOAD_SECRET
    || process.env.ADMIN_PASSWORD
    || process.env.VITE_ADMIN_PASSWORD
    || 'imden2026'
  ).trim();
}

function nocodbConfig() {
  return {
    url: (process.env.VITE_NOCODB_URL || process.env.NOCODB_URL || '').replace(/\/+$/, ''),
    token: process.env.VITE_NOCODB_API_TOKEN || process.env.NOCODB_API_TOKEN || '',
    table: process.env.VITE_NOCODB_TABLE_PRODUCTS || process.env.NOCODB_TABLE_PRODUCTS || '',
    variantsTable: (
      process.env.NOCODB_TABLE_PRODUCT_VARIANTS
      || process.env.VITE_NOCODB_TABLE_PRODUCT_VARIANTS
      || 'my006z3z2ataq7u'
    ).trim(),
  };
}

function isAlreadyPublic(url) {
  const u = String(url || '');
  if (!u) return false;
  const base = publicImageBaseUrl();
  return u.startsWith(base) || /\/bot-api\/public-images\//i.test(u);
}

function isSignedOrEphemeral(url) {
  return /X-Amz-|Signature=|Expires=|nocohub|amazonaws\.com/i.test(String(url || ''));
}

function isDurablePublicUrl(url) {
  return /\/bot-api\/public-images\/p\//i.test(String(url || ''));
}

export function safeSkuPart(sku) {
  return String(sku || 'img')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 64) || 'img';
}

/** Stable Jumia-facing URL — survives container rebuilds via NocoDB-backed proxy. */
export function permanentSkuImageUrl(sku, index = 1) {
  const part = encodeURIComponent(String(sku || 'img').trim() || 'img');
  const n = Math.max(1, Number(index) || 1);
  return `${publicImageBaseUrl()}/p/${part}/${n}.jpg`;
}

function stableCacheFileName(sku, index) {
  return `p-${safeSkuPart(sku)}-${Math.max(1, Number(index) || 1)}.jpg`;
}

async function ensureCacheDir() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

/** Resize/compress so nginx (often ~1MB body limit) can accept the mirror upload. */
async function optimizeForJumia(buffer) {
  try {
    return await sharp(buffer)
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
  } catch {
    return buffer;
  }
}

async function writeCacheFile(fileName, buffer) {
  await ensureCacheDir();
  const filePath = path.join(CACHE_DIR, fileName);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

async function readCacheFile(fileName) {
  try {
    const filePath = path.join(CACHE_DIR, fileName);
    const buf = await fs.readFile(filePath);
    if (!buf || buf.length < 500) return null;
    return buf;
  } catch {
    return null;
  }
}

/**
 * Persist a JPEG/PNG buffer locally and return its public URL.
 * Prefer permanentSkuImageUrl + stable cache names for Jumia.
 */
export async function persistPublicImage(buffer, { sku = 'img', index = 1, stable = true } = {}) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 500) {
    throw new Error('invalid_image_buffer');
  }
  const optimized = await optimizeForJumia(buffer);
  await ensureCacheDir();
  let name;
  let url;
  if (stable) {
    name = stableCacheFileName(sku, index);
    url = permanentSkuImageUrl(sku, index);
  } else {
    const hash = crypto.createHash('sha1').update(optimized).digest('hex').slice(0, 16);
    name = `${safeSkuPart(sku)}-${index}-${hash}.jpg`;
    url = `${publicImageBaseUrl()}/${name}`;
  }
  await writeCacheFile(name, optimized);
  return { url, buffer: optimized, fileName: name };
}

async function downloadImage(url, attempt = 0) {
  const { data, headers, status } = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 60_000,
    maxRedirects: 5,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ErrayhanyJumiaImages/1.0)',
      Accept: 'image/*,*/*',
    },
    validateStatus: () => true,
  });
  if (status < 200 || status >= 400) {
    if ((status === 429 || status >= 500) && attempt < 2) {
      await sleep(500 * (attempt + 1) ** 2);
      return downloadImage(url, attempt + 1);
    }
    throw new Error(`image_fetch_${status}`);
  }
  const buf = Buffer.from(data);
  const ct = String(headers['content-type'] || '');
  if (buf.length < 500) throw new Error('image_too_small');
  if (ct && !/^image\//i.test(ct) && !/octet-stream/i.test(ct)) {
    const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
    const isPng = buf[0] === 0x89 && buf[1] === 0x50;
    if (!isJpeg && !isPng) throw new Error(`not_an_image:${ct}`);
  }
  return buf;
}

function attachmentUrl(fileObj, nocodbUrl) {
  if (!fileObj) return '';
  const raw = fileObj.signedUrl || fileObj.url || '';
  if (!raw) return '';
  return raw.startsWith('http') ? raw : `${nocodbUrl}/${raw}`;
}

function collectRowImageUrls(row, nocodbUrl) {
  const out = [];
  for (let i = 1; i <= 8; i++) {
    const field = row?.[`Image${i}`];
    const file = Array.isArray(field) ? field[0] : field;
    const u = attachmentUrl(file, nocodbUrl);
    if (u) out.push({ index: i, url: u });
  }
  return out;
}

// Jumia fetches a product's images in one burst. On a cold cache that turns
// into a dozen simultaneous NocoDB lookups, and the throttled ones used to
// surface as 404 → "images failed" on the listing.
const ROW_CACHE_TTL_MS = 5 * 60_000;
const rowCache = new Map();
const rowLookups = new Map();

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

async function lookupNocoProductBySku(sku) {
  const {
    url, token, table, variantsTable,
  } = nocodbConfig();
  if (!url || !token || !table || !sku) return null;
  const exact = String(sku).trim();

  async function queryOne(tableId, field, value) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { data, status } = await axios.get(
          `${url}/api/v2/tables/${tableId}/records`,
          {
            params: {
              where: `(${field},eq,${value})`,
              limit: 1,
            },
            headers: { 'xc-token': token },
            timeout: 30_000,
            validateStatus: () => true,
          },
        );
        if (status >= 200 && status < 300) return data?.list?.[0] || null;
        if (status !== 429 && status < 500) return null;
      } catch {
        // Network hiccup — same backoff as a throttled response.
      }
      await sleep(400 * (attempt + 1) ** 2);
    }
    return null;
  }

  for (const field of ['SellerSKU', 'SKU', 'reference_clean']) {
    const row = await queryOne(table, field, exact);
    if (row) return row;
  }
  if (variantsTable) {
    const row = await queryOne(variantsTable, 'Jumia_SKU', exact);
    if (row) return row;
  }

  // Extra Amazon links publish as `ERY-X-2`. If that listing was created before
  // it got its own variant row, serve the base product rather than a dead slot.
  const base = exact.replace(/-\d{1,2}$/, '');
  if (base && base !== exact) {
    for (const field of ['SellerSKU', 'SKU', 'reference_clean']) {
      const row = await queryOne(table, field, base);
      if (row) return row;
    }
  }
  return null;
}

async function findNocoProductBySku(sku) {
  const key = String(sku || '').trim();
  if (!key) return null;

  const cached = rowCache.get(key);
  if (cached && Date.now() - cached.ts < ROW_CACHE_TTL_MS) return cached.row;

  const inFlight = rowLookups.get(key);
  if (inFlight) return inFlight;

  const promise = lookupNocoProductBySku(key)
    .then((row) => {
      if (row) rowCache.set(key, { row, ts: Date.now() });
      return row;
    })
    .finally(() => rowLookups.delete(key));
  rowLookups.set(key, promise);
  return promise;
}

/**
 * Re-fetch Image{n} from NocoDB (fresh signed URL) and cache it under a stable name.
 */
const refreshJobs = new Map();

export async function refreshSkuImageFromNoco(sku, index = 1) {
  const key = `${sku}#${index}`;
  const running = refreshJobs.get(key);
  if (running) return running;

  const job = (async () => {
    const { url: nocodbUrl } = nocodbConfig();
    const row = await findNocoProductBySku(sku);
    if (!row) throw new Error('product_not_found');
    const field = row[`Image${index}`];
    const file = Array.isArray(field) ? field[0] : field;
    const source = attachmentUrl(file, nocodbUrl);
    if (!source) throw new Error('image_slot_empty');
    const buf = await downloadImage(source);
    return persistPublicImage(buf, { sku, index, stable: true });
  })().finally(() => refreshJobs.delete(key));

  refreshJobs.set(key, job);
  return job;
}

/**
 * Push bytes to the storefront /bot-api host so Jumia can fetch them
 * (imden-bot disk is not public).
 */
async function mirrorToPublicHost(buffer, { sku, index, fileName }) {
  const endpoint = (
    process.env.JUMIA_IMAGE_UPLOAD_URL
    || `${SITE_URL}/bot-api/api/public-images`
  ).trim();
  if (!endpoint) return null;

  try {
    const { data, status } = await axios.post(
      endpoint,
      {
        sku,
        index,
        fileName,
        stable: true,
        contentType: 'image/jpeg',
        dataBase64: buffer.toString('base64'),
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': uploadSecret(),
        },
        timeout: 90_000,
        validateStatus: () => true,
      },
    );
    if (status >= 200 && status < 300 && data?.url) return String(data.url);
    console.warn('[jumia-images] mirror upload failed', status, data?.error || data);
  } catch (e) {
    console.warn('[jumia-images] mirror upload error:', e.message);
  }
  return null;
}

async function assertPublicReachable(url) {
  try {
    const head = await axios.head(url, {
      timeout: 20_000,
      maxRedirects: 5,
      validateStatus: () => true,
      headers: { 'User-Agent': 'ErrayhanyJumiaImages/1.0' },
    });
    if (head.status >= 200 && head.status < 400) return true;
  } catch {
    // fall through to GET
  }
  try {
    const get = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30_000,
      maxRedirects: 5,
      maxContentLength: 2_000_000,
      validateStatus: () => true,
      headers: {
        'User-Agent': 'ErrayhanyJumiaImages/1.0',
        Range: 'bytes=0-1023',
      },
    });
    return get.status >= 200 && get.status < 400 && Buffer.from(get.data || []).length > 0;
  } catch {
    return false;
  }
}

/**
 * Convert ephemeral (NocoDB signed) image URLs into durable public proxy URLs.
 * Never returns a URL that is not reachable from the public host.
 */
export async function ensurePublicImageUrls(urls = [], { sku = 'img', startIndex = 1 } = {}) {
  const list = [...new Set(
    (Array.isArray(urls) ? urls : [])
      .map((u) => String(u || '').trim())
      .filter((u) => /^https?:\/\//i.test(u)),
  )].slice(0, 8);

  if (!list.length) return [];

  const out = [];
  for (let i = 0; i < list.length; i++) {
    const index = Math.max(1, Number(startIndex) || 1) + i;
    const url = list[i];
    const permanent = permanentSkuImageUrl(sku, index);

    try {
      // Already our durable proxy URL — warm cache / verify, keep it.
      if (isDurablePublicUrl(url) && !isSignedOrEphemeral(url)) {
        const cached = await readCacheFile(stableCacheFileName(sku, index));
        if (!cached) {
          try {
            await refreshSkuImageFromNoco(sku, index);
          } catch {
            // If Noco refresh fails, try downloading the durable URL itself.
            const buf = await downloadImage(url);
            await persistPublicImage(buf, { sku, index, stable: true });
          }
        }
        if (await assertPublicReachable(permanent)) {
          out.push(permanent);
          continue;
        }
      }

      const buf = await downloadImage(url);
      const persisted = await persistPublicImage(buf, { sku, index, stable: true });
      const mirrored = await mirrorToPublicHost(persisted.buffer, {
        sku,
        index,
        fileName: persisted.fileName,
      });

      // Prefer the durable /p/{sku}/{n}.jpg form — never a hash-only path that dies on redeploy.
      const candidate = permanent;
      if (mirrored && isDurablePublicUrl(mirrored)) {
        // ok
      } else if (mirrored && !isDurablePublicUrl(mirrored)) {
        console.warn('[jumia-images] mirror returned non-durable URL; using proxy path anyway', mirrored);
      }

      const ok = await assertPublicReachable(candidate);
      if (!ok) {
        // Last resort: ask public host to accept bytes again, then re-check.
        await mirrorToPublicHost(persisted.buffer, {
          sku,
          index,
          fileName: persisted.fileName,
        });
        if (!(await assertPublicReachable(candidate))) {
          throw new Error('public_url_unreachable');
        }
      }
      out.push(candidate);
    } catch (e) {
      console.warn(`[jumia-images] failed to materialize ${url.slice(0, 80)}…`, e.message);
      // Do not pass signed / unreachable URLs to Jumia.
    }
  }
  return out;
}

/**
 * Warm durable proxy URLs for a SKU from current NocoDB Image1…N slots.
 * Useful after redeploy or for bulk repair.
 */
export async function ensurePublicImagesForSku(sku, { max = 8 } = {}) {
  const { url: nocodbUrl } = nocodbConfig();
  const row = await findNocoProductBySku(sku);
  if (!row) return { ok: false, error: 'product_not_found', urls: [] };
  const slots = collectRowImageUrls(row, nocodbUrl).slice(0, max);
  if (!slots.length) return { ok: false, error: 'missing_images', urls: [] };

  const sourceUrls = slots.map((s) => s.url);
  const urls = await ensurePublicImageUrls(sourceUrls, { sku });
  return {
    ok: urls.length > 0,
    error: urls.length ? null : 'images_not_public',
    urls,
    rowId: row.Id,
  };
}

/**
 * Express routes: durable proxy + static cache + authenticated upload (bot → imden mirror).
 */
export function registerPublicImageRoutes(app) {
  ensureCacheDir().catch(() => {});

  // Durable Jumia URL: /public-images/p/{sku}/{n}.jpg
  app.get('/public-images/p/:sku/:index', async (req, res) => {
    try {
      const sku = decodeURIComponent(String(req.params.sku || '').trim());
      const index = Math.max(1, parseInt(String(req.params.index || '').replace(/\.jpe?g$/i, ''), 10) || 0);
      if (!sku || !index) {
        return res.status(400).type('text/plain').send('bad_request');
      }

      const fileName = stableCacheFileName(sku, index);
      let buf = await readCacheFile(fileName);
      if (!buf) {
        try {
          const refreshed = await refreshSkuImageFromNoco(sku, index);
          buf = refreshed.buffer;
        } catch (e) {
          console.warn(`[jumia-images] proxy miss sku=${sku} #${index}:`, e.message);
          return res.status(404).type('text/plain').send('not_found');
        }
      }

      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.send(buf);
    } catch (e) {
      console.error('[jumia-images] proxy error:', e.message);
      return res.status(500).type('text/plain').send('error');
    }
  });

  app.use(
    '/public-images',
    express.static(CACHE_DIR, {
      maxAge: '365d',
      fallthrough: true,
      setHeaders(res) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('Access-Control-Allow-Origin', '*');
      },
    }),
  );

  app.post('/api/public-images', express.json({ limit: '12mb' }), async (req, res) => {
    const secret = uploadSecret();
    const provided = String(
      req.get('X-Admin-Password')
      || req.get('X-Image-Upload-Secret')
      || req.body?.secret
      || '',
    ).trim();
    if (!secret || provided !== secret) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }
    try {
      const b64 = String(req.body?.dataBase64 || '').replace(/^data:image\/\w+;base64,/, '');
      if (!b64) return res.status(400).json({ ok: false, error: 'missing_data' });
      const buffer = Buffer.from(b64, 'base64');
      const sku = req.body?.sku || 'img';
      const index = Number(req.body?.index) || 1;
      const wantStable = req.body?.stable !== false;

      let url;
      let fileName = req.body?.fileName;
      if (fileName && /^[a-zA-Z0-9._-]+\.jpe?g$/i.test(fileName)) {
        await writeCacheFile(fileName, buffer);
        // If upload used stable p-SKU-N.jpg naming, expose durable proxy URL.
        const m = String(fileName).match(/^p-(.+)-(\d+)\.jpe?g$/i);
        if (m) {
          url = permanentSkuImageUrl(sku, index);
        } else if (wantStable) {
          const persisted = await persistPublicImage(buffer, { sku, index, stable: true });
          url = persisted.url;
          fileName = persisted.fileName;
        } else {
          url = `${publicImageBaseUrl()}/${fileName}`;
        }
      } else {
        const persisted = await persistPublicImage(buffer, { sku, index, stable: true });
        url = persisted.url;
        fileName = persisted.fileName;
      }
      return res.json({ ok: true, url, fileName });
    } catch (e) {
      console.error('[jumia-images] upload failed:', e.message);
      return res.status(500).json({ ok: false, error: e.message || 'upload_failed' });
    }
  });
}
