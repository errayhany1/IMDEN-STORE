/**
 * Hourly NocoDB → Telegram catalog poster (replaces the n8n workflow).
 * Posts the least-recently-shared POSTEBL product to configured channels.
 */
import axios from 'axios';
import { getBotSetting, updateBotSettings } from './runtimeSettings.js';

const DATE_FIELD = 'last postin date';
const LOG_LIMIT = 30;
const TICK_MS = 30_000;

const DEFAULT_PROMO = [
  '📦 **البيع بالجملة فقط**',
  '💰 السعر قد ينخفض عند طلب كمية كبيرة.',
  '',
  '🛒 **للطلب من الموقع:**',
  'https://errayhany.com',
  '',
  '📞 **للاستفسار عن أسعار الجملة:**',
  'https://wa.me/212664630566',
].join('\n');

const logs = [];
const state = {
  lastRunAt: 0,
  lastResult: null,
  inFlight: false,
  timer: null,
};

function nocoConfig() {
  return {
    url: (process.env.VITE_NOCODB_URL || process.env.NOCODB_URL || '').replace(/\/+$/, ''),
    token: process.env.VITE_NOCODB_API_TOKEN || process.env.NOCODB_API_TOKEN || '',
    table: process.env.VITE_NOCODB_TABLE_PRODUCTS || process.env.NOCODB_TABLE_PRODUCTS || '',
  };
}

function storeSite() {
  return (
    getBotSetting('tgCatalogSiteUrl')
    || process.env.SITE_URL
    || process.env.VITE_SITE_URL
    || process.env.PUBLIC_SITE_URL
    || 'https://errayhany.com'
  ).replace(/\/+$/, '');
}

function hourInCasablanca(date = new Date()) {
  const hour = new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric',
    hour12: false,
    timeZone: 'Africa/Casablanca',
  }).format(date);
  return Number(hour) % 24;
}

function casablancaDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Casablanca',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function formatCatalogCaption(record) {
  const rawPrice = record?.price ?? record?.Price ?? 0;
  const cleanPrice = Number(String(rawPrice).replace(/[^0-9.\-]+/g, '')) || 0;
  const fmtPrice = Number.isInteger(cleanPrice)
    ? `${cleanPrice}`
    : `${Math.round(cleanPrice * 100) / 100}`;
  const sku = String(record?.SKU || 'غير محدد').trim() || 'غير محدد';
  return `💰 الثمن: ${fmtPrice} درهم\n📋 المرجع: ${sku}`;
}

export function isHourInWindow(hour, start, end) {
  const h = Number(hour);
  const from = Number(start);
  const to = Number(end);
  if (from <= to) return h >= from && h <= to;
  return h >= from || h <= to;
}

export function isCatalogWindow(now = new Date()) {
  return isHourInWindow(
    hourInCasablanca(now),
    getBotSetting('tgCatalogStartHour'),
    getBotSetting('tgCatalogEndHour'),
  );
}

function pushLog(entry) {
  logs.unshift({ at: new Date().toISOString(), ...entry });
  logs.length = Math.min(logs.length, LOG_LIMIT);
}

function attachmentUrl(field) {
  const img = Array.isArray(field) ? field[0] : field;
  if (!img) return '';
  const raw = img.signedUrl || img.url || img.path || '';
  if (!raw) return '';
  return raw.startsWith('http') ? raw : `${nocoConfig().url}/${String(raw).replace(/^\//, '')}`;
}

function imageUrls(record) {
  const sku = encodeURIComponent(String(record?.SKU || '').trim());
  const site = storeSite();
  const urls = [];
  for (let i = 1; i <= 3; i += 1) {
    const fromNoco = attachmentUrl(record?.[`Image${i}`]);
    if (fromNoco) urls.push(fromNoco);
    else if (i === 1 && sku) urls.push(`${site}/bot-api/public-images/p/${sku}/1.jpg`);
  }
  return [...new Set(urls.filter(Boolean))];
}

function botToken(kind) {
  if (kind === 'ecom') {
    return (
      process.env.TELEGRAM_CATALOG_ECOM_BOT_TOKEN
      || process.env.TELEGRAM_CATALOG_IMDEN_BOT_TOKEN
      || process.env.TELEGRAM_BOT_TOKEN
      || process.env.VITE_TELEGRAM_BOT_TOKEN
      || process.env.TELEGRAM_NOTIFY_BOT_TOKEN
      || ''
    ).trim();
  }
  return (
    process.env.TELEGRAM_CATALOG_IMDEN_BOT_TOKEN
    || process.env.TELEGRAM_BOT_TOKEN
    || process.env.VITE_TELEGRAM_BOT_TOKEN
    || process.env.TELEGRAM_NOTIFY_BOT_TOKEN
    || ''
  ).trim();
}

