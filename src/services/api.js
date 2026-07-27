import axios from 'axios';

const API_URL = import.meta.env.VITE_NOCODB_URL;
const API_TOKEN = import.meta.env.VITE_NOCODB_API_TOKEN;
const TABLE_ID = import.meta.env.VITE_NOCODB_TABLE_PRODUCTS;

let staticCatalogPromise = null;
let localImageManifestPromise = null;

const fetchJsonFallback = async (url, fallback) => {
    try {
        const response = await fetch(url);
        return response.ok ? await response.json() : fallback;
    } catch {
        return fallback;
    }
};

const getStaticCatalog = () => {
    if (!staticCatalogPromise) {
        staticCatalogPromise = fetchJsonFallback('/catalog-cache.json', null);
    }
    return staticCatalogPromise;
};

const getLocalImageManifest = () => {
    if (!localImageManifestPromise) {
        localImageManifestPromise = fetchJsonFallback(
            '/product-images-manifest.json',
            { products: {} }
        );
    }
    return localImageManifestPromise;
};

// Helper: delay between requests to avoid 429 rate limiting
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * NocoDB attachment columns are usually arrays of file objects, but some
 * rows (bot/sheets/manual edits) store a plain URL string or a single object.
 * Treating those as arrays caused: "…forEach is not a function" and aborted
 * the entire live catalog refresh — so new products never reached /p/{sku}.
 */
const asAttachmentList = (value) => {
    if (value == null || value === '') return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed ? [{ url: trimmed }] : [];
    }
    if (typeof value === 'object' && (value.url || value.signedUrl || value.path)) {
        return [value];
    }
    return [];
};

const attachmentRawUrl = (img) => {
    if (!img) return null;
    if (typeof img === 'string') {
        const trimmed = img.trim();
        return trimmed || null;
    }
    return img.signedUrl || img.url || null;
};

const resolveAttachmentUrl = (img) => {
    const rawUrl = attachmentRawUrl(img);
    if (!rawUrl) return null;
    return rawUrl.startsWith('http') ? rawUrl : `${API_URL}/${rawUrl}`;
};

const PRIMARY_IMAGE_MODE_KEY = 'ery_primary_image_mode';

export const getPrimaryImageMode = () => {
    try {
        const mode = localStorage.getItem(PRIMARY_IMAGE_MODE_KEY);
        if (mode === 'amazon' || mode === 'original' || mode === 'ai') return mode;
    } catch { /* ignore */ }
    return 'ai';
};

export const setPrimaryImageModeStorage = (mode) => {
    const next = mode === 'amazon' || mode === 'original' || mode === 'ai' ? mode : 'ai';
    try {
        localStorage.setItem(PRIMARY_IMAGE_MODE_KEY, next);
    } catch { /* ignore */ }
    return next;
};

/** Classify NocoDB attachment by upload filename prefix (ai- / amazon- / real-). */
export const classifyAttachmentSource = (img) => {
    const hay = `${img?.title || ''} ${img?.path || ''} ${img?.url || ''} ${img?.signedUrl || ''}`.toLowerCase();
    if (hay.includes('amazon-') || hay.includes('/amazon-')) return 'amazon';
    if (hay.includes('real-') || hay.includes('/real-')) return 'original';
    if (/(^|\/|_)ai-/.test(hay) || hay.includes('/ai-') || hay.includes('ai-')) return 'ai';
    return 'unknown';
};

/** Stable key so build-time optimized images are used only when they still match NocoDB. */
export const normalizeAttachmentKey = (src) => {
    const raw = String(src || '').split('?')[0].trim();
    if (!raw) return '';
    try {
        const file = decodeURIComponent(new URL(raw, 'https://errayhany.com').pathname.split('/').pop() || '');
        // NocoDB adds a short suffix: ai-SKU-1_YV1Qk.jpg → ai-sku-1
        return file
            .replace(/_[A-Za-z0-9-]{3,12}(?=\.[A-Za-z0-9]+$)/, '')
            .replace(/\.[A-Za-z0-9]+$/, '')
            .toLowerCase();
    } catch {
        return raw.toLowerCase();
    }
};

/**
 * Build tagged image source lists from Image1…Image5 attachments.
 * Fallback for legacy products: treat Image1 as ai, last filled as original.
 */
