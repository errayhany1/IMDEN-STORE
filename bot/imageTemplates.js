/**
 * Catalog BACKGROUND templates for website product images.
 *
 * Flow:
 * 1) AI cleans the product onto a plain white plate
 * 2) We composite it onto the chosen background (1080×1080)
 * 3) Sale backgrounds also get a fixed discount overlay
 *
 * Templates may be SVG-drawn or JPEG files in bot/backgrounds/.
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
 * @property {string} [file] filename inside bot/backgrounds/
 * @property {() => string} [svg]
 */

function calcDiscountPercent(oldPrice, price) {
  const o = Number(oldPrice);
  const p = Number(price);
  if (!Number.isFinite(o) || !Number.isFinite(p) || o <= p || o <= 0) return 0;
  return Math.round(((o - p) / o) * 100);
}

function hexCluster(cx, cy, scale = 1, fill = '#94A3B8', opacity = 0.18) {
  const s = 28 * scale;
  const pts = (x, y, r) => {
    const a = [];
    for (let i = 0; i < 6; i++) {
      const ang = (Math.PI / 180) * (60 * i - 30);
      a.push(`${x + r * Math.cos(ang)},${y + r * Math.sin(ang)}`);
    }
    return a.join(' ');
  };
  const cells = [
    [0, 0], [1.7, 0], [-1.7, 0], [0.85, 1.5], [-0.85, 1.5], [0.85, -1.5], [-0.85, -1.5],
    [2.55, 1.5], [-2.55, 1.5], [2.55, -1.5], [-2.55, -1.5],
  ];
  return cells.map(([dx, dy], i) => {
    const x = cx + dx * s;
    const y = cy + dy * s;
    const r = s * (i % 3 === 0 ? 0.72 : 0.55);
    const op = opacity * (i % 2 === 0 ? 1 : 0.55);
    if (i % 4 === 0) {
      return `<polygon points="${pts(x, y, r)}" fill="none" stroke="${fill}" stroke-width="2" opacity="${op}"/>`;
    }
    return `<polygon points="${pts(x, y, r)}" fill="${fill}" opacity="${op}"/>`;
  }).join('');
}

function techFrame({
  bg0 = '#FFFFFF',
  bg1 = '#EEF2F6',
  accent = '#3B82F6',
  accentSoft = '#93C5FD',
  ink = '#94A3B8',
  mirror = false,
} = {}) {
  const tl = mirror ? 1080 : 0;
  const br = mirror ? 0 : 1080;
  const sx = mirror ? -1 : 1;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bg1}"/>
      <stop offset="45%" stop-color="${bg0}"/>
      <stop offset="100%" stop-color="${bg1}"/>
    </linearGradient>
    <radialGradient id="spot" cx="50%" cy="48%" r="42%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="1"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1080" height="1080" fill="url(#bg)"/>
  <rect width="1080" height="1080" fill="url(#spot)"/>

  <!-- top-left tech corner -->
  <g transform="translate(${tl},0) scale(${sx},1)">
    ${hexCluster(110, 120, 1.15, ink, 0.22)}
    <path d="M0 260 L260 0" stroke="${accent}" stroke-width="10" opacity="0.85"/>
    <path d="M0 310 L310 0" stroke="#FFFFFF" stroke-width="18" opacity="0.55"/>
    <path d="M0 360 L360 0" stroke="${accentSoft}" stroke-width="4" opacity="0.7"/>
    <path d="M40 420 L420 40" stroke="#FFFFFF" stroke-width="8" opacity="0.35"/>
  </g>

  <!-- bottom-right tech corner -->
  <g transform="translate(${br},1080) scale(${-sx},-1)">
    ${hexCluster(130, 140, 1.25, ink, 0.2)}
    <path d="M0 280 L280 0" stroke="${accent}" stroke-width="10" opacity="0.8"/>
    <path d="M0 330 L330 0" stroke="#FFFFFF" stroke-width="16" opacity="0.5"/>
    <path d="M0 380 L380 0" stroke="${accentSoft}" stroke-width="4" opacity="0.65"/>
  </g>

  <!-- soft halftone dots -->
  ${Array.from({ length: 10 }, (_, row) => Array.from({ length: 10 }, (_, col) => {
    const x = 820 + col * 22;
    const y = 80 + row * 22;
    const o = Math.max(0.02, 0.16 - (row + col) * 0.01);
    return `<circle cx="${x}" cy="${y}" r="3.2" fill="${ink}" opacity="${o}"/>`;
  }).join('')).join('')}
  ${Array.from({ length: 10 }, (_, row) => Array.from({ length: 10 }, (_, col) => {
    const x = 40 + col * 22;
    const y = 820 + row * 22;
    const o = Math.max(0.02, 0.16 - (row + col) * 0.01);
    return `<circle cx="${x}" cy="${y}" r="3.2" fill="${ink}" opacity="${o}"/>`;
  }).join('')).join('')}
