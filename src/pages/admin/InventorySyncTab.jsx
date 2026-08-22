import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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
  fetchInventoryReconcile,
  inventoryExportUrl,
  linkInventorySku,
  setInventoryNocoStatus,
  unlinkInventorySku,
} from '../../services/adminApi';

const TABS = [
  { id: 'unlinked', label: 'POSTEBL غير مربوط', key: 'nocoPosteblUnlinked' },
  { id: 'tifawt-only', label: 'Tifawt بدون NocoDB', key: 'tifawtStockedNotInNoco' },
  { id: 'matched', label: 'مطابق', key: 'matchedOk' },
];

function ProductThumb({ src, alt, size = 44, dm }) {
  const [failed, setFailed] = useState(false);
  const box = `w-[${size}px] h-[${size}px]`;
  const cls = `shrink-0 rounded-lg border overflow-hidden flex items-center justify-center ${dm ? 'bg-gray-800 border-gray-700' : 'bg-slate-100 border-slate-200'}`;
  if (!src || failed) {
    return (
      <div className={cls} style={{ width: size, height: size }}>
        <Package size={Math.round(size * 0.4)} className={dm ? 'text-gray-600' : 'text-slate-300'} />
      </div>
    );
  }
  return (
    <div className={cls} style={{ width: size, height: size }}>
      <img
        src={src}
        alt={alt || ''}
        loading="lazy"
        onError={() => setFailed(true)}
        className={`${box} object-contain`}
        style={{ width: size, height: size }}
      />
    </div>
  );
}

function rowImage(row, tab) {
  if (tab === 'unlinked') return row.nocoImage;
  if (tab === 'tifawt-only') return row.tifawtImage;
  return row.nocoImage || row.tifawtImage;
}

