/**
 * IMDEN TECHNOLOGY - Telegram Bot Server
 * =====================================================
 * Receives Telegram updates (webhook OR long-polling), uploads products
 * to NocoDB, and handles stock/price/category admin commands.
 *
 * Modes:
 *   TELEGRAM_MODE=polling  → long-polling (default if no webhook URL)
 *   TELEGRAM_MODE=webhook  → HTTP /webhook (needs TELEGRAM_WEBHOOK_URL)
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import axios from 'axios';
import FormData from 'form-data';
import {
  enrichProduct,
  buildNocoRecordFromEnrichment,
  buildSellerSku,
} from './productEnrichment.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Local: prefer bot/.env, then repo root .env. EasyPanel injects env directly.
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
app.use(express.json({ limit: '2mb' }));

// ─── CONFIG ────────────────────────────────────────────────────────────────
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.VITE_TELEGRAM_BOT_TOKEN;
const NOCODB_URL = process.env.VITE_NOCODB_URL || process.env.NOCODB_URL;
const NOCODB_TOKEN = process.env.VITE_NOCODB_API_TOKEN || process.env.NOCODB_API_TOKEN;
const NOCODB_TABLE = process.env.VITE_NOCODB_TABLE_PRODUCTS || process.env.NOCODB_TABLE_PRODUCTS;
const SITE_URL = process.env.PUBLIC_SITE_URL || 'https://errayhany.com';
const TELEGRAM_WEBHOOK_URL = (process.env.TELEGRAM_WEBHOOK_URL || '').replace(/\/$/, '');
const TELEGRAM_MODE = (process.env.TELEGRAM_MODE || '').toLowerCase()
  || (TELEGRAM_WEBHOOK_URL ? 'webhook' : 'polling');
/** Soft timeout so AI cannot hang the whole bot forever. */
const AI_ENRICH_TIMEOUT_MS = Number(process.env.AI_ENRICH_TIMEOUT_MS || 90000);

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

const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const TG_FILE_API = `https://api.telegram.org/file/bot${BOT_TOKEN}`;

const CATEGORIES = {
  1: '🔌 شواحن', 2: '🎧 سماعات', 3: '⌚ ساعات ذكية', 4: '🎮 ألعاب',
  5: '🖱️ ماوس وكيبورد', 6: '💾 تخزين', 7: '💻 شواحن حواسيب', 8: '📐 ستاندات',
  9: '💡 إضاءة', 10: '📷 كاميرات', 11: '📡 شبكات', 12: '📦 عام',
  13: '🎙️ ميكروفونات', 14: '🔋 بطاريات وباوربانك',
  16: '🔗 كابلات', 17: '🚗 إكسسوارات السيارة',
  18: '🔌 محولات وHUB', 19: '📺 أجهزة بث', 20: '❄️ تبريد', 21: '📱 هواتف',
};

const MAIN_KEYBOARD = {
  keyboard: [
    [{ text: '❌ إيقاف منتج (نفد المخزون)' }, { text: '✅ جعل المنتج متوفر' }],
    [{ text: '📂 تغيير تصنيف منتج' }, { text: '💰 تغيير سعر المنتج' }],
    [{ text: '🔄 إعادة تشغيل البوت' }],
  ],
  resize_keyboard: true,
  is_persistent: true,
};

function buildCategoryKeyboard(rowId) {
  const catIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 18, 19, 20, 21];
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

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function withTimeout(promise, ms, label = 'operation') {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function withRetry(fn, { retries = 4, baseMs = 1000, label = 'request' } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const status = e?.response?.status;
      const retryAfter = Number(e?.response?.headers?.['retry-after']);
      const isRetryable = status === 429 || status === 502 || status === 503 || status === 504
        || /Too Many Requests|ECONNRESET|ETIMEDOUT|socket hang up/i.test(e?.message || '');
      if (!isRetryable || attempt === retries) break;
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : baseMs * (2 ** attempt);
      console.warn(`⏳ ${label} retry ${attempt + 1}/${retries} in ${waitMs}ms (${e.message})`);
      await delay(waitMs);
    }
  }
  throw lastErr;
}

