import test from 'node:test';
import assert from 'node:assert/strict';
import {
    uniqueProductsById,
    excludeProductsById,
    splitProductsForBanner,
} from './productList.js';

test('uniqueProductsById keeps the first copy of a repeated id', () => {
    const products = [
        { id: 1, name: 'A' },
        { id: '1', name: 'A duplicate' },
        { id: 2, name: 'B' },
        { id: 2, name: 'B duplicate' },
    ];
    assert.deepEqual(
        uniqueProductsById(products).map((p) => p.name),
        ['A', 'B'],
    );
});

test('excludeProductsById removes featured ids from the catalog list', () => {
    const catalog = [
        { id: 'a' },
        { id: 'b' },
        { id: 'c' },
        { id: 'd' },
    ];
    assert.deepEqual(
        excludeProductsById(catalog, ['b', 'c']).map((p) => p.id),
        ['a', 'd'],
    );
});

test('splitProductsForBanner keeps first-page slices disjoint', () => {
    const products = Array.from({ length: 12 }, (_, i) => ({ id: i + 1 }));
    const { mobileFirst, desktopFirst, rest } = splitProductsForBanner(products);

    assert.deepEqual(mobileFirst.map((p) => p.id), [1, 2, 3, 4]);
    assert.deepEqual(desktopFirst.map((p) => p.id), [5, 6, 7, 8]);
    assert.deepEqual(rest.map((p) => p.id), [9, 10, 11, 12]);

    const ids = [...mobileFirst, ...desktopFirst, ...rest].map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length);
});
