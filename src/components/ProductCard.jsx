import React, { useState } from 'react';
import { ShoppingCart, Check, Heart, Bell, BellRing, Eye } from 'lucide-react';
import useStore from '../store/useStore';
import QuickViewModal from './QuickViewModal';
import ProductRatingStars from './ProductRatingStars';
import { frenchProductTitle, isRtlText } from '../utils/productText';
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
    // Cards always show the French copy, trimmed to a single line.
    const cardTitle = frenchProductTitle(product);
    const cardTitleRtl = isRtlText(cardTitle);
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
        <article className={`rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 border flex flex-col overflow-hidden group h-full relative
                ${dm ? 'bg-gray-800 border-gray-700' : 'bg-surface-light border-slate-100'}`}>

                {/* Out of Stock Overlay */}
                {isOutOfStock && (
                    <div className="absolute inset-0 z-20 pointer-events-none bg-black/5 flex items-center justify-center">
                        <div className="bg-red-600/90 text-white font-bold px-4 py-1 rounded-md transform -rotate-12 border border-red-200 shadow-xl text-sm">
                            نفد من المخزون
                        </div>
                    </div>
                )}

                <div className={`relative aspect-[3/4] overflow-hidden cursor-pointer ${dm ? 'bg-gray-900' : 'bg-white'}`} onClick={handleMediaClick}>

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
                            className={`w-full h-full object-contain transform group-hover:scale-105 transition-transform duration-500 ${isOutOfStock ? 'opacity-90' : ''}`}
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
                    {/* Price and rating row */}
                    <div className="flex items-center justify-between flex-row-reverse gap-2">
                        <div className="text-right flex-shrink-0">
                            <span className={`text-lg font-bold text-primary`}>{product.price} DH</span>
                        </div>
                        <ProductRatingStars
                            product={product}
                            darkMode={dm}
                            readOnly
                            size={singleCol ? 15 : 13}
                            onRequestRate={handleMediaClick}
                            className="flex-1"
                        />
                    </div>

                    {cardTitle && cardTitle !== 'Unnamed Product' && (
                        <div
                            className={`text-xs font-medium truncate leading-relaxed ${cardTitleRtl ? 'text-right' : 'text-left'} ${dm ? 'text-gray-300' : 'text-slate-600'}`}
                            dir={cardTitleRtl ? 'rtl' : 'ltr'}
                            title={cardTitle}
                        >
                            {cardTitle}
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
                            className={`flex-1 font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 text-white transition-all duration-300 active:scale-[0.96]
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
                            className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#25D366] hover:bg-[#20bd5a] active:scale-95 transition-all shadow-sm"
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
