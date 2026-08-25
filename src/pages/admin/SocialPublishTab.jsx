import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clapperboard,
  Facebook,
  ImagePlus,
  Loader2,
  RefreshCw,
  Send,
  Trash2,
  Youtube,
} from 'lucide-react';
import {
  fetchSocialPlatformStatus,
  fetchSocialPosts,
  publishSocialPost,
  uploadSocialMedia,
} from '../../services/adminApi';

const PLATFORM_META = {
  meta: { label: 'Meta', Icon: Facebook, color: 'text-blue-500' },
  tiktok: { label: 'TikTok', Icon: Clapperboard, color: 'text-fuchsia-500' },
  youtube: { label: 'YouTube', Icon: Youtube, color: 'text-red-500' },
};

function metaResultLines(r) {
  if (!r) return [];
  const lines = [];
  if (r.facebook) {
    lines.push(r.facebook.ok
      ? 'Facebook: نُشر'
      : `Facebook: ${r.facebook.hint || r.facebook.error || 'فشل'}`);
  }
  if (r.instagram) {
    if (r.instagram.skipped) {
      lines.push(`Instagram: ${r.instagram.hint || 'تخطي'}`);
    } else {
      lines.push(r.instagram.ok
        ? 'Instagram: نُشر'
        : `Instagram: ${r.instagram.hint || r.instagram.error || 'فشل'}`);
    }
  } else if (!r.ok && (r.hint || r.error)) {
    lines.push(r.hint || r.error);
  }
  return lines;
}

function formatBytes(n) {
  const v = Number(n) || 0;
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
  return `${(v / (1024 * 1024)).toFixed(1)} MB`;
}

function statusLabel(status) {
  if (status === 'published') return { text: 'نُشر', cls: 'text-emerald-500' };
  if (status === 'partial') return { text: 'جزئي', cls: 'text-amber-500' };
  if (status === 'failed') return { text: 'فشل', cls: 'text-red-500' };
  if (status === 'publishing') return { text: 'جارٍ…', cls: 'text-blue-500' };
  return { text: status || '—', cls: 'text-slate-400' };
}

function errorText(e) {
  const data = e?.response?.data;
  const status = e?.response?.status;
  if (status === 502 || status === 504) {
    return 'انقطع الرفع بسبب مهلة السيرفر. ارفع فيديو أصغر قليلاً أو انتظر بعد تحديث الرفع المجزّأ، ثم أعد المحاولة.';
  }
  if (data?.error === 'platforms_required') return 'اختر منصة واحدةً على الأقل.';
  if (data?.error === 'media_required_for_video_platforms') {
    return data.hint || 'TikTok وYouTube يحتاجان فيديو.';
  }
  if (data?.error === 'unsupported_media_type') return 'نوع الملف غير مدعوم (صورة أو فيديو فقط).';
  if (data?.hint) return data.hint;
  if (data?.error) return String(data.error);
  if (e?.message) return e.message;
  return 'تعذر الاتصال بالخادم';
}