// ─── TELEGRAM HELPERS ──────────────────────────────────────────────────────
async function sendMessage(chatId, text, replyMarkup = null) {
  const params = { chat_id: chatId, text };
  if (replyMarkup) params.reply_markup = replyMarkup;
  await withRetry(
    () => axios.post(`${TG_API}/sendMessage`, params, { timeout: 30000 }),
    { retries: 4, baseMs: 1200, label: 'sendMessage' }
  );
}

async function editMessage(chatId, messageId, text) {
  await axios.post(`${TG_API}/editMessageText`, {
    chat_id: chatId,
    message_id: messageId,
    text,
    reply_markup: { inline_keyboard: [] },
  }, { timeout: 30000 });
}

async function answerCallback(callbackQueryId, text) {
  await axios.post(`${TG_API}/answerCallbackQuery`, {
    callback_query_id: callbackQueryId,
    text,
    show_alert: false,
  }, { timeout: 15000 });
}

const http = axios.create({ timeout: 120000 });

async function downloadTelegramFileData(fileId, extName) {
  const { data } = await http.get(`${TG_API}/getFile`, { params: { file_id: fileId } });
  const filePath = data.result.file_path;
  const response = await http.get(`${TG_FILE_API}/${filePath}`, { responseType: 'arraybuffer' });
  const buffer = Buffer.from(response.data);
  const fileName = filePath.split('/').pop().includes('.')
    ? filePath.split('/').pop()
    : `image.${extName}`;
  return { buffer, fileName };
}

async function uploadToNocoDB(buffer, fileName) {
  const uploadUrl = `${NOCODB_URL}/api/v2/storage/upload`;
  const form = new FormData();
  form.append('file', buffer, { filename: fileName, contentType: 'image/jpeg' });
  const uploadRes = await http.post(uploadUrl, form, {
    headers: { 'xc-token': NOCODB_TOKEN, ...form.getHeaders() },
  });
  return uploadRes.data[0];
}

async function updateNocoDBCategory(rowId, categoryId) {
  const url = `${NOCODB_URL}/api/v2/tables/${NOCODB_TABLE}/records`;
  await http.patch(url, { Id: rowId, Category_ID: categoryId }, {
    headers: { 'xc-token': NOCODB_TOKEN, 'Content-Type': 'application/json' },
  });
}

