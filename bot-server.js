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
const BOT_TOKEN      = process.env.TELEGRAM_BOT_TOKEN;
const NOCODB_URL     = process.env.VITE_NOCODB_URL;
const NOCODB_TOKEN   = process.env.VITE_NOCODB_API_TOKEN;
const NOCODB_TABLE   = process.env.VITE_NOCODB_TABLE_PRODUCTS;
const TG_API         = `https://api.telegram.org/bot${BOT_TOKEN}`;
const TG_FILE_API    = `https://api.telegram.org/file/bot${BOT_TOKEN}`;

const CATEGORIES = {
  1:  '🔌 شواحن', 2:  '🎧 سماعات', 3:  '⌚ ساعات ذكية', 4:  '🎮 ألعاب',
  5:  '🖱️ ماوس وكيبورد', 6:  '💾 تخزين', 7:  '💻 شواحن حواسيب', 8:  '📐 ستاندات',
  9:  '💡 إضاءة', 10: '📷 كاميرات', 11: '📡 شبكات', 12: '📦 عام',
  13: '🎙️ ميكروفونات', 14: '🔋 بطاريات وباوربانك', 15: '❌ نفد من المخزون'
};

function buildCategoryKeyboard(rowId) {
  const catIds = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15];
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
async function sendMessage(chatId, text, replyMarkup = null) {
  const params = { chat_id: chatId, text };
  if (replyMarkup) params.reply_markup = JSON.stringify(replyMarkup);
  await axios.post(`${TG_API}/sendMessage`, params);
}

async function editMessage(chatId, messageId, text) {
  await axios.post(`${TG_API}/editMessageText`, {
    chat_id: chatId, message_id: messageId, text,
    reply_markup: JSON.stringify({ inline_keyboard: [] })
  });
}

async function answerCallback(callbackQueryId, text) {
  await axios.post(`${TG_API}/answerCallbackQuery`, {
    callback_query_id: callbackQueryId, text, show_alert: false
  });
}

async function downloadTelegramFile(fileId) {
  const { data } = await axios.get(`${TG_API}/getFile`, { params: { file_id: fileId } });
  const filePath = data.result.file_path;
  const response = await axios.get(`${TG_FILE_API}/${filePath}`, { responseType: 'arraybuffer' });
  const buffer = Buffer.from(response.data);
  const fileName = filePath.split('/').pop();
  return { buffer, fileName };
}

async function updateNocoDBCategory(rowId, categoryId) {
  const url = `${NOCODB_URL}/api/v2/tables/${NOCODB_TABLE}/records`;
  await axios.patch(url, { Id: rowId, Category_ID: categoryId }, {
    headers: { 'xc-token': NOCODB_TOKEN, 'Content-Type': 'application/json' }
  });
}

function parseCaption(caption) {
  const lines = (caption || '').split('\n').map(l => l.trim()).filter(Boolean);
  const priceMatch = (lines[0] || '0').match(/(\d+[.,]?\d*)/);
  const price      = priceMatch ? parseFloat(priceMatch[0]) : 0;
  const name       = lines[1] || 'منتج غير محدد';
  const sku        = lines[2] || lines[1] || 'REF-000';
  return { price, name, sku };
}

// ─── ALBUM PROCESSOR ───────────────────────────────────────────────────────
const albumBuffer = {};

async function processProduct(chatId, files, caption) {
  const { price, name, sku } = parseCaption(caption);
  console.log(`📦 Processing product: "${name}" | ${price} DH | ${files.length} images`);

  const uploadedFiles = [];
  
  // Upload all files to NocoDB Storage
  for (let f of files) {
    const { buffer, fileName } = await downloadTelegramFile(f.fileId);
    const finalFileName = fileName.includes('.') ? fileName : `image.${f.extName}`;
    
    const uploadUrl = `${NOCODB_URL}/api/v2/storage/upload`;
    const form = new FormData();
    form.append('file', buffer, { filename: finalFileName, contentType: 'image/jpeg' });
    
    const uploadRes = await axios.post(uploadUrl, form, {
      headers: { 'xc-token': NOCODB_TOKEN, ...form.getHeaders() }
    });
    uploadedFiles.push(...uploadRes.data);
  }

  // Create NocoDB Record
  const recordUrl = `${NOCODB_URL}/api/v2/tables/${NOCODB_TABLE}/records`;
  const recordData = {
    Title: name,
    SKU: sku,
    price: price,
    Category_ID: 12,
    POSTEBL: 'POSTEBL'
  };

  // Map files to separate columns (supporting both ImageX and imageX casings)
  if (uploadedFiles.length > 0) recordData.Image1 = [uploadedFiles[0]];
  if (uploadedFiles.length > 1) {
    recordData.Image2 = [uploadedFiles[1]];
    recordData.image2 = [uploadedFiles[1]];
  }
  if (uploadedFiles.length > 2) {
    recordData.Image3 = [uploadedFiles[2]];
    recordData.image3 = [uploadedFiles[2]];
  }
  if (uploadedFiles.length > 3) {
    recordData.Image4 = [uploadedFiles[3]];
    recordData.image4 = [uploadedFiles[3]];
  }
  if (uploadedFiles.length > 4) {
    recordData.Image5 = [uploadedFiles[4]];
    recordData.image5 = [uploadedFiles[4]];
  }

  const { data } = await axios.post(recordUrl, recordData, {
    headers: { 'xc-token': NOCODB_TOKEN, 'Content-Type': 'application/json' }
  });

  const rowId = data.Id || data.id;
  console.log(`✅ NocoDB row created: #${rowId}`);

  const keyboard = buildCategoryKeyboard(rowId);
  await sendMessage(
    chatId,
    `✅ تم حفظ المنتج #${rowId} مع (${files.length}) صور!\n\n📦 ${name}\n💰 ${price} DH | 📋 ${sku}\n\n⬇️ اختر تصنيف المنتج:`,
    keyboard
  );
}

