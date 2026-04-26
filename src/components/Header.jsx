import React, { useState } from 'react';
import { Search, ShoppingCart, LayoutGrid, Columns2, User, Menu, X, LogOut, MapPin, Moon, Sun, Info, MessageSquare } from 'lucide-react';
import useStore from '../store/useStore';
import DarkModeToggle from './DarkModeToggle';
import { motion, AnimatePresence } from 'framer-motion';

const Header = () => {
    const { cart, toggleCart, searchQuery, setSearchQuery, darkMode, toggleDarkMode, gridColumns, toggleGridColumns, user, setAuthModalOpen, customerInfo, setCustomerInfo } = useStore();
    const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [editingInfo, setEditingInfo] = useState(false);
    const [tempInfo, setTempInfo] = useState({ name: '', phone: '', address: '' });

    const dm = darkMode;

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleOpenEditInfo = () => {
        setTempInfo({
            name: customerInfo?.name || user?.displayName || '',
            phone: customerInfo?.phone || '',
            address: customerInfo?.address || ''
        });
        setEditingInfo(true);
    };

    const handleSaveInfo = () => {
        setCustomerInfo(tempInfo);
        setEditingInfo(false);
    };

    const handleLogout = () => {
        import('../services/firebase').then(m => m.auth.signOut());
        setSidebarOpen(false);
    };

    return (
        <>
            <header id="page-top" className={`sticky top-0 z-40 w-full border-b shadow-sm transition-colors duration-300
                ${dm ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>

                {/* ─── Main Bar ─── */}
                <div className="max-w-7xl mx-auto px-3 h-12 flex items-center justify-between gap-2">

                    {/* Menu Button (Mobile) */}
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className={`p-1.5 rounded-lg transition-colors ${dm ? 'text-gray-300 hover:bg-gray-700' : 'text-slate-500 hover:bg-slate-100'}`}
                        aria-label="القائمة"
                    >
                        <Menu size={20} />
                    </button>

                    {/* Logo */}
                    <div className="flex items-center gap-2 flex-shrink-0 cursor-pointer" onClick={scrollToTop}>
                        <img src="/logo.jpg" alt="IMDEN TECHNOLOGY" className="h-7 w-7 sm:h-9 sm:w-9 rounded shadow-sm object-cover" />
                        <span className={`hidden sm:block text-lg font-bold tracking-tight ${dm ? 'text-white' : 'text-slate-900'}`}>
                            IMDEN <span className="text-primary">TECHNOLOGY</span>
                        </span>
                    </div>

                    {/* Desktop Search Bar */}
                    <div className="hidden md:flex flex-1 max-w-md mx-4 relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="text-slate-400" size={16} />
                        </span>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={`block w-full pl-9 pr-3 py-1.5 border rounded-lg text-sm text-right focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary
                                ${dm ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'}`}
                            placeholder="...ابحث بالمرجع أو الاسم"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-0.5">

                        {/* Grid Toggle — Mobile only */}
                        <button
                            onClick={toggleGridColumns}
                            className={`md:hidden p-1.5 rounded-lg transition-colors ${dm ? 'text-gray-300 hover:bg-gray-700' : 'text-slate-500 hover:bg-slate-100'}`}
                            aria-label="تغيير عدد الأعمدة"
                        >
                            {gridColumns === 1 ? <LayoutGrid size={20} /> : <Columns2 size={20} />}
                        </button>

                        {/* Account */}
                        {user ? (
                            <div className="cursor-pointer transition-transform hover:scale-105" 
                                 onClick={() => setSidebarOpen(true)}
                                 title="حسابي"
                            >
                                <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}&background=random&size=32`} alt="User" className="w-7 h-7 rounded-full shadow-sm border border-gray-200" />
                            </div>
                        ) : (
                            <button
                                onClick={() => setAuthModalOpen(true)}
                                className={`p-1.5 rounded-lg transition-colors ${dm ? 'text-gray-300 hover:bg-gray-700' : 'text-slate-500 hover:bg-slate-100'}`}
                                aria-label="تسجيل الدخول"
                            >
                                <User size={20} />
                            </button>
                        )}

                        {/* Cart */}
                        <div className="relative cursor-pointer" onClick={toggleCart}>
                            <button className={`p-1.5 rounded-lg transition-colors ${dm ? 'text-gray-300 hover:bg-gray-700' : 'text-slate-500 hover:text-primary hover:bg-slate-100'}`}>
                                <ShoppingCart size={20} />
                            </button>
                            {cartCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white">
                                    {cartCount}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* ─── Mobile Search Bar (compact) ─── */}
                <div className={`md:hidden px-3 pb-2 ${dm ? 'bg-gray-900' : 'bg-white'}`}>
                    <div className="relative">
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                            <Search size={16} />
                        </div>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={`block w-full py-2 pr-9 pl-3 border rounded-xl text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all
                                ${dm ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'}`}
                            placeholder="ابحث عن المنتجات..."
                        />
                    </div>
                </div>
            </header>

            {/* ─── Sidebar Drawer ─── */}
            <AnimatePresence>
                {sidebarOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => { setSidebarOpen(false); setEditingInfo(false); }}
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]"
                        />
                        {/* Drawer */}
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className={`fixed top-0 right-0 h-full w-72 z-[101] shadow-2xl flex flex-col
                            ${dm ? 'bg-gray-900 border-l border-gray-700' : 'bg-white border-l border-slate-200'}`}
                            dir="rtl"
                        >
                            {/* Drawer Header */}
                            <div className={`px-4 py-4 border-b flex items-center justify-between ${dm ? 'border-gray-700' : 'border-slate-100'}`}>
                                <div className="flex items-center gap-3">
                                    {user ? (
                                        <>
                                            <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}&background=random&size=40`} alt="" className="w-10 h-10 rounded-full border" />
                                            <div>
                                                <p className="text-sm font-bold">{user.displayName || 'مستخدم'}</p>
                                                <p className={`text-xs ${dm ? 'text-gray-400' : 'text-slate-500'}`}>{user.email || user.phoneNumber || ''}</p>
                                            </div>
                                        </>
                                    ) : (
                                        <p className="text-sm font-bold">القائمة</p>
                                    )}
                                </div>
                                <button onClick={() => { setSidebarOpen(false); setEditingInfo(false); }} className={`p-1.5 rounded-full ${dm ? 'hover:bg-gray-800' : 'hover:bg-slate-100'}`}>
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Drawer Body */}
                            <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-1">
                                
                                {!user && (
                                    <button
                                        onClick={() => { setSidebarOpen(false); setAuthModalOpen(true); }}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium bg-primary text-white hover:bg-primary/90 transition mb-2"
                                    >
                                        <User size={18} />
                                        تسجيل الدخول
                                    </button>
                                )}

                                {/* Delivery Info */}
                                {!editingInfo ? (
                                    <button
                                        onClick={handleOpenEditInfo}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition
                                        ${dm ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-slate-50 text-slate-700'}`}
                                    >
                                        <MapPin size={18} className="text-primary" />
                                        تعديل معلومات التوصيل
                                    </button>
                                ) : (
                                    <div className={`p-3 rounded-xl border ${dm ? 'border-gray-700 bg-gray-800' : 'border-slate-200 bg-slate-50'}`}>
                                        <p className="text-xs font-bold mb-2">تعديل معلومات التوصيل</p>
                                        <input
                                            type="text"
                                            placeholder="الاسم الكامل"
                                            value={tempInfo.name}
                                            onChange={e => setTempInfo(p => ({ ...p, name: e.target.value }))}
                                            className={`w-full p-2 text-xs rounded-lg border mb-2 ${dm ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-slate-200'}`}
                                        />
                                        <input
                                            type="tel"
                                            placeholder="رقم الهاتف"
                                            value={tempInfo.phone}
                                            onChange={e => setTempInfo(p => ({ ...p, phone: e.target.value }))}
                                            className={`w-full p-2 text-xs rounded-lg border mb-2 ${dm ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-slate-200'}`}
                                        />
                                        <textarea
                                            placeholder="العنوان"
                                            value={tempInfo.address}
                                            onChange={e => setTempInfo(p => ({ ...p, address: e.target.value }))}
                                            rows={2}
                                            className={`w-full p-2 text-xs rounded-lg border mb-2 resize-none ${dm ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-slate-200'}`}
                                        />
                                        <div className="flex gap-2">
                                            <button onClick={handleSaveInfo} className="flex-1 bg-primary text-white text-xs py-1.5 rounded-lg font-bold">حفظ</button>
                                            <button onClick={() => setEditingInfo(false)} className={`flex-1 text-xs py-1.5 rounded-lg font-bold border ${dm ? 'border-gray-700 text-gray-300' : 'border-slate-200 text-slate-600'}`}>إلغاء</button>
                                        </div>
                                    </div>
                                )}

                                {/* Dark Mode */}
                                <button
                                    onClick={toggleDarkMode}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition
                                    ${dm ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-slate-50 text-slate-700'}`}
                                >
                                    {dm ? <Sun size={18} className="text-yellow-400" /> : <Moon size={18} className="text-slate-500" />}
                                    {dm ? 'الوضع الفاتح' : 'الوضع الداكن'}
                                </button>

                                {/* WhatsApp Support */}
                                <a
                                    href="https://wa.me/212664630566"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition
                                    ${dm ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-slate-50 text-slate-700'}`}
                                >
                                    <MessageSquare size={18} className="text-green-500" />
                                    تواصل معنا عبر واتساب
                                </a>

                                {/* About */}
                                <button
                                    onClick={scrollToTop}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition
                                    ${dm ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-slate-50 text-slate-700'}`}
                                >
                                    <Info size={18} className="text-blue-500" />
                                    حول IMDEN TECHNOLOGY
                                </button>
                            </div>

                            {/* Drawer Footer */}
                            {user && (
                                <div className={`px-3 py-3 border-t ${dm ? 'border-gray-700' : 'border-slate-100'}`}>
                                    <button
                                        onClick={handleLogout}
                                        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition"
                                    >
                                        <LogOut size={18} />
                                        تسجيل الخروج
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
};

export default Header;
