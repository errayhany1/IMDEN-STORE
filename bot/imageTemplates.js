/**
 * Catalog BACKGROUND templates for website product images.
 *
 * Flow:
 * 1) AI cleans the product onto a plain cutout / white plate
 * 2) We composite that product onto the chosen background (1080×1080)
 * 3) Sale backgrounds also get a fixed discount overlay (price / %)
 *
 * Active selection lives in template-selection.json.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { CATALOG_IMAGE_SIZE } from './imageNormalize.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SELECTION_PATH = path.join(__dirname, 'template-selection.json');
const BACKGROUNDS_DIR = path.join(__dirname, 'backgrounds');

/** @typedef {'regular'|'sale'} TemplateKind */

/**
 * @typedef {object} BackgroundTemplate
 * @property {string} id
 * @property {TemplateKind} kind
 * @property {string} nameAr
 * @property {string} nameFr
 * @property {string} blurbAr
 * @property {() => string} svg  full-frame background SVG
 */

function calcDiscountPercent(oldPrice, price) {
  const o = Number(oldPrice);
  const p = Number(price);
  if (!Number.isFinite(o) || !Number.isFinite(p) || o <= p || o <= 0) return 0;
  return Math.round(((o - p) / o) * 100);
}

/** @type {BackgroundTemplate[]} */
export const REGULAR_TEMPLATES = [
  {
    id: 'bg-pure-white',
    kind: 'regular',
    nameAr: 'أبيض ناصع',
    nameFr: 'Blanc pur',
    blurbAr: 'خلفية بيضاء سادة للكتالوج',
    svg: () => `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
  <rect width="1080" height="1080" fill="#FFFFFF"/>
  <ellipse cx="540" cy="860" rx="280" ry="36" fill="#000000" opacity="0.06"/>
</svg>`,
  },
  {
    id: 'bg-soft-gray',
    kind: 'regular',
    nameAr: 'رمادي استوديو',
    nameFr: 'Gris studio',
    blurbAr: 'رمادي فاتح احترافي مع ظل خفيف',
    svg: () => `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#F3F5F8"/>
      <stop offset="100%" stop-color="#E4E9EF"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1080" fill="url(#g)"/>
  <ellipse cx="540" cy="870" rx="300" ry="40" fill="#0F172A" opacity="0.07"/>
</svg>`,
  },
  {
    id: 'bg-warm-cream',
    kind: 'regular',
    nameAr: 'كريمي دافئ',
    nameFr: 'Crème chaude',
    blurbAr: 'خلفية كريمية هادئة تُبرز الألوان',
    svg: () => `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="g" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#FFFDF8"/>
      <stop offset="100%" stop-color="#F0E6D8"/>
    </radialGradient>
  </defs>
  <rect width="1080" height="1080" fill="url(#g)"/>
  <ellipse cx="540" cy="880" rx="290" ry="38" fill="#8B7355" opacity="0.10"/>
</svg>`,
  },
  {
    id: 'bg-cool-blue',
    kind: 'regular',
    nameAr: 'أزرق هادئ',
    nameFr: 'Bleu doux',
    blurbAr: 'تدرج أزرق خفيف بهوية المتجر',
    svg: () => `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#F4F8FC"/>
      <stop offset="55%" stop-color="#E7F0F8"/>
      <stop offset="100%" stop-color="#D5E6F4"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1080" fill="url(#g)"/>
  <circle cx="900" cy="160" r="180" fill="#197fe6" opacity="0.06"/>
  <circle cx="160" cy="920" r="220" fill="#197fe6" opacity="0.05"/>
  <ellipse cx="540" cy="870" rx="300" ry="40" fill="#0F172A" opacity="0.06"/>
</svg>`,
  },
  {
    id: 'bg-desk-wood',
    kind: 'regular',
    nameAr: 'سطح خشبي',
    nameFr: 'Plateau bois',
    blurbAr: 'سطح مكتب خشبي فاتح نظيف',
    svg: () => `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#E8EEF2"/>
      <stop offset="100%" stop-color="#D9E1E8"/>
    </linearGradient>
    <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#D7B48A"/>
      <stop offset="100%" stop-color="#C49A6C"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="720" fill="url(#wall)"/>
  <rect y="720" width="1080" height="360" fill="url(#wood)"/>
  <rect y="720" width="1080" height="8" fill="#A67C52" opacity="0.45"/>
  ${Array.from({ length: 12 }, (_, i) => {
    const y = 740 + i * 28;
    return `<path d="M0 ${y} Q 270 ${y + 6}, 540 ${y} T 1080 ${y}" fill="none" stroke="#A67C52" stroke-width="1.2" opacity="0.18"/>`;
  }).join('')}
</svg>`,
  },
  {
    id: 'bg-dark-slate',
    kind: 'regular',
    nameAr: 'داكن أنيق',
    nameFr: 'Ardoise sombre',
    blurbAr: 'خلفية داكنة فاخرة للإكسسوارات',
    svg: () => `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="g" cx="50%" cy="45%" r="70%">
      <stop offset="0%" stop-color="#2A3544"/>
      <stop offset="100%" stop-color="#111821"/>
    </radialGradient>
  </defs>
  <rect width="1080" height="1080" fill="url(#g)"/>
  <ellipse cx="540" cy="860" rx="260" ry="34" fill="#000000" opacity="0.35"/>
</svg>`,
  },
];

