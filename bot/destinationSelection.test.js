import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNocoRecordFromEnrichment } from './productEnrichment.js';

function enrichment(overrides = {}) {
  return {
    sellerSku: 'ERY-TEST-1',
    copy: null,
    nocoImages: [],
    ...overrides,
  };
}

test('keeps a Jumia-only technical record hidden from the storefront', () => {
  const record = buildNocoRecordFromEnrichment({
    price: 100,
    name: 'Test',
    enrichment: enrichment({ nocoPostebl: 'PAUSED', catalogPublished: false }),
  });
  assert.equal(record.POSTEBL, 'PAUSED');
});

test('publishes a selected NocoDB catalog record normally', () => {
  const record = buildNocoRecordFromEnrichment({
    price: 100,
    name: 'Test',
    enrichment: enrichment({ nocoPostebl: 'POSTEBL', catalogPublished: true }),
  });
  assert.equal(record.POSTEBL, 'POSTEBL');
});
