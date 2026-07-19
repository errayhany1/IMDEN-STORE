/**
 * Enrichment after Telegram images downloaded.
 * Always uploads at least the real photos so products never go live without images.
 */
import {
  generateProductCopy,
  generateProductImages,
  isOpenRouterConfigured,
} from './openrouter.js';
import { appendProductToSheet, isSheetWebhookConfigured } from './sheetsAppend.js';

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
 * Enrichment after Telegram images downloaded.
 * Returns fields for NocoDB + sheet + landing.
 */
export async function enrichProduct({
  originalBuffers,
  name,
  price,
  ref,
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

  // Always upload original photos first — never create a product without images.
  const originalUploads = await uploadBuffers(
    uploadToNocoDB,
    realBuffers.slice(0, 5),
    `real-${sellerSku}`
  );

  if (!originalUploads.length) {
    throw new Error('Failed to upload original images to NocoDB storage');
  }

  if (!enabled || !isOpenRouterConfigured()) {
    const imageUrls = originalUploads.map((f) => publicUrlFromNoco(f, nocodbUrl));
    return {
      sellerSku,
      referenceClean,
      skippedAi: true,
      copy: null,
      nocoImages: originalUploads,
      imageUrls,
      sheet: null,
    };
  }

  let copy = null;
  let aiUploads = [];

  try {
    copy = await generateProductCopy({
      imageBuffer: realBuffer,
      name,
      price,
      ref: referenceClean,
    });
  } catch (e) {
    console.error('AI copy failed, continuing with originals:', e.message);
  }

  try {
    const aiBuffers = await generateProductImages({
      imageBuffer: realBuffer,
      titleFr: copy?.french_title || name,
      price,
    });
    // Prefer AI images first, keep one real photo last (max 5 slots)
    const ordered = [
      aiBuffers[0],
      aiBuffers[1],
      aiBuffers[2],
      aiBuffers[3],
      realBuffer,
    ].filter(Boolean).slice(0, 5);

    if (ordered.length) {
      aiUploads = await uploadBuffers(uploadToNocoDB, ordered, `ai-${sellerSku}`);
    }
  } catch (e) {
    console.error('AI images failed, using originals only:', e.message);
  }

  const nocoImages = aiUploads.length ? aiUploads : originalUploads;
  const imageUrls = nocoImages.map((f) => publicUrlFromNoco(f, nocodbUrl));

  const productForSheet = {
    referenceClean,
    sellerSku,
    price,
    frenchTitle: copy?.french_title || name,
    arabicTitle: copy?.arabic_title || name,
    shortFr: copy?.short_description_fr || '',
    shortAr: copy?.short_description_ar || '',
    descriptionFr: copy?.description_french || '',
    descriptionAr: copy?.description_arabic || '',
    metaTitle: copy?.meta_title || copy?.french_title || name,
    metaDescription: copy?.meta_description || '',
    wooTitle: copy?.woo_title || copy?.french_title || name,
    brand: copy?.brand || 'Generic',
    color: copy?.color || 'Multicolore',
    jumiaCategory: '',
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
    skippedAi: !copy,
    copy,
    nocoImages,
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
