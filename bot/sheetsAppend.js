/**
 * Append product rows to Google Sheet N8N AI1 (Jumia Upload Template format).
 * Preferred: PRODUCT_SHEET_WEBHOOK_URL (Apps Script doPost).
 *
 * Column names must match the Excel Jumia accepts:
 *   Upload Template: ParentSKU, Name, Name_AR, Description, ...
 *   Sheet1: reference_clean, SellerSKU, Jumia_Price, Jumia_Category, ...
 */
import axios from 'axios';

const SHEET_ID = process.env.PRODUCT_SHEET_ID || '1zuRmrjaMjTsvN7j822b5w6v3NR3Dh_TclhFyFKXx5h4';
const WEBHOOK = process.env.PRODUCT_SHEET_WEBHOOK_URL || '';

/** Defaults taken from working Jumia "N8N AI1" Upload Template exports. */
export const JUMIA_SHEET_DEFAULTS = {
  brand: (process.env.JUMIA_DEFAULT_BRAND || '1045133 - Generic').trim(),
  category: (
    process.env.JUMIA_DEFAULT_CATEGORY
    || '1000040 - Electronics / Accessories / Gadgets'
  ).trim(),
  color: 'Multicolore',
  colorFamily: 'Multicolore',
  variation: '...',
  productWeight: 1,
  stock: 10,
};

export function buildSheetPayload(product) {
  const now = new Date().toISOString();
  const brand = product.brand || JUMIA_SHEET_DEFAULTS.brand;
  const category = product.jumiaCategory || JUMIA_SHEET_DEFAULTS.category;
  const color = product.color || JUMIA_SHEET_DEFAULTS.color;
  const stock = product.stock ?? JUMIA_SHEET_DEFAULTS.stock;
  const weight = product.productWeight ?? JUMIA_SHEET_DEFAULTS.productWeight;
  const images = Array.isArray(product.imageUrls) ? product.imageUrls : [];

  return {
    sheetId: SHEET_ID,
    sheet1: {
      reference_clean: product.referenceClean,
      SellerSKU: product.sellerSku,
      Jumia_Price: product.price,
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
      Price_MAD: product.price,
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

  const payload = buildSheetPayload(product);
  const { data, status } = await axios.post(WEBHOOK, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000,
  });
  return { skipped: false, status, data, sellerSku: product.sellerSku };
}

export function isSheetWebhookConfigured() {
  return Boolean(WEBHOOK);
}
