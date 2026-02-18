import axios from 'axios';

const API_URL = import.meta.env.VITE_NOCODB_URL;
const API_TOKEN = import.meta.env.VITE_NOCODB_API_TOKEN;
const TABLE_ID = import.meta.env.VITE_NOCODB_TABLE_PRODUCTS;

export const fetchProducts = async (onChunk) => {
    try {
        let allRecords = [];
        let offset = 0;
        let limit = 50; // Smaller chunk size for faster initial render
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
            12: "Stabilizers"       // الستابليزاتور
        };

        while (hasMore) {
            const url = `${API_URL}/api/v2/tables/${TABLE_ID}/records`;
            const response = await axios.get(url, {
                headers: {
                    "xc-token": API_TOKEN,
                    "accept": "application/json"
                },
                params: {
                    limit: limit,
                    offset: offset
                }
            });

            const data = response.data;
            const records = data.list || [];

            if (records.length === 0) {
                hasMore = false;
                break;
            }

            // Filter: Only show products where POSTEBL is exactly 'POSTEBL'
            const visibleRecords = records.filter(record => record.POSTEBL === 'POSTEBL');

            // Map fields and extract category images
            const mappedChunk = visibleRecords.map(record => {
                const imageObj = record.Image1 && record.Image1.length > 0 ? record.Image1[0] : null;
                let imageUrl = null;
                if (imageObj) {
                    // Always use original high-res image for best quality
                    imageUrl = imageObj.signedUrl || imageObj.url;
                }

                // Resolve Category Name from ID
                const categoryId = record.Category_ID || record.category_id || record.CategoryId || record.categoryId;
                const categoryName = categoryMapping[categoryId] || "General";

                // Extract Category Image if available and not yet found for this category
                const catImgObj = (record.Category_Image || record.category_image) && (record.Category_Image || record.category_image).length > 0
                    ? (record.Category_Image || record.category_image)[0]
                    : null;

                if (catImgObj && !collectedCategoryImages[categoryName]) {
                    collectedCategoryImages[categoryName] = catImgObj.signedUrl || catImgObj.url;
                }

                return {
                    id: record.Id || record.id || Math.random().toString(36).substr(2, 9),
                    ref: record.SKU || "",
                    name: record.Title || "Unnamed Product",
                    price: record.price || 0,
                    image: imageUrl,
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
            }
        }

        return allRecords;

    } catch (error) {
        console.error("Error fetching products:", error);
        return [];
    }
};