</svg>`;
}

/** @type {BackgroundTemplate[]} */
export const REGULAR_TEMPLATES = [
  {
    id: 'bg-tech-hex',
    kind: 'regular',
    nameAr: 'تقني سداسي',
    nameFr: 'Tech hex',
    blurbAr: 'الخلفية الأصلية المستوحاة — وسط أبيض وزوايا هندسية',
    file: 'bg-tech-hex.jpg',
  },
  {
    id: 'bg-tech-blue',
    kind: 'regular',
    nameAr: 'تقني أزرق',
    nameFr: 'Tech bleu',
    blurbAr: 'نفس الأسلوب بلمسة زرقاء أوضح',
    svg: () => techFrame({
      bg0: '#FFFFFF',
      bg1: '#E8F1FB',
      accent: '#2563EB',
      accentSoft: '#93C5FD',
      ink: '#64748B',
    }),
  },
  {
    id: 'bg-tech-soft',
    kind: 'regular',
    nameAr: 'تقني ناعم',
    nameFr: 'Tech doux',
    blurbAr: 'هندسة أخف ووسط أكثر إشراقاً',
    svg: () => techFrame({
      bg0: '#FFFFFF',
      bg1: '#F4F6F8',
      accent: '#60A5FA',
      accentSoft: '#BFDBFE',
      ink: '#CBD5E1',
    }),
  },
  {
    id: 'bg-tech-slate',
    kind: 'regular',
    nameAr: 'تقني رمادي',
    nameFr: 'Tech ardoise',
    blurbAr: 'رمادي احترافي مع خطوط دقيقة',
    svg: () => techFrame({
      bg0: '#FAFBFC',
      bg1: '#E5EAF0',
      accent: '#475569',
      accentSoft: '#94A3B8',
      ink: '#94A3B8',
    }),
  },
  {
    id: 'bg-tech-mirror',
    kind: 'regular',
    nameAr: 'تقني معكوس',
    nameFr: 'Tech miroir',
    blurbAr: 'نفس التكوين معكوس الزوايا',
    svg: () => techFrame({
      bg0: '#FFFFFF',
      bg1: '#EEF3F8',
      accent: '#3B82F6',
      accentSoft: '#93C5FD',
      ink: '#94A3B8',
      mirror: true,
    }),
  },
  {
    id: 'bg-tech-cyan',
    kind: 'regular',
    nameAr: 'تقني سماوي',
    nameFr: 'Tech cyan',
    blurbAr: 'درجات سماوية خفيفة للإكسسوارات',
    svg: () => techFrame({
      bg0: '#FFFFFF',
      bg1: '#E6F7F8',
      accent: '#0891B2',
      accentSoft: '#67E8F9',
      ink: '#94A3B8',
    }),
  },
];

/** @type {BackgroundTemplate[]} */
export const SALE_TEMPLATES = [
  {
    id: 'sale-tech-hex',
    kind: 'sale',
    nameAr: 'تخفيض تقني',
    nameFr: 'Promo tech',
    blurbAr: 'الخلفية التقنية + شارة تخفيض',
    file: 'bg-tech-hex.jpg',
  },
  {
    id: 'sale-tech-blue',
    kind: 'sale',
    nameAr: 'تخفيض أزرق',
    nameFr: 'Promo bleu',
    blurbAr: 'تقني أزرق + شارة تخفيض',
    svg: () => techFrame({
      bg0: '#FFFFFF',
      bg1: '#E8F1FB',
      accent: '#2563EB',
      accentSoft: '#93C5FD',
      ink: '#64748B',
    }),
  },
  {
    id: 'sale-tech-soft',
    kind: 'sale',
    nameAr: 'تخفيض ناعم',
    nameFr: 'Promo douce',
    blurbAr: 'تقني ناعم + شارة تخفيض',
    svg: () => techFrame({
      bg0: '#FFFFFF',
      bg1: '#F4F6F8',
      accent: '#60A5FA',
      accentSoft: '#BFDBFE',
      ink: '#CBD5E1',
    }),
  },
  {
    id: 'sale-tech-cyan',
    kind: 'sale',
    nameAr: 'تخفيض سماوي',
    nameFr: 'Promo cyan',
    blurbAr: 'سماوي + شارة تخفيض',
    svg: () => techFrame({
      bg0: '#FFFFFF',
      bg1: '#E6F7F8',
      accent: '#0891B2',
      accentSoft: '#67E8F9',
      ink: '#94A3B8',
    }),
  },
];

export const ALL_TEMPLATES = [...REGULAR_TEMPLATES, ...SALE_TEMPLATES];

function defaultSelection() {
  return {
    regular: ['bg-tech-hex', 'bg-tech-blue'],
    sale: ['sale-tech-hex', 'sale-tech-blue'],
    updatedAt: null,
  };
}

export function loadTemplateSelection() {
  try {
    if (fs.existsSync(SELECTION_PATH)) {
      const raw = JSON.parse(fs.readFileSync(SELECTION_PATH, 'utf8'));
      const known = new Set(ALL_TEMPLATES.map((t) => t.id));
      const regular = (raw.regular || []).filter((id) => known.has(id));
      const sale = (raw.sale || []).filter((id) => known.has(id));
      return {
        regular: regular.length ? regular : defaultSelection().regular,
        sale: sale.length ? sale : defaultSelection().sale,
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

export async function renderBackground(template, size = CATALOG_IMAGE_SIZE) {
  if (template.file) {
    const filePath = path.join(BACKGROUNDS_DIR, template.file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing background file: ${template.file}`);
    }
    return sharp(filePath)
      .resize(size, size, { fit: 'cover' })
      .jpeg({ quality: 92 })
      .toBuffer();
  }

  if (!template.svg) {
    throw new Error(`Template ${template.id} has no svg/file`);
  }

  const svg = template.svg();
  const withView = svg.includes('viewBox')
    ? svg
    : svg.replace('<svg ', '<svg viewBox="0 0 1080 1080" ');
  return sharp(Buffer.from(withView))
    .resize(size, size, { fit: 'cover' })
    .jpeg({ quality: 92 })
    .toBuffer();
}

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
  <rect x="300" y="300" width="480" height="400" rx="28" fill="#ffffff" opacity="0.88" stroke="#94a3b8" stroke-width="2"/>
  <text x="540" y="520" text-anchor="middle" font-family="Arial, sans-serif" font-size="42" font-weight="700" fill="#334155">PRODUCT</text>
  <text x="540" y="90" text-anchor="middle" font-family="Arial, sans-serif" font-size="38" font-weight="700" fill="${isSale ? '#C53030' : '#0F172A'}">${escapeXml(template.nameAr)}</text>
  <text x="540" y="135" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#64748b">${escapeXml(template.blurbAr)}</text>
  ${isSale ? `
  <circle cx="900" cy="200" r="88" fill="#E53E3E"/>
  <text x="900" y="212" text-anchor="middle" font-family="Arial, sans-serif" font-size="40" font-weight="700" fill="#fff">-${pct}%</text>
  <text x="540" y="860" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" fill="#94a3b8" text-decoration="line-through">${sampleOldPrice} DH</text>
  <text x="540" y="920" text-anchor="middle" font-family="Arial, sans-serif" font-size="46" font-weight="700" fill="#E53E3E">${samplePrice} DH</text>
  ` : `
  <text x="540" y="930" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" fill="#64748b">خلفية الموقع · ${escapeXml(template.id)}</text>
  `}
</svg>`);

  return sharp(bg)
    .composite([{ input: await sharp(productPlate).png().toBuffer(), top: 0, left: 0 }])
    .jpeg({ quality: 90 })
    .toBuffer();
}

export async function compositeProductOnBackground(productBuffer, template, sale = {}) {
  const size = CATALOG_IMAGE_SIZE;
  const bg = await renderBackground(template, size);

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
  const top = Math.round((size - (meta.height || maxSide)) / 2) - Math.round(size * 0.02);

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

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
