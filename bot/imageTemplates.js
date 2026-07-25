/**
 * Catalog image templates for AI generation + sharp preview cards.
 *
 * Regular templates → everyday products
 * Sale templates    → products with an old/new price (discount)
 *
 * Active selection is stored in template-selection.json next to this module.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SELECTION_PATH = path.join(__dirname, 'template-selection.json');

/** @typedef {'regular'|'sale'} TemplateKind */

/**
 * @typedef {object} ImageTemplate
 * @property {string} id
 * @property {TemplateKind} kind
 * @property {string} nameAr
 * @property {string} nameFr
 * @property {string} blurbAr
 * @property {{ bg: string, accent: string, badge: string }} colors
 * @property {(ctx: { title?: string, price?: string|number, oldPrice?: string|number }) => string} prompt
 */

/** @type {ImageTemplate[]} */
export const REGULAR_TEMPLATES = [
  {
    id: 'studio-white',
    kind: 'regular',
    nameAr: 'استوديو أبيض نظيف',
    nameFr: 'Studio blanc',
    blurbAr: 'خلفية بيضاء ناعمة — مثالي للكتالوج',
    colors: { bg: '#F4F6F8', accent: '#197fe6', badge: '#0F172A' },
    prompt: () => `STYLE TEMPLATE "studio-white":
- Pure seamless white / very light gray studio background
- Product perfectly centered, commercial catalog hero
- Soft diffused lighting, no harsh shadows
- No text, badges, watermarks, or logos added
- Square 1:1 composition, product fills ~70% of the frame`,
  },
  {
    id: 'soft-gradient',
    kind: 'regular',
    nameAr: 'تدرج ناعم فاخر',
    nameFr: 'Dégradé doux',
    blurbAr: 'خلفية متدرجة هادئة بإحساس فاخر',
    colors: { bg: '#E8EEF5', accent: '#1A6BB5', badge: '#0B3A5C' },
    prompt: () => `STYLE TEMPLATE "soft-gradient":
- Soft cool-to-warm light gradient background (never neon, never purple)
- Product floating slightly above a faint soft shadow
- Premium wholesale look, centered, generous breathing room
- No text overlays
- Square 1:1, product fills ~65-75% of frame`,
  },
  {
    id: 'desk-context',
    kind: 'regular',
    nameAr: 'سياق مكتب بسيط',
    nameFr: 'Bureau minimal',
    blurbAr: 'منتج على سطح مكتب مرتب بدون فوضى',
    colors: { bg: '#EDE7DE', accent: '#2C5282', badge: '#1A365D' },
    prompt: () => `STYLE TEMPLATE "desk-context":
- Minimal clean desk / wood or matte surface, very tidy
- Product as the hero object, slight 3/4 angle
- Soft daylight feel, no clutter, no hands, no people
- No text overlays
- Square 1:1 composition`,
  },
  {
    id: 'wholesale-badge',
    kind: 'regular',
    nameAr: 'بطاقة جملة مع السعر',
    nameFr: 'Carte gros + prix',
    blurbAr: 'استوديو نظيف مع شارة جملة والسعر',
    colors: { bg: '#F0F4F8', accent: '#197fe6', badge: '#128C7E' },
    prompt: ({ price }) => `STYLE TEMPLATE "wholesale-badge":
- Clean studio product shot on light background
- Small elegant corner badge "جملة" and price "${price || ''} DH"
- Typography minimal, Arabic-friendly, not cluttered
- Keep product identity exact
- Square 1:1 marketplace card`,
  },
];

