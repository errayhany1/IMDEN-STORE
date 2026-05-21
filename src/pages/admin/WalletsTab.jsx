import React, { useMemo } from 'react';
import { Wallet, TrendingUp, TrendingDown, CreditCard, DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const WalletsTab = ({ dm, orders, expenses }) => {
    const stats = useMemo(() => {
        const validOrders = orders.filter(o => o.Status !== 'ملغي' && o.Status !== 'Cancelled' && o.Status !== 'مرتجع' && o.Status !== 'Returned');
        const totalRevenue = validOrders.reduce((s, o) => s + (Number(o['Sale Price']) || 0), 0);
        const totalExpenses = expenses.reduce((s, e) => s + (Number(e.Amount) || 0), 0);
        const balance = totalRevenue - totalExpenses;

        // Group by day (last 7 days)
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toDateString();
            const label = d.toLocaleDateString('ar-MA', { weekday: 'short', day: 'numeric' });
            const dayRevenue = validOrders.filter(o => o.CreatedAt && new Date(o.CreatedAt).toDateString() === key)
                .reduce((s, o) => s + (Number(o['Sale Price']) || 0), 0);
            const dayExpenses = expenses.filter(e => e.Date && new Date(e.Date).toDateString() === key)
                .reduce((s, e) => s + (Number(e.Amount) || 0), 0);
            days.push({ label, revenue: dayRevenue, expenses: dayExpenses, net: dayRevenue - dayExpenses });
        }

        // Today
        const today = new Date().toDateString();
        const todayRevenue = validOrders.filter(o => o.CreatedAt && new Date(o.CreatedAt).toDateString() === today)
            .reduce((s, o) => s + (Number(o['Sale Price']) || 0), 0);
        const todayExpenses = expenses.filter(e => e.Date && new Date(e.Date).toDateString() === today)
            .reduce((s, e) => s + (Number(e.Amount) || 0), 0);

        // This month
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthRevenue = validOrders.filter(o => o.CreatedAt && new Date(o.CreatedAt) >= monthStart)
            .reduce((s, o) => s + (Number(o['Sale Price']) || 0), 0);
        const monthExpenses = expenses.filter(e => e.Date && new Date(e.Date) >= monthStart)
            .reduce((s, e) => s + (Number(e.Amount) || 0), 0);

        return { totalRevenue, totalExpenses, balance, days, todayRevenue, todayExpenses, monthRevenue, monthExpenses };
    }, [orders, expenses]);

    const maxDayValue = Math.max(...stats.days.map(d => Math.max(d.revenue, d.expenses)), 1);

    return (
        <div className="space-y-5">
            {/* Balance Card */}
            <div className={`p-6 rounded-2xl border relative overflow-hidden ${dm ? 'bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700' : 'bg-gradient-to-br from-purple-50 to-blue-50 border-slate-200'}`}>
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-1">
                        <Wallet size={18} className="text-purple-500" />
                        <span className={`text-sm ${dm ? 'text-gray-400' : 'text-slate-500'}`}>الرصيد الحالي</span>
                    </div>
                    <p className={`text-4xl font-black mb-4 ${stats.balance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {stats.balance > 0 ? '+' : ''}{stats.balance.toFixed(0)} DH
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="flex items-center gap-1 mb-0.5">
                                <ArrowUpRight size={14} className="text-green-500" />
                                <span className={`text-xs ${dm ? 'text-gray-400' : 'text-slate-500'}`}>الداخل</span>
                            </div>
                            <p className="text-lg font-bold text-green-500">{stats.totalRevenue.toFixed(0)} DH</p>
                        </div>
                        <div>
                            <div className="flex items-center gap-1 mb-0.5">
                                <ArrowDownRight size={14} className="text-red-500" />
                                <span className={`text-xs ${dm ? 'text-gray-400' : 'text-slate-500'}`}>الخارج</span>
                            </div>
                            <p className="text-lg font-bold text-red-500">{stats.totalExpenses.toFixed(0)} DH</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Today + This Month */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className={`p-4 rounded-xl border ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                    <h3 className={`text-xs font-bold mb-3 ${dm ? 'text-gray-400' : 'text-slate-500'}`}>📅 اليوم</h3>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className={`text-sm ${dm ? 'text-gray-300' : 'text-slate-600'}`}>المبيعات</span>
                            <span className="text-sm font-bold text-green-500">+{stats.todayRevenue.toFixed(0)} DH</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className={`text-sm ${dm ? 'text-gray-300' : 'text-slate-600'}`}>المصاريف</span>
                            <span className="text-sm font-bold text-red-500">-{stats.todayExpenses.toFixed(0)} DH</span>
                        </div>
                        <div className={`pt-2 border-t flex items-center justify-between ${dm ? 'border-gray-800' : 'border-slate-100'}`}>
                            <span className="text-sm font-bold">الصافي</span>
                            <span className={`text-sm font-bold ${stats.todayRevenue - stats.todayExpenses >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {(stats.todayRevenue - stats.todayExpenses).toFixed(0)} DH
                            </span>
                        </div>
                    </div>
                </div>
                <div className={`p-4 rounded-xl border ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                    <h3 className={`text-xs font-bold mb-3 ${dm ? 'text-gray-400' : 'text-slate-500'}`}>📆 هذا الشهر</h3>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className={`text-sm ${dm ? 'text-gray-300' : 'text-slate-600'}`}>المبيعات</span>
                            <span className="text-sm font-bold text-green-500">+{stats.monthRevenue.toFixed(0)} DH</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className={`text-sm ${dm ? 'text-gray-300' : 'text-slate-600'}`}>المصاريف</span>
                            <span className="text-sm font-bold text-red-500">-{stats.monthExpenses.toFixed(0)} DH</span>
                        </div>
                        <div className={`pt-2 border-t flex items-center justify-between ${dm ? 'border-gray-800' : 'border-slate-100'}`}>
                            <span className="text-sm font-bold">الصافي</span>
                            <span className={`text-sm font-bold ${stats.monthRevenue - stats.monthExpenses >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {(stats.monthRevenue - stats.monthExpenses).toFixed(0)} DH
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 7-Day Chart */}
            <div className={`p-4 rounded-xl border ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                <h3 className={`text-sm font-bold mb-4 ${dm ? 'text-gray-300' : 'text-slate-700'}`}>📊 آخر 7 أيام</h3>
                <div className="flex items-end gap-2 h-40">
                    {stats.days.map((day, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                            <div className="w-full flex gap-0.5 items-end justify-center" style={{ height: '120px' }}>
                                <div className="w-3 rounded-t-sm bg-green-500/80 transition-all" style={{ height: `${Math.max((day.revenue / maxDayValue) * 100, 2)}%` }}
                                    title={`مبيعات: ${day.revenue} DH`} />
                                <div className="w-3 rounded-t-sm bg-red-400/80 transition-all" style={{ height: `${Math.max((day.expenses / maxDayValue) * 100, 2)}%` }}
                                    title={`مصاريف: ${day.expenses} DH`} />
                            </div>
                            <span className={`text-[10px] ${dm ? 'text-gray-500' : 'text-slate-400'}`}>{day.label}</span>
                        </div>
                    ))}
                </div>
                <div className="flex items-center justify-center gap-4 mt-3">
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-green-500/80" /><span className={`text-[10px] ${dm ? 'text-gray-500' : 'text-slate-400'}`}>مبيعات</span></div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-red-400/80" /><span className={`text-[10px] ${dm ? 'text-gray-500' : 'text-slate-400'}`}>مصاريف</span></div>
                </div>
            </div>
        </div>
    );
};

export default WalletsTab;
