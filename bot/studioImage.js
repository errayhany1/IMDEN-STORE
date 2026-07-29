/**
 * White-studio product finishing + professional specs cards for the catalog.
 *
 * Hero images: product fills the frame on pure white, with a soft drop/contact shadow.
 * Specs cards: bilingual-ready SVG rendered to a fixed 1080×1080 JPEG for the description.
 */
import sharp from 'sharp';
import { CATALOG_IMAGE_SIZE } from './imageNormalize.js';

function calcDiscountPercent(oldPrice, price) {
  const o = Number(oldPrice);
  const p = Number(price);
  if (!Number.isFinite(o) || !Number.isFinite(p) || o <= p || o <= 0) return 0;
  return Math.round(((o - p) / o) * 100);
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapLines(text, maxChars = 42, maxLines = 3) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
      if (lines.length >= maxLines) break;
    } else {
      current = next;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (words.join(' ').length > lines.join(' ').length) {
    const last = lines[lines.length - 1] || '';
    lines[lines.length - 1] = `${last.replace(/\s+\S*$/, '')}…`;
  }
  return lines;
}

/**
 * Remove only near-white pixels connected to the canvas edges. This preserves
 * white areas inside the product while eliminating the opaque white rectangle
 * that previously caused Sharp to cast a shadow around the whole image.
 */
