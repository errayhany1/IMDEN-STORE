import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { Lock, Package, Loader2, Search, ArrowRight, RefreshCw, LogOut, Trash2, Phone, Eye, X, Clock, Truck, XCircle, ShoppingBag, TrendingUp, ChevronDown, ChevronUp, Users, Download } from 'lucide-react';
import useStore from '../store/useStore';

const NOCODB_URL = import.meta.env.VITE_NOCODB_URL;
const ORDERS_TOKEN = import.meta.env.VITE_NOCODB_ORDERS_TOKEN;
const ORDERS_TABLE = import.meta.env.VITE_NOCODB_TABLE_ORDERS;

const AdminDashboard = () => {
    const { darkMode } = useStore();
    const dm = darkMode;
    
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('الكل');
    const [expandedOrder, setExpandedOrder] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [activeTab, setActiveTab] = useState('orders');

    useEffect(() => {
        const savedAuth = sessionStorage.getItem('admin_auth');
        if (savedAuth === 'true') {
            setIsAuthenticated(true);
            fetchOrders();
        }
    }, []);

    const handleLogin = (e) => {
        e.preventDefault();
        if (password === 'imden2026') {
            setIsAuthenticated(true);
            sessionStorage.setItem('admin_auth', 'true');
            fetchOrders();
        } else {
            setError('كلمة السر غير صحيحة');
        }
    };

    const handleLogout = () => {
        sessionStorage.removeItem('admin_auth');
        setIsAuthenticated(false);
        setOrders([]);
    };

    const fetchOrders = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);

        try {
            let allOrders = [];
            let offset = 0;
            let hasMore = true;

            while (hasMore) {
                const response = await axios.get(`${NOCODB_URL}/api/v2/tables/${ORDERS_TABLE}/records`, {
                    headers: { 'xc-token': ORDERS_TOKEN },
                    params: { limit: 100, offset, sort: '-Id' }
                });
                const list = response.data.list || [];
                allOrders = [...allOrders, ...list];
                if (list.length < 100) hasMore = false;
                else offset += 100;
            }

            setOrders(allOrders);
        } catch (err) {
            console.error("Error fetching orders:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    const updateOrderStatus = async (id, newStatus) => {
        try {
            await axios.patch(`${NOCODB_URL}/api/v2/tables/${ORDERS_TABLE}/records`, 
                { Id: id, Status: newStatus },
                { headers: { 'xc-token': ORDERS_TOKEN, 'Content-Type': 'application/json' } }
            );
            setOrders(prev => prev.map(o => o.Id === id ? { ...o, Status: newStatus } : o));
        } catch (err) {
            console.error("Error updating status:", err);
            alert("حدث خطأ أثناء تحديث الحالة");
        }
    };

    const deleteOrder = async (id) => {
        try {
            await axios.delete(`${NOCODB_URL}/api/v2/tables/${ORDERS_TABLE}/records`, {
                headers: { 'xc-token': ORDERS_TOKEN, 'Content-Type': 'application/json' },
                data: [{ Id: id }]
            });
            setOrders(prev => prev.filter(o => o.Id !== id));
            setDeleteConfirm(null);
        } catch (err) {
            console.error("Error deleting order:", err);
            alert("حدث خطأ أثناء حذف الطلب");
        }
    };

    // Format date
    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        const now = new Date();
        const diffMs = now - d;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHrs = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'الآن';
        if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
        if (diffHrs < 24) return `منذ ${diffHrs} ساعة`;
        if (diffDays < 7) return `منذ ${diffDays} يوم`;
        return d.toLocaleDateString('ar-MA', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    // Stats
    const pendingCount = orders.filter(o => !o.Status || o.Status === 'قيد المراجعة').length;
    const shippedCount = orders.filter(o => o.Status === 'تم الشحن').length;
    const cancelledCount = orders.filter(o => o.Status === 'ملغي').length;
    const totalRevenue = orders.filter(o => o.Status !== 'ملغي').reduce((sum, o) => sum + (Number(o['Sale Price']) || 0), 0);

    // Today's orders
    const today = new Date().toDateString();
    const todayOrders = orders.filter(o => o.CreatedAt && new Date(o.CreatedAt).toDateString() === today);

    // Filtered orders
    const filteredOrders = orders.filter(o => {
        const matchSearch = (o['Customer Name'] || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (o['Customer Phone'] || '').includes(searchTerm) ||
            String(o.Id).includes(searchTerm);
        
        const status = o.Status || 'قيد المراجعة';
        const matchStatus = statusFilter === 'الكل' || status === statusFilter;

        return matchSearch && matchStatus;
    });

    // ── Customers extracted from orders ──
    const customers = useMemo(() => {
        const map = {};
        orders.forEach(o => {
            const phone = (o['Customer Phone'] || '').trim();
            if (!phone) return;
            if (!map[phone]) {
                map[phone] = { name: o['Customer Name'] || 'بدون اسم', phone, totalSpent: 0, orderCount: 0 };
            }
            map[phone].totalSpent += Number(o['Sale Price']) || 0;
            map[phone].orderCount += 1;
        });
        return Object.values(map).sort((a, b) => b.totalSpent - a.totalSpent);
    }, [orders]);

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.phone.includes(searchTerm)
    );

    // ── CSV Export ──
    const exportCSV = () => {
        const headers = ['رقم الطلب', 'الاسم', 'الهاتف', 'المبلغ', 'الحالة', 'التاريخ', 'الملاحظات'];
        const rows = orders.map(o => [
            o.Id, o['Customer Name'] || '', o['Customer Phone'] || '',
            o['Sale Price'] || 0, o.Status || 'قيد المراجعة',
            o.CreatedAt ? new Date(o.CreatedAt).toLocaleDateString('ar-MA') : '',
            (o.Notes || '').replace(/\n/g, ' | ')
        ]);
        const csv = '\uFEFF' + [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `IMDEN_Orders_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // ── LOGIN PAGE ──
    if (!isAuthenticated) {
        return (
            <div className={`min-h-screen flex items-center justify-center p-4 ${dm ? 'bg-gray-950' : 'bg-gradient-to-br from-blue-50 to-slate-100'}`} dir="rtl">
                <div className={`max-w-md w-full p-8 rounded-2xl shadow-2xl border ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-100'}`}>
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-500/30">
                            <Lock size={36} className="text-white" />
                        </div>
                        <h2 className={`text-2xl font-bold ${dm ? 'text-white' : 'text-slate-900'}`}>IMDEN Admin</h2>
                        <p className={`text-sm mt-2 ${dm ? 'text-gray-400' : 'text-slate-500'}`}>لوحة إدارة الطلبات والمخازن</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); setError(''); }}
                            placeholder="كلمة السر..."
                            autoFocus
                            className={`w-full px-4 py-3.5 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none transition-all text-lg ${dm ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                        />
                        {error && <p className="text-red-500 text-sm font-medium text-center">{error}</p>}
                        <button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98]">
                            تسجيل الدخول
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // ── DASHBOARD ──
    const statusTabs = [
        { label: 'الكل', count: orders.length, icon: ShoppingBag, color: 'blue' },
        { label: 'قيد المراجعة', count: pendingCount, icon: Clock, color: 'yellow' },
        { label: 'تم الشحن', count: shippedCount, icon: Truck, color: 'green' },
        { label: 'ملغي', count: cancelledCount, icon: XCircle, color: 'red' },
    ];

    const statusColors = {
        'قيد المراجعة': { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200', dot: 'bg-yellow-500' },
        'تم الشحن': { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', dot: 'bg-green-500' },
        'ملغي': { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
    };

    return (
        <div className={`min-h-screen flex flex-col ${dm ? 'bg-gray-950 text-white' : 'bg-slate-50 text-slate-900'}`} dir="rtl">
            {/* ── Header ── */}
            <header className={`px-4 sm:px-6 py-3 border-b flex items-center justify-between sticky top-0 z-10 backdrop-blur-xl ${dm ? 'bg-gray-900/90 border-gray-800' : 'bg-white/90 border-slate-200'}`}>
                <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-br from-blue-500 to-blue-700 p-2 rounded-xl shadow-md">
                        <Package size={22} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold">IMDEN Admin</h1>
                        <p className={`text-[11px] ${dm ? 'text-gray-500' : 'text-slate-400'}`}>لوحة إدارة الطلبات</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => fetchOrders(true)}
                        className={`p-2 rounded-lg transition-colors ${dm ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-slate-100 text-slate-500'}`}
                        title="تحديث">
                        <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                    </button>
                    <button onClick={() => window.location.href = '/'}
                        className={`hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${dm ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}>
                        المتجر <ArrowRight size={14} />
                    </button>
                    <button onClick={handleLogout}
                        className={`p-2 rounded-lg transition-colors text-red-400 hover:text-red-500 ${dm ? 'hover:bg-gray-800' : 'hover:bg-red-50'}`}
                        title="تسجيل الخروج">
                        <LogOut size={18} />
                    </button>
                </div>
            </header>

            <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-5">
                {/* ── Stats Cards ── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className={`p-4 rounded-xl border ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                        <div className="flex items-center gap-2 mb-2">
                            <ShoppingBag size={16} className="text-blue-500" />
                            <span className={`text-xs ${dm ? 'text-gray-400' : 'text-slate-500'}`}>إجمالي الطلبات</span>
                        </div>
                        <p className="text-2xl font-bold">{orders.length}</p>
                    </div>
                    <div className={`p-4 rounded-xl border ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp size={16} className="text-green-500" />
                            <span className={`text-xs ${dm ? 'text-gray-400' : 'text-slate-500'}`}>إجمالي المبيعات</span>
                        </div>
                        <p className="text-2xl font-bold text-green-500">{totalRevenue.toFixed(0)} DH</p>
                    </div>
                    <div className={`p-4 rounded-xl border ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                        <div className="flex items-center gap-2 mb-2">
                            <Clock size={16} className="text-yellow-500" />
                            <span className={`text-xs ${dm ? 'text-gray-400' : 'text-slate-500'}`}>قيد المراجعة</span>
                        </div>
                        <p className="text-2xl font-bold text-yellow-500">{pendingCount}</p>
                    </div>
                    <div className={`p-4 rounded-xl border ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                        <div className="flex items-center gap-2 mb-2">
                            <Package size={16} className="text-purple-500" />
                            <span className={`text-xs ${dm ? 'text-gray-400' : 'text-slate-500'}`}>طلبات اليوم</span>
                        </div>
                        <p className="text-2xl font-bold text-purple-500">{todayOrders.length}</p>
                    </div>
                </div>

                {/* ── Main Tabs (Orders / Customers) ── */}
                <div className="flex items-center gap-2 border-b pb-0 mb-0" style={{borderColor: dm ? '#1f2937' : '#e2e8f0'}}>
                    <button onClick={() => { setActiveTab('orders'); setSearchTerm(''); }}
                        className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold border-b-2 transition-all -mb-px ${activeTab === 'orders' ? 'border-blue-500 text-blue-600' : `border-transparent ${dm ? 'text-gray-500 hover:text-gray-300' : 'text-slate-400 hover:text-slate-600'}`}`}>
                        <ShoppingBag size={16} /> الطلبات
                    </button>
                    <button onClick={() => { setActiveTab('customers'); setSearchTerm(''); }}
                        className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold border-b-2 transition-all -mb-px ${activeTab === 'customers' ? 'border-blue-500 text-blue-600' : `border-transparent ${dm ? 'text-gray-500 hover:text-gray-300' : 'text-slate-400 hover:text-slate-600'}`}`}>
                        <Users size={16} /> الزبائن ({customers.length})
                    </button>
                    <div className="flex-1" />
                    {activeTab === 'orders' && (
                        <button onClick={exportCSV}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${dm ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}>
                            <Download size={14} /> تصدير CSV
                        </button>
                    )}
                </div>

                {/* ── ORDERS TAB ── */}
                {activeTab === 'orders' && (<>
                {/* ── Status Tabs + Search ── */}
                <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
                    <div className="flex gap-2 overflow-x-auto pb-1 w-full sm:w-auto">
                        {statusTabs.map(tab => {
                            const Icon = tab.icon;
                            const isActive = statusFilter === tab.label;
                            return (
                                <button key={tab.label}
                                    onClick={() => setStatusFilter(tab.label)}
                                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all border
                                        ${isActive 
                                            ? `bg-${tab.color}-100 text-${tab.color}-700 border-${tab.color}-200 shadow-sm` 
                                            : `${dm ? 'bg-gray-900 border-gray-800 text-gray-400 hover:bg-gray-800' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`
                                        }`}
                                    style={isActive ? { backgroundColor: `var(--${tab.color}-bg, ${tab.color === 'blue' ? '#dbeafe' : tab.color === 'yellow' ? '#fef9c3' : tab.color === 'green' ? '#dcfce7' : '#fee2e2'})`, color: `${tab.color === 'blue' ? '#1d4ed8' : tab.color === 'yellow' ? '#a16207' : tab.color === 'green' ? '#15803d' : '#b91c1c'}` } : {}}
                                >
                                    <Icon size={14} />
                                    {tab.label}
                                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-white/50' : dm ? 'bg-gray-800' : 'bg-slate-100'}`}>
                                        {tab.count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div className={`relative w-full sm:w-64 ${dm ? 'text-gray-300' : 'text-slate-500'}`}>
                        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2" />
                        <input type="text" placeholder="ابحث..." value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className={`w-full pr-9 pl-4 py-2.5 rounded-xl border outline-none text-sm transition-colors ${dm ? 'bg-gray-900 border-gray-800 focus:border-blue-500 text-white' : 'bg-white border-slate-200 focus:border-blue-500'}`}
                        />
                    </div>
                </div>

                {/* ── Orders List ── */}
                <div className="space-y-3">
                    {loading ? (
                        <div className={`p-12 flex flex-col items-center justify-center rounded-xl border ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                            <Loader2 size={40} className="animate-spin text-blue-500 mb-4" />
                            <p className={dm ? 'text-gray-400' : 'text-slate-500'}>جاري تحميل الطلبات...</p>
                        </div>
                    ) : filteredOrders.length === 0 ? (
                        <div className={`p-12 text-center rounded-xl border ${dm ? 'bg-gray-900 border-gray-800 text-gray-500' : 'bg-white border-slate-200 text-slate-400'}`}>
                            لا توجد طلبات{searchTerm ? ' تطابق بحثك' : ''}.
                        </div>
                    ) : (
                        filteredOrders.map(order => {
                            const status = order.Status || 'قيد المراجعة';
                            const sc = statusColors[status] || statusColors['قيد المراجعة'];
                            const isExpanded = expandedOrder === order.Id;

                            return (
                                <div key={order.Id}
                                    className={`rounded-xl border overflow-hidden transition-all ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'} ${isExpanded ? 'shadow-lg' : ''}`}
                                >
                                    {/* Order Row */}
                                    <div className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${dm ? 'hover:bg-gray-800/50' : 'hover:bg-slate-50'}`}
                                        onClick={() => setExpandedOrder(isExpanded ? null : order.Id)}
                                    >
                                        {/* Status Dot */}
                                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${sc.dot}`} />

                                        {/* Order Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`font-bold text-sm ${dm ? 'text-white' : 'text-slate-900'}`}>
                                                    {order['Customer Name'] || 'بدون اسم'}
                                                </span>
                                                <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${dm ? 'bg-gray-800 text-gray-500' : 'bg-slate-100 text-slate-400'}`}>
                                                    #{order.Id}
                                                </span>
                                            </div>
                                            <div className={`flex items-center gap-3 mt-1 text-xs ${dm ? 'text-gray-500' : 'text-slate-400'}`}>
                                                <span dir="ltr">{order['Customer Phone'] || '—'}</span>
                                                <span>•</span>
                                                <span>{formatDate(order.CreatedAt)}</span>
                                            </div>
                                        </div>

                                        {/* Price */}
                                        <span className="font-bold text-green-500 text-sm shrink-0">
                                            {order['Sale Price'] || 0} DH
                                        </span>

                                        {/* Status Badge */}
                                        <span className={`hidden sm:inline-flex px-2.5 py-1 rounded-lg text-[11px] font-bold ${sc.bg} ${sc.text} ${sc.border} border shrink-0`}>
                                            {status}
                                        </span>

                                        {/* Expand Arrow */}
                                        {isExpanded ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
                                    </div>

                                    {/* Expanded Details */}
                                    {isExpanded && (
                                        <div className={`px-4 pb-4 pt-1 border-t space-y-3 ${dm ? 'border-gray-800' : 'border-slate-100'}`}>
                                            {/* Status Change + Actions */}
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className={`text-xs font-medium ${dm ? 'text-gray-400' : 'text-slate-500'}`}>تغيير الحالة:</span>
                                                {['قيد المراجعة', 'تم الشحن', 'ملغي'].map(s => {
                                                    const c = statusColors[s];
                                                    const isActive = status === s;
                                                    return (
                                                        <button key={s} onClick={(e) => { e.stopPropagation(); updateOrderStatus(order.Id, s); }}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${isActive ? `${c.bg} ${c.text} ${c.border} ring-2 ring-offset-1 ring-${s === 'قيد المراجعة' ? 'yellow' : s === 'تم الشحن' ? 'green' : 'red'}-300` : `${dm ? 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}`}
                                                        >
                                                            {s === 'قيد المراجعة' ? '⏳' : s === 'تم الشحن' ? '🚚' : '❌'} {s}
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            {/* Notes / Order Details */}
                                            {order.Notes && (
                                                <div className={`text-xs whitespace-pre-wrap p-3 rounded-xl border leading-relaxed ${dm ? 'bg-gray-950 border-gray-800 text-gray-300' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                                                    {order.Notes}
                                                </div>
                                            )}

                                            {/* Quick Actions */}
                                            <div className="flex items-center gap-2 pt-1">
                                                {order['Customer Phone'] && (
                                                    <>
                                                        <a href={`https://wa.me/212${order['Customer Phone'].replace(/^0/, '')}`} target="_blank" rel="noreferrer"
                                                            className="flex items-center gap-1.5 px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-bold transition-colors">
                                                            <Phone size={12} /> واتساب
                                                        </a>
                                                        <a href={`tel:${order['Customer Phone']}`}
                                                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${dm ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}>
                                                            <Phone size={12} /> اتصال
                                                        </a>
                                                    </>
                                                )}
                                                <div className="flex-1" />
                                                <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(order.Id); }}
                                                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-red-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                                                    <Trash2 size={12} /> حذف
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
                </>)}

                {/* ── CUSTOMERS TAB ── */}
                {activeTab === 'customers' && (
                    <div className="space-y-3">
                        {/* Search */}
                        <div className={`relative w-full sm:w-72 ${dm ? 'text-gray-300' : 'text-slate-500'}`}>
                            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2" />
                            <input type="text" placeholder="ابحث بالاسم أو الهاتف..." value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className={`w-full pr-9 pl-4 py-2.5 rounded-xl border outline-none text-sm transition-colors ${dm ? 'bg-gray-900 border-gray-800 focus:border-blue-500 text-white' : 'bg-white border-slate-200 focus:border-blue-500'}`}
                            />
                        </div>

                        {/* Customer Cards */}
                        {filteredCustomers.length === 0 ? (
                            <div className={`p-12 text-center rounded-xl border ${dm ? 'bg-gray-900 border-gray-800 text-gray-500' : 'bg-white border-slate-200 text-slate-400'}`}>
                                لا يوجد زبائن.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {filteredCustomers.map(c => (
                                    <div key={c.phone} className={`p-4 rounded-xl border transition-all ${dm ? 'bg-gray-900 border-gray-800 hover:border-gray-700' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${dm ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                                                {(c.name || '?')[0]}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-sm truncate">{c.name}</p>
                                                <p className={`text-xs ${dm ? 'text-gray-500' : 'text-slate-400'}`} dir="ltr">{c.phone}</p>
                                            </div>
                                        </div>
                                        <div className={`flex items-center justify-between mt-3 pt-3 border-t text-xs ${dm ? 'border-gray-800' : 'border-slate-100'}`}>
                                            <div>
                                                <span className={dm ? 'text-gray-500' : 'text-slate-400'}>الطلبات: </span>
                                                <span className="font-bold">{c.orderCount}</span>
                                            </div>
                                            <div>
                                                <span className={dm ? 'text-gray-500' : 'text-slate-400'}>المجموع: </span>
                                                <span className="font-bold text-green-500">{c.totalSpent.toFixed(0)} DH</span>
                                            </div>
                                            <a href={`https://wa.me/212${c.phone.replace(/^0/, '')}`} target="_blank" rel="noreferrer"
                                                className="flex items-center gap-1 px-2 py-1 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold transition-colors">
                                                <Phone size={10} /> واتساب
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* ── Delete Confirmation Modal ── */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
                    <div className={`relative rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center space-y-4 ${dm ? 'bg-gray-800 text-white' : 'bg-white text-slate-900'}`} dir="rtl">
                        <div className="text-4xl">🗑️</div>
                        <h3 className="text-lg font-bold">حذف الطلب #{deleteConfirm}؟</h3>
                        <p className={`text-sm ${dm ? 'text-gray-400' : 'text-slate-500'}`}>لا يمكن التراجع عن هذا الإجراء.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteConfirm(null)}
                                className={`flex-1 py-2.5 rounded-xl font-medium ${dm ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}>
                                إلغاء
                            </button>
                            <button onClick={() => deleteOrder(deleteConfirm)}
                                className="flex-1 py-2.5 rounded-xl font-medium bg-red-500 hover:bg-red-600 text-white">
                                حذف
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
