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
 *   npm start   (from /bot)
 *   or: node server.js
 */

import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import FormData from 'form-data';
import {
  enrichProduct,
  buildNocoRecordFromEnrichment,
  buildSellerSku,
} from './productEnrichment.js';

const app = express();
app.use(express.json());

// ─── CONFIG ────────────────────────────────────────────────────────────────
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.VITE_TELEGRAM_BOT_TOKEN;
const NOCODB_URL = process.env.VITE_NOCODB_URL || process.env.NOCODB_URL;
const NOCODB_TOKEN = process.env.VITE_NOCODB_API_TOKEN || process.env.NOCODB_API_TOKEN;
const NOCODB_TABLE = process.env.VITE_NOCODB_TABLE_PRODUCTS || process.env.NOCODB_TABLE_PRODUCTS;
const SITE_URL = process.env.PUBLIC_SITE_URL || 'https://errayhany.com';

function assertBotConfig() {
  const missing = [];
  if (!BOT_TOKEN) missing.push('TELEGRAM_BOT_TOKEN');
  if (!NOCODB_URL) missing.push('VITE_NOCODB_URL');
  if (!NOCODB_TOKEN) missing.push('VITE_NOCODB_API_TOKEN');
  if (!NOCODB_TABLE) missing.push('VITE_NOCODB_TABLE_PRODUCTS');
  if (missing.length) {
    console.error('❌ Missing required env:', missing.join(', '));
    return false;
  }
  return true;
}
const TG_API         = `https://api.telegram.org/bot${BOT_TOKEN}`;
const TG_FILE_API    = `https://api.telegram.org/file/bot${BOT_TOKEN}`;

const CATEGORIES = {
  1:  '🔌 شواحن', 2:  '🎧 سماعات', 3:  '⌚ ساعات ذكية', 4:  '🎮 ألعاب',
  5:  '🖱️ ماوس وكيبورد', 6:  '💾 تخزين', 7:  '💻 شواحن حواسيب', 8:  '📐 ستاندات',
  9:  '💡 إضاءة', 10: '📷 كاميرات', 11: '📡 شبكات', 12: '📦 عام',
  13: '🎙️ ميكروفونات', 14: '🔋 بطاريات وباوربانك',
  16: '🔗 كابلات', 17: '🚗 إكسسوارات السيارة'
};

function buildCategoryKeyboard(rowId) {
  const catIds = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,16,17];
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

// ─── AXIOS INSTANCE WITH TIMEOUT ──────────────────────────────────────────
const http = axios.create({ timeout: 120000 }); // uploads + telegram files

async function downloadTelegramFileData(fileId, extName) {
  const { data } = await http.get(`${TG_API}/getFile`, { params: { file_id: fileId } });
  const filePath = data.result.file_path;
  const response = await http.get(`${TG_FILE_API}/${filePath}`, { responseType: 'arraybuffer' });
  const buffer = Buffer.from(response.data);
  const fileName = filePath.split('/').pop().includes('.') ? filePath.split('/').pop() : `image.${extName}`;
  return { buffer, fileName };
}

async function uploadToNocoDB(buffer, fileName) {
  const uploadUrl = `${NOCODB_URL}/api/v2/storage/upload`;
  const form = new FormData();
  form.append('file', buffer, { filename: fileName, contentType: 'image/jpeg' });
  const uploadRes = await http.post(uploadUrl, form, {
    headers: { 'xc-token': NOCODB_TOKEN, ...form.getHeaders() }
  });
  return uploadRes.data[0];
}

