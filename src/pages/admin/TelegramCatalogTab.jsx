import React, { useCallback, useEffect, useState } from 'react';
import {
  Clock,
  Loader2,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Send,
} from 'lucide-react';
import {
  fetchTelegramCatalogStatus,
  runTelegramCatalogNow,
  saveTelegramCatalogSettings,
} from '../../services/adminApi';

const ERROR_AR = {
  disabled: 'النشر متوقف',
  outside_window: 'خارج وقت النشر',
  no_product: 'لا يوجد منتج منشور للعرض',
  already_running: 'نشر آخر ما زال جارياً',
  nocodb_not_configured: 'NocoDB غير مضبوط على السيرفر',
};

function messageFor(e, fallback) {
  const code = e?.response?.data?.error || e?.error;
  if (code && ERROR_AR[code]) return ERROR_AR[code];
  return e?.response?.data?.hint
    || e?.message
    || fallback;
}

function formatWhen(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ar-MA', { timeZone: 'Africa/Casablanca' });
}

export default function TelegramCatalogTab({ dm }) {
  const card = dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200';
  const muted = dm ? 'text-gray-400' : 'text-slate-500';
  const input = dm
    ? 'bg-gray-950 border-gray-800 text-gray-100'
    : 'bg-white border-slate-200 text-slate-800';

  const [status, setStatus] = useState(null);
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const applyStatus = (data) => {
    setStatus(data);
    setDraft({
      tgCatalogEnabled: Boolean(data.enabled),
      tgCatalogIntervalHours: data.intervalHours ?? 1,
      tgCatalogStartHour: data.startHour ?? 8,
      tgCatalogEndHour: data.endHour ?? 23,
      tgCatalogImdenEnabled: data.imdenEnabled !== false,
      tgCatalogEcomEnabled: data.ecomEnabled !== false,
      tgCatalogImdenChatId: data.settings?.tgCatalogImdenChatId
        || data.channels?.find((c) => c.id === 'imden')?.chatId
        || '',
      tgCatalogEcomChatId: data.settings?.tgCatalogEcomChatId
        || data.channels?.find((c) => c.id === 'ecom')?.chatId
        || '',
      tgCatalogImdenPromoEvery: data.channels?.find((c) => c.id === 'imden')?.promoEvery ?? 12,
      tgCatalogEcomPromoEvery: data.channels?.find((c) => c.id === 'ecom')?.promoEvery ?? 8,
      tgCatalogWhatsapp: data.settings?.tgCatalogWhatsapp || '212664630566',
      tgCatalogSiteUrl: data.settings?.tgCatalogSiteUrl || 'https://errayhany.com',
      tgCatalogPromoText: data.settings?.tgCatalogPromoText || '',
    });
  };

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await fetchTelegramCatalogStatus();
      applyStatus(data);
    } catch (e) {
      setError(messageFor(e, 'تعذر تحميل حالة النشر'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setField = (key, value) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setOk('');
  };

  const save = async (patch = draft) => {
    setSaving(true);
    setError('');
    setOk('');
    try {
      const data = await saveTelegramCatalogSettings(patch);
      applyStatus(data);
      setOk('تم حفظ الإعدادات');
    } catch (e) {
      setError(messageFor(e, 'فشل الحفظ'));
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async () => {
    await save({ ...draft, tgCatalogEnabled: !draft.tgCatalogEnabled });
  };

  const runNow = async () => {
    setRunning(true);
    setError('');
    setOk('');
    try {
      const data = await runTelegramCatalogNow();
      applyStatus(data);
      setOk(data.ok
        ? `نُشر ${data.sku || 'المنتج'}`
        : (ERROR_AR[data.error] || data.error || 'لم يُنشر'));
    } catch (e) {
      setError(messageFor(e, 'فشل النشر الآن'));
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div className={`rounded-2xl border p-8 flex items-center justify-center gap-2 ${card}`}>
        <Loader2 className="animate-spin" size={18} />
        <span className={muted}>جاري التحميل…</span>
      </div>
    );
  }

  const enabled = Boolean(draft.tgCatalogEnabled);

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border p-5 ${card}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-lg">نشر الكتالوج على تيليغرام</h3>
            <p className={`text-sm mt-1 ${muted}`}>
              نفس سير n8n: منتج منشور من NocoDB كل فترة، للصورتين أو لصورة واحدة، ثم تحديث تاريخ آخر نشر.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={load}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border ${dm ? 'border-gray-700' : 'border-slate-200'}`}
            >
              <RefreshCw size={14} />
              تحديث
            </button>
            <button
              type="button"
              onClick={runNow}
              disabled={running}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white disabled:opacity-50"
            >
              {running ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              نشر الآن
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={toggleEnabled}
            disabled={saving}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold ${
              enabled ? 'bg-emerald-600 text-white' : 'bg-slate-500 text-white'
            }`}
          >
            {enabled ? <PlayCircle size={18} /> : <PauseCircle size={18} />}
            {enabled ? 'يعمل' : 'متوقف'}
          </button>
          <span className={`text-sm ${muted}`}>
            <Clock size={14} className="inline ml-1" />
            الساعة الآن في الدار البيضاء: {status?.hour ?? '—'}
            {status?.inWindow ? ' • داخل وقت النشر' : ' • خارج وقت النشر'}
          </span>
        </div>
        <div className={`mt-3 text-sm space-y-1 ${muted}`}>
          <p>آخر نشر: {status?.lastSku || status?.lastResult?.sku || 'لا يوجد بعد'}{status?.lastRunAt ? ` • ${formatWhen(status.lastRunAt)}` : ''}</p>
          <p>النشر التالي: {enabled ? formatWhen(status?.nextAt) : 'متوقف'}</p>
        </div>

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
        {ok && <p className="mt-3 text-sm text-emerald-600">{ok}</p>}
      </div>

      <div className={`rounded-2xl border p-5 space-y-4 ${card}`}>
        <h4 className="font-bold">الجدول</h4>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            <span className={muted}>كل كم ساعة</span>
            <input
              type="number"
              min={1}
              max={24}
              value={draft.tgCatalogIntervalHours ?? 1}
              onChange={(e) => setField('tgCatalogIntervalHours', Number(e.target.value))}
              className={`mt-1 w-full rounded-xl border px-3 py-2 ${input}`}
            />
          </label>
          <label className="text-sm">
            <span className={muted}>من الساعة</span>
            <input
              type="number"
              min={0}
              max={23}
              value={draft.tgCatalogStartHour ?? 8}
              onChange={(e) => setField('tgCatalogStartHour', Number(e.target.value))}
              className={`mt-1 w-full rounded-xl border px-3 py-2 ${input}`}
            />
          </label>
          <label className="text-sm">
            <span className={muted}>إلى الساعة</span>
            <input
              type="number"
              min={0}
              max={23}
              value={draft.tgCatalogEndHour ?? 23}
              onChange={(e) => setField('tgCatalogEndHour', Number(e.target.value))}
              className={`mt-1 w-full rounded-xl border px-3 py-2 ${input}`}
            />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className={muted}>واتساب الجملة</span>
            <input
              value={draft.tgCatalogWhatsapp || ''}
              onChange={(e) => setField('tgCatalogWhatsapp', e.target.value)}
              className={`mt-1 w-full rounded-xl border px-3 py-2 ${input}`}
              dir="ltr"
            />
          </label>
          <label className="text-sm">
            <span className={muted}>رابط الموقع</span>
            <input
              value={draft.tgCatalogSiteUrl || ''}
              onChange={(e) => setField('tgCatalogSiteUrl', e.target.value)}
              className={`mt-1 w-full rounded-xl border px-3 py-2 ${input}`}
              dir="ltr"
            />
          </label>
        </div>
        <label className="text-sm block">
          <span className={muted}>نص رسالة الجملة (اختياري)</span>
          <textarea
            value={draft.tgCatalogPromoText || ''}
            onChange={(e) => setField('tgCatalogPromoText', e.target.value)}
            rows={5}
            className={`mt-1 w-full rounded-xl border px-3 py-2 font-mono text-xs ${input}`}
            dir="rtl"
            placeholder="اتركه فارغاً لاستخدام النص الافتراضي"
          />
        </label>
        <button
          type="button"
          onClick={() => save()}
          disabled={saving}
          className="px-4 py-2 rounded-xl text-sm font-bold bg-slate-800 text-white disabled:opacity-50"
        >
          {saving ? 'جارٍ الحفظ…' : 'حفظ الجدول والقنوات'}
        </button>
      </div>

      <div className={`rounded-2xl border p-5 space-y-4 ${card}`}>
        <h4 className="font-bold">القنوات</h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={`rounded-xl border p-3 space-y-2 ${dm ? 'border-gray-800' : 'border-slate-200'}`}>
            <label className="flex items-center gap-2 text-sm font-bold">
              <input
                type="checkbox"
                checked={Boolean(draft.tgCatalogImdenEnabled)}
                onChange={(e) => setField('tgCatalogImdenEnabled', e.target.checked)}
              />
              IMDEN TECNOLOGY
            </label>
            <input
              value={draft.tgCatalogImdenChatId || ''}
              onChange={(e) => setField('tgCatalogImdenChatId', e.target.value)}
              className={`w-full rounded-xl border px-3 py-2 text-sm ${input}`}
              dir="ltr"
              placeholder="-100…"
            />
            <label className={`text-xs ${muted}`}>
              رسالة الجملة كل
              <input
                type="number"
                min={0}
                max={100}
                value={draft.tgCatalogImdenPromoEvery ?? 12}
                onChange={(e) => setField('tgCatalogImdenPromoEvery', Number(e.target.value))}
                className={`ml-2 w-20 rounded-lg border px-2 py-1 ${input}`}
              />
            </label>
            <p className={`text-xs ${muted}`}>
              توكن البوت: {status?.channels?.find((c) => c.id === 'imden')?.tokenReady ? 'جاهز' : 'غير مضبوط على السيرفر'}
            </p>
          </div>
          <div className={`rounded-xl border p-3 space-y-2 ${dm ? 'border-gray-800' : 'border-slate-200'}`}>
            <label className="flex items-center gap-2 text-sm font-bold">
              <input
                type="checkbox"
                checked={Boolean(draft.tgCatalogEcomEnabled)}
                onChange={(e) => setField('tgCatalogEcomEnabled', e.target.checked)}
              />
              ECOM BJMLA
            </label>
            <input
              value={draft.tgCatalogEcomChatId || ''}
              onChange={(e) => setField('tgCatalogEcomChatId', e.target.value)}
              className={`w-full rounded-xl border px-3 py-2 text-sm ${input}`}
              dir="ltr"
              placeholder="-100…"
            />
            <label className={`text-xs ${muted}`}>
              رسالة الجملة كل
              <input
                type="number"
                min={0}
                max={100}
                value={draft.tgCatalogEcomPromoEvery ?? 8}
                onChange={(e) => setField('tgCatalogEcomPromoEvery', Number(e.target.value))}
                className={`ml-2 w-20 rounded-lg border px-2 py-1 ${input}`}
              />
            </label>
            <p className={`text-xs ${muted}`}>
              توكن البوت: {status?.channels?.find((c) => c.id === 'ecom')?.tokenReady ? 'جاهز' : 'غير مضبوط على السيرفر'}
            </p>
          </div>
        </div>
      </div>

      {status?.lastResult && (
        <div className={`rounded-2xl border p-5 ${card}`}>
          <h4 className="font-bold mb-2">نتيجة آخر محاولة</h4>
          <p className={`text-sm ${muted}`}>
            {status.lastResult.ok
              ? (status.lastResult.sku || 'تم')
              : (ERROR_AR[status.lastResult.error] || status.lastResult.error || '—')}
            {status.lastRunAt ? ` • ${formatWhen(status.lastRunAt)}` : ''}
          </p>
        </div>
      )}

      {Boolean(status?.logs?.length) && (
        <div className={`rounded-2xl border p-5 ${card}`}>
          <h4 className="font-bold mb-2">السجل</h4>
          <div className="space-y-1 text-xs font-mono" dir="ltr">
            {status.logs.slice(0, 12).map((row, i) => (
              <div key={`${row.at}-${i}`} className={muted}>
                {row.at} {row.ok ? 'ok' : 'fail'} {row.sku || row.error || ''}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