/** Sale backgrounds = same family + reserved corner for the discount badge. */
/** @type {BackgroundTemplate[]} */
export const SALE_TEMPLATES = [
  {
    id: 'sale-bg-white',
    kind: 'sale',
    nameAr: 'تخفيض على أبيض',
    nameFr: 'Promo fond blanc',
    blurbAr: 'خلفية بيضاء + شارة تخفيض',
    svg: () => REGULAR_TEMPLATES.find((t) => t.id === 'bg-pure-white').svg(),
  },
  {
    id: 'sale-bg-gray',
    kind: 'sale',
    nameAr: 'تخفيض على رمادي',
    nameFr: 'Promo fond gris',
    blurbAr: 'رمادي استوديو + شارة تخفيض',
    svg: () => REGULAR_TEMPLATES.find((t) => t.id === 'bg-soft-gray').svg(),
  },
  {
    id: 'sale-bg-blue',
    kind: 'sale',
    nameAr: 'تخفيض على أزرق',
    nameFr: 'Promo fond bleu',
    blurbAr: 'تدرج أزرق + شارة تخفيض',
    svg: () => REGULAR_TEMPLATES.find((t) => t.id === 'bg-cool-blue').svg(),
  },
  {
    id: 'sale-bg-warm',
    kind: 'sale',
    nameAr: 'تخفيض على كريمي',
    nameFr: 'Promo fond crème',
    blurbAr: 'كريمي دافئ + شارة تخفيض',
    svg: () => REGULAR_TEMPLATES.find((t) => t.id === 'bg-warm-cream').svg(),
  },
];

export const ALL_TEMPLATES = [...REGULAR_TEMPLATES, ...SALE_TEMPLATES];

function defaultSelection() {
  return {
    regular: ['bg-pure-white', 'bg-soft-gray'],
    sale: ['sale-bg-white', 'sale-bg-blue'],
    updatedAt: null,
  };
}

export function loadTemplateSelection() {
  try {
    if (fs.existsSync(SELECTION_PATH)) {
      const raw = JSON.parse(fs.readFileSync(SELECTION_PATH, 'utf8'));
      return {
        regular: Array.isArray(raw.regular) ? raw.regular : defaultSelection().regular,
        sale: Array.isArray(raw.sale) ? raw.sale : defaultSelection().sale,
        updatedAt: raw.updatedAt || null,
      };
    }
  } catch (e) {
    console.warn('template selection load failed:', e.message);
  }
  return defaultSelection();
}

