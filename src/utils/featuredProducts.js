/**
 * Returns 8 diverse featured products that rotate every hour.
 * - Deterministic rotation based on current hour (consistent for all users)
 * - At most 2 products per category (ensures diversity)
 * - Products without a category ("General") are included in rotation
 *
 * @param {Array} products - Full list of products from the store
 * @returns {Array} - 8 products to feature this hour
 */
export function getHourlyFeatured(products) {
    if (!products || products.length === 0) return [];

    // Seed = current hour since epoch
    const hourSeed = Math.floor(Date.now() / (1000 * 60 * 60));

    // Group products by category
    const byCategory = {};
    products.forEach(p => {
        const cat = p.category || 'General';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(p);
    });

    // For each category, sort by a deterministic (but hour-varying) order
    const categoryKeys = Object.keys(byCategory);

    // Build a pool: from each category pick up to 2 products using hour offset
    const pool = [];
    categoryKeys.forEach((cat, catIndex) => {
        const items = byCategory[cat];
        const offset = (hourSeed + catIndex * 7) % items.length;
        // Pick 2 products starting from offset (wrap around)
        for (let i = 0; i < Math.min(2, items.length); i++) {
            pool.push(items[(offset + i) % items.length]);
        }
    });

    // Shuffle pool using the hour seed (Fisher-Yates with seeded index)
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = (hourSeed * (i + 1) * 2654435761) % (i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Return first 8
    return shuffled.slice(0, 8);
}

/**
 * Returns products added today (based on CreatedAt field from NocoDB).
 * @param {Array} products - Full product list
 * @returns {Array}
 */
export function getTodayNewProducts(products) {
    if (!products || products.length === 0) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return products.filter(p => {
        const raw = p.originalData;
        if (!raw) return false;
        const createdStr = raw.CreatedAt || raw.created_at || raw.createdAt;
        if (!createdStr) return false;
        const created = new Date(createdStr);
        return created >= today;
    });
}
