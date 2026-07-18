/**
 * Google Apps Script for N8N AI1 spreadsheet.
 *
 * Setup (once):
 * 1. Open https://docs.google.com/spreadsheets/d/1zuRmrjaMjTsvN7j822b5w6v3NR3Dh_TclhFyFKXx5h4
 * 2. Extensions → Apps Script
 * 3. Paste this file, Save
 * 4. Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy the Web App URL into EasyPanel env:
 *    PRODUCT_SHEET_WEBHOOK_URL=https://script.google.com/macros/s/.../exec
 */

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const ss = SpreadsheetApp.openById(body.sheetId || SpreadsheetApp.getActiveSpreadsheet().getId());

    if (body.sheet1) {
      appendObjectRow_(ss, 'Sheet1', body.sheet1, [
        'id for the record', 'id', 'reference_clean', 'SellerSKU', 'Jumia_Price', 'Jumia_Category',
        'French_Title', 'Arabic_Title', 'Feature_Bullets', 'description_french', 'description_arabic',
        'Creation_date', 'Meta_Title', 'Meta_Description', 'Woo_Cat_ID', 'Woo_Cat_Name', 'Woo_Title',
        'image_url1', 'image_url2', 'image_url3', 'image_url4', 'image_url5', 'image_url6', 'Id'
      ]);
    }

    if (body.uploadTemplate) {
      appendObjectRow_(ss, 'Upload Template', body.uploadTemplate, [
        'ParentSKU', 'Name', 'Name_AR', 'Description', 'Description_AR', 'short_description',
        'SellerSKU', 'Price_MAD', 'PrimaryCategory', 'MainImage', 'Image2', 'Image3', 'Image4',
        'Image5', 'Image6', 'Image7', 'Image8', 'size', 'Stock', 'color_family', 'Brand',
        'product_weight', 'variation', 'color'
      ]);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function appendObjectRow_(ss, sheetName, obj, preferredHeaders) {
  const sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  const lastCol = Math.max(sheet.getLastColumn(), preferredHeaders.length);
  let headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  if (!headers.filter(Boolean).length) {
    sheet.getRange(1, 1, 1, preferredHeaders.length).setValues([preferredHeaders]);
    headers = preferredHeaders;
  }

  const row = headers.map((h) => {
    if (h == null || h === '') return '';
    const key = String(h).trim();
    if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key];
    return '';
  });
  sheet.appendRow(row);
}
