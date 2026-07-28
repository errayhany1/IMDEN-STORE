import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, Search, Package, Phone, RotateCcw } from 'lucide-react';
import { fetchTifawtOrders, markTifawtReturn } from '../../services/adminApi';

const STATUS_FILTERS = [
  { id: 'all', label: 'الكل' },
  { id: 'DELIVERED', label: 'مسلم' },
  { id: 'SHIPPED', label: 'مشحون' },
  { id: 'PENDING_RETURN', label: 'مرتجع' },
  { id: 'PENDING', label: 'قيد التحضير' },
];

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('ar-MA', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return String(value);
  }
}

const TifawtOrdersTab = ({ dm }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [returnModal, setReturnModal] = useState(null);
  const [returnReason, setReturnReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchTifawtOrders({ search, status, limit: 80 });
      if (!data?.ok) throw new Error(data?.error || 'load_failed');
      setOrders(data.orders || []);
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.error || e.message || 'تعذر تحميل طلبات Tifawt');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    load();
  }, [load]);

  const confirmReturn = async () => {
    if (!returnModal) return;
    setBusyId(returnModal.id);
    try {
      const result = await markTifawtReturn(returnModal.id, returnReason);
      if (!result?.ok) throw new Error(result?.error || 'return_failed');
      setReturnModal(null);
      setReturnReason('');
      await load();
    } catch (e) {
      alert(e?.response?.data?.error || e.message || 'فشل تسجيل الإرجاع');
    } finally {
      setBusyId(null);
    }
  };

  const returnedCount = orders.filter((o) => o.isReturned).length;
  const deliverableCount = orders.filter((o) => o.canReturn).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className={`p-4 rounded-xl border ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
          <p className={`text-xs mb-1 ${dm ? 'text-gray-400' : 'text-slate-500'}`}>طلبات Tifawt</p>
          <p className="text-2xl font-bold">{orders.length}</p>
        </div>
        <div className={`p-4 rounded-xl border ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
          <p className={`text-xs mb-1 ${dm ? 'text-gray-400' : 'text-slate-500'}`}>قابل للإرجاع</p>
          <p className="text-2xl font-bold text-blue-500">{deliverableCount}</p>
        </div>
        <div className={`p-4 rounded-xl border ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
          <p className={`text-xs mb-1 ${dm ? 'text-gray-400' : 'text-slate-500'}`}>مرتجعات</p>
          <p className="text-2xl font-bold text-orange-500">{returnedCount}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={16} className={`absolute right-3 top-1/2 -translate-y-1/2 ${dm ? 'text-gray-500' : 'text-slate-400'}`} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            placeholder="بحث بالاسم / الهاتف / التتبع..."
            className={`w-full pr-9 pl-3 py-2.5 rounded-xl border text-sm outline-none ${dm ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-slate-200'}`}
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatus(f.id)}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap border ${
                status === f.id
                  ? 'bg-blue-100 text-blue-700 border-blue-200'
                  : dm ? 'bg-gray-900 border-gray-800 text-gray-400' : 'bg-white border-slate-200 text-slate-500'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={load}
          className={`px-3 py-2 rounded-xl border ${dm ? 'border-gray-800 text-gray-300' : 'border-slate-200 text-slate-600'}`}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm border border-red-100">{error}</div>
      )}

      <div className={`rounded-xl border overflow-hidden ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
        {loading ? (
          <div className="p-12 flex justify-center text-blue-500"><Loader2 className="animate-spin" size={36} /></div>
        ) : orders.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-500">لا توجد طلبات.</div>
        ) : (
          <div className="divide-y divide-gray-200/15">
            {orders.map((o) => (
              <div key={o.id} className="p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-sm">{o.customerName || 'بدون اسم'}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                      o.isReturned ? 'bg-orange-100 text-orange-700'
                        : o.status === 'DELIVERED' ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-600'
                    }`}>
                      {o.statusLabel}
                    </span>
                    {o.externalOrderId && (
                      <span className={`text-[10px] font-mono ${dm ? 'text-gray-500' : 'text-slate-400'}`}>
                        {o.externalOrderId}
                      </span>
                    )}
                  </div>
                  <p className={`text-xs flex items-center gap-1 ${dm ? 'text-gray-400' : 'text-slate-500'}`}>
                    <Phone size={12} /> {o.customerPhone || '—'}
                    <span className="mx-1">·</span>
                    #{o.id}
                    {o.trackingNumber ? ` · ${o.trackingNumber}` : ''}
                  </p>
                  <p className={`text-[11px] ${dm ? 'text-gray-500' : 'text-slate-400'}`}>
                    {formatDate(o.createdAt)} · {o.city || o.address || '—'}
                  </p>
                  {o.products?.length > 0 && (
                    <p className={`text-[11px] flex items-start gap-1 ${dm ? 'text-gray-500' : 'text-slate-400'}`}>
                      <Package size={12} className="mt-0.5 shrink-0" />
                      {o.products.map((p) => `${p.name} ×${p.quantity}`).join(' · ')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-bold text-green-500 text-sm">{o.total} DH</span>
                  {o.canReturn && (
                    <button
                      type="button"
                      disabled={busyId === o.id}
                      onClick={() => { setReturnModal(o); setReturnReason(''); }}
                      className="px-3 py-2 rounded-lg text-xs font-bold bg-orange-100 text-orange-700 border border-orange-200 hover:bg-orange-200 flex items-center gap-1"
                    >
                      <RotateCcw size={12} />
                      إرجاع
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {returnModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setReturnModal(null)}>
          <div
            className={`w-full max-w-md rounded-2xl p-5 space-y-4 ${dm ? 'bg-gray-900 text-white' : 'bg-white'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-lg">تسجيل إرجاع العميل</h3>
            <p className={`text-sm ${dm ? 'text-gray-400' : 'text-slate-500'}`}>
              الطلب #{returnModal.id} — {returnModal.customerName}
            </p>
            <textarea
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              rows={3}
              placeholder="سبب الإرجاع (اختياري)"
              className={`w-full rounded-xl border p-3 text-sm outline-none ${dm ? 'bg-gray-800 border-gray-700' : 'bg-slate-50 border-slate-200'}`}
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setReturnModal(null)} className="px-4 py-2 text-sm rounded-xl border">إلغاء</button>
              <button
                type="button"
                onClick={confirmReturn}
                disabled={busyId === returnModal.id}
                className="px-4 py-2 text-sm rounded-xl bg-orange-500 text-white font-bold"
              >
                تأكيد الإرجاع
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TifawtOrdersTab;
