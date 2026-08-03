import axios from 'axios';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env'), quiet: true });
dotenv.config({ path: path.join(__dirname, '..', '.env'), quiet: true });

export const BOT_SETTINGS_SKU = 'ERY-BOT-SETTINGS';

function nocoConfig() {
  return {
    url: String(process.env.NOCODB_URL || process.env.VITE_NOCODB_URL || '').replace(/\/+$/, ''),
    token: process.env.NOCODB_API_TOKEN || process.env.VITE_NOCODB_API_TOKEN || '',
    table: process.env.NOCODB_TABLE_PRODUCTS || process.env.VITE_NOCODB_TABLE_PRODUCTS || '',
  };
}

const boolEnv = (name, fallback) => {
  const value = process.env[name];
  if (value == null || value === '') return fallback;
  return String(value).toLowerCase() !== 'false';
};

const numberEnv = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
};

const textEnv = (name, fallback = '') => String(process.env[name] || fallback);

export const BOT_SETTINGS_SCHEMA = {
  productAiEnrichment: {
    group: 'workflow', type: 'boolean', label: 'تحسين المنتجات بالذكاء الاصطناعي',
    description: 'إنشاء الوصف والصور الاحترافية بعد حفظ المنتج.',
    default: boolEnv('PRODUCT_AI_ENRICHMENT', true),
  },
  galleryApproval: {
    group: 'workflow', type: 'boolean', label: 'طلب الموافقة على الصور',
    description: 'عرض الصور في Telegram قبل نشرها في الموقع وJumia.',
    default: boolEnv('GALLERY_APPROVAL', true),
  },
  sheetSyncEnabled: {
    group: 'workflow', type: 'boolean', label: 'مزامنة Google Sheet',
    description: 'إضافة المنتجات المنشورة إلى قالب رفع Jumia.',
    default: true,
  },
  defaultDestinationNoco: {
    group: 'destinations', type: 'boolean', label: 'NocoDB محدد افتراضياً',
    description: 'تحديد الموقع تلقائياً عند فتح شاشة وجهات النشر.',
    default: false,
  },
  defaultDestinationTifawt: {
    group: 'destinations', type: 'boolean', label: 'Tifawt محدد افتراضياً',
    description: 'تحديد ERP تلقائياً عند فتح شاشة وجهات النشر.',
    default: false,
  },
  defaultDestinationJumia: {
    group: 'destinations', type: 'boolean', label: 'Jumia محدد افتراضياً',
    description: 'تحديد Jumia تلقائياً عند فتح شاشة وجهات النشر.',
    default: false,
  },
  openrouterTextModel: {
    group: 'ai', type: 'text', label: 'نموذج تحليل OpenRouter',
    description: 'النموذج الذي يقرأ الصور ويولد بيانات المنتج.',
    default: textEnv('OPENROUTER_TEXT_MODEL', 'google/gemini-2.5-flash'),
  },
  openrouterImageModel: {
    group: 'ai', type: 'text', label: 'نموذج صور OpenRouter',
    description: 'النموذج الأساسي لإنشاء صور الاستوديو والألوان.',
    default: textEnv('OPENROUTER_IMAGE_MODEL', 'google/gemini-2.5-flash-image'),
  },
  openaiTextModel: {
    group: 'ai', type: 'text', label: 'نموذج OpenAI للنصوص',
    description: 'النموذج الاحتياطي/الأساسي لإنشاء المحتوى ثنائي اللغة.',
    default: textEnv('OPENAI_TEXT_MODEL', 'gpt-4o-mini'),
  },
  qwenImageModel: {
    group: 'ai', type: 'text', label: 'نموذج Qwen للصور',
    description: 'النموذج الثانوي الاختياري المعروض في معرض الموافقة.',
    default: textEnv('QWEN_IMAGE_MODEL', 'qwen-image-2.0'),
  },
  aiBackgroundTimeoutMs: {
    group: 'ai', type: 'number', label: 'مهلة المعالجة الخلفية',
    description: 'مهلة تحسين المنتج في قائمة الانتظار.',
    default: numberEnv('AI_ENRICH_BG_TIMEOUT_MS', 360000), min: 30000, max: 1200000, step: 10000,
  },
  amazonTimeoutMs: {
    group: 'ai', type: 'number', label: 'مهلة إعادة البناء من Amazon',
    description: 'الحد الأقصى للكشط والتوليد من Amazon.',
    default: numberEnv('AI_ENRICH_TIMEOUT_MS_AMAZON', 360000), min: 30000, max: 1200000, step: 10000,
  },
  localBackgroundRemoval: {
    group: 'images', type: 'boolean', label: 'إزالة الخلفية محلياً',
    description: 'تشغيل U²-Net محلياً لإنشاء صورة حقيقية بخلفية شفافة.',
    default: boolEnv('LOCAL_BACKGROUND_REMOVAL', true),
  },
  localBackgroundTimeoutMs: {
    group: 'images', type: 'number', label: 'مهلة إزالة الخلفية',
    description: 'إيقاف المعالجة المحلية إذا تجاوزت هذه المدة.',
    default: numberEnv('LOCAL_BACKGROUND_TIMEOUT_MS', 60000), min: 10000, max: 300000, step: 5000,
  },
  catalogImageSize: {
    group: 'images', type: 'number', label: 'حجم الصورة النهائية',
    description: 'عرض وارتفاع صور الكتالوج المربعة بالبكسل.',
    default: numberEnv('CATALOG_IMAGE_SIZE', 1080), min: 640, max: 2048, step: 40,
    restartRequired: true,
  },
  visionMaxEdge: {
    group: 'images', type: 'number', label: 'أقصى حجم لصورة التحليل',
    description: 'تقليل الصور قبل إرسالها إلى نموذج الرؤية.',
    default: numberEnv('AI_VISION_MAX_EDGE', 1280), min: 640, max: 2048, step: 40,
  },
  visionJpegQuality: {
    group: 'images', type: 'number', label: 'جودة JPEG للتحليل',
    description: 'موازنة دقة الصورة مع سرعة وحجم الإرسال.',
    default: numberEnv('AI_VISION_JPEG_QUALITY', 82), min: 50, max: 100, step: 1,
  },
  studioProductFill: {
    group: 'images', type: 'number', label: 'نسبة ملء المنتج للإطار',
    description: 'حجم المنتج داخل صورة الاستوديو من 0.60 إلى 0.98.',
    default: numberEnv('STUDIO_PRODUCT_FILL', 0.91), min: 0.6, max: 0.98, step: 0.01,
  },
  maxTelegramImageMb: {
    group: 'images', type: 'number', label: 'أقصى حجم لصورة Telegram',
    description: 'رفض الملفات الأكبر لحماية ذاكرة الخادم.',
    default: Math.round(numberEnv('MAX_TELEGRAM_IMAGE_BYTES', 12 * 1024 * 1024) / 1024 / 1024),
    min: 2, max: 40, step: 1,
    restartRequired: true,
  },
  tifawtSkuAliases: {
    group: 'tifawt', type: 'textarea', label: 'مطابقة مراجع الموقع → تيفاوت',
    description: 'سطر لكل منتج: مرجع_الموقع=مرجع_تيفاوت_الحالي. لا تغيّر SKU المخزون في تيفاوت؛ فقط اربط مرجع المتجر به. مثال:\nMP3 car M53=CODE-IN-TIFAWT\nStarry Sky=CHARGEUR-4IN1',
    default: textEnv('TIFAWT_SKU_ALIASES', ''),
  },
  jumiaDefaultBrand: {
    group: 'jumia', type: 'text', label: 'علامة Jumia الافتراضية',
    description: 'معرف واسم العلامة عندما لا تتوفر علامة للمنتج.',
    default: textEnv('JUMIA_DEFAULT_BRAND', '1045133 - Generic'),
  },
  jumiaDefaultCategory: {
    group: 'jumia', type: 'text', label: 'تصنيف Jumia الافتراضي',
    description: 'معرف التصنيف الأساسي للمنتجات الجديدة.',
    default: textEnv('JUMIA_DEFAULT_CATEGORY', '1000040'),
  },
  jumiaDefaultColor: {
    group: 'jumia', type: 'text', label: 'اللون الافتراضي',
    description: 'القيمة المستخدمة عندما لا يحدد الذكاء لوناً.',
    default: textEnv('JUMIA_DEFAULT_COLOR', 'Multicolore'),
  },
  jumiaDefaultColorFamily: {
    group: 'jumia', type: 'text', label: 'عائلة اللون الافتراضية',
    description: 'عائلة ألوان Jumia للمنتج العادي.',
    default: textEnv('JUMIA_DEFAULT_COLOR_FAMILY', 'Multicolore'),
  },
  jumiaDefaultVariation: {
    group: 'jumia', type: 'text', label: 'التنويع الافتراضي',
    description: 'قيمة Variation عند عدم وجود ألوان مستقلة.',
    default: textEnv('JUMIA_DEFAULT_VARIATION', '...'),
  },
  jumiaDefaultWeight: {
    group: 'jumia', type: 'number', label: 'الوزن الافتراضي',
    description: 'وزن المنتج الافتراضي المستخدم في ملف Jumia.',
    default: numberEnv('JUMIA_DEFAULT_WEIGHT', 1), min: 0.01, max: 100, step: 0.01,
  },
  jumiaDefaultStock: {
    group: 'jumia', type: 'number', label: 'مخزون Jumia الافتراضي',
    description: 'الكمية المرسلة عند جعل المنتج متوفراً.',
    default: numberEnv('JUMIA_DEFAULT_STOCK', 100), min: 0, max: 10000, step: 1,
  },
};

