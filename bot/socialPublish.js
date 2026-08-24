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
  const tiktokReady = Boolean(
    process.env.TIKTOK_ACCESS_TOKEN?.trim() && process.env.TIKTOK_OPEN_ID?.trim(),
  );
  const youtubeReady = Boolean(
    process.env.YOUTUBE_REFRESH_TOKEN?.trim()
    && process.env.YOUTUBE_CLIENT_ID?.trim()
    && process.env.YOUTUBE_CLIENT_SECRET?.trim(),
  );

  return {
    meta: {
      id: 'meta',
      label: 'Meta (Facebook)',
      ready: metaReady,
      hint: metaReady
        ? 'جاهز للنشر على صفحة فيسبوك'
        : 'أضف META_PAGE_ID و META_PAGE_ACCESS_TOKEN على سيرفر البوت',
    },
    tiktok: {
      id: 'tiktok',
      label: 'TikTok',
      ready: tiktokReady,
      hint: tiktokReady
        ? 'توكن TikTok موجود'
        : 'يتطلب TIKTOK_ACCESS_TOKEN و TIKTOK_OPEN_ID (Content Posting API)',
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

async function publishMeta({ caption, link, mediaUrl, mime }) {
  const pageId = process.env.META_PAGE_ID?.trim();
  const token = process.env.META_PAGE_ACCESS_TOKEN?.trim();
  if (!pageId || !token) {
    return { ok: false, error: 'meta_not_configured', hint: socialPlatformStatus().meta.hint };
  }

  const message = [caption, link].filter(Boolean).join('\n\n');

  if (isVideoMime(mime) && mediaUrl) {
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

  if (isImageMime(mime) && mediaUrl) {
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

async function publishTikTok({ caption, mediaPath, mime }) {
  const token = process.env.TIKTOK_ACCESS_TOKEN?.trim();
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

  if ((selected.includes('tiktok') || selected.includes('youtube')) && !mediaPath) {
    const err = new Error('media_required_for_video_platforms');
    err.statusCode = 400;
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

export function registerSocialPublishRoutes(app, { requireAdmin }) {
  ensureDirs();

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
      return res.json({
        ok: true,
        media: {
          filename: req.file.filename,
          mime: req.file.mimetype,
          size: req.file.size,
          originalName: req.file.originalname,
          url: publicMediaUrl(req.file.filename),
        },
      });
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
      });
    }
  });
}
