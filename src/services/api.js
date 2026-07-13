import axios from 'axios';

const API_URL = import.meta.env.VITE_NOCODB_URL;
const API_TOKEN = import.meta.env.VITE_NOCODB_API_TOKEN;
const TABLE_ID = import.meta.env.VITE_NOCODB_TABLE_PRODUCTS;

// Helper: delay between requests to avoid 429 rate limiting
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

    // 3. Otherwise, start a new fetch operation
    const performFetch = async () => {
        try {
            let allRecords = [];
            let offset = 0;
            let limit = 100;
            let hasMore = true;
            let collectedCategoryImages = {};

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
                15: "Out of Stock"      // نفد من المخزون
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

                // Filter: Show POSTEBL and NO POSTEBL
                const visibleRecords = records.filter(record => record.POSTEBL === 'POSTEBL' || record.POSTEBL === 'NO POSTEBL');

                // Map fields and extract category images
                const mappedChunk = visibleRecords.map(record => {
                    const isOutOfStock = record.POSTEBL === 'NO POSTEBL';
                    
                    const imageObj = record.Image1 && record.Image1.length > 0 ? record.Image1[0] : null;
                    let imageUrl = null;
                    if (imageObj) {
                        // Prefer permanent url when present; signedUrl expires (hurts image SEO/cache)
                        const rawUrl = imageObj.url || imageObj.signedUrl;
                        if (rawUrl) {
                            imageUrl = rawUrl.startsWith('http') ? rawUrl : `${API_URL}/${rawUrl}`;
                        }
                    }

                    // Extract all images from Image1, Image2, Image3 columns
                    const allImages = [];
                    ['Image1', 'Image2', 'Image3'].forEach(col => {
                        if (record[col] && record[col].length > 0) {
                            record[col].forEach(img => {
                                const url = img.url || img.signedUrl;
                                if (url) {
                                    allImages.push(url.startsWith('http') ? url : `${API_URL}/${url}`);
                                }
                            });
                        }
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
                    const catImgObj = (record.Category_Image || record.category_image) && (record.Category_Image || record.category_image).length > 0
                        ? (record.Category_Image || record.category_image)[0]
                        : null;

                    if (catImgObj && !collectedCategoryImages[categoryName]) {
                        collectedCategoryImages[categoryName] = catImgObj.signedUrl || catImgObj.url;
                    }

                    // Extract "All" category image from the new Category_ID1 column
                    const allImgObj = record.Category_ID1 && record.Category_ID1.length > 0
                        ? record.Category_ID1[0]
                        : null;

                    if (allImgObj && !collectedCategoryImages['All']) {
                        collectedCategoryImages['All'] = allImgObj.signedUrl || allImgObj.url;
                    }

                    const fallbackName = record.Title || record.Arabic_Title || record.Woo_Title || record.French_Title || record.SKU || "";

                    return {
                        id: record.Id || record.id || Math.random().toString(36).substr(2, 9),
                        ref: record.SKU || "",
                        name: fallbackName,
                        price: record.price || 0,
                        image: imageUrl,
                        images: allImages,
                        category: categoryName,
                        baseCategory,
                        isAvailable: !isOutOfStock,
                        originalData: record
                    };
                });

                allRecords = [...allRecords, ...mappedChunk];
                cache.products = [...cache.products, ...mappedChunk];
                Object.assign(cache.categoryImages, collectedCategoryImages);

                // Send chunk to UI immediately
                if (onChunk) {
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
            return allRecords;

        } catch (error) {
            console.error("Error fetching products:", error);
            cache.fetchPromise = null;
            return [];
        }
    };

    cache.fetchPromise = performFetch();
    return cache.fetchPromise;
};

