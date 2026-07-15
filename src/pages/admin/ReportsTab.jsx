import React, { useMemo, useState } from 'react';
import { FileText, Download, Calendar, ShoppingBag, CreditCard, Users, TrendingUp } from 'lucide-react';

const ReportsTab = ({ dm, orders, expenses }) => {
    const [period, setPeriod] = useState('all'); // 'all', 'month', 'week'

    const filteredData = useMemo(() => {
        const now = new Date();
        let startDate = null;
        if (period === 'week') { startDate = new Date(); startDate.setDate(startDate.getDate() - 7); }
        if (period === 'month') { startDate = new Date(now.getFullYear(), now.getMonth(), 1); }

        const fOrders = startDate ? orders.filter(o => o.CreatedAt && new Date(o.CreatedAt) >= startDate) : orders;
        const fExpenses = startDate ? expenses.filter(e => e.Date && new Date(e.Date) >= startDate) : expenses;

        const validOrders = fOrders.filter(o => o.Status !== 'ملغي' && o.Status !== 'Cancelled');
        const totalRevenue = validOrders.reduce((s, o) => s + (Number(o['Sale Price']) || 0), 0);
        const totalExpenses = fExpenses.reduce((s, e) => s + (Number(e.Amount) || 0), 0);
        const avgOrder = validOrders.length > 0 ? totalRevenue / validOrders.length : 0;

        // Customers
        const custMap = {};
        fOrders.forEach(o => {
            const phone = (o['Customer Phone'] || '').trim();
            if (!phone) return;
            if (!custMap[phone]) custMap[phone] = { name: o['Customer Name'] || '', phone, total: 0, count: 0 };
            custMap[phone].total += Number(o['Sale Price']) || 0;
            custMap[phone].count++;
        });
        const customers = Object.values(custMap).sort((a, b) => b.total - a.total);

        // Monthly breakdown
        const months = {};
        validOrders.forEach(o => {
            const d = new Date(o.CreatedAt);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!months[key]) months[key] = { revenue: 0, orders: 0, expenses: 0 };
            months[key].revenue += Number(o['Sale Price']) || 0;
            months[key].orders++;
        });
        fExpenses.forEach(e => {
            const d = new Date(e.Date);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!months[key]) months[key] = { revenue: 0, orders: 0, expenses: 0 };
            months[key].expenses += Number(e.Amount) || 0;
        });
        const monthlyData = Object.entries(months).sort((a, b) => b[0].localeCompare(a[0]));

        return { fOrders, fExpenses, validOrders, totalRevenue, totalExpenses, avgOrder, customers, monthlyData };
    }, [orders, expenses, period]);

    // CSV Export functions
    const exportOrdersCSV = () => {
        const headers = ['رقم الطلب', 'الاسم', 'الهاتف', 'المبلغ', 'الحالة', 'التاريخ', 'العنوان'];
        const rows = filteredData.fOrders.map(o => [
            o.Id, o['Customer Name'] || '', o['Customer Phone'] || '',
            o['Sale Price'] || 0, o.Status || '',
            o.CreatedAt ? new Date(o.CreatedAt).toLocaleDateString('ar-MA') : '',
            (o['Delivery Address'] || '').replace(/\n/g, ' ')
        ]);
        downloadCSV(headers, rows, 'Errayhany_Orders');
    };

    const exportExpensesCSV = () => {
        const headers = ['الوصف', 'المبلغ', 'المسؤول', 'التاريخ'];
        const rows = filteredData.fExpenses.map(e => [
            e.Description || '', e.Amount || 0, e['Paid By'] || '',
            e.Date ? new Date(e.Date).toLocaleDateString('ar-MA') : ''
        ]);
        downloadCSV(headers, rows, 'Errayhany_Expenses');
    };

    const exportCustomersCSV = () => {
        const headers = ['الاسم', 'الهاتف', 'إجمالي المشتريات', 'عدد الطلبات'];
        const rows = filteredData.customers.map(c => [c.name, c.phone, c.total, c.count]);
        downloadCSV(headers, rows, 'Errayhany_Customers');
    };

    const downloadCSV = (headers, rows, name) => {
        const csv = '\uFEFF' + [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const periods = [
        { id: 'all', label: 'الكل' },
        { id: 'month', label: 'هذا الشهر' },
        { id: 'week', label: 'هذا الأسبوع' },
    ];

    return (
        <div className="space-y-5">
            {/* Period Filter */}
            <div className="flex gap-2">
                {periods.map(p => (
                    <button key={p.id} onClick={() => setPeriod(p.id)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${period === p.id
                            ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                            : (dm ? 'bg-gray-900 text-gray-400 border border-gray-800 hover:bg-gray-800' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50')
                        }`}>
                        {p.label}
                    </button>
                ))}
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className={`p-4 rounded-xl border ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                    <ShoppingBag size={16} className="text-blue-500 mb-2" />
                    <p className={`text-xs ${dm ? 'text-gray-400' : 'text-slate-500'}`}>الطلبات</p>
                    <p className="text-xl font-bold">{filteredData.validOrders.length}</p>
                </div>
                <div className={`p-4 rounded-xl border ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                    <TrendingUp size={16} className="text-green-500 mb-2" />
                    <p className={`text-xs ${dm ? 'text-gray-400' : 'text-slate-500'}`}>المبيعات</p>
                    <p className="text-xl font-bold text-green-500">{filteredData.totalRevenue.toFixed(0)} DH</p>
                </div>
                <div className={`p-4 rounded-xl border ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                    <CreditCard size={16} className="text-red-500 mb-2" />
                    <p className={`text-xs ${dm ? 'text-gray-400' : 'text-slate-500'}`}>المصاريف</p>
                    <p className="text-xl font-bold text-red-500">{filteredData.totalExpenses.toFixed(0)} DH</p>
                </div>
                <div className={`p-4 rounded-xl border ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                    <Users size={16} className="text-purple-500 mb-2" />
                    <p className={`text-xs ${dm ? 'text-gray-400' : 'text-slate-500'}`}>متوسط الطلب</p>
                    <p className="text-xl font-bold">{filteredData.avgOrder.toFixed(0)} DH</p>
                </div>
            </div>

            {/* Export Buttons */}
            <div className={`p-4 rounded-xl border ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                    <Download size={16} className="text-purple-500" /> تصدير البيانات (CSV)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button onClick={exportOrdersCSV}
                        className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium border transition ${dm ? 'border-gray-700 hover:bg-gray-800 text-gray-300' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}>
                        <ShoppingBag size={16} className="text-blue-500" /> تصدير الطلبات ({filteredData.fOrders.length})
                    </button>
                    <button onClick={exportExpensesCSV}
                        className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium border transition ${dm ? 'border-gray-700 hover:bg-gray-800 text-gray-300' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}>
                        <CreditCard size={16} className="text-red-500" /> تصدير المصاريف ({filteredData.fExpenses.length})
                    </button>
                    <button onClick={exportCustomersCSV}
                        className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium border transition ${dm ? 'border-gray-700 hover:bg-gray-800 text-gray-300' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}>
                        <Users size={16} className="text-purple-500" /> تصدير الزبائن ({filteredData.customers.length})
                    </button>
                </div>
            </div>

            {/* Monthly Breakdown */}
            {filteredData.monthlyData.length > 0 && (
                <div className={`rounded-xl border overflow-hidden ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                    <div className={`px-4 py-3 border-b flex items-center gap-2 ${dm ? 'border-gray-800' : 'border-slate-100'}`}>
                        <Calendar size={16} className="text-blue-500" />
                        <h3 className="text-sm font-bold">ملخص شهري</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className={dm ? 'bg-gray-800' : 'bg-slate-50'}>
                                    <th className="text-right px-4 py-2.5 font-bold">الشهر</th>
                                    <th className="text-right px-4 py-2.5 font-bold">الطلبات</th>
                                    <th className="text-right px-4 py-2.5 font-bold text-green-500">الإيرادات</th>
                                    <th className="text-right px-4 py-2.5 font-bold text-red-500">المصاريف</th>
                                    <th className="text-right px-4 py-2.5 font-bold">الصافي</th>
                                </tr>
                            </thead>
                            <tbody className={`divide-y ${dm ? 'divide-gray-800' : 'divide-slate-50'}`}>
                                {filteredData.monthlyData.map(([month, data]) => {
                                    const net = data.revenue - data.expenses;
                                    return (
                                        <tr key={month} className={dm ? 'hover:bg-gray-800' : 'hover:bg-slate-50'}>
                                            <td className="px-4 py-2.5 font-medium">{month}</td>
                                            <td className="px-4 py-2.5">{data.orders}</td>
                                            <td className="px-4 py-2.5 text-green-500 font-medium">{data.revenue.toFixed(0)} DH</td>
                                            <td className="px-4 py-2.5 text-red-500 font-medium">{data.expenses.toFixed(0)} DH</td>
                                            <td className={`px-4 py-2.5 font-bold ${net >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
                                                {net > 0 ? '+' : ''}{net.toFixed(0)} DH
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Top Customers */}
            {filteredData.customers.length > 0 && (
                <div className={`rounded-xl border overflow-hidden ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
                    <div className={`px-4 py-3 border-b flex items-center gap-2 ${dm ? 'border-gray-800' : 'border-slate-100'}`}>
                        <Users size={16} className="text-purple-500" />
                        <h3 className="text-sm font-bold">أفضل الزبائن</h3>
                    </div>
                    <div className={`divide-y ${dm ? 'divide-gray-800' : 'divide-slate-50'}`}>
                        {filteredData.customers.slice(0, 10).map((c, i) => (
                            <div key={c.phone} className="px-4 py-2.5 flex items-center gap-3">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i < 3 ? 'bg-yellow-500/20 text-yellow-600' : (dm ? 'bg-gray-800 text-gray-500' : 'bg-slate-100 text-slate-400')}`}>
                                    {i + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{c.name || 'بدون اسم'}</p>
                                    <p className={`text-[10px] ${dm ? 'text-gray-600' : 'text-slate-400'}`}>{c.count} طلب • {c.phone}</p>
                                </div>
                                <span className="text-sm font-bold text-green-500">{c.total.toFixed(0)} DH</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReportsTab;
