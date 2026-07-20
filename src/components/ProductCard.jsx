import React, { useState } from 'react';
import { ShoppingCart, Check, Heart, Bell, BellRing, Eye } from 'lucide-react';
import useStore from '../store/useStore';
import QuickViewModal from './QuickViewModal';
import './ProductCard.css';

const WA_ICON = "https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg";

const ProductCard = ({ product, priority = false }) => {
    const addToCart = useStore((state) => state.addToCart);
    const darkMode = useStore((state) => state.darkMode);
    const gridColumns = useStore((state) => state.gridColumns);
    const browseMode = useStore((state) => state.browseMode);
    const wishlist = useStore((state) => state.wishlist);
    const toggleWishlistItem = useStore((state) => state.toggleWishlistItem);
    const restockSubscriptions = useStore((state) => state.restockSubscriptions);
    const toggleRestockSubscription = useStore((state) => state.toggleRestockSubscription);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [hoveredThumb, setHoveredThumb] = useState(null);
    const [addedToCart, setAddedToCart] = useState(false);

    const isWishlisted = wishlist.some((item) => item.id === product.id);
    const isCatalog = browseMode === 'catalog';
    const productHref = `/p/${encodeURIComponent(product.ref || product.id)}`;

    const dm = darkMode;
    const singleCol = gridColumns === 1;
    const isOutOfStock = product.category === 'Out of Stock' || product.isAvailable === false;
    const isWatchingRestock = restockSubscriptions.some(
        (item) => String(item.id || item.ref) === String(product.id || product.ref)
    );

    const rememberBrowseMode = () => {
        try {
            sessionStorage.setItem('lastBrowseMode', isCatalog ? 'catalog' : 'shop');
        } catch {
            /* ignore */
        }
    };

    const openProductPage = () => {
        rememberBrowseMode();
        window.location.assign(productHref);
    };

    const handleMediaClick = () => {
        if (isCatalog) {
            setIsModalOpen(true);
            return;
        }
        openProductPage();
    };

    const handleRestockAlert = async (event) => {
        event.stopPropagation();
        if (!isWatchingRestock && 'Notification' in window && Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') return;
        }
        toggleRestockSubscription(product);
    };

    // Multi-image support
    const allImages = product.images && product.images.length > 0 ? product.images : (product.image ? [product.image] : []);
    const displayImage = hoveredThumb !== null
        ? allImages[hoveredThumb]
        : (product.thumbnail || product.image || null);
    const extraThumbs = allImages.length > 1 ? allImages.slice(1, 3) : []; // max 2 thumbnails

    return (
        <>
        <article className={`rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border flex flex-col overflow-hidden group h-full relative
                ${dm ? 'bg-gray-800 border-gray-700 hover:border-gray-600' : 'bg-surface-light border-slate-200/70 hover:border-primary/40'}`}>

                {/* Out of Stock Overlay */}
                {isOutOfStock && (
                    <div className="absolute inset-0 z-20 pointer-events-none bg-black/5 flex items-center justify-center">
                        <div className="bg-red-600/90 text-white font-bold px-4 py-1 rounded-md transform -rotate-12 border border-red-200 shadow-xl text-sm">
                            نفد من المخزون
                        </div>
                    </div>
                )}

                <div className={`relative aspect-[3/4] overflow-hidden cursor-pointer ${dm ? 'bg-gray-900' : 'bg-gradient-to-b from-slate-50 to-white'}`} onClick={handleMediaClick}>

                    {/* Wishlist Toggle */}
                    <button
                        onClick={(e) => { e.stopPropagation(); toggleWishlistItem(product); }}
                        className={`absolute top-2 right-2 z-30 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm shadow-sm transition-all duration-300 active:scale-90
                            ${isWishlisted
                                ? 'bg-red-500 text-white'
                                : dm ? 'bg-gray-900/60 text-gray-300 hover:text-red-400' : 'bg-white/85 text-slate-400 hover:text-red-500'}`}
                        title={isWishlisted ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
                        aria-label="المفضلة"
                    >
                        <Heart size={15} fill={isWishlisted ? 'currentColor' : 'none'} className={isWishlisted ? 'animate-heart-pop' : ''} />
                    </button>

                    {/* Catalog only: eye opens the dedicated product page */}
                    {isCatalog && (
                        <a
                            href={productHref}
                            onClick={(e) => {
                                e.stopPropagation();
                                rememberBrowseMode();
                            }}
                            className={`absolute top-12 right-2 z-30 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm shadow-sm transition-all duration-300 active:scale-90
                                ${dm ? 'bg-gray-900/60 text-sky-300 hover:text-sky-200' : 'bg-white/85 text-sky-600 hover:text-sky-700'}`}
                            title="صفحة المنتج"
                            aria-label="صفحة المنتج"
                        >
                            <Eye size={15} />
                        </a>
                    )}

                    {isOutOfStock && (
                        <button
                            type="button"
                            onClick={handleRestockAlert}
                            className={`absolute top-2 left-2 z-30 h-8 px-2 rounded-full flex items-center gap-1 backdrop-blur-sm shadow-sm transition-all active:scale-95 text-[10px] font-bold
                                ${isWatchingRestock
                                    ? 'bg-amber-500 text-white'
                                    : dm ? 'bg-gray-900/75 text-amber-400' : 'bg-white/90 text-amber-600'}`}
                            title={isWatchingRestock ? 'إلغاء تنبيه التوفر' : 'أعلمني عند عودة المنتج'}
                        >
                            {isWatchingRestock ? <BellRing size={13} /> : <Bell size={13} />}
                            <span className="hidden sm:inline">{isWatchingRestock ? 'مفعّل' : 'أعلمني'}</span>
                        </button>
                    )}

                    {displayImage ? (
                        <img
                            src={displayImage}
                            alt={`${product.name || product.ref} - ${product.price} DH - إلكترونيات بالجملة Errayhany Store`}
                            title={product.name || product.ref}
                            className={`w-full h-full object-contain p-1 transform group-hover:scale-105 transition-transform duration-500 ${isOutOfStock ? 'opacity-90' : ''}`}
                            loading={priority ? 'eager' : 'lazy'}
                            fetchPriority={priority ? 'high' : 'auto'}
                            decoding="async"
                            width="300"
                            height="400"
                            onError={(e) => {
                                if (product.originalImage && e.target.src !== product.originalImage) {
                                    e.target.src = product.originalImage;
                                    return;
                                }
                                e.target.onerror = null;
                                e.target.style.display = 'none';
                                e.target.parentElement.innerHTML = `<div class="w-full h-full flex items-center justify-center text-sm ${dm ? 'text-gray-500 bg-gray-900' : 'text-slate-400 bg-slate-100'}"><span>⏳ جاري التحديث...</span></div>`;
                            }}
                        />
                    ) : (
                        <div className={`w-full h-full flex items-center justify-center text-sm ${dm ? 'text-gray-500 bg-gray-900' : 'text-slate-400 bg-slate-200'}`}>
                            لا توجد صورة
                        </div>
                    )}

                    {/* Thumbnails for extra images */}
                    {extraThumbs.length > 0 && (
                        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                            {extraThumbs.map((thumb, idx) => (
                                <div
                                    key={idx}
                                    onMouseEnter={() => setHoveredThumb(idx + 1)}
                                    onMouseLeave={() => setHoveredThumb(null)}
                                    onClick={(e) => { e.stopPropagation(); setHoveredThumb(idx + 1); }}
                                    className={`w-8 h-8 rounded-md border-2 overflow-hidden cursor-pointer transition-all hover:scale-110
                                    ${hoveredThumb === idx + 1 ? 'border-primary shadow-md' : (dm ? 'border-gray-600 bg-gray-800' : 'border-white bg-white')} shadow-sm`}
                                >
                                    <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" />
                                </div>
                            ))}
                        </div>
                    )}

                </div>

                <div
                    className={`p-3 flex flex-col gap-3 ${isOutOfStock ? 'opacity-80' : ''} ${!isCatalog ? 'cursor-pointer' : ''}`}
                    onClick={!isCatalog ? openProductPage : undefined}
                >
                    {/* Price and Ref Row */}
                    <div className="flex items-center justify-between flex-row-reverse gap-1">
                        <div className="text-right flex-shrink-0">
                            <span className="text-lg font-extrabold text-primary tracking-tight">
                                {product.price}
                                <span className="text-[11px] font-bold text-primary/60 mx-0.5">DH</span>
                            </span>
                        </div>
                        <div className="text-left min-w-0 flex-1 flex items-center gap-0.5">
                            <button
                                onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(product.ref); }}
                                className={`shrink-0 p-0.5 rounded opacity-30 hover:opacity-100 transition-opacity ${dm ? 'text-gray-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'}`}
                                title="نسخ المرجع"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                            </button>
                            <span
                                className={`font-mono px-1.5 py-0.5 rounded whitespace-nowrap overflow-hidden text-ellipsis block max-w-full
                                    ${dm ? 'bg-gray-700 text-gray-300' : 'bg-slate-100 text-slate-500'}`}
                                style={{ fontSize: singleCol ? '0.75rem' : 'clamp(7px, 1.8vw, 10px)' }}
                            >REF: {product.ref}</span>
                        </div>
                    </div>

                    {product.name && product.name.trim() !== '' && product.name !== 'Unnamed Product' && (
                        <div 
                            className={`text-right text-xs font-medium line-clamp-2 leading-relaxed ${dm ? 'text-gray-300' : 'text-slate-600'}`} 
                            title={product.name}
                        >
                            {product.name}
                        </div>
                    )}

                    <div className="flex gap-2 flex-row-reverse" onClick={(e) => e.stopPropagation()}>
                        <button
                            onClick={() => {
                                if (!isOutOfStock && !addedToCart) {
                                    addToCart(product);
                                    setAddedToCart(true);
                                    setTimeout(() => setAddedToCart(false), 1500);
                                }
                            }}
                            disabled={isOutOfStock}
                            className={`flex-1 font-semibold py-2 px-4 rounded-xl flex items-center justify-center gap-2 text-white transition-all duration-300 active:scale-[0.96]
                                ${addedToCart ? 'bg-green-500 shadow-lg shadow-green-500/30' 
                                    : isOutOfStock ? 'bg-gray-400 cursor-not-allowed shadow-none' 
                                    : 'btn-add-cart'}`}
                        >
                            {addedToCart ? (
                                <><Check size={18} /> تمت الإضافة</>  
                            ) : (
                                <><ShoppingCart size={18} /> إضافة</>
                            )}
                        </button>
                        <a
                            href={`https://wa.me/212664630566?text=السلام عليكم، أريد الاستفسار بخصوص هذا المنتج:%0A%0A*المنتج:* ${product.name || 'بدون اسم'}%0A*المرجع:* ${product.ref}%0A*الثمن:* ${product.price} DH`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] active:scale-95 transition-all shadow-sm shadow-[#25D366]/30"
                        >
                            <img src={WA_ICON} alt="WhatsApp" className="w-5 h-5" />
                        </a>
                    </div>
                </div>
            </article>

            {/* Quick View Modal — catalog mode only */}
            {isCatalog && (
                <QuickViewModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    product={product}
                />
            )}
        </>
    );
};

export default ProductCard;
