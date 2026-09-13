import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCatalogCaption,
  isHourInWindow,
} from './telegramCatalogPoster.js';

test('catalog caption uses price and SKU', () => {
  assert.equal(
    formatCatalogCaption({ price: '120 DH', SKU: 'ERY-S23' }),
    '💰 الثمن: 120 درهم\n📋 المرجع: ERY-S23',
  );
  assert.match(formatCatalogCaption({}), /غير محدد/);
});

test('catalog hour window handles overnight range', () => {
  assert.equal(isHourInWindow(8, 8, 23), true);
  assert.equal(isHourInWindow(7, 8, 23), false);
  assert.equal(isHourInWindow(23, 8, 23), true);
  assert.equal(isHourInWindow(2, 22, 6), true);
  assert.equal(isHourInWindow(12, 22, 6), false);
});
