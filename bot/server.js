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
  cleanReference,
} from './productEnrichment.js';
import {
  createTifawtProduct,
  isTifawtProductSyncConfigured,
} from './tifawtProducts.js';
import {
  REGULAR_TEMPLATES,
  SALE_TEMPLATES,
  loadTemplateSelection,
  toggleTemplateInSelection,
  renderTemplatePreview,
  getTemplateById,
} from './imageTemplates.js';
import { getCustomerOrders, normalizePhone } from './tifawtOrders.js';
import { verifyFirebaseIdToken, verifyPhoneIdToken } from './firebasePhoneToken.js';
import { resolveLinkedPhone } from './linkedCustomerPhone.js';
import { normalizeAmazonUrl } from './amazonScrape.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Local: prefer bot/.env, then repo root .env. EasyPanel injects env directly.
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
app.use(express.json({ limit: '2mb' }));

// Storefront origins allowed to call the /api/* endpoints from the browser.
const ALLOWED_ORIGINS = (
  process.env.STOREFRONT_ORIGINS
  || 'https://errayhany.com,https://www.errayhany.com,https://imdenmanadger.online,https://www.imdenmanadger.online,http://localhost:5173,http://localhost:4173'
).split(',').map((o) => o.trim()).filter(Boolean);

app.use('/api', (req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});

// ─── CONFIG ────────────────────────────────────────────────────────────────
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.VITE_TELEGRAM_BOT_TOKEN;
const NOCODB_URL = process.env.VITE_NOCODB_URL || process.env.NOCODB_URL;
const NOCODB_TOKEN = process.env.VITE_NOCODB_API_TOKEN || process.env.NOCODB_API_TOKEN;
const NOCODB_TABLE = process.env.VITE_NOCODB_TABLE_PRODUCTS || process.env.NOCODB_TABLE_PRODUCTS;
const SITE_URL = process.env.PUBLIC_SITE_URL || 'https://errayhany.com';
const TELEGRAM_WEBHOOK_URL = (process.env.TELEGRAM_WEBHOOK_URL || '').replace(/\/$/, '');
const TELEGRAM_MODE = (process.env.TELEGRAM_MODE || '').toLowerCase()
  || (TELEGRAM_WEBHOOK_URL ? 'webhook' : 'polling');
/** Soft timeout so AI cannot hang the whole bot forever.
 *  Copy + studio cutouts + background composites routinely
 *  exceed 90s on large Telegram photos, so the default is 5 minutes. */
const AI_ENRICH_TIMEOUT_MS = Number(process.env.AI_ENRICH_TIMEOUT_MS || 300000);
/** Background polish after the product is already saved (must be bounded). */
const AI_ENRICH_BG_TIMEOUT_MS = Number(process.env.AI_ENRICH_BG_TIMEOUT_MS || 360000);
/** Reject oversized Telegram downloads before they OOM the process. */
const MAX_TELEGRAM_IMAGE_BYTES = Number(process.env.MAX_TELEGRAM_IMAGE_BYTES || 12 * 1024 * 1024);

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
    [{ text: '✨ إعادة توليد الوصف والصور' }],
    [{ text: '🎨 خلفيات الموقع' }, { text: '🔥 خلفيات التخفيض' }],
    [{ text: '🔄 إعادة تشغيل البوت' }, { text: '🔽 إخفاء القائمة' }],
  ],
  resize_keyboard: true,
  is_persistent: true,
};

