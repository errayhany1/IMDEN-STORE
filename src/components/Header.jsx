import React from 'react';
import { Search, ShoppingCart, User } from 'lucide-react';
import useStore from '../store/useStore';

const Header = () => {
    const { cart, toggleCart } = useStore();
    const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

    return (
        <header className="sticky top-0 z-40 w-full bg-surface-light/95 backdrop-blur border-b border-gray-200 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                {/* Logo */}
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-white font-bold text-lg">W</div>
                    <span className="text-xl font-bold tracking-tight text-slate-900">
                        Wholesale<span className="text-primary">Hub</span>
                    </span>
                </div>

                {/* Search Bar (Desktop) */}
                <div className="hidden md:flex flex-1 max-w-xl mx-8 relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="text-slate-400" size={20} />
                    </span>
                    <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg leading-5 bg-slate-50 text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
                        placeholder="Search by reference, name, or SKU..."
                    />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-4">
                    <button className="p-2 text-slate-500 hover:text-primary transition-colors">
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