function parseCaption(caption) {
  const lines = (caption || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const priceMatch = (lines[0] || '0').match(/(\d+[.,]?\d*)/);
  const price = priceMatch ? parseFloat(priceMatch[0]) : 0;
  const name = lines[1] || 'منتج غير محدد';
  const sku = lines[2] || lines[1] || 'REF-000';
  return { price, name, sku };
}

function skuCandidates(rawSku) {
  const sku = String(rawSku || '').trim();
  if (!sku) return [];
  const upper = sku.toUpperCase();
  const noEry = upper.replace(/^ERY-/, '');
  return Array.from(new Set([
    sku,
    upper,
    noEry,
    `ERY-${noEry}`,
    sku.replace(/\s+/g, '-'),
    upper.replace(/\s+/g, '-'),
  ].filter(Boolean)));
}

async function findProductBySku(rawSku) {
  for (const candidate of skuCandidates(rawSku)) {
    try {
      const url = `${NOCODB_URL}/api/v2/tables/${NOCODB_TABLE}/records`;
      const { data } = await withRetry(
        () => axios.get(url, {
          headers: { 'xc-token': NOCODB_TOKEN },
          params: { limit: 5, where: `(SKU,eq,${candidate})` },
          timeout: 30000,
        }),
        { retries: 3, baseMs: 1500, label: `sku:${candidate}` }
      );
      if (data.list?.length) return data.list[0];
      await delay(200);
    } catch (e) {
      console.warn('SKU lookup failed for', candidate, e.message);
    }
  }

  // Fallback: scan recent rows (SKU filter can miss spaced/legacy refs)
  try {
    const url = `${NOCODB_URL}/api/v2/tables/${NOCODB_TABLE}/records`;
    const { data } = await withRetry(
      () => axios.get(url, {
        headers: { 'xc-token': NOCODB_TOKEN },
        params: { limit: 200, sort: '-Id' },
        timeout: 30000,
      }),
      { retries: 3, baseMs: 1500, label: 'sku-fallback' }
    );
    const wanted = skuCandidates(rawSku).map((s) => s.toLowerCase());
    return (data.list || []).find((row) => {
      const rowSku = String(row.SKU || '').trim().toLowerCase();
      const bare = rowSku.replace(/^ery-/, '');
      return wanted.includes(rowSku)
        || wanted.includes(bare)
        || wanted.includes(`ery-${bare}`);
    }) || null;
  } catch (e) {
    console.error('SKU fallback scan failed:', e.message);
    return null;
  }
}

// ─── ALBUM BUFFER ──────────────────────────────────────────────────────────
const albumBuffer = {};
const userState = {};
let productQueue = Promise.resolve();

function enqueueProduct(task) {
  productQueue = productQueue.then(task).catch((err) => {
    console.error('Product queue error:', err?.message || err);
  });
  return productQueue;
}

async function processProduct(chatId, files, caption) {
  const { price, name, sku } = parseCaption(caption);
  const sellerSku = buildSellerSku(sku);
  console.log(`📦 Processing product: "${name}" | ${price} DH | ${files.length} images | SKU ${sellerSku}`);

  await sendMessage(
    chatId,
    `⏳ جاري رفع المنتج وتوليد النصوص/الصور بالذكاء الاصطناعي...\n📦 ${name}\n💰 ${price} DH\n📋 ${sellerSku}`
  );

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
    enrichment = await withTimeout(
      enrichProduct({
        originalBuffers,
        name,
        price,
        ref: sku,
        uploadToNocoDB,
        nocodbUrl: NOCODB_URL,
      }),
      AI_ENRICH_TIMEOUT_MS,
      'AI enrichment'
    );
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
  let recordData = buildNocoRecordFromEnrichment({ price, name, enrichment });

  let data;
  try {
    ({ data } = await http.post(recordUrl, recordData, {
      headers: { 'xc-token': NOCODB_TOKEN, 'Content-Type': 'application/json' },
    }));
  } catch (e) {
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

function isRestartCommand(text) {
  return text === '/start'
    || text === '/ping'
    || text === '🔄 إعادة تشغيل البوت'
    || text === 'اعادة تشغيل البوت'
    || text === 'إعادة تشغيل البوت';
}

function isStopCommand(text) {
  return text === '❌ إيقاف منتج (نفد المخزون)'
    || text.startsWith('/stop');
}

function isRestockCommand(text) {
  return text === '✅ جعل المنتج متوفر'
    || text.startsWith('/start_product');
}

function isCategoryCommand(text) {
  return text === '📂 تغيير تصنيف منتج'
    || text === '📁 تغيير تصنيف منتج'
    || text.startsWith('/category');
}

function isPriceCommand(text) {
  return text === '💰 تغيير سعر المنتج'
    || text.startsWith('/price');
}

async function handleUpdate(update) {
  const msg = update.message;

  if (msg && msg.text) {
    const chatId = msg.chat.id;
    const text = msg.text.trim();

    if (isRestartCommand(text)) {
      delete userState[chatId];
      await sendMessage(
        chatId,
        text === '/ping'
          ? `✅ البوت يعمل (${TELEGRAM_MODE}).`
          : 'أهلاً بك في بوت إدارة الكتالوج! 📦\nيمكنك إرسال صور المنتجات لرفعها، أو استخدام الأزرار بالأسفل لإدارة المنتجات:\n\n💡 عند الضغط على أي زر، سيبقى فعالاً حتى تضغط على "إعادة تشغيل البوت".',
        MAIN_KEYBOARD
      );
      return;
    }

    if (isStopCommand(text)) {
      userState[chatId] = 'AWAITING_REF_STOP';
      await sendMessage(chatId, '⚙️ تم تفعيل وضع إيقاف المنتجات.\n\nأرسل المرجع (REF) لكل منتج تريد إيقافه، واحداً تلو الآخر.\nللخروج من هذا الوضع اضغط: 🔄 إعادة تشغيل البوت');
      return;
    }

    if (isRestockCommand(text)) {
      userState[chatId] = 'AWAITING_REF_RESTOCK';
      await sendMessage(chatId, '⚙️ تم تفعيل وضع إعادة التوفر.\n\nأرسل المرجع (REF) لكل منتج تريد جعله متوفراً، واحداً تلو الآخر.\nللخروج من هذا الوضع اضغط: 🔄 إعادة تشغيل البوت');
      return;
    }

    if (isCategoryCommand(text)) {
      userState[chatId] = 'AWAITING_REF_CATEGORY';
      await sendMessage(chatId, '⚙️ تم تفعيل وضع تغيير التصنيف.\n\nأرسل المرجع (REF) لكل منتج تريد تغيير تصنيفه، واحداً تلو الآخر.\nللخروج من هذا الوضع اضغط: 🔄 إعادة تشغيل البوت');
      return;
    }

    if (isPriceCommand(text)) {
      userState[chatId] = 'AWAITING_REF_PRICE';
      await sendMessage(chatId, '⚙️ تم تفعيل وضع تغيير السعر.\n\nأرسل المرجع (REF) للمنتج الذي تريد تغيير سعره.\nللخروج من هذا الوضع اضغط: 🔄 إعادة تشغيل البوت');
      return;
    }

    if (typeof userState[chatId] === 'string' && userState[chatId].startsWith('AWAITING_NEW_PRICE_')) {
      const sku = userState[chatId].replace('AWAITING_NEW_PRICE_', '');
      const newPrice = parseFloat(text);
      if (Number.isNaN(newPrice)) {
        await sendMessage(chatId, '❌ السعر غير صالح. الرجاء إرسال رقم صحيح (مثال: 150):');
        return;
      }

      try {
        const record = await findProductBySku(sku);
        if (record) {
          const recordId = record.Id || record.id;
          await axios.patch(
            `${NOCODB_URL}/api/v2/tables/${NOCODB_TABLE}/records`,
            { Id: recordId, price: newPrice },
            { headers: { 'xc-token': NOCODB_TOKEN, 'Content-Type': 'application/json' }, timeout: 30000 }
          );
          await sendMessage(chatId, `✅ تم تغيير سعر المنتج (${sku}) إلى ${newPrice} DH بنجاح!\n\n🔁 يمكنك إرسال مرجع منتج آخر لتغيير سعره أو اضغط 🔄 للخروج.`);
        } else {
          await sendMessage(chatId, `❌ لم أجد المنتج (${sku}) في قاعدة البيانات.\n\n🔁 أرسل مرجع آخر أو اضغط 🔄 للخروج.`);
        }
      } catch (error) {
        console.error('Error updating price:', error?.response?.data || error.message);
        await sendMessage(chatId, '❌ حدث خطأ أثناء الاتصال بقاعدة البيانات.');
      }
      userState[chatId] = 'AWAITING_REF_PRICE';
      return;
    }

    if (userState[chatId]) {
      const state = userState[chatId];
      const sku = text;
      const record = await findProductBySku(sku);

      if (record) {
        const recordId = record.Id || record.id;

        if (state === 'AWAITING_REF_STOP') {
          await axios.patch(
            `${NOCODB_URL}/api/v2/tables/${NOCODB_TABLE}/records`,
            { Id: recordId, POSTEBL: 'NO POSTEBL' },
            { headers: { 'xc-token': NOCODB_TOKEN, 'Content-Type': 'application/json' }, timeout: 30000 }
          );
          await sendMessage(chatId, `✅ تم إيقاف المنتج (${sku}) ← "نفد من المخزون"\n\n🔁 أرسل مرجع منتج آخر أو اضغط 🔄 للخروج.`);
        } else if (state === 'AWAITING_REF_RESTOCK') {
          await axios.patch(
            `${NOCODB_URL}/api/v2/tables/${NOCODB_TABLE}/records`,
            { Id: recordId, POSTEBL: 'POSTEBL' },
            { headers: { 'xc-token': NOCODB_TOKEN, 'Content-Type': 'application/json' }, timeout: 30000 }
          );
          await sendMessage(chatId, `✅ تم جعل المنتج (${sku}) "متوفراً"\n\n🔁 أرسل مرجع منتج آخر أو اضغط 🔄 للخروج.`);
        } else if (state === 'AWAITING_REF_CATEGORY') {
          const keyboard = buildCategoryKeyboard(recordId);
          await sendMessage(chatId, `⬇️ المنتج (${sku}) — اختر التصنيف:`, keyboard);
        } else if (state === 'AWAITING_REF_PRICE') {
          userState[chatId] = `AWAITING_NEW_PRICE_${sku}`;
          await sendMessage(chatId, `✅ تم العثور على المنتج (${sku}).\n💰 سعره الحالي: ${record.price || 0} DH\n\n⬇️ يرجى إرسال السعر الجديد الآن (أرقام فقط):`);
        }
      } else {
        await sendMessage(chatId, `❌ لم أجد منتج بمرجع: ${sku}\n\n🔁 أرسل مرجع آخر أو اضغط 🔄 للخروج.`);
      }
      return;
    }
  }

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
          chatId,
          timer: setTimeout(() => {
            const album = albumBuffer[groupId];
            delete albumBuffer[groupId];
            if (!album) return;
            enqueueProduct(() => processProduct(album.chatId, album.files, album.caption));
          }, 3000),
        };
      }
      albumBuffer[groupId].files.push({ fileId, extName });
      if (msg.caption) albumBuffer[groupId].caption = msg.caption;
    } else {
      enqueueProduct(() => processProduct(chatId, [{ fileId, extName }], msg.caption));
    }
    return;
  }

  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message.chat.id;
    const msgId = cb.message.message_id;
    const data = cb.data;

    const parts = data.split('_');
    const catId = parseInt(parts[1], 10);
    const rowId = parseInt(parts[3], 10);
    const catName = CATEGORIES[catId] || '📦 عام';

    await updateNocoDBCategory(rowId, catId);
    await answerCallback(cb.id, `تم: ${catName}`);
    await editMessage(
      chatId,
      msgId,
      `✅ تم تصنيف المنتج #${rowId} بنجاح!\n\n📂 التصنيف: ${catName}\n🌐 سيظهر على الموقع خلال لحظات.`
    );
  }
}

