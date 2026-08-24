import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Download,
  Link2,
  Loader2,
  Package,
  PauseCircle,
  RefreshCw,
  Search,
  Unlink,
} from 'lucide-react';
import {
  downloadInventoryExport,
  fetchInventoryReconcile,
  linkInventorySku,
  setInventoryNocoStatus,
  unlinkInventorySku,
} from '../../services/adminApi';

const TABS = [
  { id: 'unlinked', label: 'غير مربوط', key: 'nocoPosteblUnlinked' },
  { id: 'tifawt-only', label: 'في Tifawt فقط', key: 'tifawtStockedNotInNoco' },
  { id: 'matched', label: 'مربوط', key: 'matchedOk' },
];

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 60;

function messageFor(payload, fallback = 'تعذر تحميل المطابقة') {
  const code = payload?.error || '';
  if (code === 'unauthorized') return 'انتهت صلاحية الدخول. سجّل الخروج ثم ادخل من جديد.';
  if (code === 'tifawt_unauthorized') return payload?.hint || 'Tifawt رفض تسجيل الدخول.';
  if (code === 'rate_limited' || code === 'too_many_attempts' || /nocodb_http_429/i.test(code)) {
    return 'طلبات كثيرة جداً على NocoDB. انتظر دقيقة ثم أعد المحاولة.';
  }
  if (code === 'tifawt_product_not_found') return 'لم يُعثر على المنتج في Tifawt.';
  if (code === 'noco_product_not_found') return 'لم يُعثر على صف المنتج في NocoDB.';
  return payload?.hint || code || fallback;
}

function errorFrom(e) {
  const status = e?.response?.status;
  if (status === 429) {
    return messageFor(e.response?.data, 'طلبات كثيرة جداً (NocoDB/الخادم). انتظر دقيقة ثم حدّث الصفحة.');
  }
  if (e?.response?.data) return messageFor(e.response.data);
  if (/status code 429/i.test(e?.message || '')) {
    return 'طلبات كثيرة جداً. انتظر دقيقة ثم أعد المحاولة.';
  }
  return e?.message || 'تعذر الاتصال بالخادم';
}

function Thumb({ src, alt, size = 44, dm }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  if (!src || failed) {
    return (
      <div
        className={`shrink-0 rounded-lg border flex items-center justify-center ${dm ? 'bg-gray-800 border-gray-700' : 'bg-slate-100 border-slate-200'}`}
        style={{ width: size, height: size }}
      >
        <Package size={Math.round(size * 0.4)} className={dm ? 'text-gray-600' : 'text-slate-300'} />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt || ''}
      loading="lazy"
      onError={() => setFailed(true)}
      className="shrink-0 rounded-lg border object-contain"
      style={{ width: size, height: size }}
    />
  );
}