export function saveTemplateSelection(next) {
  const current = loadTemplateSelection();
  const payload = {
    regular: next.regular || current.regular,
    sale: next.sale || current.sale,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(SELECTION_PATH, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

export function toggleTemplateInSelection(kind, templateId) {
  const sel = loadTemplateSelection();
  const list = new Set(sel[kind] || []);
  if (list.has(templateId)) {
    if (list.size <= 1) {
      return { ok: false, reason: 'keep_one', selection: sel };
    }
    list.delete(templateId);
  } else {
    list.add(templateId);
  }
  const updated = saveTemplateSelection({
    ...sel,
    [kind]: [...list],
  });
  return { ok: true, selection: updated };
}

export function getTemplateById(id) {
  return ALL_TEMPLATES.find((t) => t.id === id) || null;
}

export function getActiveTemplatesForProduct({ oldPrice } = {}) {
  const sel = loadTemplateSelection();
  const isSale = Number(oldPrice) > 0;
  const ids = isSale ? sel.sale : sel.regular;
  const pool = isSale ? SALE_TEMPLATES : REGULAR_TEMPLATES;
  const picked = ids
    .map((id) => pool.find((t) => t.id === id))
    .filter(Boolean);
  return picked.length ? picked : pool.slice(0, 2);
}

/** Render the bare background JPEG (what the user picks in Telegram). */
export async function renderBackground(template, size = CATALOG_IMAGE_SIZE) {
  const svg = template.svg().replace(/width="1080"/, `width="${size}"`).replace(/height="1080"/, `height="${size}"`);
  // Keep viewBox for scaling when size != 1080
  const withView = svg.includes('viewBox')
    ? svg
    : svg.replace('<svg ', '<svg viewBox="0 0 1080 1080" ');
  return sharp(Buffer.from(withView)).jpeg({ quality: 92 }).toBuffer();
}

/**
 * Preview card sent in Telegram: real background + sample product plate + optional sale badge.
 */
export async function renderTemplatePreview(template, {
  size = CATALOG_IMAGE_SIZE,
  samplePrice = 149,
  sampleOldPrice = 229,
} = {}) {
  const bg = await renderBackground(template, size);
  const isSale = template.kind === 'sale';
  const pct = calcDiscountPercent(sampleOldPrice, samplePrice) || 35;

  const productPlate = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
  <rect x="290" y="280" width="500" height="420" rx="28" fill="#ffffff" opacity="0.92" stroke="#94a3b8" stroke-width="2"/>
  <text x="540" y="500" text-anchor="middle" font-family="Arial, sans-serif" font-size="44" font-weight="700" fill="#334155">PRODUCT</text>
  <text x="540" y="100" text-anchor="middle" font-family="Arial, sans-serif" font-size="40" font-weight="700" fill="${isSale ? '#C53030' : '#0F172A'}">${escapeXml(template.nameAr)}</text>
  <text x="540" y="145" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" fill="#64748b">${escapeXml(template.blurbAr)}</text>
  ${isSale ? `
  <circle cx="900" cy="220" r="88" fill="#E53E3E"/>
  <text x="900" y="232" text-anchor="middle" font-family="Arial, sans-serif" font-size="40" font-weight="700" fill="#fff">-${pct}%</text>
  <text x="540" y="860" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" fill="#94a3b8" text-decoration="line-through">${sampleOldPrice} DH</text>
  <text x="540" y="920" text-anchor="middle" font-family="Arial, sans-serif" font-size="48" font-weight="700" fill="#E53E3E">${samplePrice} DH</text>
  ` : `
  <text x="540" y="920" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="#64748b">خلفية الموقع · ${escapeXml(template.id)}</text>
  `}
</svg>`);

  return sharp(bg)
    .composite([{ input: await sharp(productPlate).png().toBuffer(), top: 0, left: 0 }])
    .jpeg({ quality: 90 })
    .toBuffer();
}

/**
 * Place a cleaned product photo onto a background template.
 * @param {Buffer} productBuffer AI/studio product shot (any size)
 * @param {BackgroundTemplate} template
 * @param {{ price?: number|string, oldPrice?: number|string }} [sale]
 */
export async function compositeProductOnBackground(productBuffer, template, sale = {}) {
  const size = CATALOG_IMAGE_SIZE;
  const bg = await renderBackground(template, size);

  // Fit product inside a centered safe area (~72% of canvas).
  const maxSide = Math.round(size * 0.72);
  const product = await sharp(productBuffer)
    .rotate()
    .resize(maxSide, maxSide, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  const meta = await sharp(product).metadata();
  const left = Math.round((size - (meta.width || maxSide)) / 2);
  const top = Math.round((size - (meta.height || maxSide)) / 2) - Math.round(size * 0.03);

  const layers = [{ input: product, left, top }];

  if (template.kind === 'sale') {
    const pct = calcDiscountPercent(sale.oldPrice, sale.price);
    const badge = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
  <circle cx="900" cy="180" r="92" fill="#E53E3E"/>
  <text x="900" y="192" text-anchor="middle" font-family="Arial, sans-serif" font-size="42" font-weight="700" fill="#ffffff">${pct ? `-${pct}%` : 'PROMO'}</text>
  ${sale.oldPrice && sale.price ? `
  <rect x="300" y="930" width="480" height="88" rx="18" fill="#ffffff" opacity="0.92"/>
  <text x="420" y="986" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="#94a3b8" text-decoration="line-through">${sale.oldPrice} DH</text>
  <text x="660" y="988" text-anchor="middle" font-family="Arial, sans-serif" font-size="36" font-weight="700" fill="#E53E3E">${sale.price} DH</text>
  ` : ''}
</svg>`);
    layers.push({ input: await sharp(badge).png().toBuffer(), top: 0, left: 0 });
  }

  return sharp(bg)
    .composite(layers)
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
}

/** Ensure on-disk JPEG backgrounds exist (optional cache for debugging). */
export async function ensureBackgroundFiles() {
  fs.mkdirSync(BACKGROUNDS_DIR, { recursive: true });
  for (const tpl of ALL_TEMPLATES) {
    const file = path.join(BACKGROUNDS_DIR, `${tpl.id}.jpg`);
    if (fs.existsSync(file)) continue;
    const buf = await renderBackground(tpl);
    fs.writeFileSync(file, buf);
  }
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
