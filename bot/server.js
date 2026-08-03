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
  detectProductColorVariants,
  generateJumiaColorVariants,
  generateOptionalAmazonHero,
  publicUrlFromNoco,
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
import { normalizeAmazonUrl, normalizeAmazonUrls } from './amazonScrape.js';
import {
  createJumiaProduct,
  isJumiaConfigured,
  setJumiaProductActive,
  setJumiaProductStock,
  shipJumiaOrder,
  cancelJumiaOrder,
  printJumiaLabels,
  normalizeJumiaOrderId,
} from './jumiaClient.js';
import {
  appendProductToSheet,
  isSheetWebhookConfigured,
} from './sheetsAppend.js';
import { registerAdminRoutes } from './adminRoutes.js';
import { registerPublicImageRoutes } from './jumiaPublicImages.js';
import { resolveJumiaStock } from './jumiaPricing.js';
import { toTifawtSku, resolveTifawtOrderSku } from './tifawtSku.js';
import { parseColorList } from './colorVariants.js';
import {
  upsertProductVariant,
  setProductVariantActive,
  listJumiaColorSkusByProductId,
  listProductVariantsByProductId,
  deactivateRemovedProductVariants,
} from './productVariants.js';
import { getBotSetting, startBotSettingsSync } from './runtimeSettings.js';
import {
  createBundledTifawtLead,
  isBundledTifawtLeadConfigured,
} from './tifawtLeadCreate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Local: prefer bot/.env, then repo root .env. EasyPanel injects env directly.
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });
startBotSettingsSync({ publishConnections: true });

const app = express();
registerPublicImageRoutes(app);
app.use(express.json({ limit: '2mb' }));
registerAdminRoutes(app);

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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password, X-Admin-Secret');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
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
/** Mini App / OPEN button URL (must be HTTPS and allowed in BotFather). */
const TELEGRAM_WEBAPP_URL = (
  process.env.TELEGRAM_WEBAPP_URL
  || `${SITE_URL.replace(/\/$/, '')}/admin?from=tg&tab=products`
).trim();
/** Reject oversized Telegram downloads before they OOM the process. */
const MAX_TELEGRAM_IMAGE_BYTES = Number(getBotSetting('maxTelegramImageMb')) * 1024 * 1024;

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
    [{ text: 'OPEN 🌐', web_app: { url: TELEGRAM_WEBAPP_URL } }],
    [{ text: '❌ إيقاف منتج (نفد المخزون)' }, { text: '✅ جعل المنتج متوفر' }],
    [{ text: '📂 تغيير تصنيف منتج' }, { text: '💰 تغيير سعر المنتج' }],
    [{ text: '✨ إعادة توليد الوصف والصور' }],
    [{ text: '🎨 إضافة ألوان لمنتج موجود' }],
    [{ text: '🛒 إعادة بناء من Amazon' }],
    [{ text: '📦 تجهيز شحن Jumia' }, { text: '❌ إلغاء طلب Jumia' }],
    [{ text: '🏷️ ملصق شحن Jumia' }],
    [{ text: '🎨 خلفيات الموقع' }, { text: '🔥 خلفيات التخفيض' }],
    [{ text: '🔄 إعادة تشغيل البوت' }, { text: '🔽 إخفاء القائمة' }],
  ],
  resize_keyboard: true,
  is_persistent: true,
};