export const buildImageSourcesFromRecord = (record, localOptimized = []) => {
    const sources = { ai: [], amazon: [], original: [], unknown: [] };
    let imageIndex = 0;
    const allUrls = [];

    ['Image1', 'Image2', 'Image3', 'Image4', 'Image5'].forEach((col) => {
        asAttachmentList(record[col]).forEach((img) => {
            const originalUrl = resolveAttachmentUrl(img);
            if (!originalUrl) return;
            const opt = localOptimized[imageIndex];
            const optMatches = Boolean(
                opt?.full
                && opt?.original
                && normalizeAttachmentKey(opt.original) === normalizeAttachmentKey(originalUrl)
            );
            // Prefer optimized CDN only when it is still the same file as NocoDB.
            // After Telegram re-enrich, slots change (ai-/real-) and must not keep stale webps.
            const url = optMatches ? opt.full : originalUrl;
            const thumb = optMatches ? (opt.thumbnail || opt.full) : url;
            imageIndex += 1;
            const kind = classifyAttachmentSource(img);
            sources[kind].push({ url, thumbnail: thumb });
            allUrls.push({ url, thumbnail: thumb, kind });
        });
    });

    // Legacy fallback: no tagged filenames → Image1 ~ AI, last slot ~ original
    if (!sources.ai.length && !sources.amazon.length && !sources.original.length && allUrls.length) {
        sources.ai = [allUrls[0]];
        sources.original = [allUrls[allUrls.length - 1]];
        if (allUrls.length > 2) {
            sources.amazon = allUrls.slice(1, -1);
        }
    } else if (!sources.original.length && allUrls.length) {
        sources.original = [allUrls[allUrls.length - 1]];
    }

    return {
        ai: sources.ai.map((x) => x.url),
        amazon: sources.amazon.map((x) => x.url),
        original: sources.original[0]?.url || null,
        all: allUrls.map((x) => x.url),
        thumbnails: {
            ai: sources.ai[0]?.thumbnail || null,
            amazon: sources.amazon[0]?.thumbnail || null,
            original: sources.original[0]?.thumbnail || null,
        },
    };
};

export const pickPrimaryFromSources = (imageSources, mode = getPrimaryImageMode()) => {
    const order = mode === 'original'
        ? ['original', 'ai', 'amazon']
        : mode === 'amazon'
            ? ['amazon', 'ai', 'original']
            : ['ai', 'amazon', 'original'];

    for (const key of order) {
        if (key === 'original') {
            if (imageSources?.original) {
                return {
                    url: imageSources.original,
                    thumbnail: imageSources.thumbnails?.original || imageSources.original,
                };
            }
            continue;
        }
        const list = imageSources?.[key];
        if (Array.isArray(list) && list[0]) {
            return {
                url: list[0],
                thumbnail: imageSources.thumbnails?.[key] || list[0],
            };
        }
    }
    const fallback = imageSources?.all?.[0] || null;
    return { url: fallback, thumbnail: fallback };
};

/** Remap a product's display image fields for a new primary mode. */
export const applyPrimaryImageMode = (product, mode = getPrimaryImageMode()) => {
    if (!product) return product;
    const sources = product.imageSources || {
        ai: [],
        amazon: [],
        original: product.originalImage || null,
        all: product.images || (product.image ? [product.image] : []),
        thumbnails: {},
    };
    const picked = pickPrimaryFromSources(sources, mode);
    return {
        ...product,
        image: picked.url || product.image,
        thumbnail: picked.thumbnail || product.thumbnail || picked.url || product.image,
        imageSources: sources,
    };
};

// Helper: retry a request with exponential backoff on 429 errors
const fetchWithRetry = async (url, options, maxRetries = 3) => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await axios.get(url, options);
        } catch (err) {
            if (err.response && err.response.status === 429 && attempt < maxRetries) {
                const waitTime = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
                console.warn(`NocoDB rate limited (429). Retrying in ${waitTime / 1000}s...`);
                await delay(waitTime);
            } else {
                throw err;
            }
        }
    }
};

// In-memory cache to prevent duplicate concurrent requests and NocoDB rate-limiting
const cache = {
    products: [],
    categoryImages: {},
    isFetched: false,
    fetchPromise: null
};

