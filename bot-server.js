/**
 * IMDEN TECHNOLOGY - Telegram Bot Server
 * =====================================================
 * A standalone Node.js webhook server that:
 * 1. Receives a Telegram photo with caption (price, name, ref)
 * 2. Uploads the image to NocoDB and creates a product row
 * 3. Sends an inline keyboard to choose the product category
 * 4. On button press → updates NocoDB row + confirms to the user
 *
 * Setup:
 *   npm install express axios form-data dotenv
 *   node bot-server.js
 */

import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import FormData from 'form-data';

const app = express();
app.use(express.json());

// ─── CONFIG ────────────────────────────────────────────────────────────────
const BOT_TOKEN      = process.env.TELEGRAM_BOT_TOKEN;          // e.g. 123456:ABC-DEF...
const NOCODB_URL     = process.env.VITE_NOCODB_URL;             // https://app.nocodb.com
const NOCODB_TOKEN   = process.env.VITE_NOCODB_API_TOKEN;       // xc-token ...
const NOCODB_TABLE   = process.env.VITE_NOCODB_TABLE_PRODUCTS;  // mpdn1jwettle7mj
const TG_API         = `https://api.telegram.org/bot${BOT_TOKEN}`;
const TG_FILE_API    = `https://api.telegram.org/file/bot${BOT_TOKEN}`;

// ─── CATEGORY MAP ──────────────────────────────────────────────────────────
const CATEGORIES = {
  1:  '🔌 شواحن',
  2:  '🎧 سماعات',
  3:  '⌚ ساعات ذكية',
  4:  '🎮 ألعاب',
  5:  '🖱️ ماوس وكيبورد',
  6:  '💾 تخزين',
  7:  '💻 شواحن حواسيب',
  8:  '📐 ستاندات',
  9:  '💡 إضاءة',
  10: '📷 كاميرات',
  11: '📡 شبكات',
  12: '📦 عام',
  13: '🎙️ ميكروفونات',
  14: '🔋 بطاريات وباوربانك'
};

// Build the 7-row 2-column inline keyboard
function buildCategoryKeyboard(rowId) {
  const catIds = [1,2,3,4,5,6,7,8,9,10,11,12,13,14];
  const rows = [];
  for (let i = 0; i < catIds.length; i += 2) {
    const row = [];
    for (let j = i; j < i + 2 && j < catIds.length; j++) {
      const id = catIds[j];
      row.push({ text: CATEGORIES[id], callback_data: `cat_${id}_row_${rowId}` });
    }
    rows.push(row);
  }
  return { inline_keyboard: rows };
}

// ─── HELPERS ───────────────────────────────────────────────────────────────

// Send a Telegram message with optional inline keyboard
async function sendMessage(chatId, text, replyMarkup = null) {
  const params = { chat_id: chatId, text };
  if (replyMarkup) params.reply_markup = JSON.stringify(replyMarkup);
  await axios.post(`${TG_API}/sendMessage`, params);
}

// Edit an existing message text and remove its keyboard
async function editMessage(chatId, messageId, text) {
  await axios.post(`${TG_API}/editMessageText`, {
    chat_id: chatId,
    message_id: messageId,
    text,
    reply_markup: JSON.stringify({ inline_keyboard: [] })
  });
}

// Answer a callback query (pops a toast on the phone)
async function answerCallback(callbackQueryId, text) {
  await axios.post(`${TG_API}/answerCallbackQuery`, {
    callback_query_id: callbackQueryId,
    text,
    show_alert: false
  });
}

// Download a Telegram file as a Buffer
async function downloadTelegramFile(fileId) {
  // Step 1: get file path
  const { data } = await axios.get(`${TG_API}/getFile`, { params: { file_id: fileId } });
  const filePath = data.result.file_path;

  // Step 2: download
  const response = await axios.get(`${TG_FILE_API}/${filePath}`, { responseType: 'arraybuffer' });
  const buffer = Buffer.from(response.data);
  const fileName = filePath.split('/').pop(); // e.g. "photo_123.jpg"
  return { buffer, fileName };
}