async function updateNocoDBCategory(rowId, categoryId) {
  const url = `${NOCODB_URL}/api/v2/tables/${NOCODB_TABLE}/records`;
  await http.patch(url, { Id: rowId, Category_ID: categoryId }, {
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

// ─── ALBUM BUFFER ──────────────────────────────────────────────────────────
const albumBuffer = {};

async function processProduct(chatId, files, caption) {
  const { price, name, sku } = parseCaption(caption);
  const sellerSku = buildSellerSku(sku);
  console.log(`📦 Processing product: "${name}" | ${price} DH | ${files.length} images | SKU ${sellerSku}`);

  await sendMessage(
    chatId,
    `⏳ جاري رفع المنتج وتوليد النصوص/الصور بالذكاء الاصطناعي...\n📦 ${name}\n💰 ${price} DH\n📋 ${sellerSku}`
  );

  // Download all Telegram images first (buffers)
  const downloaded = await Promise.all(
    files.map(async (f) => {
      try {
        return await downloadTelegramFileData(f.fileId, f.extName);
      } catch (e) {
        console.error('Telegram download error:', e.message);
        return null;
      }
    })
  );
  const originalBuffers = downloaded.filter(Boolean).map((d) => d.buffer);
  if (!originalBuffers.length) {
    await sendMessage(chatId, '❌ فشل تحميل الصور من تيليجرام. أعد الإرسال.');
    return;
  }

  let enrichment;
  try {
    enrichment = await enrichProduct({
      originalBuffers,
      name,
      price,
      ref: sku,
      uploadToNocoDB,
      nocodbUrl: NOCODB_URL,
    });
  } catch (e) {
    console.error('AI enrichment failed, falling back to raw upload:', e.message);
    await sendMessage(chatId, `⚠️ فشل التوليد بالذكاء الاصطناعي، سيتم الحفظ بالصور الأصلية فقط.\n${e.message}`);
    const uploadedFiles = [];
    for (const d of downloaded.filter(Boolean)) {
      uploadedFiles.push(await uploadToNocoDB(d.buffer, d.fileName));
    }
    enrichment = {
      sellerSku,
      skippedAi: true,
      copy: null,
      nocoImages: uploadedFiles,
      sheet: { skipped: true },
    };
  }

  if (!enrichment?.nocoImages?.length) {
    await sendMessage(chatId, '❌ فشل رفع الصور إلى NocoDB. أعد إرسال المنتج.');
    return;
  }

  const recordUrl = `${NOCODB_URL}/api/v2/tables/${NOCODB_TABLE}/records`;
  // Always attach images (AI or originals) via the shared builder
  let recordData = buildNocoRecordFromEnrichment({ price, name, enrichment });

  let data;
  try {
    ({ data } = await http.post(recordUrl, recordData, {
      headers: { 'xc-token': NOCODB_TOKEN, 'Content-Type': 'application/json' },
    }));
  } catch (e) {
    // Retry without optional AI text columns if NocoDB rejects unknown fields
    console.error('NocoDB create failed, retrying minimal fields:', e?.response?.data || e.message);
    const minimal = {
      Title: recordData.Title || name,
      Arabic_Title: recordData.Arabic_Title,
      French_Title: recordData.French_Title,
      SKU: sellerSku,
      price,
      Category_ID: 12,
      POSTEBL: 'POSTEBL',
      description_arabic: recordData.description_arabic || '',
      Image1: recordData.Image1,
      Image2: recordData.Image2,
      Image3: recordData.Image3,
      Image4: recordData.Image4,
      Image5: recordData.Image5,
    };
    ({ data } = await http.post(recordUrl, minimal, {
      headers: { 'xc-token': NOCODB_TOKEN, 'Content-Type': 'application/json' },
    }));
  }

  const rowId = data.Id || data.id;
  const landing = `${SITE_URL}/p/${encodeURIComponent(sellerSku)}`;
  const imgCount = enrichment.nocoImages?.length || 0;
  const sheetNote = enrichment.sheet?.skipped
    ? '\n📄 Sheet: لم يُربط بعد (أضف PRODUCT_SHEET_WEBHOOK_URL)'
    : enrichment.sheet?.error
      ? `\n📄 Sheet خطأ: ${enrichment.sheet.error}`
      : '\n📄 Sheet: تم الإرسال';

  console.log(`✅ NocoDB row created: #${rowId}`);

  const keyboard = buildCategoryKeyboard(rowId);
  await sendMessage(
    chatId,
    `✅ تم حفظ المنتج #${rowId} مع (${imgCount}) صور!\n\n📦 ${recordData.Title || name}\n💰 ${price} DH | 📋 ${sellerSku}\n🔗 صفحة الهبوط: ${landing}${sheetNote}\n\n⬇️ اختر تصنيف المنتج:`,
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

      // Mode labels for user feedback
      const modeLabels = {
        'AWAITING_REF_STOP': '❌ وضع إيقاف المنتجات',
        'AWAITING_REF_RESTOCK': '✅ وضع إعادة التوفر',
        'AWAITING_REF_CATEGORY': '📂 وضع تغيير التصنيف',
        'AWAITING_REF_PRICE': '💰 وضع تغيير السعر'
      };

      if (text === '/start' || text === '🔄 إعادة تشغيل البوت') {
        delete userState[chatId];
        await sendMessage(chatId, "أهلاً بك في بوت إدارة الكتالوج! 📦\nيمكنك إرسال صور المنتجات لرفعها، أو استخدام الأزرار بالأسفل لإدارة المنتجات:\n\n💡 عند الضغط على أي زر، سيبقى فعالاً حتى تضغط على \"إعادة تشغيل البوت\".", {
          keyboard: [
            [{ text: "❌ إيقاف منتج (نفد المخزون)" }, { text: "✅ جعل المنتج متوفر" }],
            [{ text: "📂 تغيير تصنيف منتج" }, { text: "💰 تغيير سعر المنتج" }],
            [{ text: "🔄 إعادة تشغيل البوت" }]
          ],
          resize_keyboard: true,
          persistent: true
        });
        return;
      }

      if (text === "❌ إيقاف منتج (نفد المخزون)" || text.startsWith("/stop")) {
        userState[chatId] = 'AWAITING_REF_STOP';
        await sendMessage(chatId, "⚙️ تم تفعيل وضع إيقاف المنتجات.\n\nأرسل المرجع (REF) لكل منتج تريد إيقافه، واحداً تلو الآخر.\nللخروج من هذا الوضع اضغط: 🔄 إعادة تشغيل البوت");
        return;
      }

      if (text === "✅ جعل المنتج متوفر" || text.startsWith("/start_product")) {
        userState[chatId] = 'AWAITING_REF_RESTOCK';
        await sendMessage(chatId, "⚙️ تم تفعيل وضع إعادة التوفر.\n\nأرسل المرجع (REF) لكل منتج تريد جعله متوفراً، واحداً تلو الآخر.\nللخروج من هذا الوضع اضغط: 🔄 إعادة تشغيل البوت");
        return;
      }

      if (text === "📂 تغيير تصنيف منتج" || text.startsWith("/category")) {
        userState[chatId] = 'AWAITING_REF_CATEGORY';
        await sendMessage(chatId, "⚙️ تم تفعيل وضع تغيير التصنيف.\n\nأرسل المرجع (REF) لكل منتج تريد تغيير تصنيفه، واحداً تلو الآخر.\nللخروج من هذا الوضع اضغط: 🔄 إعادة تشغيل البوت");
        return;
      }

      if (text === "💰 تغيير سعر المنتج" || text.startsWith("/price")) {
        userState[chatId] = 'AWAITING_REF_PRICE';
        await sendMessage(chatId, "⚙️ تم تفعيل وضع تغيير السعر.\n\nأرسل المرجع (REF) للمنتج الذي تريد تغيير سعره.\nللخروج من هذا الوضع اضغط: 🔄 إعادة تشغيل البوت");
        return;
      }

      if (typeof userState[chatId] === 'string' && userState[chatId].startsWith('AWAITING_NEW_PRICE_')) {
        const sku = userState[chatId].replace('AWAITING_NEW_PRICE_', '');
        const newPrice = parseFloat(text);
        if (isNaN(newPrice)) {
           await sendMessage(chatId, "❌ السعر غير صالح. الرجاء إرسال رقم صحيح (مثال: 150):");
           return;
        }
        
        try {
           const url = `${NOCODB_URL}/api/v2/tables/${NOCODB_TABLE}/records?where=(SKU,eq,${encodeURIComponent(sku)})`;
           const { data } = await axios.get(url, { headers: { 'xc-token': NOCODB_TOKEN } });
           if (data.list && data.list.length > 0) {
              const recordId = data.list[0].Id || data.list[0].id;
              await axios.patch(`${NOCODB_URL}/api/v2/tables/${NOCODB_TABLE}/records`, 
                 { Id: recordId, price: newPrice }, 
                 { headers: { 'xc-token': NOCODB_TOKEN, 'Content-Type': 'application/json' } }
              );
              await sendMessage(chatId, `✅ تم تغيير سعر المنتج (${sku}) إلى ${newPrice} DH بنجاح!\n\n🔁 يمكنك إرسال مرجع منتج آخر لتغيير سعره أو اضغط 🔄 للخروج.`);
           } else {
              await sendMessage(chatId, `❌ لم أجد المنتج (${sku}) في قاعدة البيانات.\n\n🔁 أرسل مرجع آخر أو اضغط 🔄 للخروج.`);
           }
        } catch (error) {
           console.error("Error updating price:", error?.response?.data || error.message);
           await sendMessage(chatId, "❌ حدث خطأ أثناء الاتصال بقاعدة البيانات.");
        }
        userState[chatId] = 'AWAITING_REF_PRICE';
        return;
      }

      if (userState[chatId]) {
        const state = userState[chatId];
        // ⚡ DON'T delete the state — keep the mode sticky!
        const sku = text;
        
        // Search NocoDB for SKU
        const url = `${NOCODB_URL}/api/v2/tables/${NOCODB_TABLE}/records?where=(SKU,eq,${encodeURIComponent(sku)})`;
        const { data } = await axios.get(url, { headers: { 'xc-token': NOCODB_TOKEN } });
        
        if (data.list && data.list.length > 0) {
          const recordId = data.list[0].Id || data.list[0].id;
          
          if (state === 'AWAITING_REF_STOP') {
            await axios.patch(`${NOCODB_URL}/api/v2/tables/${NOCODB_TABLE}/records`, 
              { Id: recordId, POSTEBL: 'NO POSTEBL' }, 
              { headers: { 'xc-token': NOCODB_TOKEN, 'Content-Type': 'application/json' } }
            );
            await sendMessage(chatId, `✅ تم إيقاف المنتج (${sku}) ← "نفد من المخزون"\n\n🔁 أرسل مرجع منتج آخر أو اضغط 🔄 للخروج.`);
          } 
          else if (state === 'AWAITING_REF_RESTOCK') {
            await axios.patch(`${NOCODB_URL}/api/v2/tables/${NOCODB_TABLE}/records`, 
              { Id: recordId, POSTEBL: 'POSTEBL' }, 
              { headers: { 'xc-token': NOCODB_TOKEN, 'Content-Type': 'application/json' } }
            );
            await sendMessage(chatId, `✅ تم جعل المنتج (${sku}) "متوفراً"\n\n🔁 أرسل مرجع منتج آخر أو اضغط 🔄 للخروج.`);
          }
          else if (state === 'AWAITING_REF_CATEGORY') {
            const keyboard = buildCategoryKeyboard(recordId);
            await sendMessage(chatId, `⬇️ المنتج (${sku}) — اختر التصنيف:`, keyboard);
          }
          else if (state === 'AWAITING_REF_PRICE') {
            userState[chatId] = `AWAITING_NEW_PRICE_${sku}`;
            await sendMessage(chatId, `✅ تم العثور على المنتج (${sku}).\n💰 سعره الحالي: ${data.list[0].price || 0} DH\n\n⬇️ يرجى إرسال السعر الجديد الآن (أرقام فقط):`);
            return;
          }
        } else {
          await sendMessage(chatId, `❌ لم أجد منتج بمرجع: ${sku}\n\n🔁 أرسل مرجع آخر أو اضغط 🔄 للخروج.`);
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

// ─── NOCODB -> TIFAWT ERP WEBHOOK ──────────────────────────────────────────
const TIFAWT_LEAD_URL = "https://errayhany.tifawt.ma/api/v1/lead-sources/api/d391c7ce-7c39-4ae0-8ce4-9d45057b36ac";

app.post('/webhook/order', async (req, res) => {
  res.sendStatus(200); // Respond OK to NocoDB immediately
  
  try {
    const payload = req.body;
    let orderRow = null;
    
    // NocoDB webhook structure
    if (payload?.data?.rows && payload.data.rows.length > 0) {
      orderRow = payload.data.rows[0];
    } else {
      orderRow = payload;
    }

    if (!orderRow || (!orderRow['Customer Name'] && !orderRow.Id)) return;

    // Parse Order Metadata
    let items = [];
    try {
      if (typeof orderRow['Order Metadata'] === 'string') {
        items = JSON.parse(orderRow['Order Metadata']);
      } else if (Array.isArray(orderRow['Order Metadata'])) {
        items = orderRow['Order Metadata'];
      }
    } catch (e) {
      console.log("No valid Order Metadata found");
    }

    const tifawtProducts = items.map(i => ({
      sku: i.ref || i.sku || i.id || "UNKNOWN",
      quantity: i.qty || i.quantity || 1,
      unitPrice: i.price || 0
    }));

    const tifawtPayload = {
      customerName: orderRow['Customer Name'] || "بدون اسم",
      customerPhone: orderRow['Customer Phone'] || "",
      customerAddress: orderRow['Delivery Address'] || "",
      city: orderRow['City'] || "المغرب",
      products: tifawtProducts
    };

    console.log(`🚀 Sending Order to Tifawt ERP: ${tifawtPayload.customerName}`);
    
    await axios.post(TIFAWT_LEAD_URL, tifawtPayload, {
      headers: { 'Content-Type': 'application/json' }
    });

    console.log("✅ Order successfully synced to Tifawt ERP");
  } catch (err) {
    console.error("❌ Error syncing to Tifawt ERP:", err?.response?.data || err.message);
  }
});

app.get('/', (req, res) => res.json({ status: 'Errayhany Bot is running ✅', service: 'imden-bot' }));
app.get('/health', (req, res) => {
  const ok = assertBotConfig();
  res.status(ok ? 200 : 503).json({
    ok,
    service: 'imden-bot',
    hasTelegram: Boolean(BOT_TOKEN),
    hasNoco: Boolean(NOCODB_URL && NOCODB_TOKEN && NOCODB_TABLE),
    ai: Boolean(process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY),
  });
});

const PORT = process.env.PORT || process.env.BOT_PORT || 3000;
if (!assertBotConfig()) {
  console.warn('⚠️ Bot starting with incomplete env — webhooks may fail until env is fixed.');
}
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🤖 Errayhany Bot server running on port ${PORT}`);
});
