const COLOR_ALIASES = new Map([
  ['اسود', 'Noir'], ['أسود', 'Noir'], ['noir', 'Noir'], ['black', 'Noir'],
  ['ابيض', 'Blanc'], ['أبيض', 'Blanc'], ['blanc', 'Blanc'], ['white', 'Blanc'],
  ['ازرق', 'Bleu'], ['أزرق', 'Bleu'], ['bleu', 'Bleu'], ['blue', 'Bleu'],
  ['احمر', 'Rouge'], ['أحمر', 'Rouge'], ['rouge', 'Rouge'], ['red', 'Rouge'],
  ['اخضر', 'Vert'], ['أخضر', 'Vert'], ['vert', 'Vert'], ['green', 'Vert'],
  ['اصفر', 'Jaune'], ['أصفر', 'Jaune'], ['jaune', 'Jaune'], ['yellow', 'Jaune'],
  ['برتقالي', 'Orange'], ['orange', 'Orange'],
  ['وردي', 'Rose'], ['زهري', 'Rose'], ['rose', 'Rose'], ['pink', 'Rose'],
  ['بنفسجي', 'Violet'], ['violet', 'Violet'], ['purple', 'Violet'],
  ['رمادي', 'Gris'], ['رصاصي', 'Gris'], ['gris', 'Gris'], ['gray', 'Gris'], ['grey', 'Gris'],
  ['بني', 'Marron'], ['marron', 'Marron'], ['brown', 'Marron'],
  ['ذهبي', 'Doré'], ['ذهبيّة', 'Doré'], ['dore', 'Doré'], ['doré', 'Doré'], ['gold', 'Doré'],
  ['فضي', 'Argenté'], ['فضيّة', 'Argenté'], ['argente', 'Argenté'], ['argenté', 'Argenté'], ['silver', 'Argenté'],
  ['بيج', 'Beige'], ['beige', 'Beige'],
  ['سماوي', 'Ciel'], ['cyan', 'Ciel'], ['ciel', 'Ciel'],
]);

const SINGLE_COLOR_CODES = new Map([
  ['NOIR', 'NO'], ['BLANC', 'BC'], ['BLEU', 'BL'], ['ROUGE', 'RO'],
  ['ROSE', 'RS'], ['VERT', 'VE'], ['VIOLET', 'VI'], ['JAUNE', 'JA'],
  ['ORANGE', 'OR'], ['GRIS', 'GR'], ['MARRON', 'MA'], ['DORE', 'DO'],
  ['ARGENTE', 'AR'], ['BEIGE', 'BE'], ['CIEL', 'CI'],
]);

const COLOR_AR = new Map([
  ['Noir', 'أسود'], ['Blanc', 'أبيض'], ['Bleu', 'أزرق'], ['Rouge', 'أحمر'],
  ['Rose', 'وردي'], ['Vert', 'أخضر'], ['Violet', 'بنفسجي'], ['Jaune', 'أصفر'],
  ['Orange', 'برتقالي'], ['Gris', 'رمادي'], ['Marron', 'بني'], ['Doré', 'ذهبي'],
  ['Argenté', 'فضي'], ['Beige', 'بيج'], ['Ciel', 'سماوي'],
]);

/** Explicit Jumia-color namespace: ERY-BASE-JCNO, never ambiguous -Cxx suffixes. */
const JUMIA_COLOR_SUFFIX_RE = /-JC[A-Z0-9]{2,4}$/i;

function stripAccents(value) {
  return String(value || '').normalize('NFD').replace(/\p{M}/gu, '');
}

function normalizedKey(value) {
  return stripAccents(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function canonicalPart(value) {
  const clean = normalizedKey(value);
  return COLOR_ALIASES.get(clean) || String(value || '').trim();
}

/**
 * Normalize a variant label while preserving combinations such as
 * "Noir et Bleu". A combination is one Jumia variant, not two colors.
 * Parts are sorted so "Noir et Blanc" and "Blanc et Noir" stay identical.
 */
export function normalizeColorLabel(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const parts = [...new Set(
    raw
      .split(/\s*(?:\+|\/|&|\bet\b|\bavec\b|\band\b)\s*|\s+(?:و|مع)\s+|\s+و(?=\p{L})/iu)
      .map(canonicalPart)
      .filter(Boolean),
  )];
  if (!parts.length) return '';
  parts.sort((a, b) => normalizedKey(a).localeCompare(normalizedKey(b), 'fr'));
  return parts.join(' et ').slice(0, 80);
}

export function parseColorList(value, { max = 7 } = {}) {
  const input = Array.isArray(value) ? value : String(value || '').split(/[,،;\n]+/);
  const out = [];
  const seen = new Set();
  for (const item of input) {
    const label = normalizeColorLabel(item);
    const key = normalizedKey(label);
    if (!label || seen.has(key) || /^multicolou?r(?:e)?$/i.test(label)) continue;
    seen.add(key);
    out.push(label);
    if (out.length >= max) break;
  }
  return out;
}

export function colorLabelArabic(label) {
  return normalizeColorLabel(label)
    .split(/\s+et\s+/i)
    .map((part) => COLOR_AR.get(part) || part)
    .join(' و');
}

function partCode(part) {
  const key = stripAccents(part).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (SINGLE_COLOR_CODES.has(key)) return SINGLE_COLOR_CODES.get(key);
  return (key || 'XX').slice(0, 2).padEnd(2, 'X');
}

function rawColorCode(label) {
  const parts = normalizeColorLabel(label)
    .split(/\s+et\s+/i)
    .map((part) => String(part || '').trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    // Two known color codes (e.g. BC+NO → BCNO) stay unique and order-stable.
    return parts.map(partCode).join('').slice(0, 4);
  }
  return partCode(parts[0] || 'XX');
}

function stableFallbackCode(label, used) {
  const seed = stripAccents(normalizedKey(label)).replace(/[^a-z0-9]/gi, '').toUpperCase() || 'X';
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash * 31) + seed.charCodeAt(i)) >>> 0;
  }
  for (let i = 0; i < 1296; i++) {
    const candidate = (hash + i).toString(36).toUpperCase().padStart(2, 'X').slice(-4);
    if (!used.has(candidate)) return candidate;
  }
  return 'ZZZZ';
}

/**
 * JC is an explicit namespace marker. Order normalization removes only this
 * bot-owned Jumia-color suffix, never ordinary SKUs like ABC-C31.
 * When several labels share a preferred code, every colliding label receives
 * a label-derived hash so list order cannot change the mapping.
 */
export function buildColorVariants(colors = []) {
  const preferred = parseColorList(colors).map((label) => ({
    label,
    preferred: rawColorCode(label),
  }));
  const collisionCounts = new Map();
  for (const item of preferred) {
    collisionCounts.set(item.preferred, (collisionCounts.get(item.preferred) || 0) + 1);
  }

  const used = new Map();
  return preferred.map(({ label, preferred: pref }) => {
    let code = collisionCounts.get(pref) > 1
      ? stableFallbackCode(label, used)
      : pref;
    if (used.has(code) && used.get(code) !== label) {
      code = stableFallbackCode(label, used);
    }
    used.set(code, label);
    return { label, code, skuSuffix: `JC${code}` };
  });
}

export function buildJumiaColorSku(baseSellerSku, variant) {
  const base = String(baseSellerSku || '').trim().replace(/-+$/, '');
  return `${base}-${variant.skuSuffix}`;
}

export function stripJumiaColorSuffix(value) {
  return String(value || '').replace(JUMIA_COLOR_SUFFIX_RE, '');
}
