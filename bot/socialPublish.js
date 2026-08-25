/**
 * Multi-platform social publish for the admin dashboard.
 * Meta publishes when page tokens are set; TikTok / YouTube when OAuth envs exist.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import express from 'express';
import axios from 'axios';
import multer from 'multer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const MEDIA_DIR = path.join(DATA_DIR, 'social-media');
const POSTS_FILE = path.join(DATA_DIR, 'social-posts.json');
const MAX_POSTS = 80;

const SITE_URL = (
  process.env.PUBLIC_SITE_URL
  || process.env.VITE_SITE_URL
  || process.env.SITE_URL
  || 'https://errayhany.com'
).replace(/\/+$/, '');

const PLATFORMS = ['meta', 'tiktok', 'youtube'];

function ensureDirs() {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
  if (!fs.existsSync(POSTS_FILE)) fs.writeFileSync(POSTS_FILE, '[]', 'utf8');
}

function readPosts() {
  ensureDirs();
  try {
    const raw = JSON.parse(fs.readFileSync(POSTS_FILE, 'utf8'));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writePosts(posts) {
  ensureDirs();
  fs.writeFileSync(POSTS_FILE, JSON.stringify(posts.slice(0, MAX_POSTS), null, 2), 'utf8');
}

function newId() {
  return `sp_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
}

function publicMediaUrl(filename) {
  return `${SITE_URL}/bot-api/social-media/${encodeURIComponent(filename)}`;
}

function isVideoMime(mime = '') {
  return String(mime).startsWith('video/');
}

function isImageMime(mime = '') {
  return String(mime).startsWith('image/');
}

export function socialPlatformStatus() {
  const metaReady = Boolean(
    process.env.META_PAGE_ID?.trim() && process.env.META_PAGE_ACCESS_TOKEN?.trim(),
  );
  const igConfigured = Boolean(process.env.META_IG_USER_ID?.trim());
  const tiktokReady = Boolean(
    process.env.TIKTOK_OPEN_ID?.trim()
    && (
      process.env.TIKTOK_ACCESS_TOKEN?.trim()
      || (
        process.env.TIKTOK_REFRESH_TOKEN?.trim()
        && process.env.TIKTOK_CLIENT_KEY?.trim()
        && process.env.TIKTOK_CLIENT_SECRET?.trim()
      )
    ),
  );
  const youtubeReady = Boolean(
    process.env.YOUTUBE_REFRESH_TOKEN?.trim()
    && process.env.YOUTUBE_CLIENT_ID?.trim()
    && process.env.YOUTUBE_CLIENT_SECRET?.trim(),
  );

  return {
    meta: {
      id: 'meta',
      label: 'Meta (Facebook + Instagram)',
      ready: metaReady,
      instagramConfigured: igConfigured,
      hint: metaReady
        ? (igConfigured
          ? 'جاهز لفيسبوك + إنستغرام (صورة/فيديو)'
          : 'فيسبوك جاهز — أضف META_IG_USER_ID وصلاحيات Instagram للنشر على إنستغرام')
        : 'أضف META_PAGE_ID و META_PAGE_ACCESS_TOKEN على سيرفر البوت',
    },
    tiktok: {
      id: 'tiktok',
      label: 'TikTok',
      ready: tiktokReady,
      hint: tiktokReady
        ? 'توكن TikTok موجود'
        : 'يتطلب TIKTOK_OPEN_ID + (ACCESS_TOKEN أو REFRESH_TOKEN مع CLIENT_KEY/SECRET)',
    },
    youtube: {
      id: 'youtube',
      label: 'YouTube',
      ready: youtubeReady,
      hint: youtubeReady
        ? 'OAuth YouTube جاهز'
        : 'يتطلب YOUTUBE_CLIENT_ID و YOUTUBE_CLIENT_SECRET و YOUTUBE_REFRESH_TOKEN',
    },
    defaultLink: `${SITE_URL}/vip`,
  };
}

let tiktokAccessCache = { token: '', expiresAt: 0 };

async function resolveTikTokAccessToken() {
  const cached = tiktokAccessCache.token
    && Date.now() < tiktokAccessCache.expiresAt - 60_000;
  if (cached) return tiktokAccessCache.token;

  const refresh = process.env.TIKTOK_REFRESH_TOKEN?.trim();
  const clientKey = process.env.TIKTOK_CLIENT_KEY?.trim();
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET?.trim();
  if (refresh && clientKey && clientSecret) {
    const { data, status } = await axios.post(
      'https://open.tiktokapis.com/v2/oauth/token/',
      new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refresh,
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 30000,
        validateStatus: () => true,
      },
    );
    const access = data?.access_token || data?.data?.access_token;
    const expiresIn = Number(data?.expires_in || data?.data?.expires_in || 86400);
    if (status < 400 && access) {
      tiktokAccessCache = {
        token: access,
        expiresAt: Date.now() + expiresIn * 1000,
      };
      if (data?.refresh_token || data?.data?.refresh_token) {
        process.env.TIKTOK_REFRESH_TOKEN = data.refresh_token || data.data.refresh_token;
      }
      return access;
    }
    console.warn('[social] TikTok refresh failed:', data?.error || data || status);
  }

  return process.env.TIKTOK_ACCESS_TOKEN?.trim() || '';
}

async function resolveInstagramUserId(pageId, token) {
  const fromEnv = process.env.META_IG_USER_ID?.trim();
  if (fromEnv) return fromEnv;

  const { data } = await axios.get(`https://graph.facebook.com/v21.0/${pageId}`, {
    params: {
      fields: 'instagram_business_account{id},page_backed_instagram_accounts{id}',
      access_token: token,
    },
    timeout: 30000,
    validateStatus: () => true,
  });

  return (
    data?.instagram_business_account?.id
    || data?.page_backed_instagram_accounts?.data?.[0]?.id
    || ''
  );
}

async function waitIgContainerReady(containerId, token, { attempts = 24, delayMs = 2500 } = {}) {
  for (let i = 0; i < attempts; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const { data, status } = await axios.get(`https://graph.facebook.com/v21.0/${containerId}`, {
      params: { fields: 'status_code,status', access_token: token },
      timeout: 30000,
      validateStatus: () => true,
    });
    const code = String(data?.status_code || '').toUpperCase();
    if (status < 400 && code === 'FINISHED') return { ok: true, data };
    if (status < 400 && (code === 'ERROR' || code === 'EXPIRED')) {
      return { ok: false, error: data?.status || 'instagram_container_failed', details: data };
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return { ok: false, error: 'instagram_container_timeout' };
}

async function publishInstagram({ caption, link, mediaUrl, mime, pageId, token }) {
  if (!mediaUrl || (!isImageMime(mime) && !isVideoMime(mime))) {
    return {
      ok: false,
      skipped: true,
      error: 'instagram_media_required',
      hint: 'إنستغرام يحتاج صورة أو فيديو عبر رابط عام (لا نص فقط).',
    };
  }

  let igUserId = '';
  try {
    igUserId = await resolveInstagramUserId(pageId, token);
  } catch (error) {
    return { ok: false, error: error?.message || 'instagram_id_resolve_failed' };
  }
  if (!igUserId) {
    return {
      ok: false,
      error: 'instagram_not_linked',
      hint: 'اربط حساب Instagram Business بالصفحة أو عيّن META_IG_USER_ID',
    };
  }

  const message = [caption, link].filter(Boolean).join('\n\n').slice(0, 2200);
  const createBody = isVideoMime(mime)
    ? {
        media_type: 'REELS',
        video_url: mediaUrl,
        caption: message,
        share_to_feed: true,
        access_token: token,
      }
    : {
        image_url: mediaUrl,
        caption: message,
        access_token: token,
      };

  const created = await axios.post(
    `https://graph.facebook.com/v21.0/${igUserId}/media`,
    createBody,
    { timeout: 120000, validateStatus: () => true },
  );
  if (created.status >= 400 || created.data?.error || !created.data?.id) {
    return {
      ok: false,
      error: created.data?.error?.message || 'instagram_container_failed',
      details: created.data?.error || created.data,
      hint: /permission|(#10)/i.test(String(created.data?.error?.message || ''))
        ? 'التوكن يحتاج صلاحيات instagram_basic + instagram_content_publish'
        : undefined,
    };
  }

  const ready = await waitIgContainerReady(created.data.id, token);
  if (!ready.ok) return ready;

  const published = await axios.post(
    `https://graph.facebook.com/v21.0/${igUserId}/media_publish`,
    { creation_id: created.data.id, access_token: token },
    { timeout: 120000, validateStatus: () => true },
  );
  if (published.status >= 400 || published.data?.error) {
    return {
      ok: false,
      error: published.data?.error?.message || 'instagram_publish_failed',
      details: published.data?.error || published.data,
    };
  }

  return {
    ok: true,
    id: published.data?.id,
    igUserId,
    containerId: created.data.id,
    raw: published.data,
  };
}

async function publishFacebook({ caption, link, mediaUrl, mediaPath, mime, pageId, token }) {
  const message = [caption, link].filter(Boolean).join('\n\n');
  const hasLocal = mediaPath && fs.existsSync(mediaPath);

  // Prefer multipart from disk so Meta never has to fetch our public URL
  // (crawler timeouts / transient 404s caused "Missing or invalid image file").
  if (isVideoMime(mime) && (hasLocal || mediaUrl)) {
    if (hasLocal) {
      const buf = fs.readFileSync(mediaPath);
      const form = new FormData();
      form.append('source', new Blob([buf], { type: mime || 'video/mp4' }), path.basename(mediaPath));
      form.append('description', message);
      form.append('access_token', token);
      const { data, status } = await axios.post(
        `https://graph.facebook.com/v21.0/${pageId}/videos`,
        form,
        { timeout: 300000, validateStatus: () => true, maxBodyLength: Infinity },
      );
      if (status >= 400 || data?.error) {
        return { ok: false, error: data?.error?.message || 'meta_video_failed', details: data?.error || data };
      }
      return { ok: true, id: data?.id || data?.post_id, raw: data };
    }
    const { data, status } = await axios.post(
      `https://graph.facebook.com/v21.0/${pageId}/videos`,
      { file_url: mediaUrl, description: message, access_token: token },
      { timeout: 180000, validateStatus: () => true },
    );
    if (status >= 400 || data?.error) {
      return { ok: false, error: data?.error?.message || 'meta_video_failed', details: data?.error || data };
    }
    return { ok: true, id: data?.id || data?.post_id, raw: data };
  }

  if (isImageMime(mime) && (hasLocal || mediaUrl)) {
    if (hasLocal) {
      const buf = fs.readFileSync(mediaPath);
      const form = new FormData();
      form.append('source', new Blob([buf], { type: mime || 'image/jpeg' }), path.basename(mediaPath));
      form.append('caption', message);
      form.append('access_token', token);
      const { data, status } = await axios.post(
        `https://graph.facebook.com/v21.0/${pageId}/photos`,
        form,
        { timeout: 180000, validateStatus: () => true, maxBodyLength: Infinity },
      );
      if (status >= 400 || data?.error) {
        return { ok: false, error: data?.error?.message || 'meta_photo_failed', details: data?.error || data };
      }
      return { ok: true, id: data?.post_id || data?.id, raw: data };
    }
    const { data, status } = await axios.post(
      `https://graph.facebook.com/v21.0/${pageId}/photos`,
      { url: mediaUrl, caption: message, access_token: token },
      { timeout: 120000, validateStatus: () => true },
    );
    if (status >= 400 || data?.error) {
      return { ok: false, error: data?.error?.message || 'meta_photo_failed', details: data?.error || data };
    }
    return { ok: true, id: data?.post_id || data?.id, raw: data };
  }

  const { data, status } = await axios.post(
    `https://graph.facebook.com/v21.0/${pageId}/feed`,
    { message, link: link || undefined, access_token: token },
    { timeout: 60000, validateStatus: () => true },
  );
  if (status >= 400 || data?.error) {
    return { ok: false, error: data?.error?.message || 'meta_feed_failed', details: data?.error || data };
  }
  return { ok: true, id: data?.id, raw: data };
}

async function publishMeta({ caption, link, mediaUrl, mediaPath, mime }) {
  const pageId = process.env.META_PAGE_ID?.trim();
  const token = process.env.META_PAGE_ACCESS_TOKEN?.trim();
  if (!pageId || !token) {
    return { ok: false, error: 'meta_not_configured', hint: socialPlatformStatus().meta.hint };
  }

  const facebook = await publishFacebook({
    caption, link, mediaUrl, mediaPath, mime, pageId, token,
  });

  let instagram = null;
  // Instagram Graph API requires a public URL (image_url / video_url).
  if (mediaUrl && (isImageMime(mime) || isVideoMime(mime))) {
    instagram = await publishInstagram({
      caption, link, mediaUrl, mime, pageId, token,
    });
  } else if (facebook.ok) {
    instagram = {
      ok: false,
      skipped: true,
      error: 'instagram_media_required',
      hint: 'نُشر على فيسبوك فقط — إنستغرام يحتاج صورة أو فيديو.',
    };
  }

  const igOk = Boolean(instagram?.ok);
  const fbOk = Boolean(facebook?.ok);
  const ok = fbOk || igOk;

  return {
    ok,
    id: facebook?.id || instagram?.id,
    facebook,
    instagram,
    error: !ok ? (facebook?.error || instagram?.error) : undefined,
    hint: !igOk && instagram
      ? (instagram.hint || (fbOk ? 'نُشر على فيسبوك — إنستغرام لم يكتمل' : undefined))
      : undefined,
  };
}

async function publishTikTok({ caption, mediaPath, mime }) {
  const token = await resolveTikTokAccessToken();
  const openId = process.env.TIKTOK_OPEN_ID?.trim();
  if (!token || !openId) {
    return { ok: false, error: 'tiktok_not_configured', hint: socialPlatformStatus().tiktok.hint };
  }
  if (!isVideoMime(mime) || !mediaPath) {
    return { ok: false, error: 'tiktok_video_required', hint: 'TikTok يقبل فيديو فقط.' };
  }

  const size = fs.statSync(mediaPath).size;
  const initRes = await axios.post(
    'https://open.tiktokapis.com/v2/post/publish/inbox/video/init/',
    {
      post_info: {
        title: String(caption || 'Errayhany').slice(0, 150),
        privacy_level: process.env.TIKTOK_PRIVACY_LEVEL || 'SELF_ONLY',
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
      },
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: size,
        chunk_size: size,
        total_chunk_count: 1,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      timeout: 60000,
      validateStatus: () => true,
    },
  );

  const uploadUrl = initRes.data?.data?.upload_url;
  const publishId = initRes.data?.data?.publish_id;
  if (initRes.status >= 400 || !uploadUrl) {
    return {
      ok: false,
      error: initRes.data?.error?.message || 'tiktok_init_failed',
      details: initRes.data,
    };
  }

  const buf = fs.readFileSync(mediaPath);
  const put = await axios.put(uploadUrl, buf, {
    headers: {
      'Content-Type': mime || 'video/mp4',
      'Content-Length': buf.length,
    },
    maxBodyLength: Infinity,
    timeout: 300000,
    validateStatus: () => true,
  });
  if (put.status >= 400) {
    return { ok: false, error: 'tiktok_upload_failed', details: { status: put.status } };
  }

  return {
    ok: true,
    id: publishId,
    hint: 'رُفع إلى وارد TikTok — أكمل من التطبيق إن لزم.',
  };
}

async function publishYouTube({ caption, mediaPath, mime, title, link }) {
  const refresh = process.env.YOUTUBE_REFRESH_TOKEN?.trim();
  const clientId = process.env.YOUTUBE_CLIENT_ID?.trim();
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET?.trim();
  if (!refresh || !clientId || !clientSecret) {
    return { ok: false, error: 'youtube_not_configured', hint: socialPlatformStatus().youtube.hint };
  }
  if (!isVideoMime(mime) || !mediaPath) {
    return { ok: false, error: 'youtube_video_required', hint: 'YouTube يقبل فيديو فقط.' };
  }

  const tokenRes = await axios.post(
    'https://oauth2.googleapis.com/token',
    new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refresh,
      grant_type: 'refresh_token',
    }).toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 30000,
      validateStatus: () => true,
    },
  );
  const accessToken = tokenRes.data?.access_token;
  if (!accessToken) {
    return {
      ok: false,
      error: tokenRes.data?.error_description || 'youtube_token_failed',
      details: tokenRes.data,
    };
  }

  const videoTitle = String(title || caption || 'Errayhany Grossiste').slice(0, 100);
  const description = [caption, link].filter(Boolean).join('\n\n').slice(0, 5000);
  const metadata = {
    snippet: { title: videoTitle, description, categoryId: '22' },
    status: {
      privacyStatus: process.env.YOUTUBE_PRIVACY_STATUS || 'unlisted',
      selfDeclaredMadeForKids: false,
    },
  };

  const boundary = `errayhany_${crypto.randomBytes(8).toString('hex')}`;
  const metaPart = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
  );
  const filePartHeader = Buffer.from(
    `--${boundary}\r\nContent-Type: ${mime || 'video/mp4'}\r\n\r\n`,
  );
  const filePart = fs.readFileSync(mediaPath);
  const end = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([metaPart, filePartHeader, filePart, end]);

  const upload = await axios.post(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status',
    body,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': body.length,
      },
      maxBodyLength: Infinity,
      timeout: 600000,
      validateStatus: () => true,
    },
  );

  if (upload.status >= 400 || upload.data?.error) {
    return {
      ok: false,
      error: upload.data?.error?.message || 'youtube_upload_failed',
      details: upload.data?.error || upload.data,
    };
  }

  return {
    ok: true,
    id: upload.data?.id,
    url: upload.data?.id ? `https://youtu.be/${upload.data.id}` : null,
  };
}

async function runPlatformPublish(platform, ctx) {
  if (platform === 'meta') return publishMeta(ctx);
  if (platform === 'tiktok') return publishTikTok(ctx);
  if (platform === 'youtube') return publishYouTube(ctx);
  return { ok: false, error: 'unknown_platform' };
}

export async function createAndPublishSocialPost({
  caption = '',
  link = '',
  title = '',
  platforms = [],
  media,
} = {}) {
  const selected = [...new Set((platforms || []).map(String).filter((p) => PLATFORMS.includes(p)))];
  if (!selected.length) {
    const err = new Error('platforms_required');
    err.statusCode = 400;
    throw err;
  }

  const mediaUrl = media?.filename
    ? publicMediaUrl(media.filename)
    : (media?.url || '');
  const mediaPath = media?.filename ? path.join(MEDIA_DIR, media.filename) : null;
  const mime = media?.mime || '';

  const needsVideo = selected.includes('tiktok') || selected.includes('youtube');
  if (needsVideo && (!mediaPath || !isVideoMime(mime))) {
    const err = new Error('media_required_for_video_platforms');
    err.statusCode = 400;
    err.hint = 'TikTok وYouTube يحتاجان ملف فيديو (mp4). للصورة اختر Meta فقط.';
    throw err;
  }

  const post = {
    id: newId(),
    createdAt: new Date().toISOString(),
    caption: String(caption || '').trim(),
    title: String(title || '').trim(),
    link: String(link || `${SITE_URL}/vip`).trim(),
    platforms: selected,
    media: media
      ? {
          filename: media.filename || null,
          url: mediaUrl,
          mime,
          size: media.size || null,
          originalName: media.originalName || null,
        }
      : null,
    results: {},
    status: 'publishing',
  };

  const posts = readPosts();
  posts.unshift(post);
  writePosts(posts);

  const ctx = {
    caption: post.caption,
    link: post.link,
    title: post.title || post.caption,
    mediaUrl,
    mediaPath,
    mime,
  };

  for (const platform of selected) {
    try {
      // Sequential: video uploads are heavy; avoid flooding APIs.
      // eslint-disable-next-line no-await-in-loop
      post.results[platform] = await runPlatformPublish(platform, ctx);
    } catch (error) {
      post.results[platform] = { ok: false, error: error?.message || 'publish_failed' };
    }
  }

  const values = Object.values(post.results);
  const anyOk = values.some((r) => r?.ok);
  const allOk = values.length > 0 && values.every((r) => r?.ok);
  post.status = allOk ? 'published' : anyOk ? 'partial' : 'failed';
  post.finishedAt = new Date().toISOString();

  const latest = readPosts();
  const idx = latest.findIndex((p) => p.id === post.id);
  if (idx >= 0) latest[idx] = post;
  else latest.unshift(post);
  writePosts(latest);

  return post;
}

export function listSocialPosts(limit = 30) {
  return readPosts().slice(0, Math.min(80, Number(limit) || 30));
}

ensureDirs();
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, MEDIA_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').slice(0, 12)
      || (isVideoMime(file.mimetype) ? '.mp4' : '.jpg');
    cb(null, `${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`);
  },
});

export const socialUpload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (isImageMime(file.mimetype) || isVideoMime(file.mimetype)) cb(null, true);
    else cb(new Error('unsupported_media_type'));
  },
});

/** Chunked uploads dodge the ~60s outer proxy timeout on EasyPanel/CDN. */
const chunkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
});

