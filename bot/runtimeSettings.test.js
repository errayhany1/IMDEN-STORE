import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOT_SETTINGS_SCHEMA,
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
  assert.equal(updated.visionJpegQuality, 100);
  assert.equal(updated.openrouterTextModel, 'google/gemini-test');
  assert.equal(Object.hasOwn(updated, 'TELEGRAM_BOT_TOKEN'), false);
  assert.equal(typeof BOT_SETTINGS_SCHEMA.galleryApproval.default, 'boolean');
});