/** Minimal keyboard shown after the full admin menu is hidden. */
const SHOW_KEYBOARD = {
  keyboard: [
    [{ text: 'OPEN 🌐', web_app: { url: TELEGRAM_WEBAPP_URL } }],
    [{ text: '🔼 إظهار القائمة' }],
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

async function editMessage(chatId, messageId, text, replyMarkup = null) {
  try {
    await axios.post(`${TG_API}/editMessageText`, {
      chat_id: chatId,
      message_id: messageId,
      text,
      reply_markup: replyMarkup || { inline_keyboard: [] },
    }, { timeout: 30000 });
  } catch (e) {
    const description = e.response?.data?.description || e.message;
    // Telegram rejects no-op edits; treat them as success so button clicks stay snappy.
    if (/message is not modified/i.test(String(description))) return;
    console.warn('editMessageText failed:', description);
    throw Object.assign(new Error(description), { cause: e });
  }
}

async function answerCallback(callbackQueryId, text, { showAlert = false } = {}) {
  try {
    await axios.post(`${TG_API}/answerCallbackQuery`, {
      callback_query_id: callbackQueryId,
      text: String(text || '').slice(0, 200),
      show_alert: Boolean(showAlert),
    }, { timeout: 15000 });
  } catch (e) {
    console.warn('answerCallbackQuery failed:', e.response?.data?.description || e.message);
  }
}

/** Menu button next to the message field (like Fader bots "OPEN"). */
async function setupTelegramWebAppMenu() {
  if (!BOT_TOKEN || !TELEGRAM_WEBAPP_URL) return;
  try {
    await axios.post(`${TG_API}/setChatMenuButton`, {
      menu_button: {
        type: 'web_app',
        text: 'OPEN',
        web_app: { url: TELEGRAM_WEBAPP_URL },
      },
    }, { timeout: 15000 });
    console.log(`🌐 Telegram OPEN menu → ${TELEGRAM_WEBAPP_URL}`);
  } catch (e) {
    console.warn('setChatMenuButton failed:', e?.response?.data || e.message);
  }
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
  const amazonUrls = normalizeAmazonUrls(caption, { max: 4 });
  const amazonUrl = amazonUrls[0] || '';
  const contentLines = [];

  for (const line of lines) {
    const urlMatches = line.match(/https?:\/\/\S+/gi) || [];
    if (urlMatches.length) {
      const rest = urlMatches.reduce((text, url) => text.replace(url, ''), line).trim();
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
  return { price, oldPrice, name, sku, amazonUrl, amazonUrls };
}

function skuCandidates(rawSku) {
  const sku = String(rawSku || '').trim();
  if (!sku) return [];
  const upper = sku.toUpperCase();
  const noEry = upper.replace(/^ERY-/, '');
  const canonical = toTifawtSku(upper);
  return Array.from(new Set([
    sku,
    upper,
    noEry,
    canonical,
    canonical ? `ERY-${canonical}` : '',
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
  const label = (f) => String(f.title || f.name || f.url || f.path || '');
  const real = sourceFiles.filter((f) => /real[-_]/i.test(label(f)));
  const plain = sourceFiles.filter(
    (f) => !/ai[-_]|specs[-_]|amazon[-_]/i.test(label(f))
  );
  // Prefer seller originals; fall back to any non-AI slot (Image1 front photo).
  const preferred = real.length ? real : (plain.length ? plain : sourceFiles);
  return preferred.slice(0, 4);
}

// ─── ALBUM BUFFER ──────────────────────────────────────────────────────────
const albumBuffer = {};
const userState = {};
const pendingDestinations = new Map();
/** After destination: classify each photo as display / description / both / skip. */
const pendingImageRoles = new Map();
/** After AI: seller picks which generated images go to the storefront gallery. */
const pendingGalleryApprovals = new Map();
/** AI suggests visible color variants; seller confirms before paid color renders. */
const pendingColorApprovals = new Map();
let productQueue = Promise.resolve();
/** Serial AI polish queue — never blocks product create, max 1 enrich at a time. */
let aiPolishQueue = Promise.resolve();
let aiPolishInFlight = 0;
let aiPolishPending = 0;

const IMAGE_ROLE_CYCLE = ['both', 'display', 'desc', 'skip'];

function imageRoleLabel(role) {
  return ({
    both: '🔄 عرض+وصف',
    display: '🎨 للعرض فقط',
    desc: '📖 للوصف فقط',
    skip: '✖️ تجاهل',
  })[role] || role;
}

function cycleImageRole(role) {
  const idx = IMAGE_ROLE_CYCLE.indexOf(role);
  return IMAGE_ROLE_CYCLE[(idx + 1) % IMAGE_ROLE_CYCLE.length];
}

function defaultImageRoles(fileCount) {
  // First photo = product front (gallery + vision). Extra shots default to
  // description-only so packaging backs never publish if AI fails.
  return Array.from({ length: fileCount }, (_, i) => (i === 0 ? 'both' : 'desc'));
}

function imageRolesKeyboard(token, roles) {
  const rows = roles.map((role, i) => ([
    {
      text: `📷 ${i + 1}: ${imageRoleLabel(role)}`,
      callback_data: `imgrole:${token}:${i}:cycle`,
    },
  ]));
  rows.push([{ text: '✅ متابعة', callback_data: `imgrole:${token}:go:x` }]);
  rows.push([{ text: '✖️ إلغاء', callback_data: `imgrole:${token}:cancel:x` }]);
  return { inline_keyboard: rows };
}

function imageRolesSummary(roles) {
  return roles
    .map((role, i) => `${i + 1}) ${imageRoleLabel(role)}`)
    .join('\n');
}

async function requestImageRoles(chatId, files, caption, destination) {
  const now = Date.now();
  for (const [key, pending] of pendingImageRoles) {
    if (pending.expiresAt < now) pendingImageRoles.delete(key);
  }
  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const roles = defaultImageRoles(files.length);
  pendingImageRoles.set(token, {
    chatId,
    files,
    caption,
    destination,
    roles,
    expiresAt: now + (10 * 60 * 1000),
  });
  await sendMessage(
    chatId,
    `🖼️ صنّف صورك قبل الحفظ (${files.length}):\n\n`
    + `• 🎨 للعرض فقط → قد تظهر في المعرض بعد التوليد الاحترافي\n`
    + `• 📖 للوصف فقط → يقرأها الذكاء (ضهر العلبة/كاتالوج) ولن تُنشر خام\n`
    + `• 🔄 عرض+وصف → الاثنان\n`
    + `• ✖️ تجاهل → تُحذف من المعالجة\n\n`
    + `اضغط على كل صورة لتغيير دورها، ثم ✅ متابعة:\n\n`
    + imageRolesSummary(roles),
    imageRolesKeyboard(token, roles)
  );
}

function galleryApprovalSummary(candidates) {
  return candidates
    .map((c, i) => `${c.selected ? '✅' : '⬜'}${c.isPrimary ? ' ⭐' : ''} ${i + 1}) ${c.label}`)
    .join('\n');
}

function colorApprovalKeyboard(token, { variantOnly = false } = {}) {
  return {
    inline_keyboard: [
      [{ text: '✅ الألوان صحيحة — أنشئ صور Jumia', callback_data: `colors:${token}:approve` }],
      [{ text: '✏️ غير صحيحة — سأكتبها بنفسي', callback_data: `colors:${token}:edit` }],
      [{
        text: variantOnly ? '✖️ إلغاء إضافة الألوان' : '⏭️ منتج واحد فقط على Jumia',
        callback_data: `colors:${token}:single`,
      }],
    ],
  };
}

async function requestColorApproval(context, colors) {
  const variants = parseColorList(colors);
  const minimum = context.variantOnly ? 1 : 2;
  if (variants.length < minimum) return false;
  const now = Date.now();
  for (const [key, pending] of pendingColorApprovals) {
    if (pending.expiresAt < now) pendingColorApprovals.delete(key);
  }
  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  pendingColorApprovals.set(token, {
    ...context,
    colors: variants,
    expiresAt: now + (30 * 60 * 1000),
  });
  await sendMessage(
    context.chatId,
    `🎨 اكتشفت ${variants.length} أشكال لونية في الصور:\n\n`
      + variants.map((color, index) => `${index + 1}. ${color}`).join('\n')
      + '\n\nكل تركيبة مذكورة تعتبر منتجاً مستقلاً في Jumia، بينما يبقى منتجاً واحداً في Tifawt وNocoDB.\nلن أبدأ توليد صور الألوان المدفوعة قبل موافقتك.',
    colorApprovalKeyboard(token, { variantOnly: context.variantOnly }),
  );
  return true;
}

async function continueAfterColorApproval(pending, colors) {
  const confirmed = parseColorList(colors);
  pending.enrichment.confirmedColorVariants = confirmed;
  pending.enrichment.productForSheet.colorVariants = confirmed;
  pending.enrichment.requireColorJumia = confirmed.length > 1;

  const shouldGenerateVariants = pending.variantOnly
    ? confirmed.length > 0
    : confirmed.length > 1;
  if (shouldGenerateVariants) {
    await sendMessage(
      pending.chatId,
      `⏳ تم اعتماد ${confirmed.length} ألوان. سأُنشئ الآن صورة احترافية منفصلة لكل لون، بالتتابع لتفادي الضغط والتكرار.`,
    );
    let generated = [];
    try {
      generated = await generateJumiaColorVariants({
        colors: confirmed,
        sourceBuffers: pending.sourceBuffers,
        title: pending.enrichment.copy?.french_title || pending.name,
        sellerSku: pending.sellerSku,
        uploadToNocoDB,
      });
    } catch (e) {
      await sendMessage(
        pending.chatId,
        `❌ تعذر بدء توليد صور الألوان: ${e.message}\nلن يُنشر المنتج متعدد الألوان على Jumia بصورة غير صحيحة.`,
      );
    }
    const successful = generated.filter((variant) => variant.file && variant.buffer);
    const failed = generated.filter((variant) => variant.error);
    for (const variant of successful) {
      try {
        const saved = await upsertProductVariant({
          productId: pending.rowId,
          colorLabel: variant.label.replace(/^Jumia\s*—\s*/i, ''),
          colorCode: variant.code,
          jumiaSku: variant.sellerSku,
          imageFiles: [variant.file],
          active: null,
        });
        variant.variantRowId = saved.rowId;
      } catch (e) {
        variant.error = `variant_save:${e.message}`;
        failed.push(variant);
      }
    }
    const savedVariants = successful.filter((variant) => variant.variantRowId && !variant.error);
    pending.enrichment.galleryCandidates = [
      ...(pending.enrichment.galleryCandidates || []),
      ...savedVariants,
    ];
    if (failed.length) {
      await sendMessage(
        pending.chatId,
        `⚠️ تعذر توليد ${failed.length} لون: ${failed.map((v) => v.label).join('، ')}.\nلن يُنشر اللون الذي فشلت صورته على Jumia.`,
      );
    }
  } else if (!pending.variantOnly) {
    // Single-color (or no multi-color) run: retire any leftover color rows.
    try {
      const removed = await deactivateRemovedProductVariants(pending.rowId, []);
      await pauseJumiaColorSkus(removed.map((row) => row.jumiaSku));
    } catch (e) {
      console.warn(`Variant clear failed #${pending.rowId}:`, e.message);
    }
  }

  const asked = await requestGalleryApproval(pending);
  if (!asked) {
    await sendMessage(pending.chatId, '❌ لا توجد صور صالحة للموافقة. لم يتم النشر على Jumia.');
  }
}

function existingProductColorContext(chatId, record) {
  const rowId = record.Id || record.id;
  const sellerSku = buildSellerSku(record.SKU || rowId);
  const name = record.Arabic_Title || record.Title || record.French_Title || sellerSku;
  const frenchTitle = record.French_Title || record.Woo_Title || record.Title || sellerSku;
  const price = Number(record.price || record.Price || 0);
  const referenceClean = cleanReference(toTifawtSku(record.SKU || sellerSku));
  const recordUrl = `${NOCODB_URL}/api/v2/tables/${NOCODB_TABLE}/records`;
  const productForSheet = {
    referenceClean,
    sellerSku,
    price,
    wholesalePrice: price,
    postebl: record.POSTEBL || 'POSTEBL',
    frenchTitle,
    arabicTitle: name,
    shortFr: record.Short_Description_FR || record.short_description_fr || '',
    shortAr: record.Short_Description_AR || record.short_description_ar || '',
    descriptionFr: record.description_french || record.Description_French || '',
    descriptionAr: record.description_arabic || record.Description_Arabic || '',
    metaTitle: record.Meta_Title || frenchTitle,
    metaDescription: record.Meta_Description || '',
    wooTitle: record.Woo_Title || frenchTitle,
    brand: record.Brand || 'Generic',
    color: 'Multicolore',
    colorFamily: 'Multicolore',
    variation: '',
    amazonUrl: record.Amazon_URL || '',
    imageUrls: [],
  };
  return {
    chatId,
    rowId,
    recordUrl,
    record,
    name,
    price,
    sellerSku,
    variantOnly: true,
    enrichment: {
      variantOnly: true,
      syncJumia: true,
      syncSheet: false,
      catalogPublished: String(record.POSTEBL || '').toUpperCase() !== 'PAUSED',
      requireColorJumia: true,
      nocoImages: [],
      imageUrls: [],
      galleryCandidates: [],
      nocodbUrl: NOCODB_URL,
      copy: {
        french_title: frenchTitle,
        arabic_title: name,
      },
      productForSheet,
    },
  };
}

async function processExistingProductColorPhotos(chatId, files, colorContext) {
  await sendMessage(
    chatId,
    `⏳ جاري تحليل صور ألوان المنتج (${colorContext.sellerSku})...\nلن يتم تعديل صور أو وصف المنتج الأساسي.`,
  );

  let sourceBuffers;
  try {
    const downloaded = [];
    for (const file of (files || []).slice(0, 4)) {
      downloaded.push(await downloadTelegramFileData(file.fileId, file.extName));
    }
    sourceBuffers = downloaded.map((item) => item.buffer).filter(Boolean);
    if (!sourceBuffers.length) throw new Error('no_color_photos');
  } catch (error) {
    await sendMessage(chatId, `❌ تعذر تحميل صور الألوان: ${error.message}`);
    return;
  }

  const pending = {
    ...colorContext,
    sourceBuffers,
    expiresAt: Date.now() + (30 * 60 * 1000),
  };

  try {
    const colors = await detectProductColorVariants({
      imageBuffers: sourceBuffers,
      name: colorContext.name,
      price: colorContext.price,
      ref: colorContext.sellerSku,
    });
    const asked = await requestColorApproval(pending, colors);
    if (asked) return;
  } catch (error) {
    console.warn(`Color-only detection failed #${colorContext.rowId}:`, error.message);
  }

  userState[chatId] = { type: 'AWAITING_COLOR_VARIANTS', pending };
  await sendMessage(
    chatId,
    '⚠️ لم أتمكن من تحديد الألوان بدقة.\nاكتب الآن كل لون أو تركيبة لونية مفصولة بفاصلة.\nمثال: أبيض وأسود، أسود مع أزرق، أزرق',
  );
}

function releaseAmazonSourceBuffers(pending) {
  if (!pending?.enrichment) return;
  pending.enrichment.amazonSourceBuffers = [];
  for (const candidate of pending.candidates || []) {
    if (candidate?.kind === 'amazon' || candidate?.kind === 'ai') {
      candidate.buffer = null;
    }
  }
}

function galleryApprovalKeyboard(token, candidates, enrichment = {}) {
  const rows = candidates.map((c, i) => {
    const row = [{
      text: `${c.selected ? '✅' : '⬜'} ${i + 1}. ${c.label}`,
      callback_data: `gal:${token}:${i}:t`,
    }];
    if (c.kind !== 'jumia-color') {
      row.push({
        text: c.isPrimary ? '⭐ الرئيسية' : '☆ اجعلها الرئيسية',
        callback_data: `gal:${token}:${i}:p`,
      });
    }
    return row;
  });
  if (enrichment.amazonAiChoiceRequired && !enrichment.amazonAiChoice) {
    rows.push([
      { text: '✨ نعم، أنشئ صورة بالذكاء', callback_data: `gal:${token}:ai:g` },
      { text: '🚫 لا، استخدم صور Amazon', callback_data: `gal:${token}:ai:n` },
    ]);
  }
  rows.push([{ text: '✅ اعتماد ونشر للوجهات المختارة', callback_data: `gal:${token}:go:x` }]);
  rows.push([{ text: '✖️ إلغاء الصور (الإبقاء على النص فقط)', callback_data: `gal:${token}:cancel:x` }]);
  return { inline_keyboard: rows };
}

async function requestGalleryApproval({
  chatId,
  rowId,
  recordUrl,
  name,
  price,
  oldPrice = 0,
  sellerSku,
  enrichment,
}) {
  const candidates = (enrichment.galleryCandidates || [])
    .filter((c) => c?.file && c?.buffer)
    .slice(0, 12);
  if (!candidates.length) {
    return false;
  }

  const now = Date.now();
  for (const [key, pending] of pendingGalleryApprovals) {
    if (pending.expiresAt < now) pendingGalleryApprovals.delete(key);
  }
  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  pendingGalleryApprovals.set(token, {
    chatId,
    rowId,
    recordUrl,
    name,
    price,
    oldPrice,
    sellerSku,
    enrichment,
    candidates,
    expiresAt: now + (30 * 60 * 1000),
  });

  await sendMessage(
    chatId,
    `🖼️ صور المنتج #${rowId} (${sellerSku})\n${enrichment.amazonUrl ? 'هذه جميع صور Amazon التي تم كشطها. اختر ⭐ الصورة الأساسية، ثم قرر هل تريد إنشاء صورة إضافية بالذكاء أم الاكتفاء بصور Amazon.' : 'ستجد عند توفرها: Gemini، Qwen، إزالة الخلفية، والصورة الأصلية للمراجعة.'}${enrichment.syncJumia ? '\nعند اكتشاف عدة ألوان ستظهر أيضاً صورة مستقلة لكل لون في Jumia. الصورة الأصلية لا تُرسل إلى Jumia.' : '\nلم تختر Jumia، لذلك لن يُرسل إليها هذا المنتج.'}\n\n${galleryApprovalSummary(candidates)}`
  );

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    try {
      await sendPhotoBuffer(
        chatId,
        c.buffer,
        `${c.selected ? '✅' : '⬜'} ${i + 1}/${candidates.length} — ${c.label}\n#${rowId} ${sellerSku}`,
      );
    } catch (e) {
      console.warn('send gallery candidate failed:', e.message);
    }
    // Keep Amazon bytes until the seller answers the optional AI prompt —
    // those buffers are shared with enrichment.amazonSourceBuffers.
    if (!(enrichment.amazonAiChoiceRequired && (c.kind === 'amazon' || c.kind === 'ai'))) {
      c.buffer = null;
    }
  }

  await sendMessage(
    chatId,
    `⬇️ فعّل/عطّل كل صورة ثم انشر:\n\n${galleryApprovalSummary(candidates)}`,
    galleryApprovalKeyboard(token, candidates, enrichment)
  );
  return true;
}

function orderSelectedGalleryFiles(candidates) {
  const selected = candidates.filter((c) => c.selected && c.file && c.kind !== 'jumia-color');
  const primary = selected.find((c) => c.isPrimary);
  const remaining = primary ? selected.filter((c) => c !== primary) : selected;
  const ai = remaining.filter((c) => c.kind === 'ai').map((c) => c.file);
  const cutout = remaining.filter((c) => c.kind === 'cutout').map((c) => c.file);
  const amazon = remaining.filter((c) => c.kind === 'amazon').map((c) => c.file);
  const qwen = remaining.filter((c) => c.kind === 'qwen').map((c) => c.file);
  const real = remaining.filter((c) => c.kind === 'real').map((c) => c.file);
  return [primary?.file, ...ai, ...cutout, ...amazon, ...qwen, ...real]
    .filter(Boolean)
    .slice(0, 8);
}

async function finalizeGalleryApproval(pending, { publishImages }) {
  const {
    chatId, rowId, recordUrl, name, price, sellerSku, enrichment, candidates,
  } = pending;
  const selectedColorCandidates = publishImages
    ? candidates.filter((c) => c.selected && c.file && c.kind === 'jumia-color')
    : [];
  const allColorCandidates = candidates.filter(
    (c) => c.file && c.kind === 'jumia-color' && c.variantRowId,
  );
  const publishedColorCodes = [];
  const normalFiles = publishImages ? orderSelectedGalleryFiles(candidates) : [];
  // Base Image1…Image8 stay reserved for front/back/details. Color images live
  // in ProductVariants and never displace normal product photography.
  const selectedFiles = normalFiles.slice(0, 8);
  const nocoFiles = selectedFiles;
  // Raw seller photos may be shown in our own catalog, but Jumia requires
  // marketplace-ready studio images. Never send a `real` candidate there.
  const professionalFiles = publishImages
    ? orderSelectedGalleryFiles(candidates.filter((c) => c.kind !== 'real'))
    : [];
  const professionalImageUrls = professionalFiles.map(
    (f) => publicUrlFromNoco(f, enrichment.nocodbUrl || NOCODB_URL),
  );
  if (!enrichment.variantOnly) {
    enrichment.nocoImages = nocoFiles;
    enrichment.imageUrls = selectedFiles.map((f) => publicUrlFromNoco(f, enrichment.nocodbUrl || NOCODB_URL));
    if (enrichment.productForSheet) {
      enrichment.productForSheet.imageUrls = enrichment.imageUrls;
    }

    const patch = buildNocoRecordFromEnrichment({ price, name, enrichment });
    patch.Id = rowId;
    // Clear unused image slots so old raw photos never linger.
    for (const key of ['Image1', 'Image2', 'Image3', 'Image4', 'Image5', 'Image6', 'Image7', 'Image8', 'image2', 'image3', 'image4', 'image5']) {
      if (!patch[key]) patch[key] = null;
    }
    await http.patch(recordUrl, patch, {
      headers: { 'xc-token': NOCODB_TOKEN, 'Content-Type': 'application/json' },
    });
  }
  for (const candidate of allColorCandidates) {
    try {
      if (!publishImages || !candidate.selected) {
        await setProductVariantActive(candidate.variantRowId, false);
      } else if (!enrichment.syncJumia) {
        await setProductVariantActive(candidate.variantRowId, true);
        publishedColorCodes.push(candidate.code);
      }
    } catch (e) {
      console.warn(`Variant status update failed (${candidate.sellerSku}):`, e.message);
    }
  }

  let sheetNote = '';
  let jumiaNote = '';
  let amazonMultiHandled = false;
  if (publishImages && (nocoFiles.length || selectedColorCandidates.length) && enrichment.productForSheet) {
    // Jumia first: materializes durable /public-images/p/{sku}/n.jpg URLs.
    // Sheet must use those same permanent URLs (never NocoDB signed links).
    if (enrichment.syncJumia && selectedColorCandidates.length) {
      const created = [];
      const failed = [];
      for (const colorCandidate of selectedColorCandidates) {
        const colorPayload = {
          ...enrichment.productForSheet,
          sellerSku: colorCandidate.sellerSku,
          parentSku: colorCandidate.sellerSku,
          referenceClean: `${enrichment.productForSheet.referenceClean}-${colorCandidate.skuSuffix}`,
          frenchTitle: `${enrichment.productForSheet.frenchTitle} - ${colorCandidate.label.replace(/^Jumia\s*—\s*/i, '')}`.slice(0, 120),
          arabicTitle: `${enrichment.productForSheet.arabicTitle} - ${colorCandidate.label.replace(/^Jumia\s*—\s*/i, '')}`.slice(0, 120),
          color: colorCandidate.label.replace(/^Jumia\s*—\s*/i, ''),
          colorFamily: colorCandidate.label.replace(/^Jumia\s*—\s*/i, ''),
          variation: colorCandidate.label.replace(/^Jumia\s*—\s*/i, ''),
          imageUrls: [publicUrlFromNoco(colorCandidate.file, enrichment.nocodbUrl || NOCODB_URL)],
          // Durable proxy resolves Image1 from ProductVariants by Jumia_SKU.
          publicImageSku: colorCandidate.sellerSku,
          publicImageStartIndex: 1,
        };
        try {
          if (!isJumiaConfigured()) {
            throw new Error('jumia_not_configured');
          }
          const jumia = await createJumiaProduct(colorPayload);
          if (jumia?.error || jumia?.skipped) {
            throw new Error(jumia?.error || jumia?.reason);
          }
          if (jumia?.stockFeed?.ok === false || jumia?.stockFeed?.error) {
            throw new Error(`stock_feed:${jumia.stockFeed.error || 'failed'}`);
          }
          created.push(jumia.sellerSku || colorPayload.sellerSku);
          publishedColorCodes.push(colorCandidate.code);
          await setProductVariantActive(colorCandidate.variantRowId, true);
          if (Array.isArray(jumia.imageUrls) && jumia.imageUrls.length) {
            colorPayload.imageUrls = jumia.imageUrls;
          }
          if (enrichment.syncSheet && isSheetWebhookConfigured()) {
            await appendProductToSheet(colorPayload);
          }
        } catch (e) {
          failed.push(`${colorPayload.color}: ${e.message}`);
          try {
            await setProductVariantActive(
              colorCandidate.variantRowId,
              false,
              { error: e.message },
            );
          } catch (statusError) {
            console.warn(`Variant error status failed (${colorCandidate.sellerSku}):`, statusError.message);
          }
        }
      }
      jumiaNote = created.length
        ? `\n🛒 Jumia: تم إنشاء ${created.length} منتجات ألوان\n${created.map((sku) => `• ${sku}`).join('\n')}`
        : '\n🛒 Jumia: لم يُنشأ أي منتج لون';
      if (failed.length) jumiaNote += `\n⚠️ ${failed.join(' | ')}`;
      sheetNote = enrichment.syncSheet && isSheetWebhookConfigured()
        ? '\n📋 Jumia Sheet: تمت إضافة صف مستقل لكل لون'
        : '';
    } else if (enrichment.syncJumia && enrichment.requireColorJumia) {
      jumiaNote = '\n🛒 Jumia: تم التخطي — لم توافق على أي صورة لون';
    } else if (
      enrichment.syncJumia
      && isJumiaConfigured()
      && enrichment.amazonJumiaSources?.length > 1
    ) {
      amazonMultiHandled = true;
      const created = [];
      const failed = [];
      const basePayload = enrichment.productForSheet;
      for (const source of enrichment.amazonJumiaSources) {
        const numberedSku = `${sellerSku}-${source.index}`;
        if (source.error) {
          failed.push(`${numberedSku}: ${source.error}`);
          continue;
        }
        const sourceFiles = Array.isArray(source.files) ? source.files : [];
        const imageUrls = source.index === 1
          ? professionalImageUrls
          : sourceFiles.map((f) => publicUrlFromNoco(f, enrichment.nocodbUrl || NOCODB_URL));
        if (!imageUrls?.length) {
          failed.push(`${numberedSku}: missing_images`);
          continue;
        }
        let linkRowId = null;
        try {
          // Register the extra listing before publishing: the durable image
          // proxy resolves Image1…N by Jumia_SKU, so an unregistered SKU goes
          // dark on Jumia the moment the disk cache is recycled.
          if (source.index > 1 && sourceFiles.length) {
            try {
              const saved = await upsertProductVariant({
                productId: rowId,
                colorLabel: `Amazon ${source.index}`,
                colorCode: `LINK${source.index}`,
                jumiaSku: numberedSku,
                imageFiles: sourceFiles,
                active: null,
              });
              linkRowId = saved?.rowId || null;
            } catch (e) {
              console.warn(`Amazon link ${source.index} variant row failed:`, e.message);
            }
          }
          const jumia = await createJumiaProduct({
            ...basePayload,
            sellerSku: numberedSku,
            parentSku: numberedSku,
            referenceClean: `${basePayload.referenceClean}-${source.index}`,
            frenchTitle: `${basePayload.frenchTitle} - ${source.index}`.slice(0, 120),
            arabicTitle: `${basePayload.arabicTitle} - ${source.index}`.slice(0, 120),
            imageUrls,
            publicImageSku: source.index === 1 ? sellerSku : numberedSku,
            publicImageStartIndex: 1,
          });
          if (jumia?.error || jumia?.skipped) {
            throw new Error(jumia?.error || jumia?.reason);
          }
          if (jumia?.stockFeed?.ok === false || jumia?.stockFeed?.error) {
            throw new Error(`stock_feed:${jumia.stockFeed.error || 'failed'}`);
          }
          created.push(jumia.sellerSku || numberedSku);
          if (linkRowId) await setProductVariantActive(linkRowId, true);
        } catch (error) {
          failed.push(`${numberedSku}: ${error.message}`);
          if (linkRowId) {
            try {
              await setProductVariantActive(linkRowId, false, { error: error.message });
            } catch (statusError) {
              console.warn(`Amazon link status failed (${numberedSku}):`, statusError.message);
            }
          }
        }
      }
      // Sending fewer links than last time must retire the extra listings.
      try {
        const keepCodes = enrichment.amazonJumiaSources
          .filter((s) => s.index > 1)
          .map((s) => `LINK${s.index}`);
        const rows = await listProductVariantsByProductId(rowId);
        const orphans = rows.filter((row) => {
          const code = String(row?.Color_Code || '').trim().toUpperCase();
          const status = String(row?.Active || '').trim().toUpperCase();
          return /^LINK\d+$/.test(code)
            && !keepCodes.includes(code)
            && status !== 'INACTIVE'
            && !status.startsWith('ERROR:');
        });
        for (const row of orphans) {
          await setProductVariantActive(row.Id || row.id, false);
        }
        await pauseJumiaColorSkus(orphans.map((row) => row.Jumia_SKU));
      } catch (e) {
        console.warn(`Amazon link cleanup failed #${rowId}:`, e.message);
      }
      jumiaNote = created.length
        ? `\n🛒 Jumia: تم إنشاء ${created.length} منشورات من روابط Amazon\n${created.map((sku) => `• ${sku}`).join('\n')}`
        : '\n🛒 Jumia: لم يُنشأ أي منشور من روابط Amazon';
      if (failed.length) jumiaNote += `\n⚠️ ${failed.join(' | ')}`;
    } else if (enrichment.syncJumia && isJumiaConfigured() && professionalImageUrls.length) {
      try {
        const jumia = await createJumiaProduct({
          ...enrichment.productForSheet,
          imageUrls: professionalImageUrls,
        });
        if (Array.isArray(jumia?.imageUrls) && jumia.imageUrls.length) {
          enrichment.productForSheet.imageUrls = jumia.imageUrls;
          enrichment.imageUrls = jumia.imageUrls;
        }
        if (jumia?.skipped) {
          if (jumia.reason === 'jumia_not_configured') {
            jumiaNote = '\n🛒 Jumia API: غير مضبوط';
          } else if (jumia.reason === 'images_not_public' || jumia.reason === 'missing_images') {
            jumiaNote = `\n🛒 Jumia: ${jumia.reason}`;
          }
        } else if (jumia?.error) {
          jumiaNote = `\n🛒 Jumia API خطأ: ${jumia.error}`;
        } else if (jumia?.productSetSid || jumia?.offer) {
          const offer = jumia.offer;
          const priceNote = offer
            ? `\n💰 Jumia: قائمة ${offer.listPrice} → تخفيض ${offer.salePrice}`
            : '';
          jumiaNote = `\n🛒 Jumia API: تم إنشاء/تحديث المنتج (${jumia.sellerSku})${priceNote}`;
        }
      } catch (e) {
        jumiaNote = `\n🛒 Jumia API خطأ: ${e.message}`;
      }
    } else if (enrichment.syncJumia && isJumiaConfigured()) {
      jumiaNote = '\n🛒 Jumia: تم التخطي — لا توجد صورة احترافية بخلفية بيضاء';
    }
    if (
      enrichment.syncSheet
      && !selectedColorCandidates.length
      && !enrichment.requireColorJumia
      && !amazonMultiHandled
      && isSheetWebhookConfigured()
    ) {
      try {
        const sheet = await appendProductToSheet(enrichment.productForSheet);
        sheetNote = sheet?.error
          ? `\n📋 Jumia Sheet خطأ: ${sheet.error}`
          : '\n📋 Jumia Sheet: تمت الإضافة إلى Upload Template';
      } catch (e) {
        sheetNote = `\n📋 Jumia Sheet خطأ: ${e.message}`;
      }
    }
  }

  // Only retire old colors after at least one replacement was published.
  // A provider/Jumia outage must not take the previous palette offline.
  if (publishImages && publishedColorCodes.length) {
    try {
      const removed = await deactivateRemovedProductVariants(rowId, publishedColorCodes);
      if (removed.length) {
        await pauseJumiaColorSkus(removed.map((row) => row.jumiaSku));
      }
    } catch (e) {
      console.warn(`Removed variant deactivation failed #${rowId}:`, e.message);
    }
  }

  const imgCount = nocoFiles.length;
  await sendMessage(
    chatId,
    enrichment.variantOnly && publishImages
      ? `🎨 اكتملت معالجة ألوان المنتج #${rowId} (${sellerSku}).${jumiaNote}\n✅ لم يتم تعديل صور أو وصف المنتج الأساسي.`
      : enrichment.variantOnly
        ? `✖️ تم إلغاء إضافة الألوان للمنتج #${rowId}. لم يتم تعديل المنتج الأساسي.`
        : publishImages
      ? `✨ تم اعتماد ${imgCount} صورة للمنتج #${rowId}\n📦 ${enrichment.copy?.arabic_title || enrichment.copy?.french_title || name}\n${enrichment.catalogPublished ? `🔗 ${SITE_URL}/p/${encodeURIComponent(sellerSku)}` : '🔒 المنتج غير منشور في الموقع؛ سجل الصور التقني مخفي'}${sheetNote}${jumiaNote}`
      : `📝 تم حفظ الوصف فقط للمنتج #${rowId} بدون صور.${enrichment.catalogPublished ? '\nيمكنك إعادة التوليد لاحقاً.' : '\nالسجل التقني مخفي عن الموقع.'}`
  );
}

function destinationKeyboard(token, selected = {}) {
  const mark = (key) => (selected[key] ? '✅' : '⬜');
  return {
    inline_keyboard: [
      [
        { text: `${mark('noco')} 🌐 NocoDB`, callback_data: `dest:${token}:noco` },
        { text: `${mark('tifawt')} 📦 Tifawt`, callback_data: `dest:${token}:tifawt` },
      ],
      [{ text: `${mark('jumia')} 🛒 Jumia`, callback_data: `dest:${token}:jumia` }],
      [{ text: '✅ تأكيد وجهات النشر', callback_data: `dest:${token}:go` }],
      [{ text: '✖️ إلغاء', callback_data: `dest:${token}:cancel` }],
    ],
  };
}

function destinationSummary(selected = {}) {
  const labels = [];
  if (selected.noco) labels.push('🌐 NocoDB');
  if (selected.tifawt) labels.push('📦 Tifawt');
  if (selected.jumia) labels.push('🛒 Jumia');
  return labels.length ? labels.join(' + ') : 'لم تختر أي وجهة بعد';
}

async function requestProductDestination(chatId, files, caption) {
  const now = Date.now();
  for (const [key, pending] of pendingDestinations) {
    if (pending.expiresAt < now) pendingDestinations.delete(key);
  }
  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const parsed = parseCaption(caption);
  const expiresAt = now + (10 * 60 * 1000);
  const selected = {
    noco: Boolean(getBotSetting('defaultDestinationNoco')),
    tifawt: Boolean(getBotSetting('defaultDestinationTifawt')),
    jumia: Boolean(getBotSetting('defaultDestinationJumia')),
  };
  pendingDestinations.set(token, { chatId, files, caption, selected, expiresAt });

  const imageNote = files.length >= 2 && files.length <= 4
    ? `${files.length} صور`
    : `${files.length} صورة (يفضّل إرسال 2 إلى 4)`;
  const saleNote = parsed.oldPrice
    ? `\n🔥 تخفيض: ${parsed.oldPrice} → ${parsed.price} DH`
    : '';
  await sendMessage(
    chatId,
    `📍 اختر أين تريد نشر المنتج (يمكن اختيار أكثر من وجهة):\n\n📦 ${parsed.name}\n💰 ${parsed.price} DH${saleNote}\n📋 ${parsed.sku}\n🖼️ ${imageNote}\n\n• NocoDB: يظهر في الموقع بعد اعتماد الصور.\n• Tifawt: الاسم والمرجع والصور الأصلية.\n• Jumia: وصف وصور احترافية؛ عند اختياره وحده يُستخدم سجل NocoDB مخفي لحفظ الصور دائماً.\n\nالاختيار الحالي: ${destinationSummary(selected)}`,
    destinationKeyboard(token, selected)
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
      POSTEBL: recordData.POSTEBL || 'POSTEBL',
      description_arabic: recordData.description_arabic || '',
    };
    for (const key of ['Image1', 'Image2', 'Image3', 'Image4', 'Image5', 'image2', 'image3', 'image4', 'image5']) {
      if (recordData[key]) minimal[key] = recordData[key];
    }
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
  displayBuffers = null,
  name,
  price,
  oldPrice,
  ref,
  amazonUrl,
  amazonUrls = [],
  sellerSku,
  startMessage,
  postebl = 'POSTEBL',
  publishRealOriginal = true,
  syncJumia = true,
  syncSheet = true,
  catalogPublished = true,
  nocoPostebl = 'POSTEBL',
}) {
  console.log(`✨ AI polish start #${rowId} ${sellerSku}`);
  await sendMessage(
    chatId,
    startMessage || `⏳ جاري توليد الوصف والصور الاحترافية للمنتج #${rowId}...`
  );
  const enrichTimeout = amazonUrl
    ? Number(getBotSetting('amazonTimeoutMs'))
    : Number(getBotSetting('aiBackgroundTimeoutMs'));

  let enrichment;
  try {
    enrichment = await withTimeout(
      enrichProduct({
        originalBuffers,
        displayBuffers,
        name,
        price,
        oldPrice,
        ref,
        amazonUrl,
        amazonUrls,
        uploadToNocoDB,
        nocodbUrl: NOCODB_URL,
        syncSheet,
        syncJumia,
        postebl,
        publishRealOriginal,
      }),
      enrichTimeout,
      'AI polish'
    );
    enrichment.syncJumia = syncJumia;
    enrichment.syncSheet = syncSheet;
    enrichment.catalogPublished = catalogPublished;
    enrichment.nocoPostebl = nocoPostebl;
  } catch (e) {
    console.error(`AI polish timed out/failed #${rowId}:`, e.message);
    await sendMessage(
      chatId,
      `⚠️ فشل توليد الوصف/الصور للمنتج #${rowId} (${sellerSku}).\n${e.message}\n📷 لم تُنشر صور خام غير مرغوبة على الموقع.`
    );
    return;
  }

  if (!enrichment?.copy && !enrichment?.hasAiImages) {
    const failures = enrichment?.aiFailures || [];
    const detail = failures.slice(0, 2).join(' | ');
    const missingKeys = failures.some((f) => String(f).includes('ai_disabled_or_unconfigured') || String(f).includes('PRODUCT_AI_ENRICHMENT=false'))
      ? '\n⚙️ السبب: مفاتيح الذكاء الاصطناعي غير مضبوطة على سيرفر البوت.\nأضف في EasyPanel (خدمة البوت):\n• OPENROUTER_API_KEY (إلزامي للصور)\n• OPENAI_API_KEY (اختياري للنصوص)\n• PRODUCT_AI_ENRICHMENT=true\nثم أعد تشغيل الخدمة وأعد المحاولة.'
      : (detail ? `\n🛠️ ${detail}` : '');
    await sendMessage(
      chatId,
      `⚠️ لم يكتمل التوليد للمنتج #${rowId} (${sellerSku}).${missingKeys}\n📷 لم تُنشر صور الوصف/الضهر الخام على الموقع.`
    );
    return;
  }

  // Save title/description first (no gallery yet).
  const textOnly = {
    ...enrichment,
    nocoImages: [],
    imageUrls: [],
  };
  const textPatch = buildNocoRecordFromEnrichment({ price, name, enrichment: textOnly });
  textPatch.Id = rowId;
  await http.patch(recordUrl, textPatch, {
    headers: { 'xc-token': NOCODB_TOKEN, 'Content-Type': 'application/json' },
  });

  const detectedColors = parseColorList(enrichment.detectedColorVariants || []);
  if (enrichment.syncJumia && detectedColors.length > 1) {
    const askedColors = await requestColorApproval({
      chatId,
      rowId,
      recordUrl,
      name,
      price,
      oldPrice,
      sellerSku,
      enrichment,
      // Description-only photos may contain additional variants, so preserve
      // the full vision set for color-specific generation.
      sourceBuffers: (
        enrichment.amazonSourceBuffers?.length
          ? enrichment.amazonSourceBuffers
          : originalBuffers
      ).slice(0, 4),
    }, detectedColors);
    if (askedColors) {
      console.log(`🎨 Color approval pending #${rowId} ${sellerSku}: ${detectedColors.join(', ')}`);
      return;
    }
  }

  const wantsApproval = Boolean(amazonUrl || getBotSetting('galleryApproval'));
  if (wantsApproval && enrichment.galleryCandidates?.length) {
    const asked = await requestGalleryApproval({
      chatId,
      rowId,
      recordUrl,
      name,
      price,
      sellerSku,
      enrichment,
    });
    if (asked) {
      console.log(`⏳ Gallery approval pending #${rowId} ${sellerSku}`);
      return;
    }
  }

  // Fallback: no candidates to approve — publish whatever we have.
  const patch = buildNocoRecordFromEnrichment({ price, name, enrichment });
  patch.Id = rowId;
  await http.patch(recordUrl, patch, {
    headers: { 'xc-token': NOCODB_TOKEN, 'Content-Type': 'application/json' },
  });
  if (enrichment.syncJumia && enrichment.productForSheet?.imageUrls?.length && isJumiaConfigured()) {
    try {
      enrichment.jumia = await createJumiaProduct(enrichment.productForSheet);
      if (Array.isArray(enrichment.jumia?.imageUrls) && enrichment.jumia.imageUrls.length) {
        enrichment.productForSheet.imageUrls = enrichment.jumia.imageUrls;
        enrichment.imageUrls = enrichment.jumia.imageUrls;
      }
    } catch (e) {
      enrichment.jumia = { error: e.message };
    }
  }
  if (enrichment.syncSheet && enrichment.productForSheet?.imageUrls?.length && isSheetWebhookConfigured()) {
    try {
      enrichment.sheet = await appendProductToSheet(enrichment.productForSheet);
    } catch (e) {
      enrichment.sheet = { error: e.message };
    }
  }
  const imgCount = enrichment.nocoImages?.length || 0;
  const sheet = enrichment?.sheet;
  const sheetNote = sheet?.skipped
    ? ''
    : (sheet?.error
      ? `\n📋 Jumia Sheet خطأ: ${sheet.error}`
      : (sheet ? '\n📋 Jumia Sheet: تمت الإضافة إلى Upload Template' : ''));
  const jumia = enrichment?.jumia;
  let jumiaNote = '';
  if (jumia?.error) {
    jumiaNote = `\n🛒 Jumia API خطأ: ${jumia.error}`;
  } else if (jumia?.productSetSid || jumia?.offer) {
    jumiaNote = `\n🛒 Jumia API: تم إنشاء المنتج (${jumia.sellerSku})`;
  }
  await sendMessage(
    chatId,
    `✨ تم تحديث المنتج #${rowId}\n`
    + `🎨 ${imgCount} صور في المعرض\n`
    + `📦 ${enrichment.copy?.arabic_title || enrichment.copy?.french_title || name}\n`
    + `${enrichment.catalogPublished ? `🔗 ${SITE_URL}/p/${encodeURIComponent(sellerSku)}` : '🔒 سجل الصور التقني مخفي عن الموقع'}${sheetNote}${jumiaNote}`
  );
  console.log(`✅ AI polish OK #${rowId} (no gallery approval UI)`);
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
  displayBuffers = null,
  name,
  price,
  oldPrice,
  sku,
  amazonUrl,
  amazonUrls = [],
  sellerSku,
  publishRealOriginal = true,
  syncJumia = true,
  syncSheet = true,
  catalogPublished = true,
  nocoPostebl = 'POSTEBL',
}) {
  enqueueAiPolish(() => executeAiPolish({
    chatId,
    rowId,
    recordUrl,
    originalBuffers,
    displayBuffers,
    name,
    price,
    oldPrice,
    ref: sku,
    amazonUrl,
    amazonUrls,
    sellerSku,
    postebl: 'POSTEBL',
    publishRealOriginal,
    syncJumia,
    syncSheet,
    catalogPublished,
    nocoPostebl,
    startMessage: amazonUrl
      ? `⏳ جاري كشط ${amazonUrls.length || 1} رابط Amazon للمنتج #${rowId}...\n⭐ سأرسل جميع الصور لاختيار الأساسية\n🎨 لن أُنشئ صورة بالذكاء قبل موافقتك`
      : `⏳ جاري توليد الوصف والصور الاحترافية للمنتج #${rowId} في الخلفية...\n🎨 ستوديو أبيض + زاوية إضافية\n📖 صور الوصف تُستخدم للقراءة فقط ولن تُنشر خام`,
  }));
}

/** Re-run AI enrichment for an existing product found by REF/SKU. */
async function scheduleReenrichByRef(
  chatId,
  record,
  rawRef,
  { amazonUrl = '', amazonUrls = [] } = {},
) {
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
    const tried = preferred.length ? preferred : sourceFiles.slice(0, 4);
    for (const file of tried) {
      const url = nocoImageUrl(file);
      if (!url) continue;
      try {
        originalBuffers.push(await downloadNocoImageBuffer(url));
      } catch (e) {
        console.warn(`Reenrich download failed (${sellerSku}):`, e.message);
      }
    }
    // Last resort: try remaining gallery slots if preferred downloads failed.
    if (!originalBuffers.length) {
      for (const file of sourceFiles) {
        if (tried.includes(file)) continue;
        const url = nocoImageUrl(file);
        if (!url) continue;
        try {
          originalBuffers.push(await downloadNocoImageBuffer(url));
          if (originalBuffers.length >= 2) break;
        } catch (e) {
          console.warn(`Reenrich fallback download failed (${sellerSku}):`, e.message);
        }
      }
    }
    if (!originalBuffers.length) {
      await sendMessage(
        chatId,
        `❌ تعذر تحميل صور المنتج #${rowId} (${sellerSku}) لإعادة التوليد.\nتأكد أن المنتج يحتوي على صورة أصلية ثم أعد المحاولة.`
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
      amazonUrl: amazonUrl || record.Amazon_URL || '',
      amazonUrls: amazonUrls.length
        ? amazonUrls
        : [amazonUrl || record.Amazon_URL || ''].filter(Boolean),
      sellerSku,
      postebl: record.POSTEBL || record.Postebl || 'POSTEBL',
      // Preserve Jumia-only technical rows: never unhide PAUSED on re-enrich.
      nocoPostebl: record.POSTEBL || record.Postebl || 'POSTEBL',
      catalogPublished: !['PAUSED', 'HIDDEN'].includes(
        String(record.POSTEBL || record.Postebl || 'POSTEBL').toUpperCase(),
      ),
      syncJumia: true,
      syncSheet: true,
      startMessage: amazonUrl
        ? `⏳ جاري إعادة بناء المنتج #${rowId} (${sellerSku}) من Amazon...\n🔎 استخراج ${amazonUrls.length || 1} رابط وصور Amazon\n⭐ سترسل لك الصور لاختيار الأساسية\n🎨 سأطلب منك اختيار إنشاء صورة بالذكاء أو الاكتفاء بصور Amazon\n🛒 ${amazonUrls.length > 1 ? `سيتم إنشاء ${amazonUrls.length} منشورات Jumia مرقّمة` : 'سيتم طلب موافقتك قبل النشر'}.`
        : `⏳ جاري إعادة توليد الوصف والصور للمنتج #${rowId} (${sellerSku})...\n🎨 صورة احترافية أولاً، ثم الأصلية ثانياً — وبطاقة الوصف داخل قسم الوصف فقط.\n🛒 سيتم النشر على Jumia تلقائياً بعد الانتهاء.`,
    });
  });

  const queueNote = aiPolishPending > 1
    ? `\n📋 هناك ${aiPolishPending} مهام توليد في الانتظار.`
    : '';
  await sendMessage(
    chatId,
    amazonUrl
      ? `✅ تم إدراج (${sellerSku}) لإعادة البناء من Amazon.${queueNote}\n⏳ سأرسل لك الصور والنتيجة عند الانتهاء.`
      : `✅ تم إدراج (${sellerSku}) في قائمة التوليد.${queueNote}\n⏳ سأرسل لك رسالة عند الانتهاء.\n\n🔁 أرسل مرجعاً آخر أو اضغط 🔄 للخروج.`
  );
}

async function processProduct(
  chatId,
  files,
  caption,
  destinations = { noco: true, tifawt: true, jumia: true },
  roles = null,
) {
  const {
    price, oldPrice, name, sku, amazonUrl, amazonUrls,
  } = parseCaption(caption);
  const sellerSku = buildSellerSku(sku);
  const tifawtSku = toTifawtSku(sku, { fallback: 'REF' });
  const publishNoco = Boolean(destinations?.noco);
  const publishTifawt = Boolean(destinations?.tifawt);
  const publishJumia = Boolean(destinations?.jumia);
  const needsAiStorage = publishNoco || publishJumia;
  const destinationText = destinationSummary({ noco: publishNoco, tifawt: publishTifawt, jumia: publishJumia });
  const effectiveRoles = Array.isArray(roles) && roles.length === files.length
    ? roles
    : files.map(() => 'both');
  console.log(
    `📦 Processing product: "${name}" | ${price} DH${oldPrice ? ` (was ${oldPrice})` : ''} | ${files.length} images | roles=${effectiveRoles.join(',')} | NocoSKU ${sellerSku} | TifawtSKU ${tifawtSku} | destinations=${destinationText}${amazonUrl ? ` | Amazon ${amazonUrl}` : ''}`
  );

  await sendMessage(
    chatId,
    !needsAiStorage && publishTifawt
      ? `⏳ جاري إرسال المنتج مباشرة إلى Tifawt (أصل بدون تعديل)...\n📦 ${name}\n💰 ${price} DH\n📋 ${tifawtSku}\n🖼️ ${files.length} صورة`
      : `⏳ جاري تجهيز المنتج للوجهات المختارة...\n📍 ${destinationText}\n📦 ${name}\n💰 ${price} DH${oldPrice ? ` ← كان ${oldPrice}` : ''}\n📋 ${sellerSku}`
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

  const displayBuffers = [];
  const visionBuffers = [];
  for (let i = 0; i < downloaded.length; i++) {
    const buf = downloaded[i]?.buffer;
    if (!buf) continue;
    const role = effectiveRoles[i] || 'both';
    if (role === 'skip') continue;
    if (role === 'display' || role === 'both') displayBuffers.push(buf);
    if (role === 'desc' || role === 'both' || role === 'display') {
      // Display photos also help vision identity; desc-only backs stay vision-only.
      visionBuffers.push(buf);
    }
  }

  // Vision needs at least one photo; fall back to display if user marked only display.
  const originalBuffers = visionBuffers.length ? visionBuffers : displayBuffers.slice();
  if (!originalBuffers.length) {
    await sendMessage(chatId, '❌ لا توجد صور صالحة بعد التصنيف. أعد الإرسال واختر دوراً واحداً على الأقل.');
    return;
  }

  const tifawtBuffers = displayBuffers.length ? displayBuffers : originalBuffers;

  // Send originals immediately (no barcode scan — that only slowed us down).
  // Tifawt + NocoDB get the seller payload first; AI polish patches later.
  if (!needsAiStorage && publishTifawt) {
    const result = await createTifawtProduct({
      name,
      sku: tifawtSku,
      price,
      imageBuffers: tifawtBuffers,
      imageFileName: `${tifawtSku}-1.jpg`,
    });
    if (result?.ok) {
      await sendMessage(
        chatId,
        `✅ تم إرسال المنتج إلى Tifawt فقط.\n\n📦 ${name}\n💰 ${price} DH | 📋 ${tifawtSku}\n🖼️ ${result.imageCount || tifawtBuffers.length} صورة أصلية`
      );
    } else {
      await sendMessage(chatId, `❌ تعذر إنشاء المنتج في Tifawt:\n${result?.error || result?.reason || 'خطأ غير معروف'}`);
    }
    return;
  }

  // Fire Tifawt in parallel — do not block NocoDB save on it.
  if (publishTifawt && isTifawtProductSyncConfigured()) {
    (async () => {
      try {
        let result = await createTifawtProduct({
          name,
          sku: tifawtSku,
          price,
          imageBuffers: tifawtBuffers,
          imageFileName: `${tifawtSku}-1.jpg`,
        });
        if (!result?.ok && !result?.skipped) {
          await delay(1500);
          result = await createTifawtProduct({
            name,
            sku: tifawtSku,
            price,
            imageBuffers: tifawtBuffers,
            imageFileName: `${tifawtSku}-1.jpg`,
          });
        }
        if (result?.ok) {
          const modeAr = result.mode === 'updated' ? 'تم تحديث الأصل' : 'تم إضافة الأصل';
          await sendMessage(
            chatId,
            `🛒 Tifawt: ${modeAr}\n📦 ${name}\n📋 ${tifawtSku}\n🖼️ ${result.imageCount || tifawtBuffers.length} صور أصلية`
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

  // Fast create WITHOUT publishing raw gallery images.
  // AI polish patches Image1–5 only after studio generation succeeds.
  const enrichment = {
    sellerSku,
    amazonUrl: amazonUrl || '',
    syncJumia: publishJumia,
    syncSheet: publishJumia,
    catalogPublished: publishNoco,
    nocoPostebl: publishNoco ? 'POSTEBL' : 'PAUSED',
    skippedAi: true,
    copy: null,
    barcode: '',
    nocoImages: [],
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
  const tifawtNote = publishTifawt
    ? (isTifawtProductSyncConfigured()
      ? `\n🛒 Tifawt: يُرسل الأصل الآن بالمرجع ${tifawtSku}`
      : '\n🛒 Tifawt: أضف TIFAWT_EMAIL و TIFAWT_PASSWORD')
    : '';
  const nocoNote = publishNoco
    ? '\n🌐 NocoDB: سيظهر المنتج في الموقع بعد اعتماد الصور'
    : '\n🔒 NocoDB: سجل تقني مخفي لحفظ صور Jumia فقط';
  const jumiaChoiceNote = publishJumia
    ? '\n🛒 Jumia: سيتم النشر بعد اعتماد الصور'
    : '\n🛒 Jumia: غير محدد — لن يتم النشر';
  const roleNote = `\n🖼️ وصف: ${effectiveRoles.filter((r) => r === 'desc' || r === 'both').length} | عرض: ${effectiveRoles.filter((r) => r === 'display' || r === 'both').length}`;

  console.log(`✅ NocoDB row created fast (no raw gallery): #${rowId}`);

  const keyboard = buildCategoryKeyboard(rowId);
  await sendMessage(
    chatId,
    `✅ تم تجهيز المنتج #${rowId} بدون نشر صور خام!\n\n📦 ${name}\n💰 ${price} DH | 📋 ${sellerSku}${saleNote}${roleNote}${nocoNote}${tifawtNote}${jumiaChoiceNote}${publishNoco ? `\n🔗 صفحة الهبوط: ${landing}` : ''}\n\n${amazonUrl ? `🔎 سيتم كشط ${amazonUrls.length || 1} رابط Amazon، ثم تختار الصورة الأساسية وهل تريد توليد صورة بالذكاء.` : '✨ الصور الاحترافية تُضاف تلقائياً بعد التوليد.'}${publishNoco ? '\n\n⬇️ اختر تصنيف المنتج:' : ''}`,
    publishNoco ? keyboard : undefined
  );

  scheduleAiPolish({
    chatId,
    rowId,
    recordUrl,
    originalBuffers: originalBuffers.slice(),
    displayBuffers: displayBuffers.slice(),
    name,
    price,
    oldPrice,
    sku,
    amazonUrl,
    amazonUrls,
    sellerSku,
    syncJumia: publishJumia,
    syncSheet: publishJumia,
    catalogPublished: publishNoco,
    nocoPostebl: publishNoco ? 'POSTEBL' : 'PAUSED',
    // Include one display original as Image2 only after AI studio images exist.
    publishRealOriginal: displayBuffers.length > 0,
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

function isAddColorsCommand(text) {
  return text === '🎨 إضافة ألوان لمنتج موجود'
    || text.startsWith('/add_colors');
}

function isAmazonReenrichCommand(text) {
  return text === '🛒 إعادة بناء من Amazon'
    || text.startsWith('/amazon_rebuild');
}

/** Shortcut: "<REF> 112" starts an Amazon-backed rebuild for that product. */
function amazonReenrichRef(text) {
  const match = String(text || '').trim().match(/^(.+?)\s+112$/i);
  return match?.[1]?.trim() || '';
}

function validAmazonProductUrl(text) {
  return normalizeAmazonUrls(text, { max: 4 }).length > 0;
}

function isJumiaShipCommand(text) {
  return text === '📦 تجهيز شحن Jumia'
    || text.startsWith('/jumia_ship')
    || text.startsWith('/jumia_ready');
}

function isJumiaCancelCommand(text) {
  return text === '❌ إلغاء طلب Jumia'
    || text.startsWith('/jumia_cancel');
}

function isJumiaLabelCommand(text) {
  return text === '🏷️ ملصق شحن Jumia'
    || text.startsWith('/jumia_label');
}

async function pauseJumiaColorSkus(colorSkus = []) {
  if (!isJumiaConfigured()) return [];
  const results = [];
  for (const colorSku of [...new Set((colorSkus || []).map((sku) => String(sku || '').trim()).filter(Boolean))]) {
    try {
      const visibility = await setJumiaProductActive(colorSku, false);
      const stock = await setJumiaProductStock(
        colorSku,
        resolveJumiaStock('NO POSTEBL'),
      ).catch((error) => ({ ok: false, error: error.message }));
      results.push({ sellerSku: colorSku, visibility, stock });
    } catch (error) {
      results.push({ sellerSku: colorSku, error: error.message });
      console.warn(`Jumia pause failed for removed color ${colorSku}:`, error.message);
    }
  }
  return results;
}

async function colorJumiaSkusFromRecord(record) {
  const productId = record?.Id || record?.id;
  if (!productId) return [];
  try {
    return await listJumiaColorSkusByProductId(productId);
  } catch (e) {
    console.warn(`Variant SKU lookup failed for #${productId}:`, e.message);
    return [];
  }
}

async function syncJumiaVisibility(recordOrSku, active) {
  if (!isJumiaConfigured()) {
    return { skipped: true, reason: 'jumia_not_configured' };
  }
  const record = typeof recordOrSku === 'object' ? recordOrSku : null;
  const sku = record?.SKU || recordOrSku;
  const colorSkus = await colorJumiaSkusFromRecord(record);
  if (colorSkus.length) {
    const results = [];
    for (const colorSku of colorSkus) {
      try {
        const visibility = await setJumiaProductActive(colorSku, active);
        const stock = await setJumiaProductStock(
          colorSku,
          active ? resolveJumiaStock('POSTEBL') : resolveJumiaStock('NO POSTEBL'),
        ).catch((error) => ({ ok: false, error: error.message }));
        results.push({
          ...visibility,
          sellerSku: visibility.sellerSku || colorSku,
          stock,
        });
      } catch (error) {
        results.push({ sellerSku: colorSku, error: error.message });
      }
    }
    const failures = results.filter(
      (result) => result.error || result.stock?.ok === false || result.stock?.error,
    );
    return {
      ok: failures.length === 0,
      colorCount: colorSkus.length,
      results,
      error: failures.length
        ? failures.map((f) => `${f.sellerSku}:${f.error || f.stock?.error || 'stock_failed'}`).join(' | ')
        : null,
    };
  }
  const candidates = [
    buildSellerSku(sku),
    cleanReference(sku),
    String(sku || '').trim(),
  ].filter(Boolean);
  const tried = new Set();
  let lastError = null;
  for (const candidate of candidates) {
    if (tried.has(candidate.toLowerCase())) continue;
    tried.add(candidate.toLowerCase());
    try {
      const visibility = await setJumiaProductActive(candidate, active);
      let stockResult = null;
      try {
        stockResult = await setJumiaProductStock(
          candidate,
          active ? resolveJumiaStock('POSTEBL') : resolveJumiaStock('NO POSTEBL'),
        );
      } catch (stockError) {
        // Visibility can succeed while stock feed fails on incomplete country products.
        stockResult = { error: stockError?.message || 'stock_failed' };
      }
      return { ...visibility, stock: stockResult };
    } catch (error) {
      lastError = error;
      if (error?.message !== 'jumia_product_not_found') break;
    }
  }
  return {
    error: lastError?.message || 'jumia_visibility_failed',
    details: lastError?.details || null,
  };
}

function formatJumiaVisibilityNote(jumiaResult, active) {
  if (!jumiaResult || jumiaResult.skipped) return '';
  if (jumiaResult.error === 'jumia_product_not_found') {
    return '\n🛒 Jumia: المنتج غير موجود على Jumia';
  }
  if (jumiaResult.error) {
    return `\n🛒 Jumia خطأ: ${jumiaResult.error}`;
  }
  if (jumiaResult.colorCount) {
    return active
      ? `\n🛒 Jumia: تم تفعيل ${jumiaResult.colorCount} منتجات ألوان`
      : `\n🛒 Jumia: تم إيقاف ${jumiaResult.colorCount} منتجات ألوان`;
  }
  return active
    ? '\n🛒 Jumia: تم تفعيل المنتج (ACTIVE)'
    : '\n🛒 Jumia: تم إيقاف المنتج (INACTIVE)';
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
          : 'أهلاً بك في بوت إدارة الكتالوج! 📦\nيمكنك إرسال صور المنتجات لرفعها، أو استخدام الأزرار بالأسفل لإدارة المنتجات:\n\n🌐 زر OPEN: يفتح لوحة التحكم على الويب (إضافة/تعديل المنتجات وجميع الإعدادات).\n\n📝 صيغة المنتج:\nالسعر\nالاسم\nالمرجع\nرابط Amazon واحد أو حتى 4 روابط (اختياري)\n\n🔥 تخفيض: 120/200 (الجديد/القديم)\n\n✨ صور الموقع: ستوديو أبيض احترافي (تختارها قبل النشر)\n💡 Tifawt يستلم الاسم والمرجع والصور الأصلية كما أرسلتها.\n\n🎨 إضافة ألوان: اضغط «إضافة ألوان لمنتج موجود»، أرسل المرجع ثم صور الألوان.\n🔄 إعادة توليد عادي: زر «✨ إعادة توليد الوصف والصور» ثم أرسل المرجع.\n🛒 إعادة بناء من Amazon: الرابط الأول للمتجر، وكل رابط ينشئ منشور Jumia مرقّماً مستقلاً.',
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

    const colorState = userState[chatId];
    if (colorState?.type === 'AWAITING_COLOR_VARIANTS') {
      if (colorState.pending?.expiresAt < Date.now()) {
        delete userState[chatId];
        await sendMessage(chatId, '⌛ انتهت مهلة تصحيح الألوان. أعد توليد المنتج.');
        return;
      }
      const colors = parseColorList(text);
      if (!colors.length) {
        await sendMessage(
          chatId,
          '❌ لم أفهم الألوان. اكتب كل شكل لوني مفصولاً بفاصلة.\nمثال:\nأبيض وأسود، أسود مع أزرق، أزرق',
        );
        return;
      }
      delete userState[chatId];
      await sendMessage(
        chatId,
        `✅ تم اعتماد الألوان التي كتبتها:\n${colors.map((color, index) => `${index + 1}. ${color}`).join('\n')}`,
      );
      enqueueAiPolish(() => continueAfterColorApproval(colorState.pending, colors));
      return;
    }

    const amazonState = userState[chatId];
    if (amazonState?.type === 'AWAITING_AMAZON_REENRICH_URL') {
      if (!validAmazonProductUrl(text)) {
        await sendMessage(
          chatId,
          '❌ لم أجد رابط Amazon صالحاً. أرسل من رابط واحد إلى 4 روابط، كل رابط في سطر مستقل.'
        );
        return;
      }

      const amazonUrls = normalizeAmazonUrls(text, { max: 4 });
      const amazonUrl = amazonUrls[0];
      const record = await findProductBySku(amazonState.ref);
      if (!record) {
        delete userState[chatId];
        await sendMessage(chatId, `❌ لم أعد أجد المنتج (${amazonState.ref}) في قاعدة البيانات.`);
        return;
      }

      const recordId = record.Id || record.id;
      await axios.patch(
        `${NOCODB_URL}/api/v2/tables/${NOCODB_TABLE}/records`,
        { Id: recordId, Amazon_URL: amazonUrl },
        { headers: { 'xc-token': NOCODB_TOKEN, 'Content-Type': 'application/json' }, timeout: 30000 }
      );
      delete userState[chatId];
      await scheduleReenrichByRef(chatId, { ...record, Amazon_URL: amazonUrl }, amazonState.ref, {
        amazonUrl,
        amazonUrls,
      });
      return;
    }

    const amazonRef = amazonReenrichRef(text);
    if (amazonRef) {
      const record = await findProductBySku(amazonRef);
      if (!record) {
        await sendMessage(
          chatId,
          `❌ لم أجد منتجاً بالمرجع (${amazonRef}).\nتأكد من المرجع ثم أرسل مثلاً: ${amazonRef} 112`
        );
        return;
      }
      userState[chatId] = {
        type: 'AWAITING_AMAZON_REENRICH_URL',
        ref: amazonRef,
      };
      await sendMessage(
        chatId,
        `✅ تم العثور على المنتج (${record.SKU || amazonRef}).\n\n🔗 أرسل من رابط واحد إلى 4 روابط Amazon لنفس المنتج.\nضع كل رابط في سطر مستقل. الرابط الأول سيُستخدم للمتجر، وسيُنشأ في Jumia منشور مستقل لكل رابط بمرجع مرقّم.`
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

    if (isAddColorsCommand(text)) {
      userState[chatId] = 'AWAITING_REF_ADD_COLORS';
      await sendMessage(
        chatId,
        '🎨 إضافة ألوان لمنتج موجود\n\nأرسل الآن مرجع المنتج (REF أو SKU).\nبعد العثور عليه سأطلب منك صور الألوان فقط، ولن أغيّر صور أو وصف المنتج الأساسي.',
      );
      return;
    }

    if (isAmazonReenrichCommand(text)) {
      userState[chatId] = 'AWAITING_REF_AMAZON_REENRICH';
      await sendMessage(
        chatId,
        '🛒 إعادة بناء منتج من Amazon\n\nأرسل الآن مرجع المنتج فقط (REF أو SKU).\nمثال: KP-2205\n\nبعد العثور عليه يمكنك إرسال من رابط واحد إلى 4 روابط Amazon لنفس المنتج. الرابط الأول للمتجر، وكل رابط ينشئ منشور Jumia مستقلاً.'
      );
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

    if (isJumiaShipCommand(text)) {
      if (!isJumiaConfigured()) {
        await sendMessage(chatId, '⚠️ Jumia غير مضبوط على البوت.\nأضف JUMIA_CLIENT_ID و JUMIA_REFRESH_TOKEN ثم أعد النشر.');
        return;
      }
      userState[chatId] = 'AWAITING_JUMIA_SHIP';
      await sendMessage(chatId, '📦 تجهيز شحن Jumia\n\nأرسل رقم الطلب (مثال: 190 أو JUMIA-190)\nسيتم: تعبئة الطرد + Ready To Ship\nللخروج: 🔄 إعادة تشغيل البوت');
      return;
    }

    if (isJumiaCancelCommand(text)) {
      if (!isJumiaConfigured()) {
        await sendMessage(chatId, '⚠️ Jumia غير مضبوط على البوت.\nأضف JUMIA_CLIENT_ID و JUMIA_REFRESH_TOKEN ثم أعد النشر.');
        return;
      }
      userState[chatId] = 'AWAITING_JUMIA_CANCEL';
      await sendMessage(chatId, '❌ إلغاء طلب Jumia\n\nأرسل رقم الطلب لإلغاء كل عناصره.\nمثال: 190 أو JUMIA-190\nللخروج: 🔄 إعادة تشغيل البوت');
      return;
    }

    if (isJumiaLabelCommand(text)) {
      if (!isJumiaConfigured()) {
        await sendMessage(chatId, '⚠️ Jumia غير مضبوط على البوت.');
        return;
      }
      userState[chatId] = 'AWAITING_JUMIA_LABEL';
      await sendMessage(chatId, '🏷️ ملصق شحن Jumia\n\nأرسل رقم الطلب لجلب الملصق.\nمثال: 190 أو JUMIA-190');
      return;
    }

    if (typeof userState[chatId] === 'string' && userState[chatId].startsWith('AWAITING_JUMIA_')) {
      const state = userState[chatId];
      const orderId = normalizeJumiaOrderId(text);
      if (!orderId) {
        await sendMessage(chatId, '❌ رقم الطلب غير صالح. أرسل مثل: 190');
        return;
      }
      try {
        if (state === 'AWAITING_JUMIA_SHIP') {
          await sendMessage(chatId, `⏳ جاري تجهيز شحن الطلب ${orderId}...`);
          const result = await shipJumiaOrder(orderId);
          await sendMessage(
            chatId,
            `✅ تم تجهيز شحن Jumia ${result.orderId}\n📦 عناصر: ${result.ready?.itemIds?.length || result.packed?.itemIds?.length || 0}\n🚚 مزوّد: ${result.packed?.providerId || '—'}\n\n🔁 أرسل رقم طلب آخر أو 🔄 للخروج.`
          );
        } else if (state === 'AWAITING_JUMIA_CANCEL') {
          await sendMessage(chatId, `⏳ جاري إلغاء الطلب ${orderId}...`);
          const result = await cancelJumiaOrder(orderId);
          await sendMessage(
            chatId,
            `✅ تم إلغاء طلب Jumia ${result.orderId}\n📦 عناصر ملغاة: ${result.itemIds?.length || 0}\n\n🔁 أرسل رقم طلب آخر أو 🔄 للخروج.`
          );
        } else if (state === 'AWAITING_JUMIA_LABEL') {
          await sendMessage(chatId, `⏳ جاري جلب ملصق ${orderId}...`);
          const result = await printJumiaLabels(orderId);
          const labelData = result.result;
          const b64 = labelData?.file
            || labelData?.pdf
            || labelData?.label
            || labelData?.document
            || labelData?.data;
          if (typeof b64 === 'string' && b64.length > 100) {
            const buffer = Buffer.from(b64.replace(/^data:application\/pdf;base64,/, ''), 'base64');
            const form = new FormData();
            form.append('chat_id', String(chatId));
            form.append('document', buffer, {
              filename: `jumia-label-${orderId}.pdf`,
              contentType: 'application/pdf',
            });
            form.append('caption', `🏷️ ملصق شحن Jumia ${orderId}`);
            await axios.post(`${TG_API}/sendDocument`, form, {
              headers: form.getHeaders(),
              timeout: 60000,
              maxBodyLength: Infinity,
            });
          } else {
            await sendMessage(
              chatId,
              `✅ استجابة ملصق Jumia ${orderId}:\n${JSON.stringify(labelData || {}).slice(0, 1500)}`
            );
          }
        }
      } catch (error) {
        console.error('Jumia order command failed:', error?.details || error?.message);
        await sendMessage(
          chatId,
          `❌ فشل أمر Jumia للطلب ${orderId}:\n${error?.message || 'unknown'}`
        );
      }
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

    if (userState[chatId]?.type === 'AWAITING_EXISTING_COLOR_PHOTOS') {
      await sendMessage(
        chatId,
        `📷 أرسل الآن صورة واحدة أو ألبوم صور يحتوي على ألوان المنتج (${userState[chatId].context.sellerSku}).\nللإلغاء اضغط 🔄 إعادة تشغيل البوت.`,
      );
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
          const jumiaResult = await syncJumiaVisibility(record, false);
          await sendMessage(
            chatId,
            `✅ تم إيقاف المنتج (${sku}) ← "نفد من المخزون"${formatJumiaVisibilityNote(jumiaResult, false)}\n\n🔁 أرسل مرجع منتج آخر أو اضغط 🔄 للخروج.`
          );
        } else if (state === 'AWAITING_REF_RESTOCK') {
          await axios.patch(
            `${NOCODB_URL}/api/v2/tables/${NOCODB_TABLE}/records`,
            { Id: recordId, POSTEBL: 'POSTEBL' },
            { headers: { 'xc-token': NOCODB_TOKEN, 'Content-Type': 'application/json' }, timeout: 30000 }
          );
          const jumiaResult = await syncJumiaVisibility(record, true);
          await sendMessage(
            chatId,
            `✅ تم جعل المنتج (${sku}) "متوفراً"${formatJumiaVisibilityNote(jumiaResult, true)}\n\n🔁 أرسل مرجع منتج آخر أو اضغط 🔄 للخروج.`
          );
        } else if (state === 'AWAITING_REF_CATEGORY') {
          const keyboard = buildCategoryKeyboard(recordId);
          await sendMessage(chatId, `⬇️ المنتج (${sku}) — اختر التصنيف:`, keyboard);
        } else if (state === 'AWAITING_REF_PRICE') {
          userState[chatId] = `AWAITING_NEW_PRICE_${sku}`;
          await sendMessage(chatId, `✅ تم العثور على المنتج (${sku}).\n💰 سعره الحالي: ${record.price || 0} DH\n\n⬇️ يرجى إرسال السعر الجديد الآن (أرقام فقط):`);
        } else if (state === 'AWAITING_REF_AMAZON_REENRICH') {
          userState[chatId] = {
            type: 'AWAITING_AMAZON_REENRICH_URL',
            ref: sku,
          };
          await sendMessage(
            chatId,
            `✅ تم العثور على المنتج (${record.SKU || sku}).\n\n🔗 أرسل من رابط واحد إلى 4 روابط Amazon لنفس المنتج، كل رابط في سطر.\nالرابط الأول سيُستخدم للمتجر، وسيُنشأ منشور Jumia مرقّم لكل رابط.\nبعد الكشط سأرسل الصور لتختار الرئيسية وتقرر هل تريد توليد صورة بالذكاء.`
          );
        } else if (state === 'AWAITING_REF_REENRICH') {
          await scheduleReenrichByRef(chatId, record, sku);
        } else if (state === 'AWAITING_REF_ADD_COLORS') {
          const context = existingProductColorContext(chatId, record);
          userState[chatId] = {
            type: 'AWAITING_EXISTING_COLOR_PHOTOS',
            context,
          };
          await sendMessage(
            chatId,
            `✅ تم العثور على المنتج (${context.sellerSku}).\n\n📷 أرسل الآن صور الألوان كصورة واحدة أو ألبوم.\nسأكتشف الألوان ثم أطلب موافقتك قبل إنشاء صور ومنتجات Jumia.\n\n🔒 صور ووصف المنتج الأساسي لن يتغيرا.`,
          );
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
    const colorPhotoState = userState[chatId]?.type === 'AWAITING_EXISTING_COLOR_PHOTOS'
      ? userState[chatId]
      : null;

    if (groupId) {
      if (!albumBuffer[groupId]) {
        const colorContext = colorPhotoState?.context || null;
        if (colorPhotoState) delete userState[chatId];
        albumBuffer[groupId] = {
          files: [],
          caption: '',
          chatId,
          mode: colorContext ? 'existing-colors' : 'new-product',
          colorContext,
          timer: setTimeout(() => {
            const album = albumBuffer[groupId];
            delete albumBuffer[groupId];
            if (!album) return;
            if (album.mode === 'existing-colors') {
              enqueueAiPolish(
                () => processExistingProductColorPhotos(
                  album.chatId,
                  album.files,
                  album.colorContext,
                ),
              );
            } else {
              requestProductDestination(album.chatId, album.files, album.caption).catch((err) => {
                console.error('Destination prompt failed:', err.message);
              });
            }
          }, 3000),
        };
      }
      albumBuffer[groupId].files.push({ fileId, extName });
      if (msg.caption) albumBuffer[groupId].caption = msg.caption;
    } else if (colorPhotoState) {
      delete userState[chatId];
      enqueueAiPolish(
        () => processExistingProductColorPhotos(
          chatId,
          [{ fileId, extName }],
          colorPhotoState.context,
        ),
      );
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

    if (data.startsWith('colors:')) {
      const [, token, action] = data.split(':');
      const pending = pendingColorApprovals.get(token);
      if (!pending || pending.chatId !== chatId || pending.expiresAt < Date.now()) {
        pendingColorApprovals.delete(token);
        await answerCallback(cb.id, 'انتهت مهلة تأكيد الألوان');
        await editMessage(chatId, msgId, '⌛ انتهت مهلة تأكيد الألوان. أعد توليد المنتج.');
        return;
      }

      if (action === 'edit') {
        pendingColorApprovals.delete(token);
        userState[chatId] = { type: 'AWAITING_COLOR_VARIANTS', pending };
        await answerCallback(cb.id, 'اكتب الألوان الصحيحة');
        await editMessage(
          chatId,
          msgId,
          '✏️ اكتب الآن كل شكل لوني مفصولاً بفاصلة.\n\nالتركيبة ذات اللونين تُكتب كعنصر واحد.\nمثال: أبيض وأسود، أسود مع أزرق، أزرق',
        );
        return;
      }

      if (action === 'approve' || action === 'single') {
        pendingColorApprovals.delete(token);
        if (action === 'single' && pending.variantOnly) {
          await answerCallback(cb.id, 'تم إلغاء إضافة الألوان');
          await editMessage(
            chatId,
            msgId,
            '✖️ تم إلغاء إضافة الألوان. لم يتم تعديل المنتج الأساسي أو الألوان المنشورة سابقاً.',
          );
          return;
        }
        const colors = action === 'approve' ? pending.colors : [];
        await answerCallback(cb.id, action === 'approve' ? 'تم اعتماد الألوان' : 'سيُنشر كمنتج واحد');
        await editMessage(
          chatId,
          msgId,
          action === 'approve'
            ? `✅ تم اعتماد ${colors.length} أشكال لونية. بدأ توليد صور Jumia.`
            : '⏭️ تم إلغاء تقسيم الألوان. سيُعامل كمنتج واحد.',
        );
        enqueueAiPolish(() => continueAfterColorApproval(pending, colors));
        return;
      }

      await answerCallback(cb.id, 'اختيار غير صالح');
      return;
    }

    if (data.startsWith('dest:')) {
      const [, token, action] = data.split(':');
      const pending = pendingDestinations.get(token);
      if (!pending || pending.chatId !== chatId || pending.expiresAt < Date.now()) {
        pendingDestinations.delete(token);
        await answerCallback(cb.id, 'انتهت صلاحية الاختيار. أرسل المنتج مجدداً.');
        await editMessage(chatId, msgId, '⌛ انتهت صلاحية هذا الطلب. أرسل صور المنتج مجدداً.');
        return;
      }

      if (action === 'cancel') {
        pendingDestinations.delete(token);
        await answerCallback(cb.id, 'تم الإلغاء');
        await editMessage(chatId, msgId, '✖️ تم إلغاء إضافة المنتج.');
        return;
      }

      if (['noco', 'tifawt', 'jumia'].includes(action)) {
        pending.selected[action] = !pending.selected[action];
        await answerCallback(
          cb.id,
          `${pending.selected[action] ? 'تم اختيار' : 'تم إلغاء'} ${action === 'noco' ? 'NocoDB' : action === 'tifawt' ? 'Tifawt' : 'Jumia'}`,
        );
        try {
          await axios.post(`${TG_API}/editMessageText`, {
            chat_id: chatId,
            message_id: msgId,
            text: `📍 اختر وجهات النشر ثم اضغط تأكيد:\n\nالاختيار الحالي: ${destinationSummary(pending.selected)}`,
            reply_markup: destinationKeyboard(token, pending.selected),
          }, { timeout: 30000 });
        } catch (e) {
          console.warn('edit destination keyboard failed:', e.message);
        }
        return;
      }

      if (action !== 'go') {
        await answerCallback(cb.id, 'اختيار غير صالح');
        return;
      }

      const destinations = { ...pending.selected };
      if (!destinations.noco && !destinations.tifawt && !destinations.jumia) {
        await answerCallback(cb.id, 'اختر وجهة واحدة على الأقل');
        return;
      }
      pendingDestinations.delete(token);
      const summary = destinationSummary(destinations);
      await answerCallback(cb.id, 'تم تأكيد وجهات النشر');
      await editMessage(chatId, msgId, `✅ وجهات النشر: ${summary}`);

      // AI destinations classify photos; Tifawt-only keeps every original.
      if ((destinations.noco || destinations.jumia) && pending.files.length >= 2) {
        await requestImageRoles(
          pending.chatId,
          pending.files,
          pending.caption,
          destinations
        );
        return;
      }

      await sendMessage(chatId, 'بدأت معالجة المنتج...');
      enqueueProduct(() => processProduct(
        pending.chatId,
        pending.files,
        pending.caption,
        destinations,
        pending.files.map(() => 'both'),
      ));
      return;
    }

    if (data.startsWith('gal:')) {
      const parts = data.split(':');
      const token = parts[1];
      const action = parts[2];
      const pending = pendingGalleryApprovals.get(token);
      if (!pending || pending.chatId !== chatId || pending.expiresAt < Date.now()) {
        pendingGalleryApprovals.delete(token);
        await answerCallback(cb.id, 'انتهت صلاحية الاختيار. أعد التوليد.');
        await editMessage(chatId, msgId, '⌛ انتهت صلاحية اختيار الصور. أعد توليد المنتج.');
        return;
      }

      // Amazon rebuilds force an explicit AI yes/no before publishing.
      if (action === 'ai') {
        const choice = parts[3];
        if (!pending.enrichment.amazonAiChoiceRequired || !['g', 'n'].includes(choice)) {
          await answerCallback(cb.id, 'اختيار غير صالح');
          return;
        }
        if (choice === 'n') {
          pending.enrichment.amazonAiChoice = 'no';
          releaseAmazonSourceBuffers(pending);
          await answerCallback(cb.id, 'سيتم استخدام صور Amazon فقط');
          try {
            await editMessage(
              chatId,
              msgId,
              `🚫 لن يتم إنشاء صورة بالذكاء. اختر الصورة الأساسية ⭐ ثم انشر.\n\n${galleryApprovalSummary(pending.candidates)}`,
              galleryApprovalKeyboard(token, pending.candidates, pending.enrichment),
            );
          } catch (e) {
            await sendMessage(chatId, '🚫 تم اختيار صور Amazon فقط. اضغط اعتماد ونشر للمتابعة.');
          }
          return;
        }
        if (pending.enrichment.amazonAiChoice === 'generating') {
          await answerCallback(cb.id, 'التوليد جارٍ بالفعل');
          return;
        }
        pending.enrichment.amazonAiChoice = 'generating';
        await answerCallback(cb.id, 'بدأ إنشاء الصورة');
        try {
          await editMessage(
            chatId,
            msgId,
            `⏳ جاري إنشاء صورة أساسية من صور Amazon...\n\n${galleryApprovalSummary(pending.candidates)}`,
            galleryApprovalKeyboard(token, pending.candidates, pending.enrichment),
          );
        } catch (_) {
          // Keep going — generation still runs even if the keyboard refresh fails.
        }
        enqueueAiPolish(async () => {
          try {
            const generated = await generateOptionalAmazonHero({
              sourceBuffers: pending.enrichment.amazonSourceBuffers,
              title: pending.enrichment.copy?.french_title || pending.name,
              price: pending.price,
              oldPrice: pending.oldPrice,
              sellerSku: pending.sellerSku,
              uploadToNocoDB,
            });
            pending.candidates.forEach((candidate) => {
              if (candidate.kind !== 'jumia-color') candidate.isPrimary = false;
            });
            pending.candidates.unshift(generated);
            pending.enrichment.galleryCandidates = pending.candidates;
            pending.enrichment.amazonAiChoice = 'yes';
            await sendPhotoBuffer(
              chatId,
              generated.buffer,
              `⭐ صورة أساسية مولّدة بالذكاء\n#${pending.rowId} ${pending.sellerSku}`,
            );
            generated.buffer = null;
            releaseAmazonSourceBuffers(pending);
            await editMessage(
              chatId,
              msgId,
              `✅ تم إنشاء الصورة. يمكنك تغيير الصورة الأساسية ⭐ أو تعطيل أي صورة ثم النشر.\n\n${galleryApprovalSummary(pending.candidates)}`,
              galleryApprovalKeyboard(token, pending.candidates, pending.enrichment),
            );
          } catch (error) {
            pending.enrichment.amazonAiChoice = null;
            await sendMessage(chatId, `❌ فشل إنشاء الصورة بالذكاء: ${error.message}`);
            try {
              await editMessage(
                chatId,
                msgId,
                `⚠️ فشل التوليد. يمكنك إعادة المحاولة أو اختيار عدم التوليد.\n\n${galleryApprovalSummary(pending.candidates)}`,
                galleryApprovalKeyboard(token, pending.candidates, pending.enrichment),
              );
            } catch (_) {
              // Fallback message above already notified the user.
            }
          }
        });
        return;
      }

      if (action === 'cancel') {
        pendingGalleryApprovals.delete(token);
        await answerCallback(cb.id, 'تم الإبقاء على النص فقط');
        await editMessage(chatId, msgId, '✖️ لم تُنشر صور الواجهة — الوصف محفوظ.');
        await finalizeGalleryApproval(pending, { publishImages: false });
        return;
      }

      if (action === 'go') {
        if (
          pending.enrichment.amazonAiChoiceRequired
          && !['yes', 'no'].includes(pending.enrichment.amazonAiChoice)
        ) {
          await answerCallback(
            cb.id,
            pending.enrichment.amazonAiChoice === 'generating'
              ? 'انتظر اكتمال توليد الصورة'
              : 'اختر أولاً أحد الزرين: إنشاء صورة بالذكاء أو استخدام صور Amazon',
            { showAlert: true },
          );
          return;
        }
        const selected = pending.candidates.filter((c) => c.selected);
        if (!selected.length) {
          await answerCallback(cb.id, 'اختر صورة واحدة على الأقل', { showAlert: true });
          return;
        }
        pendingGalleryApprovals.delete(token);
        await answerCallback(cb.id, `نشر ${selected.length} صور`);
        try {
          await editMessage(
            chatId,
            msgId,
            `✅ جاري اعتماد ${selected.length} صورة والنشر في الوجهات التي اخترتها...\n${galleryApprovalSummary(pending.candidates)}`,
          );
        } catch (_) {
          // Publishing continues even if the status edit fails.
        }
        try {
          await finalizeGalleryApproval(pending, { publishImages: true });
        } catch (e) {
          console.error('finalizeGalleryApproval failed:', e.message);
          await sendMessage(chatId, `❌ فشل نشر الصور: ${e.message}`);
        }
        return;
      }

      const index = Number(action);
      if (!Number.isInteger(index) || index < 0 || index >= pending.candidates.length) {
        await answerCallback(cb.id, 'أمر غير صالح');
        return;
      }
      if (parts[3] === 'p') {
        const primary = pending.candidates[index];
        if (primary.kind === 'jumia-color') {
          await answerCallback(cb.id, 'صورة اللون مخصصة لـ Jumia');
          return;
        }
        pending.candidates.forEach((candidate) => {
          if (candidate.kind !== 'jumia-color') candidate.isPrimary = false;
        });
        primary.selected = true;
        primary.isPrimary = true;
        await answerCallback(cb.id, `الصورة ${index + 1} أصبحت الرئيسية`);
        try {
          await editMessage(
            chatId,
            msgId,
            `⭐ تم اختيار الصورة الأساسية.\n\n${galleryApprovalSummary(pending.candidates)}`,
            galleryApprovalKeyboard(token, pending.candidates, pending.enrichment),
          );
        } catch (e) {
          await sendMessage(chatId, `⭐ الصورة ${index + 1} أصبحت الرئيسية. أكمل الاختيار ثم انشر.`);
        }
        return;
      }
      if (parts[3] !== 't') {
        await answerCallback(cb.id, 'أمر غير صالح');
        return;
      }
      pending.candidates[index].selected = !pending.candidates[index].selected;
      const c = pending.candidates[index];
      if (!c.selected) c.isPrimary = false;
      if (c.selected && !pending.candidates.some((candidate) => candidate.selected && candidate.isPrimary)) {
        c.isPrimary = c.kind !== 'jumia-color';
      }
      await answerCallback(cb.id, `${c.selected ? 'تم التفعيل' : 'تم الإلغاء'}: ${c.label}`);
      try {
        await editMessage(
          chatId,
          msgId,
          `⬇️ فعّل/عطّل كل صورة ثم انشر:\n\n${galleryApprovalSummary(pending.candidates)}`,
          galleryApprovalKeyboard(token, pending.candidates, pending.enrichment),
        );
      } catch (e) {
        console.warn('editMessageText gal failed:', e.message);
      }
      return;
    }

    if (data.startsWith('imgrole:')) {
      const parts = data.split(':');
      const token = parts[1];
      const action = parts[2];
      const pending = pendingImageRoles.get(token);
      if (!pending || pending.chatId !== chatId || pending.expiresAt < Date.now()) {
        pendingImageRoles.delete(token);
        await answerCallback(cb.id, 'انتهت صلاحية التصنيف. أرسل المنتج مجدداً.');
        await editMessage(chatId, msgId, '⌛ انتهت صلاحية تصنيف الصور. أرسل المنتج مجدداً.');
        return;
      }

      if (action === 'cancel') {
        pendingImageRoles.delete(token);
        await answerCallback(cb.id, 'تم الإلغاء');
        await editMessage(chatId, msgId, '✖️ تم إلغاء إضافة المنتج.');
        return;
      }

      if (action === 'go') {
        const usable = pending.roles.filter((r) => r !== 'skip');
        if (!usable.length) {
          await answerCallback(cb.id, 'اختر صورة واحدة على الأقل');
          return;
        }
        if (!usable.some((r) => r === 'display' || r === 'both' || r === 'desc')) {
          await answerCallback(cb.id, 'اختر دوراً صالحاً لصورة واحدة على الأقل');
          return;
        }
        pendingImageRoles.delete(token);
        await answerCallback(cb.id, 'تم التصنيف');
        await editMessage(
          chatId,
          msgId,
          `✅ تصنيف الصور:\n${imageRolesSummary(pending.roles)}\n\nبدأت المعالجة...`
        );
        enqueueProduct(() => processProduct(
          pending.chatId,
          pending.files,
          pending.caption,
          pending.destination,
          pending.roles,
        ));
        return;
      }

      // imgrole:token:index:cycle
      const index = Number(action);
      if (!Number.isInteger(index) || index < 0 || index >= pending.roles.length || parts[3] !== 'cycle') {
        await answerCallback(cb.id, 'أمر غير صالح');
        return;
      }
      pending.roles[index] = cycleImageRole(pending.roles[index]);
      await answerCallback(cb.id, `صورة ${index + 1}: ${imageRoleLabel(pending.roles[index])}`);
      try {
        await axios.post(`${TG_API}/editMessageText`, {
          chat_id: chatId,
          message_id: msgId,
          text:
            `🖼️ صنّف صورك قبل الحفظ (${pending.files.length}):\n\n`
            + `• 🎨 للعرض فقط → قد تظهر في المعرض بعد التوليد الاحترافي\n`
            + `• 📖 للوصف فقط → يقرأها الذكاء (ضهر العلبة/كاتالوج) ولن تُنشر خام\n`
            + `• 🔄 عرض+وصف → الاثنان\n`
            + `• ✖️ تجاهل → تُحذف من المعالجة\n\n`
            + `اضغط على كل صورة لتغيير دورها، ثم ✅ متابعة:\n\n`
            + imageRolesSummary(pending.roles),
          reply_markup: imageRolesKeyboard(token, pending.roles),
        }, { timeout: 30000 });
      } catch (e) {
        console.warn('editMessageText imgrole failed:', e.message);
      }
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

// A lead-source call has no documented idempotency contract.  Coalesce every
// browser retry and NocoDB webhook replay in this service before it reaches
// Tifawt.  Successful keys live for 24h; failed calls are never cached so a
// webhook or the storefront can retry them safely.
const ORDER_SYNC_TTL_MS = 24 * 60 * 60 * 1000;
const syncedStoreOrders = new Map();
const inFlightStoreOrders = new Map();

function cleanupOrderSyncCache() {
  const cutoff = Date.now() - ORDER_SYNC_TTL_MS;
  for (const [key, value] of syncedStoreOrders) {
    if (value.completedAt < cutoff) syncedStoreOrders.delete(key);
  }
}

function normalizeOrderItems(items) {
  if (!Array.isArray(items) || !items.length) return [];
  const aliases = getBotSetting('tifawtSkuAliases') || '';
  return items.map((item) => ({
    sku: resolveTifawtOrderSku(
      item?.ref || item?.sku || item?.SKU || item?.id,
      aliases,
    ),
    quantity: Math.max(1, Number(item?.qty ?? item?.quantity ?? 1) || 1),
    unitPrice: Math.max(0, Number(item?.price ?? item?.unitPrice ?? 0) || 0),
  })).filter((item) => item.sku);
}

function readStoreOrderId(orderRow, items, fallback = '') {
  return String(
    fallback
    || orderRow?.['Store Order ID']
    || orderRow?.storeOrderId
    || items?.[0]?.storeOrderId
    || orderRow?.Id
    || orderRow?.id
    || ''
  ).trim();
}

function isTransientTifawtError(error) {
  const status = error?.response?.status;
  return !status || status === 408 || status === 429 || status >= 500;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function postOrderToTifawt({ orderId, name, phone, address, city, items }) {
  const tifawtProducts = normalizeOrderItems(items);
  if (!orderId || !name || !phone || !tifawtProducts.length) {
    const error = new Error('invalid_order_payload');
    error.statusCode = 400;
    throw error;
  }

  cleanupOrderSyncCache();
  if (syncedStoreOrders.has(orderId)) {
    return { ok: true, duplicate: true, orderId };
  }
  if (inFlightStoreOrders.has(orderId)) return inFlightStoreOrders.get(orderId);

  const task = (async () => {
    if (isBundledTifawtLeadConfigured()) {
      const result = await createBundledTifawtLead({
        orderId,
        name,
        phone,
        address,
        city,
        items,
      });
      syncedStoreOrders.set(orderId, { completedAt: Date.now() });
      console.log(
        `✅ Tifawt bundled lead ${orderId} leadId=${result.leadId} products=${result.productCount}${result.duplicate ? ' (duplicate)' : ''}`,
      );
      return result;
    }

    if (tifawtProducts.length > 1) {
      const error = new Error(
        'tifawt_multi_product_requires_api: set TIFAWT_EMAIL and TIFAWT_PASSWORD so the order stays one lead',
      );
      error.statusCode = 503;
      throw error;
    }

    const tifawtPayload = {
      customerName: String(name).trim(),
      customerPhone: String(phone).trim(),
      customerAddress: String(address || '').trim(),
      city: String(city || 'المغرب').trim(),
      products: tifawtProducts,
    };

    let lastError;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const result = await axios.post(TIFAWT_LEAD_URL, tifawtPayload, {
          headers: { 'Content-Type': 'application/json', 'X-Store-Order-Id': orderId },
          timeout: 30000,
        });
        syncedStoreOrders.set(orderId, { completedAt: Date.now() });
        console.log(`✅ Tifawt sync ${orderId} (${result.status})`);
        return { ok: true, orderId, status: result.status };
      } catch (error) {
        lastError = error;
        if (!isTransientTifawtError(error) || attempt === 3) break;
        await wait(500 * (2 ** (attempt - 1)));
      }
    }
    console.error(`❌ Tifawt sync failed ${orderId}:`, lastError?.response?.data || lastError?.message);
    throw lastError || new Error('tifawt_sync_failed');
  })();

  inFlightStoreOrders.set(orderId, task);
  try {
    return await task;
  } finally {
    inFlightStoreOrders.delete(orderId);
  }
}

/** Storefront-only endpoint. ERP credentials remain on this server. */
app.post('/api/orders/sync', async (req, res) => {
  try {
    const result = await postOrderToTifawt({
      orderId: req.get('X-Store-Order-Id') || req.body?.orderId,
      name: req.body?.name,
      phone: req.body?.phone,
      address: req.body?.address,
      city: req.body?.city,
      items: req.body?.items,
    });
    return res.status(200).json(result);
  } catch (error) {
    return res.status(error?.statusCode || 502).json({
      ok: false,
      error: error?.statusCode ? error.message : 'tifawt_sync_failed',
    });
  }
});

app.post('/webhook/order', async (req, res) => {
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

    const orderId = readStoreOrderId(orderRow, items);
    const result = await postOrderToTifawt({
      orderId,
      name: orderRow['Customer Name'],
      phone: orderRow['Customer Phone'],
      address: orderRow['Delivery Address'],
      city: orderRow['City'],
      items,
    });
    return res.status(200).json(result);
  } catch (err) {
    console.error('❌ Error syncing to Tifawt ERP:', err?.response?.data || err.message);
    // Do not acknowledge a failed ERP sync.  NocoDB can then retry its webhook
    // according to its configured retry policy instead of silently losing it.
    return res.status(502).json({ ok: false, error: 'tifawt_sync_failed' });
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

  await setupTelegramWebAppMenu();

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