let cache = null;
let settingsRowId = null;
let sharedConnections = null;
let syncTimer = null;
let needsEncryptionMigration = false;
let lastRefreshSucceeded = true;

function defaults() {
  return Object.fromEntries(
    Object.entries(BOT_SETTINGS_SCHEMA).map(([key, definition]) => [key, definition.default]),
  );
}

function sanitizeValue(key, value) {
  const definition = BOT_SETTINGS_SCHEMA[key];
  if (!definition) return undefined;
  if (definition.type === 'boolean') return Boolean(value);
  if (definition.type === 'number') {
    const number = Number(value);
    if (!Number.isFinite(number)) return definition.default;
    return Math.min(definition.max ?? number, Math.max(definition.min ?? number, number));
  }
  if (definition.type === 'textarea') {
    return String(value ?? '').replace(/\r\n/g, '\n').trim().slice(0, 12000);
  }
  return String(value ?? '').trim().slice(0, 180);
}

export function sanitizeBotSettingsPatch(patch = {}, base = defaults()) {
  const next = { ...base };
  for (const [key, value] of Object.entries(patch || {})) {
    if (!BOT_SETTINGS_SCHEMA[key]) continue;
    next[key] = sanitizeValue(key, value);
  }
  return next;
}

export function getBotSettings() {
  if (!cache) cache = defaults();
  return { ...cache };
}