// ─── HTTP ROUTES ───────────────────────────────────────────────────────────
app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  try {
    await handleUpdate(req.body);
  } catch (err) {
    console.error('❌ Webhook handler error:', err?.response?.data || err.message);
    try {
      const chatId = req.body?.message?.chat?.id || req.body?.callback_query?.message?.chat?.id;
      if (chatId) await sendMessage(chatId, '❌ حدث خطأ داخلي في البوت. أعد المحاولة أو أرسل /ping');
    } catch { /* ignore */ }
  }
});

const TIFAWT_LEAD_URL = 'https://errayhany.tifawt.ma/api/v1/lead-sources/api/d391c7ce-7c39-4ae0-8ce4-9d45057b36ac';

app.post('/webhook/order', async (req, res) => {
  res.sendStatus(200);

  try {
    const payload = req.body;
    let orderRow = null;

    if (payload?.data?.rows && payload.data.rows.length > 0) {
      orderRow = payload.data.rows[0];
    } else {
      orderRow = payload;
    }

    if (!orderRow || (!orderRow['Customer Name'] && !orderRow.Id)) return;

    let items = [];
    try {
      if (typeof orderRow['Order Metadata'] === 'string') {
        items = JSON.parse(orderRow['Order Metadata']);
      } else if (Array.isArray(orderRow['Order Metadata'])) {
        items = orderRow['Order Metadata'];
      }
    } catch {
      console.log('No valid Order Metadata found');
    }

    const tifawtProducts = items.map((i) => ({
      sku: i.ref || i.sku || i.id || 'UNKNOWN',
      quantity: i.qty || i.quantity || 1,
      unitPrice: i.price || 0,
    }));

    const tifawtPayload = {
      customerName: orderRow['Customer Name'] || 'بدون اسم',
      customerPhone: orderRow['Customer Phone'] || '',
      customerAddress: orderRow['Delivery Address'] || '',
      city: orderRow['City'] || 'المغرب',
      products: tifawtProducts,
    };

    console.log(`🚀 Sending Order to Tifawt ERP: ${tifawtPayload.customerName}`);
    await axios.post(TIFAWT_LEAD_URL, tifawtPayload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    });
    console.log('✅ Order successfully synced to Tifawt ERP');
  } catch (err) {
    console.error('❌ Error syncing to Tifawt ERP:', err?.response?.data || err.message);
  }
});

