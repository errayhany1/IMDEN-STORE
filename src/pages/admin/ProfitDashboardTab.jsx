import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, BarChart3, Package, ShoppingBag, DollarSign, Award } from 'lucide-react';

const ProfitDashboardTab = ({ dm, orders, expenses, products }) => {
    const data = useMemo(() => {
        const validOrders = orders.filter(o => o.Status !== 'ملغي' && o.Status !== 'Cancelled' && o.Status !== 'مرتجع' && o.Status !== 'Returned');
        const totalRevenue = validOrders.reduce((s, o) => s + (Number(o['Sale Price']) || 0), 0);
        const totalExpenses = expenses.reduce((s, e) => s + (Number(e.Amount) || 0), 0);
        const netProfit = totalRevenue - totalExpenses;
        const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue * 100) : 0;

        // Weekly data (last 4 weeks)
        const weeks = [];
        for (let w = 3; w >= 0; w--) {
            const weekEnd = new Date();
            weekEnd.setDate(weekEnd.getDate() - w * 7);
            const weekStart = new Date(weekEnd);
            weekStart.setDate(weekStart.getDate() - 7);
            const label = `أسبوع ${4 - w}`;
            const wRevenue = validOrders.filter(o => {
                const d = new Date(o.CreatedAt);
                return d >= weekStart && d < weekEnd;
            }).reduce((s, o) => s + (Number(o['Sale Price']) || 0), 0);
            const wExpenses = expenses.filter(e => {
                const d = new Date(e.Date);
                return d >= weekStart && d < weekEnd;
            }).reduce((s, e) => s + (Number(e.Amount) || 0), 0);
            weeks.push({ label, revenue: wRevenue, expenses: wExpenses, profit: wRevenue - wExpenses });
        }

        // Top selling products
        const productSales = {};
        validOrders.forEach(o => {
            try {
                const meta = JSON.parse(o['Order Metadata'] || '[]');
                meta.forEach(item => {
                    const key = item.ref || item.name || 'unknown';
                    if (!productSales[key]) productSales[key] = { name: item.name || key, ref: key, total: 0, qty: 0 };
                    productSales[key].total += (item.price || 0) * (item.qty || 1);
                    productSales[key].qty += item.qty || 1;
                });
            } catch (e) {}
        });
        const topProducts = Object.values(productSales).sort((a, b) => b.total - a.total).slice(0, 10);

        // Expense categories
        const expCats = {};
        expenses.forEach(e => {
            const cat = e['Paid By'] || e.Description?.split(' ')[0] || 'أخرى';
            expCats[cat] = (expCats[cat] || 0) + (Number(e.Amount) || 0);
        });
        const expenseCategories = Object.entries(expCats).sort((a, b) => b[1] - a[1]);

        return { totalRevenue, totalExpenses, netProfit, profitMargin, weeks, topProducts, expenseCategories };
    }, [orders, expenses]);

    const maxWeekValue = Math.max(...data.weeks.map(w => Math.max(w.revenue, w.expenses)), 1);
    const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-yellow-500', 'bg-pink-500', 'bg-indigo-500', 'bg-orange-500', 'bg-teal-500'];

    return (
        <div className="space-y-5">
            {/* Key Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className={`p-4 rounded-xl border ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp size={16} className="text-green-500" />
                        <span className={`text-xs ${dm ? 'text-gray-400' : 'text-slate-500'}`}>إجمالي الإيرادات</span>
                    </div>
                    <p className="text-xl font-bold text-green-500">{data.totalRevenue.toFixed(0)} DH</p>
                </div>
                <div className={`p-4 rounded-xl border ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingDown size={16} className="text-red-500" />
                        <span className={`text-xs ${dm ? 'text-gray-400' : 'text-slate-500'}`}>إجمالي المصاريف</span>
                    </div>
                    <p className="text-xl font-bold text-red-500">{data.totalExpenses.toFixed(0)} DH</p>
                </div>
                <div className={`p-4 rounded-xl border ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <DollarSign size={16} className="text-blue-500" />
                        <span className={`text-xs ${dm ? 'text-gray-400' : 'text-slate-500'}`}>صافي الربح</span>
                    </div>
                    <p className={`text-xl font-bold ${data.netProfit >= 0 ? 'text-blue-500' : 'text-red-500'}`}>{data.netProfit > 0 ? '+' : ''}{data.netProfit.toFixed(0)} DH</p>
                </div>
                <div className={`p-4 rounded-xl border ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <BarChart3 size={16} className="text-purple-500" />
                        <span className={`text-xs ${dm ? 'text-gray-400' : 'text-slate-500'}`}>هامش الربح</span>
                    </div>
                    <p className={`text-xl font-bold ${data.profitMargin >= 0 ? 'text-purple-500' : 'text-red-500'}`}>{data.profitMargin.toFixed(1)}%</p>
                </div>
            </div>

            {/* Weekly Chart */}
            <div className={`p-4 rounded-xl border ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                <h3 className="text-sm font-bold mb-4">📊 الأداء الأسبوعي (آخر 4 أسابيع)</h3>
                <div className="space-y-3">
                    {data.weeks.map((week, i) => (
                        <div key={i} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                                <span className={dm ? 'text-gray-400' : 'text-slate-500'}>{week.label}</span>
                                <span className={`font-bold ${week.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {week.profit > 0 ? '+' : ''}{week.profit.toFixed(0)} DH
                                </span>
                            </div>
                            <div className="flex gap-1 h-5">
                                <div className="bg-green-500/80 rounded-sm transition-all" style={{ width: `${(week.revenue / maxWeekValue) * 100}%` }}
                                    title={`إيرادات: ${week.revenue} DH`} />
                                <div className="bg-red-400/80 rounded-sm transition-all" style={{ width: `${(week.expenses / maxWeekValue) * 100}%` }}
                                    title={`مصاريف: ${week.expenses} DH`} />
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex items-center justify-center gap-4 mt-3">
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-green-500/80" /><span className={`text-[10px] ${dm ? 'text-gray-500' : 'text-slate-400'}`}>إيرادات</span></div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-red-400/80" /><span className={`text-[10px] ${dm ? 'text-gray-500' : 'text-slate-400'}`}>مصاريف</span></div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Top Products */}
                <div className={`rounded-xl border overflow-hidden ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                    <div className={`px-4 py-3 border-b flex items-center gap-2 ${dm ? 'border-gray-800' : 'border-slate-100'}`}>
                        <Award size={16} className="text-yellow-500" />
                        <h3 className="text-sm font-bold">🏆 أعلى المنتجات مبيعاً</h3>
                    </div>
                    {data.topProducts.length === 0 ? (
                        <div className="p-6 text-center text-sm text-gray-500">لا توجد بيانات كافية</div>
                    ) : (
                        <div className={`divide-y ${dm ? 'divide-gray-800' : 'divide-slate-50'}`}>
                            {data.topProducts.map((p, i) => (
                                <div key={i} className="px-4 py-2.5 flex items-center gap-3">
                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i < 3 ? 'bg-yellow-500/20 text-yellow-600' : (dm ? 'bg-gray-800 text-gray-500' : 'bg-slate-100 text-slate-400')}`}>
                                        {i + 1}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium truncate">{p.name}</p>
                                        <p className={`text-[10px] ${dm ? 'text-gray-600' : 'text-slate-400'}`}>{p.qty} وحدة</p>
                                    </div>
                                    <span className="text-xs font-bold text-green-500">{p.total.toFixed(0)} DH</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Expense Breakdown */}
                <div className={`rounded-xl border overflow-hidden ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                    <div className={`px-4 py-3 border-b flex items-center gap-2 ${dm ? 'border-gray-800' : 'border-slate-100'}`}>
                        <TrendingDown size={16} className="text-red-500" />
                        <h3 className="text-sm font-bold">📋 توزيع المصاريف</h3>
                    </div>
                    {data.expenseCategories.length === 0 ? (
                        <div className="p-6 text-center text-sm text-gray-500">لا توجد مصاريف مسجلة</div>
                    ) : (
                        <div className="p-4 space-y-3">
                            {data.expenseCategories.map(([cat, amount], i) => (
                                <div key={cat} className="space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className={dm ? 'text-gray-300' : 'text-slate-600'}>{cat}</span>
                                        <span className="font-bold text-red-500">{amount.toFixed(0)} DH</span>
                                    </div>
                                    <div className={`w-full h-2 rounded-full ${dm ? 'bg-gray-800' : 'bg-slate-100'}`}>
                                        <div className={`h-full rounded-full ${colors[i % colors.length]} opacity-80`}
                                            style={{ width: `${(amount / data.totalExpenses) * 100}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProfitDashboardTab;