function TifawtSkuPicker({ value, onChange, options, dm, disabled }) {
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [needle, setNeedle] = useState(value || '');

  useEffect(() => { setNeedle(value || ''); }, [value]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, [open]);

  const filtered = useMemo(() => {
    const q = needle.trim().toLowerCase();
    const list = options || [];
    if (!q) return list.slice(0, 40);
    return list.filter((opt) => (
      String(opt.tifawtSku || '').toLowerCase().includes(q)
      || String(opt.tifawtName || '').toLowerCase().includes(q)
    )).slice(0, 40);
  }, [needle, options]);

  const selected = options?.find((o) => o.tifawtSku === value);

  return (
    <div ref={wrapRef} className="relative min-w-[200px]">
      <div className="flex items-center gap-2">
        {selected?.tifawtImage && <ProductThumb src={selected.tifawtImage} alt={selected.tifawtSku} size={36} dm={dm} />}
        <input
          value={needle}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setNeedle(e.target.value);
            onChange(e.target.value);
            setOpen(true);
          }}
          placeholder="ابحث SKU أو اسم Tifawt..."
          className={`flex-1 px-2 py-1.5 rounded-lg text-xs border ${dm ? 'bg-gray-950 border-gray-800' : 'border-slate-200 bg-white'}`}
        />
      </div>
      {open && filtered.length > 0 && (
        <div
          className={`absolute z-30 mt-1 w-full max-h-72 overflow-y-auto rounded-xl border shadow-xl ${dm ? 'bg-gray-900 border-gray-700' : 'bg-white border-slate-200'}`}
        >
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
              <ProductThumb src={opt.tifawtImage} alt={opt.tifawtSku} size={40} dm={dm} />
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('unlinked');
  const [query, setQuery] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [linkDraft, setLinkDraft] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await fetchInventoryReconcile();
      if (!result?.ok) throw new Error(result?.error || 'load_failed');
      setData(result);
    } catch (e) {
      const apiError = e?.response?.data;
      const code = apiError?.error || '';
      setError(
        code === 'unauthorized'
          ? 'انتهت جلسة الأدمن — سجّل الخروج من اللوحة ثم ادخل من جديد.'
          : (apiError?.hint
            || apiError?.error
            || e.message
            || 'تعذر تحميل المطابقة'),
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    const active = TABS.find((t) => t.id === tab);
    const list = data?.[active?.key] || [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((row) => JSON.stringify(row).toLowerCase().includes(q));
  }, [data, tab, query]);

  const tifawtPicker = useMemo(() => data?.tifawtPicker || [], [data]);

  const run = async (key, fn) => {
    setBusyKey(key);
    try {
      await fn();
      await load();
    } catch (e) {
      alert(e?.response?.data?.error || e.message || 'فشلت العملية');
    } finally {
      setBusyKey('');
    }
  };

  const card = dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200';
  const muted = dm ? 'text-gray-400' : 'text-slate-500';

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border p-4 ${card}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-lg">مطابقة مخزون Tifawt ↔ NocoDB</h3>
            <p className={`text-sm mt-1 ${muted}`}>
              اربط مرجع الموقع بمرجع Tifawt (alias) أو أوقف المنتج على الموقع دون حذفه من NocoDB.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={inventoryExportUrl('noco-unlinked')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-emerald-500/40 text-emerald-600"
            >
              <Download size={14} />
              POSTEBL غير مربوط
            </a>
            <a
              href={inventoryExportUrl('tifawt-not-noco')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-blue-500/40 text-blue-600"
            >
              <Download size={14} />
              Tifawt بدون NocoDB
            </a>
            <button
              type="button"
              onClick={load}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border ${dm ? 'border-gray-700' : 'border-slate-200'}`}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              تحديث
            </button>
          </div>
        </div>

        {data?.totals && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
            {[
              ['مطابق', data.totals.matchedOk, 'text-emerald-600'],
              ['POSTEBL غير مربوط', data.totals.nocoPosteblUnlinked, 'text-amber-600'],
              ['Tifawt بدون NocoDB', data.totals.tifawtStockedNotInNoco, 'text-blue-600'],
              ['Tifawt بمخزون', data.totals.tifawtInStock, muted],
            ].map(([label, value, color]) => (
              <div key={label} className={`rounded-xl border px-3 py-2 ${dm ? 'border-gray-800 bg-gray-950/40' : 'border-slate-100 bg-slate-50'}`}>
                <div className={`text-xs ${muted}`}>{label}</div>
                <div className={`text-xl font-black ${color}`}>{value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm border border-red-100">{error}</div>
      )}

      <div className={`rounded-2xl border overflow-hidden ${card}`}>
        <div className={`flex flex-wrap items-center gap-2 p-3 border-b ${dm ? 'border-gray-800' : 'border-slate-100'}`}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors
                ${tab === t.id
                  ? 'bg-primary text-white'
                  : dm ? 'bg-gray-800 text-gray-300' : 'bg-slate-100 text-slate-600'
                }`}
            >
              {t.label}
              {data?.totals && (
                <span className="opacity-80 mr-1">
                  ({data.totals[t.key] ?? 0})
                </span>
              )}
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

        {query.trim() && rows.length > 0 && (
          <div className={`flex gap-2 p-3 overflow-x-auto border-b ${dm ? 'border-gray-800 bg-gray-950/30' : 'border-slate-100 bg-slate-50/80'}`}>
            {rows.slice(0, 24).map((row, i) => {
              const img = rowImage(row, tab);
              const label = row.nocoSku || row.tifawtSku || `#${i + 1}`;
              return (
                <div key={`${label}-${i}`} className="shrink-0 w-16 text-center">
                  <ProductThumb src={img} alt={label} size={56} dm={dm} />
                  <div className={`mt-1 text-[9px] font-mono truncate ${muted}`} title={label}>{label}</div>
                </div>
              );
            })}
          </div>
        )}

        {loading ? (
          <div className="p-16 flex justify-center text-primary"><Loader2 className="animate-spin" size={32} /></div>
        ) : rows.length === 0 ? (
          <div className={`p-12 text-center text-sm ${muted}`}>لا توجد عناصر في هذه القائمة.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={dm ? 'bg-gray-950 text-gray-400' : 'bg-slate-50 text-slate-500'}>
                <tr>
                  <th className="p-3 w-14 text-right">صورة</th>
                  {tab === 'unlinked' && (
                    <>
                      <th className="p-3 text-right">NocoDB SKU</th>
                      <th className="p-3 text-right">الاسم</th>
                      <th className="p-3 text-right">ربط بـ Tifawt</th>
                      <th className="p-3 text-right">إجراء</th>
                    </>
                  )}
                  {tab === 'tifawt-only' && (
                    <>
                      <th className="p-3 text-right">Tifawt SKU</th>
                      <th className="p-3 text-right">الاسم</th>
                      <th className="p-3 text-right">مخزون</th>
                      <th className="p-3 text-right">SKU مقترح</th>
                    </>
                  )}
                  {tab === 'matched' && (
                    <>
                      <th className="p-3 text-right">Tifawt</th>
                      <th className="p-3 text-right">NocoDB</th>
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
                      <td className="p-3">
                        <ProductThumb src={row.nocoImage} alt={row.nocoSku} dm={dm} />
                      </td>
                      <td className="p-3 font-mono text-xs">{row.nocoSku}</td>
                      <td className="p-3 max-w-[220px] truncate" title={row.nocoName}>{row.nocoName || '—'}</td>
                      <td className="p-3">
                        <TifawtSkuPicker
                          value={draft}
                          options={tifawtPicker}
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
                            onClick={() => run(key, () => linkInventorySku({ nocoSku: row.nocoSku, tifawtSku: draft.trim() }))}
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
                    <td className="p-3">
                      <ProductThumb src={row.tifawtImage} alt={row.tifawtSku} dm={dm} />
                    </td>
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
                        <ProductThumb src={row.tifawtImage} alt={row.tifawtSku} size={36} dm={dm} />
                        <ProductThumb src={row.nocoImage} alt={row.nocoSku} size={36} dm={dm} />
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

      <p className={`text-xs ${muted}`}>
        الربط يُحفظ في «مركز تحكم البوت → تيفاوت → مطابقة مراجع الموقع» ويُستخدم لطلبات Tifawt/Jumia.
      </p>
    </div>
  );
};

export default InventorySyncTab;
