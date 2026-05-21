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

export const fetchProducts = async (onChunk) => {
    try {
        let allRecords = [];
        let offset = 0;
        let limit = 200; // Larger chunk size = fewer requests = less chance of 429
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
                    sort: '-Id'  // أحدث المنتجات أولاً (نفس ترتيب النشر في تلغرام)
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
                    const rawUrl = imageObj.signedUrl || imageObj.url;
                    if (rawUrl) {
                        imageUrl = rawUrl.startsWith('http') ? rawUrl : `${API_URL}/${rawUrl}`;
                    }
                }

                // Extract all images from Image1, Image2, Image3 columns
                const allImages = [];
                ['Image1', 'Image2', 'Image3'].forEach(col => {
                    if (record[col] && record[col].length > 0) {
                        record[col].forEach(img => {
                            const url = img.signedUrl || img.url;
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

                return {
                    id: record.Id || record.id || Math.random().toString(36).substr(2, 9),
                    ref: record.SKU || "",
                    name: record.Title || "",
                    price: record.price || 0,
                    image: imageUrl,
                    images: allImages,
                    category: categoryName,
                    isAvailable: true,
                    originalData: record
                };
            });

            allRecords = [...allRecords, ...mappedChunk];

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

        return allRecords;

    } catch (error) {
        console.error("Error fetching products:", error);
        return [];
    }
};
