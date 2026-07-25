/**
 * Amazon product scrape via Apify (same actor as the n8n workflow).
 * Token must come from env — never hardcode.
 */
import axios from 'axios';

const DEFAULT_ACT = 'junglee~free-amazon-product-scraper';

export function isApifyConfigured() {
  return Boolean(process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN);
}

function apifyToken() {
  return process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN || '';
}

function amazonActId() {
  return process.env.APIFY_AMAZON_ACT || DEFAULT_ACT;
}

/**
 * Normalize Amazon product URLs to a stable /dp/ASIN form.
 * Keeps scrape reliable when captions include tracking params (?th=1, ref=, etc.).
 */
export function normalizeAmazonUrl(rawUrl) {
  const raw = String(rawUrl || '').trim().replace(/[)\]>,.'"]+$/g, '');
  if (!raw) return '';
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, '');
    if (!/amazon\./i.test(host)) return raw;

    const asinMatch = u.pathname.match(/\/(?:dp|gp\/product|product)\/([A-Z0-9]{10})/i)
      || u.pathname.match(/\/([A-Z0-9]{10})(?:[/?]|$)/i);
    if (asinMatch?.[1]) {
      const tld = host.includes('amazon.') ? host.split('amazon.')[1] : 'com';
      return `https://www.amazon.${tld}/dp/${asinMatch[1].toUpperCase()}`;
    }
    return `${u.origin}${u.pathname}`;
  } catch {
    return raw;
  }
}

/**
 * @param {string} amazonUrl
 * @returns {Promise<{
 *   title: string,
 *   description: string,
 *   features: string[],
 *   asin: string,
 *   url: string,
 *   imageUrls: string[],
 * }>}
 */
export async function scrapeAmazonProduct(amazonUrl) {
  const token = apifyToken();
  if (!token) {
    throw new Error('APIFY_TOKEN missing');
  }
  if (!amazonUrl) {
    throw new Error('Amazon URL missing');
  }

  const cleanUrl = normalizeAmazonUrl(amazonUrl);
  const act = amazonActId();
  const endpoint = `https://api.apify.com/v2/acts/${encodeURIComponent(act)}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;

  const { data } = await axios.post(
    endpoint,
    {
      categoryUrls: [{ url: cleanUrl }],
      maxItemsPerStartUrl: 1,
      maxSearchPagesPerStartUrl: 1,
      ensureLoadedProductDescriptionFields: true,
      scrapeProductDetails: true,
      scrapeProductVariantPrices: false,
      useCaptchaSolver: false,
    },
    { timeout: Number(process.env.APIFY_TIMEOUT_MS || 180000) }
  );

  const item = Array.isArray(data) ? data[0] : data;
  if (!item) {
    throw new Error(`Apify returned no Amazon product items for ${cleanUrl}`);
  }

  // Actor sometimes returns an error object instead of a product
  if (item.error || item.errorMessage) {
    throw new Error(`Apify Amazon error: ${item.error || item.errorMessage}`);
  }

  const highRes = Array.isArray(item.highResolutionImages)
    ? item.highResolutionImages
    : [];
  const gallery = Array.isArray(item.galleryThumbnails)
    ? item.galleryThumbnails
    : [];
  const imagesFromField = Array.isArray(item.images) ? item.images : [];
  const imageUrls = [...highRes, ...gallery, ...imagesFromField]
    .map((u) => {
      if (typeof u === 'string') return u.trim();
      if (u && typeof u === 'object') return String(u.url || u.hiRes || u.large || '').trim();
      return '';
    })
    .filter((u) => /^https?:\/\//i.test(u));

  const features = Array.isArray(item.features)
    ? item.features.map((f) => String(f || '').trim()).filter(Boolean)
    : typeof item.features === 'string'
      ? [item.features]
      : [];

  const title = String(item.title || item.name || '').trim();
  if (!title && !imageUrls.length) {
    throw new Error(`Apify returned empty Amazon product for ${cleanUrl}`);
  }

  return {
    title,
    description: String(item.description || item.productDescription || '').trim(),
    features,
    asin: String(item.asin || item.asins || '').trim(),
    url: String(item.url || cleanUrl || amazonUrl).trim(),
    imageUrls: Array.from(new Set(imageUrls)).slice(0, 4),
  };
}

/**
 * Download remote image URLs into Buffers (best-effort).
 */
export async function downloadImageBuffers(urls, { max = 4 } = {}) {
  const out = [];
  for (const url of (urls || []).slice(0, max)) {
    try {
      const { data } = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 45000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ErrayhanyBot/1.0)',
          Accept: 'image/*,*/*',
        },
      });
      const buf = Buffer.from(data);
      if (buf.length > 1000) out.push(buf);
    } catch (e) {
      console.warn('Amazon image download failed:', url, e.message);
    }
  }
  return out;
}
