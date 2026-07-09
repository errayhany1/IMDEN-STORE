import React, { useState } from 'react';
import { Search, ShoppingCart, LayoutGrid, Columns2, User, Menu, X, LogOut, MapPin, Moon, Sun, Info, MessageSquare, Truck, ShoppingBag } from 'lucide-react';
import useStore from '../store/useStore';
import DarkModeToggle from './DarkModeToggle';
import { motion, AnimatePresence } from 'framer-motion';
import BottomNav from './BottomNav';

const Header = () => {
    const { cart, toggleCart, searchQuery, setSearchQuery, darkMode, toggleDarkMode, iosTheme, toggleIosTheme, gridColumns, toggleGridColumns, user, setAuthModalOpen, setAboutModalOpen, customerInfo, setCustomerInfo } = useStore();
    const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [editingInfo, setEditingInfo] = useState(false);
    const [tempInfo, setTempInfo] = useState({ name: '', phone: '', address: '' });
    const [currentLang, setCurrentLang] = useState('ar');
    const [langDropdownOpen, setLangDropdownOpen] = useState(false);

    React.useEffect(() => {
        const match = document.cookie.match(/googtrans=\/ar\/([a-z]{2})/);
        if (match && match[1]) {
            setCurrentLang(match[1]);
        }
    }, []);

    const isRtl = currentLang === 'ar';
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
                ${iosTheme ? 'glass-header border-transparent' : (dm ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200')}`}>

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
                    <div className="flex items-center flex-shrink-0 cursor-pointer" onClick={scrollToTop}>
                        <img src="/logo.png" alt="Errayhany Grossiste" className="h-8 sm:h-10 w-auto object-contain" style={{maxWidth: '160px'}} />
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

                        {/* Download App (Desktop) */}
                        <a
                            href="/ImdenStore.apk"
                            download="ImdenStore.apk"
                            title="تحميل التطبيق"
                            className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 mx-1 rounded-lg font-bold text-xs transition-colors bg-green-500 text-white hover:bg-green-600`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                            تطبيق الأندرويد
                        </a>

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
                            initial={{ x: isRtl ? '100%' : '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: isRtl ? '100%' : '-100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className={`fixed top-0 ${isRtl ? 'right-0 border-l' : 'left-0 border-r'} h-full w-72 z-[101] shadow-2xl flex flex-col
                            ${dm ? 'bg-gray-900 border-gray-700' : 'bg-white border-slate-200'}`}
                           
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

                                {/* My Account & Orders (logged in) */}
                                {user && (
                                    <a
                                        href="/account"
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition
                                        ${dm ? 'hover:bg-gray-800 text-blue-400' : 'hover:bg-blue-50 text-blue-600'}`}
                                    >
                                        <ShoppingBag size={18} className="text-blue-500" />
                                        حسابي وطلباتي
                                    </a>
                                )}

                                {/* My Orders (for non-logged users with saved phone) */}
                                {!user && (
                                    <a
                                        href="/account"
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition
                                        ${dm ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-slate-50 text-slate-700'}`}
                                    >
                                        <ShoppingBag size={18} className="text-blue-500" />
                                        طلباتي
                                    </a>
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

                                {/* Language Switcher */}
                                <div className={`px-3 py-3 mt-1 mb-1 rounded-xl border ${dm ? 'border-gray-700 bg-gray-800/50' : 'border-slate-200 bg-slate-50'}`}>
                                    <p className="text-xs font-bold mb-2 flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                                        لغة الموقع / Language
                                    </p>
                                    <div className="relative">
                                        <button 
                                            onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                                            className={`w-full flex items-center justify-between text-xs px-3 py-2.5 rounded-lg font-bold shadow-sm transition border ${dm ? 'bg-gray-700 text-white border-gray-600 hover:bg-gray-600' : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'}`}
                                        >
                                            <span className="flex items-center gap-2">
                                                {currentLang === 'ar' ? 'العربية' : currentLang === 'fr' ? 'Français' : currentLang === 'en' ? 'English' : 'Español'}
                                            </span>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transform transition-transform ${langDropdownOpen ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"/></svg>
                                        </button>
                                        
                                        <AnimatePresence>
                                            {langDropdownOpen && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: -10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -10 }}
                                                    className={`absolute top-full left-0 right-0 mt-1 z-10 rounded-lg shadow-xl border overflow-hidden ${dm ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-200'}`}
                                                >
                                                    {[
                                                        { code: 'ar', label: 'العربية' },
                                                        { code: 'fr', label: 'Français' },
                                                        { code: 'en', label: 'English' },
                                                        { code: 'es', label: 'Español' }
                                                    ].map((lang) => (
                                                        <button
                                                            key={lang.code}
                                                            onClick={() => {
                                                                document.cookie = `googtrans=/ar/${lang.code}; path=/; domain=${window.location.hostname}`;
                                                                document.cookie = `googtrans=/ar/${lang.code}; path=/;`;
                                                                window.location.reload();
                                                            }}
                                                            className={`w-full text-start px-3 py-2.5 text-xs font-bold transition-colors border-b last:border-b-0 ${currentLang === lang.code ? (dm ? 'bg-primary/20 text-primary' : 'bg-blue-50 text-blue-600') : (dm ? 'text-gray-300 hover:bg-gray-700' : 'text-slate-700 hover:bg-slate-50')} ${dm ? 'border-gray-700' : 'border-slate-100'}`}
                                                        >
                                                            {lang.label}
                                                        </button>
                                                    ))}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>

                                {/* Dark Mode */}
                                <button
                                    onClick={toggleDarkMode}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition
                                    ${dm ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-slate-50 text-slate-700'}`}
                                >
                                    {dm ? <Sun size={18} className="text-yellow-400" /> : <Moon size={18} className="text-slate-500" />}
                                    {dm ? 'الوضع الفاتح' : 'الوضع الداكن'}
                                </button>

                                {/* iOS Theme Toggle */}
                                <button
                                    onClick={toggleIosTheme}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition
                                    ${dm ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-slate-50 text-slate-700'}`}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-500"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>
                                    {iosTheme ? 'إلغاء ثيم iOS' : 'تفعيل ثيم iOS'}
                                </button>

                                {/* Track Order */}
                                <a
                                    href="/tracking"
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition
                                    ${dm ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-slate-50 text-slate-700'}`}
                                >
                                    <Truck size={18} className="text-blue-500" />
                                    تتبع طلبك
                                </a>

                                {/* WhatsApp Support */}
                                <a
                                    href="https://wa.me/212664630566"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition
                                    ${dm ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-slate-50 text-slate-700'}`}
                                >
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp" className="w-5 h-5" />
                                    تواصل معنا عبر واتساب
                                </a>

                                {/* Download App Button */}
                                <a
                                    href="/ImdenStore.apk"
                                    download="ImdenStore.apk"
                                    className="w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm font-bold bg-green-500 text-white hover:bg-green-600 transition shadow-sm mt-1 mb-1"
                                >
                                    <div className="flex items-center gap-3">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                                        تحميل تطبيق المتجر للأندرويد
                                    </div>
                                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">APK</span>
                                </a>

                                {/* About */}
                                <button
                                    onClick={() => { setSidebarOpen(false); setAboutModalOpen(true); }}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition
                                    ${dm ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-slate-50 text-slate-700'}`}
                                >
                                    <Info size={18} className="text-blue-500" />
                                    حول Errayhany Store
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
            
            {iosTheme && <BottomNav setSidebarOpen={setSidebarOpen} />}
        </>
    );
};

export default Header;