export const fetchProducts = async (onChunk, forceRefresh = false) => {
    if (forceRefresh) {
        cache.isFetched = false;
        cache.products = [];
        cache.categoryImages = {};
        cache.fetchPromise = null;
    }

    // 1. If already fully fetched, return instantly from cache
    if (cache.isFetched) {
        if (onChunk) {
            onChunk(cache.products, cache.categoryImages);
        }
        return cache.products;
    }

    // 2. If a fetch is currently in progress, wait for it and trigger callback
    if (cache.fetchPromise) {
        const result = await cache.fetchPromise;
        if (onChunk) {
            // Only send the entire set as one chunk to avoid rendering empty states
            onChunk(cache.products, cache.categoryImages);
        }
        return result;
    }

    // 3. Show the same-origin build snapshot immediately. NocoDB is refreshed
    // in the background, so first-time visitors do not wait before seeing images.
    const staticCatalog = await getStaticCatalog();
    const hasStaticCatalog = Boolean(staticCatalog?.products?.length);
    if (hasStaticCatalog && onChunk) {
        onChunk(
            staticCatalog.products,
            staticCatalog.categoryImages || {},
            { replace: true, source: 'static-cache' }
        );
    }

    // 4. Refresh from NocoDB in the background
    const performFetch = async () => {
        try {
            let allRecords = [];
            let offset = 0;
            let limit = 100;
            let hasMore = true;
            let collectedCategoryImages = {};
            const localImageManifest = await getLocalImageManifest();
            const localImagesByProduct = localImageManifest.products || {};

            // Category Mapping
            const categoryMapping = {
                1: "Chargers",                 // الشواحن
                2: "Audio",                    // السماعات
                3: "Smart Watches",            // ساعة الذكيه والاساور
                4: "Gaming",                   // العاب
                5: "Mouse & Keyboard",         // الماوس والكيبورد
                6: "Storage",                  // الفلاشه والميموار
                7: "Laptop Chargers",          // شواحن الحواسيب
                8: "Stands",                   // الحوامل والستاندات
                9: "Lighting",                 // الإضائة
                10: "Cameras",                 // الكمرات
                11: "Network",                 // الانترنت والشبكة
                12: "General",                 // أخرى
                13: "Microphones",             // الميكروفونات
                14: "Batteries & Power Banks", // بطاريات وبنوك الطاقة
                15: "Out of Stock",            // نفد من المخزون
                16: "Cables",                  // الكابلات
                17: "Car Accessories",         // إكسسوارات السيارة
                18: "Adapters & Hubs",         // محولات وHUB
                19: "TV Boxes",                // أجهزة بث
                20: "Cooling",                 // تبريد
                21: "Phones",                  // هواتف
            };

            while (hasMore) {
                const url = `${API_URL}/api/v2/tables/${TABLE_ID}/records`;
                const response = await fetchWithRetry(url, {
                    headers: {
                        "xc-token": API_TOKEN,
                        "accept": "application/json"
                    },
                    params: {
                        limit: limit,
                        offset: offset,
                        sort: '-Id'  // أحدث المنتجات أولاً
                    }
                });

                const data = response.data;
                const records = data.list || [];

                if (records.length === 0) {
                    hasMore = false;
                    break;
                }

                // On the first page of a live refresh, drop any partial cache from a
                // previous failed attempt so we do not accumulate duplicates.
                if (offset === 0) {
                    cache.products = [];
                }

                // Filter: Show POSTEBL and NO POSTEBL
                const visibleRecords = records.filter(record => record.POSTEBL === 'POSTEBL' || record.POSTEBL === 'NO POSTEBL');

                // Map fields and extract category images
                const mappedChunk = visibleRecords.map(record => {
                    const isOutOfStock = record.POSTEBL === 'NO POSTEBL';
                    const recordId = String(record.Id || record.id || '');
                    const optimizedImages = localImagesByProduct[recordId]?.images || [];

                    const imageSources = buildImageSourcesFromRecord(record, optimizedImages);
                    const primary = pickPrimaryFromSources(imageSources);
                    const imageUrl = primary.url;
                    const originalImageUrl = imageSources.original || imageSources.all[imageSources.all.length - 1] || null;
                    const allImages = imageSources.all.length
                        ? imageSources.all
                        : (imageUrl ? [imageUrl] : []);

                    // Resolve Category Name from ID
                    let categoryId = record.Category_ID || record.category_id || record.CategoryId || record.categoryId;
                    if (isOutOfStock) {
                        categoryId = 15; // Force to Out of Stock category
                    }
                    const categoryName = categoryMapping[categoryId] || "General";
                    const originalCategoryId = record.Category_ID || record.category_id || record.CategoryId || record.categoryId;
                    const baseCategory = categoryMapping[originalCategoryId] || "General";

                    // Extract Category Image if available and not yet found for this category
                    const catImgObj = asAttachmentList(
                        record.Category_Image || record.category_image
                    )[0] || null;

                    if (catImgObj && !collectedCategoryImages[categoryName]) {
                        collectedCategoryImages[categoryName] =
                            attachmentRawUrl(catImgObj);
                    }

                    // Extract "All" category image from the new Category_ID1 column
                    const allImgObj = asAttachmentList(record.Category_ID1)[0] || null;

                    if (allImgObj && !collectedCategoryImages['All']) {
                        collectedCategoryImages['All'] = attachmentRawUrl(allImgObj);
                    }

                    let siteLang = 'ar';
                    try {
                        siteLang = localStorage.getItem('site_lang') === 'fr' ? 'fr' : 'ar';
                    } catch { /* ignore */ }

                    const fallbackName = siteLang === 'fr'
                        ? (record.French_Title || record.Woo_Title || record.Title || record.Arabic_Title || record.SKU || "")
                        : (record.Arabic_Title || record.Title || record.Woo_Title || record.French_Title || record.SKU || "");

                    return {
                        id: record.Id || record.id || Math.random().toString(36).substr(2, 9),
                        ref: record.SKU || "",
                        name: fallbackName,
                        price: record.price || 0,
                        image: imageUrl,
                        thumbnail: primary.thumbnail || imageUrl,
                        images: allImages,
                        originalImage: originalImageUrl,
                        imageSources,
                        amazonUrl: record.Amazon_URL || record.amazon_url || '',
                        category: categoryName,
                        baseCategory,
                        isAvailable: !isOutOfStock,
                        originalData: record
                    };
                });

                allRecords = [...allRecords, ...mappedChunk];
                cache.products = [...cache.products, ...mappedChunk];
                Object.assign(cache.categoryImages, collectedCategoryImages);

                // When a static catalog was shown, avoid mixing duplicate/stale
                // chunks. Replace it once the complete live catalog is ready.
                if (onChunk && !hasStaticCatalog) {
                    onChunk(mappedChunk, collectedCategoryImages);
                }

                if (records.length < limit) {
                    hasMore = false;
                } else {
                    offset += limit;
                    // Small delay between pages to avoid rate limiting
                    await delay(300);
                }
            }

            cache.isFetched = true;
            cache.fetchPromise = null;
            if (onChunk && hasStaticCatalog) {
                onChunk(
                    allRecords,
                    collectedCategoryImages,
                    { replace: true, source: 'live' }
                );
            }
            return allRecords;

        } catch (error) {
            console.error("Error fetching products:", error);
            cache.fetchPromise = null;
            // Do not mark isFetched — allow a later retry. Still return whatever
            // we already have so callers (landing page) are not left empty.
            if (cache.products.length) {
                return cache.products;
            }
            if (hasStaticCatalog) {
                cache.products = staticCatalog.products;
                cache.categoryImages = staticCatalog.categoryImages || {};
                return cache.products;
            }
            return [];
        }
    };

    cache.fetchPromise = performFetch();
    return cache.fetchPromise;
};

