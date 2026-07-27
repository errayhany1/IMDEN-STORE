/**
 * Product copy helpers shared by the grid card, quick view and product page.
 * Cards always render the French copy so the grid reads the same for every
 * visitor, while the detail views keep the site-language title.
 */

const ARABIC_RANGE = /[\u0600-\u06FF]/;

export const stripHtml = (html) => {
    if (!html) return '';
    if (typeof document === 'undefined') {
        return String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim();
};

export const listItemsFromHtml = (html, limit = 8) => {
    if (!html) return [];
    if (typeof document === 'undefined') return [];
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return [...tmp.querySelectorAll('li')]
        .map((li) => li.textContent.trim())
        .filter(Boolean)
        .slice(0, limit);
};

/** French title for a product, falling back to its French copy then any title. */
export const frenchProductTitle = (product) => {
    const od = product?.originalData || {};
    const direct = od.French_Title || od.Woo_Title || product?.nameFr || od.Title;
    if (direct && String(direct).trim()) return String(direct).trim();

    const fromCopy = stripHtml(od.short_description_fr || od.description_french);
    if (fromCopy) return fromCopy;

    return String(product?.name || product?.ref || '').trim();
};

/** Rich description HTML, French first so detail views stay consistent. */
export const productDescriptionHtml = (product) => {
    const od = product?.originalData || {};
    return (
        od.description_french
        || od.short_description_fr
        || od.description_arabic
        || od.short_description_ar
        || ''
    );
};

export const isRtlText = (text) => ARABIC_RANGE.test(String(text || ''));

/** Compare two text blobs for near-duplicate marketing copy. */
export const normalizeComparableText = (text) =>
    stripHtml(text)
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, '')
        .replace(/\s+/g, ' ')
        .trim();

export const textsOverlap = (a, b, minLen = 48) => {
    const left = normalizeComparableText(a);
    const right = normalizeComparableText(b);
    if (!left || !right) return false;
    if (left === right) return true;
    const probe = Math.min(minLen, left.length, right.length);
    if (probe < 24) return left === right;
    const slice = left.slice(0, probe);
    return right.includes(slice) || left.includes(right.slice(0, probe));
};

/** Extract image URLs embedded in product description HTML. */
export const imagesFromHtml = (html) => {
    if (!html) return [];
    const urls = [];
    const re = /<img[^>]+src=["']([^"']+)["']/gi;
    let match = re.exec(html);
    while (match) {
        urls.push(match[1]);
        match = re.exec(html);
    }
    return urls;
};

export const normalizeImagePath = (src, siteOrigin = '') => {
    const raw = String(src || '').trim();
    if (!raw) return '';
    try {
        const base = siteOrigin || (typeof window !== 'undefined' ? window.location.origin : 'https://errayhany.com');
        return new URL(raw, base).pathname;
    } catch {
        return raw.split('?')[0];
    }
};

export const isProductShotPath = (src) => /(?:^|\/)(ai-|real-)/i.test(normalizeImagePath(src));

export const isContentInfoImagePath = (src) => /(?:^|\/)(specs-|amazon-)/i.test(normalizeImagePath(src));
