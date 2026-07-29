/**
 * Non-generative product cutout.
 *
 * U²-Net segments the seller's real photo locally, so logos, ports, colors and
 * included accessories cannot be hallucinated. The transparent result is then
 * finished by Sharp on the same white catalog canvas as the generated image.
 *
 * Inference runs in a worker thread with a hard timeout: a slow or stuck
 * forward pass must never freeze the Telegram bot.
 */
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { Worker } from 'worker_threads';
import sharp from 'sharp';
import { composeWhiteStudioProduct } from './studioImage.js';
import { getBotSetting } from './runtimeSettings.js';

const SIZE = 320;
const WORKER_PATH = fileURLToPath(new URL('./segmentWorker.js', import.meta.url));
const DEFAULT_MODEL_URL =
  'https://huggingface.co/Heliosoph/u2net-onnx/resolve/main/u2netp.onnx';
const IDLE_SHUTDOWN_MS = 5 * 60 * 1000;

let modelReadyPromise = null;
let worker = null;
let workerIdleTimer = null;
let jobSeq = 0;
const pending = new Map();
let queue = Promise.resolve();

function enabled() {
  return Boolean(getBotSetting('localBackgroundRemoval'));
}

function timeoutMs() {
  return Number(getBotSetting('localBackgroundTimeoutMs'));
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
    await fs.mkdir(dir, { recursive: true });

    try {
      const stat = await fs.stat(target);
      if (stat.size > 1_000_000) return target;
    } catch {
      // Download below.
    }

    const modelUrl = process.env.BG_REMOVER_MODEL_URL || DEFAULT_MODEL_URL;
    const response = await fetch(modelUrl, { redirect: 'follow' });
    if (!response.ok) throw new Error(`local_model_download_${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 1_000_000) throw new Error('local_model_download_too_small');
    const temporary = `${target}.download`;
    await fs.writeFile(temporary, bytes);
    await fs.rename(temporary, target);
    return target;
  })().catch((error) => {
    modelReadyPromise = null;
    throw error;
  });
  return modelReadyPromise;
}

function dropWorker(reason) {
  const dying = worker;
  worker = null;
  if (workerIdleTimer) {
    clearTimeout(workerIdleTimer);
    workerIdleTimer = null;
  }
  for (const [, job] of pending) job.reject(new Error(reason));
  pending.clear();
  if (dying) dying.terminate().catch(() => {});
}

function scheduleIdleShutdown() {
  if (workerIdleTimer) clearTimeout(workerIdleTimer);
  if (!worker) return;
  workerIdleTimer = setTimeout(() => {
    if (pending.size === 0) dropWorker('segment_worker_idle');
  }, IDLE_SHUTDOWN_MS);
  workerIdleTimer.unref?.();
}

async function ensureWorker() {
  if (worker) return worker;
  const modelPath = await ensureLocalModel();
  // Empty execArgv: the parent's CLI flags must not leak into the worker.
  worker = new Worker(WORKER_PATH, { workerData: { modelPath }, execArgv: [] });
  worker.on('message', ({ id, matte, error }) => {
    const job = pending.get(id);
    if (!job) return;
    pending.delete(id);
    if (error) job.reject(new Error(`segment_worker:${error}`));
    else job.resolve(matte);
    if (pending.size === 0) worker?.unref();
    scheduleIdleShutdown();
  });
  worker.on('error', (error) => dropWorker(`segment_worker_crash:${error.message}`));
  worker.on('exit', () => {
    if (worker) dropWorker('segment_worker_exit');
  });
  // After the listeners, otherwise the message port re-refs the event loop and
  // an idle bot can no longer shut down.
  worker.unref();
  return worker;
}

/** Run one inference; inference is serialized so two products never compete for CPU. */
function segment(rgb) {
  const job = queue.then(async () => {
    const active = await ensureWorker();
    const id = (jobSeq += 1);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        dropWorker('segment_timeout');
        reject(new Error('local_cutout_timeout'));
      }, timeoutMs());
      timer.unref?.();
      const settle = (fn) => (value) => {
        clearTimeout(timer);
        fn(value);
      };
      pending.set(id, { resolve: settle(resolve), reject: settle(reject) });
      // Hold the event loop only while a cutout is actually in flight.
      active.ref();
      active.postMessage({ id, rgb }, [rgb.buffer]);
    });
  });
  queue = job.catch(() => {});
  return job;
}

/** Separable max filter: marks every pixel within `radius` of the kept blob. */
function dilate(label, keepLabel, width, height, radius) {
  const total = width * height;
  const rows = new Uint8Array(total);
  for (let y = 0; y < height; y += 1) {
    const base = y * width;
    for (let x = 0; x < width; x += 1) {
      const from = Math.max(0, x - radius);
      const to = Math.min(width - 1, x + radius);
      let hit = 0;
      for (let k = from; k <= to; k += 1) {
        if (label[base + k] === keepLabel) {
          hit = 1;
          break;
        }
      }
      rows[base + x] = hit;
    }
  }
  const out = new Uint8Array(total);
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      const from = Math.max(0, y - radius);
      const to = Math.min(height - 1, y + radius);
      let hit = 0;
      for (let k = from; k <= to; k += 1) {
        if (rows[(k * width) + x]) {
          hit = 1;
          break;
        }
      }
      out[(y * width) + x] = hit;
    }
  }
  return out;
}

/**
 * Turn the raw matte into a publishable alpha channel: drop the halo, keep only
 * the main subject, and feather the edge so the white canvas looks natural.
 */
function refineMask(matte, width, height) {
  const total = width * height;
  const alpha = new Uint8Array(total);
  // Stretch 100..170 to 0..255: below is background halo, above is solid product.
  for (let i = 0; i < total; i += 1) {
    const v = matte[i];
    if (v <= 100) continue;
    alpha[i] = v >= 170 ? 255 : Math.round(((v - 100) / 70) * 255);
  }

  // Keep the largest connected blob so reflections and table edges are dropped.
  const label = new Int32Array(total);
  const stack = new Int32Array(total);
  let best = 0;
  let bestSize = 0;
  let blobs = 0;
  for (let seed = 0; seed < total; seed += 1) {
    if (alpha[seed] < 128 || label[seed]) continue;
    blobs += 1;
    let top = 0;
    stack[top++] = seed;
    label[seed] = blobs;
    let size = 0;
    while (top > 0) {
      const i = stack[--top];
      size += 1;
      const x = i % width;
      if (x > 0 && alpha[i - 1] >= 128 && !label[i - 1]) {
        label[i - 1] = blobs;
        stack[top++] = i - 1;
      }
      if (x + 1 < width && alpha[i + 1] >= 128 && !label[i + 1]) {
        label[i + 1] = blobs;
        stack[top++] = i + 1;
      }
      if (i >= width && alpha[i - width] >= 128 && !label[i - width]) {
        label[i - width] = blobs;
        stack[top++] = i - width;
      }
      if (i + width < total && alpha[i + width] >= 128 && !label[i + width]) {
        label[i + width] = blobs;
        stack[top++] = i + width;
      }
    }
    if (size > bestSize) {
      bestSize = size;
      best = blobs;
    }
  }
  if (!bestSize) throw new Error('local_cutout_no_subject');

  // Feathered edge pixels are unlabeled, so keep only those hugging the subject.
  const near = dilate(label, best, width, height, 3);

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let foreground = 0;
  for (let i = 0; i < total; i += 1) {
    if (!near[i]) {
      alpha[i] = 0;
      continue;
    }
    if (alpha[i] < 24) continue;
    foreground += 1;
    const x = i % width;
    const y = (i - x) / width;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const coverage = foreground / total;
  const boxWidth = (maxX - minX + 1) / width;
  const boxHeight = (maxY - minY + 1) / height;
  if (coverage < 0.02) throw new Error('local_cutout_subject_too_small');
  if (coverage > 0.94) throw new Error('local_cutout_background_kept');
  if (boxWidth > 0.985 && boxHeight > 0.985) throw new Error('local_cutout_no_separation');

  return alpha;
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

  // Keep memory bounded while preserving enough edge detail for the mask.
  const source = await sharp(sourceBuffer)
    .rotate()
    .resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true })
    .removeAlpha()
    .toColourspace('srgb')
    .png()
    .toBuffer();
  const { width, height } = await sharp(source).metadata();
  if (!width || !height) throw new Error('local_cutout_unreadable_source');

  // U²-Net expects a squashed square, so the matte maps back one-to-one.
  const small = await sharp(source)
    .resize(SIZE, SIZE, { fit: 'fill' })
    .raw()
    .toBuffer();
  const matte = await segment(new Uint8Array(small));

  const upscaled = await sharp(Buffer.from(matte), {
    raw: { width: SIZE, height: SIZE, channels: 1 },
  })
    .resize(width, height, { fit: 'fill' })
    .blur(1.2)
    .toColourspace('b-w')
    .raw()
    .toBuffer();

  const alpha = refineMask(upscaled, width, height);
  const transparent = await sharp(source)
    .joinChannel(Buffer.from(alpha.buffer), {
      raw: { width, height, channels: 1 },
    })
    .png()
    .toBuffer();

  return composeWhiteStudioProduct(transparent, {
    price: opts.price,
    oldPrice: opts.oldPrice,
    saleBadge: false,
  });
}
