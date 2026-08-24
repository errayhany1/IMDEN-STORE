import React, { useState } from 'react';
import {
    LayoutDashboard, ShoppingBag, Package, Settings, LogOut,
    ArrowRight, X, Menu, ClipboardList, RefreshCcw, ChevronDown, ChevronUp,
    Store, Bot, Link2, Megaphone, Truck,
} from 'lucide-react';

const sidebarGroups = [
    {
        id: 'dashboard',
        label: 'لوحة التحكم',
        icon: LayoutDashboard,
        children: null,
    },
    {
        id: 'operations',
        label: 'الطلبات',
        icon: ClipboardList,
        children: [
            { id: 'orders', label: 'طلبات الموقع', icon: ShoppingBag },
            { id: 'tifawt-orders', label: 'طلبات Tifawt', icon: Store },
            { id: 'jumia-orders', label: 'طلبات Jumia', icon: Package },
            { id: 'returns', label: 'مرتجعات الموقع', icon: RefreshCcw },
        ],
    },
    {
        id: 'products',
        label: 'المنتجات',
        icon: Package,
        children: [
            { id: 'products', label: 'منتجات الموقع', icon: Package },
            { id: 'inventory-sync', label: 'مطابقة Tifawt', icon: Link2 },
        ],
    },
    {
        id: 'dropship',
        label: 'الدروبشيبينغ',
        icon: Truck,
        children: null,
    },
    {
        id: 'social-publish',
        label: 'نشر المحتوى',
        icon: Megaphone,
        children: null,
    },
    {
        id: 'bot-settings',
        label: 'مركز تحكم البوت',
        icon: Bot,
        children: null,
    },
    {
        id: 'settings',
        label: 'الإعدادات',
        icon: Settings,
        children: null,
    },
];

const AdminSidebar = ({ activeTab, setActiveTab, dm, onLogout, mobileOpen, setMobileOpen }) => {
    const [expanded, setExpanded] = useState(() => {
        for (const group of sidebarGroups) {
            if (group.children?.some((c) => c.id === activeTab)) return group.id;
        }
        return null;
    });

    const handleNav = (id) => {
        setActiveTab(id);
        setMobileOpen(false);
    };

    const toggleGroup = (groupId) => {
        setExpanded((prev) => (prev === groupId ? null : groupId));
    };

    const isGroupActive = (group) => {
        if (group.id === activeTab) return true;
        if (group.children) return group.children.some((c) => c.id === activeTab);
        return false;
    };

    const sidebarContent = (isMobile = false) => (
        <div className={`flex flex-col h-full ${
            isMobile
                ? (dm ? 'bg-gray-900/85 backdrop-blur-xl' : 'bg-white/85 backdrop-blur-xl')
                : (dm ? 'bg-gray-900' : 'bg-white')
        }`}>
            <div className={`flex items-center justify-center px-5 py-5 border-b h-20 ${dm ? 'border-gray-800' : 'border-slate-100'}`}>
                <img
                    src={dm ? '/logo-dark.png' : '/logo.png'}
                    alt="Errayhany Store"
                    className="max-w-[150px] max-h-[50px] object-contain"
                />
                {isMobile && (
                    <button type="button" onClick={() => setMobileOpen(false)} className="absolute left-3 p-1">
                        <X size={18} className={dm ? 'text-gray-500' : 'text-slate-400'} />
                    </button>
                )}
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
                {sidebarGroups.map((group) => {
                    const Icon = group.icon;
                    const isActive = isGroupActive(group);
                    const isExpanded = expanded === group.id;
                    const hasChildren = group.children && group.children.length > 0;

                    return (
                        <div key={group.id}>
                            <button
                                type="button"
                                onClick={() => {
                                    if (hasChildren) toggleGroup(group.id);
                                    else handleNav(group.id);
                                }}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                                    ${isActive
                                        ? `${dm ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-50 text-blue-700'} font-bold`
                                        : `${dm ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`
                                    }`}
                            >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                    isActive
                                        ? (dm ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600')
                                        : (dm ? 'bg-gray-800 text-gray-500' : 'bg-slate-100 text-slate-400')
                                }`}>
                                    <Icon size={16} />
                                </div>
                                <span className="flex-1 text-right">{group.label}</span>
                                {hasChildren && (
                                    isExpanded
                                        ? <ChevronUp size={14} className={dm ? 'text-gray-600' : 'text-slate-400'} />
                                        : <ChevronDown size={14} className={dm ? 'text-gray-600' : 'text-slate-400'} />
                                )}
                                {!hasChildren && isActive && (
                                    <div className={`w-1.5 h-1.5 rounded-full ${dm ? 'bg-blue-400' : 'bg-blue-500'}`} />
                                )}
                            </button>

                            {hasChildren && isExpanded && (
                                <div className="mr-5 mt-0.5 mb-1 space-y-0.5 border-r-2 pr-3" style={{ borderColor: dm ? '#374151' : '#e2e8f0' }}>
                                    {group.children.map((child) => {
                                        const ChildIcon = child.icon;
                                        const childActive = activeTab === child.id;
                                        return (
                                            <button
                                                key={child.id}
                                                type="button"
                                                onClick={() => handleNav(child.id)}
                                                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all
                                                    ${childActive
                                                        ? `${dm ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'} font-bold`
                                                        : `${dm ? 'text-gray-500 hover:bg-gray-800 hover:text-gray-300' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`
                                                    }`}
                                            >
                                                <ChildIcon size={14} />
                                                <span>{child.label}</span>
                                                {childActive && (
                                                    <div className={`w-1 h-1 rounded-full mr-auto ${dm ? 'bg-blue-400' : 'bg-blue-500'}`} />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </nav>

            <div className={`px-3 py-4 border-t space-y-2 ${dm ? 'border-gray-800' : 'border-slate-100'}`}>
                <button type="button" onClick={() => { window.location.href = '/'; }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
                        ${dm ? 'text-gray-500 hover:bg-gray-800 hover:text-gray-300' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}>
                    <ArrowRight size={18} />
                    العودة للمتجر
                </button>
                <button type="button" onClick={onLogout}
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
            <button type="button" onClick={() => setMobileOpen(true)}
                className={`sm:hidden fixed top-3 right-3 z-40 p-2 rounded-xl shadow-lg border ${dm ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-slate-200 text-slate-700'}`}>
                <Menu size={20} />
            </button>

            <aside className={`hidden sm:flex flex-col w-60 shrink-0 fixed top-0 right-0 h-full z-30 border-l ${dm ? 'border-gray-800' : 'border-slate-200'}`}>
                {sidebarContent(false)}
            </aside>

            {mobileOpen && (
                <>
                    <div className="sm:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={() => setMobileOpen(false)} />
                    <aside className="sm:hidden fixed top-0 right-0 h-full w-[270px] z-50 shadow-2xl rounded-l-2xl overflow-hidden">
                        {sidebarContent(true)}
                    </aside>
                </>
            )}
        </>
    );
};

export default AdminSidebar;
