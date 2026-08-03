/**
 * Convert marketplace/catalog references to the canonical SKU stored in Tifawt.
 * Jumia products use an `ERY-` namespace and optional bot-owned color suffix
 * (`-JCNO`, `-JCBCNO`, ...); Tifawt stores the original reference only.
 *
 * When Tifawt already has stock under an older/different SKU that cannot be
 * renamed, use `tifawtSkuAliases` (website ref → existing Tifawt SKU) so order
 * sync attaches the inventoried product without changing ERP references.
 */
import { stripJumiaColorSuffix } from './colorVariants.js';

export function toTifawtSku(rawSku, { fallback = '' } = {}) {
  const cleaned = stripJumiaColorSuffix(String(rawSku || '')
    .trim()
    .toUpperCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^A-Z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .replace(/^ER(?:Y)?-+/, ''));

  return cleaned || fallback;
}

/** Normalize any free-form alias key the same way as order SKUs. */
export function normalizeAliasKey(rawSku) {
  return toTifawtSku(rawSku);
}

/**
 * Parse admin textarea lines:
 *   WEBSITE-REF=TIFAWT-SKU
 *   MP3 car M53 = OLD-MP3-CODE
 * Comments (# …) and blank lines are ignored.
 */
export function parseTifawtSkuAliases(raw = '') {
  const map = new Map();
  for (const line of String(raw || '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const sep = trimmed.includes('=') ? '=' : (trimmed.includes('=>') ? '=>' : null);
    if (!sep) continue;
    const [left, ...rest] = trimmed.split(sep === '=>' ? '=>' : '=');
    const from = normalizeAliasKey(left);
    const to = toTifawtSku(rest.join(sep === '=>' ? '=>' : '=').trim());
    if (from && to) map.set(from, to);
  }
  return map;
}

/**
 * Resolve the SKU Tifawt Lead Source must receive for an order line.
 * Alias map wins so inventoried ERP refs stay untouched.
 */
export function resolveTifawtOrderSku(rawSku, aliasesRaw = '', { fallback = '' } = {}) {
  const normalized = toTifawtSku(rawSku, { fallback });
  if (!normalized) return fallback;
  const aliases = aliasesRaw instanceof Map
    ? aliasesRaw
    : parseTifawtSkuAliases(aliasesRaw);
  return aliases.get(normalized) || normalized;
}