/** Minimal keyboard shown after the full admin menu is hidden. */
const SHOW_KEYBOARD = {
  keyboard: [[{ text: '🔼 إظهار القائمة' }]],
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

async function sendPhotoBuffer(chatId, buffer, caption, replyMarkup = null) {
  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('photo', buffer, { filename: 'template.jpg', contentType: 'image/jpeg' });
  if (caption) form.append('caption', caption);
  if (replyMarkup) form.append('reply_markup', JSON.stringify(replyMarkup));
  await withRetry(
    () => axios.post(`${TG_API}/sendPhoto`, form, {
      headers: form.getHeaders(),
      timeout: 60000,
      maxBodyLength: Infinity,
    }),
    { retries: 3, baseMs: 1200, label: 'sendPhoto' }
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

const http = axios.create({
  timeout: 120000,
  maxContentLength: MAX_TELEGRAM_IMAGE_BYTES,
  maxBodyLength: MAX_TELEGRAM_IMAGE_BYTES,
});

async function downloadTelegramFileData(fileId, extName) {
  const { data } = await http.get(`${TG_API}/getFile`, { params: { file_id: fileId } });
  const filePath = data.result.file_path;
  const response = await http.get(`${TG_FILE_API}/${filePath}`, {
    responseType: 'arraybuffer',
    maxContentLength: MAX_TELEGRAM_IMAGE_BYTES,
    maxBodyLength: MAX_TELEGRAM_IMAGE_BYTES,
  });
  const buffer = Buffer.from(response.data);
  if (buffer.length > MAX_TELEGRAM_IMAGE_BYTES) {
    throw new Error(`Image too large (${Math.round(buffer.length / 1024 / 1024)}MB)`);
  }
  const fileName = filePath.split('/').pop().includes('.')
    ? filePath.split('/').pop()
    : `image.${extName}`;
  return { buffer, fileName };
}

async function uploadToNocoDB(buffer, fileName) {
  const uploadUrl = `${NOCODB_URL}/api/v2/storage/upload`;
  const form = new FormData();
  form.append('file', buffer, { filename: fileName, contentType: 'image/jpeg' });
  // Dedicated axios call — do not inherit Telegram download size caps.
  const uploadRes = await axios.post(uploadUrl, form, {
    headers: { 'xc-token': NOCODB_TOKEN, ...form.getHeaders() },
    timeout: 120000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
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
  let amazonUrl = '';
  const contentLines = [];

  for (const line of lines) {
    const urlMatch = line.match(/https?:\/\/\S+/i);
    if (urlMatch) {
      amazonUrl = normalizeAmazonUrl(urlMatch[0]);
      const rest = line.replace(urlMatch[0], '').trim();
      if (rest) contentLines.push(rest);
    } else {
      contentLines.push(line);
    }
  }

  // Price line supports discounts: "120/200" or "120 ~ 200" (sale / old).
  const priceLine = contentLines[0] || '0';
  const duo = priceLine.match(/(\d+[.,]?\d*)\s*[\/~\-–]\s*(\d+[.,]?\d*)/);
  let price = 0;
  let oldPrice = 0;
  let nameIdx = 1;
  if (duo) {
    price = parseFloat(duo[1].replace(',', '.'));
    oldPrice = parseFloat(duo[2].replace(',', '.'));
    if (oldPrice <= price) {
      // If user wrote old/new instead of new/old, swap.
      const tmp = price;
      price = oldPrice;
      oldPrice = tmp;
    }
  } else {
    const priceMatch = priceLine.match(/(\d+[.,]?\d*)/);
    price = priceMatch ? parseFloat(priceMatch[0].replace(',', '.')) : 0;
    // Optional second numeric line before the name = old price.
    const maybeOld = (contentLines[1] || '').match(/^(\d+[.,]?\d*)$/);
    if (maybeOld) {
      oldPrice = parseFloat(maybeOld[1].replace(',', '.'));
      nameIdx = 2;
      if (oldPrice <= price) oldPrice = 0;
    }
  }

  const name = contentLines[nameIdx] || 'منتج غير محدد';
  let sku = contentLines[nameIdx + 1] || contentLines[nameIdx] || 'REF-000';
  if (/^https?:\/\//i.test(sku)) sku = contentLines[nameIdx] || 'REF-000';
  return { price, oldPrice, name, sku, amazonUrl };
}

/** Tifawt SKU: uppercase A–Z / 0–9 only (no spaces, dashes, or punctuation). */
function tifawtSkuFromCaption(rawSku) {
  const cleaned = String(rawSku || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  return cleaned || 'REF';
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

function nocoImageUrl(file) {
  if (!file) return '';
  return file.signedUrl || (file.url?.startsWith('http') ? file.url : `${NOCODB_URL}/${file.url || ''}`);
}

async function downloadNocoImageBuffer(url) {
  const { data } = await http.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(data);
}

function collectSourceImagesFromRow(row) {
  return [row.Image1, row.Image2, row.Image3, row.Image4, row.Image5]
    .flatMap((slot) => (Array.isArray(slot) ? slot : slot ? [slot] : []))
    .filter(Boolean);
}

function pickReenrichSourceFiles(sourceFiles) {
  const label = (f) => String(f.title || f.name || f.url || '');
  const realFirst = [
    ...sourceFiles.filter((f) => /real[-_]/i.test(label(f))),
    ...sourceFiles.filter((f) => !/real[-_]|ai[-_]|specs[-_]/i.test(label(f))),
  ];
  return (realFirst.length ? realFirst : sourceFiles).slice(0, 4);
}

// ─── ALBUM BUFFER ──────────────────────────────────────────────────────────
const albumBuffer = {};
const userState = {};
const pendingDestinations = new Map();
let productQueue = Promise.resolve();
/** Serial AI polish queue — never blocks product create, max 1 enrich at a time. */
let aiPolishQueue = Promise.resolve();
let aiPolishInFlight = 0;
let aiPolishPending = 0;

function destinationKeyboard(token) {
  return {
    inline_keyboard: [
      [
        { text: '🌐 NocoDB فقط', callback_data: `dest:noco:${token}` },
        { text: '🛒 Tifawt فقط', callback_data: `dest:tifawt:${token}` },
      ],
      [{ text: '🔄 كلاهما', callback_data: `dest:both:${token}` }],
      [{ text: '✖️ إلغاء', callback_data: `dest:cancel:${token}` }],
    ],
  };
}

async function requestProductDestination(chatId, files, caption) {
  const now = Date.now();
  for (const [key, pending] of pendingDestinations) {
    if (pending.expiresAt < now) pendingDestinations.delete(key);
  }
  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const parsed = parseCaption(caption);
  const expiresAt = now + (10 * 60 * 1000);
  pendingDestinations.set(token, { chatId, files, caption, expiresAt });

  const imageNote = files.length >= 2 && files.length <= 4
    ? `${files.length} صور`
    : `${files.length} صورة (يفضّل إرسال 2 إلى 4)`;
  const saleNote = parsed.oldPrice
    ? `\n🔥 تخفيض: ${parsed.oldPrice} → ${parsed.price} DH`
    : '';
  await sendMessage(
    chatId,
    `📍 أين تريد حفظ هذا المنتج؟\n\n📦 ${parsed.name}\n💰 ${parsed.price} DH${saleNote}\n📋 ${parsed.sku}\n🖼️ ${imageNote}\n\n• Tifawt: الاسم والمرجع والصور الأصلية كما أرسلتها (بنفس الترتيب).\n• NocoDB أو كلاهما: صور وعناوين مولّدة للموقع/الشيت، وTifawt يبقى بالأصل فقط.`,
    destinationKeyboard(token)
  );
}

function enqueueProduct(task) {
  productQueue = productQueue.then(task).catch((err) => {
    console.error('Product queue error:', err?.message || err);
  });
  return productQueue;
}

function enqueueAiPolish(task) {
  aiPolishPending += 1;
  aiPolishQueue = aiPolishQueue
    .then(async () => {
      aiPolishPending = Math.max(0, aiPolishPending - 1);
      aiPolishInFlight += 1;
      try {
        await task();
      } finally {
        aiPolishInFlight = Math.max(0, aiPolishInFlight - 1);
      }
    })
    .catch((err) => {
      console.error('AI polish queue error:', err?.message || err);
    });
  return aiPolishQueue;
}

async function uploadOriginalsSafely(buffers, sellerSku) {
  const uploaded = [];
  for (let idx = 0; idx < buffers.length; idx++) {
    try {
      const file = await uploadToNocoDB(buffers[idx], `real-${sellerSku}-${idx + 1}.jpg`);
      if (file) uploaded.push(file);
    } catch (e) {
      console.error(`Original upload ${idx + 1} failed:`, e.message);
    }
  }
  return uploaded;
}

async function createNocoProductRecord(recordData, { name, sellerSku, price }) {
  const recordUrl = `${NOCODB_URL}/api/v2/tables/${NOCODB_TABLE}/records`;
  try {
    const { data } = await http.post(recordUrl, recordData, {
      headers: { 'xc-token': NOCODB_TOKEN, 'Content-Type': 'application/json' },
    });
    return { data, recordUrl };
  } catch (e) {
    console.error('NocoDB create failed, retrying minimal fields:', e?.response?.data || e.message);
    const minimal = {
      Title: recordData.Title || name,
      Arabic_Title: recordData.Arabic_Title || name,
      French_Title: recordData.French_Title || name,
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
    if (recordData.Amazon_URL) minimal.Amazon_URL = recordData.Amazon_URL;
    if (recordData.Barcode) minimal.Barcode = recordData.Barcode;
    try {
      const { data } = await http.post(recordUrl, minimal, {
        headers: { 'xc-token': NOCODB_TOKEN, 'Content-Type': 'application/json' },
      });
      return { data, recordUrl };
    } catch (minimalError) {
      if (!minimal.Barcode) throw minimalError;
      console.warn('NocoDB Barcode column unavailable; retrying without it');
      delete minimal.Barcode;
      const { data } = await http.post(recordUrl, minimal, {
        headers: { 'xc-token': NOCODB_TOKEN, 'Content-Type': 'application/json' },
      });
      return { data, recordUrl };
    }
  }
}

/**
 * Run AI enrichment and PATCH an existing NocoDB row.
 * Used for new products (background polish) and manual re-enrich by REF.
 */
async function executeAiPolish({
  chatId,
  rowId,
  recordUrl,
  originalBuffers,
  name,
  price,
  oldPrice,
  ref,
  amazonUrl,
  sellerSku,
  startMessage,
}) {
  console.log(`✨ AI polish start #${rowId} ${sellerSku}`);
  await sendMessage(
    chatId,
    startMessage || `⏳ جاري توليد الوصف والصور الاحترافية للمنتج #${rowId}...`
  );
  const enrichTimeout = amazonUrl
    ? Number(process.env.AI_ENRICH_TIMEOUT_MS_AMAZON || Math.max(AI_ENRICH_BG_TIMEOUT_MS, 240000))
    : AI_ENRICH_BG_TIMEOUT_MS;

  let enrichment;
  try {
    enrichment = await withTimeout(
      enrichProduct({
        originalBuffers,
        name,
        price,
        oldPrice,
        ref,
        amazonUrl,
        uploadToNocoDB,
        nocodbUrl: NOCODB_URL,
        syncSheet: false,
      }),
      enrichTimeout,
      'AI polish'
    );
  } catch (e) {
    console.error(`AI polish timed out/failed #${rowId}:`, e.message);
    await sendMessage(
      chatId,
      `⚠️ فشل توليد الوصف/الصور للمنتج #${rowId} (${sellerSku}).\n${e.message}`
    );
    return;
  }

  if (!enrichment?.copy && !enrichment?.hasAiImages) {
    const detail = (enrichment?.aiFailures || []).slice(0, 2).join(' | ');
    await sendMessage(
      chatId,
      `⚠️ لم يكتمل التوليد للمنتج #${rowId} (${sellerSku}).${detail ? `\n🛠️ ${detail}` : ''}`
    );
    return;
  }

  const patch = buildNocoRecordFromEnrichment({ price, name, enrichment });
  patch.Id = rowId;
  await http.patch(recordUrl, patch, {
    headers: { 'xc-token': NOCODB_TOKEN, 'Content-Type': 'application/json' },
  });
  const imgCount = enrichment.nocoImages?.length || 0;
  await sendMessage(
    chatId,
    `✨ تم تحديث المنتج #${rowId} بالوصف والصور الاحترافية (${imgCount} صور)\n📦 ${enrichment.copy?.arabic_title || enrichment.copy?.french_title || name}\n🔗 ${SITE_URL}/p/${encodeURIComponent(sellerSku)}`
  );
  console.log(`✅ AI polish OK #${rowId}`);
}

/**
 * After the product row exists, polish title/description/studio images in the
 * background. Bounded timeout + serial queue so stacked enrichments cannot
 * OOM or stall the next product create.
 */
function scheduleAiPolish({
  chatId,
  rowId,
  recordUrl,
  originalBuffers,
  name,
  price,
  oldPrice,
  sku,
  amazonUrl,
  sellerSku,
}) {
  enqueueAiPolish(() => executeAiPolish({
    chatId,
    rowId,
    recordUrl,
    originalBuffers,
    name,
    price,
    oldPrice,
    ref: sku,
    amazonUrl,
    sellerSku,
    startMessage: `⏳ جاري توليد الوصف والصور الاحترافية للمنتج #${rowId} في الخلفية...`,
  }));
}

/** Re-run AI enrichment for an existing product found by REF/SKU. */
async function scheduleReenrichByRef(chatId, record, rawRef) {
  const rowId = record.Id || record.id;
  const sellerSku = buildSellerSku(record.SKU || rawRef);
  const recordUrl = `${NOCODB_URL}/api/v2/tables/${NOCODB_TABLE}/records`;
  const sourceFiles = collectSourceImagesFromRow(record);

  if (!sourceFiles.length) {
    await sendMessage(
      chatId,
      `❌ المنتج (${sellerSku}) لا يحتوي على صور لإعادة التوليد.\n\n🔁 أرسل مرجع آخر أو اضغط 🔄 للخروج.`
    );
    return;
  }

  enqueueAiPolish(async () => {
    const preferred = pickReenrichSourceFiles(sourceFiles);
    const originalBuffers = [];
    for (const file of preferred) {
      const url = nocoImageUrl(file);
      if (!url) continue;
      try {
        originalBuffers.push(await downloadNocoImageBuffer(url));
      } catch (e) {
        console.warn(`Reenrich download failed (${sellerSku}):`, e.message);
      }
    }
    if (!originalBuffers.length) {
      await sendMessage(
        chatId,
        `❌ تعذر تحميل صور المنتج #${rowId} (${sellerSku}) لإعادة التوليد.`
      );
      return;
    }
    await executeAiPolish({
      chatId,
      rowId,
      recordUrl,
      originalBuffers,
      name: record.Title || record.Arabic_Title || record.French_Title || sellerSku,
      price: Number(record.price) || 0,
      oldPrice: Number(record.old_price || record.Old_Price || 0) || 0,
      ref: cleanReference(record.SKU || rawRef),
      amazonUrl: record.Amazon_URL || '',
      sellerSku,
      startMessage: `⏳ جاري إعادة توليد الوصف والصور للمنتج #${rowId} (${sellerSku})...`,
    });
  });

  const queueNote = aiPolishPending > 1
    ? `\n📋 هناك ${aiPolishPending} مهام توليد في الانتظار.`
    : '';
  await sendMessage(
    chatId,
    `✅ تم إدراج (${sellerSku}) في قائمة التوليد.${queueNote}\n⏳ سأرسل لك رسالة عند الانتهاء.\n\n🔁 أرسل مرجعاً آخر أو اضغط 🔄 للخروج.`
  );
}

async function processProduct(chatId, files, caption, destination = 'both') {
  const { price, oldPrice, name, sku, amazonUrl } = parseCaption(caption);
  const sellerSku = buildSellerSku(sku);
  const tifawtSku = tifawtSkuFromCaption(sku);
  console.log(
    `📦 Processing product: "${name}" | ${price} DH${oldPrice ? ` (was ${oldPrice})` : ''} | ${files.length} images | NocoSKU ${sellerSku} | TifawtSKU ${tifawtSku} | destination=${destination}${amazonUrl ? ` | Amazon ${amazonUrl}` : ''}`
  );

  await sendMessage(
    chatId,
    destination === 'tifawt'
      ? `⏳ جاري إرسال المنتج مباشرة إلى Tifawt (أصل بدون تعديل)...\n📦 ${name}\n💰 ${price} DH\n📋 ${tifawtSku}\n🖼️ ${files.length} صورة`
      : `⏳ جاري حفظ المنتج بسرعة ثم توليد الوصف والصور في الخلفية...\n📦 ${name}\n💰 ${price} DH${oldPrice ? ` ← كان ${oldPrice}` : ''}\n📋 ${sellerSku}`
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

  // Send originals immediately (no barcode scan — that only slowed us down).
  // Tifawt + NocoDB get the seller payload first; AI polish patches later.
  if (destination === 'tifawt') {
    const result = await createTifawtProduct({
      name,
      sku: tifawtSku,
      price,
      imageBuffers: originalBuffers,
      imageFileName: `${tifawtSku}-1.jpg`,
    });
    if (result?.ok) {
      await sendMessage(
        chatId,
        `✅ تم إرسال المنتج إلى Tifawt فقط.\n\n📦 ${name}\n💰 ${price} DH | 📋 ${tifawtSku}\n🖼️ ${result.imageCount || originalBuffers.length} صورة أصلية`
      );
    } else {
      await sendMessage(chatId, `❌ تعذر إنشاء المنتج في Tifawt:\n${result?.error || result?.reason || 'خطأ غير معروف'}`);
    }
    return;
  }

  // Fire Tifawt in parallel — do not block NocoDB save on it.
  if (destination === 'both' && isTifawtProductSyncConfigured()) {
    (async () => {
      try {
        let result = await createTifawtProduct({
          name,
          sku: tifawtSku,
          price,
          imageBuffers: originalBuffers,
          imageFileName: `${tifawtSku}-1.jpg`,
        });
        if (!result?.ok && !result?.skipped) {
          await delay(1500);
          result = await createTifawtProduct({
            name,
            sku: tifawtSku,
            price,
            imageBuffers: originalBuffers,
            imageFileName: `${tifawtSku}-1.jpg`,
          });
        }
        if (result?.ok) {
          const modeAr = result.mode === 'updated' ? 'تم تحديث الأصل' : 'تم إضافة الأصل';
          await sendMessage(
            chatId,
            `🛒 Tifawt: ${modeAr}\n📦 ${name}\n📋 ${tifawtSku}\n🖼️ ${result.imageCount || originalBuffers.length} صور أصلية`
          );
          console.log('✅ Tifawt product', result.mode || 'created', tifawtSku, result.data?.id || result.existingId || '');
        } else if (!result?.skipped) {
          await sendMessage(chatId, `🛒 Tifawt خطأ: ${result?.error || 'فشل الإنشاء'}`);
        }
      } catch (e) {
        console.error('Early Tifawt sync error:', e.message);
        try {
          await sendMessage(chatId, `🛒 Tifawt خطأ: ${e.message}`);
        } catch {
          /* ignore */
        }
      }
    })();
  }

  // CRITICAL PATH: save originals fast so the product queue is not blocked by AI.
  const uploadedFiles = await uploadOriginalsSafely(originalBuffers, sellerSku);
  if (!uploadedFiles.length) {
    await sendMessage(chatId, '❌ فشل رفع الصور إلى NocoDB. أعد إرسال المنتج.');
    return;
  }

  const enrichment = {
    sellerSku,
    amazonUrl: amazonUrl || '',
    skippedAi: true,
    copy: null,
    barcode: '',
    nocoImages: uploadedFiles,
    sheet: { skipped: true, reason: 'destination_choice' },
    aiFailures: [],
    hasAiImages: false,
  };
  const recordData = buildNocoRecordFromEnrichment({ price, name, enrichment });

  let created;
  try {
    created = await createNocoProductRecord(recordData, { name, sellerSku, price });
  } catch (e) {
    console.error('NocoDB create aborted:', e?.response?.data || e.message);
    await sendMessage(chatId, `❌ فشل حفظ المنتج في NocoDB:\n${e?.response?.data?.message || e.message}`);
    return;
  }

  const rowId = created.data.Id || created.data.id;
  const recordUrl = created.recordUrl;
  const landing = `${SITE_URL}/p/${encodeURIComponent(sellerSku)}`;
  const saleNote = oldPrice ? `\n🔥 تخفيض من ${oldPrice} إلى ${price} DH` : '';
  const tifawtNote = destination === 'both'
    ? (isTifawtProductSyncConfigured()
      ? `\n🛒 Tifawt: يُرسل الأصل الآن بالمرجع ${tifawtSku}`
      : '\n🛒 Tifawt: أضف TIFAWT_EMAIL و TIFAWT_PASSWORD')
    : '\n🌐 تم الحفظ في NocoDB فقط';

  console.log(`✅ NocoDB row created fast: #${rowId}`);

  const keyboard = buildCategoryKeyboard(rowId);
  await sendMessage(
    chatId,
    `✅ تم حفظ المنتج الأصلي #${rowId} (${uploadedFiles.length} صور)!\n\n📦 ${name}\n💰 ${price} DH | 📋 ${sellerSku}${saleNote}\n🔗 صفحة الهبوط: ${landing}${tifawtNote}\n\n✨ سيتم تعديل العنوان/الوصف/الصور الاحترافية تلقائياً بعد لحظات.\n\n⬇️ اختر تصنيف المنتج:`,
    keyboard
  );

  scheduleAiPolish({
    chatId,
    rowId,
    recordUrl,
    originalBuffers: originalBuffers.slice(),
    name,
    price,
    oldPrice,
    sku,
    amazonUrl,
    sellerSku,
  });
}

function isRestartCommand(text) {
  return text === '/start'
    || text === '/ping'
    || text === '🔄 إعادة تشغيل البوت'
    || text === 'اعادة تشغيل البوت'
    || text === 'إعادة تشغيل البوت';
}

function isHideKeyboardCommand(text) {
  return text === '🔽 إخفاء القائمة'
    || text === '/hide'
    || text === '/hide_menu';
}

function isShowKeyboardCommand(text) {
  return text === '🔼 إظهار القائمة'
    || text === '/menu'
    || text === '/show'
    || text === '/show_menu';
}

function isTemplatesCommand(text) {
  const t = String(text || '').trim().toLowerCase();
  return t === '/templates'
    || t === '/template'
    || t === 'قوالب'
    || t === 'خلفيات'
    || t === '🎨 قوالب الصور'
    || t === '🎨 خلفيات الموقع';
}

function isSaleTemplatesCommand(text) {
  const t = String(text || '').trim().toLowerCase();
  return t === '/templates_sale'
    || t === '/templatesale'
    || t === '/sale_templates'
    || t === 'قوالب التخفيض'
    || t === 'خلفيات التخفيض'
    || t === '🔥 قوالب التخفيض'
    || t === '🔥 خلفيات التخفيض';
}

async function sendTemplateGallery(chatId, kind = 'regular') {
  const pool = kind === 'sale' ? SALE_TEMPLATES : REGULAR_TEMPLATES;
  const sel = loadTemplateSelection();
  const active = new Set(sel[kind] || []);

  await sendMessage(
    chatId,
    kind === 'sale'
      ? '🔥 شارة التخفيض\nصور الموقع أصبحت خلفية بيضاء مع ظل وملء الإطار.\nهذا الخيار يخص شارة التخفيض عندما ترسل سعراً قديماً (مثال: 120/200).'
      : '🎨 صور الموقع\nالصور الجديدة تُنشأ تلقائياً على خلفية بيضاء مع ظل ناعم، والمنتج يملأ الإطار.\nالقوالب الملونة لم تعد تُستخدم للمنتجات الجديدة.'
  );

  for (const tpl of pool) {
    const on = active.has(tpl.id);
    const preview = await renderTemplatePreview(tpl);
    await sendPhotoBuffer(
      chatId,
      preview,
      `${on ? '✅ مفعّل' : '⬜ غير مفعّل'}\n${tpl.nameAr}\n${tpl.blurbAr}\n🆔 ${tpl.id}`,
      {
        inline_keyboard: [[
          {
            text: on ? '✅ مفعّل — اضغط للإيقاف' : '⬜ تفعيل هذا القالب',
            callback_data: `tpl:${kind}:${tpl.id}`,
          },
        ]],
      }
    );
  }

  const activeNames = [...active]
    .map((id) => getTemplateById(id)?.nameAr || id)
    .join(' · ') || '—';
  await sendMessage(chatId, `📌 القوالب المفعّلة الآن:\n${activeNames}`);
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

function isReenrichCommand(text) {
  return text === '✨ إعادة توليد الوصف والصور'
    || text.startsWith('/reenrich');
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
          : 'أهلاً بك في بوت إدارة الكتالوج! 📦\nيمكنك إرسال صور المنتجات لرفعها، أو استخدام الأزرار بالأسفل لإدارة المنتجات:\n\n📝 صيغة المنتج:\nالسعر\nالاسم\nالمرجع\nرابط أمازون (اختياري)\n\n🔥 تخفيض: 120/200 (الجديد/القديم)\n\n✨ صور الموقع: خلفية بيضاء + ظل + بطاقة مواصفات\n💡 Tifawt يستلم الاسم والمرجع والصور الأصلية كما أرسلتها.\n\n🔄 إعادة توليد: زر «✨ إعادة توليد الوصف والصور» ثم أرسل المرجع.',
        MAIN_KEYBOARD
      );
      return;
    }

    if (isHideKeyboardCommand(text)) {
      await sendMessage(
        chatId,
        '🔽 تم إخفاء القائمة.\nاضغط «🔼 إظهار القائمة» أو أرسل /menu لإعادتها.',
        SHOW_KEYBOARD
      );
      return;
    }

    if (isShowKeyboardCommand(text)) {
      await sendMessage(chatId, '🔼 تم إظهار القائمة.', MAIN_KEYBOARD);
      return;
    }

    if (isTemplatesCommand(text)) {
      await sendTemplateGallery(chatId, 'regular');
      return;
    }

    if (isSaleTemplatesCommand(text)) {
      await sendTemplateGallery(chatId, 'sale');
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

    if (isReenrichCommand(text)) {
      userState[chatId] = 'AWAITING_REF_REENRICH';
      await sendMessage(
        chatId,
        '⚙️ تم تفعيل وضع إعادة التوليد.\n\nأرسل مرجع المنتج (REF أو SKU) لإعادة إنشاء الوصف والصور الاحترافية.\nمثال: AQ10 أو ERY-AQ10\n\nللخروج اضغط: 🔄 إعادة تشغيل البوت'
      );
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
        } else if (state === 'AWAITING_REF_REENRICH') {
          await scheduleReenrichByRef(chatId, record, sku);
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
            requestProductDestination(album.chatId, album.files, album.caption).catch((err) => {
              console.error('Destination prompt failed:', err.message);
            });
          }, 3000),
        };
      }
      albumBuffer[groupId].files.push({ fileId, extName });
      if (msg.caption) albumBuffer[groupId].caption = msg.caption;
    } else {
      await requestProductDestination(chatId, [{ fileId, extName }], msg.caption);
    }
    return;
  }

  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message.chat.id;
    const msgId = cb.message.message_id;
    const data = cb.data;

    if (data.startsWith('tpl:')) {
      const [, kind, templateId] = data.split(':');
      if ((kind !== 'regular' && kind !== 'sale') || !getTemplateById(templateId)) {
        await answerCallback(cb.id, 'قالب غير معروف');
        return;
      }
      const result = toggleTemplateInSelection(kind, templateId);
      if (!result.ok) {
        await answerCallback(cb.id, 'يجب الإبقاء على قالب واحد على الأقل');
        return;
      }
      const on = (result.selection[kind] || []).includes(templateId);
      const tpl = getTemplateById(templateId);
      await answerCallback(cb.id, on ? `تم تفعيل: ${tpl.nameAr}` : `تم إيقاف: ${tpl.nameAr}`);
      try {
        await axios.post(`${TG_API}/editMessageCaption`, {
          chat_id: chatId,
          message_id: msgId,
          caption: `${on ? '✅ مفعّل' : '⬜ غير مفعّل'}\n${tpl.nameAr}\n${tpl.blurbAr}\n🆔 ${tpl.id}`,
          reply_markup: {
            inline_keyboard: [[
              {
                text: on ? '✅ مفعّل — اضغط للإيقاف' : '⬜ تفعيل هذا القالب',
                callback_data: `tpl:${kind}:${templateId}`,
              },
            ]],
          },
        }, { timeout: 30000 });
      } catch (e) {
        console.warn('editMessageCaption failed:', e.message);
      }
      return;
    }

    if (data.startsWith('dest:')) {
      const [, destination, token] = data.split(':');
      const pending = pendingDestinations.get(token);
      if (!pending || pending.chatId !== chatId || pending.expiresAt < Date.now()) {
        pendingDestinations.delete(token);
        await answerCallback(cb.id, 'انتهت صلاحية الاختيار. أرسل المنتج مجدداً.');
        await editMessage(chatId, msgId, '⌛ انتهت صلاحية هذا الطلب. أرسل صور المنتج مجدداً.');
        return;
      }
      pendingDestinations.delete(token);

      if (destination === 'cancel') {
        await answerCallback(cb.id, 'تم الإلغاء');
        await editMessage(chatId, msgId, '✖️ تم إلغاء إضافة المنتج.');
        return;
      }

      const labels = {
        noco: 'NocoDB فقط',
        tifawt: 'Tifawt فقط',
        both: 'NocoDB وTifawt',
      };
      if (!labels[destination]) {
        await answerCallback(cb.id, 'اختيار غير صالح');
        return;
      }

      await answerCallback(cb.id, `تم اختيار ${labels[destination]}`);
      await editMessage(chatId, msgId, `✅ الوجهة: ${labels[destination]}\nبدأت معالجة المنتج...`);
      enqueueProduct(() => processProduct(
        pending.chatId,
        pending.files,
        pending.caption,
        destination
      ));
      return;
    }

    if (!data.startsWith('cat_')) {
      await answerCallback(cb.id, 'أمر غير معروف');
      return;
    }

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

const TIFAWT_LEAD_URL = (
  process.env.TIFAWT_LEAD_URL
  || process.env.VITE_TIFAWT_LEAD_URL
  || 'https://errayhany.tifawt.ma/api/v1/lead-sources/api/0a4e5144-86c1-4fdf-b276-5b2f5bbcf149'
).trim();

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

// ─── CUSTOMER ORDER TRACKING (Tifawt, self-service) ────────────────────────
// The browser never sees Tifawt credentials: it sends the Firebase ID token of
// an SMS sign-in, and only the orders belonging to that verified phone number
// are returned.
const trackingHits = new Map();
const TRACKING_WINDOW_MS = 60_000;
const TRACKING_MAX_PER_WINDOW = 10;

function trackingRateLimited(key) {
  const now = Date.now();
  const hits = (trackingHits.get(key) || []).filter((t) => now - t < TRACKING_WINDOW_MS);
  hits.push(now);
  trackingHits.set(key, hits);
  if (trackingHits.size > 5000) trackingHits.clear();
  return hits.length > TRACKING_MAX_PER_WINDOW;
}

app.post('/api/orders/track', async (req, res) => {
  const clientKey = req.headers['x-forwarded-for'] || req.ip || 'unknown';
  if (trackingRateLimited(String(clientKey))) {
    return res.status(429).json({ ok: false, error: 'rate_limited' });
  }

  const verified = await verifyPhoneIdToken(req.body?.idToken);
  if (!verified.ok) {
    return res.status(401).json({ ok: false, error: verified.error });
  }

  try {
    const result = await getCustomerOrders(verified.phone);
    if (!result.ok) {
      return res.status(result.error === 'tifawt_not_configured' ? 503 : 400).json(result);
    }
    return res.json({
      ok: true,
      phone: normalizePhone(verified.phone),
      orders: result.orders,
    });
  } catch (err) {
    console.error('❌ Tracking lookup failed:', err?.response?.data || err.message);
    return res.status(502).json({ ok: false, error: 'tifawt_unavailable' });
  }
});

/**
 * Account page: logged-in Firebase user (email / Google) → linked verified phone
 * → Tifawt orders for that phone only. The client never chooses the phone freely.
 */
app.post('/api/orders/account', async (req, res) => {
  const clientKey = req.headers['x-forwarded-for'] || req.ip || 'unknown';
  if (trackingRateLimited(`acct:${clientKey}`)) {
    return res.status(429).json({ ok: false, error: 'rate_limited' });
  }

  const identity = await verifyFirebaseIdToken(req.body?.idToken);
  if (!identity.ok) {
    return res.status(401).json({ ok: false, error: identity.error });
  }

  const linked = await resolveLinkedPhone({
    uid: identity.uid,
    authPhone: identity.phone,
    idToken: req.body?.idToken,
  });
  if (!linked.ok) {
    return res.status(403).json({
      ok: false,
      error: linked.error || 'phone_not_linked',
      requiresPhoneVerification: true,
    });
  }

  try {
    const result = await getCustomerOrders(linked.phone);
    if (!result.ok) {
      return res.status(result.error === 'tifawt_not_configured' ? 503 : 400).json(result);
    }
    return res.json({
      ok: true,
      phone: linked.phone,
      email: identity.email || '',
      orders: result.orders,
    });
  } catch (err) {
    console.error('❌ Account orders lookup failed:', err?.response?.data || err.message);
    return res.status(502).json({ ok: false, error: 'tifawt_unavailable' });
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
    apify: Boolean(process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN),
    tifawt: Boolean(process.env.TIFAWT_LEAD_URL || process.env.VITE_TIFAWT_LEAD_URL),
    tifawtProducts: Boolean(process.env.TIFAWT_EMAIL && process.env.TIFAWT_PASSWORD),
    webhookUrlEnv: Boolean(TELEGRAM_WEBHOOK_URL),
    telegramWebhook: webhook,
    queues: {
      aiPolishInFlight,
      aiPolishPending,
    },
    memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
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

function startPollingSupervised() {
  startPolling().catch((err) => {
    console.error('Polling crashed, restarting in 3s:', err?.message || err);
    setTimeout(startPollingSupervised, 3000);
  });
}

process.on('uncaughtException', (err) => {
  console.error('uncaughtException:', err);
  // Exit so EasyPanel/Docker restarts a healthy process instead of a half-dead one.
  setTimeout(() => process.exit(1), 250);
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
      startPollingSupervised();
    }
  } catch (err) {
    console.error('❌ Failed to start Telegram transport:', err.message);
    console.error('Falling back to polling…');
    startPollingSupervised();
  }
});
