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

        // Filter for available products (POSTEBL) and map data
        const availableProducts = allRecords.filter(record =>
            record.postebl === 'POSTEBL' || record.postebl === true // Robust check for boolean or string
        );

        return availableProducts.map(record => {
            const imageObj = record.Image1 && record.Image1.length > 0 ? record.Image1[0] : null;
            let imageUrl = null;
            if (imageObj) {
                // Prefer signedUrl from user-uploaded data if available, or construct it
                imageUrl = imageObj.signedUrl || imageObj.url;

                // If thumbnails exist, try to use card_cover or small for better performance
                if (imageObj.thumbnails) {
                    if (imageObj.thumbnails.card_cover?.signedUrl) {
                        imageUrl = imageObj.thumbnails.card_cover.signedUrl;
                    } else if (imageObj.thumbnails.small?.signedUrl) {
                        imageUrl = imageObj.thumbnails.small.signedUrl;
                    }
                }
            }

            // Fallback for ID if 'Id' is missing (though it shouldn't be based on schema)
            const id = record.Id || record.id || Math.random().toString(36).substr(2, 9);

            // Map fields based on user request
            // Name -> title
            const name = record.title || "Unnamed Product";

            // Ref -> SKU
            const ref = record.SKU || "";

            // Category (keeping existing logic or fallback)
            const category = record.Woo_Cat_Name || "General";

            return {
                id: id,
                ref: ref,
                name: name,
                price: record.price || 0,
                image: imageUrl,
                category: category,
                originalData: record
            };
        });

    } catch (error) {
        console.error("Error fetching products:", error);
        return [];
    }
};
