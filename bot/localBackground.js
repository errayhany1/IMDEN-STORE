/**
 * Non-generative product cutout.
 *
 * U²-Net segments the seller's real photo locally, so logos, ports, colors and
 * included accessories cannot be hallucinated. The transparent result is then
 * finished by Sharp on the same white catalog canvas as the generated image.
 */
import crypto from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { removeBackground } from 'js-image-bg-remover';
import { composeWhiteStudioProduct } from './studioImage.js';

const DEFAULT_MODEL_URL =
  'https://huggingface.co/Heliosoph/u2net-onnx/resolve/main/u2netp.onnx';
let modelReadyPromise = null;

function enabled() {
  return String(process.env.LOCAL_BACKGROUND_REMOVAL || 'true').toLowerCase() !== 'false';
}

function modelDir() {
  return (
    process.env.BG_REMOVER_MODEL_DIR
    || path.join(os.tmpdir(), 'errayhany-bg-remover-models')
  );
}

async function ensureLocalModel() {
  if (modelReadyPromise) return modelReadyPromise;
  modelReadyPromise = (async () => {
    const dir = modelDir();
    const target = path.join(dir, 'u2net.onnx');
    const versionFile = `${target}.version`;
    process.env.BG_REMOVER_MODEL_DIR = dir;
    await fs.mkdir(dir, { recursive: true });

    try {
      const stat = await fs.stat(target);
      if (stat.size > 1_000_000) {
        // The dependency checks this marker before every inference.
        await fs.writeFile(versionFile, '1.0.0');
        return target;
      }
    } catch {
      // Download below.
    }

    const modelUrl = process.env.BG_REMOVER_MODEL_URL || DEFAULT_MODEL_URL;
    const response = await fetch(modelUrl, { redirect: 'follow' });
    if (!response.ok) {
      throw new Error(`local_model_download_${response.status}`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 1_000_000) throw new Error('local_model_download_too_small');
    const temporary = `${target}.download`;
    await fs.writeFile(temporary, bytes);
    await fs.rename(temporary, target);
    await fs.writeFile(versionFile, '1.0.0');
    return target;
  })().catch((error) => {
    modelReadyPromise = null;
    throw error;
  });
  return modelReadyPromise;
}

/**
 * @param {Buffer} sourceBuffer
 * @param {{ price?: number|string, oldPrice?: number|string }} opts
 * @returns {Promise<Buffer|null>} final 1080×1080 JPEG, or null if disabled
 */
export async function createRealProductCutout(sourceBuffer, opts = {}) {
  if (!enabled()) return null;
  if (!Buffer.isBuffer(sourceBuffer) || sourceBuffer.length < 500) {
    throw new Error('local_cutout_invalid_source');
  }

  const jobId = crypto.randomBytes(8).toString('hex');
  const workDir = path.join(os.tmpdir(), 'errayhany-bg-jobs');
  const inputPath = path.join(workDir, `${jobId}-input.jpg`);
  const outputPath = path.join(workDir, `${jobId}-cutout.png`);

  await fs.mkdir(workDir, { recursive: true });
  await ensureLocalModel();

  try {
    // Keep inference memory bounded while preserving enough edge detail.
    const prepared = await sharp(sourceBuffer)
      .rotate()
      .resize({
        width: 1400,
        height: 1400,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
    await fs.writeFile(inputPath, prepared);

    await removeBackground(inputPath, outputPath, { showProgress: false });

    const transparent = await fs.readFile(outputPath);
    if (transparent.length < 500) throw new Error('local_cutout_empty');
    return composeWhiteStudioProduct(transparent, {
      price: opts.price,
      oldPrice: opts.oldPrice,
      saleBadge: false,
    });
  } finally {
    await Promise.allSettled([
      fs.rm(inputPath, { force: true }),
      fs.rm(outputPath, { force: true }),
    ]);
  }
}

