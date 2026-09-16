import assert from 'node:assert/strict';
import test from 'node:test';
import {
    extraCategoryNamesForRecord,
    productMatchesCategory,
    productMatchesFamily,
    productTypeNames,
} from './productCategories.js';

test('phone cooler in Cooling also belongs to Gaming', () => {
    const names = extraCategoryNamesForRecord(
        { Title: 'مبرد هاتف Peltier', SKU: 'ERY-PHONE-COOLER' },
        'Cooling',
    );
    assert.deepEqual(names, ['Gaming']);
});

test('phone cooler in Gaming also belongs to Cooling', () => {
    const names = extraCategoryNamesForRecord(
        { French_Title: 'Refroidisseur telephone semiconductor' },
        'Gaming',
    );
    assert.deepEqual(names, ['Cooling']);
});

test('SKU PHONE-COOLER infers Gaming from Cooling', () => {
    const names = extraCategoryNamesForRecord(
        { Title: 'MEMO CX07', SKU: 'ERY-MEMO-PHONE-COOLER-CX07' },
        'Cooling',
    );
    assert.deepEqual(names, ['Gaming']);
});

test('plain cooling fan is not inferred into Gaming', () => {
    const names = extraCategoryNamesForRecord(
        { Title: 'مروحة تبريد كمبيوتر', SKU: 'ERY-CASE-FAN' },
        'Cooling',
    );
    assert.deepEqual(names, []);
});

test('stored Extra_Categories is kept even without cooler keywords', () => {
    const names = extraCategoryNamesForRecord(
        { Title: 'حامل هاتف', Extra_Categories: '4' },
        'Stands',
    );
    assert.deepEqual(names, ['Gaming']);
});

test('storefront filter matches either category', () => {
    const product = {
        category: 'Cooling',
        baseCategory: 'Cooling',
        extraCategories: ['Gaming'],
        isAvailable: true,
    };
    assert.equal(productMatchesCategory(product, 'Cooling'), true);
    assert.equal(productMatchesCategory(product, 'Gaming'), true);
    assert.equal(productMatchesCategory(product, 'Audio'), false);
    assert.equal(productMatchesCategory(product, 'All'), true);
});

test('family view includes extra category membership', () => {
    const product = {
        category: 'Cooling',
        baseCategory: 'Cooling',
        extraCategories: ['Gaming'],
    };
    assert.equal(productMatchesFamily(product, ['Audio', 'Gaming', 'TV Boxes']), true);
    assert.equal(productMatchesFamily(product, ['Chargers', 'Cables']), false);
});

test('type names ignore Out of Stock display category', () => {
    const product = {
        category: 'Out of Stock',
        baseCategory: 'Cooling',
        originalData: { Arabic_Title: 'مبرد الهاتف', SKU: 'COOL-PHONE' },
        isAvailable: false,
    };
    assert.deepEqual(productTypeNames(product), ['Cooling', 'Gaming']);
    assert.equal(productMatchesCategory(product, 'All'), false);
    assert.equal(productMatchesCategory(product, 'Out of Stock'), true);
});
