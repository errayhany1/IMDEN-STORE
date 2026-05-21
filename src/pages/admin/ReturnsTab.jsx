import React, { useState } from 'react';
import { RefreshCcw, Search, AlertTriangle, Check, Package, ArrowRight, X } from 'lucide-react';

const ReturnsTab = ({ dm, orders, onUpdateStatus }) => {
    const [search, setSearch] = useState('');
    const [returnModal, setReturnModal] = useState(null);
    const [returnReason, setReturnReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Orders that are returned (status = "مرتجع" or Notes contain "مرتجع")
    const returnedOrders = orders.filter(o =>
        o.Status === 'مرتجع' || o.Status === 'Returned' || (o.Notes || '').includes('مرتجع')
    );

    // Shipped orders eligible for return
    const shippedOrders = orders.filter(o =>
        (o.Status === 'تم الشحن' || o.Status === 'Shipped' || o.Status === 'Delivered') &&
        !returnedOrders.some(r => r.Id === o.Id)
    );

    const totalReturned = returnedOrders.reduce((s, o) => s + (Number(o['Sale Price']) || 0), 0);

    const filteredShipped = shippedOrders.filter(o => {
        const q = search.toLowerCase();
        return (o['Customer Name'] || '').toLowerCase().includes(q) ||
            (o['Customer Phone'] || '').includes(q) ||
            String(o.Id).includes(q);
    });

    const handleReturn = async () => {
        if (!returnModal) return;
        setSubmitting(true);
        try {
            await onUpdateStatus(returnModal.Id, 'مرتجع', returnReason ? `مرتجع: ${returnReason}` : 'مرتجع');
            setReturnModal(null);
            setReturnReason('');
        } catch (e) {
            console.error(e);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-5">
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className={`p-4 rounded-xl border ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <RefreshCcw size={16} className="text-orange-500" />
                        <span className={`text-xs ${dm ? 'text-gray-400' : 'text-slate-500'}`}>إجمالي المرتجعات</span>
                    </div>
                    <p className="text-2xl font-bold text-orange-500">{returnedOrders.length}</p>
                </div>
                <div className={`p-4 rounded-xl border ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle size={16} className="text-red-500" />
                        <span className={`text-xs ${dm ? 'text-gray-400' : 'text-slate-500'}`}>قيمة المرتجعات</span>
                    </div>
                    <p className="text-2xl font-bold text-red-500">{totalReturned.toFixed(0)} DH</p>
                </div>
                <div className={`p-4 rounded-xl border ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <Package size={16} className="text-blue-500" />
                        <span className={`text-xs ${dm ? 'text-gray-400' : 'text-slate-500'}`}>نسبة الإرجاع</span>
                    </div>
                    <p className="text-2xl font-bold">{orders.length > 0 ? ((returnedOrders.length / orders.length) * 100).toFixed(1) : 0}%</p>
                </div>
            </div>

            {/* Register Return */}
            <div className={`rounded-xl border overflow-hidden ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                <div className={`px-4 py-3 border-b flex items-center gap-2 ${dm ? 'border-gray-800' : 'border-slate-100'}`}>
                    <RefreshCcw size={16} className="text-orange-500" />
                    <h3 className="text-sm font-bold">تسجيل مرتجع جديد</h3>
                </div>
                <div className="p-4 space-y-3">
                    <div className="relative">
                        <Search size={16} className={`absolute top-3 right-3 ${dm ? 'text-gray-500' : 'text-slate-400'}`} />
                        <input type="text" placeholder="ابحث عن طلب تم شحنه..." value={search}
                            onChange={e => setSearch(e.target.value)}
                            className={`w-full pr-10 pl-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-orange-500 ${dm ? 'bg-gray-800 border-gray-700 text-white' : 'bg-slate-50 border-slate-200'}`} />
                    </div>

                    {search && (
                        <div className={`max-h-64 overflow-y-auto rounded-xl border divide-y ${dm ? 'border-gray-700 divide-gray-800' : 'border-slate-200 divide-slate-100'}`}>
                            {filteredShipped.slice(0, 15).map(o => (
                                <div key={o.Id} className={`px-3 py-2.5 flex items-center gap-3 ${dm ? 'hover:bg-gray-800' : 'hover:bg-slate-50'}`}>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium">#{o.Id} — {o['Customer Name'] || 'بدون اسم'}</p>
                                        <p className={`text-xs ${dm ? 'text-gray-500' : 'text-slate-400'}`}>
                                            {o['Sale Price'] || 0} DH • {o.CreatedAt ? new Date(o.CreatedAt).toLocaleDateString('ar-MA') : ''}
                                        </p>
                                    </div>
                                    <button onClick={() => setReturnModal(o)}
                                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 transition flex items-center gap-1">
                                        <RefreshCcw size={12} /> إرجاع
                                    </button>
                                </div>
                            ))}
                            {filteredShipped.length === 0 && <div className="p-3 text-center text-sm text-gray-500">لا توجد طلبات مشحونة</div>}
                        </div>
                    )}
                </div>
            </div>

            {/* Returned Orders List */}
            <div className={`rounded-xl border overflow-hidden ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                <div className={`px-4 py-3 border-b ${dm ? 'border-gray-800' : 'border-slate-100'}`}>
                    <h3 className="text-sm font-bold">سجل المرتجعات</h3>
                </div>
                {returnedOrders.length === 0 ? (
                    <div className="p-8 text-center text-sm text-gray-500">لا توجد مرتجعات بعد</div>
                ) : (
                    <div className={`divide-y ${dm ? 'divide-gray-800' : 'divide-slate-50'}`}>
                        {returnedOrders.map(o => (
                            <div key={o.Id} className="px-4 py-3 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                                    <RefreshCcw size={14} className="text-orange-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold truncate">#{o.Id} — {o['Customer Name'] || 'بدون اسم'}</p>
                                    <p className={`text-xs ${dm ? 'text-gray-500' : 'text-slate-400'}`}>
                                        {o.Notes || ''} • {o.CreatedAt ? new Date(o.CreatedAt).toLocaleDateString('ar-MA') : ''}
                                    </p>
                                </div>
                                <span className="text-sm font-bold text-red-500 shrink-0">{o['Sale Price'] || 0} DH</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Return Confirmation Modal */}
            {returnModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setReturnModal(null)} />
                    <div className={`relative rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4 ${dm ? 'bg-gray-800 text-white' : 'bg-white text-slate-900'}`}>
                        <div className="text-center">
                            <div className="w-16 h-16 mx-auto rounded-2xl bg-orange-500/10 flex items-center justify-center mb-3">
                                <RefreshCcw size={28} className="text-orange-500" />
                            </div>
                            <h3 className="text-lg font-bold">إرجاع الطلب #{returnModal.Id}</h3>
                            <p className={`text-sm mt-1 ${dm ? 'text-gray-400' : 'text-slate-500'}`}>
                                {returnModal['Customer Name']} — {returnModal['Sale Price']} DH
                            </p>
                        </div>
                        <textarea placeholder="سبب الإرجاع (اختياري)..." value={returnReason}
                            onChange={e => setReturnReason(e.target.value)} rows={2}
                            className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none resize-none ${dm ? 'bg-gray-700 border-gray-600 text-white' : 'bg-slate-50 border-slate-200'}`} />
                        <div className="flex gap-3">
                            <button onClick={() => setReturnModal(null)}
                                className={`flex-1 py-2.5 rounded-xl font-medium ${dm ? 'bg-gray-700 hover:bg-gray-600' : 'bg-slate-100 hover:bg-slate-200'}`}>إلغاء</button>
                            <button onClick={handleReturn} disabled={submitting}
                                className="flex-1 py-2.5 rounded-xl font-medium bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center gap-1">
                                {submitting ? <span className="animate-spin">⏳</span> : <><RefreshCcw size={14} /> تأكيد الإرجاع</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReturnsTab;
