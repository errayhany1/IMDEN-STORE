import {
    CATEGORY_BY_ID,
    CATEGORY_ID_BY_NAME,
    CATEGORY_LABEL_AR,
} from '../data/categories.js';

const OUT_OF_STOCK = 'Out of Stock';

/** Phone / laptop coolers belong in Cooling and Gaming at the same time. */
const COOLER_ALSO_GAMING_RE = /مبرد\s*(?:ال)?(?:هاتف|جوال|موبايل|لابتوب|حاسوب)|مروحة\s*(?:ال)?(?:هاتف|جوال|موبايل)|phone\s*(?:cooler|cooling|fan)|cooler\s*(?:for\s*)?(?:phone|smartphone|mobile|laptop)|(?:smart)?phone\s*cool|mobile\s*cool|cooling\s*pad|laptop\s*cool|refroidiss(?:eur)?\s*(?:t[eé]l[eé]|portable)|radiateur\s*(?:t[eé]l[eé]|portable)|ventilateur\s*(?:t[eé]l[eé]|portable)|semiconductor|peltier/i;

const EXTRA_FIELD_KEYS = [
    'Category_ID_2',
    'category_id_2',
    'Extra_Category_ID',
    'extra_category_id',
    'Extra_Categories',
    'extra_categories',
    'Category_Extra',
];

const uniqueNames = (names) => {
    const seen = new Set();
    const out = [];
    for (const name of names) {
        if (!name || name === OUT_OF_STOCK || seen.has(name)) continue;
        seen.add(name);
        out.push(name);
    }
    return out;
};

const recordHaystack = (record = {}) => [
    record.Arabic_Title,
    record.Title,
    record.title,
    record.French_Title,
    record.Woo_Title,
    record.SKU,
    record.sku,
    record.Ref,
].filter(Boolean).join(' ');

export const resolveCategoryName = (value) => {
    if (value == null || value === '') return null;
    if (typeof value === 'number' && CATEGORY_BY_ID[value]) return CATEGORY_BY_ID[value];
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    if (CATEGORY_ID_BY_NAME[trimmed]) return trimmed;
    const asNum = Number(trimmed);
    if (Number.isFinite(asNum) && CATEGORY_BY_ID[asNum]) return CATEGORY_BY_ID[asNum];
    return null;
};

export const parseStoredExtraCategoryNames = (record = {}) => {
    const names = [];
    for (const key of EXTRA_FIELD_KEYS) {
        const raw = record[key];
        if (raw == null || raw === '') continue;
        const parts = Array.isArray(raw) ? raw : String(raw).split(/[,;|]+/);
        for (const part of parts) {
            const name = resolveCategoryName(part);
            if (name) names.push(name);
        }
    }
    return uniqueNames(names);
};

export const inferExtraCategoryNames = (record = {}, primaryName = '') => {
    const hay = recordHaystack(record).replace(/[_-]+/g, ' ');
    if (!COOLER_ALSO_GAMING_RE.test(hay)) return [];
    if (primaryName === 'Cooling') return ['Gaming'];
    if (primaryName === 'Gaming') return ['Cooling'];
    return ['Cooling', 'Gaming'];
};

export const extraCategoryNamesForRecord = (record = {}, primaryName = '') => {
    const stored = parseStoredExtraCategoryNames(record);
    const inferred = inferExtraCategoryNames(record, primaryName);
    return uniqueNames([...stored, ...inferred].filter((name) => name !== primaryName));
};

export const extraCategoryIdFromRecord = (record = {}, primaryId) => {
    const primaryName = CATEGORY_BY_ID[Number(primaryId)] || '';
    const extraName = extraCategoryNamesForRecord(record, primaryName)[0];
    const extraId = extraName ? CATEGORY_ID_BY_NAME[extraName] : 0;
    if (!extraId || extraId === Number(primaryId) || extraId === 15) return 0;
    return extraId;
};

export const productTypeNames = (product = {}) => {
    if (!product) return [];
    const od = product.originalData || {};
    const record = {
        ...od,
        Title: od.Title || od.title || product.name || product.Title,
        Arabic_Title: od.Arabic_Title || product.name,
        French_Title: od.French_Title || od.Woo_Title,
        SKU: od.SKU || product.ref || product.SKU,
        Extra_Categories: od.Extra_Categories || product.Extra_Categories,
        Category_ID_2: od.Category_ID_2 || product.Category_ID_2,
        extra_categories: od.extra_categories || product.extra_categories,
        category_id_2: od.category_id_2 || product.category_id_2,
    };
    const primary = product.baseCategory && product.baseCategory !== OUT_OF_STOCK
        ? product.baseCategory
        : (product.category && product.category !== OUT_OF_STOCK ? product.category : '');
    const extras = Array.isArray(product.extraCategories) && product.extraCategories.length
        ? product.extraCategories
        : extraCategoryNamesForRecord(record, primary);
    return uniqueNames([primary, ...extras]);
};

export const productMatchesCategory = (product, selectedCategory) => {
    if (!selectedCategory || selectedCategory === 'All') {
        return product?.category !== OUT_OF_STOCK && product?.isAvailable !== false;
    }
    if (selectedCategory === OUT_OF_STOCK) {
        return product?.category === OUT_OF_STOCK || product?.isAvailable === false;
    }
    return productTypeNames(product).includes(selectedCategory);
};

export const productMatchesFamily = (product, familyCategories) => {
    if (!Array.isArray(familyCategories) || familyCategories.length === 0) return false;
    return productTypeNames(product).some((name) => familyCategories.includes(name));
};

export const extraCategorySearchText = (product) => productTypeNames(product)
    .flatMap((name) => [name, CATEGORY_LABEL_AR[name] || ''])
    .join(' ')
    .toLowerCase();
