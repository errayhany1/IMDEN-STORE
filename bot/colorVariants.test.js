import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildColorVariants,
  buildJumiaColorSku,
  parseColorList,
} from './colorVariants.js';
import { toTifawtSku } from './tifawtSku.js';

test('keeps two-tone combinations as distinct variants', () => {
  assert.deepEqual(
    parseColorList('أبيض وأسود، أسود مع أزرق، أزرق'),
    ['Blanc et Noir', 'Bleu et Noir', 'Bleu'],
  );
});

test('normalizes two-tone wording order into one label', () => {
  assert.deepEqual(
    parseColorList('Noir et Blanc, Blanc et Noir'),
    ['Blanc et Noir'],
  );
});

test('creates unique, explicitly marked color SKUs', () => {
  const variants = buildColorVariants(['Bleu', 'Blanc', 'Noir et Bleu']);
  assert.deepEqual(variants.map((variant) => variant.skuSuffix), ['JCBL', 'JCBC', 'JCBLNO']);
  assert.deepEqual(
    variants.map((variant) => buildJumiaColorSku('ERY-WATCH-10', variant)),
    ['ERY-WATCH-10-JCBL', 'ERY-WATCH-10-JCBC', 'ERY-WATCH-10-JCBLNO'],
  );
});

test('keeps variant SKUs stable regardless of list order', () => {
  const forward = buildColorVariants(['Noir et Blanc', 'Noir et Bleu', 'Bleu']);
  const reverse = buildColorVariants(['Bleu', 'Noir et Bleu', 'Blanc et Noir']);
  const byLabel = (list) => Object.fromEntries(list.map((v) => [v.label, v.skuSuffix]));
  assert.deepEqual(byLabel(forward), byLabel(reverse));
  assert.equal(byLabel(forward)['Blanc et Noir'], 'JCBCNO');
  assert.equal(byLabel(forward)['Bleu et Noir'], 'JCBLNO');
  assert.equal(byLabel(forward).Bleu, 'JCBL');
});

test('hash collisions stay order-independent', () => {
  const forward = buildColorVariants(['Cyanx', 'Cyany']);
  const reverse = buildColorVariants(['Cyany', 'Cyanx']);
  const byLabel = (list) => Object.fromEntries(list.map((v) => [v.label, v.skuSuffix]));
  assert.deepEqual(byLabel(forward), byLabel(reverse));
  assert.notEqual(byLabel(forward).Cyanx, byLabel(forward).Cyany);
});

test('normalizes every color listing to the base Tifawt SKU', () => {
  assert.equal(toTifawtSku('ERY-WATCH-10-JCBCNO'), 'WATCH-10');
  assert.equal(toTifawtSku('ER-WATCH-10-JCBLNO'), 'WATCH-10');
  assert.equal(toTifawtSku('ERY-WATCH-10-JCBL'), 'WATCH-10');
  assert.equal(toTifawtSku('WATCH-10-NO'), 'WATCH-10-NO');
  assert.equal(toTifawtSku('ERY-ABC-C31'), 'ABC-C31');
});
