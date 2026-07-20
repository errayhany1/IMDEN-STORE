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
                1: "Chargers",          // الشواحن
                2: "Audio",             // السماعات
                3: "Smart Watches",     // ساعة الذكيه والاساور
                4: "Gaming",            // العاب
                5: "Mouse & Keyboard",  // الماوس والكيبورد
                6: "Storage",           // الفلاشه والميموار
                7: "Laptop Chargers",   // شواحن الحواسيب
                8: "Stands",            // السبورات
                9: "Lighting",          // الإضائة
                10: "Cameras",          // الكمرات
                11: "Network",          // الانترنت والشبكة
                12: "General",         // الستابليزاتور → General
                13: "Microphones",      // الميكروفونات
                14: "Batteries & Power Banks", // بطاريات وبنوك الطاقة
                15: "Out of Stock",     // نفد من المخزون
                16: "Cables",           // الكابلات
                17: "Car Accessories",  // إكسسوارات السيارة
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

                    const image1List = asAttachmentList(record.Image1);
                    const imageObj = image1List[0] || null;
                    let imageUrl = null;
                    let originalImageUrl = null;
                    if (imageObj) {
                        // NocoDB's permanent S3 path is private (403). Use the
                        // fresh signed URL only as a fallback when no local image exists.
                        originalImageUrl = resolveAttachmentUrl(imageObj);
                        if (originalImageUrl) {
                            imageUrl = optimizedImages[0]?.full || originalImageUrl;
                        }
                    }

                    // Extract all images from Image1…Image5 columns
                    const allImages = [];
                    let imageIndex = 0;
                    ['Image1', 'Image2', 'Image3', 'Image4', 'Image5'].forEach(col => {
                        asAttachmentList(record[col]).forEach(img => {
                            const originalUrl = resolveAttachmentUrl(img);
                            if (originalUrl) {
                                allImages.push(optimizedImages[imageIndex]?.full || originalUrl);
                                imageIndex++;
                            }
                        });
                    });

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
                        thumbnail: optimizedImages[0]?.thumbnail || imageUrl,
                        images: allImages,
                        originalImage: originalImageUrl,
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

    const image1List = asAttachmentList(record.Image1);
    const imageObj = image1List[0] || null;
    let imageUrl = null;
    let originalImageUrl = null;
    if (imageObj) {
        originalImageUrl = resolveAttachmentUrl(imageObj);
        if (originalImageUrl) {
            imageUrl = optimizedImages[0]?.full || originalImageUrl;
        }
    }

    const allImages = [];
    let imageIndex = 0;
    ['Image1', 'Image2', 'Image3', 'Image4', 'Image5'].forEach((col) => {
        asAttachmentList(record[col]).forEach((img) => {
            const originalUrl = resolveAttachmentUrl(img);
            if (originalUrl) {
                allImages.push(optimizedImages[imageIndex]?.full || originalUrl);
                imageIndex += 1;
            }
        });
    });

    const categoryMapping = {
        1: 'Chargers', 2: 'Audio', 3: 'Smart Watches', 4: 'Gaming',
        5: 'Mouse & Keyboard', 6: 'Storage', 7: 'Laptop Chargers', 8: 'Stands',
        9: 'Lighting', 10: 'Cameras', 11: 'Network', 12: 'General',
        13: 'Microphones', 14: 'Batteries & Power Banks', 15: 'Out of Stock',
        16: 'Cables', 17: 'Car Accessories',
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
        thumbnail: optimizedImages[0]?.thumbnail || imageUrl,
        images: allImages.length ? allImages : (imageUrl ? [imageUrl] : []),
        originalImage: originalImageUrl,
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
        .replace(/^ery-/, '');

export const skusMatch = (a, b) => {
    const left = normalizeSku(a);
    const right = normalizeSku(b);
    if (!left || !right) return false;
    return left === right
        || left === `ery-${right}`
        || right === `ery-${left}`
        || left.includes(right)
        || right.includes(left);
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

