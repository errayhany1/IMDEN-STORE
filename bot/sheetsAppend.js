/**
 * Append product rows to Google Sheet N8N AI1.
 * Preferred: PRODUCT_SHEET_WEBHOOK_URL (Apps Script doPost).
 * Optional: GOOGLE_SERVICE_ACCOUNT_JSON for direct Sheets API later.
 */
import axios from 'axios';

const SHEET_ID = process.env.PRODUCT_SHEET_ID || '1zuRmrjaMjTsvN7j822b5w6v3NR3Dh_TclhFyFKXx5h4';
const WEBHOOK = process.env.PRODUCT_SHEET_WEBHOOK_URL || '';

export function buildSheetPayload(product) {
  const now = new Date().toISOString();
  return {
    sheetId: SHEET_ID,
    sheet1: {
      reference_clean: product.referenceClean,
      SellerSKU: product.sellerSku,
      Jumia_Price: product.price,
      Jumia_Category: product.jumiaCategory || '',
      French_Title: product.frenchTitle,
      Arabic_Title: product.arabicTitle,
      Feature_Bullets: product.shortFr,
      description_french: product.descriptionFr,
      description_arabic: product.descriptionAr,
      Creation_date: now,
      Meta_Title: product.metaTitle,
      Meta_Description: product.metaDescription,
      Woo_Cat_ID: '',
      Woo_Cat_Name: '',
      Woo_Title: product.wooTitle,
      image_url1: product.imageUrls[0] || '',
      image_url2: product.imageUrls[1] || '',
      image_url3: product.imageUrls[2] || '',
      image_url4: product.imageUrls[3] || '',
      image_url5: product.imageUrls[4] || '',
      image_url6: product.imageUrls[5] || '',
    },
    uploadTemplate: {
      ParentSKU: product.referenceClean,
      Name: product.frenchTitle,
      Name_AR: product.arabicTitle,
      Description: product.descriptionFr,
      Description_AR: product.descriptionAr,
      short_description: product.shortFr,
      SellerSKU: product.sellerSku,
      Price_MAD: product.price,
      PrimaryCategory: product.jumiaCategory || '',
      MainImage: product.imageUrls[0] || '',
      Image2: product.imageUrls[1] || '',
      Image3: product.imageUrls[2] || '',
      Image4: product.imageUrls[3] || '',
      Image5: product.imageUrls[4] || '',
      Image6: product.imageUrls[5] || '',
      Image7: '',
      Image8: '',
      size: '',
      Stock: product.stock ?? 10,
      color_family: product.color || 'Multicolore',
      Brand: product.brand || 'Generic',
      product_weight: 1,
      variation: '...',
      color: product.color || 'Multicolore',
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
  return { skipped: false, status, data };
}

export function isSheetWebhookConfigured() {
  return Boolean(WEBHOOK);
}