function channels() {
  const list = [];
  if (getBotSetting('tgCatalogImdenEnabled')) {
    list.push({
      id: 'imden',
      name: 'IMDEN TECNOLOGY',
      chatId: String(getBotSetting('tgCatalogImdenChatId') || '').trim(),
      token: botToken('imden'),
      promoEvery: Number(getBotSetting('tgCatalogImdenPromoEvery')) || 12,
    });
  }
  if (getBotSetting('tgCatalogEcomEnabled')) {
    list.push({
      id: 'ecom',
      name: 'ECOM BJMLA',
      chatId: String(getBotSetting('tgCatalogEcomChatId') || '').trim(),
      token: botToken('ecom'),
      promoEvery: Number(getBotSetting('tgCatalogEcomPromoEvery')) || 8,
    });
  }
  return list;
}

function promoText() {
  const custom = String(getBotSetting('tgCatalogPromoText') || '').trim();
  if (custom) return custom;
  const wa = String(getBotSetting('tgCatalogWhatsapp') || '212664630566').replace(/\D/g, '');
  const site = storeSite();
  return DEFAULT_PROMO
    .replace('https://errayhany.com', site)
    .replace('212664630566', wa || '212664630566');
}

async function tgCall(token, method, body) {
  const { data, status } = await axios.post(
    `https://api.telegram.org/bot${token}/${method}`,
    body,
    { timeout: 45000, validateStatus: () => true },
  );
  if (status >= 400 || data?.ok === false) {
    const error = new Error(data?.description || `telegram_${method}_${status}`);
    error.statusCode = status;
    throw error;
  }
  return data;
}

async function fetchNextProduct() {
  const { url, token, table } = nocoConfig();
  if (!url || !token || !table) {
    const error = new Error('nocodb_not_configured');
    error.statusCode = 503;
    throw error;
  }
  const { data, status } = await axios.get(`${url}/api/v2/tables/${table}/records`, {
    headers: { 'xc-token': token, accept: 'application/json' },
    params: {
      limit: 20,
      where: '(POSTEBL,eq,POSTEBL)',
      sort: DATE_FIELD,
      fields: `Id,SKU,price,POSTEBL,Image1,Image2,Image3,${DATE_FIELD}`,
    },
    timeout: 30000,
    validateStatus: () => true,
  });
  if (status >= 400) {
    const error = new Error(data?.msg || data?.message || `nocodb_http_${status}`);
    error.statusCode = status;
    throw error;
  }
  const list = data?.list || [];
  return list.find((row) => attachmentUrl(row.Image1) || String(row.SKU || '').trim()) || null;
}

async function markPosted(record) {
  const { url, token, table } = nocoConfig();
  const { data, status } = await axios.patch(
    `${url}/api/v2/tables/${table}/records`,
    { Id: record.Id, [DATE_FIELD]: casablancaDate() },
    {
      headers: { 'xc-token': token, 'Content-Type': 'application/json' },
      timeout: 20000,
      validateStatus: () => true,
    },
  );
  if (status >= 400) {
    throw new Error(data?.msg || data?.message || `nocodb_patch_${status}`);
  }
}

async function sendToChannel(channel, record, caption) {
  if (!channel.chatId || !channel.token) {
    return { ok: false, skipped: true, hint: 'ناقص توكن أو معرف القناة' };
  }
  const photos = imageUrls(record);
  if (!photos.length) {
    return { ok: false, skipped: true, hint: 'لا توجد صورة' };
  }

  if (photos.length === 1) {
    await tgCall(channel.token, 'sendPhoto', {
      chat_id: channel.chatId,
      photo: photos[0],
      caption,
    });
  } else {
    await tgCall(channel.token, 'sendMediaGroup', {
      chat_id: channel.chatId,
      media: photos.map((photo, index) => ({
        type: 'photo',
        media: photo,
        ...(index === 0 ? { caption } : {}),
      })),
    });
  }

  const id = Number(record.Id);
  if (Number.isFinite(id) && channel.promoEvery > 0 && id % channel.promoEvery === 0) {
    await tgCall(channel.token, 'sendMessage', {
      chat_id: channel.chatId,
      text: promoText(),
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    });
  }

  return { ok: true, images: photos.length };
}

function lastRunMs() {
  if (state.lastRunAt) return state.lastRunAt;
  const stored = Date.parse(String(getBotSetting('tgCatalogLastRunAt') || ''));
  if (Number.isFinite(stored) && stored > 0) {
    state.lastRunAt = stored;
    return stored;
  }
  return 0;
}

function intervalMs() {
  return Math.max(1, Number(getBotSetting('tgCatalogIntervalHours')) || 1) * 60 * 60 * 1000;
}

async function rememberRun(now = Date.now(), sku = '') {
  state.lastRunAt = now;
  try {
    await updateBotSettings({
      tgCatalogLastRunAt: new Date(now).toISOString(),
      tgCatalogLastSku: String(sku || '').trim(),
    });
  } catch (error) {
    console.warn('[tg-catalog] lastRun persist failed:', error.message);
  }
}

