import test from 'node:test';
import assert from 'node:assert/strict';
import {
  tifawtColorFamilySku,
  tifawtSkuColorLabel,
} from './tifawtProductColors.js';

test('groups Tifawt color SKUs under the base reference', () => {
  assert.equal(tifawtColorFamilySku('ERY-SOURIS-R5-ULTRA-BLACK'), 'SOURIS-R5-ULTRA');
  assert.equal(tifawtColorFamilySku('SOURIS-X11-WHITE'), 'SOURIS-X11');
  assert.equal(tifawtSkuColorLabel('SOURIS-R5-ULTRA', 'SOURIS-R5-ULTRA-RED'), 'Rouge');
  assert.equal(tifawtSkuColorLabel('SOURIS-R5-ULTRA', 'SOURIS-R5-ULTRA-BLACK'), 'Noir');
  assert.equal(tifawtSkuColorLabel('SOURIS-R5-ULTRA', 'SOURIS-R5-ULTRA'), '');
  assert.equal(tifawtSkuColorLabel('SOURIS-R5-ULTRA', 'SOURIS-R5-ULTRA-PLUS'), '');
});