app.get('/', (req, res) => res.json({
  status: 'Errayhany Bot is running ✅',
  service: 'imden-bot',
  mode: TELEGRAM_MODE,
}));

app.get('/health', async (req, res) => {
  const ok = assertBotConfig();
  let webhook = null;
  if (BOT_TOKEN) {
    try {
      const { data } = await axios.get(`${TG_API}/getWebhookInfo`, { timeout: 8000 });
      webhook = {
        url: data?.result?.url || '',
        pending: data?.result?.pending_update_count,
        lastError: data?.result?.last_error_message || null,
      };
    } catch (e) {
      webhook = { error: e.message };
    }
  }
  res.status(ok ? 200 : 503).json({
    ok,
    service: 'imden-bot',
    mode: TELEGRAM_MODE,
    hasTelegram: Boolean(BOT_TOKEN),
    hasNoco: Boolean(NOCODB_URL && NOCODB_TOKEN && NOCODB_TABLE),
    ai: Boolean(process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY),
    webhookUrlEnv: Boolean(TELEGRAM_WEBHOOK_URL),
    telegramWebhook: webhook,
  });
});

// ─── TELEGRAM TRANSPORT ────────────────────────────────────────────────────
async function setupWebhook() {
  if (!TELEGRAM_WEBHOOK_URL) {
    throw new Error('TELEGRAM_WEBHOOK_URL is required for webhook mode');
  }
  const url = TELEGRAM_WEBHOOK_URL.endsWith('/webhook')
    ? TELEGRAM_WEBHOOK_URL
    : `${TELEGRAM_WEBHOOK_URL}/webhook`;
  const { data } = await axios.post(`${TG_API}/setWebhook`, {
    url,
    drop_pending_updates: false,
    allowed_updates: ['message', 'callback_query'],
  }, { timeout: 20000 });
  console.log(`🔗 Webhook set → ${url}`, data);
}

