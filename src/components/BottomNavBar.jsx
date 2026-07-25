import React from 'react';
import { Home, BookOpen, ShoppingCart, Heart, LayoutGrid } from 'lucide-react';
import useStore from '../store/useStore';

/**
 * Floating bottom nav (mobile).
 * RTL order (right → left): Catalog | Home | Categories | Cart | Favorites
 * Account lives in the sidebar menu only.
 */
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
    const onCatalog = path === '/catalog' || path.startsWith('/catalog/');
    const onShop = path === '/' || path.startsWith('/family/');
    const onCategories = path === '/categories' || path.startsWith('/categories/');
    const onAccount = path === '/account';

    const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
    const wishlistCount = wishlist.length;

    let active = activeOverride;
    if (!active) {
        if (isCartOpen) active = 'cart';
        else if (isWishlistOpen) active = 'wishlist';
        else if (onCategories) active = 'categories';
        else if (onCatalog) active = 'catalog';
        else if (onAccount) active = null;
        else if (onShop) active = 'home';
        else active = null;
    }

    const goShop = () => {
        if (isCartOpen) toggleCart();
        if (isWishlistOpen) toggleWishlistSidebar();
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
        if (isCartOpen) toggleCart();
        if (isWishlistOpen) toggleWishlistSidebar();
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

    const goCategories = () => {
        if (isCartOpen) toggleCart();
        if (isWishlistOpen) toggleWishlistSidebar();
        if (onCategories) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        window.location.assign('/categories');
    };

    // DOM order with direction:rtl → visual right-to-left
    const items = [
        {
            id: 'catalog',
            label: 'الكتالوج',
            Icon: BookOpen,
            primary: true,
            onClick: goCatalog,
        },
        {
            id: 'home',
            label: 'الرئيسية',
            Icon: Home,
            onClick: goShop,
        },
        {
            id: 'categories',
            label: 'الفئات',
            Icon: LayoutGrid,
            onClick: goCategories,
        },
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
    ];

    return (
        <nav
            className="fixed bottom-0 inset-x-0 z-[60] md:hidden pointer-events-none pb-[max(4px,env(safe-area-inset-bottom))] px-3"
            aria-label="التنقل السفلي"
        >
            <div
                dir="rtl"
                className={`pointer-events-auto max-w-lg mx-auto h-[64px] px-1.5 flex items-stretch justify-between rounded-[22px] border shadow-[0_8px_28px_rgba(15,23,42,0.12)]
                    ${darkMode
                        ? 'bg-[#142038]/95 border-white/10 text-gray-300 backdrop-blur-md'
                        : 'bg-white/95 border-slate-100 text-slate-500 backdrop-blur-md'}`}
            >
                {items.map(({ id, label, Icon, badge, badgeClass, onClick, primary }) => {
                    const isActive = active === id;
                    const fillIcon = isActive && (id === 'home' || id === 'catalog' || id === 'categories');
                    return (
                        <button
                            key={id}
                            type="button"
                            onClick={onClick}
                            className="relative flex-1 flex flex-col items-center justify-center gap-0.5 min-w-0"
                            aria-current={isActive ? 'page' : undefined}
                        >
                            <span
                                className={`relative flex items-center justify-center w-11 h-9 rounded-xl transition-colors
                                    ${isActive
                                        ? (darkMode ? 'bg-primary/25 text-primary' : 'bg-primary/10 text-primary')
                                        : primary && !isActive
                                            ? (darkMode ? 'text-gray-200' : 'text-[#0B2B5A]')
                                            : (darkMode ? 'text-gray-400' : 'text-slate-500')}`}
                            >
                                <Icon
                                    size={primary ? 23 : 22}
                                    strokeWidth={isActive || primary ? 2.35 : 1.9}
                                    fill={fillIcon ? 'currentColor' : 'none'}
                                />
                                {badge > 0 && (
                                    <span
                                        className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full
                                            text-[10px] font-bold text-white leading-[18px] text-center shadow-sm
                                            ${badgeClass || 'bg-primary'}`}
                                    >
                                        {badge > 99 ? '+99' : badge}
                                    </span>
                                )}
                            </span>
                            <span
                                className={`text-[11px] font-semibold leading-none truncate max-w-full px-0.5
                                    ${isActive
                                        ? 'text-primary'
                                        : primary
                                            ? (darkMode ? 'text-gray-200' : 'text-[#0B2B5A]')
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
