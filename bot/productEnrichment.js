/**
 * Enrichment after Telegram images downloaded.
 * Always uploads at least the real photos so products never go live without images.
 * With Amazon URL: scrape Apify → AI copy from Amazon data → gallery = AI + Amazon + real last.
 */
import {
  detectProductBarcode,
  generateProductCopy,
  generateProductImages,
  isOpenRouterConfigured,
} from './openrouter.js';
import {
  generateLandingPageCopy,
  isOpenAIConfigured,
  generateProductImages as generateProductImagesOpenAI,
} from './openai.js';
import { appendProductToSheet, isSheetWebhookConfigured } from './sheetsAppend.js';
import {
  scrapeAmazonProduct,
  downloadImageBuffers,
  isApifyConfigured,
  normalizeAmazonUrl,
} from './amazonScrape.js';
import { prepareVisionBuffers } from './imageNormalize.js';
import {
  bulletsFromHtml,
  renderSpecsCard,
} from './studioImage.js';

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
 * Build Image1…Image5 order: AI hero → specs card → Amazon → real last (max 5).
 * Real photo is always the final slot when present.
 */
function orderGalleryUploads({
  aiUploads = [],
  specsUploads = [],
  amazonUploads = [],
  realUploads = [],
}) {
  const realLast = realUploads[0] ? [realUploads[0]] : [];
  const slotsLeft = Math.max(0, 5 - realLast.length);
  const front = [...aiUploads, ...specsUploads, ...amazonUploads]
    .filter(Boolean)
    .slice(0, slotsLeft);
  return [...front, ...realLast].slice(0, 5);
}

function injectSpecsIntoDescription(html, specsUrl, lang = 'fr') {
  if (!specsUrl) return html || '';
  const label = lang === 'ar' ? 'بطاقة المواصفات' : 'Fiche technique';
  const block = `<figure class="specs-card"><img src="${specsUrl}" alt="${label}" loading="lazy"/><figcaption>${label}</figcaption></figure>`;
  const base = String(html || '').trim();
  return base ? `${base}\n${block}` : block;
}

/**
 * Enrichment after Telegram images downloaded.
 * Returns fields for NocoDB + sheet + UX.
 */