export function telegramCatalogStatus() {
  const enabled = Boolean(getBotSetting('tgCatalogEnabled'));
  const hours = Number(getBotSetting('tgCatalogIntervalHours')) || 1;
  const inWindow = isCatalogWindow();
  const channelStatus = channels().map((ch) => ({
    id: ch.id,
    name: ch.name,
    chatId: ch.chatId,
    tokenReady: Boolean(ch.token),
    promoEvery: ch.promoEvery,
  }));
  const ranAt = lastRunMs();
  const nextAt = ranAt ? new Date(ranAt + intervalMs()).toISOString() : null;
  return {
    enabled,
    inWindow,
    inFlight: state.inFlight,
    hour: hourInCasablanca(),
    timezone: 'Africa/Casablanca',
    intervalHours: hours,
    startHour: Number(getBotSetting('tgCatalogStartHour')),
    endHour: Number(getBotSetting('tgCatalogEndHour')),
    imdenEnabled: Boolean(getBotSetting('tgCatalogImdenEnabled')),
    ecomEnabled: Boolean(getBotSetting('tgCatalogEcomEnabled')),
    lastRunAt: ranAt ? new Date(ranAt).toISOString() : null,
    lastSku: getBotSetting('tgCatalogLastSku') || state.lastResult?.sku || '',
    nextAt,
    lastResult: state.lastResult,
    channels: channelStatus,
    logs,
    settings: {
      tgCatalogWhatsapp: getBotSetting('tgCatalogWhatsapp'),
      tgCatalogSiteUrl: getBotSetting('tgCatalogSiteUrl'),
      tgCatalogPromoText: getBotSetting('tgCatalogPromoText'),
      tgCatalogImdenChatId: getBotSetting('tgCatalogImdenChatId'),
      tgCatalogEcomChatId: getBotSetting('tgCatalogEcomChatId'),
    },
  };
}

export async function runTelegramCatalogPost({ force = false } = {}) {
  if (state.inFlight) {
    return { ok: false, error: 'already_running' };
  }
  if (!force && !getBotSetting('tgCatalogEnabled')) {
    return { ok: false, error: 'disabled' };
  }
  if (!force && !isCatalogWindow()) {
    return { ok: false, error: 'outside_window', hour: hourInCasablanca() };
  }

  state.inFlight = true;
  try {
    const record = await fetchNextProduct();
    if (!record) {
      const result = { ok: false, error: 'no_product' };
      state.lastResult = result;
      pushLog({ ok: false, error: 'no_product' });
      return result;
    }

    const caption = formatCatalogCaption(record);
    const results = [];
    for (const channel of channels()) {
      try {
        // eslint-disable-next-line no-await-in-loop
        results.push({ channel: channel.id, ...(await sendToChannel(channel, record, caption)) });
      } catch (error) {
        results.push({
          channel: channel.id,
          ok: false,
          error: error?.message || 'send_failed',
        });
      }
    }

    const posted = results.some((row) => row.ok);
    if (posted) {
      await markPosted(record).catch((error) => {
        console.warn('[tg-catalog] date update failed:', error.message);
      });
      await rememberRun(Date.now(), record.SKU);
    }

    const result = {
      ok: posted,
      sku: record.SKU,
      nocoId: record.Id,
      caption,
      channels: results,
    };
    state.lastResult = result;
    pushLog(result);
    return result;
  } catch (error) {
    const result = { ok: false, error: error.message || 'catalog_post_failed' };
    state.lastResult = result;
    pushLog(result);
    return result;
  } finally {
    state.inFlight = false;
  }
}

async function tick() {
  if (!getBotSetting('tgCatalogEnabled')) return;
  if (!isCatalogWindow()) return;
  if (state.inFlight) return;
  const ranAt = lastRunMs();
  if (ranAt && Date.now() - ranAt < intervalMs()) return;
  await runTelegramCatalogPost();
}

export function kickTelegramCatalogScheduler() {
  tick().catch((error) => {
    console.error('[tg-catalog] tick failed:', error?.message || error);
  });
}

export function startTelegramCatalogScheduler() {
  if (state.timer) return;
  lastRunMs();
  state.timer = setInterval(kickTelegramCatalogScheduler, TICK_MS);
  state.timer.unref?.();
  setTimeout(kickTelegramCatalogScheduler, 5000).unref?.();
  console.log('[tg-catalog] scheduler started');
}

export function registerTelegramCatalogRoutes(app, { requireAdmin }) {
  app.get('/api/admin/telegram-catalog/status', (req, res) => {
    if (!requireAdmin(req, res)) return;
    return res.json({ ok: true, ...telegramCatalogStatus() });
  });

  app.patch('/api/admin/telegram-catalog/settings', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const raw = req.body?.settings || req.body || {};
      const patch = { ...raw };
      delete patch.tgCatalogLastRunAt;
      delete patch.tgCatalogLastSku;
      await updateBotSettings(patch);
      if (getBotSetting('tgCatalogEnabled')) kickTelegramCatalogScheduler();
      return res.json({ ok: true, ...telegramCatalogStatus() });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error.message || 'settings_update_failed' });
    }
  });

  app.post('/api/admin/telegram-catalog/run', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const result = await runTelegramCatalogPost({ force: true });
    const status = result.ok ? 200 : (result.error === 'already_running' ? 409 : 502);
    return res.status(status).json({ ...result, ...telegramCatalogStatus() });
  });
}
