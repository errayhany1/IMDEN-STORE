import React, { useState } from 'react';
import { Search, ShoppingCart, User, X } from 'lucide-react';
import useStore from '../store/useStore';

const Header = () => {
    const { cart, toggleCart, searchQuery } = useStore();
    const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
    const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

    return (
        <header className="sticky top-0 z-40 w-full bg-surface-light/95 backdrop-blur border-b border-gray-200 shadow-sm transition-all duration-300">
            <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between relative">
                {/* Logo */}
                <div className={`flex items-center gap-2 transition-opacity duration-200 ${isMobileSearchOpen ? 'opacity-0 md:opacity-100' : 'opacity-100'}`}>
                    <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-white font-bold text-lg">I</div>
                    <span className="text-xl font-bold tracking-tight text-slate-900">
                        IMDEN <span className="text-primary">TECHNOLOGY</span>
                    </span>
                </div>

                {/* Mobile Search Overlay */}
                {isMobileSearchOpen && (
                    <div className="absolute inset-0 px-4 flex items-center bg-surface-light md:hidden z-50">
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                autoFocus
                                value={searchQuery}
                                onChange={(e) => useStore.getState().setSearchQuery(e.target.value)}
                                className="block w-full pl-10 pr-10 py-2 border border-primary rounded-lg leading-5 bg-white text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary sm:text-sm text-right"
                                placeholder="...ابحث بالمرجع، الاسم أو الرمز"
                            />
                            <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                <Search className="text-primary" size={20} />
                            </span>
                        </div>
                        <button
                            onClick={() => setIsMobileSearchOpen(false)}
                            className="ml-3 p-2 text-slate-500 hover:text-red-500"
                        >
                            <X size={24} />
                        </button>
                    </div>
                )}

                {/* Desktop Search Bar */}
                <div className="hidden md:flex flex-1 max-w-xl mx-8 relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="text-slate-400" size={20} />
                    </span>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => useStore.getState().setSearchQuery(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg leading-5 bg-slate-50 text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm text-right"
                        placeholder="...ابحث بالمرجع، الاسم أو الرمز"
                    />
                </div>

                {/* Actions */}
                <div className={`flex items-center gap-2 md:gap-4 ${isMobileSearchOpen ? 'hidden md:flex' : 'flex'}`}>
                    {/* Mobile Search Toggle */}
                    <button
                        onClick={() => setIsMobileSearchOpen(true)}
                        className="md:hidden p-2 text-slate-500 hover:text-primary transition-colors"
                    >
                        <Search size={24} />
                    </button>

                    {/* User Icon - Hidden on Mobile */}
                    <button className="hidden md:block p-2 text-slate-500 hover:text-primary transition-colors">
                        <User size={24} />
                    </button>

                    <div className="relative group cursor-pointer" onClick={toggleCart}>
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