function SkuPicker({ value, onChange, options, dm, disabled }) {
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [needle, setNeedle] = useState(value || '');

  useEffect(() => { setNeedle(value || ''); }, [value]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const filtered = useMemo(() => {
    const q = needle.trim().toLowerCase();
    if (!q) return options.slice(0, 40);
    return options.filter((opt) => (
      String(opt.tifawtSku || '').toLowerCase().includes(q)
      || String(opt.tifawtName || '').toLowerCase().includes(q)
    )).slice(0, 40);
  }, [needle, options]);

  const selected = options.find((o) => o.tifawtSku === value);

  return (
    <div ref={wrapRef} className="relative min-w-[200px]">
      <div className="flex items-center gap-2">
        {selected?.tifawtImage && <Thumb src={selected.tifawtImage} alt={selected.tifawtSku} size={36} dm={dm} />}
        <input
          value={needle}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setNeedle(e.target.value);
            onChange(e.target.value);
            setOpen(true);
          }}
          placeholder="SKU أو اسم Tifawt"
          className={`flex-1 px-2 py-1.5 rounded-lg text-xs border ${dm ? 'bg-gray-950 border-gray-800' : 'border-slate-200 bg-white'}`}
        />
      </div>
      {open && filtered.length > 0 && (
        <div className={`absolute z-30 mt-1 w-full max-h-72 overflow-y-auto rounded-xl border shadow-xl ${dm ? 'bg-gray-900 border-gray-700' : 'bg-white border-slate-200'}`}>
          {filtered.map((opt) => (
            <button
              key={opt.tifawtSku}
              type="button"
              onClick={() => {
                onChange(opt.tifawtSku);
                setNeedle(opt.tifawtSku);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-2 py-2 text-right border-b last:border-b-0 ${dm ? 'border-gray-800 hover:bg-gray-800' : 'border-slate-100 hover:bg-slate-50'}`}
            >
              <Thumb src={opt.tifawtImage} alt={opt.tifawtSku} size={40} dm={dm} />
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[11px] font-bold truncate">{opt.tifawtSku}</div>
                <div className={`text-[11px] truncate ${dm ? 'text-gray-400' : 'text-slate-500'}`}>{opt.tifawtName}</div>
              </div>
              <div className="text-[11px] font-bold text-emerald-600 shrink-0">×{opt.tifawtStock}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const InventorySyncTab = ({ dm }) => {
  const [data, setData] = useState(null);
  const [phase, setPhase] = useState('loading');
  const [error, setError] = useState('');
  const [tab, setTab] = useState('unlinked');
  const [query, setQuery] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [linkDraft, setLinkDraft] = useState({});

  const aliveRef = useRef(true);
  const timerRef = useRef(null);

  useEffect(() => () => {
    aliveRef.current = false;
    clearTimeout(timerRef.current);
  }, []);

  // The server builds the report in the background, so one request can answer
  // `loading`. Poll until it flips to ready instead of holding a long request
  // open behind the proxy.
  const load = useCallback(async ({ force = false } = {}) => {
    clearTimeout(timerRef.current);
    setError('');
    setPhase('loading');

    let attempt = 0;
    const step = async (useForce) => {
      if (!aliveRef.current) return;
      try {
        const payload = await fetchInventoryReconcile({ force: useForce });

        if (payload?.status === 'loading') {
          attempt += 1;
          if (attempt > POLL_MAX_ATTEMPTS) {
            setPhase('error');
            setError('استغرقت المطابقة وقتاً طويلاً. اضغط تحديث للمحاولة مرة أخرى.');
            return;
          }
          timerRef.current = setTimeout(() => step(false), POLL_INTERVAL_MS);
          return;
        }

        if (payload?.ok === false || payload?.status === 'error') {
          setPhase('error');
          setError(messageFor(payload));
          return;
        }

        setData(payload);
        setPhase('ready');
      } catch (e) {
        if (!aliveRef.current) return;
        setPhase('error');
        setError(errorFrom(e));
      }
    };

    await step(force);
  }, []);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    const active = TABS.find((t) => t.id === tab);
    const list = data?.[active?.key] || [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((row) => JSON.stringify(row).toLowerCase().includes(q));
  }, [data, tab, query]);

  const picker = data?.tifawtPicker || [];

  const run = async (key, fn) => {
    setBusyKey(key);
    try {
      await fn();
      // Give NocoDB a breath after the write, then rebuild the report.
      await new Promise((r) => setTimeout(r, 1200));
      await load({ force: true });
    } catch (e) {
      alert(errorFrom(e));
    } finally {
      setBusyKey('');
    }
  };

  const exportCsv = (kind) => {
    downloadInventoryExport(kind).catch((e) => alert(errorFrom(e)));
  };

  const card = dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200';
  const muted = dm ? 'text-gray-400' : 'text-slate-500';
  const busy = phase === 'loading';

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border p-4 ${card}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-lg">مطابقة مخزون Tifawt ↔ الموقع</h3>
            <p className={`text-sm mt-1 ${muted}`}>
              اربط مرجع الموقع بمرجع Tifawt، أو أوقف المنتج على الموقع دون حذفه.
            </p>
            {data?.generatedAt && (
              <p className={`text-xs mt-1 ${muted}`}>
                آخر تحديث: {new Date(data.generatedAt).toLocaleTimeString('ar-MA')}
                {data.stale ? ' • يتم التحديث الآن...' : ''}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => exportCsv('noco-unlinked')}
              disabled={!data}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-emerald-500/40 text-emerald-600 disabled:opacity-40"
            >
              <Download size={14} />
              CSV غير المربوط
            </button>
            <button
              type="button"
              onClick={() => exportCsv('tifawt-not-noco')}
              disabled={!data}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-blue-500/40 text-blue-600 disabled:opacity-40"
            >
              <Download size={14} />
              CSV Tifawt فقط
            </button>
            <button
              type="button"
              onClick={() => load({ force: true })}
              disabled={busy}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border disabled:opacity-50 ${dm ? 'border-gray-700' : 'border-slate-200'}`}
            >
              <RefreshCw size={14} className={busy ? 'animate-spin' : ''} />
              تحديث
            </button>
          </div>
        </div>

        {data?.totals && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
            {[
              ['مربوط', data.totals.matchedOk, 'text-emerald-600'],
              ['غير مربوط', data.totals.nocoPosteblUnlinked, 'text-amber-600'],
              ['Tifawt فقط', data.totals.tifawtStockedNotInNoco, 'text-blue-600'],
              ['مخزون Tifawt', data.totals.tifawtInStock, muted],
            ].map(([label, value, color]) => (
              <div key={label} className={`rounded-xl border px-3 py-2 ${dm ? 'border-gray-800 bg-gray-950/40' : 'border-slate-100 bg-slate-50'}`}>
                <div className={`text-xs ${muted}`}>{label}</div>
                <div className={`text-xl font-black ${color}`}>{value ?? 0}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm border border-red-100 flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div className="flex-1">
            <div>{error}</div>
            <button
              type="button"
              onClick={() => load({ force: true })}
              className="mt-2 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold"
            >
              إعادة المحاولة
            </button>
          </div>
        </div>
      )}

      <div className={`rounded-2xl border overflow-hidden ${card}`}>
        <div className={`flex flex-wrap items-center gap-2 p-3 border-b ${dm ? 'border-gray-800' : 'border-slate-100'}`}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                tab === t.id
                  ? 'bg-primary text-white'
                  : dm ? 'bg-gray-800 text-gray-300' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {t.label}
              {data?.totals ? ` (${data.totals[t.key] ?? 0})` : ''}
            </button>
          ))}
          <div className="relative mr-auto min-w-[180px] flex-1 max-w-xs">
            <Search size={14} className={`absolute right-3 top-1/2 -translate-y-1/2 ${muted}`} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="بحث SKU أو اسم..."
              className={`w-full pr-9 pl-3 py-2 rounded-xl text-sm border ${dm ? 'bg-gray-950 border-gray-800' : 'bg-white border-slate-200'}`}
            />
          </div>
        </div>

        {busy && !data ? (
          <div className="p-16 flex flex-col items-center gap-2 text-primary">
            <Loader2 className="animate-spin" size={32} />
            <span className={`text-xs ${muted}`}>جاري مطابقة المخزون مع Tifawt...</span>
          </div>
        ) : rows.length === 0 ? (
          <div className={`p-12 text-center text-sm ${muted}`}>
            {data ? 'لا توجد عناصر في هذه القائمة.' : 'لا توجد بيانات بعد.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={dm ? 'bg-gray-950 text-gray-400' : 'bg-slate-50 text-slate-500'}>
                <tr>
                  <th className="p-3 w-14 text-right">صورة</th>
                  {tab === 'unlinked' && (
                    <>
                      <th className="p-3 text-right">مرجع الموقع</th>
                      <th className="p-3 text-right">الاسم</th>
                      <th className="p-3 text-right">مرجع Tifawt</th>
                      <th className="p-3 text-right">إجراء</th>
                    </>
                  )}
                  {tab === 'tifawt-only' && (
                    <>
                      <th className="p-3 text-right">Tifawt SKU</th>
                      <th className="p-3 text-right">الاسم</th>
                      <th className="p-3 text-right">مخزون</th>
                      <th className="p-3 text-right">اقتراح الموقع</th>
                    </>
                  )}
                  {tab === 'matched' && (
                    <>
                      <th className="p-3 text-right">Tifawt</th>
                      <th className="p-3 text-right">الموقع</th>
                      <th className="p-3 text-right">مخزون</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {tab === 'unlinked' && rows.map((row) => {
                  const key = `u-${row.nocoId}`;
                  const draft = linkDraft[row.nocoSku] || '';
                  return (
                    <tr key={key} className={`border-t ${dm ? 'border-gray-800' : 'border-slate-100'}`}>
                      <td className="p-3"><Thumb src={row.nocoImage} alt={row.nocoSku} dm={dm} /></td>
                      <td className="p-3 font-mono text-xs">{row.nocoSku}</td>
                      <td className="p-3 max-w-[220px] truncate" title={row.nocoName}>{row.nocoName || '—'}</td>
                      <td className="p-3">
                        <SkuPicker
                          value={draft}
                          options={picker}
                          dm={dm}
                          disabled={busyKey === key}
                          onChange={(sku) => setLinkDraft((prev) => ({ ...prev, [row.nocoSku]: sku }))}
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            disabled={!draft.trim() || busyKey === key}
                            onClick={() => run(key, () => linkInventorySku({
                              nocoSku: row.nocoSku,
                              nocoId: row.nocoId,
                              tifawtSku: draft.trim(),
                            }))}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-40"
                          >
                            <Link2 size={12} />
                            ربط
                          </button>
                          <button
                            type="button"
                            disabled={busyKey === `${key}-stop`}
                            onClick={() => run(`${key}-stop`, () => setInventoryNocoStatus({ nocoId: row.nocoId, postebl: 'NO POSTEBL' }))}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold"
                          >
                            <PauseCircle size={12} />
                            إيقاف
                          </button>
                          {row.aliasHint && (
                            <button
                              type="button"
                              disabled={busyKey === `${key}-unlink`}
                              onClick={() => run(`${key}-unlink`, () => unlinkInventorySku({ nocoSku: row.nocoSku }))}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold"
                            >
                              <Unlink size={12} />
                              فك
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {tab === 'tifawt-only' && rows.map((row) => (
                  <tr key={row.tifawtSku} className={`border-t ${dm ? 'border-gray-800' : 'border-slate-100'}`}>
                    <td className="p-3"><Thumb src={row.tifawtImage} alt={row.tifawtSku} dm={dm} /></td>
                    <td className="p-3 font-mono text-xs">{row.tifawtSku}</td>
                    <td className="p-3 max-w-[260px] truncate" title={row.tifawtName}>{row.tifawtName}</td>
                    <td className="p-3 font-bold text-emerald-600">{row.tifawtStock}</td>
                    <td className="p-3 font-mono text-xs text-blue-600">{row.suggestedNocoSku}</td>
                  </tr>
                ))}

                {tab === 'matched' && rows.map((row) => (
                  <tr key={`${row.tifawtSku}-${row.nocoId}`} className={`border-t ${dm ? 'border-gray-800' : 'border-slate-100'}`}>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Thumb src={row.tifawtImage} alt={row.tifawtSku} size={36} dm={dm} />
                        <Thumb src={row.nocoImage} alt={row.nocoSku} size={36} dm={dm} />
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-mono text-xs">{row.tifawtSku}</div>
                      <div className={`text-xs truncate max-w-[200px] ${muted}`}>{row.tifawtName}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-mono text-xs">{row.nocoSku}</div>
                      <div className={`text-xs truncate max-w-[200px] ${muted}`}>{row.nocoName}</div>
                    </td>
                    <td className="p-3 font-bold">{row.tifawtStock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default InventorySyncTab;
