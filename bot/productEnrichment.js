/**
 * Enrichment after Telegram images downloaded.
 * Always uploads at least the real photos so products never go live without images.
 * With Amazon URL: scrape Apify → AI copy from Amazon data → gallery = AI + Amazon + real last.
 */
import {
  generateProductCopy,
  generateProductImages,
  isOpenRouterConfigured,
} from './openrouter.js';
import { generateLandingPageCopy, isOpenAIConfigured } from './openai.js';
import { appendProductToSheet, isSheetWebhookConfigured } from './sheetsAppend.js';
import {
  scrapeAmazonProduct,
  downloadImageBuffers,
  isApifyConfigured,
} from './amazonScrape.js';

export function buildSellerSku(ref) {
  const clean = String(ref || 'REF')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9/_-]/g, '')
    .toUpperCase();
  if (clean.startsWith('ERY-')) return clean;
  return `ERY-${clean || 'REF'}`;
}

export function cleanReference(ref) {
  return String(ref || '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9/_-]/g, '');
}

function publicUrlFromNoco(fileObj, nocodbUrl) {
  if (!fileObj) return '';
  const raw = fileObj.signedUrl || fileObj.url || '';
  if (!raw) return '';
  return raw.startsWith('http') ? raw : `${nocodbUrl}/${raw}`;
}

async function uploadBuffers(uploadToNocoDB, buffers, prefix) {
  const uploaded = [];
  for (let i = 0; i < buffers.length; i++) {
    const buf = buffers[i];
    if (!buf) continue;
    const file = await uploadToNocoDB(buf, `${prefix}-${i + 1}.jpg`);
    if (file) uploaded.push(file);
  }
  return uploaded;
}

/**
 * Build Image1…Image5 order: AI → Amazon → real last (max 5).
 * Real photo is always the final slot when present.
 */
function orderGalleryUploads({ aiUploads = [], amazonUploads = [], realUploads = [] }) {
  const realLast = realUploads[0] ? [realUploads[0]] : [];
  const slotsLeft = Math.max(0, 5 - realLast.length);
  const front = [...aiUploads, ...amazonUploads].filter(Boolean).slice(0, slotsLeft);
  return [...front, ...realLast].slice(0, 5);
}

/**
 * Enrichment after Telegram images downloaded.
 * Returns fields for NocoDB + sheet + UX.
 */
export async function enrichProduct({
  originalBuffers,
  name,
  price,
  ref,
  amazonUrl = '',
  uploadToNocoDB,
  nocodbUrl,
}) {
  const enabled = String(process.env.PRODUCT_AI_ENRICHMENT || 'true').toLowerCase() !== 'false';
  const sellerSku = buildSellerSku(ref);
  const referenceClean = cleanReference(ref);
  const realBuffers = (originalBuffers || []).filter(Boolean);
  const realBuffer = realBuffers[0];

  if (!realBuffer) {
    throw new Error('No original image buffers to upload');
  }

  // Always upload original photos with real- prefix — never create a product without images.
  const originalUploads = await uploadBuffers(
    uploadToNocoDB,
    realBuffers.slice(0, 1),
    `real-${sellerSku}`
  );

  if (!originalUploads.length) {
    throw new Error('Failed to upload original images to NocoDB storage');
  }

  let amazonMeta = null;
  let amazonUploads = [];

  if (amazonUrl) {
    if (!isApifyConfigured()) {
      console.warn('Amazon URL provided but APIFY_TOKEN missing — skipping scrape');
    } else {
      try {
        amazonMeta = await scrapeAmazonProduct(amazonUrl);
        console.log(`Amazon scrape OK: ${amazonMeta.title || amazonMeta.asin || amazonUrl}`);
        const amazonBuffers = await downloadImageBuffers(amazonMeta.imageUrls, { max: 4 });
        if (amazonBuffers.length) {
          amazonUploads = await uploadBuffers(
            uploadToNocoDB,
            amazonBuffers,
            `amazon-${sellerSku}`
          );
        }
      } catch (e) {
        console.error('Amazon scrape failed:', e.message);
        amazonMeta = { title: '', description: '', features: [], asin: '', url: amazonUrl, imageUrls: [] };
      }
    }
  }

  if (!enabled || (!isOpenAIConfigured() && !isOpenRouterConfigured())) {
    const nocoImages = orderGalleryUploads({
      amazonUploads,
      realUploads: originalUploads,
    });
    const imageUrls = nocoImages.map((f) => publicUrlFromNoco(f, nocodbUrl));
    const productForSheet = {
      referenceClean,
      sellerSku,
      price,
      frenchTitle: amazonMeta?.title || name,
      arabicTitle: name,
      shortFr: '',
      shortAr: '',
      descriptionFr: amazonMeta?.description || '',
      descriptionAr: '',
      metaTitle: amazonMeta?.title || name,
      metaDescription: '',
      wooTitle: amazonMeta?.title || name,
      brand: 'Generic',
      color: 'Multicolore',
      jumiaCategory: '',
      amazonUrl: amazonUrl || amazonMeta?.url || '',
      imageUrls,
      stock: 10,
    };
    let sheetResult = null;
    if (isSheetWebhookConfigured()) {
      try {
        sheetResult = await appendProductToSheet(productForSheet);
      } catch (e) {
        sheetResult = { error: e.message };
      }
    } else {
      sheetResult = { skipped: true, reason: 'no_webhook' };
    }
    return {
      sellerSku,
      referenceClean,
      amazonUrl: amazonUrl || amazonMeta?.url || '',
      skippedAi: true,
      copy: null,
      nocoImages,
      imageUrls,
      sheet: sheetResult,
      productForSheet,
    };
  }

  let copy = null;
  let aiUploads = [];
  const displayName = amazonMeta?.title || name;

  // Prefer OpenAI for landing-page copy; fall back to OpenRouter.
  try {
    if (isOpenAIConfigured()) {
      copy = await generateLandingPageCopy({
        imageBuffer: realBuffer,
        name: displayName,
        price,
        ref: referenceClean,
        amazonMeta,
      });
      console.log('Landing copy: OpenAI OK');
    } else {
      copy = await generateProductCopy({
        imageBuffer: realBuffer,
        name: displayName,
        price,
        ref: referenceClean,
        amazonMeta,
      });
      console.log('Landing copy: OpenRouter OK');
    }
  } catch (e) {
    console.error('AI copy (primary) failed:', e.message);
    if (isOpenAIConfigured() && isOpenRouterConfigured()) {
      try {
        copy = await generateProductCopy({
          imageBuffer: realBuffer,
          name: displayName,
          price,
          ref: referenceClean,
          amazonMeta,
        });
        console.log('Landing copy: OpenRouter fallback OK');
      } catch (e2) {
        console.error('AI copy fallback failed:', e2.message);
      }
    }
  }

  try {
    if (!isOpenRouterConfigured()) {
      console.warn('OPENROUTER_API_KEY missing — skipping professional AI image generation');
    } else {
      const aiBuffers = await generateProductImages({
        imageBuffer: realBuffer,
        imageBuffers: realBuffers.slice(0, 3),
        titleFr: copy?.french_title || displayName,
        price,
        // Without Amazon URL: always craft studio images from the seller photos.
        mode: amazonUrl ? 'amazon' : 'photo',
      });
      // Upload AI buffers with ai- prefix only (do NOT mix real into this prefix).
      const aiOnly = (aiBuffers || []).filter(Boolean).slice(0, amazonUrl ? 2 : 3);
      if (aiOnly.length) {
        aiUploads = await uploadBuffers(uploadToNocoDB, aiOnly, `ai-${sellerSku}`);
        console.log(`AI studio images uploaded: ${aiUploads.length} (mode=${amazonUrl ? 'amazon' : 'photo'})`);
      } else if (!amazonUrl) {
        console.error('No AI studio image produced from seller photos');
      }
    }
  } catch (e) {
    console.error('AI images failed, continuing without AI gallery:', e.message);
  }

  const nocoImages = orderGalleryUploads({
    aiUploads,
    amazonUploads,
    realUploads: originalUploads,
  });
  // Fallback if ordering somehow empty
  const finalImages = nocoImages.length ? nocoImages : originalUploads;
  const imageUrls = finalImages.map((f) => publicUrlFromNoco(f, nocodbUrl));

  const productForSheet = {
    referenceClean,
    sellerSku,
    price,
    frenchTitle: copy?.french_title || displayName,
    arabicTitle: copy?.arabic_title || name,
    shortFr: copy?.short_description_fr || '',
    shortAr: copy?.short_description_ar || '',
    descriptionFr: copy?.description_french || amazonMeta?.description || '',
    descriptionAr: copy?.description_arabic || '',
    metaTitle: copy?.meta_title || copy?.french_title || displayName,
    metaDescription: copy?.meta_description || '',
    wooTitle: copy?.woo_title || copy?.french_title || displayName,
    brand: copy?.brand || 'Generic',
    color: copy?.color || 'Multicolore',
    jumiaCategory: '',
    amazonUrl: amazonUrl || amazonMeta?.url || '',
    imageUrls,
    stock: 10,
  };

  let sheetResult = null;
  if (isSheetWebhookConfigured()) {
    try {
      sheetResult = await appendProductToSheet(productForSheet);
    } catch (e) {
      console.error('Sheet append error:', e.message);
      sheetResult = { error: e.message };
    }
  } else {
    sheetResult = { skipped: true, reason: 'no_webhook' };
  }

  return {
    sellerSku,
    referenceClean,
    amazonUrl: amazonUrl || amazonMeta?.url || '',
    skippedAi: !copy,
    copy,
    nocoImages: finalImages,
    imageUrls,
    sheet: sheetResult,
    productForSheet,
  };
}

export function buildNocoRecordFromEnrichment({ price, name, enrichment }) {
  const copy = enrichment.copy || {};
  const sellerSku = enrichment.sellerSku;
  const record = {
    Title: copy.arabic_title || name,
    Arabic_Title: copy.arabic_title || name,
    French_Title: copy.french_title || name,
    Woo_Title: copy.woo_title || copy.french_title || name,
    SKU: sellerSku,
    price,
    Category_ID: 12,
    POSTEBL: 'POSTEBL',
    description_arabic: copy.description_arabic || '',
  };

  if (copy.description_french) record.description_french = copy.description_french;
  if (copy.short_description_ar) record.short_description_ar = copy.short_description_ar;
  if (copy.short_description_fr) record.short_description_fr = copy.short_description_fr;
  if (copy.meta_title) record.Meta_Title = copy.meta_title;
  if (copy.meta_description) record.Meta_Description = copy.meta_description;
  if (copy.hero_line_ar) record.Hero_Line_AR = copy.hero_line_ar;
  if (copy.hero_line_fr) record.Hero_Line_FR = copy.hero_line_fr;
  if (Array.isArray(copy.faq_ar) && copy.faq_ar.length) {
    record.Landing_FAQ_AR = JSON.stringify(copy.faq_ar);
  }
  if (Array.isArray(copy.faq_fr) && copy.faq_fr.length) {
    record.Landing_FAQ_FR = JSON.stringify(copy.faq_fr);
  }
  if (enrichment.amazonUrl) {
    record.Amazon_URL = enrichment.amazonUrl;
  }

  const files = enrichment.nocoImages || [];
  if (files[0]) record.Image1 = [files[0]];
  if (files[1]) {
    record.Image2 = [files[1]];
    record.image2 = [files[1]];
  }
  if (files[2]) {
    record.Image3 = [files[2]];
    record.image3 = [files[2]];
  }
  if (files[3]) {
    record.Image4 = [files[3]];
    record.image4 = [files[3]];
  }
  if (files[4]) {
    record.Image5 = [files[4]];
    record.image5 = [files[4]];
  }

  return record;
}
