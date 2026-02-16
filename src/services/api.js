import axios from 'axios';

const API_URL = import.meta.env.VITE_NOCODB_URL;
const API_TOKEN = import.meta.env.VITE_NOCODB_API_TOKEN;
const TABLE_ID = import.meta.env.VITE_NOCODB_TABLE_PRODUCTS;

export const fetchProducts = async () => {
    try {
        let allRecords = [];
        let offset = 0;
        let limit = 100;
        let hasMore = true;

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
            allRecords = [...allRecords, ...records];

            if (records.length < limit) {
                hasMore = false;
            } else {
                offset += limit;
            }
        }

        // Category Mapping
        const categoryMapping = {
            1: "Accessories",      // Phone Accessories
            2: "Audio",            // Audio
            3: "Smart Watches",    // Smart Watches
            4: "Gaming",           // Gaming
            5: "Computers",        // Computer & Office
            6: "Car",              // Car Accessories
            7: "Home"              // Home & Gadgets
        };

        // Filter: Only show products where POSTEBL is exactly 'POSTEBL'
        const visibleRecords = allRecords.filter(record => record.POSTEBL === 'POSTEBL');

        // Map fields based on actual NocoDB schema: Title, SKU, price, Image1, Category_ID
        const products = visibleRecords.map(record => {
            const imageObj = record.Image1 && record.Image1.length > 0 ? record.Image1[0] : null;
            let imageUrl = null;
            if (imageObj) {
                imageUrl = imageObj.signedUrl || imageObj.url;
                // Check if thumbnails exist
                if (imageObj.thumbnails) {
                    if (imageObj.thumbnails.card_cover?.signedUrl) {
                        imageUrl = imageObj.thumbnails.card_cover.signedUrl;
                    } else if (imageObj.thumbnails.small?.signedUrl) {
                        imageUrl = imageObj.thumbnails.small.signedUrl;
                    }
                }
            }

            // Resolve Category Name from ID
            const categoryId = record.Category_ID; // Assuming column name is strictly Category_ID
            const categoryName = categoryMapping[categoryId] || "General";

            return {
                id: record.Id || record.id || Math.random().toString(36).substr(2, 9),
                ref: record.SKU || "",
                name: record.Title || "Unnamed Product",
                price: record.price || 0,
                image: imageUrl,
                category: categoryName,
                isAvailable: true, // Always true since we filtered out others
                originalData: record
            };
        });

        return products;

    } catch (error) {
        console.error("Error fetching products:", error);
        return [];
    }
};
