/**
 * Returns 8 products that shift by 1 every 10 minutes.
 * Simple conveyor belt: offset = minutes / 10, wrapping around the full list.
 *
 * @param {Array} products - Full list of products from the store
 * @returns {Array} - 8 products to show right now
 */
export function getRotatingFeatured(products) {
    if (!products || products.length < 1) return [];

    // Offset increments by 1 every 10 minutes
    const offset = Math.floor(Date.now() / (10 * 60 * 1000)) % products.length;

    const result = [];
    for (let i = 0; i < Math.min(8, products.length); i++) {
        result.push(products[(offset + i) % products.length]);
    }
    return result;
}