const mapNocoRecordToProduct = (record, localImagesByProduct = {}) => {
    const isOutOfStock = record.POSTEBL === 'NO POSTEBL';
    const recordId = String(record.Id || record.id || '');
    const optimizedImages = localImagesByProduct[recordId]?.images || [];

    const imageSources = buildImageSourcesFromRecord(record, optimizedImages);
    const primary = pickPrimaryFromSources(imageSources);
    const imageUrl = primary.url;
    const originalImageUrl = imageSources.original || imageSources.all[imageSources.all.length - 1] || null;
    const allImages = imageSources.all.length
        ? imageSources.all
        : (imageUrl ? [imageUrl] : []);

    const categoryMapping = {
        1: 'Chargers', 2: 'Audio', 3: 'Smart Watches', 4: 'Gaming',
        5: 'Mouse & Keyboard', 6: 'Storage', 7: 'Laptop Chargers', 8: 'Stands',
        9: 'Lighting', 10: 'Cameras', 11: 'Network', 12: 'General',
        13: 'Microphones', 14: 'Batteries & Power Banks', 15: 'Out of Stock',
        16: 'Cables', 17: 'Car Accessories', 18: 'Adapters & Hubs',
        19: 'TV Boxes', 20: 'Cooling', 21: 'Phones',
    };

    let categoryId = record.Category_ID || record.category_id || record.CategoryId || record.categoryId;
    if (isOutOfStock) categoryId = 15;
    const categoryName = categoryMapping[categoryId] || 'General';
    const originalCategoryId = record.Category_ID || record.category_id || record.CategoryId || record.categoryId;
    const baseCategory = categoryMapping[originalCategoryId] || 'General';

    let siteLang = 'ar';
    try {
        siteLang = localStorage.getItem('site_lang') === 'fr' ? 'fr' : 'ar';
    } catch { /* ignore */ }

    const fallbackName = siteLang === 'fr'
        ? (record.French_Title || record.Woo_Title || record.Title || record.Arabic_Title || record.SKU || '')
        : (record.Arabic_Title || record.Title || record.Woo_Title || record.French_Title || record.SKU || '');

    return {
        id: record.Id || record.id || Math.random().toString(36).substr(2, 9),
        ref: record.SKU || '',
        name: fallbackName,
        price: record.price || 0,
        image: imageUrl,
        thumbnail: primary.thumbnail || imageUrl,
        images: allImages.length ? allImages : (imageUrl ? [imageUrl] : []),
        originalImage: originalImageUrl,
        imageSources,
        amazonUrl: record.Amazon_URL || record.amazon_url || '',
        category: categoryName,
        baseCategory,
        isAvailable: !isOutOfStock,
        originalData: record,
    };
};

