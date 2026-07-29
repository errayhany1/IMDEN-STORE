/**
 * Convert marketplace/catalog references to the canonical SKU stored in Tifawt.
 * Jumia products use an `ERY-` namespace; Tifawt stores the original reference.
 */
export function toTifawtSku(rawSku, { fallback = '' } = {}) {
  const cleaned = String(rawSku || '')
    .trim()
    .toUpperCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^A-Z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .replace(/^ERY-+/, '');

  return cleaned || fallback;
}
