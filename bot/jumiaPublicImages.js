/**
 * Permanent public image URLs for Jumia PIM.
 *
 * Jumia copies seller image URLs onto vendorcenter.jumia.com. NocoDB S3 signed
 * URLs expire (~2h) and often leave products QC-approved but Not Live
 * (VISIBLE_NO_COUNTRIES). We download once, store on disk, and serve from
 * https://errayhany.com/bot-api/public-images/...
 */
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import express from 'express';
import axios from 'axios';

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

function isAlreadyPublic(url) {
  const u = String(url || '');
  if (!u) return false;
  const base = publicImageBaseUrl();
  return u.startsWith(base) || /\/bot-api\/public-images\//i.test(u);
}

function isSignedOrEphemeral(url) {
  return /X-Amz-|Signature=|Expires=|nocohub|amazonaws\.com/i.test(String(url || ''));
}

function safeSkuPart(sku) {
  return String(sku || 'img')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 48) || 'img';
}

async function ensureCacheDir() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

/**
 * Persist a JPEG/PNG buffer locally and return its public URL.
 */
export async function persistPublicImage(buffer, { sku = 'img', index = 1 } = {}) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 500) {
    throw new Error('invalid_image_buffer');
  }
  await ensureCacheDir();
  const hash = crypto.createHash('sha1').update(buffer).digest('hex').slice(0, 16);
  const name = `${safeSkuPart(sku)}-${index}-${hash}.jpg`;
  const filePath = path.join(CACHE_DIR, name);
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, buffer);
  }
  return `${publicImageBaseUrl()}/${name}`;
}

async function downloadImage(url) {
  const { data, headers } = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 60_000,
    maxRedirects: 5,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ErrayhanyJumiaImages/1.0)',
      Accept: 'image/*,*/*',
    },
    validateStatus: (s) => s >= 200 && s < 400,
  });
  const buf = Buffer.from(data);
  const ct = String(headers['content-type'] || '');
  if (buf.length < 500) throw new Error('image_too_small');
  if (ct && !/^image\//i.test(ct) && !/octet-stream/i.test(ct)) {
    // still allow if bytes look like jpeg/png
    const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
    const isPng = buf[0] === 0x89 && buf[1] === 0x50;
    if (!isJpeg && !isPng) throw new Error(`not_an_image:${ct}`);
  }
  return buf;
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

/**
 * Convert ephemeral (NocoDB signed) image URLs into permanent public URLs.
 * Best-effort: keeps original URL if download/persist fails (caller may still fail QC).
 */
export async function ensurePublicImageUrls(urls = [], { sku = 'img' } = {}) {
  const list = [...new Set(
    (Array.isArray(urls) ? urls : [])
      .map((u) => String(u || '').trim())
      .filter((u) => /^https?:\/\//i.test(u)),
  )].slice(0, 8);

  if (!list.length) return [];

  const out = [];
  for (let i = 0; i < list.length; i++) {
    const url = list[i];
    if (isAlreadyPublic(url) && !isSignedOrEphemeral(url)) {
      out.push(url);
      continue;
    }
    try {
      const buf = await downloadImage(url);
      const localUrl = await persistPublicImage(buf, { sku, index: i + 1 });
      const mirrored = await mirrorToPublicHost(buf, {
        sku,
        index: i + 1,
        fileName: path.basename(new URL(localUrl).pathname),
      });
      out.push(mirrored || localUrl);
    } catch (e) {
      console.warn(`[jumia-images] failed to materialize ${url.slice(0, 80)}…`, e.message);
      // Do not pass signed URLs to Jumia — they cause Not Live.
    }
  }
  return out;
}

/**
 * Express routes: static files + authenticated upload (for bot → imden mirror).
 */
export function registerPublicImageRoutes(app) {
  ensureCacheDir().catch(() => {});

  app.use(
    '/public-images',
    express.static(CACHE_DIR, {
      maxAge: '365d',
      fallthrough: false,
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
      let url;
      if (req.body?.fileName && /^[a-zA-Z0-9._-]+\.jpe?g$/i.test(req.body.fileName)) {
        await ensureCacheDir();
        const filePath = path.join(CACHE_DIR, req.body.fileName);
        await fs.writeFile(filePath, buffer);
        url = `${publicImageBaseUrl()}/${req.body.fileName}`;
      } else {
        url = await persistPublicImage(buffer, { sku, index });
      }
      return res.json({ ok: true, url });
    } catch (e) {
      console.error('[jumia-images] upload failed:', e.message);
      return res.status(500).json({ ok: false, error: e.message || 'upload_failed' });
    }
  });
}
