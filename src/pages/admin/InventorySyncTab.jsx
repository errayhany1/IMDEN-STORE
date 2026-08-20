import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Download,
  Link2,
  Loader2,
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
      setError(e?.response?.data?.error || e.message || 'تعذر تحميل المطابقة');
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

  const tifawtOptions = useMemo(() => {
    const stocked = data?.tifawtStockedNotInNoco || [];
    const matched = data?.matchedOk || [];
    const map = new Map();
    [...stocked, ...matched].forEach((row) => {
      if (row.tifawtSku) map.set(row.tifawtSku, row.tifawtName || row.tifawtSku);
    });
    return [...map.entries()].map(([sku, name]) => ({ sku, name }));
  }, [data]);

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

        {loading ? (
          <div className="p-16 flex justify-center text-primary"><Loader2 className="animate-spin" size={32} /></div>
        ) : rows.length === 0 ? (
          <div className={`p-12 text-center text-sm ${muted}`}>لا توجد عناصر في هذه القائمة.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={dm ? 'bg-gray-950 text-gray-400' : 'bg-slate-50 text-slate-500'}>
                <tr>
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
                      <td className="p-3 font-mono text-xs">{row.nocoSku}</td>
                      <td className="p-3 max-w-[220px] truncate" title={row.nocoName}>{row.nocoName || '—'}</td>
                      <td className="p-3">
                        <input
                          list="tifawt-sku-options"
                          value={draft}
                          onChange={(e) => setLinkDraft((prev) => ({ ...prev, [row.nocoSku]: e.target.value }))}
                          placeholder="Tifawt SKU"
                          className={`w-full min-w-[140px] px-2 py-1.5 rounded-lg text-xs border ${dm ? 'bg-gray-950 border-gray-800' : 'border-slate-200'}`}
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
                    <td className="p-3 font-mono text-xs">{row.tifawtSku}</td>
                    <td className="p-3 max-w-[260px] truncate" title={row.tifawtName}>{row.tifawtName}</td>
                    <td className="p-3 font-bold text-emerald-600">{row.tifawtStock}</td>
                    <td className="p-3 font-mono text-xs text-blue-600">{row.suggestedNocoSku}</td>
                  </tr>
                ))}

                {tab === 'matched' && rows.map((row) => (
                  <tr key={`${row.tifawtSku}-${row.nocoId}`} className={`border-t ${dm ? 'border-gray-800' : 'border-slate-100'}`}>
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

      <datalist id="tifawt-sku-options">
        {tifawtOptions.map((opt) => (
          <option key={opt.sku} value={opt.sku}>{opt.name}</option>
        ))}
      </datalist>

      <p className={`text-xs ${muted}`}>
        الربط يُحفظ في «مركز تحكم البوت → تيفاوت → مطابقة مراجع الموقع» ويُستخدم لطلبات Tifawt/Jumia.
        الملفات الثابتة: <code>docs/inventory/tifawt-stocked-not-in-nocodb.csv</code> و
        <code>docs/inventory/noco-postebl-unlinked-tifawt.csv</code>
      </p>
    </div>
  );
};

export default InventorySyncTab;
