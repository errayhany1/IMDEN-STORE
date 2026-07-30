/**
 * Amazon product scrape via Apify (same actor as the n8n workflow).
 * Token must come from env — never hardcode.
 */
import axios from 'axios';

const DEFAULT_ACT = 'junglee~free-amazon-product-scraper';

const AMAZON_MARKETPLACE_NOISE = new RegExp(
  [
    String.raw`[$€£¥]`,
    String.raw`\b(?:USD|EUR|GBP|CAD|AUD|SAR|AED|dollars?|euros?|pounds?)\b`,
    String.raw`\b(?:shipping|delivery|dispatch|prime|returns?|refunds?|import fees?|sold by|fulfilled by|in stock|out of stock)\b`,
    String.raw`\b(?:livraison|expédition|retours?|remboursement|frais d'importation|vendu par|expédié par|en stock)\b`,
    String.raw`\b(?:United States|USA|United Kingdom|Canada|France|Germany|Italy|Spain|China|India|Saudi Arabia|UAE|Emirates)\b`,
    String.raw`\b(?:États-Unis|Royaume-Uni|Allemagne|Italie|Espagne|Chine|Inde|Arabie saoudite)\b`,
    String.raw`(?:التوصيل|الشحن|الإرجاع|الدولار|اليورو|السعودية|الإمارات|الولايات المتحدة)`,
  ].join('|'),
  'iu',
);

/**
 * Amazon descriptions often mix product facts with marketplace-specific price,
 * delivery and country copy. Keep only reusable product facts before AI sees it.
 */
export function sanitizeAmazonMarketplaceText(value) {
  const text = String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|li|div|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\r/g, '\n')
    .trim();
  if (!text) return '';

  return text
    .split(/(?<=[.!?。！？])\s+|\n+/u)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter((part) => part && !AMAZON_MARKETPLACE_NOISE.test(part))
    .join(' ')
    .trim();
}

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

export function normalizeAmazonUrls(value, { max = 4 } = {}) {
  const matches = String(value || '').match(/https?:\/\/[^\s<>"']+/gi) || [];
  return Array.from(new Set(
    matches
      .map(normalizeAmazonUrl)
      .filter((url) => {
        try {
          return /(^|\.)amazon\./i.test(new URL(url).hostname);
        } catch {
          return false;
        }
      }),
  )).slice(0, Math.max(1, Number(max) || 4));
}

function normalizeAmazonImageUrl(value) {
  const raw = String(value || '')
    .replace(/\\u002F/gi, '/')
    .replace(/\\\//g, '/')
    .replace(/&amp;/gi, '&')
    .trim();
  if (!/^https?:\/\//i.test(raw) || !/\/images\/I\//i.test(raw)) return '';
  return raw
    .replace(/\._[^/]+_\.(?=(?:jpe?g|png|webp)(?:[?#]|$))/i, '.')
    .replace(/[?#].*$/, '');
}

function imageUrlFromValue(value) {
  if (typeof value === 'string') return normalizeAmazonImageUrl(value);
  if (!value || typeof value !== 'object') return '';
  return normalizeAmazonImageUrl(
    value.hiRes || value.large || value.url || value.src || value.image || '',
  );
}

function collectNestedImageUrls(value, out = [], depth = 0) {
  if (depth > 6 || value == null) return out;
  if (typeof value === 'string') {
    const direct = normalizeAmazonImageUrl(value);
    if (direct) out.push(direct);
    const matches = value.match(
      /https?:\\?\/\\?\/[^"'\\\s<>]+\/images\/I\/[^"'\\\s<>]+?\.(?:jpe?g|png|webp)/gi,
    ) || [];
    matches.map(normalizeAmazonImageUrl).filter(Boolean).forEach((url) => out.push(url));
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectNestedImageUrls(entry, out, depth + 1));
    return out;
  }
  if (typeof value === 'object') {
    Object.values(value).forEach((entry) => collectNestedImageUrls(entry, out, depth + 1));
  }
  return out;
}

function uniqueImages(values, max = 12) {
  return Array.from(new Set(values.map(imageUrlFromValue).filter(Boolean))).slice(0, max);
}

async function scrapeAmazonPageImages(cleanUrl) {
  try {
    const { data: html } = await axios.get(cleanUrl, {
      timeout: 45_000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    const source = String(html || '').replace(/\\u002F/gi, '/').replace(/\\\//g, '/');
    const gallery = [];
    const keyPattern = /"(?:hiRes|large|landingImage|mainUrl|mainImage)"\s*:\s*"([^"]+)"/gi;
    for (const match of source.matchAll(keyPattern)) {
      const url = normalizeAmazonImageUrl(match[1]);
      if (url) gallery.push(url);
    }

    const description = [];
    for (const marker of ['id="aplus"', 'id="productDescription"', 'id="aplus_feature_div"']) {
      let start = source.indexOf(marker);
      while (start >= 0) {
        const block = source.slice(start, start + 300_000);
        collectNestedImageUrls(block, description);
        start = source.indexOf(marker, start + marker.length);
      }
    }
    return {
      gallery: uniqueImages(gallery, 12),
      description: uniqueImages(description, 12),
    };
  } catch (error) {
    console.warn('Amazon direct page image scrape failed:', error.message);
    return { gallery: [], description: [] };
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
 *   descriptionImageUrls: string[],
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

  const actorGallery = [
    item.highResolutionImages,
    item.galleryThumbnails,
    item.images,
    item.imageUrls,
    item.image_urls,
    item.variantImages,
    item.thumbnailImage,
    item.mainImage,
  ];
  const actorDescription = [
    item.descriptionImages,
    item.productDescriptionImages,
    item.aplusImages,
    item.aPlusImages,
    item.aplusContent,
    item.aPlusContent,
    item.aplus_modules,
  ];
  const nestedGallery = [];
  const nestedDescription = [];
  collectNestedImageUrls(actorGallery, nestedGallery);
  collectNestedImageUrls(actorDescription, nestedDescription);
  const pageImages = await scrapeAmazonPageImages(cleanUrl);
  const descriptionImageUrls = uniqueImages(
    [...nestedDescription, ...pageImages.description],
    8,
  );
  const descriptionSet = new Set(descriptionImageUrls);
  const imageUrls = uniqueImages(
    [...nestedGallery, ...pageImages.gallery].filter((url) => !descriptionSet.has(url)),
    8,
  );

  const features = Array.isArray(item.features)
    ? item.features.map(sanitizeAmazonMarketplaceText).filter(Boolean)
    : typeof item.features === 'string'
      ? [sanitizeAmazonMarketplaceText(item.features)].filter(Boolean)
      : [];

  const title = String(item.title || item.name || '').trim();
  if (!title && !imageUrls.length) {
    throw new Error(`Apify returned empty Amazon product for ${cleanUrl}`);
  }

  return {
    title,
    description: sanitizeAmazonMarketplaceText(
      item.description || item.productDescription || '',
    ),
    features,
    asin: String(item.asin || item.asins || '').trim(),
    url: String(item.url || cleanUrl || amazonUrl).trim(),
    imageUrls,
    descriptionImageUrls,
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