const userState = {};

// ─── WEBHOOK ENDPOINT ──────────────────────────────────────────────────────
app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  const update = req.body;

  try {
    const msg = update.message;

    // ── 1. TEXT MESSAGES (Commands & States) ───────────────────────────────
    if (msg && msg.text) {
      const chatId = msg.chat.id;
      const text = msg.text.trim();

      if (text === '/start') {
        await sendMessage(chatId, "أهلاً بك في بوت إدارة الكتالوج! 📦\nيمكنك إرسال صور المنتجات لرفعها، أو استخدام الزر بالأسفل لإيقاف منتج معين.", {
          keyboard: [[{ text: "❌ إيقاف منتج (نفد المخزون)" }]],
          resize_keyboard: true,
          persistent: true
        });
        return;
      }

      if (text === "❌ إيقاف منتج (نفد المخزون)" || text.startsWith("/stop")) {
        userState[chatId] = 'AWAITING_REF';
        await sendMessage(chatId, "أرسل لي المرجع (REF) الخاص بالمنتج الذي تريد إيقافه:");
        return;
      }

      if (userState[chatId] === 'AWAITING_REF') {
        delete userState[chatId];
        const sku = text;
        
        // Search NocoDB for SKU
        const url = `${NOCODB_URL}/api/v2/tables/${NOCODB_TABLE}/records?where=(SKU,eq,${encodeURIComponent(sku)})`;
        const { data } = await axios.get(url, { headers: { 'xc-token': NOCODB_TOKEN } });
        
        if (data.list && data.list.length > 0) {
          const recordId = data.list[0].Id || data.list[0].id;
          
          await axios.patch(`${NOCODB_URL}/api/v2/tables/${NOCODB_TABLE}/records`, 
            { Id: recordId, POSTEBL: 'NO POSTEBL' }, 
            { headers: { 'xc-token': NOCODB_TOKEN, 'Content-Type': 'application/json' } }
          );
          await sendMessage(chatId, `✅ تم إيقاف المنتج (المرجع: ${sku}) بنجاح وتحويله إلى "نفد من المخزون".`);
        } else {
          await sendMessage(chatId, `❌ لم أتمكن من العثور على منتج يحمل المرجع: ${sku}\nتأكد من كتابته بشكل صحيح.`);
        }
        return;
      }
    }

    // ── 2. PHOTO OR DOCUMENT MESSAGE ───────────────────────────────────────
    if (msg && (msg.photo || (msg.document && msg.document.mime_type?.startsWith('image/')))) {
      const chatId = msg.chat.id;

      let fileId;
      let extName = 'jpg';
      if (msg.photo) {
        fileId = msg.photo[msg.photo.length - 1].file_id;
      } else {
        fileId = msg.document.file_id;
        if (msg.document.file_name) extName = msg.document.file_name.split('.').pop();
      }

      const groupId = msg.media_group_id;

      if (groupId) {
        if (!albumBuffer[groupId]) {
          albumBuffer[groupId] = {
            files: [],
            caption: '',
            chatId: chatId,
            timer: setTimeout(async () => {
              const album = albumBuffer[groupId];
              delete albumBuffer[groupId];
              await processProduct(album.chatId, album.files, album.caption);
            }, 3000)
          };
        }
        albumBuffer[groupId].files.push({ fileId, extName });
        if (msg.caption) albumBuffer[groupId].caption = msg.caption;
      } else {
        await processProduct(chatId, [{ fileId, extName }], msg.caption);
      }
    }

    // ── 3. CATEGORY BUTTON PRESS ───────────────────────────────────────────
    else if (update.callback_query) {
      const cb      = update.callback_query;
      const chatId  = cb.message.chat.id;
      const msgId   = cb.message.message_id;
      const data    = cb.data; 

      const parts   = data.split('_');
      const catId   = parseInt(parts[1]);
      const rowId   = parseInt(parts[3]);
      const catName = CATEGORIES[catId] || '📦 عام';

      await updateNocoDBCategory(rowId, catId);
      await answerCallback(cb.id, `تم: ${catName}`);
      await editMessage(
        chatId, msgId,
        `✅ تم تصنيف المنتج #${rowId} بنجاح!\n\n📂 التصنيف: ${catName}\n🌐 سيظهر على الموقع خلال لحظات.`
      );
    }
  } catch (err) {
    console.error('❌ Error:', err?.response?.data || err.message);
  }
});

app.get('/', (req, res) => res.json({ status: 'IMDEN Bot is running ✅' }));

const PORT = process.env.PORT || process.env.BOT_PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🤖 IMDEN Bot server running on port ${PORT}`);
});
