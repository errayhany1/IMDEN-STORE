/**
 * U²-Net inference worker.
 *
 * Runs in its own thread so the WASM forward pass cannot block the Telegram
 * event loop. Receives a 320×320 RGB byte buffer, returns the raw saliency
 * matte; all image IO and mask refinement stay in the parent thread.
 */
import { parentPort, workerData } from 'worker_threads';
import * as ort from 'onnxruntime-web';

const SIZE = 320;
// ImageNet statistics the U²-Net checkpoints were trained with. Feeding raw
// 0..1 pixels instead produces the mushy masks we had before.
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

ort.env.wasm.numThreads = 1;
ort.env.logLevel = 'error';

let sessionPromise = null;

function session() {
  if (!sessionPromise) {
    sessionPromise = ort.InferenceSession.create(workerData.modelPath, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });
  }
  return sessionPromise;
}

function toTensorInput(rgb) {
  const pixels = SIZE * SIZE;
  const input = new Float32Array(pixels * 3);
  let peak = 0;
  for (let i = 0; i < rgb.length; i += 1) {
    if (rgb[i] > peak) peak = rgb[i];
  }
  const scale = peak || 255;
  for (let p = 0; p < pixels; p += 1) {
    for (let c = 0; c < 3; c += 1) {
      input[(c * pixels) + p] = ((rgb[(p * 3) + c] / scale) - MEAN[c]) / STD[c];
    }
  }
  return input;
}

parentPort.on('message', async ({ id, rgb }) => {
  try {
    const run = await session();
    const feeds = {
      [run.inputNames[0]]: new ort.Tensor('float32', toTensorInput(rgb), [1, 3, SIZE, SIZE]),
    };
    const output = await run.run(feeds);
    const pred = output[run.outputNames[0]].data;

    // Rescale the matte to the full 0..255 range the way rembg does, then hand
    // back one byte per pixel to keep the message small.
    let min = Infinity;
    let max = -Infinity;
    for (const v of pred) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const span = max - min || 1;
    const matte = new Uint8Array(SIZE * SIZE);
    for (let i = 0; i < matte.length; i += 1) {
      matte[i] = Math.round(((pred[i] - min) / span) * 255);
    }
    parentPort.postMessage({ id, matte }, [matte.buffer]);
  } catch (error) {
    parentPort.postMessage({ id, error: error?.message || 'segment_failed' });
  }
});
