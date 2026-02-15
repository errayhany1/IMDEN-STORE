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

        // Map fields based on actual NocoDB schema: Title, SKU, price, Image1
        const products = allRecords.map(record => {
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

            return {
                id: record.Id || record.id || Math.random().toString(36).substr(2, 9),
                ref: record.SKU || "",
                name: record.Title || "Unnamed Product", // Changed from record.name/title to record.Title
                price: record.price || 0,
                image: imageUrl,
                category: record.Woo_Cat_Name || "General",
                isAvailable: true, // Default to true as 'postebl' column might be missing, or we map it if exists
                originalData: record
            };
        });

        return products;

    } catch (error) {
        console.error("Error fetching products:", error);
        return [];
    }
};
