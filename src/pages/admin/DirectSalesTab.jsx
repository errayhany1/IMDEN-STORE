import React, { useState } from 'react';
import { DollarSign, Plus, Search, ShoppingBag, Loader2, X, Check } from 'lucide-react';

const DirectSalesTab = ({ dm, products, orders, onCreateOrder }) => {
    const [search, setSearch] = useState('');
    const [cart, setCart] = useState([]);
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    // Filter direct sales from orders (ones with note containing "بيع مباشر")
    const directSales = orders.filter(o => (o.Notes || '').includes('بيع مباشر'));
    const totalDirectSales = directSales.reduce((s, o) => s + (Number(o['Sale Price']) || 0), 0);

    const filteredProducts = products.filter(p => {
        const q = search.toLowerCase();
        return (p.Title || '').toLowerCase().includes(q) || (p.SKU || '').toLowerCase().includes(q);
    }).slice(0, 20);

    const addToCart = (product) => {
        const exists = cart.find(c => c.id === (product.Id || product.id));
        if (exists) {
            setCart(cart.map(c => c.id === exists.id ? { ...c, qty: c.qty + 1 } : c));
        } else {
            setCart([...cart, {
                id: product.Id || product.id,
                name: product.Title || product.name || '',
                ref: product.SKU || product.ref || '',
                price: product.price || 0,
                qty: 1
            }]);
        }
    };

    const removeFromCart = (id) => setCart(cart.filter(c => c.id !== id));
    const updateQty = (id, delta) => setCart(cart.map(c => c.id === id ? { ...c, qty: Math.max(1, c.qty + delta) } : c));
    const cartTotal = cart.reduce((s, c) => s + c.price * c.qty, 0);

    const handleSubmit = async () => {
        if (cart.length === 0) return;
        setSubmitting(true);
        try {
            await onCreateOrder({
                name: customerName || 'بيع مباشر',
                phone: customerPhone || '—',
                address: 'المحل',
                notes: 'بيع مباشر | ' + notes,
                items: cart,
                total: cartTotal,
                status: 'تم الشحن'
            });
            setCart([]);
            setCustomerName('');
            setCustomerPhone('');
            setNotes('');
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
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
                        <DollarSign size={16} className="text-green-500" />
                        <span className={`text-xs ${dm ? 'text-gray-400' : 'text-slate-500'}`}>إجمالي المبيعات المباشرة</span>
                    </div>
                    <p className="text-2xl font-bold text-green-500">{totalDirectSales.toFixed(0)} DH</p>
                </div>
                <div className={`p-4 rounded-xl border ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <ShoppingBag size={16} className="text-blue-500" />
                        <span className={`text-xs ${dm ? 'text-gray-400' : 'text-slate-500'}`}>عدد العمليات</span>
                    </div>
                    <p className="text-2xl font-bold">{directSales.length}</p>
                </div>
                <div className={`p-4 rounded-xl border ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <DollarSign size={16} className="text-purple-500" />
                        <span className={`text-xs ${dm ? 'text-gray-400' : 'text-slate-500'}`}>متوسط الفاتورة</span>
                    </div>
                    <p className="text-2xl font-bold">{directSales.length > 0 ? (totalDirectSales / directSales.length).toFixed(0) : 0} DH</p>
                </div>
            </div>

            {/* Success Alert */}
            {showSuccess && (
                <div className="bg-green-100 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-center gap-2 text-sm font-medium">
                    <Check size={18} /> تم تسجيل عملية البيع بنجاح!
                </div>
            )}

            {/* New Sale Form */}
            <div className={`rounded-xl border overflow-hidden ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                <div className={`px-4 py-3 border-b flex items-center gap-2 ${dm ? 'border-gray-800' : 'border-slate-100'}`}>
                    <Plus size={16} className="text-green-500" />
                    <h3 className="text-sm font-bold">تسجيل بيع جديد</h3>
                </div>
                <div className="p-4 space-y-4">
                    {/* Customer Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input type="text" placeholder="اسم الزبون (اختياري)" value={customerName}
                            onChange={e => setCustomerName(e.target.value)}
                            className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-purple-500 ${dm ? 'bg-gray-800 border-gray-700 text-white' : 'bg-slate-50 border-slate-200'}`} />
                        <input type="tel" placeholder="رقم الهاتف (اختياري)" value={customerPhone}
                            onChange={e => setCustomerPhone(e.target.value)} dir="ltr"
                            className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-purple-500 ${dm ? 'bg-gray-800 border-gray-700 text-white' : 'bg-slate-50 border-slate-200'}`} />
                    </div>

                    {/* Product Search */}
                    <div className="relative">
                        <Search size={16} className={`absolute top-3 right-3 ${dm ? 'text-gray-500' : 'text-slate-400'}`} />
                        <input type="text" placeholder="ابحث عن منتج بالاسم أو المرجع..." value={search}
                            onChange={e => setSearch(e.target.value)}
                            className={`w-full pr-10 pl-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-purple-500 ${dm ? 'bg-gray-800 border-gray-700 text-white' : 'bg-slate-50 border-slate-200'}`} />
                    </div>

                    {/* Product Results */}
                    {search && (
                        <div className={`max-h-48 overflow-y-auto rounded-xl border divide-y ${dm ? 'border-gray-700 divide-gray-800' : 'border-slate-200 divide-slate-100'}`}>
                            {filteredProducts.map(p => (
                                <button key={p.Id || p.id} onClick={() => { addToCart(p); setSearch(''); }}
                                    className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-purple-500/10 transition ${dm ? 'text-gray-300' : 'text-slate-600'}`}>
                                    <span className="truncate">{p.Title || p.name} <span className={`text-xs ${dm ? 'text-gray-600' : 'text-slate-400'}`}>({p.SKU || p.ref})</span></span>
                                    <span className="font-bold text-green-500 shrink-0 mr-2">{p.price} DH</span>
                                </button>
                            ))}
                            {filteredProducts.length === 0 && <div className="p-3 text-center text-sm text-gray-500">لا توجد نتائج</div>}
                        </div>
                    )}

                    {/* Cart */}
                    {cart.length > 0 && (
                        <div className={`rounded-xl border ${dm ? 'border-gray-700' : 'border-slate-200'}`}>
                            <div className={`px-3 py-2 border-b text-xs font-bold ${dm ? 'border-gray-700 text-gray-400' : 'border-slate-100 text-slate-500'}`}>
                                السلة ({cart.length} منتج)
                            </div>
                            {cart.map(item => (
                                <div key={item.id} className={`px-3 py-2 flex items-center gap-2 border-b last:border-0 ${dm ? 'border-gray-800' : 'border-slate-50'}`}>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{item.name || item.ref}</p>
                                        <p className={`text-xs ${dm ? 'text-gray-500' : 'text-slate-400'}`}>{item.price} DH</p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => updateQty(item.id, -1)} className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold ${dm ? 'bg-gray-800 hover:bg-gray-700' : 'bg-slate-100 hover:bg-slate-200'}`}>-</button>
                                        <span className="w-8 text-center text-sm font-bold">{item.qty}</span>
                                        <button onClick={() => updateQty(item.id, 1)} className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold ${dm ? 'bg-gray-800 hover:bg-gray-700' : 'bg-slate-100 hover:bg-slate-200'}`}>+</button>
                                    </div>
                                    <span className="text-sm font-bold text-green-500 w-20 text-left">{(item.price * item.qty).toFixed(0)} DH</span>
                                    <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-500"><X size={14} /></button>
                                </div>
                            ))}
                            <div className={`px-3 py-3 flex items-center justify-between font-bold ${dm ? 'bg-gray-800' : 'bg-slate-50'}`}>
                                <span>المجموع</span>
                                <span className="text-green-500 text-lg">{cartTotal.toFixed(0)} DH</span>
                            </div>
                        </div>
                    )}

                    {/* Notes + Submit */}
                    <textarea placeholder="ملاحظات (اختياري)..." value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                        className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none resize-none focus:ring-2 focus:ring-purple-500 ${dm ? 'bg-gray-800 border-gray-700 text-white' : 'bg-slate-50 border-slate-200'}`} />

                    <button onClick={handleSubmit} disabled={cart.length === 0 || submitting}
                        className={`w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all ${cart.length === 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-lg shadow-green-500/20 active:scale-[0.98]'}`}>
                        {submitting ? <Loader2 size={18} className="animate-spin" /> : <><DollarSign size={18} /> تسجيل البيع — {cartTotal.toFixed(0)} DH</>}
                    </button>
                </div>
            </div>

            {/* Recent Direct Sales */}
            {directSales.length > 0 && (
                <div className={`rounded-xl border overflow-hidden ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                    <div className={`px-4 py-3 border-b ${dm ? 'border-gray-800' : 'border-slate-100'}`}>
                        <h3 className="text-sm font-bold">آخر المبيعات المباشرة</h3>
                    </div>
                    <div className="divide-y divide-slate-50 dark:divide-gray-800">
                        {directSales.slice(0, 10).map(o => (
                            <div key={o.Id} className="px-4 py-3 flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold truncate">{o['Customer Name'] || 'بيع مباشر'}</p>
                                    <p className={`text-[11px] ${dm ? 'text-gray-500' : 'text-slate-400'}`}>
                                        {o.CreatedAt ? new Date(o.CreatedAt).toLocaleDateString('ar-MA') : '—'}
                                    </p>
                                </div>
                                <span className="text-sm font-bold text-green-500 shrink-0">{o['Sale Price'] || 0} DH</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DirectSalesTab;
