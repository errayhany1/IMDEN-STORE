import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { BOT_SETTINGS_SCHEMA } from './runtimeSettings.js';
import { orderGalleryUploads } from './productEnrichment.js';

const botDir = dirname(fileURLToPath(import.meta.url));
const serverSrc = readFileSync(join(botDir, 'server.js'), 'utf8');
const enrichSrc = readFileSync(join(botDir, 'productEnrichment.js'), 'utf8');

test('Telegram bot no longer imports Amazon scrape', () => {
  assert.doesNotMatch(serverSrc, /from ['"]\.\/amazonScrape\.js['"]/);
  assert.doesNotMatch(enrichSrc, /from ['"]\.\/amazonScrape\.js['"]/);
});

test('Amazon rebuild commands reply that the feature is stopped', () => {
  assert.match(serverSrc, /AMAZON_STOPPED_MESSAGE/);
  assert.match(serverSrc, /ميزة Amazon متوقفة/);
  assert.match(serverSrc, /isAmazonReenrichCommand/);
  assert.match(serverSrc, /amazonReenrichRef/);
});

test('product captions never keep Amazon URLs for ingest', () => {
  assert.match(serverSrc, /amazonUrl: '', amazonUrls: \[\]/);
  assert.doesNotMatch(serverSrc, /normalizeAmazonUrls\(caption/);
});

test('gallery publish uses seller originals even if Amazon files are present', () => {
  assert.deepEqual(
    orderGalleryUploads({
      amazonUploads: [{ title: 'amazon-1.jpg' }],
      realUploads: [{ title: 'seller-1.jpg' }],
    }),
    [{ title: 'seller-1.jpg' }],
  );
});

test('Amazon timeout setting is marked stopped', () => {
  assert.match(BOT_SETTINGS_SCHEMA.amazonTimeoutMs.description, /متوقف/);
});
