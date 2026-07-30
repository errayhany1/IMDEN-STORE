import test from 'node:test';
import assert from 'node:assert/strict';
import { selectStaleProductVariants } from './productVariants.js';

test('marks removed colors stale while keeping current ones', () => {
  const stale = selectStaleProductVariants(
    [
      { Id: 1, Color_Code: 'BL', Jumia_SKU: 'ERY-A-JCBL', Active: 'ACTIVE' },
      { Id: 2, Color_Code: 'BC', Jumia_SKU: 'ERY-A-JCBC', Active: 'ACTIVE' },
      { Id: 3, Color_Code: 'GN', Jumia_SKU: 'ERY-A-JCGN', Active: 'PENDING' },
    ],
    ['BL', 'GN'],
  );
  assert.deepEqual(
    stale.map((row) => ({ code: row.code, jumiaSku: row.jumiaSku })),
    [{ code: 'BC', jumiaSku: 'ERY-A-JCBC' }],
  );
});

test('skips already inactive or error rows', () => {
  const stale = selectStaleProductVariants(
    [
      { Id: 1, Color_Code: 'BL', Jumia_SKU: 'ERY-A-JCBL', Active: 'INACTIVE' },
      { Id: 2, Color_Code: 'BC', Jumia_SKU: 'ERY-A-JCBC', Active: 'ERROR: boom' },
      { Id: 3, Color_Code: 'RD', Jumia_SKU: 'ERY-A-JCRD', Active: 'ACTIVE' },
    ],
    [],
  );
  assert.deepEqual(
    stale.map((row) => row.code),
    ['RD'],
  );
});

test('empty keep list treats every live variant as stale', () => {
  const stale = selectStaleProductVariants(
    [
      { Id: 10, Color_Code: 'bl', Jumia_SKU: 'ery-a-jcbl', Active: 'active' },
    ],
    [],
  );
  assert.equal(stale.length, 1);
  assert.equal(stale[0].code, 'BL');
});

test('extra Amazon link rows survive a color-only regeneration', () => {
  const stale = selectStaleProductVariants(
    [
      { Id: 10, Color_Code: 'BL', Jumia_SKU: 'ERY-A-JCBL', Active: 'ACTIVE' },
      { Id: 11, Color_Code: 'LINK2', Jumia_SKU: 'ERY-A-2', Active: 'ACTIVE' },
      { Id: 12, Color_Code: 'link3', Jumia_SKU: 'ERY-A-3', Active: 'ACTIVE' },
    ],
    [],
  );
  assert.deepEqual(stale.map((row) => row.code), ['BL']);
});
