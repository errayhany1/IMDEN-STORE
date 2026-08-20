export function shouldShowHomeFeatured({ searchQuery, selectedCategory, selectedFamily } = {}) {
    return !searchQuery && selectedCategory === 'All' && !selectedFamily;
}

/**
 * Returns 8 products that shift by 1 every 10 minutes.
 * Simple conveyor belt: offset = minutes / 10, wrapping around the full list.
 *
 * @param {Array} products - Full list of products from the store
 * @param {number} [now] - Epoch ms, injectable for tests
 * @returns {Array} - 8 products to show right now
 */
export function getRotatingFeatured(products, now = Date.now()) {
    if (!products || products.length < 1) return [];

    // Exclude out of stock products from the featured strip
    const availableProducts = products.filter(p => p.category !== 'Out of Stock');
    
    if (availableProducts.length < 1) return [];

    // Offset increments by 1 every 10 minutes
    const offset = Math.floor(now / (10 * 60 * 1000)) % availableProducts.length;

    const result = [];
    for (let i = 0; i < Math.min(8, availableProducts.length); i++) {
        result.push(availableProducts[(offset + i) % availableProducts.length]);
    }
    return result;
}
