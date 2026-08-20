/**
 * Keep the first occurrence of each product id.
 * Duplicate ids can appear if a catalog chunk is appended twice or NocoDB
 * returns the same row on overlapping pages.
 */
export function uniqueProductsById(products) {
    const seen = new Set();
    return (products || []).filter((product) => {
        const id = String(product?.id ?? '').trim();
        if (!id) return true;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
    });
}

export function excludeProductsById(products, ids) {
    if (!ids?.length) return products || [];
    const skip = new Set([...ids].map((id) => String(id)));
    return (products || []).filter((product) => !skip.has(String(product?.id)));
}

/**
 * Split the catalog so a full-width banner can sit after 2 rows:
 * 4 cards on mobile, 8 cards on desktop.
 *
 * desktopFirst is rendered twice on purpose (once in the first grid, once
 * after the banner). The first copy MUST be wrapped with `hidden lg:block`
 * and the second section with `lg:hidden` so a given viewport never shows
 * both copies.
 */
export function splitProductsForBanner(products) {
    const list = products || [];
    return {
        mobileFirst: list.slice(0, 4),
        desktopFirst: list.slice(4, 8),
        rest: list.slice(8),
    };
}
