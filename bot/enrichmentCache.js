import crypto from 'crypto';

const VERSION = 1;

export function sourceHash(buffers = []) {
  const hash = crypto.createHash('sha256');
  for (const buffer of buffers.filter(Boolean)) {
    hash.update(String(buffer.length));
    hash.update(buffer);
  }
  return hash.digest('hex');
}

export function readEnrichmentCache(value) {
  if (!value) return null;
  try {
    const cache = typeof value === 'string' ? JSON.parse(value) : value;
    return cache?.version === VERSION ? cache : null;
  } catch {
    return null;
  }
}

export function cacheHasFacts(cache, hash, model) {
  return Boolean(
    cache?.sourceHash === hash
    && cache?.facts?.data
    && cache?.facts?.model === model,
  );
}

export function totalCost(usage = []) {
  return usage.reduce((sum, entry) => sum + Number(entry?.cost || 0), 0);
}

export function buildEnrichmentCache({
  hash,
  facts,
  model,
  copy,
  usage = [],
  gallery = {},
  errors = [],
}) {
  return {
    version: VERSION,
    sourceHash: hash,
    facts: facts ? {
      key: `facts:${hash}:${model}`,
      model,
      promptVersion: 'facts-v1',
      data: facts,
    } : null,
    copy: copy ? {
      key: `copy:${hash}:copy-v1`,
      templateVersion: 'copy-v1',
      data: copy,
    } : null,
    images: {
      key: `studio:${hash}:studio-v1`,
      promptVersion: 'studio-v1',
      assetNames: gallery.assetNames || [],
      status: gallery.status || 'awaiting_approval',
    },
    usage,
    lastRun: {
      finishedAt: new Date().toISOString(),
      errors: errors.slice(0, 10),
    },
  };
}

export function serializeEnrichmentCache(cache) {
  return JSON.stringify(cache);
}