// Upload image to NocoDB and create a product row
async function createNocoDBRow(productName, productSku, productPrice, imageBuffer, imageFileName) {
  const url = `${NOCODB_URL}/api/v2/tables/${NOCODB_TABLE}/records`;

  // NocoDB expects multipart/form-data to upload a file attachment
  const form = new FormData();
  form.append('Title',       productName);
  form.append('SKU',         productSku);
  form.append('price',       String(productPrice));
  form.append('Category_ID', '12');   // default: General
  form.append('POSTEBL',     'POSTEBL');
  form.append('Image1',      imageBuffer, { filename: imageFileName, contentType: 'image/jpeg' });

  const { data } = await axios.post(url, form, {
    headers: {
      'xc-token': NOCODB_TOKEN,
      ...form.getHeaders()
    }
  });

  return data.Id || data.id;
}

// Update only the Category_ID of an existing row
async function updateNocoDBCategory(rowId, categoryId) {
  const url = `${NOCODB_URL}/api/v2/tables/${NOCODB_TABLE}/records`;
  await axios.patch(url, { Id: rowId, Category_ID: categoryId }, {
    headers: { 'xc-token': NOCODB_TOKEN, 'Content-Type': 'application/json' }
  });
}

// ─── CAPTION PARSER ────────────────────────────────────────────────────────
function parseCaption(caption) {
  const lines = (caption || '').split('\n').map(l => l.trim()).filter(Boolean);

  const priceMatch = (lines[0] || '0').match(/(\d+[.,]?\d*)/);
  const price      = priceMatch ? parseFloat(priceMatch[0]) : 0;
  const name       = lines[1] || 'منتج غير محدد';
  const sku        = lines[2] || lines[1] || 'REF-000';

  return { price, name, sku };
}

// ─── WEBHOOK ENDPOINT ──────────────────────────────────────────────────────
app.post('/webhook', async (req, res) => {
  // Acknowledge immediately so Telegram doesn't retry
  res.sendStatus(200);

  const update = req.body;

  try {
    // ── 1. PHOTO MESSAGE ───────────────────────────────────────────────────
    if (update.message && update.message.photo) {
      const msg    = update.message;
      const chatId = msg.chat.id;

      // Largest available resolution
      const photo  = msg.photo[msg.photo.length - 1];
      const { price, name, sku } = parseCaption(msg.caption);

      console.log(`📦 New product: "${name}" | ${price} DH | SKU: ${sku}`);

      // Download photo
      const { buffer, fileName } = await downloadTelegramFile(photo.file_id);

      // Create NocoDB row
      const rowId = await createNocoDBRow(name, sku, price, buffer, fileName);
      console.log(`✅ NocoDB row created: #${rowId}`);

      // Send keyboard
      const keyboard = buildCategoryKeyboard(rowId);
      await sendMessage(
        chatId,
        `✅ تم حفظ المنتج #${rowId}\n\n📦 ${name}\n💰 ${price} DH | 📋 ${sku}\n\n⬇️ اختر تصنيف المنتج:`,
        keyboard
      );
    }

    // ── 2. CATEGORY BUTTON PRESS ───────────────────────────────────────────
    else if (update.callback_query) {
      const cb      = update.callback_query;
      const chatId  = cb.message.chat.id;
      const msgId   = cb.message.message_id;
      const data    = cb.data; // e.g. "cat_1_row_450"

      const parts   = data.split('_');
      const catId   = parseInt(parts[1]);
      const rowId   = parseInt(parts[3]);
      const catName = CATEGORIES[catId] || '📦 عام';

      console.log(`🏷️ Assigning category ${catName} to row #${rowId}`);

      // Update NocoDB
      await updateNocoDBCategory(rowId, catId);

      // Answer toast notification on phone
      await answerCallback(cb.id, `تم: ${catName}`);

      // Edit message and remove buttons
      await editMessage(
        chatId, msgId,
        `✅ تم تصنيف المنتج #${rowId} بنجاح!\n\n📂 التصنيف: ${catName}\n🌐 سيظهر على الموقع خلال لحظات.`
      );
    }

  } catch (err) {
    console.error('❌ Error:', err?.response?.data || err.message);
  }
});

// ─── HEALTH CHECK ──────────────────────────────────────────────────────────
app.get('/', (req, res) => res.json({ status: 'IMDEN Bot is running ✅' }));

// ─── START ─────────────────────────────────────────────────────────────────
const PORT = process.env.BOT_PORT || 3001;
app.listen(PORT, () => {
  console.log(`🤖 IMDEN Bot server running on port ${PORT}`);
  console.log(`📌 Set Telegram webhook to: https://YOUR_DOMAIN.com/webhook`);
});
