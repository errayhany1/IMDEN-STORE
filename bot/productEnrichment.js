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
import {
  appendProductToSheet,
  isSheetWebhookConfigured,
  JUMIA_SHEET_DEFAULTS,
} from './sheetsAppend.js';
import {
  createJumiaProduct,
  isJumiaConfigured,
} from './jumiaClient.js';
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

export function publicUrlFromNoco(fileObj, nocodbUrl) {
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

/** Same as uploadBuffers but keeps the JPEG buffer for Telegram preview. */
async function uploadBufferPairs(uploadToNocoDB, buffers, prefix) {
  const pairs = [];
  for (let i = 0; i < buffers.length; i++) {
    const buf = buffers[i];
    if (!buf) continue;
    const file = await uploadToNocoDB(buf, `${prefix}-${i + 1}.jpg`);
    if (file) pairs.push({ file, buffer: buf, index: i });
  }
  return pairs;
}

/**
 * Build Image1…Image5 order:
 * Image1 = AI studio hero (white packshot)
 * Image2 = AI alternate angle (if any)
 * Image3 = original front photo (real)
 * then packaging specs card / Amazon extras
 */
function orderGalleryUploads({
  aiUploads = [],
  specsUploads = [],
  amazonUploads = [],
  realUploads = [],
}) {
  const hero = aiUploads.filter(Boolean);
  const firstAi = hero[0] ? [hero[0]] : [];
  const secondAi = hero[1] ? [hero[1]] : [];
  const extraAi = hero.slice(2);
  const real = realUploads[0] ? [realUploads[0]] : [];
  const specs = specsUploads.filter(Boolean).slice(0, 1);
  return [
    ...firstAi,
    ...secondAi,
    ...real,
    ...specs,
    ...extraAi,
    ...amazonUploads.filter(Boolean),
  ].slice(0, 5);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function hasArabic(text) {
  return /[\u0600-\u06FF]/.test(String(text || ''));
}

async function maybeSyncSheet(productForSheet, syncSheet) {
  if (syncSheet && isSheetWebhookConfigured()) {
    try {
      return await appendProductToSheet(productForSheet);
    } catch (e) {
      console.error('Sheet append error:', e.message);
      return { error: e.message };
    }
  }
  return {
    skipped: true,
    reason: syncSheet ? 'no_webhook' : 'destination_choice',
  };
}

async function maybeSyncJumia(productForSheet, syncJumia) {
  if (!syncJumia) {
    return { skipped: true, reason: 'destination_choice' };
  }
  if (!isJumiaConfigured()) {
    return { skipped: true, reason: 'jumia_not_configured' };
  }
  try {
    const result = await createJumiaProduct(productForSheet);
    if (!result?.skipped) {
      console.log(
        'Jumia create OK',
        result.sellerSku,
        result.productSetSid,
        result.countryStatuses?.[0]?.productStatus || '',
      );
    }
    return result;
  } catch (e) {
    console.error('Jumia create error:', e.message);
    return { error: e.message, details: e.details || null };
  }
}

/**
 * Specs block inside the description as HTML (not a rendered image).
 * Avoids missing Arabic glyphs on Linux/Alpine SVG fonts.
 */
function buildHtmlSpecsCard({
  title = '',
  bullets = [],
  brand = '',
  color = '',
  sku = '',
  price = '',
  lang = 'fr',
} = {}) {
  const isAr = lang === 'ar' || hasArabic(title) || bullets.some((b) => hasArabic(b));
  const heading = isAr ? 'المواصفات التقنية' : 'Fiche technique';
  const dir = isAr ? 'rtl' : 'ltr';
  const cleanBullets = (bullets || [])
    .map((b) => String(b || '').replace(/<[^>]*>/g, '').trim())
    .filter(Boolean)
    .slice(0, 6);
  const metaBits = [
    brand && brand !== 'Generic' ? `${isAr ? 'العلامة' : 'Marque'}: ${escapeHtml(brand)}` : '',
    color ? `${isAr ? 'اللون' : 'Couleur'}: ${escapeHtml(color)}` : '',
    sku ? `SKU: ${escapeHtml(sku)}` : '',
    price ? `${escapeHtml(price)} DH` : '',
  ].filter(Boolean);

  const list = cleanBullets.length
    ? `<ul class="specs-card-list">${cleanBullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`
    : '';
  const titleHtml = title
    ? `<p class="specs-card-title">${escapeHtml(title)}</p>`
    : '';
  const metaHtml = metaBits.length
    ? `<p class="specs-card-meta">${metaBits.join(' · ')}</p>`
    : '';

  return `<aside class="specs-card-html" dir="${dir}" lang="${isAr ? 'ar' : 'fr'}">
  <div class="specs-card-head">${escapeHtml(heading)}</div>
  <div class="specs-card-body">
    ${titleHtml}
    ${list}
    ${metaHtml}
  </div>
</aside>`;
}

function injectSpecsIntoDescription(html, specsBlock) {
  if (!specsBlock) return html || '';
  const base = String(html || '')
    // Drop legacy broken SVG/JPEG specs images from previous enrichments.
    .replace(/<figure[^>]*class=["'][^"']*specs-card[^"']*["'][^>]*>[\s\S]*?<\/figure>/gi, '')
    .replace(/<img\b[^>]*specs-[^>]*>/gi, '')
    .trim();
  return base ? `${base}\n${specsBlock}` : specsBlock;
}

/**
 * Enrichment after Telegram images downloaded.
 * Returns fields for NocoDB + sheet + UX.
 */
export async function enrichProduct({
  originalBuffers,
  displayBuffers = null,
  name,
  price,
  oldPrice = 0,
  ref,
  amazonUrl = '',
  uploadToNocoDB,
  nocodbUrl,
  syncSheet = true,
  syncJumia = true,
  postebl = 'POSTEBL',
  /** When false, never put raw seller photos in Image1–5 (vision-only backs). */
  publishRealOriginal = true,
}) {
  const enabled = String(process.env.PRODUCT_AI_ENRICHMENT || 'true').toLowerCase() !== 'false';
  const sellerSku = buildSellerSku(ref);
  const referenceClean = cleanReference(ref);
  const realBuffers = (originalBuffers || []).filter(Boolean);
  const galleryRealBuffers = (displayBuffers || realBuffers).filter(Boolean);
  const realBuffer = realBuffers[0] || galleryRealBuffers[0];

  if (!realBuffer) {
    throw new Error('No original image buffers to upload');
  }

  // Upload at most one DISPLAY original for gallery Image2 — never packaging backs.
  let originalUploads = [];
  let realPairs = [];
  if (publishRealOriginal && galleryRealBuffers[0]) {
    realPairs = await uploadBufferPairs(
      uploadToNocoDB,
      galleryRealBuffers.slice(0, 1),
      `real-${sellerSku}`
    );
    originalUploads = realPairs.map((p) => p.file);
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
    if (!originalUploads.length && galleryRealBuffers[0]) {
      originalUploads = await uploadBuffers(
        uploadToNocoDB,
        galleryRealBuffers.slice(0, 1),
        `real-${sellerSku}`
      );
    }
    const nocoImages = orderGalleryUploads({
      amazonUploads,
      realUploads: originalUploads,
    });
    const imageUrls = nocoImages.map((f) => publicUrlFromNoco(f, nocodbUrl));
    const productForSheet = {
      referenceClean,
      sellerSku,
      price,
      wholesalePrice: price,
      postebl,
      frenchTitle: amazonMeta?.title || name,
      arabicTitle: name,
      shortFr: '',
      shortAr: '',
      descriptionFr: amazonMeta?.description || '',
      descriptionAr: '',
      metaTitle: amazonMeta?.title || name,
      metaDescription: '',
      wooTitle: amazonMeta?.title || name,
      brand: JUMIA_SHEET_DEFAULTS.brand,
      color: JUMIA_SHEET_DEFAULTS.color,
      colorFamily: JUMIA_SHEET_DEFAULTS.colorFamily,
      variation: JUMIA_SHEET_DEFAULTS.variation,
      productWeight: JUMIA_SHEET_DEFAULTS.productWeight,
      jumiaCategory: JUMIA_SHEET_DEFAULTS.category,
      amazonUrl: amazonUrl || amazonMeta?.url || '',
      imageUrls,
      stock: JUMIA_SHEET_DEFAULTS.stock,
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
    const jumiaResult = await maybeSyncJumia(productForSheet, syncJumia);
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
      jumia: jumiaResult,
      productForSheet,
      aiFailures: [
        !enabled
          ? 'PRODUCT_AI_ENRICHMENT=false'
          : 'ai_disabled_or_unconfigured: set OPENROUTER_API_KEY (images) and optionally OPENAI_API_KEY (copy)',
      ],
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
    if (!isOpenRouterConfigured()) {
      throw new Error('OPENROUTER_API_KEY missing');
    }
    return generateProductImages({
      imageBuffer: visionPrimary,
      imageBuffers: visionBuffers,
      titleFr: titleFr || displayName,
      price,
      oldPrice,
      mode: amazonUrl ? 'amazon' : 'photo',
    });
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
      const aiOnly = (aiBuffers || []).filter(Boolean).slice(0, 2);
      if (!aiOnly.length) {
        throw new Error('No AI studio image produced from seller photos');
      }
      const pairs = await uploadBufferPairs(uploadToNocoDB, aiOnly, `ai-${sellerSku}`);
      console.log(`AI studio images uploaded: ${pairs.length} (mode=${amazonUrl ? 'amazon' : 'photo'})`);
      return pairs;
    } catch (e) {
      console.error('AI images failed, retrying once:', e.message);
      try {
        const aiBuffers = await runImagesOnce(displayName);
        const aiOnly = (aiBuffers || []).filter(Boolean).slice(0, 2);
        if (!aiOnly.length) throw new Error('No AI studio image on retry');
        const pairs = await uploadBufferPairs(uploadToNocoDB, aiOnly, `ai-${sellerSku}`);
        console.log(`AI studio images uploaded on retry: ${pairs.length}`);
        return pairs;
      } catch (e2) {
        console.error('AI images retry failed:', e2.message);
        aiFailures.push(`images:${e2.message}`);
        return [];
      }
    }
  })();

  const [copyResult, imagePairs] = await Promise.all([
    copyPromise,
    imagesPromise,
  ]);

  copy = copyResult;
  const aiPairs = imagePairs || [];
  aiUploads = aiPairs.map((p) => p.file);

  // If copy still empty, one more dedicated retry after images finished.
  if (!copy) {
    try {
      copy = await runCopyOnce();
      console.log('Landing copy: late retry OK');
    } catch (e) {
      console.error('AI copy late retry failed:', e.message);
    }
  }

  // No barcode reading — skip entirely.
  const barcode = '';

  // Specs: HTML in description + one French gallery card from packaging text.
  let hasSpecsImage = false;
  let specsUploads = [];
  let specsPairs = [];
  if (copy) {
    try {
      const packagingSpecs = (Array.isArray(copy.packaging_specs) ? copy.packaging_specs : [])
        .map((s) => String(s || '').replace(/<[^>]*>/g, '').trim())
        .filter(Boolean)
        .slice(0, 6);
      const bulletsFr = packagingSpecs.length
        ? packagingSpecs
        : bulletsFromHtml(
          copy.short_description_fr || copy.description_french || '',
          6
        );
      const bulletsAr = bulletsFromHtml(
        copy.short_description_ar || copy.description_arabic || '',
        6
      );
      const arBlock = buildHtmlSpecsCard({
        title: copy.arabic_title || displayName,
        bullets: bulletsAr.length ? bulletsAr : bulletsFr,
        brand: copy.brand,
        color: copy.color,
        sku: sellerSku,
        price,
        lang: 'ar',
      });
      const frBlock = buildHtmlSpecsCard({
        title: copy.french_title || displayName,
        bullets: bulletsFr.length ? bulletsFr : bulletsAr,
        brand: copy.brand,
        color: copy.color,
        sku: sellerSku,
        price,
        lang: 'fr',
      });
      copy.description_arabic = injectSpecsIntoDescription(copy.description_arabic, arBlock);
      copy.description_french = injectSpecsIntoDescription(copy.description_french, frBlock);

      // Gallery card uses Latin/French text so Alpine SVG fonts stay readable.
      if (bulletsFr.length) {
        const specsJpeg = await renderSpecsCard({
          title: copy.french_title || displayName,
          bullets: bulletsFr,
          brand: copy.brand,
          color: copy.color,
          sku: sellerSku,
          price,
          lang: 'fr',
        });
        specsPairs = await uploadBufferPairs(uploadToNocoDB, [specsJpeg], `specs-${sellerSku}`);
        specsUploads = specsPairs.map((p) => p.file);
        hasSpecsImage = specsUploads.length > 0;
        console.log(`Packaging specs gallery card uploaded: ${specsUploads.length}`);
      } else {
        hasSpecsImage = true;
        console.log('HTML specs card injected into description (no gallery card)');
      }
    } catch (e) {
      console.error('Specs card failed:', e.message);
      aiFailures.push(`specs:${e.message}`);
    }
  }

  const galleryCandidates = [
    ...aiPairs.map((p, i) => ({
      id: `ai-${i + 1}`,
      kind: 'ai',
      label: `ستوديو ${i + 1}`,
      file: p.file,
      buffer: p.buffer,
      selected: true,
    })),
    ...specsPairs.map((p) => ({
      id: 'specs',
      kind: 'specs',
      label: 'بطاقة مواصفات',
      file: p.file,
      buffer: p.buffer,
      selected: true,
    })),
    ...realPairs.map((p) => ({
      id: 'real',
      kind: 'real',
      label: 'الأصل (عرض)',
      file: p.file,
      buffer: p.buffer,
      selected: false,
    })),
  ];

  const nocoImages = orderGalleryUploads({
    aiUploads,
    specsUploads,
    amazonUploads,
    // Never put raw seller photos alone in the gallery if studio AI failed.
    realUploads: aiUploads.length ? originalUploads : [],
  });
  // Fallback if ordering somehow empty
  const finalImages = nocoImages.length
    ? nocoImages
    : (aiUploads.length ? aiUploads : (amazonUploads.length ? amazonUploads : []));
  const imageUrls = finalImages.map((f) => publicUrlFromNoco(f, nocodbUrl));

  const productForSheet = {
    referenceClean,
    sellerSku,
    price,
    wholesalePrice: price,
    postebl,
    frenchTitle: copy?.french_title || displayName,
    arabicTitle: copy?.arabic_title || name,
    shortFr: copy?.short_description_fr || '',
    shortAr: copy?.short_description_ar || '',
    descriptionFr: copy?.description_french || amazonMeta?.description || '',
    descriptionAr: copy?.description_arabic || '',
    metaTitle: copy?.meta_title || copy?.french_title || displayName,
    metaDescription: copy?.meta_description || '',
    wooTitle: copy?.woo_title || copy?.french_title || displayName,
    brand: JUMIA_SHEET_DEFAULTS.brand,
    color: copy?.color || JUMIA_SHEET_DEFAULTS.color,
    colorFamily: JUMIA_SHEET_DEFAULTS.colorFamily,
    variation: JUMIA_SHEET_DEFAULTS.variation,
    productWeight: JUMIA_SHEET_DEFAULTS.productWeight,
    jumiaCategory: JUMIA_SHEET_DEFAULTS.category,
    amazonUrl: amazonUrl || amazonMeta?.url || '',
    imageUrls,
    stock: JUMIA_SHEET_DEFAULTS.stock,
  };

  // Sheet/Jumia wait until the seller approves gallery images in Telegram
  // (unless caller forces sync — e.g. tests). Default: defer.
  const deferPublish = String(process.env.GALLERY_APPROVAL || 'true').toLowerCase() !== 'false';
  const sheetResult = deferPublish
    ? { skipped: true, reason: 'awaiting_gallery_approval' }
    : await maybeSyncSheet(productForSheet, syncSheet);
  const jumiaResult = deferPublish
    ? { skipped: true, reason: 'awaiting_gallery_approval' }
    : await maybeSyncJumia(productForSheet, syncJumia);

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
    jumia: jumiaResult,
    productForSheet,
    galleryCandidates,
    nocodbUrl,
    aiFailures,
    hasAiImages: aiUploads.length > 0,
    hasSpecsImage,
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

  // Never write barcode from enrichment.
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
