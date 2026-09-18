import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNocoRecordFromEnrichment, orderGalleryUploads } from './productEnrichment.js';

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

test('does not overwrite Category_ID during AI patch', () => {
  const record = buildNocoRecordFromEnrichment({
    price: 100,
    name: 'Test',
    enrichment: enrichment({ nocoPostebl: 'POSTEBL' }),
  });
  assert.equal(record.Category_ID, undefined);
});

test('sets default Category_ID only on initial create', () => {
  const record = buildNocoRecordFromEnrichment({
    price: 100,
    name: 'Test',
    enrichment: enrichment({ includeCategory: true, categoryId: 2 }),
  });
  assert.equal(record.Category_ID, 2);
});

test('gallery prefers Amazon then original photos and ignores generated slots', () => {
  const amazon = [{ title: 'amz.jpg' }];
  const real = [{ title: 'orig.jpg' }, { title: 'orig2.jpg' }];
  const ordered = orderGalleryUploads({
    aiUploads: [{ title: 'ai.jpg' }],
    cutoutUploads: [{ title: 'cut.jpg' }],
    amazonUploads: amazon,
    realUploads: real,
  });
  assert.deepEqual(ordered, amazon);
  assert.deepEqual(
    orderGalleryUploads({ realUploads: real }),
    real,
  );
});
