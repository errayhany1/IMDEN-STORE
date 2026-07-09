import React, { useState } from 'react';
import axios from 'axios';
import { Search, Package, Clock, Truck, XCircle, ArrowRight, Loader2, Phone, ShoppingBag, CheckCircle } from 'lucide-react';
import useStore from '../store/useStore';

const NOCODB_URL = import.meta.env.VITE_NOCODB_URL;
const ORDERS_TOKEN = import.meta.env.VITE_NOCODB_ORDERS_TOKEN || import.meta.env.VITE_NOCODB_API_TOKEN;
const ORDERS_TABLE = import.meta.env.VITE_NOCODB_TABLE_ORDERS;

const statusConfig = {
    'قيد المراجعة': { icon: Clock, color: 'yellow', bg: 'from-yellow-500/20 to-amber-500/20', border: 'border-yellow-500/30', text: 'text-yellow-500', label: 'قيد المراجعة', step: 1 },
    'تم الشحن': { icon: Truck, color: 'green', bg: 'from-green-500/20 to-emerald-500/20', border: 'border-green-500/30', text: 'text-green-500', label: 'تم الشحن', step: 2 },
    'تم التوصيل': { icon: CheckCircle, color: 'blue', bg: 'from-blue-500/20 to-cyan-500/20', border: 'border-blue-500/30', text: 'text-blue-500', label: 'تم التوصيل', step: 3 },
    'ملغي': { icon: XCircle, color: 'red', bg: 'from-red-500/20 to-rose-500/20', border: 'border-red-500/30', text: 'text-red-500', label: 'ملغي', step: 0 },
};

