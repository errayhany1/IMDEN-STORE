/**
 * Append product rows to Google Sheet N8N AI1 (Jumia Upload Template format).
 * Preferred: PRODUCT_SHEET_WEBHOOK_URL (Apps Script doPost).
 *
 * Column names must match the Excel Jumia accepts:
 *   Upload Template: ParentSKU, Name, Name_AR, Description, ...
 *   Sheet1: reference_clean, SellerSKU, Jumia_Price, Jumia_Category, ...
 */
import axios from 'axios';
import { buildJumiaOffer } from './jumiaPricing.js';
import { ensurePublicImageUrls } from './jumiaPublicImages.js';
import { getBotSetting } from './runtimeSettings.js';

const SHEET_ID = process.env.PRODUCT_SHEET_ID || '1zuRmrjaMjTsvN7j822b5w6v3NR3Dh_TclhFyFKXx5h4';
const WEBHOOK = process.env.PRODUCT_SHEET_WEBHOOK_URL || '';

/** Defaults taken from working Jumia "N8N AI1" Upload Template exports. */
export const JUMIA_SHEET_DEFAULTS = new Proxy({}, {
  get(_target, key) {
    return ({
      brand: getBotSetting('jumiaDefaultBrand'),
      category: getBotSetting('jumiaDefaultCategory'),
      color: getBotSetting('jumiaDefaultColor'),
      colorFamily: getBotSetting('jumiaDefaultColorFamily'),
      variation: getBotSetting('jumiaDefaultVariation'),
      productWeight: getBotSetting('jumiaDefaultWeight'),
      stock: getBotSetting('jumiaDefaultStock'),
    })[key];
  },
});

export function buildSheetPayload(product) {
  const now = new Date().toISOString();
  const brand = product.brand || JUMIA_SHEET_DEFAULTS.brand;
  const category = product.jumiaCategory || JUMIA_SHEET_DEFAULTS.category;
  const color = product.color || JUMIA_SHEET_DEFAULTS.color;
  const weight = product.productWeight ?? JUMIA_SHEET_DEFAULTS.productWeight;
  const images = Array.isArray(product.imageUrls) ? product.imageUrls : [];
  const wholesale = Number(product.wholesalePrice ?? product.price ?? 0) || 0;
  const offer = buildJumiaOffer({
    wholesale,
    postebl: product.postebl || product.POSTEBL || 'POSTEBL',
    sku: product.sellerSku || product.referenceClean || '',
  });
  const stock = offer.stock;
  const listPrice = offer.listPrice;
  const salePrice = offer.salePrice;

  return {
    sheetId: SHEET_ID,
    sheet1: {
      reference_clean: product.referenceClean,
      SellerSKU: product.sellerSku,
      Jumia_Price: salePrice,
      Jumia_List_Price: listPrice,
      Jumia_Category: category,
      French_Title: product.frenchTitle,
      Arabic_Title: product.arabicTitle,
      Feature_Bullets: product.shortFr,
      description_french: product.descriptionFr,
      description_arabic: product.descriptionAr,
      Creation_date: now,
      Meta_Title: product.metaTitle,
      Meta_Description: product.metaDescription,
      Amazon_URL: product.amazonUrl || '',
      Woo_Cat_ID: '',
      Woo_Cat_Name: '',
      Woo_Title: product.wooTitle,
      image_url1: images[0] || '',
      image_url2: images[1] || '',
      image_url3: images[2] || '',
      image_url4: images[3] || '',
      image_url5: images[4] || '',
      image_url6: images[5] || '',
    },
    // Exact headers Jumia accepts in "Upload Template"
    uploadTemplate: {
      ParentSKU: product.referenceClean,
      Name: product.frenchTitle,
      Name_AR: product.arabicTitle,
      Description: product.descriptionFr,
      Description_AR: product.descriptionAr,
      short_description: product.shortFr,
      SellerSKU: product.sellerSku,
      Price_MAD: listPrice,
      SalePrice: salePrice,
      SaleStartDate: offer.saleStartDate,
      SaleEndDate: offer.saleEndDate,
      PrimaryCategory: category,
      Amazon_URL: product.amazonUrl || '',
      MainImage: images[0] || '',
      Image2: images[1] || '',
      Image3: images[2] || '',
      Image4: images[3] || '',
      Image5: images[4] || '',
      Image6: images[5] || '',
      Image7: images[6] || '',
      Image8: images[7] || '',
      size: product.size || '',
      Stock: stock,
      color_family: product.colorFamily || JUMIA_SHEET_DEFAULTS.colorFamily,
      Brand: brand,
      product_weight: weight,
      variation: product.variation || JUMIA_SHEET_DEFAULTS.variation,
      color,
    },
  };
}

export async function appendProductToSheet(product) {
  if (!WEBHOOK) {
    console.warn('PRODUCT_SHEET_WEBHOOK_URL missing — sheet append skipped');
    return { skipped: true, reason: 'no_webhook' };
  }

  const sku = product.sellerSku || product.SellerSKU || product.referenceClean || 'img';
  const rawImages = Array.isArray(product.imageUrls) ? product.imageUrls : [];
  // Never write NocoDB signed URLs into the Jumia sheet.
  if (rawImages.length && rawImages.some((u) => !/\/bot-api\/public-images\/p\//i.test(String(u || '')))) {
    try {
      const durable = await ensurePublicImageUrls(rawImages, {
        sku: product.publicImageSku || sku,
        startIndex: product.publicImageStartIndex || 1,
      });
      if (durable.length) product.imageUrls = durable;
    } catch (e) {
      console.warn('[sheet] ensurePublicImageUrls failed:', e.message);
    }
  }

  const payload = buildSheetPayload(product);
  const { data, status } = await axios.post(WEBHOOK, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000,
  });
  return { skipped: false, status, data, sellerSku: product.sellerSku, imageUrls: product.imageUrls };
}

export function isSheetWebhookConfigured() {
  return Boolean(WEBHOOK) && Boolean(getBotSetting('sheetSyncEnabled'));
}