const SocialPublishTab = ({ dm }) => {
  const card = dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200';
  const muted = dm ? 'text-gray-400' : 'text-slate-500';
  const input = dm
    ? 'bg-gray-950 border-gray-800 text-gray-100 placeholder:text-gray-600'
    : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400';

  const [status, setStatus] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [caption, setCaption] = useState('');
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('https://errayhany.com/vip');
  const [platforms, setPlatforms] = useState({ meta: true, tiktok: false, youtube: false });
  const [media, setMedia] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selected = useMemo(
    () => Object.entries(platforms).filter(([, on]) => on).map(([id]) => id),
    [platforms],
  );

  const mediaIsVideo = Boolean(media?.mime?.startsWith('video/'));

  const load = useCallback(async () => {
    setError('');
    try {
      const [st, list] = await Promise.all([
        fetchSocialPlatformStatus(),
        fetchSocialPosts(40),
      ]);
      setStatus(st);
      if (st?.defaultLink) setLink((prev) => prev || st.defaultLink);
      setPosts(list?.posts || []);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => () => {
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const onPickFile = async (file) => {
    if (!file) return;
    setError('');
    setMessage('');
    setUploading(true);
    setUploadPct(0);
    try {
      if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(file));
      const data = await uploadSocialMedia(file, { onProgress: setUploadPct });
      setMedia(data.media);
      const isVideo = String(data.media?.mime || '').startsWith('video/');
      if (!isVideo) {
        setPlatforms((prev) => ({ ...prev, tiktok: false, youtube: false, meta: true }));
        setMessage(`تم رفع الصورة (${formatBytes(data.media?.size)}) — Meta فقط (YouTube/TikTok يحتاجان فيديو).`);
      } else {
        setMessage(`تم رفع الفيديو (${formatBytes(data.media?.size)})`);
      }
    } catch (e) {
      setMedia(null);
      setError(errorText(e));
    } finally {
      setUploading(false);
      setUploadPct(0);
    }
  };

  const clearMedia = () => {
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    setMedia(null);
  };

  const togglePlatform = (id) => {
    if ((id === 'tiktok' || id === 'youtube') && media && !mediaIsVideo) {
      setError('TikTok وYouTube يحتاجان فيديو. ارفع mp4 أو اختر Meta فقط.');
      return;
    }
    setPlatforms((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const onPublish = async () => {
    setError('');
    setMessage('');
    if (!selected.length) {
      setError('اختر منصة واحدةً على الأقل.');
      return;
    }
    if (!caption.trim() && !media) {
      setError('أدخل نصاً أو ارفع صورة/فيديو.');
      return;
    }
    if ((platforms.tiktok || platforms.youtube) && !mediaIsVideo) {
      setError('TikTok وYouTube يحتاجان فيديو. للصورة اختر Meta فقط.');
      return;
    }
    setPublishing(true);
    try {
      const data = await publishSocialPost({
        caption: caption.trim(),
        title: title.trim(),
        link: link.trim(),
        platforms: selected,
        media: media || undefined,
      });
      const post = data.post;
      setPosts((prev) => [post, ...prev.filter((p) => p.id !== post.id)]);
      if (post.status === 'published') setMessage('تم النشر على كل المنصات المختارة.');
      else if (post.status === 'partial') setMessage('نُشر على بعض المنصات — راجع السجل أسفله.');
      else setError('فشل النشر — راجع تفاصيل كل منصة في السجل.');
      setCaption('');
      setTitle('');
      clearMedia();
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className={`rounded-2xl border p-10 flex items-center justify-center gap-2 ${card}`}>
        <Loader2 className="animate-spin text-blue-500" size={20} />
        <span className={muted}>تحميل تبويب النشر…</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className={`rounded-2xl border p-4 sm:p-5 ${card}`}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="font-bold text-lg">نشر المحتوى للمنصات</h3>
            <p className={`text-sm mt-1 ${muted}`}>
              صورة → Meta فقط. فيديو → Meta / TikTok / YouTube. TikTok يحتاج إكمال OAuth أولاً.
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            className={`p-2 rounded-lg ${dm ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-slate-100 text-slate-500'}`}
            title="تحديث"
          >
            <RefreshCw size={18} />
          </button>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 mb-5">
          {['meta', 'tiktok', 'youtube'].map((id) => {
            const info = status?.[id];
            const Meta = PLATFORM_META[id];
            const Icon = Meta.Icon;
            const ready = Boolean(info?.ready);
            const on = platforms[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => togglePlatform(id)}
                className={`text-right rounded-xl border p-3 transition-all ${
                  on
                    ? (dm ? 'border-blue-500/50 bg-blue-500/10' : 'border-blue-300 bg-blue-50')
                    : (dm ? 'border-gray-800 bg-gray-950' : 'border-slate-200 bg-slate-50')
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={16} className={Meta.color} />
                  <span className="font-bold text-sm">{Meta.label}</span>
                  <span className={`mr-auto text-[10px] font-bold ${ready ? 'text-emerald-500' : 'text-amber-500'}`}>
                    {ready ? 'موصول' : 'يحتاج توكن'}
                  </span>
                </div>
                <p className={`text-[11px] leading-snug ${muted}`}>{info?.hint}</p>
              </button>
            );
          })}
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <label className={`block text-xs font-bold ${muted}`}>عنوان YouTube (اختياري)</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="عنوان الفيديو على يوتيوب"
              className={`w-full rounded-xl border px-3 py-2.5 text-sm ${input}`}
            />

            <label className={`block text-xs font-bold ${muted}`}>نص المنشور</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={6}
              placeholder={'مثال:\nإلكترونيات بالجملة من Errayhany Grossiste\nشواحن · سماعات · كابلات\nاطلب الآن 👇'}
              className={`w-full rounded-xl border px-3 py-2.5 text-sm resize-y min-h-[140px] ${input}`}
            />

            <label className={`block text-xs font-bold ${muted}`}>رابط الدعوة</label>
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://errayhany.com/vip"
              className={`w-full rounded-xl border px-3 py-2.5 text-sm ${input}`}
            />
          </div>

          <div className="space-y-3">
            <label className={`block text-xs font-bold ${muted}`}>صورة أو فيديو</label>
            <label
              className={`flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed min-h-[180px] cursor-pointer transition-colors ${
                dm ? 'border-gray-700 hover:border-blue-500/50 bg-gray-950' : 'border-slate-300 hover:border-blue-400 bg-slate-50'
              }`}
            >
              <input
                type="file"
                accept="image/*,video/*"
                className="hidden"
                disabled={uploading || publishing}
                onChange={(e) => onPickFile(e.target.files?.[0])}
              />
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="animate-spin text-blue-500" size={28} />
                  <span className={`text-xs ${muted}`}>
                    جارٍ الرفع{uploadPct > 0 ? ` ${uploadPct}%` : '…'}
                  </span>
                </div>
              ) : previewUrl ? (
                media?.mime?.startsWith('video/') ? (
                  <video src={previewUrl} controls className="max-h-48 rounded-xl" />
                ) : (
                  <img src={previewUrl} alt="" className="max-h-48 rounded-xl object-contain" />
                )
              ) : (
                <>
                  <ImagePlus size={28} className={muted} />
                  <span className={`text-sm ${muted}`}>اسحب أو اختر ملف (حتى 200MB)</span>
                </>
              )}
            </label>

            {media && (
              <div className={`flex items-center justify-between gap-2 text-xs rounded-xl border px-3 py-2 ${dm ? 'border-gray-800' : 'border-slate-200'}`}>
                <span className="truncate">{media.originalName || media.filename} · {formatBytes(media.size)}</span>
                <button type="button" onClick={clearMedia} className="text-red-400 p-1" title="إزالة">
                  <Trash2 size={14} />
                </button>
              </div>
            )}

            <button
              type="button"
              disabled={publishing || uploading}
              onClick={onPublish}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold py-3 transition-colors"
            >
              {publishing ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
              انشر على المنصات المختارة
            </button>
          </div>
        </div>

        {message && (
          <div className="mt-4 flex items-start gap-2 text-sm text-emerald-500">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            <span>{message}</span>
          </div>
        )}
        {error && (
          <div className="mt-4 flex items-start gap-2 text-sm text-red-400">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className={`rounded-2xl border p-4 sm:p-5 ${card}`}>
        <h3 className="font-bold mb-3">سجل النشر</h3>
        {!posts.length ? (
          <p className={`text-sm ${muted}`}>لا منشورات بعد.</p>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => {
              const st = statusLabel(post.status);
              return (
                <div
                  key={post.id}
                  className={`rounded-xl border p-3 ${dm ? 'border-gray-800 bg-gray-950/60' : 'border-slate-100 bg-slate-50'}`}
                >
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className={`text-xs font-bold ${st.cls}`}>{st.text}</span>
                    <span className={`text-[11px] ${muted}`}>
                      {post.createdAt ? new Date(post.createdAt).toLocaleString('ar-MA') : ''}
                    </span>
                    <div className="flex gap-1 mr-auto">
                      {(post.platforms || []).map((id) => {
                        const Meta = PLATFORM_META[id];
                        if (!Meta) return null;
                        const Icon = Meta.Icon;
                        const r = post.results?.[id];
                        return (
                          <span
                            key={id}
                            title={r?.ok ? 'نجح' : (r?.hint || r?.error || '')}
                            className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md border ${
                              r?.ok
                                ? (dm ? 'border-emerald-500/30 text-emerald-400' : 'border-emerald-200 text-emerald-600')
                                : (dm ? 'border-red-500/30 text-red-400' : 'border-red-200 text-red-500')
                            }`}
                          >
                            <Icon size={10} />
                            {Meta.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <p className="text-sm whitespace-pre-wrap line-clamp-3">{post.caption || '(بدون نص)'}</p>
                  {post.link && (
                    <a href={post.link} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-500 break-all">
                      {post.link}
                    </a>
                  )}
                  {Object.entries(post.results || {}).flatMap(([id, r]) => {
                    if (id === 'meta') {
                      return metaResultLines(r).map((line, i) => (
                        <p key={`${id}-${i}`} className={`text-[11px] mt-1 ${muted}`}>{line}</p>
                      ));
                    }
                    if (!r?.ok && (r?.error || r?.hint)) {
                      return [
                        <p key={id} className={`text-[11px] mt-1 ${muted}`}>
                          {PLATFORM_META[id]?.label || id}: {r.hint || r.error}
                        </p>,
                      ];
                    }
                    return [];
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SocialPublishTab;
