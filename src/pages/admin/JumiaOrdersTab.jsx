import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, Package, Truck, XCircle } from 'lucide-react';
import { fetchJumiaAdminOrders, jumiaAdminShip, jumiaAdminCancel } from '../../services/adminApi';

const JumiaOrdersTab = ({ dm }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchJumiaAdminOrders();
      if (!data?.ok) throw new Error(data?.error || 'load_failed');
      setOrders(data.orders || []);
    } catch (e) {
      const payload = e?.response?.data;
      const msg = payload?.hint
        || (payload?.error === 'jumia_token_expired'
          ? 'توكن Jumia منتهٍ — حدّث JUMIA_REFRESH_TOKEN على خدمة imden'
          : null)
        || payload?.error
        || e.message
        || 'تعذر تحميل طلبات Jumia';
      setError(msg);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const run = async (orderId, action) => {
    const id = String(orderId || '').replace(/^JUMIA[-_]/i, '');
    setBusyId(id);
    try {
      const result = action === 'ship'
        ? await jumiaAdminShip(id)
        : await jumiaAdminCancel(id);
      if (result?.ok === false) throw new Error(result.error || 'failed');
      alert(action === 'ship' ? `تم تجهيز شحن ${id}` : `تم إلغاء ${id}`);
      await load();
    } catch (e) {
      alert(e?.response?.data?.error || e.message || 'فشل الأمر');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-bold">طلبات Jumia (آخر 7 أيام)</h3>
          <p className={`text-xs mt-0.5 ${dm ? 'text-gray-400' : 'text-slate-500'}`}>
            تُزامن تلقائياً إلى Tifawt — يمكنك تجهيز الشحن أو الإلغاء من هنا
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className={`p-2 rounded-xl border ${dm ? 'border-gray-800' : 'border-slate-200'}`}
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
          <div className="p-10 text-center text-sm text-gray-500">لا توجد طلبات Jumia حديثة.</div>
        ) : (
          <div className="divide-y divide-gray-200/15">
            {orders.map((o) => {
              const id = String(o.orderId || '').replace(/^JUMIA[-_]/i, '');
              return (
                <div key={o.orderId} className="p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="font-bold text-sm">{o.name || 'بدون اسم'} <span className="text-[10px] font-mono text-orange-500">{o.orderId}</span></p>
                    <p className={`text-xs ${dm ? 'text-gray-400' : 'text-slate-500'}`}>{o.phone || '—'} · {o.city || o.address || '—'}</p>
                    {o.items?.length > 0 && (
                      <p className={`text-[11px] flex gap-1 ${dm ? 'text-gray-500' : 'text-slate-400'}`}>
                        <Package size={12} className="mt-0.5 shrink-0" />
                        {o.items.map((i) => `${i.sku} ×${i.quantity}`).join(' · ')}
                      </p>
                    )}
                    {o.error && <p className="text-xs text-red-500">{o.error}</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={busyId === id}
                      onClick={() => run(id, 'ship')}
                      className="px-3 py-2 rounded-lg text-xs font-bold bg-green-100 text-green-700 border border-green-200 flex items-center gap-1"
                    >
                      <Truck size={12} /> تجهيز شحن
                    </button>
                    <button
                      type="button"
                      disabled={busyId === id}
                      onClick={() => {
                        if (window.confirm(`إلغاء طلب Jumia ${id}؟`)) run(id, 'cancel');
                      }}
                      className="px-3 py-2 rounded-lg text-xs font-bold bg-red-100 text-red-700 border border-red-200 flex items-center gap-1"
                    >
                      <XCircle size={12} /> إلغاء
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default JumiaOrdersTab;
