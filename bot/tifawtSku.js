/**
 * Convert marketplace/catalog references to the canonical SKU stored in Tifawt.
 * Jumia products use an `ERY-` namespace and optional bot-owned color suffix
 * (`-JCNO`, `-JCBCNO`, ...); Tifawt stores the original reference only.
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
