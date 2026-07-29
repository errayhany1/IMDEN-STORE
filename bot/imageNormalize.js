/**
 * Force every generated catalog image onto the same square canvas.
 * AI models often return slightly different sizes; NocoDB/Sheets need uniformity.
 */
import sharp from 'sharp';
import { getBotSetting, refreshBotSettings } from './runtimeSettings.js';

await refreshBotSettings();
export const CATALOG_IMAGE_SIZE = Number(getBotSetting('catalogImageSize'));

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

/**
 * Downscale seller photos before sending them to vision / image models.
 * Full-resolution Telegram photos (often 2000–4000px) make AI calls slow
 * and push the enrichment pipeline past the soft timeout, which used to
 * save products with only the raw caption and a single real image.
 *
 * @param {Buffer[]} buffers
 * @param {{ maxEdge?: number, quality?: number }} [opts]
 * @returns {Promise<Buffer[]>}
 */
export async function prepareVisionBuffers(buffers = [], opts = {}) {
  const maxEdge = opts.maxEdge || Number(getBotSetting('visionMaxEdge'));
  const quality = opts.quality || Number(getBotSetting('visionJpegQuality'));
  const out = [];
  for (const buf of buffers) {
    if (!buf?.length) continue;
    try {
      out.push(
        await sharp(buf)
          .rotate()
          .resize({
            width: maxEdge,
            height: maxEdge,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality, mozjpeg: true })
          .toBuffer()
      );
    } catch (e) {
      console.warn('prepareVisionBuffers failed, skipping frame:', e.message);
    }
  }
  return out;
}
