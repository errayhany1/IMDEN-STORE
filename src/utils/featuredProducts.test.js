import test from 'node:test';
import assert from 'node:assert/strict';
import {
    getRotatingFeatured,
    shouldShowHomeFeatured,
} from './featuredProducts.js';
import { excludeProductsById, uniqueProductsById } from './productList.js';

test('shouldShowHomeFeatured is only true on the unfiltered home catalog', () => {
    assert.equal(
        shouldShowHomeFeatured({
            searchQuery: '',
            selectedCategory: 'All',
            selectedFamily: null,
        }),
        true,
    );
    assert.equal(
        shouldShowHomeFeatured({
            searchQuery: 'watch',
            selectedCategory: 'All',
            selectedFamily: null,
        }),
        false,
    );
    assert.equal(
        shouldShowHomeFeatured({
            searchQuery: '',
            selectedCategory: 'Audio',
            selectedFamily: null,
        }),
        false,
    );
    assert.equal(
        shouldShowHomeFeatured({
            searchQuery: '',
            selectedCategory: 'All',
            selectedFamily: 'power',
        }),
        false,
    );
});

test('getRotatingFeatured skips out-of-stock and wraps from a fixed time', () => {
    const products = [
        { id: 1, category: 'Audio' },
        { id: 2, category: 'Out of Stock' },
        { id: 3, category: 'Chargers' },
        { id: 4, category: 'Gaming' },
        { id: 5, category: 'Cables' },
        { id: 6, category: 'Phones' },
        { id: 7, category: 'Lighting' },
        { id: 8, category: 'Stands' },
        { id: 9, category: 'Network' },
        { id: 10, category: 'Cameras' },
    ];
    const featured = getRotatingFeatured(products, 0);
    assert.deepEqual(featured.map((p) => p.id), [1, 3, 4, 5, 6, 7, 8, 9]);
    assert.equal(featured.some((p) => p.category === 'Out of Stock'), false);
});

test('home catalog can drop featured ids so the first page does not repeat them', () => {
    const products = Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        category: 'Audio',
    }));
    const featured = getRotatingFeatured(products, 0);
    const catalog = excludeProductsById(
        uniqueProductsById(products),
        featured.map((p) => p.id),
    );
    const featuredIds = new Set(featured.map((p) => String(p.id)));
    assert.equal(catalog.some((p) => featuredIds.has(String(p.id))), false);
    assert.equal(catalog.length, products.length - featured.length);
});
