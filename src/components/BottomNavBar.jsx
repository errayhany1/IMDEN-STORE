import React from 'react';
import { Home, BookOpen, ShoppingCart, Heart, User } from 'lucide-react';
import useStore from '../store/useStore';

const BottomNavBar = ({ activeOverride = null }) => {
    const {
        darkMode,
        cart,
        wishlist,
        isCartOpen,
        isWishlistOpen,
        toggleCart,
        toggleWishlistSidebar,
        clearFamily,
        setBrowseMode,
        browseMode,
    } = useStore();

    const path = window.location.pathname;
    const onAccount = path === '/account';
    const onCatalog = path === '/catalog' || path.startsWith('/catalog/');
    const onShop = path === '/' || path.startsWith('/family/');

    const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
    const wishlistCount = wishlist.length;

    let active = activeOverride;
    if (!active) {
        if (isCartOpen) active = 'cart';
        else if (isWishlistOpen) active = 'wishlist';
        else if (onAccount) active = 'account';
        else if (onCatalog) active = 'catalog';
        else active = 'home';
    }

    const goShop = () => {
        clearFamily();
        setBrowseMode('shop');
        if (!onShop) {
            window.location.assign('/');
            return;
        }
        window.history.pushState({}, '', '/');
        window.dispatchEvent(new PopStateEvent('popstate'));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const goCatalog = () => {
        clearFamily();
        setBrowseMode('catalog');
        if (!onCatalog) {
            window.location.assign('/catalog');
            return;
        }
        window.history.pushState({}, '', '/catalog');
        window.dispatchEvent(new PopStateEvent('popstate'));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const goAccount = () => {
        if (onAccount) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        window.location.assign('/account');
    };

    const items = [
        {
            id: 'cart',
            label: 'السلة',
            Icon: ShoppingCart,
            badge: cartCount,
            badgeClass: 'bg-primary',
            onClick: () => {
                if (isWishlistOpen) toggleWishlistSidebar();
                toggleCart();
            },
        },
        {
            id: 'catalog',
            label: 'الكتالوج',
            Icon: BookOpen,
            onClick: goCatalog,
        },
        {
            id: 'home',
            label: 'الرئيسية',
            Icon: Home,
            onClick: goShop,
        },
        {
            id: 'wishlist',
            label: 'المفضلة',
            Icon: Heart,
            badge: wishlistCount,
            badgeClass: 'bg-rose-500',
            onClick: () => {
                if (isCartOpen) toggleCart();
                toggleWishlistSidebar();
            },
        },
        {
            id: 'account',
            label: 'الحساب',
            Icon: User,
            onClick: goAccount,
        },
    ];

    return (
        <nav
            className={`fixed bottom-0 inset-x-0 z-[60] md:hidden border-t pb-[env(safe-area-inset-bottom)]
                ${darkMode
                    ? 'bg-gray-950/95 border-gray-800 text-gray-300 backdrop-blur-md'
                    : 'bg-white/95 border-slate-200 text-slate-500 backdrop-blur-md shadow-[0_-4px_20px_rgba(15,23,42,0.06)]'}`}
            style={{ direction: 'rtl' }}
            aria-label="التنقل السفلي"
        >
            <div className="max-w-lg mx-auto h-[60px] px-1 flex items-stretch justify-between">
                {items.map(({ id, label, Icon, badge, badgeClass, onClick }) => {
                    const isActive = active === id;
                    return (
                        <button
                            key={id}
                            type="button"
                            onClick={onClick}
                            className="relative flex-1 flex flex-col items-center justify-center gap-0.5 min-w-0"
                            aria-current={isActive ? 'page' : undefined}
                        >
                            <span
                                className={`relative flex items-center justify-center w-11 h-8 rounded-xl transition-colors
                                    ${isActive
                                        ? (darkMode ? 'bg-primary/20 text-primary' : 'bg-primary/10 text-primary')
                                        : (darkMode ? 'text-gray-400' : 'text-slate-500')}`}
                            >
                                <Icon
                                    size={22}
                                    strokeWidth={isActive ? 2.4 : 1.9}
                                    fill={isActive && (id === 'home' || (id === 'catalog' && browseMode === 'catalog')) ? 'currentColor' : 'none'}
                                />
                                {badge > 0 && (
                                    <span
                                        className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full
                                            text-[10px] font-bold text-white leading-[18px] text-center shadow-sm
                                            ${badgeClass || 'bg-primary'}`}
                                    >
                                        {badge > 99 ? '99+' : badge}
                                    </span>
                                )}
                            </span>
                            <span
                                className={`text-[11px] font-semibold leading-none truncate max-w-full px-0.5
                                    ${isActive
                                        ? 'text-primary'
                                        : (darkMode ? 'text-gray-400' : 'text-slate-500')}`}
                            >
                                {label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};

export default BottomNavBar;