export function getBotSetting(key) {
  return getBotSettings()[key];
}

function applyStoredSettings(stored = {}) {
  const next = defaults();
  for (const key of Object.keys(BOT_SETTINGS_SCHEMA)) {
    if (Object.hasOwn(stored, key)) next[key] = sanitizeValue(key, stored[key]);
  }
  cache = next;
  return getBotSettings();
}

function settingsEncryptionKey() {
  const secret = (
    process.env.BOT_SETTINGS_ENCRYPTION_KEY
    || process.env.ADMIN_PASSWORD
    || process.env.VITE_ADMIN_PASSWORD
    || (process.env.NODE_ENV === 'production' ? '' : 'imden2026')
  );
  if (!secret) throw new Error('bot_settings_encryption_key_missing');
  return crypto.createHash('sha256').update(String(secret)).digest();
}

function encryptSettingsDocument(document) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', settingsEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(document), 'utf8'),
    cipher.final(),
  ]);
  return [
    'enc',
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':');
}

function decryptSettingsDocument(raw) {
  const [, version, ivRaw, tagRaw, encryptedRaw] = String(raw).split(':');
  if (version !== 'v1' || !ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error('unsupported_settings_ciphertext');
  }
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    settingsEncryptionKey(),
    Buffer.from(ivRaw, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return JSON.parse(Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, 'base64url')),
    decipher.final(),
  ]).toString('utf8'));
}

function parseSettingsDocument(raw) {
  if (!raw) return {};
  const encrypted = typeof raw === 'string' && raw.startsWith('enc:v1:');
  try {
    const parsed = encrypted
      ? decryptSettingsDocument(raw)
      : (typeof raw === 'string' ? JSON.parse(raw) : raw);
    if (!encrypted) {
      if (String(process.env.BOT_SETTINGS_ALLOW_PLAINTEXT_MIGRATION || '').toLowerCase() !== 'true') {
        throw new Error('unsigned_settings_document_rejected');
      }
      needsEncryptionMigration = true;
    }
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.warn('[settings] invalid shared settings document:', error.message);
    if (encrypted || error.message === 'unsigned_settings_document_rejected') throw error;
    return {};
  }
}

async function findSettingsRow() {
  const { url, token, table } = nocoConfig();
  if (!url || !token || !table) return null;
  const { data } = await axios.get(`${url}/api/v2/tables/${table}/records`, {
    headers: { 'xc-token': token },
    params: { where: `(SKU,eq,${BOT_SETTINGS_SKU})`, limit: 1 },
    timeout: 30000,
  });
  const row = data?.list?.[0] || null;
  settingsRowId = row?.Id || row?.id || null;
  return row;
}