async function removeEdgeConnectedWhite(productBuffer) {
  const raw = await sharp(productBuffer)
    .rotate()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = raw.info;
  if (channels !== 4 || width < 256 || height < 256) {
    throw new Error('studio_invalid_dimensions');
  }

  const pixels = Buffer.from(raw.data);
  const total = width * height;
  let transparentPixels = 0;
  for (let i = 0; i < total; i += 1) {
    if (pixels[(i * 4) + 3] < 24) transparentPixels += 1;
  }
  // Local U²-Net already returns a transparent foreground. Preserve that
  // alpha instead of trying to find a white background around it.
  if (transparentPixels / total >= 0.03) {
    return sharp(pixels, {
      raw: { width, height, channels: 4 },
    }).png().toBuffer();
  }

  const background = new Uint8Array(total);
  const queue = new Int32Array(total);
  let read = 0;
  let write = 0;

  const isWhiteBackground = (pixelIndex) => {
    const p = pixelIndex * 4;
    const r = pixels[p];
    const g = pixels[p + 1];
    const b = pixels[p + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    return min >= 232 && max - min <= 24;
  };
  const enqueue = (pixelIndex) => {
    if (background[pixelIndex] || !isWhiteBackground(pixelIndex)) return;
    background[pixelIndex] = 1;
    queue[write++] = pixelIndex;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (read < write) {
    const i = queue[read++];
    const x = i % width;
    if (x > 0) enqueue(i - 1);
    if (x + 1 < width) enqueue(i + 1);
    if (i >= width) enqueue(i - width);
    if (i + width < total) enqueue(i + width);
  }

  const backgroundRatio = write / total;
  if (backgroundRatio < 0.08) {
    throw new Error('studio_background_not_clean');
  }

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let i = 0; i < total; i += 1) {
    const p = i * 4;
    if (background[i]) {
      pixels[p + 3] = 0;
      continue;
    }
    if (pixels[p + 3] > 20) {
      const x = i % width;
      const y = Math.floor(i / width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) throw new Error('studio_product_missing');

  // Reject a remaining rectangular plate/frame instead of publishing it.
  const boxWidthRatio = (maxX - minX + 1) / width;
  const boxHeightRatio = (maxY - minY + 1) / height;
  if (boxWidthRatio > 0.97 && boxHeightRatio > 0.97) {
    throw new Error('studio_rectangular_frame_detected');
  }

  return sharp(pixels, {
    raw: { width, height, channels: 4 },
  }).png().toBuffer();
}

/**
 * Finish an AI (or seller) product photo as a white-studio catalog image:
 * trim empty margins → enlarge to fill the square → soft drop shadow only.
 * No separate oval "floor" shadow (that looked like a floating grey blob on cards).
 *
 * @param {Buffer} productBuffer
 * @param {{ price?: number|string, oldPrice?: number|string, saleBadge?: boolean }} [opts]
 * @returns {Promise<Buffer>}
 */
export async function composeWhiteStudioProduct(productBuffer, opts = {}) {
  const size = CATALOG_IMAGE_SIZE;
  const fill = Number(process.env.STUDIO_PRODUCT_FILL || 0.91);

  let cut = await removeEdgeConnectedWhite(productBuffer);
  try {
    cut = await sharp(cut)
      .trim({ threshold: 22 })
      .ensureAlpha()
      .png()
      .toBuffer();
  } catch (error) {
    throw new Error(`studio_trim_failed:${error.message}`);
  }

  const maxSide = Math.round(size * fill);
  const product = await sharp(cut)
    .resize(maxSide, maxSide, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .ensureAlpha()
    .png()
    .toBuffer();

  const meta = await sharp(product).metadata();
  const pw = meta.width || maxSide;
  const ph = meta.height || maxSide;
  const left = Math.round((size - pw) / 2);
  const top = Math.round((size - ph) / 2);

  // Very light shadow that follows only the isolated product silhouette.
  const raw = await sharp(product)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixels = Buffer.from(raw.data);
  for (let i = 0; i < pixels.length; i += 4) {
    const a = pixels[i + 3];
    pixels[i] = 0;
    pixels[i + 1] = 0;
    pixels[i + 2] = 0;
    pixels[i + 3] = Math.round(a * 0.14);
  }
  const shadowCore = await sharp(pixels, {
    raw: { width: raw.info.width, height: raw.info.height, channels: 4 },
  })
    .blur(10)
    .png()
    .toBuffer();

  const white = await sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  }).png().toBuffer();

  const layers = [
    {
      input: shadowCore,
      left: left + 1,
      top: top + 5,
    },
    { input: product, left, top },
  ];

  const wantSale = opts.saleBadge !== false
    && Number(opts.oldPrice) > 0
    && Number(opts.price) > 0
    && Number(opts.oldPrice) > Number(opts.price);
  if (wantSale) {
    const pct = calcDiscountPercent(opts.oldPrice, opts.price);
    const badge = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
  <circle cx="920" cy="160" r="88" fill="#E53E3E"/>
  <text x="920" y="172" text-anchor="middle" font-family="Arial, sans-serif" font-size="40" font-weight="700" fill="#fff">${pct ? `-${pct}%` : 'PROMO'}</text>
</svg>`);
    layers.push({ input: await sharp(badge).png().toBuffer(), top: 0, left: 0 });
  }

  return sharp(white)
    .composite(layers)
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}

/**
 * Professional specifications card (square) for the product description/gallery.
 *
 * @param {{
 *   title?: string,
 *   bullets?: string[],
 *   brand?: string,
 *   color?: string,
 *   sku?: string,
 *   price?: number|string,
 *   lang?: 'fr'|'ar',
 * }} opts
 * @returns {Promise<Buffer>}
 */
export async function renderSpecsCard(opts = {}) {
  const size = CATALOG_IMAGE_SIZE;
  const isAr = opts.lang === 'ar';
  const title = String(opts.title || '').trim() || (isAr ? 'المواصفات' : 'Spécifications');
  const heading = isAr ? 'المواصفات التقنية' : 'Fiche technique';
  const bullets = (opts.bullets || [])
    .map((b) => String(b || '').replace(/<[^>]*>/g, '').trim())
    .filter(Boolean)
    .slice(0, 6);
  const metaBits = [
    opts.brand && opts.brand !== 'Generic' ? `${isAr ? 'العلامة' : 'Marque'}: ${opts.brand}` : '',
    opts.color ? `${isAr ? 'اللون' : 'Couleur'}: ${opts.color}` : '',
    opts.sku ? `SKU: ${opts.sku}` : '',
    opts.price ? `${opts.price} DH` : '',
  ].filter(Boolean);

  const titleLines = wrapLines(title, isAr ? 28 : 34, 2);
  const bulletBlocks = bullets.map((b, i) => {
    const lines = wrapLines(b, isAr ? 34 : 40, 2);
    const y0 = 320 + i * 95;
    const textAnchor = isAr ? 'end' : 'start';
    const tx = isAr ? 980 : 100;
    const bulletX = isAr ? 1010 : 70;
    const lineText = lines.map((ln, li) => (
      `<text x="${tx}" y="${y0 + li * 28}" text-anchor="${textAnchor}" font-family="Arial, 'Segoe UI', sans-serif" font-size="24" fill="#334155">${escapeXml(ln)}</text>`
    )).join('');
    return `
      <circle cx="${bulletX}" cy="${y0 - 6}" r="6" fill="#0EA5E9"/>
      ${lineText}
    `;
  }).join('');

  const titleSvg = titleLines.map((ln, i) => (
    `<text x="540" y="${168 + i * 36}" text-anchor="middle" font-family="Arial, 'Segoe UI', sans-serif" font-size="30" font-weight="700" fill="#0F172A">${escapeXml(ln)}</text>`
  )).join('');

  const metaY = 920;
  const metaText = metaBits.join(isAr ? '  ·  ' : '  ·  ');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="card" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#F8FAFC"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1080" fill="#FFFFFF"/>
  <rect x="48" y="48" width="984" height="984" rx="28" fill="url(#card)" stroke="#E2E8F0" stroke-width="2"/>
  <rect x="48" y="48" width="984" height="110" rx="28" fill="#0F172A"/>
  <rect x="48" y="120" width="984" height="38" fill="#0F172A"/>
  <text x="540" y="118" text-anchor="middle" font-family="Arial, 'Segoe UI', sans-serif" font-size="34" font-weight="700" fill="#FFFFFF">${escapeXml(heading)}</text>
  ${titleSvg}
  <line x1="120" y1="260" x2="960" y2="260" stroke="#E2E8F0" stroke-width="2"/>
  ${bulletBlocks || `<text x="540" y="480" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" fill="#64748B">${isAr ? 'لا توجد مواصفات مفصّلة' : 'Spécifications détaillées indisponibles'}</text>`}
  <rect x="120" y="${metaY - 36}" width="840" height="70" rx="16" fill="#F1F5F9"/>
  <text x="540" y="${metaY + 8}" text-anchor="middle" font-family="Arial, 'Segoe UI', sans-serif" font-size="22" fill="#475569">${escapeXml(metaText)}</text>
  <text x="540" y="1035" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#94A3B8">Errayhany · Grossiste Maroc</text>
</svg>`;

  return sharp(Buffer.from(svg))
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}

/**
 * Pull plain bullet strings from HTML <li> or newline lists.
 * @param {string} html
 * @param {number} [limit]
 */
export function bulletsFromHtml(html, limit = 6) {
  const raw = String(html || '');
  const fromLi = [...raw.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((m) => m[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (fromLi.length) return fromLi.slice(0, limit);
  return raw
    .replace(/<[^>]*>/g, '\n')
    .split(/[\n•●\-–]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8)
    .slice(0, limit);
}
