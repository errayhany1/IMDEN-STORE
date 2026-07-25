/**
 * Force every generated catalog image onto the same square canvas.
 * AI models often return slightly different sizes; NocoDB/Sheets need uniformity.
 */
import sharp from 'sharp';

export const CATALOG_IMAGE_SIZE = Number(process.env.CATALOG_IMAGE_SIZE || 1080);

/**
 * Fit the image into a square canvas (contain + soft fill), JPEG output.
 * @param {Buffer} input
 * @param {{ size?: number, background?: { r: number, g: number, b: number } }} [opts]
 * @returns {Promise<Buffer>}
 */
export async function normalizeCatalogImage(input, opts = {}) {
  const size = opts.size || CATALOG_IMAGE_SIZE;
  const background = opts.background || { r: 255, g: 255, b: 255 };

  return sharp(input)
    .rotate()
    .resize(size, size, {
      fit: 'contain',
      background: { ...background, alpha: 1 },
      withoutEnlargement: false,
    })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
}

/**
 * Normalize many buffers; skip / log failures individually.
 * @param {Buffer[]} buffers
 */
export async function normalizeCatalogImages(buffers = []) {
  const out = [];
  for (const buf of buffers) {
    if (!buf?.length) continue;
    try {
      out.push(await normalizeCatalogImage(buf));
    } catch (e) {
      console.warn('normalizeCatalogImage failed, keeping original:', e.message);
      out.push(buf);
    }
  }
  return out;
}
