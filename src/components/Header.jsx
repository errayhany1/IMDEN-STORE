import React, { useState } from 'react';
import { Search, ShoppingCart, X, Moon, Sun, LayoutGrid, Columns2, User, Grid2X2 } from 'lucide-react';
import useStore from '../store/useStore';

const Header = () => {
    const { cart, toggleCart, searchQuery, darkMode, toggleDarkMode, gridColumns, toggleGridColumns } = useStore();
    const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
    const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

    const dm = darkMode;

    return (
        <header className={`sticky top-0 z-40 w-full border-b shadow-sm transition-colors duration-300
            ${dm ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>

            {/* ─── Main Bar ─── */}
            <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-2">

                {/* Logo */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-white font-bold text-lg">I</div>
                    <span className={`hidden sm:block text-xl font-bold tracking-tight ${dm ? 'text-white' : 'text-slate-900'}`}>
                        IMDEN <span className="text-primary">TECHNOLOGY</span>
                    </span>
                </div>

                {/* Desktop Search Bar */}
                <div className="hidden md:flex flex-1 max-w-xl mx-6 relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="text-slate-400" size={18} />
                    </span>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => useStore.getState().setSearchQuery(e.target.value)}
                        className={`block w-full pl-10 pr-3 py-2 border rounded-lg text-sm text-right focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary
                            ${dm ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'}`}
                        placeholder="...ابحث بالمرجع، الاسم أو الرمز"
                    />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">

                    {/* Mobile: open search row */}
                    <button
                        onClick={() => setIsMobileSearchOpen(v => !v)}
                        className={`md:hidden p-2 rounded-lg transition-colors ${dm ? 'text-gray-300 hover:bg-gray-700' : 'text-slate-500 hover:bg-slate-100'}`}
                        aria-label="بحث"
                    >
                        {isMobileSearchOpen ? <X size={22} /> : <Search size={22} />}
                    </button>

                    {/* Grid Toggle — Mobile only: 1↔2 cols */}
                    <button
                        onClick={toggleGridColumns}
                        className={`md:hidden p-2 rounded-lg transition-colors ${dm ? 'text-gray-300 hover:bg-gray-700' : 'text-slate-500 hover:bg-slate-100'}`}
                        aria-label="تغيير عدد الأعمدة"
                        title={gridColumns === 1 ? 'عرض بطاقتين' : 'عرض بطاقة واحدة'}
                    >
                        {gridColumns === 1 ? <LayoutGrid size={22} /> : <Columns2 size={22} />}
                    </button>

                    {/* Dark Mode Toggle */}
                    <button
                        onClick={toggleDarkMode}
                        className={`p-2 rounded-lg transition-colors ${dm ? 'text-yellow-400 hover:bg-gray-700' : 'text-slate-500 hover:bg-slate-100'}`}
                        aria-label="تبديل الوضع المظلم"
                    >
                        {dm ? <Sun size={22} /> : <Moon size={22} />}
                    </button>

                    {/* Account */}
                    <button
                        className={`p-2 rounded-lg transition-colors ${dm ? 'text-gray-300 hover:bg-gray-700' : 'text-slate-500 hover:bg-slate-100'}`}
                        aria-label="الحساب"
                    >
                        <User size={22} />
                    </button>

                    {/* Cart */}
                    <div className="relative cursor-pointer" onClick={toggleCart}>
                        <button className={`p-2 rounded-lg transition-colors ${dm ? 'text-gray-300 hover:bg-gray-700' : 'text-slate-500 hover:text-primary hover:bg-slate-100'}`}>
                            <ShoppingCart size={22} />
                        </button>
                        {cartCount > 0 && (
                            <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white transform translate-x-1/4 -translate-y-1/4">
                                {cartCount}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* ─── Mobile Search Row (below main bar) ─── */}
            {isMobileSearchOpen && (
                <div className={`md:hidden px-4 pb-3 ${dm ? 'bg-gray-900' : 'bg-white'}`}>
                    <div className="relative">
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                            <Search size={18} />
                        </div>
                        <input
                            type="text"
                            autoFocus
                            value={searchQuery}
                            onChange={(e) => useStore.getState().setSearchQuery(e.target.value)}
                            className={`block w-full py-2.5 pr-10 pl-4 border border-primary rounded-xl text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all
                                ${dm ? 'bg-gray-800 text-white placeholder-gray-400' : 'bg-slate-50 text-slate-900 placeholder-slate-400'}`}
                            placeholder="ابحث عن المنتجات..."
                        />
                    </div>
                </div>
            )}
        </header>
    );
};

export default Header;