/** Normalize SKUs for comparison (spaces, ERY- prefix, encoding). */
export const normalizeSku = (value) =>
    String(value || '')
        .trim()
        .replace(/\+/g, ' ')
        .toLowerCase()
        .replace(/^ery-/, '')
        // Collapse any run of separators/spaces to a single dash so
        // "ps3 sony" and "ps3-sony" compare equal.
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

// Exact match only. Substring matching used to make short references
// (e.g. "1", "ps3") collide with unrelated products, so opening a card
// could load a completely different item.
export const skusMatch = (a, b) => {
    const left = normalizeSku(a);
    const right = normalizeSku(b);
    if (!left || !right) return false;
    return left === right;
};

/**
 * Fetch a single product by SKU for landing pages.
 * Tries exact SKU, then ERY- prefixed variant.
 */
export const fetchProductBySku = async (rawSku) => {
    if (!API_URL || !API_TOKEN || !TABLE_ID || !rawSku) return null;

    let sku = rawSku;
    try {
        sku = decodeURIComponent(String(rawSku).trim());
    } catch {
        sku = String(rawSku).trim();
    }

    const candidates = Array.from(new Set([
        sku,
        sku.toUpperCase(),
        sku.startsWith('ERY-') ? sku : `ERY-${sku}`,
        sku.startsWith('ERY-') ? sku.slice(4) : sku,
    ].filter(Boolean)));

    const localImageManifest = await getLocalImageManifest();
    const localImagesByProduct = localImageManifest.products || {};

    for (const candidate of candidates) {
        try {
            const url = `${API_URL}/api/v2/tables/${TABLE_ID}/records`;
            const response = await fetchWithRetry(url, {
                headers: {
                    'xc-token': API_TOKEN,
                    accept: 'application/json',
                },
                params: {
                    limit: 5,
                    where: `(SKU,eq,${candidate})`,
                },
            });
            const list = response.data?.list || [];
            if (list.length) {
                return mapNocoRecordToProduct(list[0], localImagesByProduct);
            }
        } catch (error) {
            console.warn('fetchProductBySku failed for', candidate, error?.message || error);
        }
    }

    // Fallback: recent records scan (SKU filters can be picky with spaces/accents)
    try {
        const url = `${API_URL}/api/v2/tables/${TABLE_ID}/records`;
        const response = await fetchWithRetry(url, {
            headers: {
                'xc-token': API_TOKEN,
                accept: 'application/json',
            },
            params: {
                limit: 100,
                sort: '-Id',
            },
        });
        const list = response.data?.list || [];
        const hit = list.find((record) => skusMatch(record.SKU, sku));
        if (hit) return mapNocoRecordToProduct(hit, localImagesByProduct);
    } catch (error) {
        console.error('fetchProductBySku fallback failed:', error);
    }

    return null;
};

