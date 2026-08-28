import React, { useState } from 'react';
import { X, Trash2, ShoppingCart, Heart } from 'lucide-react';
import useStore from '../store/useStore';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { saveBrowseRestoreFromStore } from '../utils/browseRestore';
import { slugify } from '../utils/slugify';

const WishlistSidebar = () => {
    const {
        wishlist,
        isWishlistOpen,
        toggleWishlistSidebar,
        removeFromWishlist,
        moveWishlistItemToCart,
        clearWishlist,
        darkMode,
        products,
    } = useStore();
    const dm = darkMode;

    const [confirmClear, setConfirmClear] = useState(false);
    const [movedId, setMovedId] = useState(null);
    const [currentLang, setCurrentLang] = useState('ar');

    React.useEffect(() => {
        const match = document.cookie.match(/googtrans=\/ar\/([a-z]{2})/);
        if (match && match[1]) {
            setCurrentLang(match[1]);
        }
    }, []);

    const isRtl = currentLang === 'ar';

    const openProduct = (item) => {
        const ref = item.ref || item.id;
        if (!ref) return;
        try {
            const mode = useStore.getState().browseMode === 'catalog' ? 'catalog' : 'shop';
            sessionStorage.setItem('lastBrowseMode', mode);
        } catch {
            /* ignore */
        }
        saveBrowseRestoreFromStore(useStore.getState);
        toggleWishlistSidebar();
        const slug = slugify(item.name || '');
        window.location.assign(`/p/${encodeURIComponent(ref)}${slug ? `/${slug}` : ''}`);
    };

    const handleMoveToCart = (item) => {
        moveWishlistItemToCart(item);
        setMovedId(item.id);
        setTimeout(() => setMovedId(null), 1200);
    };

    const handleMoveAllToCart = () => {
        wishlist.forEach((item) => moveWishlistItemToCart(item));
    };

    return (
        <>
            <AnimatePresence>
                {isWishlistOpen && (
                    <>
                        {/* Backdrop */}
                        <Motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={toggleWishlistSidebar}
                            className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-[90]"
                        />

                        {/* Sidebar */}
                        <Motion.aside
                            initial={{ x: isRtl ? '100%' : '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: isRtl ? '100%' : '-100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className={`fixed top-0 ${isRtl ? 'right-0 border-l' : 'left-0 border-r'} h-full w-full sm:w-[440px] shadow-2xl z-[100] flex flex-col transition-colors duration-300
                                ${dm ? 'bg-gray-900 border-gray-700' : 'bg-white border-slate-200'}`}
                        >
                            {/* Header */}
                            <div className={`flex items-center justify-between px-4 sm:px-6 py-3 border-b z-10 ${dm ? 'border-gray-700' : 'border-slate-100'}`}>
                                <div className="flex items-baseline gap-2">
                                    <h2 className={`text-xl font-bold flex items-center gap-2 ${dm ? 'text-white' : 'text-slate-900'}`}>
                                        <Heart size={20} className="text-red-500" fill="currentColor" />
                                        المفضلة
                                    </h2>
                                    <span className="text-sm font-medium text-red-500 bg-red-500/10 px-2.5 py-0.5 rounded-full">
                                        {wishlist.length} منتجات
                                    </span>
                                    {wishlist.length > 0 && (
                                        <button
                                            onClick={() => setConfirmClear(true)}
                                            className="text-[11px] text-red-400 hover:text-red-600 hover:underline transition-colors"
                                        >
                                            حذف الكل
                                        </button>
                                    )}
                                </div>
                                <button
                                    onClick={toggleWishlistSidebar}
                                    className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Items */}
                            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-2 space-y-3">
                                {wishlist.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-3">
                                        <Heart size={40} className={dm ? 'text-gray-700' : 'text-slate-200'} />
                                        <p className="text-sm">قائمة المفضلة فارغة</p>
                                        <p className={`text-xs max-w-[240px] text-center ${dm ? 'text-gray-500' : 'text-slate-400'}`}>
                                            اضغط على أيقونة القلب ❤️ في أي منتج لحفظه هنا والرجوع إليه لاحقاً
                                        </p>
                                        <button onClick={toggleWishlistSidebar} className="text-primary text-sm font-semibold hover:underline">
                                            تصفح المنتجات
                                        </button>
                                    </div>
                                ) : (
                                    wishlist.map((item) => {
                                        // Fetch fresh image from products store to avoid expired signed URLs from localStorage
                                        const liveProduct = products.find((p) => p.id === item.id);
                                        const displayImage = liveProduct?.image || item.image;
                                        const isOutOfStock = (liveProduct?.category || item.category) === 'Out of Stock';

                                        return (
                                            <div key={item.id} className={`group flex gap-3 flex-row-reverse pb-3 border-b border-dashed last:border-b-0 ${dm ? 'border-gray-700' : 'border-slate-200'}`}>
                                                {/* Thumbnail — click to open the product page */}
                                                <div
                                                    className="relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 rounded-md overflow-hidden bg-slate-100 border border-slate-100 cursor-pointer"
                                                    onClick={() => openProduct(item)}
                                                >
                                                    {displayImage ? (
                                                        <img src={displayImage} alt={item.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-[10px] sm:text-xs text-slate-400">بدون صورة</div>
                                                    )}
                                                    {isOutOfStock && (
                                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                            <span className="text-[9px] text-white font-bold">نفد</span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex-1 flex flex-col justify-between py-0 text-right">
                                                    <div>
                                                        <div className="flex justify-between items-start gap-1 sm:gap-2 flex-row-reverse">
                                                            <h3
                                                                onClick={() => openProduct(item)}
                                                                className={`font-semibold leading-tight text-sm sm:text-base line-clamp-2 cursor-pointer hover:text-primary transition-colors ${dm ? 'text-white' : 'text-slate-900'}`}
                                                            >{item.name}</h3>
                                                            <button onClick={() => removeFromWishlist(item.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1 -m-1">
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                        <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">Ref: {item.ref}</p>
                                                    </div>
                                                    <div className="flex items-center justify-between mt-1.5 flex-row-reverse">
                                                        <p className={`text-sm font-bold ${dm ? 'text-white' : 'text-slate-900'}`}>{item.price} DH</p>
                                                        <button
                                                            onClick={() => handleMoveToCart(item)}
                                                            disabled={isOutOfStock}
                                                            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all active:scale-95
                                                                ${isOutOfStock
                                                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600'
                                                                    : movedId === item.id
                                                                        ? 'bg-green-500 text-white'
                                                                        : 'bg-primary text-white hover:bg-primary/90'}`}
                                                        >
                                                            <ShoppingCart size={14} />
                                                            {movedId === item.id ? 'تمت الإضافة!' : 'نقل للسلة'}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Footer */}
                            {wishlist.length > 0 && (
                                <div className={`border-t p-4 ${dm ? 'border-gray-700 bg-gray-900' : 'border-slate-200 bg-slate-50'}`}>
                                    <button
                                        onClick={handleMoveAllToCart}
                                        className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                    >
                                        <ShoppingCart size={18} />
                                        نقل الكل إلى السلة
                                    </button>
                                </div>
                            )}
                        </Motion.aside>
                    </>
                )}
            </AnimatePresence>

            {/* ── Confirm Clear Wishlist Modal ── */}
            {confirmClear && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setConfirmClear(false)}
                    />
                    {/* Dialog */}
                    <div className={`relative rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center space-y-4 z-10
                        ${dm ? 'bg-gray-800 text-white' : 'bg-white text-slate-900'}`}
                    >
                        <div className="text-4xl">💔</div>
                        <h3 className="text-lg font-bold">حذف جميع المنتجات من المفضلة؟</h3>
                        <p className={`text-sm ${dm ? 'text-gray-400' : 'text-slate-500'}`}>
                            سيتم حذف جميع المنتجات من قائمة المفضلة. هل أنت متأكد؟
                        </p>
                        <div className="flex gap-3 pt-1">
                            <button
                                onClick={() => setConfirmClear(false)}
                                className={`flex-1 py-2.5 rounded-xl font-medium transition-colors
                                    ${dm ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={() => { clearWishlist(); setConfirmClear(false); }}
                                className="flex-1 py-2.5 rounded-xl font-medium bg-red-500 hover:bg-red-600 text-white transition-colors"
                            >
                                حذف الكل
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default WishlistSidebar;
