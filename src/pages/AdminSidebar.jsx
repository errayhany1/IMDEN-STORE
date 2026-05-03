import React from 'react';
import { LayoutDashboard, ShoppingBag, Users, Package, Settings, LogOut, ArrowRight, X, Menu, CreditCard } from 'lucide-react';

const sidebarItems = [
    { id: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
    { id: 'orders', label: 'الطلبات', icon: ShoppingBag },
    { id: 'customers', label: 'الزبائن', icon: Users },
    { id: 'products', label: 'المنتجات', icon: Package },
    { id: 'expenses', label: 'المصاريف', icon: CreditCard },
    { id: 'settings', label: 'الإعدادات', icon: Settings },
];

const AdminSidebar = ({ activeTab, setActiveTab, dm, onLogout, mobileOpen, setMobileOpen }) => {
    const handleNav = (id) => {
        setActiveTab(id);
        setMobileOpen(false);
    };

    const sidebarContent = (
        <div className={`flex flex-col h-full ${dm ? 'bg-gray-900' : 'bg-white'}`}>
            {/* Logo */}
            <div className={`flex items-center gap-3 px-5 py-5 border-b ${dm ? 'border-gray-800' : 'border-slate-100'}`}>
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <Package size={20} className="text-white" />
                </div>
                <div>
                    <h1 className="text-sm font-extrabold tracking-tight">IMDEN Admin</h1>
                    <p className={`text-[10px] ${dm ? 'text-gray-600' : 'text-slate-400'}`}>لوحة الإدارة</p>
                </div>
                <button onClick={() => setMobileOpen(false)} className="sm:hidden mr-auto p-1">
                    <X size={18} className={dm ? 'text-gray-500' : 'text-slate-400'} />
                </button>
            </div>

            {/* Nav Items */}
            <nav className="flex-1 px-3 py-4 space-y-1">
                {sidebarItems.map(item => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                        <button key={item.id} onClick={() => handleNav(item.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                                ${isActive 
                                    ? `${dm ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-50 text-blue-600'} font-bold` 
                                    : `${dm ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`
                                }`}
                        >
                            <Icon size={18} />
                            {item.label}
                            {isActive && <div className={`w-1.5 h-1.5 rounded-full mr-auto ${dm ? 'bg-blue-400' : 'bg-blue-500'}`} />}
                        </button>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className={`px-3 py-4 border-t space-y-2 ${dm ? 'border-gray-800' : 'border-slate-100'}`}>
                <button onClick={() => window.location.href = '/'}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
                        ${dm ? 'text-gray-500 hover:bg-gray-800 hover:text-gray-300' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}>
                    <ArrowRight size={18} />
                    العودة للمتجر
                </button>
                <button onClick={onLogout}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 transition-colors
                        ${dm ? 'hover:bg-red-500/10' : 'hover:bg-red-50'}`}>
                    <LogOut size={18} />
                    تسجيل الخروج
                </button>
            </div>
        </div>
    );

    return (
        <>
            {/* Mobile Hamburger */}
            <button onClick={() => setMobileOpen(true)}
                className={`sm:hidden fixed top-3 right-3 z-40 p-2 rounded-xl shadow-lg border ${dm ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-slate-200 text-slate-700'}`}>
                <Menu size={20} />
            </button>

            {/* Desktop Sidebar */}
            <aside className={`hidden sm:flex flex-col w-56 shrink-0 fixed top-0 right-0 h-full z-30 border-l ${dm ? 'border-gray-800' : 'border-slate-200'}`}>
                {sidebarContent}
            </aside>

            {/* Mobile Sidebar Overlay */}
            {mobileOpen && (
                <>
                    <div className="sm:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={() => setMobileOpen(false)} />
                    <aside className="sm:hidden fixed top-0 right-0 h-full w-64 z-50 shadow-2xl">
                        {sidebarContent}
                    </aside>
                </>
            )}
        </>
    );
};

export default AdminSidebar;
