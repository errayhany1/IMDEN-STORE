import React, { useState, useRef, useEffect } from 'react';
import { Search, ShoppingCart, LayoutGrid, Columns2, User, Menu, X, LogOut, MapPin, Moon, Sun, Info, Truck, ShoppingBag, Heart, Settings, ChevronDown, Globe2 } from 'lucide-react';
import useStore from '../store/useStore';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { upsertCustomerProfile } from '../services/customerAccount';

const Header = () => {
    const { cart, toggleCart, wishlist, toggleWishlistSidebar, searchQuery, setSearchQuery, darkMode, toggleDarkMode, gridColumns, toggleGridColumns, user, setAuthModalOpen, setAboutModalOpen, customerInfo, setCustomerInfo, clearCustomerInfo } = useStore();
    const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
    const wishlistCount = wishlist.length;
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [editingInfo, setEditingInfo] = useState(false);
    const [tempInfo, setTempInfo] = useState({ name: '', phone: '', address: '' });
    const [currentLang, setCurrentLang] = useState('ar');
    const [langDropdownOpen, setLangDropdownOpen] = useState(false);
    const [additionalSettingsOpen, setAdditionalSettingsOpen] = useState(false);
    const searchInputRef = useRef(null);

    React.useEffect(() => {
        const match = document.cookie.match(/googtrans=\/ar\/([a-z]{2})/);
        if (match && match[1]) {
            setCurrentLang(match[1]);
        }
    }, []);

    useEffect(() => {
        try {
            if (sessionStorage.getItem('focusHeaderSearch') === '1') {
                sessionStorage.removeItem('focusHeaderSearch');
                const t = setTimeout(() => searchInputRef.current?.focus(), 120);
                return () => clearTimeout(t);
            }
        } catch {
            /* ignore */
        }
        return undefined;
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

    const handleSaveInfo = async () => {
        const updatedInfo = {
            ...customerInfo,
            ...tempInfo,
            ...(user && customerInfo?.phoneVerified
                ? {
                    phone: customerInfo.phone,
                    normalizedPhone: customerInfo.normalizedPhone,
                    phoneVerified: true,
                }
                : {}),
        };
        setCustomerInfo(updatedInfo);
        setEditingInfo(false);
        if (user && customerInfo?.phoneVerified) {
            try {
                await upsertCustomerProfile(user, updatedInfo);
            } catch (error) {
                console.error('Failed to update customer profile:', error);
            }
        }
    };

    const handleLogout = () => {
        clearCustomerInfo();
        import('../services/firebase').then(m => m.auth.signOut());
        setSidebarOpen(false);
    };

    return (
        <>
            <header
                id="page-top"
                className={`sticky top-0 z-40 w-full transition-colors duration-300 pt-[env(safe-area-inset-top)]
                    ${dm ? 'bg-gray-950' : 'bg-background-light'}`}
            >
                <div className="max-w-7xl mx-auto px-3 sm:px-4 pt-2.5 sm:pt-3 pb-2">
                    {/* Floating bar — logo | search | menu (matches brand mockup) */}
                    <div
                        dir="ltr"
                        className={`flex items-center gap-2.5 sm:gap-4 h-14 sm:h-[60px] px-3 sm:px-5 rounded-2xl border shadow-[0_4px_18px_rgba(15,23,42,0.07)]
                            ${dm ? 'bg-[#142038] border-white/5 shadow-black/30' : 'bg-white border-slate-100'}`}
                    >
                        {/* Logo */}
                        <button
                            type="button"
                            onClick={scrollToTop}
                            className="flex items-center flex-shrink-0 focus:outline-none"
                            aria-label="Errayhany Grossiste"
                        >
                            <img
                                src={dm ? '/logo-dark.png' : '/logo.png'}
                                alt="Errayhany TECHNOLOGY"
                                className="h-8 sm:h-9 w-auto object-contain"
                                style={{ maxWidth: '150px' }}
                            />
                        </button>

                        {/* Pill search */}
                        <div className="relative flex-1 min-w-0">
                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                <Search className={dm ? 'text-slate-400' : 'text-slate-400'} size={16} strokeWidth={2} />
                            </span>
                            <input
                                ref={searchInputRef}
                                type="search"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                dir="rtl"
                                className={`block w-full h-10 sm:h-11 pl-10 pr-4 border rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-shadow
                                    ${dm
                                        ? 'bg-[#0f1a2e] border-slate-600 text-white placeholder-gray-400'
                                        : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                                placeholder="ابحث عن المنتجات..."
                                aria-label="ابحث عن المنتجات"
                            />
                        </div>

                        {/* Desktop actions (mobile uses bottom nav) */}
                        <div className="hidden md:flex items-center gap-0.5 flex-shrink-0">
                            {user ? (
                                <button
                                    type="button"
                                    className="cursor-pointer transition-transform hover:scale-105 p-0.5"
                                    onClick={() => setSidebarOpen(true)}
                                    title="حسابي"
                                >
                                    <img
                                        src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}&background=random&size=32`}
                                        alt="User"
                                        className="w-7 h-7 rounded-full shadow-sm border border-gray-200"
                                    />
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setAuthModalOpen(true)}
                                    className={`p-2 rounded-xl transition-colors ${dm ? 'text-gray-300 hover:bg-white/10' : 'text-[#0B2B5A] hover:bg-slate-100'}`}
                                    aria-label="تسجيل الدخول"
                                >
                                    <User size={20} />
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={toggleWishlistSidebar}
                                className={`relative p-2 rounded-xl transition-colors ${dm ? 'text-gray-300 hover:bg-white/10' : 'text-[#0B2B5A] hover:text-red-500 hover:bg-slate-100'}`}
                                aria-label="المفضلة"
                            >
                                <Heart size={20} />
                                {wishlistCount > 0 && (
                                    <span className="absolute top-0.5 end-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                                        {wishlistCount}
                                    </span>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={toggleCart}
                                className={`relative p-2 rounded-xl transition-colors ${dm ? 'text-gray-300 hover:bg-white/10' : 'text-[#0B2B5A] hover:text-primary hover:bg-slate-100'}`}
                                aria-label="السلة"
                            >
                                <ShoppingCart size={20} />
                                {cartCount > 0 && (
                                    <span className="absolute top-0.5 end-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white">
                                        {cartCount}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Menu */}
                        <button
                            type="button"
                            onClick={() => setSidebarOpen(true)}
                            className={`flex-shrink-0 p-2 rounded-xl transition-colors ${dm ? 'text-gray-200 hover:bg-white/10' : 'text-[#0B2B5A] hover:bg-slate-100'}`}
                            aria-label="القائمة"
                        >
                            <Menu size={22} strokeWidth={2.25} />
                        </button>
                    </div>
                </div>
            </header>

            {/* ─── Sidebar Drawer ─── */}
            <AnimatePresence>
                {sidebarOpen && (
                    <>
                        {/* Backdrop */}
                        <Motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => { setSidebarOpen(false); setEditingInfo(false); }}
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]"
                        />
                        {/* Drawer */}
                        <Motion.div
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
                                
                                {/* Account — primary entry (moved from bottom nav) */}
                                <a
                                    href="/account"
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition mb-1
                                    ${dm ? 'hover:bg-gray-800 text-gray-100 bg-gray-800/60' : 'hover:bg-blue-50 text-slate-800 bg-slate-50'}`}
                                >
                                    <User size={18} className="text-primary" />
                                    الحساب
                                </a>

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
                                            disabled={Boolean(user && customerInfo?.phoneVerified)}
                                            title={user && customerInfo?.phoneVerified ? 'الرقم موثق. غيّره من صفحة الحساب عبر SMS.' : ''}
                                            className={`w-full p-2 text-xs rounded-lg border mb-2 disabled:opacity-60 disabled:cursor-not-allowed ${dm ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-slate-200'}`}
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

                                {/* Additional settings */}
                                <div className={`mt-1 mb-1 rounded-xl border overflow-visible ${dm ? 'border-gray-700 bg-gray-800/40' : 'border-slate-200 bg-slate-50'}`}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setAdditionalSettingsOpen((open) => !open);
                                            if (additionalSettingsOpen) setLangDropdownOpen(false);
                                        }}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition
                                            ${dm ? 'text-gray-200 hover:bg-gray-800' : 'text-slate-700 hover:bg-slate-100'}`}
                                        aria-expanded={additionalSettingsOpen}
                                    >
                                        <Settings size={18} className="text-primary" />
                                        <span className="flex-1 text-start">إعدادات إضافية</span>
                                        <ChevronDown
                                            size={16}
                                            className={`transition-transform duration-200 ${additionalSettingsOpen ? 'rotate-180' : ''}`}
                                        />
                                    </button>

                                    <AnimatePresence initial={false}>
                                        {additionalSettingsOpen && (
                                            <Motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-visible"
                                            >
                                                <div className={`mx-2 mb-2 pt-2 border-t space-y-1 ${dm ? 'border-gray-700' : 'border-slate-200'}`}>
                                                    {/* Language Switcher */}
                                                    <div className="relative">
                                                        <button
                                                            type="button"
                                                            onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                                                            className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-medium transition
                                                                ${dm ? 'text-gray-300 hover:bg-gray-700' : 'text-slate-700 hover:bg-white'}`}
                                                        >
                                                            <Globe2 size={18} className="text-sky-500" />
                                                            <span className="flex-1 text-start">لغة الموقع</span>
                                                            <span className={`text-[11px] ${dm ? 'text-gray-400' : 'text-slate-500'}`}>
                                                                {currentLang === 'ar' ? 'العربية' : currentLang === 'fr' ? 'Français' : currentLang === 'en' ? 'English' : 'Español'}
                                                            </span>
                                                            <ChevronDown size={14} className={`transition-transform ${langDropdownOpen ? 'rotate-180' : ''}`} />
                                                        </button>

                                                        <AnimatePresence>
                                                            {langDropdownOpen && (
                                                                <Motion.div
                                                                    initial={{ opacity: 0, y: -6 }}
                                                                    animate={{ opacity: 1, y: 0 }}
                                                                    exit={{ opacity: 0, y: -6 }}
                                                                    className={`mt-1 rounded-lg shadow-lg border overflow-hidden ${dm ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-200'}`}
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
                                                                </Motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>

                                                    {/* Grid columns (mobile) */}
                                                    <button
                                                        onClick={toggleGridColumns}
                                                        className={`md:hidden w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-medium transition
                                                            ${dm ? 'text-gray-300 hover:bg-gray-700' : 'text-slate-700 hover:bg-white'}`}
                                                    >
                                                        {gridColumns === 1 ? <LayoutGrid size={18} className="text-primary" /> : <Columns2 size={18} className="text-primary" />}
                                                        {gridColumns === 1 ? 'عرض عمودين' : 'عرض عمود واحد'}
                                                    </button>

                                                    {/* Dark Mode */}
                                                    <button
                                                        onClick={toggleDarkMode}
                                                        className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-medium transition
                                                            ${dm ? 'text-gray-300 hover:bg-gray-700' : 'text-slate-700 hover:bg-white'}`}
                                                    >
                                                        {dm ? <Sun size={18} className="text-yellow-400" /> : <Moon size={18} className="text-slate-500" />}
                                                        {dm ? 'الوضع الفاتح' : 'الوضع الداكن'}
                                                    </button>
                                                </div>
                                            </Motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Track Order */}
                                <a
                                    href="/tracking"
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition
                                    ${dm ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-slate-50 text-slate-700'}`}
                                >
                                    <Truck size={18} className="text-blue-500" />
                                    تتبع طلبك
                                </a>

                                <a
                                    href="/"
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition
                                    ${dm ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-slate-50 text-slate-700'}`}
                                >
                                    <ShoppingBag size={18} className="text-primary" />
                                    المتجر (صفحة المنتج)
                                </a>

                                <a
                                    href="/catalog"
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition
                                    ${dm ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-slate-50 text-slate-700'}`}
                                >
                                    <LayoutGrid size={18} className="text-violet-500" />
                                    الكتالوج (معاينة سريعة)
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
                        </Motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
};

export default Header;