async function startPolling() {
  try {
    await axios.post(`${TG_API}/deleteWebhook`, { drop_pending_updates: false }, { timeout: 20000 });
    console.log('🧹 Cleared Telegram webhook (polling mode)');
  } catch (e) {
    console.warn('deleteWebhook warning:', e.message);
  }

  let offset = 0;
  console.log('📡 Telegram long-polling started — bot will respond without a public webhook URL');

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const { data } = await axios.get(`${TG_API}/getUpdates`, {
        params: {
          offset,
          timeout: 30,
          allowed_updates: JSON.stringify(['message', 'callback_query']),
        },
        timeout: 45000,
      });

      for (const update of data.result || []) {
        offset = update.update_id + 1;
        // Process sequentially — parallel replies flood Telegram/NocoDB (429).
        try {
          await handleUpdate(update);
        } catch (err) {
          console.error('❌ Update error:', err?.response?.data || err.message);
        }
      }
    } catch (e) {
      if (e.code !== 'ECONNABORTED') {
        console.error('Polling error:', e.message);
      }
      await delay(2000);
    }
  }
}

process.on('uncaughtException', (err) => {
  console.error('uncaughtException:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('unhandledRejection:', err);
});

const PORT = process.env.PORT || process.env.BOT_PORT || 3000;
if (!assertBotConfig()) {
  console.warn('⚠️ Bot starting with incomplete env — Telegram/NocoDB calls may fail until env is fixed.');
}

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🤖 Errayhany Bot server running on port ${PORT} (mode=${TELEGRAM_MODE})`);
  if (!BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN missing — bot will not receive messages');
    return;
  }

  try {
    const { data: me } = await axios.get(`${TG_API}/getMe`, { timeout: 10000 });
    const { data: wh } = await axios.get(`${TG_API}/getWebhookInfo`, { timeout: 10000 });
    console.log(`👤 Bot @${me?.result?.username || '?'} id=${me?.result?.id || '?'}`);
    console.log(`📬 Webhook url="${wh?.result?.url || ''}" pending=${wh?.result?.pending_update_count ?? '?'}`);
    if (wh?.result?.last_error_message) {
      console.warn(`⚠️ Last webhook error: ${wh.result.last_error_message}`);
    }
  } catch (e) {
    console.warn('Telegram getMe/getWebhookInfo failed:', e.message);
  }

  try {
    if (TELEGRAM_MODE === 'webhook') {
      await setupWebhook();
    } else {
      // Run polling in background; Express stays up for /health + order webhook
      startPolling().catch((err) => console.error('Polling crashed:', err));
    }
  } catch (err) {
    console.error('❌ Failed to start Telegram transport:', err.message);
    console.error('Falling back to polling…');
    startPolling().catch((e) => console.error('Polling crashed:', e));
  }
});
