import React, { useState } from 'react';
import {
    LayoutDashboard, ShoppingBag, Users, Package, Settings, LogOut,
    ArrowRight, X, Menu, CreditCard, ChevronDown, ChevronUp,
    ClipboardList, Clock, UserCheck, Building2, Truck as TruckIcon,
    BarChart3, TrendingUp, FileText, Wallet, RefreshCcw, ShieldCheck,
    AlertTriangle, DollarSign, Globe, Receipt
} from 'lucide-react';

const sidebarGroups = [
    {
        id: 'dashboard',
        label: 'لوحة التحكم',
        icon: LayoutDashboard,
        children: null, // No children = direct link
    },
    {
        id: 'operations',
        label: 'العمليات',
        icon: ClipboardList,
        children: [
            { id: 'orders', label: 'الطلبات', icon: ShoppingBag },
            { id: 'direct-sales', label: 'المبيعات المباشرة', icon: DollarSign },
            { id: 'returns', label: 'المرتجعات', icon: RefreshCcw },
        ],
    },
    {
        id: 'organization',
        label: 'التنظيم',
        icon: Building2,
        children: [
            { id: 'customers', label: 'الزبائن', icon: Users },
            { id: 'suppliers', label: 'الموردين', icon: UserCheck },
        ],
    },
    {
        id: 'inventory',
        label: 'المخزون',
        icon: Package,
        children: [
            { id: 'products', label: 'المنتجات', icon: Package },
        ],
    },
    {
        id: 'finance',
        label: 'المالية',
        icon: Wallet,
        children: [
            { id: 'expenses', label: 'المصاريف', icon: CreditCard },
            { id: 'wallets', label: 'المحافظ', icon: Wallet },
        ],
    },
    {
        id: 'analytics',
        label: 'التحليلات',
        icon: BarChart3,
        children: [
            { id: 'profit-dashboard', label: 'لوحة الأرباح', icon: TrendingUp },
            { id: 'reports', label: 'التقارير', icon: FileText },
        ],
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
        // Auto-expand the group that contains the active tab
        for (const group of sidebarGroups) {
            if (group.children) {
                if (group.children.some(c => c.id === activeTab)) {
                    return group.id;
                }
            }
        }
        return null;
    });

    const handleNav = (id) => {
        setActiveTab(id);
        setMobileOpen(false);
    };

    const toggleGroup = (groupId) => {
        setExpanded(prev => prev === groupId ? null : groupId);
    };

    // Check if a group or any of its children is currently active
    const isGroupActive = (group) => {
        if (group.id === activeTab) return true;
        if (group.children) {
            return group.children.some(c => c.id === activeTab);
        }
        return false;
    };

    const sidebarContent = (isMobile = false) => (
        <div className={`flex flex-col h-full ${
            isMobile 
                ? (dm ? 'bg-gray-900/85 backdrop-blur-xl' : 'bg-white/85 backdrop-blur-xl')
                : (dm ? 'bg-gray-900' : 'bg-white')
        }`}>
            {/* Logo / Brand */}
            <div className={`flex items-center justify-center px-5 py-5 border-b h-20 ${dm ? 'border-gray-800' : 'border-slate-100'}`}>
                <img 
                    src="/logo.png" 
                    alt="IMDEN STORE" 
                    className="max-w-[150px] max-h-[50px] object-contain"
                />
                {isMobile && (
                    <button onClick={() => setMobileOpen(false)} className="absolute left-3 p-1">
                        <X size={18} className={dm ? 'text-gray-500' : 'text-slate-400'} />
                    </button>
                )}
            </div>

            {/* Nav Items */}
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
                {sidebarGroups.map(group => {
                    const Icon = group.icon;
                    const isActive = isGroupActive(group);
                    const isExpanded = expanded === group.id;
                    const hasChildren = group.children && group.children.length > 0;

                    return (
                        <div key={group.id}>
                            {/* Group Header / Direct Link */}
                            <button
                                onClick={() => {
                                    if (hasChildren) {
                                        toggleGroup(group.id);
                                    } else {
                                        handleNav(group.id);
                                    }
                                }}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                                    ${isActive
                                        ? `${dm ? 'bg-purple-500/15 text-purple-400' : 'bg-purple-50 text-purple-700'} font-bold`
                                        : `${dm ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`
                                    }`}
                            >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                    isActive
                                        ? (dm ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600')
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
                                    <div className={`w-1.5 h-1.5 rounded-full ${dm ? 'bg-purple-400' : 'bg-purple-500'}`} />
                                )}
                            </button>

                            {/* Children */}
                            {hasChildren && isExpanded && (
                                <div className="mr-5 mt-0.5 mb-1 space-y-0.5 border-r-2 pr-3" style={{ borderColor: dm ? '#374151' : '#e2e8f0' }}>
                                    {group.children.map(child => {
                                        const ChildIcon = child.icon;
                                        const childActive = activeTab === child.id;
                                        return (
                                            <button
                                                key={child.id}
                                                onClick={() => handleNav(child.id)}
                                                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all
                                                    ${childActive
                                                        ? `${dm ? 'bg-purple-500/10 text-purple-400' : 'bg-purple-50 text-purple-600'} font-bold`
                                                        : `${dm ? 'text-gray-500 hover:bg-gray-800 hover:text-gray-300' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`
                                                    }`}
                                            >
                                                <ChildIcon size={14} />
                                                <span>{child.label}</span>
                                                {childActive && (
                                                    <div className={`w-1 h-1 rounded-full mr-auto ${dm ? 'bg-purple-400' : 'bg-purple-500'}`} />
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
            <aside className={`hidden sm:flex flex-col w-60 shrink-0 fixed top-0 right-0 h-full z-30 border-l ${dm ? 'border-gray-800' : 'border-slate-200'}`}>
                {sidebarContent(false)}
            </aside>

            {/* Mobile Sidebar Overlay */}
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
