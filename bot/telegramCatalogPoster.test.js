import test from 'node:test';
import assert from 'node:assert/strict';
import {
  catalogImageLimit,
  formatCatalogCaption,
  isHourInWindow,
} from './telegramCatalogPoster.js';

test('catalog caption uses price and SKU', () => {
  assert.equal(
    formatCatalogCaption({ price: '120 DH', SKU: 'ERY-S23' }, { includeName: false }),
    '💰 الثمن: 120 درهم\n📋 المرجع: ERY-S23',
  );
  assert.match(formatCatalogCaption({}, { includeName: false }), /غير محدد/);
});

test('catalog caption can prepend the product name', () => {
  assert.equal(
    formatCatalogCaption(
      { Arabic_Title: 'سماعة بلوتوث', price: 99, SKU: 'ERY-BT' },
      { includeName: true },
    ),
    'سماعة بلوتوث\n💰 الثمن: 99 درهم\n📋 المرجع: ERY-BT',
  );
});

test('catalog image limit stays between 1 and 8', () => {
  assert.equal(catalogImageLimit(1), 1);
  assert.equal(catalogImageLimit(8), 8);
  assert.equal(catalogImageLimit(0), 1);
  assert.equal(catalogImageLimit(20), 8);
});

test('catalog hour window handles overnight range', () => {
  assert.equal(isHourInWindow(8, 8, 23), true);
  assert.equal(isHourInWindow(7, 8, 23), false);
  assert.equal(isHourInWindow(23, 8, 23), true);
  assert.equal(isHourInWindow(2, 22, 6), true);
  assert.equal(isHourInWindow(12, 22, 6), false);
});
