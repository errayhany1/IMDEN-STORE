import test from 'node:test';
import assert from 'node:assert/strict';
import {
  tifawtColorFamilySku,
  tifawtSkuColorLabel,
  groupTifawtColorFamilies,
} from './tifawtProductColors.js';

test('groups Tifawt color SKUs under the base reference', () => {
  assert.equal(tifawtColorFamilySku('ERY-SOURIS-R5-ULTRA-BLACK'), 'SOURIS-R5-ULTRA');
  assert.equal(tifawtColorFamilySku('SOURIS-X11-WHITE'), 'SOURIS-X11');
  assert.equal(tifawtSkuColorLabel('SOURIS-R5-ULTRA', 'SOURIS-R5-ULTRA-RED'), 'Rouge');
  assert.equal(tifawtSkuColorLabel('SOURIS-R5-ULTRA', 'SOURIS-R5-ULTRA-BLACK'), 'Noir');
  assert.equal(tifawtSkuColorLabel('SOURIS-R5-ULTRA', 'SOURIS-R5-ULTRA'), '');
  assert.equal(tifawtSkuColorLabel('SOURIS-R5-ULTRA', 'SOURIS-R5-ULTRA-PLUS'), '');
});

test('builds a storefront color map from sibling Tifawt SKUs', () => {
  const { families, bySku } = groupTifawtColorFamilies([
    { id: 1, sku: 'SOURIS-R5-ULTRA-BLACK', name: 'Souris Black', availableStock: 5, inStock: true, image: '/a.jpg' },
    { id: 2, sku: 'SOURIS-R5-ULTRA-WHITE', name: 'Souris White', availableStock: 3, inStock: true, image: '/b.jpg' },
    { id: 3, sku: 'SOURIS-R5-ULTRA-RED', name: 'Souris Red', availableStock: 0, inStock: false },
    { id: 4, sku: 'BOITIER-M2-SSD', name: 'Boitier', availableStock: 9, inStock: true },
  ]);
  assert.equal(families['SOURIS-R5-ULTRA']?.length, 3);
  assert.equal(bySku['ERY-SOURIS-R5-ULTRA'], 'SOURIS-R5-ULTRA');
  assert.equal(bySku['SOURIS-R5-ULTRA-WHITE'], 'SOURIS-R5-ULTRA');
  assert.deepEqual(families['SOURIS-R5-ULTRA'].find((v) => v.sku.endsWith('BLACK'))?.hexes, ['#1a1a1a']);
  assert.equal(families['BOITIER-M2-SSD'], undefined);
});