const CHUNK_DIR = path.join(MEDIA_DIR, '_chunks');

function safeUploadId(id) {
  const v = String(id || '').trim();
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(v)) return '';
  return v;
}

function mediaFromFile(file, originalName) {
  return {
    filename: file.filename,
    mime: file.mimetype,
    size: file.size,
    originalName: originalName || file.originalname,
    url: publicMediaUrl(file.filename),
  };
}

export function registerSocialPublishRoutes(app, { requireAdmin }) {
  ensureDirs();
  fs.mkdirSync(CHUNK_DIR, { recursive: true });

  app.use('/social-media', express.static(MEDIA_DIR, {
    maxAge: '1d',
    fallthrough: true,
  }));

  app.get('/api/admin/social/status', (req, res) => {
    if (!requireAdmin(req, res)) return;
    return res.json({ ok: true, ...socialPlatformStatus() });
  });

  app.get('/api/admin/social/posts', (req, res) => {
    if (!requireAdmin(req, res)) return;
    return res.json({ ok: true, posts: listSocialPosts(req.query.limit) });
  });

  app.post('/api/admin/social/upload', (req, res) => {
    if (!requireAdmin(req, res)) return;
    socialUpload.single('file')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ ok: false, error: err.message || 'upload_failed' });
      }
      if (!req.file) {
        return res.status(400).json({ ok: false, error: 'file_required' });
      }
      return res.json({ ok: true, media: mediaFromFile(req.file) });
    });
  });

  app.post('/api/admin/social/upload/init', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const mime = String(req.body?.mime || '');
    const size = Number(req.body?.size) || 0;
    const originalName = String(req.body?.originalName || 'upload.bin').slice(0, 180);
    const totalChunks = Math.max(1, Number(req.body?.totalChunks) || 1);
    if (!isImageMime(mime) && !isVideoMime(mime)) {
      return res.status(400).json({ ok: false, error: 'unsupported_media_type' });
    }
    if (size <= 0 || size > 200 * 1024 * 1024) {
      return res.status(400).json({ ok: false, error: 'invalid_size' });
    }
    if (totalChunks > 400) {
      return res.status(400).json({ ok: false, error: 'too_many_chunks' });
    }
    const uploadId = `${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
    const dir = path.join(CHUNK_DIR, uploadId);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'meta.json'),
      JSON.stringify({ mime, size, originalName, totalChunks, createdAt: Date.now() }),
      'utf8',
    );
    return res.json({ ok: true, uploadId, chunkBytes: 768 * 1024 });
  });

  app.post('/api/admin/social/upload/chunk', (req, res) => {
    if (!requireAdmin(req, res)) return;
    chunkUpload.single('chunk')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ ok: false, error: err.message || 'chunk_failed' });
      }
      const uploadId = safeUploadId(req.body?.uploadId);
      const index = Number(req.body?.index);
      if (!uploadId || !Number.isInteger(index) || index < 0 || !req.file?.buffer) {
        return res.status(400).json({ ok: false, error: 'invalid_chunk' });
      }
      const dir = path.join(CHUNK_DIR, uploadId);
      if (!fs.existsSync(path.join(dir, 'meta.json'))) {
        return res.status(404).json({ ok: false, error: 'upload_not_found' });
      }
      fs.writeFileSync(path.join(dir, `${String(index).padStart(5, '0')}.part`), req.file.buffer);
      return res.json({ ok: true, index });
    });
  });

  app.post('/api/admin/social/upload/complete', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const uploadId = safeUploadId(req.body?.uploadId);
    if (!uploadId) {
      return res.status(400).json({ ok: false, error: 'invalid_upload_id' });
    }
    const dir = path.join(CHUNK_DIR, uploadId);
    const metaPath = path.join(dir, 'meta.json');
    if (!fs.existsSync(metaPath)) {
      return res.status(404).json({ ok: false, error: 'upload_not_found' });
    }
    let meta;
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch {
      return res.status(400).json({ ok: false, error: 'corrupt_upload_meta' });
    }
    const total = Number(meta.totalChunks) || 0;
    const parts = [];
    for (let i = 0; i < total; i += 1) {
      const p = path.join(dir, `${String(i).padStart(5, '0')}.part`);
      if (!fs.existsSync(p)) {
        return res.status(400).json({ ok: false, error: `missing_chunk_${i}` });
      }
      parts.push(p);
    }
    const ext = path.extname(meta.originalName || '').slice(0, 12)
      || (isVideoMime(meta.mime) ? '.mp4' : '.jpg');
    const filename = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
    const outPath = path.join(MEDIA_DIR, filename);
    const fd = fs.openSync(outPath, 'w');
    try {
      for (const part of parts) {
        fs.writeSync(fd, fs.readFileSync(part));
      }
    } finally {
      fs.closeSync(fd);
    }
    // Cleanup chunk dir best-effort
    try {
      for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f));
      fs.rmdirSync(dir);
    } catch {
      /* ignore */
    }
    const size = fs.statSync(outPath).size;
    return res.json({
      ok: true,
      media: {
        filename,
        mime: meta.mime,
        size,
        originalName: meta.originalName,
        url: publicMediaUrl(filename),
      },
    });
  });

  app.post('/api/admin/social/publish', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const post = await createAndPublishSocialPost(req.body || {});
      return res.json({ ok: true, post });
    } catch (error) {
      return res.status(error?.statusCode || 500).json({
        ok: false,
        error: error?.message || 'publish_failed',
        hint: error?.hint || undefined,
      });
    }
  });
}
