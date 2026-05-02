import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Lock, Package, Loader2, Search, ArrowRight } from 'lucide-react';
import useStore from '../store/useStore';

const AdminDashboard = () => {
    const { darkMode } = useStore();
    const dm = darkMode;
    
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const savedAuth = sessionStorage.getItem('admin_auth');
        if (savedAuth === 'true') {
            setIsAuthenticated(true);
            fetchOrders();
        }
    }, []);

    const handleLogin = (e) => {
        e.preventDefault();
        // Simple hardcoded password for now
        if (password === 'imden2026') {
            setIsAuthenticated(true);
            sessionStorage.setItem('admin_auth', 'true');
            fetchOrders();
        } else {
            setError('كلمة السر غير صحيحة');
        }
    };

    const fetchOrders = async () => {
        setLoading(true);
        const nocodbUrl = import.meta.env.VITE_NOCODB_URL;
        const ordersToken = import.meta.env.VITE_NOCODB_ORDERS_TOKEN;
        const ordersTableId = import.meta.env.VITE_NOCODB_TABLE_ORDERS;

        try {
            const response = await axios.get(`${nocodbUrl}/api/v2/tables/${ordersTableId}/records?limit=100&sort=-Id`, {
                headers: { 'xc-token': ordersToken }
            });
            setOrders(response.data.list || []);
        } catch (err) {
            console.error("Error fetching orders:", err);
            alert("حدث خطأ أثناء جلب الطلبات");
        } finally {
            setLoading(false);
        }
    };

    const updateOrderStatus = async (id, newStatus) => {
        const nocodbUrl = import.meta.env.VITE_NOCODB_URL;
        const ordersToken = import.meta.env.VITE_NOCODB_ORDERS_TOKEN;
        const ordersTableId = import.meta.env.VITE_NOCODB_TABLE_ORDERS;

        try {
            await axios.patch(`${nocodbUrl}/api/v2/tables/${ordersTableId}/records`, 
                { Id: id, Status: newStatus },
                { headers: { 'xc-token': ordersToken, 'Content-Type': 'application/json' } }
            );
            // Update local state
            setOrders(orders.map(o => o.Id === id ? { ...o, Status: newStatus } : o));
        } catch (err) {
            console.error("Error updating status:", err);
            alert("حدث خطأ أثناء تحديث الحالة");
        }
    };

    const filteredOrders = orders.filter(o => 
        (o['Customer Name'] || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o['Customer Phone'] || '').includes(searchTerm)
    );

    if (!isAuthenticated) {
        return (
            <div className={`min-h-screen flex items-center justify-center p-4 ${dm ? 'bg-gray-950' : 'bg-slate-50'}`} dir="rtl">
                <div className={`max-w-md w-full p-8 rounded-2xl shadow-xl border ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-100'}`}>
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4">
                            <Lock size={32} className="text-white" />
                        </div>
                        <h2 className={`text-2xl font-bold ${dm ? 'text-white' : 'text-slate-900'}`}>لوحة الإدارة المتقدمة</h2>
                        <p className={`text-sm mt-2 ${dm ? 'text-gray-400' : 'text-slate-500'}`}>أدخل كلمة السر للوصول إلى بيانات المتجر</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                                placeholder="كلمة السر..."
                                className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none transition-all ${dm ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                            />
                        </div>
                        {error && <p className="text-red-500 text-sm font-medium">{error}</p>}
                        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all">
                            تسجيل الدخول
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen flex flex-col ${dm ? 'bg-gray-950 text-white' : 'bg-slate-50 text-slate-900'}`} dir="rtl">
            {/* Header */}
            <header className={`px-6 py-4 border-b flex items-center justify-between sticky top-0 z-10 ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center gap-3">
                    <div className="bg-blue-600 p-2 rounded-lg">
                        <Package size={24} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">إدارة الطلبات (Orders)</h1>
                        <p className={`text-xs ${dm ? 'text-gray-400' : 'text-slate-500'}`}>مرحباً بك في لوحة التحكم</p>
                    </div>
                </div>
                <button 
                    onClick={() => window.location.href = '/'}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${dm ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                >
                    العودة للمتجر
                    <ArrowRight size={16} />
                </button>
            </header>

            <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
                {/* Stats & Search */}
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-6">
                    <div className="flex gap-4 w-full sm:w-auto">
                        <div className={`p-4 rounded-xl border flex-1 sm:w-48 ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                            <p className={`text-sm mb-1 ${dm ? 'text-gray-400' : 'text-slate-500'}`}>إجمالي الطلبات</p>
                            <p className="text-2xl font-bold">{orders.length}</p>
                        </div>
                        <div className={`p-4 rounded-xl border flex-1 sm:w-48 ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                            <p className={`text-sm mb-1 ${dm ? 'text-gray-400' : 'text-slate-500'}`}>إجمالي المبيعات</p>
                            <p className="text-2xl font-bold text-green-500">
                                {orders.reduce((sum, o) => sum + (Number(o['Sale Price']) || 0), 0).toFixed(2)} DH
                            </p>
                        </div>
                    </div>

                    <div className={`relative w-full sm:w-72 flex items-center ${dm ? 'text-gray-300' : 'text-slate-500'}`}>
                        <Search size={18} className="absolute right-3" />
                        <input 
                            type="text" 
                            placeholder="ابحث بالاسم أو الهاتف..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className={`w-full pr-10 pl-4 py-3 rounded-xl border outline-none transition-colors ${dm ? 'bg-gray-900 border-gray-800 focus:border-blue-500 text-white' : 'bg-white border-slate-200 focus:border-blue-500'}`}
                        />
                    </div>
                </div>

                {/* Orders Table */}
                <div className={`rounded-xl border overflow-hidden ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                    {loading ? (
                        <div className="p-12 flex flex-col items-center justify-center text-blue-500">
                            <Loader2 size={40} className="animate-spin mb-4" />
                            <p>جاري تحميل الطلبات...</p>
                        </div>
                    ) : filteredOrders.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">لا توجد طلبات تطابق بحثك.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-right text-sm">
                                <thead className={`border-b ${dm ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                                    <tr>
                                        <th className="px-6 py-4 font-semibold">رقم الطلب</th>
                                        <th className="px-6 py-4 font-semibold">الزبون</th>
                                        <th className="px-6 py-4 font-semibold">المبلغ</th>
                                        <th className="px-6 py-4 font-semibold">الحالة</th>
                                        <th className="px-6 py-4 font-semibold">التفاصيل (المنتجات والعنوان)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200/20">
                                    {filteredOrders.map(order => (
                                        <tr key={order.Id} className={`transition-colors ${dm ? 'hover:bg-gray-800/50' : 'hover:bg-slate-50'}`}>
                                            <td className="px-6 py-4 font-mono text-xs">#{order.Id}</td>
                                            <td className="px-6 py-4">
                                                <p className="font-bold">{order['Customer Name']}</p>
                                                <p className={`text-xs mt-1 ${dm ? 'text-gray-400' : 'text-slate-500'}`} dir="ltr">{order['Customer Phone']}</p>
                                            </td>
                                            <td className="px-6 py-4 font-bold text-green-500">
                                                {order['Sale Price']} DH
                                            </td>
                                            <td className="px-6 py-4">
                                                <select
                                                    value={order.Status || 'قيد المراجعة'}
                                                    onChange={(e) => updateOrderStatus(order.Id, e.target.value)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold outline-none border cursor-pointer
                                                        ${order.Status === 'تم الشحن' ? 'bg-green-100 text-green-700 border-green-200' : 
                                                          order.Status === 'ملغي' ? 'bg-red-100 text-red-700 border-red-200' : 
                                                          'bg-yellow-100 text-yellow-700 border-yellow-200'}`}
                                                >
                                                    <option value="قيد المراجعة">⏳ قيد المراجعة</option>
                                                    <option value="تم الشحن">🚚 تم الشحن</option>
                                                    <option value="ملغي">❌ ملغي</option>
                                                </select>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className={`text-xs whitespace-pre-wrap p-3 rounded-lg max-h-32 overflow-y-auto border ${dm ? 'bg-gray-950 border-gray-800 text-gray-300' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                                                    {order.Notes}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default AdminDashboard;
