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
  return `ERY-${clean}`;
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
  const realBuffer = originalBuffers[0];

  if (!enabled || !isOpenRouterConfigured() || !realBuffer) {
    return {
      sellerSku,
      referenceClean,
      skippedAi: true,
      copy: null,
      nocoImages: null,
      imageUrls: [],
      sheet: null,
    };
  }

  const copy = await generateProductCopy({
    imageBuffer: realBuffer,
    name,
    price,
    ref: referenceClean,
  });

  const aiBuffers = await generateProductImages({
    imageBuffer: realBuffer,
    titleFr: copy.french_title || name,
    price,
  });

  // Order: 4 AI (clean + 3 promo) then real photo last
  const ordered = [
    aiBuffers[0] || realBuffer,
    aiBuffers[1] || null,
    aiBuffers[2] || null,
    aiBuffers[3] || null,
    realBuffer,
  ].filter(Boolean);

  const uploaded = [];
  for (let i = 0; i < ordered.length; i++) {
    const buf = ordered[i];
    const file = await uploadToNocoDB(buf, `ai-${sellerSku}-${i + 1}.jpg`);
    uploaded.push(file);
  }

  const imageUrls = uploaded.map((f) => publicUrlFromNoco(f, nocodbUrl));

  const productForSheet = {
    referenceClean,
    sellerSku,
    price,
    frenchTitle: copy.french_title || name,
    arabicTitle: copy.arabic_title || name,
    shortFr: copy.short_description_fr || '',
    shortAr: copy.short_description_ar || '',
    descriptionFr: copy.description_french || '',
    descriptionAr: copy.description_arabic || '',
    metaTitle: copy.meta_title || copy.french_title || name,
    metaDescription: copy.meta_description || '',
    wooTitle: copy.woo_title || copy.french_title || name,
    brand: copy.brand || 'Generic',
    color: copy.color || 'Multicolore',
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
    skippedAi: false,
    copy,
    nocoImages: uploaded,
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

  // Optional fields — ignored by NocoDB if column missing? Better send conservatively.
  // Keep extras that commonly exist in their sheet-backed tables.
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
