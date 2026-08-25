import test from 'node:test';
import assert from 'node:assert/strict';
import { factsToProductCopy } from './productFacts.js';
import {
  buildEnrichmentCache,
  cacheHasFacts,
  readEnrichmentCache,
  serializeEnrichmentCache,
  sourceHash,
  totalCost,
} from './enrichmentCache.js';

test('local facts templates produce the catalog copy contract', () => {
  const copy = factsToProductCopy({
    brand: 'Acme',
    model: 'X1',
    title_fr: 'Acme X1',
    title_ar: 'أكمي إكس 1',
    uses_fr: ['USB-C', 'Batterie rechargeable'],
    uses_ar: ['يو إس بي سي', 'بطارية قابلة للشحن'],
    packaging_specs: ['5V', 'USB-C'],
    color_variants: ['Noir'],
  }, { name: 'Seller item', ref: 'ERY-X1' });

  assert.equal(copy.french_title, 'Acme X1');
  assert.match(copy.short_description_fr, /<ul>/);
  assert.match(copy.description_arabic, /بطارية/);
  assert.deepEqual(copy.color_variants, ['Noir']);
});

test('cache reuses facts only for identical normalized source and model', () => {
  const hash = sourceHash([Buffer.from('one'), Buffer.from('two')]);
  const cache = buildEnrichmentCache({
    hash,
    model: 'google/gemini-3.1-flash-lite',
    facts: { brand: 'Acme' },
    copy: { french_title: 'Acme' },
    usage: [{ cost: 0.01 }],
  });

  const parsed = readEnrichmentCache(serializeEnrichmentCache(cache));
  assert.equal(cacheHasFacts(parsed, hash, 'google/gemini-3.1-flash-lite'), true);
  assert.equal(cacheHasFacts(parsed, hash, 'another-model'), false);
  assert.equal(totalCost(parsed.usage), 0.01);
});