/** @type {ImageTemplate[]} */
export const SALE_TEMPLATES = [
  {
    id: 'sale-red-tag',
    kind: 'sale',
    nameAr: 'شارة تخفيض حمراء',
    nameFr: 'Étiquette promo',
    blurbAr: 'سعر قديم مشطوب + سعر جديد واضح',
    colors: { bg: '#FFF5F5', accent: '#E53E3E', badge: '#C53030' },
    prompt: ({ price, oldPrice }) => `STYLE TEMPLATE "sale-red-tag":
- Clean studio product photo, light background
- Clear SALE layout: old price "${oldPrice || ''} DH" crossed out,
  new price "${price || ''} DH" bold, plus a small "%-" style promo corner
- Keep it readable and not messy
- Square 1:1`,
  },
  {
    id: 'sale-banner',
    kind: 'sale',
    nameAr: 'شريط عرض سفلي',
    nameFr: 'Bandeau promo',
    blurbAr: 'شريط عرض أنيق أسفل الصورة',
    colors: { bg: '#F7FAFC', accent: '#DD6B20', badge: '#C05621' },
    prompt: ({ price, oldPrice }) => `STYLE TEMPLATE "sale-banner":
- Product centered on clean studio background
- Thin elegant bottom banner with "تخفيض" / "PROMO"
  and prices: was ${oldPrice || ''} DH → now ${price || ''} DH
- Do not cover the product
- Square 1:1`,
  },
  {
    id: 'sale-burst',
    kind: 'sale',
    nameAr: 'دائرة تخفيض زاوية',
    nameFr: 'Pastille promo',
    blurbAr: 'دائرة نسبة التخفيض في الزاوية',
    colors: { bg: '#FFFAF0', accent: '#D69E2E', badge: '#B7791F' },
    prompt: ({ price, oldPrice }) => {
      const pct = calcDiscountPercent(oldPrice, price);
      return `STYLE TEMPLATE "sale-burst":
- Clean product studio shot
- Circular corner sticker showing ${pct ? `-${pct}%` : 'PROMO'}
- Prices nearby: ${oldPrice || ''} DH → ${price || ''} DH
- Square 1:1, premium not noisy`;
    },
  },
  {
    id: 'sale-split',
    kind: 'sale',
    nameAr: 'مقارنة سعرين',
    nameFr: 'Avant / Après',
    blurbAr: 'عرض واضح: قبل / بعد',
    colors: { bg: '#EDF2F7', accent: '#3182CE', badge: '#2B6CB0' },
    prompt: ({ price, oldPrice }) => `STYLE TEMPLATE "sale-split":
- Product hero on light studio backdrop
- Two clear price chips: "قبل ${oldPrice || ''} DH" and "الآن ${price || ''} DH"
- Arabic-friendly labels, balanced layout
- Square 1:1`,
  },
];

export const ALL_TEMPLATES = [...REGULAR_TEMPLATES, ...SALE_TEMPLATES];

function calcDiscountPercent(oldPrice, price) {
  const o = Number(oldPrice);
  const p = Number(price);
  if (!Number.isFinite(o) || !Number.isFinite(p) || o <= p || o <= 0) return 0;
  return Math.round(((o - p) / o) * 100);
}

function defaultSelection() {
  return {
    regular: ['studio-white', 'wholesale-badge'],
    sale: ['sale-red-tag', 'sale-banner'],
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

/**
 * Active templates for a product (sale set when oldPrice is present).
 */
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

/**
 * Build a visual preview card for Telegram (no AI needed).
 */
export async function renderTemplatePreview(template, {
  size = 1080,
  samplePrice = 149,
  sampleOldPrice = 229,
} = {}) {
  const { bg, accent, badge } = template.colors;
  const isSale = template.kind === 'sale';
  const pct = calcDiscountPercent(sampleOldPrice, samplePrice);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bg}"/>
      <stop offset="100%" stop-color="#ffffff"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#g)"/>
  <rect x="90" y="160" width="900" height="620" rx="36" fill="#ffffff" stroke="${accent}" stroke-width="3" opacity="0.95"/>
  <rect x="280" y="260" width="520" height="360" rx="28" fill="${accent}" opacity="0.12"/>
  <circle cx="540" cy="440" r="110" fill="${accent}" opacity="0.22"/>
  <text x="540" y="455" text-anchor="middle" font-family="Arial, sans-serif" font-size="42" font-weight="700" fill="${badge}">PRODUCT</text>
  <text x="540" y="90" text-anchor="middle" font-family="Arial, sans-serif" font-size="40" font-weight="700" fill="${badge}">${escapeXml(template.nameAr)}</text>
  <text x="540" y="130" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" fill="#64748b">${escapeXml(template.blurbAr)}</text>
  ${isSale ? `
  <rect x="780" y="190" width="170" height="170" rx="85" fill="${badge}"/>
  <text x="865" y="275" text-anchor="middle" font-family="Arial, sans-serif" font-size="44" font-weight="700" fill="#fff">-${pct || 30}%</text>
  <text x="540" y="860" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" fill="#94a3b8" text-decoration="line-through">${sampleOldPrice} DH</text>
  <text x="540" y="920" text-anchor="middle" font-family="Arial, sans-serif" font-size="52" font-weight="700" fill="${accent}">${samplePrice} DH</text>
  ` : `
  <rect x="120" y="820" width="200" height="70" rx="18" fill="${badge}"/>
  <text x="220" y="866" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" font-weight="700" fill="#fff">جملة</text>
  <text x="540" y="870" text-anchor="middle" font-family="Arial, sans-serif" font-size="48" font-weight="700" fill="${accent}">${samplePrice} DH</text>
  `}
  <text x="540" y="1020" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#94a3b8">Errayhany · ${template.id}</text>
</svg>`;

  return sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toBuffer();
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
