import React from 'react';
import { Search, ShoppingCart, User, LayoutGrid } from 'lucide-react';
import useStore from '../store/useStore';

const Header = () => {
    const { cart, toggleCart, searchQuery } = useStore();
    const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

    return (
        <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur border-b border-slate-200 shadow-sm">

            {/* ─── MOBILE HEADER (hidden on md+) ─── */}
            <div className="md:hidden px-3 py-2 flex items-center gap-2">

                {/* Right: Cart */}
                <div className="relative flex-shrink-0">
                    <button
                        onClick={toggleCart}
                        aria-label="Shopping Cart"
                        className="relative p-2 text-slate-700 hover:bg-slate-100 rounded-full transition-colors flex items-center justify-center"
                    >
                        <ShoppingCart size={26} />
                        {cartCount > 0 && (
                            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white ring-2 ring-white">
                                {cartCount}
                            </span>
                        )}
                    </button>
                </div>

                {/* Center: Search Bar (always visible) */}
                <div className="flex-1 min-w-0">
                    <div className="relative">
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                            <Search size={18} />
                        </div>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => useStore.getState().setSearchQuery(e.target.value)}
                            className="w-full h-9 pr-9 pl-3 bg-slate-100 border-none rounded-lg text-sm text-slate-900 placeholder:text-slate-500 focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all text-right"
                            placeholder="ابحث عن المنتجات..."
                        />
                    </div>
                </div>

                {/* Left: Utility Icons */}
                <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button aria-label="Grid View" className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                        <LayoutGrid size={22} />
                    </button>
                    <button aria-label="Account" className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                        <User size={22} />
                    </button>
                </div>
            </div>

            {/* ─── DESKTOP HEADER (hidden on mobile) ─── */}
            <div className="hidden md:flex max-w-7xl mx-auto px-4 h-16 items-center justify-between">

                {/* Logo */}
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-white font-bold text-lg">I</div>
                    <span className="text-xl font-bold tracking-tight text-slate-900">
                        IMDEN <span className="text-primary">TECHNOLOGY</span>
                    </span>
                </div>

                {/* Search Bar */}
                <div className="flex flex-1 max-w-xl mx-8 relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="text-slate-400" size={20} />
                    </span>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => useStore.getState().setSearchQuery(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm text-right"
                        placeholder="...ابحث بالمرجع، الاسم أو الرمز"
                    />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-4">
                    <button className="p-2 text-slate-500 hover:text-primary transition-colors">
                        <User size={24} />
                    </button>
                    <div className="relative cursor-pointer" onClick={toggleCart}>
                        <button className="p-2 text-slate-500 hover:text-primary transition-colors">
                            <ShoppingCart size={24} />
                        </button>
                        {cartCount > 0 && (
                            <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-primary rounded-full">
                                {cartCount}
                            </span>
                        )}
                    </div>
                </div>
            </div>

        </header>
    );
};

export default Header;