const OrderTracking = () => {
    const { darkMode } = useStore();
    const dm = darkMode;

    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState(null);
    const [error, setError] = useState('');

    const handleSearch = async (e) => {
        e.preventDefault();
        const q = query.trim();
        if (!q) return;

        setLoading(true);
        setError('');
        setResults(null);

        try {
            // Search by phone number or by order ID
            const isNumericId = /^\d+$/.test(q) && q.length < 6;
            let where = '';
            if (isNumericId) {
                where = `(Id,eq,${q})`;
            } else {
                where = `(Customer Phone,like,%${q}%)`;
            }

            const response = await axios.get(`${NOCODB_URL}/api/v2/tables/${ORDERS_TABLE}/records`, {
                headers: { 'xc-token': ORDERS_TOKEN },
                params: { where: where, limit: 20, sort: '-Id' }
            });

            const list = response.data.list || [];
            if (list.length === 0) {
                setError('لم يتم العثور على أي طلب. تأكد من رقم الهاتف أو رقم الطلب.');
            } else {
                setResults(list);
            }
        } catch (err) {
            console.error("Tracking search error:", err);
            setError('حدث خطأ أثناء البحث. حاول مرة أخرى.');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('ar-MA', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const getStatus = (order) => {
        const s = order.Status || 'قيد المراجعة';
        return statusConfig[s] || statusConfig['قيد المراجعة'];
    };

    const steps = [
        { label: 'تم الاستلام', icon: ShoppingBag, step: 1 },
        { label: 'تم الشحن', icon: Truck, step: 2 },
        { label: 'تم التوصيل', icon: CheckCircle, step: 3 },
    ];

    return (
        <div className={`min-h-screen ${dm ? 'bg-gray-950 text-white' : 'bg-gradient-to-br from-slate-50 to-blue-50 text-slate-900'}`}>
            {/* Header */}
            <header className={`border-b backdrop-blur-xl sticky top-0 z-10 ${dm ? 'bg-gray-950/90 border-gray-800' : 'bg-white/80 border-slate-200'}`}>
                <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <Package size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-sm font-extrabold tracking-tight">Errayhany Store</h1>
                            <p className={`text-[10px] ${dm ? 'text-gray-500' : 'text-slate-400'}`}>تتبع طلبك</p>
                        </div>
                    </div>
                    <button onClick={() => window.location.href = '/'}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${dm ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}>
                        <ArrowRight size={14} />
                        العودة للمتجر
                    </button>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
                {/* Hero */}
                <div className="text-center space-y-3 mb-8">
                    <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-2 ${dm ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                        <Truck size={32} className="text-blue-500" />
                    </div>
                    <h2 className="text-2xl font-bold">تتبع طلبك</h2>
                    <p className={`text-sm max-w-md mx-auto ${dm ? 'text-gray-400' : 'text-slate-500'}`}>
                        أدخل رقم هاتفك أو رقم الطلب لمعرفة حالة طلبك فوراً
                    </p>
                </div>

                {/* Search Box */}
                <form onSubmit={handleSearch} className={`rounded-2xl border p-4 shadow-lg ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Phone size={16} className={`absolute right-3 top-1/2 -translate-y-1/2 ${dm ? 'text-gray-500' : 'text-slate-400'}`} />
                            <input
                                type="text"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="رقم الهاتف أو رقم الطلب..."
                                className={`w-full pr-10 pl-4 py-3 rounded-xl border outline-none text-sm font-medium transition-colors ${dm ? 'bg-gray-800 border-gray-700 focus:border-blue-500 placeholder-gray-600' : 'bg-slate-50 border-slate-200 focus:border-blue-500 placeholder-slate-400'}`}
                            />
                        </div>
                        <button type="submit" disabled={loading}
                            className="px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap">
                            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                            بحث
                        </button>
                    </div>
                </form>

                {/* Error */}
                {error && (
                    <div className={`p-4 rounded-xl border text-center text-sm ${dm ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-red-50 border-red-200 text-red-600'}`}>
                        {error}
                    </div>
                )}

                {/* Results */}
                {results && results.map(order => {
                    const status = getStatus(order);
                    const StatusIcon = status.icon;
                    const isCancelled = (order.Status || '') === 'ملغي';
                    const currentStep = status.step;

                    let items = [];
                    try { items = JSON.parse(order['Order Metadata'] || '[]'); } catch(e) {}

                    return (
                        <div key={order.Id} className={`rounded-2xl border overflow-hidden transition-all ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'} shadow-lg`}>
                            {/* Order Header */}
                            <div className={`p-4 border-b ${dm ? 'border-gray-800' : 'border-slate-100'}`}>
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs font-mono ${dm ? 'text-gray-500' : 'text-slate-400'}`}>طلب #{order.Id}</span>
                                        <span className={`text-[10px] ${dm ? 'text-gray-600' : 'text-slate-400'}`}>• {formatDate(order.CreatedAt)}</span>
                                    </div>
                                    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${status.border} bg-gradient-to-r ${status.bg} ${status.text}`}>
                                        <StatusIcon size={12} />
                                        {status.label}
                                    </div>
                                </div>
                            </div>

                            {/* Progress Bar (only for non-cancelled orders) */}
                            {!isCancelled && (
                                <div className="px-6 py-5">
                                    <div className="flex items-center justify-between relative">
                                        {/* Connection line */}
                                        <div className={`absolute top-5 right-5 left-5 h-0.5 ${dm ? 'bg-gray-800' : 'bg-slate-200'}`} />
                                        <div className={`absolute top-5 right-5 h-0.5 bg-blue-500 transition-all duration-500`}
                                            style={{ width: currentStep >= 3 ? '100%' : currentStep >= 2 ? '50%' : '0%' }} />

                                        {steps.map((step, idx) => {
                                            const StepIcon = step.icon;
                                            const isActive = currentStep >= step.step;
                                            const isCurrent = currentStep === step.step;
                                            return (
                                                <div key={idx} className="relative z-10 flex flex-col items-center gap-2">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300
                                                        ${isCurrent ? 'bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/30 scale-110' 
                                                            : isActive ? 'bg-blue-500 border-blue-500 text-white' 
                                                            : `${dm ? 'bg-gray-800 border-gray-700 text-gray-600' : 'bg-slate-100 border-slate-300 text-slate-400'}`}`}>
                                                        <StepIcon size={16} />
                                                    </div>
                                                    <span className={`text-[10px] font-bold ${isActive ? 'text-blue-500' : dm ? 'text-gray-600' : 'text-slate-400'}`}>
                                                        {step.label}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Cancelled message */}
                            {isCancelled && (
                                <div className="px-6 py-4 text-center">
                                    <p className="text-red-500 text-sm font-bold">تم إلغاء هذا الطلب</p>
                                </div>
                            )}

                            {/* Order Items */}
                            {items.length > 0 && (
                                <div className={`px-4 py-3 border-t ${dm ? 'border-gray-800' : 'border-slate-100'}`}>
                                    <p className={`text-[10px] font-bold mb-2 ${dm ? 'text-gray-500' : 'text-slate-400'}`}>المنتجات</p>
                                    <div className="space-y-2">
                                        {items.map((item, idx) => (
                                            <div key={idx} className={`flex items-center justify-between py-1.5 px-2 rounded-lg ${dm ? 'bg-gray-800/50' : 'bg-slate-50'}`}>
                                                <span className="text-xs font-medium truncate flex-1">{item.name || item.ref}</span>
                                                <div className="flex items-center gap-3 text-xs">
                                                    <span className={dm ? 'text-gray-500' : 'text-slate-400'}>×{item.qty}</span>
                                                    <span className="font-bold text-green-500">{item.price * item.qty} DH</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Footer */}
                            <div className={`px-4 py-3 border-t flex items-center justify-between ${dm ? 'border-gray-800 bg-gray-800/30' : 'border-slate-100 bg-slate-50/50'}`}>
                                <span className={`text-xs ${dm ? 'text-gray-500' : 'text-slate-400'}`}>المجموع</span>
                                <span className="text-lg font-extrabold text-green-500">{order['Sale Price'] || 0} DH</span>
                            </div>
                        </div>
                    );
                })}

                {/* Footer Info */}
                <div className={`text-center text-xs py-6 ${dm ? 'text-gray-600' : 'text-slate-400'}`}>
                    <p>هل لديك سؤال حول طلبك؟</p>
                    <a href="https://wa.me/212664630566" target="_blank" rel="noopener noreferrer"
                        className="text-green-500 font-bold hover:underline mt-1 inline-block">
                        تواصل معنا عبر واتساب
                    </a>
                </div>
            </main>
        </div>
    );
};

export default OrderTracking;
