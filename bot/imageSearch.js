/**
 * Lightweight, local visual search. Query files stay in multer memory only;
 * neither uploads nor fingerprints are stored. Product fingerprints are built
 * from NocoDB's published hero images and cached server-side.
 */
import axios from 'axios';
import multer from 'multer';
import sharp from 'sharp';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, done) => done(null, /^image\/(jpeg|png|webp)$/i.test(file.mimetype)),
});
const SIZE = 20;
const MAX_PER_MINUTE = Math.max(1, Math.min(30, Number(process.env.IMAGE_SEARCH_MAX_PER_MINUTE || 8)));
const INDEX_TTL_MS = 12 * 60 * 60 * 1000;
let index = [];
let indexedAt = 0;
const rateLimits = new Map();

function nocoConfig() {
  return {
    url: String(process.env.NOCODB_URL || process.env.VITE_NOCODB_URL || '').replace(/\/+$/, ''),
    token: String(process.env.NOCODB_API_TOKEN || process.env.VITE_NOCODB_API_TOKEN || '').trim(),
    table: String(process.env.NOCODB_TABLE_PRODUCTS || process.env.VITE_NOCODB_TABLE_PRODUCTS || '').trim(),
  };
}

function attachmentUrl(row) {
  const first = row.Image1?.[0] || row.Image1 || row.image?.[0] || row.image;
  return first?.signedUrl || first?.url || first || '';
}

async function fingerprint(buffer) {
  const { data, info } = await sharp(buffer, { failOn: 'none' })
    .resize(SIZE, SIZE, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels !== 3) throw new Error('unsupported_image_channels');
  // Normalize to make results less sensitive to brightness/exposure.
  const values = Float32Array.from(data, (value) => value / 255);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  let norm = 0;
  for (let i = 0; i < values.length; i += 1) {
    values[i] -= mean;
    norm += values[i] ** 2;
  }
  norm = Math.sqrt(norm) || 1;
  return Array.from(values, (value) => value / norm);
}

function similarity(a, b) {
  let score = 0;
  for (let i = 0; i < a.length; i += 1) score += a[i] * b[i];
  return score;
}

async function buildIndex() {
  const config = nocoConfig();
  if (!config.url || !config.token || !config.table) throw new Error('image_search_nocodb_not_configured');
  const { data } = await axios.get(`${config.url}/api/v2/tables/${config.table}/records`, {
    headers: { 'xc-token': config.token },
    params: { where: '(POSTEBL,eq,POSTEBL)', limit: 500, sort: '-CreatedAt' },
    timeout: 30000,
  });
  const rows = data?.list || [];
  const next = [];
  // Bound parallel downloads: product attachment URLs are remote and can expire.
  for (const row of rows) {
    const sku = String(row.SKU || row.Ref || row.Id || row.id || '').trim();
    const url = attachmentUrl(row);
    if (!sku || !url) continue;
    try {
      const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
      next.push({ sku, vector: await fingerprint(Buffer.from(response.data)) });
    } catch {
      // A single expired/corrupt catalogue image must not make search unavailable.
    }
  }
  index = next;
  indexedAt = Date.now();
  return index.length;
}

async function currentIndex() {
  if (index.length && Date.now() - indexedAt < INDEX_TTL_MS) return index;
  await buildIndex();
  return index;
}

function allowed(req) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const hits = (rateLimits.get(ip) || []).filter((time) => now - time < 60_000);
  if (hits.length >= MAX_PER_MINUTE) return false;
  hits.push(now);
  rateLimits.set(ip, hits);
  return true;
}

export function registerImageSearchRoutes(app) {
  app.post('/api/search/by-image', upload.single('image'), async (req, res) => {
    if (!allowed(req)) return res.status(429).json({ ok: false, error: 'too_many_image_searches' });
    if (!req.file?.buffer) return res.status(400).json({ ok: false, error: 'image_required' });
    try {
      const query = await fingerprint(req.file.buffer);
      // `req.file.buffer` is intentionally not persisted; release it before responding.
      req.file.buffer = null;
      const matches = (await currentIndex())
        .map((entry) => ({ sku: entry.sku, score: similarity(query, entry.vector) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 24);
      return res.json({ ok: true, matches, indexedProducts: index.length });
    } catch (error) {
      req.file.buffer = null;
      return res.status(422).json({
        ok: false,
        error: error?.message || 'image_search_failed',
      });
    }
  });
}