export async function refreshBotSettings({ strict = false } = {}) {
  try {
    const row = await findSettingsRow();
    if (!row) {
      lastRefreshSucceeded = true;
      return getBotSettings();
    }
    const document = parseSettingsDocument(
      row.description_french || row.Description_French || row.Description || '',
    );
    if (document.connections && typeof document.connections === 'object') {
      sharedConnections = document.connections;
    }
    lastRefreshSucceeded = true;
    return applyStoredSettings(document.settings || document);
  } catch (error) {
    lastRefreshSucceeded = false;
    console.warn('[settings] shared refresh failed:', error.message);
    if (strict) throw error;
    return getBotSettings();
  }
}

async function persistDocument(settings, connections = sharedConnections) {
  const { url, token, table } = nocoConfig();
  if (!url || !token || !table) throw new Error('nocodb_not_configured');
  if (!settingsRowId) await findSettingsRow();
  const document = encryptSettingsDocument({
    settings,
    connections: connections || {},
    updatedAt: new Date().toISOString(),
  });
  const payload = {
    SKU: BOT_SETTINGS_SKU,
    Title: 'Bot Runtime Settings',
    POSTEBL: 'NO POSTEBL',
    price: 0,
    description_french: document,
  };
  if (settingsRowId) {
    await axios.patch(
      `${url}/api/v2/tables/${table}/records`,
      { Id: Number(settingsRowId), ...payload },
      { headers: { 'xc-token': token, 'Content-Type': 'application/json' }, timeout: 30000 },
    );
  } else {
    const { data } = await axios.post(
      `${url}/api/v2/tables/${table}/records`,
      payload,
      { headers: { 'xc-token': token, 'Content-Type': 'application/json' }, timeout: 30000 },
    );
    settingsRowId = data?.Id || data?.id || null;
  }
  needsEncryptionMigration = false;
}

export async function updateBotSettings(patch = {}) {
  await refreshBotSettings({ strict: true });
  const current = sanitizeBotSettingsPatch(patch, getBotSettings());
  await persistDocument(current);
  cache = current;
  return getBotSettings();
}

export async function resetBotSettings() {
  cache = defaults();
  await persistDocument(cache);
  return getBotSettings();
}

export function startBotSettingsSync({ publishConnections = false, intervalMs = 30000 } = {}) {
  if (syncTimer) return;
  const sync = async () => {
    await refreshBotSettings();
    if (!lastRefreshSucceeded) return;
    if (publishConnections) {
      const nextConnections = getBotConnectionStatus();
      const changed = JSON.stringify(nextConnections) !== JSON.stringify(sharedConnections);
      sharedConnections = nextConnections;
      if (!changed && settingsRowId && !needsEncryptionMigration) return;
      try {
        await persistDocument(getBotSettings(), sharedConnections);
      } catch (error) {
        console.warn(
          '[settings] connection heartbeat failed:',
          error?.response?.data || error.message,
        );
      }
    }
  };
  sync().catch((error) => console.warn('[settings] initial sync failed:', error.message));
  syncTimer = setInterval(sync, Math.max(5000, Number(intervalMs) || 30000));
  syncTimer.unref?.();
}

export function getBotConnectionStatus() {
  return {
    telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN || process.env.VITE_TELEGRAM_BOT_TOKEN),
    nocodb: Boolean(
      (process.env.NOCODB_URL || process.env.VITE_NOCODB_URL)
      && (process.env.NOCODB_API_TOKEN || process.env.VITE_NOCODB_API_TOKEN)
      && (process.env.NOCODB_TABLE_PRODUCTS || process.env.VITE_NOCODB_TABLE_PRODUCTS)
    ),
    productVariants: Boolean(
      process.env.NOCODB_TABLE_PRODUCT_VARIANTS
      || process.env.VITE_NOCODB_TABLE_PRODUCT_VARIANTS
    ),
    openrouter: Boolean(process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY),
    qwen: Boolean(process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY),
    apify: Boolean(process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN),
    tifawt: Boolean(
      process.env.TIFAWT_ACCESS_TOKEN
      || (process.env.TIFAWT_EMAIL && process.env.TIFAWT_PASSWORD)
    ),
    jumia: Boolean(
      (process.env.JUMIA_CLIENT_ID || process.env.JUMIA_USER_ID)
      && (process.env.JUMIA_REFRESH_TOKEN || process.env.JUMIA_API_KEY)
    ),
    sheet: Boolean(process.env.PRODUCT_SHEET_WEBHOOK_URL),
  };
}

export function publicBotSettingsPayload() {
  return {
    settings: getBotSettings(),
    schema: BOT_SETTINGS_SCHEMA,
    connections: sharedConnections || getBotConnectionStatus(),
    storage: {
      persistentPathConfigured: Boolean(nocoConfig().table),
      fileName: 'NocoDB shared settings',
    },
  };
}
