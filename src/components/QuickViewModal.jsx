import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ShoppingCart, Copy, Check, Minus, Plus, Heart, Bell, BellRing } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import useStore from '../store/useStore';
import RelatedProducts from './RelatedProducts';
import ProductRatingStars from './ProductRatingStars';
import ImageModal from './ImageModal';
import {
    frenchProductTitle,
    isRtlText,
    listItemsFromHtml,
    productDescriptionHtml,
    stripHtml,
} from '../utils/productText';
import { saveBrowseRestoreFromStore } from '../utils/browseRestore';
import { slugify } from '../utils/slugify';

const WA_ICON = "https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg";

const QuickViewModal = ({ isOpen, onClose, product }) => {
    const addToCart = useStore((state) => state.addToCart);
    const darkMode = useStore((state) => state.darkMode);
    const wishlist = useStore((state) => state.wishlist);
    const toggleWishlistItem = useStore((state) => state.toggleWishlistItem);
    const restockSubscriptions = useStore((state) => state.restockSubscriptions);
    const toggleRestockSubscription = useStore((state) => state.toggleRestockSubscription);
    const dm = darkMode;

    const [currentIndex, setCurrentIndex] = useState(0);
    const [copied, setCopied] = useState(false);
    const [addedToCart, setAddedToCart] = useState(false);
    const [quantity, setQuantity] = useState(1);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [lightboxOpen, setLightboxOpen] = useState(false);

    // Small scroll helper for the details pane (long descriptions + related strip).
    const infoRef = useRef(null);
    const [infoScrollable, setInfoScrollable] = useState(false);
    const [infoAtBottom, setInfoAtBottom] = useState(false);

    const syncInfoScroll = useCallback(() => {
        const el = infoRef.current;
        if (!el) return;
        const overflow = el.scrollHeight - el.clientHeight;
        setInfoScrollable(overflow > 24);
        setInfoAtBottom(el.scrollTop >= overflow - 24);
    }, []);

    const scrollInfo = () => {
        const el = infoRef.current;
        if (!el) return;
        el.scrollTo({
            top: infoAtBottom ? 0 : el.scrollTop + el.clientHeight * 0.8,
            behavior: 'smooth',
        });
    };

    const viewedProduct = selectedProduct || product;
    const allImages = viewedProduct?.images && viewedProduct.images.length > 0
        ? viewedProduct.images
        : (viewedProduct?.image ? [viewedProduct.image] : []);
    const isOutOfStock = viewedProduct?.category === 'Out of Stock' || viewedProduct?.isAvailable === false;
    const isWishlisted = wishlist.some((item) => item.id === viewedProduct?.id);
    const isWatchingRestock = restockSubscriptions.some(
        (item) => String(item.id || item.ref) === String(viewedProduct?.id || viewedProduct?.ref)
    );

    const handleToggleWishlist = (e) => {
        e.stopPropagation();
        toggleWishlistItem(viewedProduct);
    };

    const handleRestockAlert = async () => {
        if (!isWatchingRestock && 'Notification' in window && Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') return;
        }
        toggleRestockSubscription(viewedProduct);
    };

    const handlePrev = (e) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev === 0 ? allImages.length - 1 : prev - 1));
    };

    const handleNext = (e) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev === allImages.length - 1 ? 0 : prev + 1));
    };

    const handleCopyRef = () => {
        navigator.clipboard.writeText(viewedProduct.ref);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    const handleAddToCart = () => {
        if (!isOutOfStock) {
            const qty = Math.max(1, Number(quantity) || 1);
            setQuantity(qty);
            addToCart(viewedProduct, qty);
            setAddedToCart(true);
            setTimeout(() => {
                setAddedToCart(false);
            }, 1500);
        }
    };

    const updateQty = (delta) => {
        setQuantity((prev) => Math.max(1, prev + delta));
    };

    const handleQtyInput = (value) => {
        const digits = String(value).replace(/\D/g, '');
        if (digits === '') {
            setQuantity(0); // temporary while typing; clamped on blur / add
            return;
        }
        const next = Math.min(9999, parseInt(digits, 10));
        if (Number.isFinite(next)) setQuantity(next);
    };

    const commitQty = () => {
        setQuantity((prev) => Math.max(1, Number(prev) || 1));
    };

    // Reset state when modal opens
    React.useEffect(() => {
        if (isOpen) {
            setCurrentIndex(0);
            setCopied(false);
            setAddedToCart(false);
            setQuantity(1);
            setSelectedProduct(null);
            setLightboxOpen(false);
        }
    }, [isOpen]);

    React.useEffect(() => {
        setCurrentIndex(0);
        setQuantity(1);
        setAddedToCart(false);
    }, [selectedProduct]);

    // Related products and descriptions load late, so watch the pane for size changes.
    useEffect(() => {
        if (!isOpen) return undefined;
        const el = infoRef.current;
        if (!el) return undefined;
        syncInfoScroll();
        const observer = new ResizeObserver(syncInfoScroll);
        observer.observe(el);
        [...el.children].forEach((child) => observer.observe(child));
        return () => observer.disconnect();
    }, [isOpen, selectedProduct, syncInfoScroll]);

    if (!viewedProduct) return null;

    // The card only shows one truncated line, so the modal spells out the full
    // title plus the description details.
    const fullTitle = frenchProductTitle(viewedProduct);
    const titleRtl = isRtlText(fullTitle);
    const arabicTitle = String(viewedProduct.originalData?.Arabic_Title || '').trim();
    const descriptionHtml = productDescriptionHtml(viewedProduct);
    const descriptionBullets = listItemsFromHtml(descriptionHtml);
    const descriptionText = descriptionBullets.length ? '' : stripHtml(descriptionHtml);

    return (
        <>
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
                    {/* Backdrop */}
                    <Motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                    />

                    {/* Modal Content */}
                    <Motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                        className={`relative w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col
                            rounded-t-3xl sm:rounded-2xl shadow-2xl border
                            ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}
                       
                    >
                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className={`absolute top-3 left-3 z-20 p-2 rounded-full transition-colors
                                ${dm ? 'bg-gray-800/80 hover:bg-gray-700 text-gray-300' : 'bg-white/80 hover:bg-white text-slate-500'} backdrop-blur-sm shadow-lg`}
                        >
                            <X size={18} />
                        </button>

                        {/* Out of Stock Badge */}
                        {isOutOfStock && (
                            <div className="absolute top-3 right-3 z-20 bg-red-600/90 text-white font-bold px-3 py-1 rounded-lg text-xs shadow-lg">
                                نفد من المخزون
                            </div>
                        )}

                        {/* Image Gallery */}
                        <div className={`relative w-full aspect-square sm:aspect-[4/3] overflow-hidden ${dm ? 'bg-gray-950' : 'bg-slate-50'}`}>
                            {allImages.length > 0 ? (
                                <button
                                    type="button"
                                    onClick={() => setLightboxOpen(true)}
                                    className="block w-full h-full cursor-zoom-in"
                                    aria-label="تكبير الصورة"
                                    title="اضغط للتكبير"
                                >
                                    <img
                                        src={allImages[currentIndex]}
                                        alt={`${viewedProduct.name || viewedProduct.ref} - إلكترونيات بالجملة Errayhany Store`}
                                        className="w-full h-full object-contain p-4 pointer-events-none"
                                        draggable={false}
                                    />
                                </button>
                            ) : (
                                <div className={`w-full h-full flex items-center justify-center text-sm ${dm ? 'text-gray-500' : 'text-slate-400'}`}>
                                    لا توجد صورة
                                </div>
                            )}

                            {/* Navigation Arrows */}
                            {allImages.length > 1 && (
                                <>
                                    <button onClick={handlePrev}
                                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full transition-all backdrop-blur-sm z-10">
                                        <ChevronLeft size={20} />
                                    </button>
                                    <button onClick={handleNext}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full transition-all backdrop-blur-sm z-10">
                                        <ChevronRight size={20} />
                                    </button>
                                </>
                            )}

                            {/* Small thumbs on the image card — same pattern as ProductCard */}
                            {allImages.length > 1 && (
                                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10 px-2">
                                    {allImages.slice(0, 4).map((img, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setCurrentIndex(idx);
                                            }}
                                            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-md border-2 overflow-hidden transition-all hover:scale-110 shadow-sm
                                                ${currentIndex === idx
                                                    ? 'border-primary shadow-md scale-105'
                                                    : dm ? 'border-gray-600 bg-gray-800/90' : 'border-white bg-white/95'}`}
                                            aria-label={`صورة ${idx + 1}`}
                                        >
                                            <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Product Info */}
                        <div className="relative flex-1 min-h-0 flex flex-col">
                        <div
                            ref={infoRef}
                            onScroll={syncInfoScroll}
                            className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4"
                        >
                            {/* Price and Ref */}
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <span className="text-2xl font-extrabold text-primary">{viewedProduct.price} DH</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleToggleWishlist}
                                        className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all active:scale-90
                                            ${isWishlisted
                                                ? 'bg-red-500 text-white'
                                                : dm ? 'bg-gray-800 text-gray-400 hover:text-red-400 hover:bg-gray-700' : 'bg-slate-100 text-slate-400 hover:text-red-500 hover:bg-slate-200'}`}
                                        title={isWishlisted ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
                                    >
                                        <Heart size={16} fill={isWishlisted ? 'currentColor' : 'none'} className={isWishlisted ? 'animate-heart-pop' : ''} />
                                    </button>
                                    <button
                                        onClick={handleCopyRef}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all
                                            ${copied ? 'bg-green-500/15 text-green-500' : dm ? 'bg-gray-800 text-gray-400 hover:bg-gray-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                    >
                                        {copied ? <Check size={12} /> : <Copy size={12} />}
                                        REF: {viewedProduct.ref}
                                    </button>
                                </div>
                            </div>

                            {/* Full product name (no truncation here) */}
                            {fullTitle && fullTitle !== 'Unnamed Product' && (
                                <h3
                                    className={`text-base font-bold leading-relaxed ${titleRtl ? 'text-right' : 'text-left'} ${dm ? 'text-white' : 'text-slate-800'}`}
                                    dir={titleRtl ? 'rtl' : 'ltr'}
                                >
                                    {fullTitle}
                                </h3>
                            )}

                            {arabicTitle && arabicTitle !== fullTitle && (
                                <p className={`text-xs leading-relaxed text-right ${dm ? 'text-gray-400' : 'text-slate-500'}`} dir="rtl">
                                    {arabicTitle}
                                </p>
                            )}

                            {/* Rating display only — voting happens on the product page */}
                            <div className={`flex items-center justify-between gap-3 py-2 px-3 rounded-xl ${dm ? 'bg-gray-800/60' : 'bg-slate-50'}`}>
                                <span className={`text-xs font-bold ${dm ? 'text-gray-300' : 'text-slate-600'}`}>
                                    التقييم
                                </span>
                                <ProductRatingStars
                                    product={viewedProduct}
                                    darkMode={dm}
                                    size={18}
                                    readOnly
                                    onRequestRate={() => {
                                        onClose?.();
                                        try {
                                            sessionStorage.setItem(
                                                'lastBrowseMode',
                                                useStore.getState().browseMode === 'catalog' ? 'catalog' : 'shop'
                                            );
                                        } catch {
                                            /* ignore */
                                        }
                                          saveBrowseRestoreFromStore(useStore.getState);
                                          const sku = encodeURIComponent(viewedProduct.ref || viewedProduct.id);
                                          const slug = slugify(viewedProduct.name || '');
                                          window.location.assign(`/p/${sku}${slug ? `/${slug}` : ''}`);
                                      }}
                                />
                            </div>

                            {/* Description details */}
                            {(descriptionBullets.length > 0 || descriptionText) && (
                                <div className="space-y-2">
                                    <p className={`text-[11px] font-bold ${dm ? 'text-gray-500' : 'text-slate-400'}`}>
                                        التفاصيل
                                    </p>
                                    {descriptionBullets.length > 0 ? (
                                        <ul className={`space-y-1.5 text-xs leading-relaxed list-disc ps-4 ${dm ? 'text-gray-300' : 'text-slate-600'}`}>
                                            {descriptionBullets.map((item, idx) => (
                                                <li key={idx}>{item}</li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className={`text-xs leading-relaxed ${dm ? 'text-gray-300' : 'text-slate-600'}`}>
                                            {descriptionText}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Category */}
                            {viewedProduct.category && viewedProduct.category !== 'Out of Stock' && (
                                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${dm ? 'bg-gray-800 text-gray-400' : 'bg-slate-100 text-slate-500'}`}>
                                    {viewedProduct.category}
                                </span>
                            )}

                            <RelatedProducts
                                product={viewedProduct}
                                onSelect={setSelectedProduct}
                            />
                        </div>

                        {infoScrollable && (
                            <button
                                type="button"
                                onClick={scrollInfo}
                                className={`absolute bottom-2.5 left-1/2 -translate-x-1/2 z-10 w-8 h-8 rounded-full flex items-center justify-center
                                    shadow-lg border backdrop-blur-sm transition-all active:scale-90
                                    ${dm
                                        ? 'bg-gray-800/90 border-gray-700 text-gray-300 hover:text-white'
                                        : 'bg-white/90 border-slate-200 text-slate-500 hover:text-primary'}`}
                                title={infoAtBottom ? 'الرجوع للأعلى' : 'تمرير للأسفل'}
                                aria-label={infoAtBottom ? 'الرجوع للأعلى' : 'تمرير للأسفل'}
                            >
                                {infoAtBottom ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                        )}
                        </div>

                        {/* Action Buttons */}
                        <div className={`p-4 border-t space-y-3 ${dm ? 'border-gray-800 bg-gray-900' : 'border-slate-100 bg-white'}`}>
                            {/* Quantity Controls */}
                            {!isOutOfStock && (
                                <div className="flex items-center justify-center gap-1" dir="ltr">
                                    <button onClick={() => updateQty(-5)}
                                        className={`w-10 h-10 flex items-center justify-center rounded-xl text-xs font-bold transition-all active:scale-90
                                            ${dm ? 'bg-gray-800 text-red-400 hover:bg-gray-700 border border-gray-700' : 'bg-red-50 text-red-500 hover:bg-red-100 border border-red-200'}`}>
                                        -5
                                    </button>
                                    <button onClick={() => updateQty(-1)}
                                        className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all active:scale-90
                                            ${dm ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'}`}>
                                        <Minus size={16} />
                                    </button>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={quantity === 0 ? '' : quantity}
                                        onChange={(e) => handleQtyInput(e.target.value)}
                                        onBlur={commitQty}
                                        onFocus={(e) => e.target.select()}
                                        aria-label="الكمية"
                                        className={`w-14 h-10 rounded-xl text-lg font-extrabold text-center outline-none
                                            focus:ring-2 focus:ring-primary/40
                                            ${dm ? 'bg-gray-800 text-white border border-gray-700' : 'bg-slate-50 text-slate-900 border border-slate-200'}`}
                                    />
                                    <button onClick={() => updateQty(1)}
                                        className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all active:scale-90
                                            ${dm ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'}`}>
                                        <Plus size={16} />
                                    </button>
                                    <button onClick={() => updateQty(5)}
                                        className={`w-10 h-10 flex items-center justify-center rounded-xl text-xs font-bold transition-all active:scale-90
                                            ${dm ? 'bg-gray-800 text-green-400 hover:bg-gray-700 border border-gray-700' : 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200'}`}>
                                        +5
                                    </button>
                                </div>
                            )}
                            {/* Add to Cart / Restock alert + WhatsApp */}
                            <div className="flex gap-2">
                                {isOutOfStock ? (
                                    <button
                                        type="button"
                                        onClick={handleRestockAlert}
                                        className={`flex-1 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.97] shadow-lg
                                            ${isWatchingRestock
                                                ? 'bg-amber-500 text-white shadow-amber-500/20'
                                                : dm ? 'bg-gray-800 text-amber-400 border border-amber-500/30' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}
                                    >
                                        {isWatchingRestock ? <BellRing size={18} /> : <Bell size={18} />}
                                        {isWatchingRestock ? 'سنخبرك عند توفره' : 'أعلمني عند التوفر'}
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleAddToCart}
                                        className={`flex-1 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-white transition-all active:scale-[0.97] shadow-lg
                                            ${addedToCart ? 'bg-green-500 shadow-green-500/20' : 'bg-primary hover:bg-primary/90 shadow-primary/20'}`}
                                    >
                                        {addedToCart ? (
                                            <><Check size={18} /> تمت الإضافة!</>
                                        ) : (
                                            <><ShoppingCart size={18} /> إضافة {quantity > 1 ? `(${quantity})` : ''} للسلة</>
                                        )}
                                    </button>
                                )}
                                <a
                                    href={`https://wa.me/212664630566?text=السلام عليكم، أريد الاستفسار بخصوص هذا المنتج:%0A%0A*المنتج:* ${viewedProduct.name || 'بدون اسم'}%0A*المرجع:* ${viewedProduct.ref}%0A*الثمن:* ${viewedProduct.price} DH`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center w-12 h-12 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] active:scale-95 transition-all shadow-lg shadow-green-500/20"
                                >
                                    <img src={WA_ICON} alt="WhatsApp" className="w-6 h-6" />
                                </a>
                            </div>
                        </div>
                    </Motion.div>
                </div>
            )}
        </AnimatePresence>

        <ImageModal
            isOpen={lightboxOpen}
            onClose={() => setLightboxOpen(false)}
            images={allImages}
            initialIndex={currentIndex}
            onIndexChange={setCurrentIndex}
            alt={fullTitle || viewedProduct.name || viewedProduct.ref}
            productRef={viewedProduct.ref}
            zIndexClass="z-[120]"
        />
    </>
    );
};

export default QuickViewModal;
