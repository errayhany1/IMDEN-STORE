import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOT_SETTINGS_SCHEMA,
  publicBotSettingsPayload,
  sanitizeBotSettingsPatch,
} from './runtimeSettings.js';

test('runtime bot settings sanitize only safe values', () => {
  const updated = sanitizeBotSettingsPatch({
    galleryApproval: false,
    visionJpegQuality: 500,
    openrouterTextModel: '  google/gemini-test  ',
    TELEGRAM_BOT_TOKEN: 'must-not-be-saved',
  });

  assert.equal(updated.galleryApproval, false);
  assert.equal(BOT_SETTINGS_SCHEMA.galleryApproval.default, false);
  assert.match(BOT_SETTINGS_SCHEMA.productAiEnrichment.description, /بدون توليد صور/);
  assert.match(BOT_SETTINGS_SCHEMA.amazonTimeoutMs.description, /متوقف/);
  assert.equal(BOT_SETTINGS_SCHEMA.amazonTimeoutMs.hidden, true);
  assert.equal(BOT_SETTINGS_SCHEMA.galleryApproval.hidden, true);
  assert.equal(BOT_SETTINGS_SCHEMA.openrouterImageModel.hidden, true);
  assert.equal(updated.visionJpegQuality, 100);
  assert.equal(updated.openrouterTextModel, 'google/gemini-test');
  assert.equal(Object.hasOwn(updated, 'TELEGRAM_BOT_TOKEN'), false);
  assert.equal(typeof BOT_SETTINGS_SCHEMA.galleryApproval.default, 'boolean');
});

test('public bot settings omit retired Amazon and image-generation controls', () => {
  const payload = publicBotSettingsPayload();
  assert.equal(payload.schema.amazonTimeoutMs, undefined);
  assert.equal(payload.schema.galleryApproval, undefined);
  assert.equal(payload.schema.openrouterImageModel, undefined);
  assert.equal(payload.schema.qwenImageModel, undefined);
  assert.equal(payload.connections.apify, undefined);
  assert.equal(payload.connections.qwen, undefined);
  assert.ok(payload.schema.productAiEnrichment);
});