export async function enrichProduct({
  originalBuffers,
  name,
  price,
  oldPrice = 0,
  ref,
  amazonUrl = '',
  uploadToNocoDB,
  nocodbUrl,
  syncSheet = true,
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
        const cleanAmazonUrl = normalizeAmazonUrl(amazonUrl);
        amazonMeta = await scrapeAmazonProduct(cleanAmazonUrl);
        console.log(`Amazon scrape OK: ${amazonMeta.title || amazonMeta.asin || cleanAmazonUrl}`);
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
    if (syncSheet && isSheetWebhookConfigured()) {
      try {
        sheetResult = await appendProductToSheet(productForSheet);
      } catch (e) {
        sheetResult = { error: e.message };
      }
    } else {
      sheetResult = {
        skipped: true,
        reason: syncSheet ? 'no_webhook' : 'destination_choice',
      };
    }
    return {
      sellerSku,
      referenceClean,
      amazonUrl: amazonUrl || amazonMeta?.url || '',
      skippedAi: true,
      copy: null,
      barcode: '',
      nocoImages,
      imageUrls,
      sheet: sheetResult,
      productForSheet,
      aiFailures: ['AI disabled or OPENROUTER_API_KEY / OpenAI key not configured'],
      hasAiImages: false,
    };
  }

  let copy = null;
  let aiUploads = [];
  const displayName = amazonMeta?.title || name;
  const aiFailures = [];

  // Downscale before any vision call — full Telegram photos regularly blow
  // past the soft timeout and leave products with only the raw caption.
  const visionBuffers = await prepareVisionBuffers(realBuffers.slice(0, 4));
  const visionPrimary = visionBuffers[0] || realBuffer;

  async function runCopyOnce() {
    if (isOpenAIConfigured()) {
      return generateLandingPageCopy({
        imageBuffer: visionPrimary,
        imageBuffers: visionBuffers,
        name: displayName,
        price,
        ref: referenceClean,
        amazonMeta,
      });
    }
    return generateProductCopy({
      imageBuffer: visionPrimary,
      imageBuffers: visionBuffers,
      name: displayName,
      price,
      ref: referenceClean,
      amazonMeta,
    });
  }

  async function runImagesOnce(titleFr) {
    const opts = {
      imageBuffer: visionPrimary,
      imageBuffers: visionBuffers,
      titleFr: titleFr || displayName,
      price,
      oldPrice,
      mode: amazonUrl ? 'amazon' : 'photo',
    };
    // Provider selection: honour an explicit IMAGE_PROVIDER, otherwise prefer
    // OpenRouter (Gemini) when available and fall back to OpenAI (gpt-image-1)
    // so owners who only use OpenAI still get studio images.
    const forced = String(process.env.IMAGE_PROVIDER || '').toLowerCase();
    if (forced === 'openai' && isOpenAIConfigured()) return generateProductImagesOpenAI(opts);
    if (forced === 'openrouter' && isOpenRouterConfigured()) return generateProductImages(opts);
    if (isOpenRouterConfigured()) return generateProductImages(opts);
    if (isOpenAIConfigured()) return generateProductImagesOpenAI(opts);
    throw new Error('No image provider configured (set OPENROUTER_API_KEY or OPENAI_API_KEY)');
  }

  // Copy and studio images can run in parallel — images only need a display
  // title, not the finished SEO copy. That cuts wall-clock time roughly in half.
  const copyPromise = (async () => {
    try {
      const first = await runCopyOnce();
      console.log(`Landing copy: ${isOpenAIConfigured() ? 'OpenAI' : 'OpenRouter'} OK`);
      return first;
    } catch (e) {
      console.error('AI copy (primary) failed:', e.message);
      if (isOpenAIConfigured() && isOpenRouterConfigured()) {
        try {
          const fallback = await generateProductCopy({
            imageBuffer: visionPrimary,
            imageBuffers: visionBuffers,
            name: displayName,
            price,
            ref: referenceClean,
            amazonMeta,
          });
          console.log('Landing copy: OpenRouter fallback OK');
          return fallback;
        } catch (e2) {
          console.error('AI copy fallback failed:', e2.message);
          aiFailures.push(`copy:${e2.message}`);
          return null;
        }
      }
      aiFailures.push(`copy:${e.message}`);
      return null;
    }
  })();

  const imagesPromise = (async () => {
    try {
      const aiBuffers = await runImagesOnce(displayName);
      const aiOnly = (aiBuffers || []).filter(Boolean).slice(0, amazonUrl ? 2 : 3);
      if (!aiOnly.length) {
        throw new Error('No AI studio image produced from seller photos');
      }
      const uploaded = await uploadBuffers(uploadToNocoDB, aiOnly, `ai-${sellerSku}`);
      console.log(`AI studio images uploaded: ${uploaded.length} (mode=${amazonUrl ? 'amazon' : 'photo'})`);
      return uploaded;
    } catch (e) {
      console.error('AI images failed, retrying once:', e.message);
      try {
        const aiBuffers = await runImagesOnce(displayName);
        const aiOnly = (aiBuffers || []).filter(Boolean).slice(0, amazonUrl ? 2 : 3);
        if (!aiOnly.length) throw new Error('No AI studio image on retry');
        const uploaded = await uploadBuffers(uploadToNocoDB, aiOnly, `ai-${sellerSku}`);
        console.log(`AI studio images uploaded on retry: ${uploaded.length}`);
        return uploaded;
      } catch (e2) {
        console.error('AI images retry failed:', e2.message);
        aiFailures.push(`images:${e2.message}`);
        return [];
      }
    }
  })();

  const barcodePromise = (async () => {
    try {
      return await detectProductBarcode(visionBuffers);
    } catch (e) {
      console.warn('Barcode detection skipped:', e.message);
      return '';
    }
  })();

  const [copyResult, imageUploads, barcodeDetected] = await Promise.all([
    copyPromise,
    imagesPromise,
    barcodePromise,
  ]);

  copy = copyResult;
  aiUploads = imageUploads || [];

  // If copy still empty, one more dedicated retry after images finished.
  if (!copy) {
    try {
      copy = await runCopyOnce();
      console.log('Landing copy: late retry OK');
    } catch (e) {
      console.error('AI copy late retry failed:', e.message);
    }
  }

  let barcode = String(copy?.barcode || barcodeDetected || '').trim();
  if (barcode) console.log(`Barcode: ${barcode}`);

  // Professional specs card from the generated bullets — shown in gallery + description.
  let specsUploads = [];
  let specsUrl = '';
  if (copy) {
    try {
      const bulletsFr = bulletsFromHtml(
        copy.short_description_fr || copy.description_french || '',
        6
      );
      const bulletsAr = bulletsFromHtml(
        copy.short_description_ar || copy.description_arabic || '',
        6
      );
      const specsBuf = await renderSpecsCard({
        title: copy.french_title || displayName,
        bullets: bulletsFr.length ? bulletsFr : bulletsAr,
        brand: copy.brand,
        color: copy.color,
        sku: sellerSku,
        price,
        lang: 'fr',
      });
      specsUploads = await uploadBuffers(uploadToNocoDB, [specsBuf], `specs-${sellerSku}`);
      if (specsUploads[0]) {
        specsUrl = publicUrlFromNoco(specsUploads[0], nocodbUrl);
        console.log('Specs card uploaded');
      }
    } catch (e) {
      console.error('Specs card failed:', e.message);
      aiFailures.push(`specs:${e.message}`);
    }
  }

  if (copy && specsUrl) {
    copy.description_french = injectSpecsIntoDescription(
      copy.description_french,
      specsUrl,
      'fr'
    );
    copy.description_arabic = injectSpecsIntoDescription(
      copy.description_arabic,
      specsUrl,
      'ar'
    );
  }

  const nocoImages = orderGalleryUploads({
    aiUploads,
    specsUploads,
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
  if (syncSheet && isSheetWebhookConfigured()) {
    try {
      sheetResult = await appendProductToSheet(productForSheet);
    } catch (e) {
      console.error('Sheet append error:', e.message);
      sheetResult = { error: e.message };
    }
  } else {
    sheetResult = {
      skipped: true,
      reason: syncSheet ? 'no_webhook' : 'destination_choice',
    };
  }

  return {
    sellerSku,
    referenceClean,
    amazonUrl: amazonUrl || amazonMeta?.url || '',
    skippedAi: !copy,
    copy,
    barcode,
    nocoImages: finalImages,
    imageUrls,
    sheet: sheetResult,
    productForSheet,
    aiFailures,
    hasAiImages: aiUploads.length > 0,
    hasSpecsImage: specsUploads.length > 0,
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

  const barcode = String(enrichment.barcode || copy.barcode || '').trim();
  if (barcode) record.Barcode = barcode;

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
