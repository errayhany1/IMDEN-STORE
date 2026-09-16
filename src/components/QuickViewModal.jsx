import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ShoppingCart, Check, Minus, Plus, Heart, Bell, BellRing, Share2, Truck, ShieldCheck, BadgeCheck, Headset, CreditCard } from 'lucide-react';
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
import ProductColorPicker, { cartProductFromVariant } from './ProductColorPicker';
import { fetchTifawtColors } from '../services/api';
import { productBrand, productDiscount, productFeatureChips } from '../utils/productOffer';

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
    const [colorVariants, setColorVariants] = useState([]);
    const [selectedVariantId, setSelectedVariantId] = useState(null);
    const [colorSource, setColorSource] = useState('');

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
    const selectedVariant = colorVariants.find(
        (variant) => String(variant.id) === String(selectedVariantId),
    ) || null;
    const allImages = (selectedVariant?.images?.length
        ? selectedVariant.images
        : (viewedProduct?.images && viewedProduct.images.length > 0
            ? viewedProduct.images
            : (viewedProduct?.image ? [viewedProduct.image] : [])));
    const isOutOfStock = viewedProduct?.category === 'Out of Stock'
        || viewedProduct?.isAvailable === false
        || selectedVariant?.inStock === false;
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
        if (isOutOfStock) return;
        if (colorSource === 'tifawt' && colorVariants.length && !selectedVariant) return;
        const qty = Math.max(1, Number(quantity) || 1);
        setQuantity(qty);
        addToCart(cartProductFromVariant(viewedProduct, selectedVariant, false), qty);
        setAddedToCart(true);
        setTimeout(() => {
            setAddedToCart(false);
        }, 1500);
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
            setSelectedVariantId(null);
            const existing = Array.isArray(product?.variants) ? product.variants : [];
            if (existing.length) {
                setColorVariants(existing);
                setColorSource(product.colorSource || 'noco');
                if (product.colorSource === 'tifawt') {
                    const first = existing.find((row) => row.inStock !== false) || existing[0];
                    if (first?.id != null) setSelectedVariantId(first.id);
                }
            } else {
                setColorVariants([]);
                setColorSource('');
                const sku = product?.ref || product?.SKU;
                if (sku) {
                    fetchTifawtColors(sku).then((rows) => {
                        if (!rows.length) return;
                        setColorVariants(rows);
                        setColorSource('tifawt');
                        const first = rows.find((row) => row.inStock !== false) || rows[0];
                        if (first?.id != null) setSelectedVariantId(first.id);
                    }).catch(() => {});
                }
            }
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
    let isFr = false;
    try { isFr = localStorage.getItem('site_lang') === 'fr'; } catch { /* ignore */ }
    const od = viewedProduct.originalData || {};
    const discount = productDiscount(viewedProduct);
    const brand = productBrand(viewedProduct);
    const subtitle = String(
        isFr
            ? (od.Hero_Line_FR || od.hero_line_fr || od.short_description_fr || '')
            : (od.Hero_Line_AR || od.hero_line_ar || od.short_description_ar || ''),
    ).trim();
    const chips = productFeatureChips(
        `${fullTitle} ${arabicTitle} ${descriptionText} ${descriptionBullets.join(' ')}`,
        isFr,
        descriptionBullets,
    );
    const t = isFr
        ? {
            add: 'Ajouter au panier',
            added: 'Ajouté !',
            qty: 'Quantité',
            stock: 'En stock',
            out: 'Rupture de stock',
            share: 'Partager',
            reviews: 'avis',
            ship: 'Livraison gratuite partout au Maroc',
            shipMeta: 'Paiement à la livraison  |  24 – 48 heures',
            trustShip: 'Livraison gratuite dans tout le Maroc',
            trustPay: 'Paiement à la livraison',
            trustOrig: 'Produit original Garantie qualité',
            trustHelp: 'Support client 7j/7',
            restock: 'Me prévenir',
            watching: 'Alerte activée',
            related: 'Vous aimerez aussi',
        }
        : {
            add: 'إضافة للسلة',
            added: 'تمت الإضافة!',
            qty: 'الكمية',
            stock: 'متوفر',
            out: 'نفد من المخزون',
            share: 'مشاركة',
            reviews: 'تقييم',
            ship: 'توصيل مجاني لجميع مدن المغرب',
            shipMeta: 'الدفع عند الاستلام  |  24 – 48 ساعة',
            trustShip: 'توصيل مجاني في كل المغرب',
            trustPay: 'الدفع عند الاستلام',
            trustOrig: 'منتج أصلي · ضمان الجودة',
            trustHelp: 'دعم الزبناء 7/7',
            restock: 'أعلمني عند التوفر',
            watching: 'سنخبرك عند توفره',
            related: 'قد يعجبك أيضاً',
        };

    const openProductPage = () => {
        onClose?.();
        try {
            sessionStorage.setItem(
                'lastBrowseMode',
                useStore.getState().browseMode === 'catalog' ? 'catalog' : 'shop',
            );
        } catch { /* ignore */ }
        saveBrowseRestoreFromStore(useStore.getState);
        const sku = encodeURIComponent(viewedProduct.ref || viewedProduct.id);
        const slug = slugify(viewedProduct.name || '');
        window.location.assign(`/p/${sku}${slug ? `/${slug}` : ''}`);
    };

    const shareProduct = async () => {
        const url = `${window.location.origin}/p/${encodeURIComponent(viewedProduct.ref || viewedProduct.id)}`;
        try {
            if (navigator.share) {
                await navigator.share({ title: fullTitle, text: `${fullTitle} — ${viewedProduct.price} DH`, url });
                return;
            }
        } catch (e) {
            if (e?.name === 'AbortError') return;
        }
        handleCopyRef();
    };

    const trustItems = [
        { icon: Truck, label: t.trustShip },
        { icon: CreditCard, label: t.trustPay },
        { icon: ShieldCheck, label: t.trustOrig },
        { icon: Headset, label: t.trustHelp },
    ];

    const qtyControls = (
        <div className="flex items-center gap-3" dir="ltr">
            <button
                type="button"
                onClick={() => updateQty(-1)}
                className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all active:scale-90
                    ${dm ? 'border-gray-600 text-gray-200 hover:bg-gray-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                aria-label="-1"
            >
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
                aria-label={t.qty}
                className={`w-10 text-center text-lg font-bold bg-transparent outline-none ${dm ? 'text-white' : 'text-slate-900'}`}
            />
            <button
                type="button"
                onClick={() => updateQty(1)}
                className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all active:scale-90
                    ${dm ? 'border-gray-600 text-gray-200 hover:bg-gray-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                aria-label="+1"
            >
                <Plus size={16} />
            </button>
        </div>
    );

    const cartButton = isOutOfStock ? (
        <button
            type="button"
            onClick={handleRestockAlert}
            className={`w-full font-bold py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.97]
                ${isWatchingRestock
                    ? 'bg-amber-500 text-white'
                    : dm ? 'bg-gray-800 text-amber-400 border border-amber-500/30' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}
        >
            {isWatchingRestock ? <BellRing size={18} /> : <Bell size={18} />}
            {isWatchingRestock ? t.watching : t.restock}
        </button>
    ) : (
        <button
            type="button"
            onClick={handleAddToCart}
            className={`w-full font-bold py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 text-white transition-all active:scale-[0.97] shadow-[0_10px_24px_-8px_rgba(25,127,230,0.55)]
                ${addedToCart ? 'bg-emerald-500' : 'bg-primary hover:bg-primary-dark'}`}
        >
            {addedToCart ? <><Check size={18} /> {t.added}</> : <><ShoppingCart size={18} /> {t.add}</>}
        </button>
    );

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
                        className={`relative w-full sm:max-w-5xl max-h-[96vh] overflow-hidden flex flex-col
                            rounded-t-3xl sm:rounded-[28px] shadow-[0_24px_80px_rgba(15,23,42,0.18)] border
                            ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-100'}`}
                        dir={isFr ? 'ltr' : 'rtl'}
                    >
                        <button
                            onClick={onClose}
                            className={`absolute top-3 start-3 z-20 p-2 rounded-full transition-colors
                                ${dm ? 'bg-gray-800/90 hover:bg-gray-700 text-gray-300' : 'bg-white hover:bg-slate-50 text-slate-500'} shadow-md`}
                        >
                            <X size={18} />
                        </button>

                        <div className="relative flex-1 min-h-0 flex flex-col">
                        <div
                            ref={infoRef}
                            onScroll={syncInfoScroll}
                            className="flex-1 overflow-y-auto"
                        >
                            <div className="grid sm:grid-cols-2 gap-5 sm:gap-8 p-4 sm:p-6 pt-14 sm:pt-8">
                                {/* Gallery */}
                                <div>
                                    <div className={`relative aspect-square overflow-hidden rounded-2xl ${dm ? 'bg-gray-950' : 'bg-[#f4f7fb]'}`}>
                                        {discount.percent > 0 && (
                                            <span className="absolute top-4 start-4 z-10 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow-sm">
                                                -{discount.percent}%
                                            </span>
                                        )}
                                        <button
                                            type="button"
                                            onClick={handleToggleWishlist}
                                            className={`absolute top-4 end-4 z-10 w-10 h-10 rounded-full flex items-center justify-center shadow-sm transition-all
                                                ${isWishlisted
                                                    ? 'bg-red-500 text-white'
                                                    : dm ? 'bg-gray-800 text-gray-300' : 'bg-white text-slate-400 hover:text-red-500'}`}
                                            title={isWishlisted ? (isFr ? 'Retirer des favoris' : 'إزالة من المفضلة') : (isFr ? 'Ajouter aux favoris' : 'إضافة للمفضلة')}
                                        >
                                            <Heart size={18} fill={isWishlisted ? 'currentColor' : 'none'} className={isWishlisted ? 'animate-heart-pop' : ''} />
                                        </button>
                                        {allImages.length > 0 ? (
                                            <button
                                                type="button"
                                                onClick={() => setLightboxOpen(true)}
                                                className="block w-full h-full cursor-zoom-in"
                                                aria-label={isFr ? 'Agrandir' : 'تكبير الصورة'}
                                            >
                                                <img
                                                    src={allImages[currentIndex]}
                                                    alt={`${viewedProduct.name || viewedProduct.ref} - Errayhany`}
                                                    className="w-full h-full object-contain p-6 pointer-events-none"
                                                    draggable={false}
                                                />
                                            </button>
                                        ) : (
                                            <div className={`w-full h-full flex items-center justify-center text-sm ${dm ? 'text-gray-500' : 'text-slate-400'}`}>
                                                {isFr ? 'Pas d’image' : 'لا توجد صورة'}
                                            </div>
                                        )}
                                        {allImages.length > 1 && (
                                            <>
                                                <button type="button" onClick={handlePrev}
                                                    className={`absolute start-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center shadow-md z-10
                                                        ${dm ? 'bg-gray-800 text-white' : 'bg-white text-slate-600'}`}>
                                                    <ChevronLeft size={18} className={isFr ? '' : 'rotate-180'} />
                                                </button>
                                                <button type="button" onClick={handleNext}
                                                    className={`absolute end-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center shadow-md z-10
                                                        ${dm ? 'bg-gray-800 text-white' : 'bg-white text-slate-600'}`}>
                                                    <ChevronRight size={18} className={isFr ? '' : 'rotate-180'} />
                                                </button>
                                            </>
                                        )}
                                    </div>

                                    {allImages.length > 1 && (
                                        <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar pb-1">
                                            {allImages.slice(0, 6).map((img, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => setCurrentIndex(idx)}
                                                    className={`shrink-0 w-[72px] h-[72px] rounded-xl border-2 overflow-hidden transition
                                                        ${currentIndex === idx
                                                            ? 'border-primary shadow-sm'
                                                            : dm ? 'border-gray-700 bg-gray-800' : 'border-slate-200 bg-slate-50'}`}
                                                >
                                                    <img src={img} alt="" className="w-full h-full object-contain p-1" loading="lazy" />
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    <div className={`mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 ${dm ? 'text-gray-400' : 'text-slate-500'}`}>
                                        {trustItems.map((item) => {
                                            const Icon = item.icon;
                                            return (
                                                <div key={item.label} className="flex flex-col items-center text-center gap-1.5 px-1">
                                                    <Icon size={18} className="opacity-80" />
                                                    <span className="text-[10px] leading-snug font-medium">{item.label}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Offer */}
                                <div className="flex flex-col gap-4 sm:pt-1">
                                    <div className="flex items-start justify-between gap-3">
                                        <p className={`text-sm font-medium ${dm ? 'text-gray-400' : 'text-slate-400'}`}>
                                            {brand || (isFr ? 'Errayhany' : 'Errayhany')}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={shareProduct}
                                            className={`inline-flex items-center gap-1.5 text-sm font-medium px-2.5 py-1.5 rounded-lg transition
                                                ${dm ? 'text-gray-300 hover:bg-gray-800' : 'text-slate-500 hover:bg-slate-50'}`}
                                        >
                                            <Share2 size={15} />
                                            {t.share}
                                        </button>
                                    </div>

                                    {fullTitle && fullTitle !== 'Unnamed Product' && (
                                        <h3
                                            className={`text-[1.65rem] sm:text-[1.85rem] font-extrabold leading-tight ${titleRtl ? 'text-right' : 'text-left'} ${dm ? 'text-white' : 'text-slate-900'}`}
                                            dir={titleRtl ? 'rtl' : 'ltr'}
                                        >
                                            {fullTitle}
                                        </h3>
                                    )}
                                    {subtitle && (
                                        <p className={`text-sm leading-relaxed -mt-2 ${dm ? 'text-gray-400' : 'text-slate-500'}`}>
                                            {subtitle}
                                        </p>
                                    )}

                                    <ProductRatingStars
                                        product={viewedProduct}
                                        darkMode={dm}
                                        size={18}
                                        readOnly
                                        heroMeta
                                        reviewsLabel={t.reviews}
                                        onRequestRate={openProductPage}
                                    />

                                    <div className="flex flex-wrap items-end justify-between gap-3">
                                        <div className="flex items-baseline gap-2.5 flex-wrap">
                                            <span className={`text-[2rem] font-extrabold leading-none ${dm ? 'text-sky-400' : 'text-[#1d4ed8]'}`}>
                                                DH {viewedProduct.price}
                                            </span>
                                            {discount.percent > 0 && (
                                                <>
                                                    <span className={`text-lg line-through ${dm ? 'text-gray-500' : 'text-slate-400'}`}>
                                                        DH {discount.oldPrice}
                                                    </span>
                                                    <span className="text-sm font-bold text-red-500">-{discount.percent}%</span>
                                                </>
                                            )}
                                        </div>
                                        <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${isOutOfStock ? 'text-red-500' : 'text-emerald-600'}`}>
                                            <span className={`w-2 h-2 rounded-full ${isOutOfStock ? 'bg-red-500' : 'bg-emerald-500'}`} />
                                            {isOutOfStock ? t.out : t.stock}
                                        </span>
                                    </div>

                                    {chips.length > 0 && (
                                        <div className={`grid grid-cols-4 gap-2 py-3 border-y ${dm ? 'border-gray-800' : 'border-slate-100'}`}>
                                            {chips.map((chip) => {
                                                const Icon = chip.icon;
                                                return (
                                                    <div key={chip.label} className="flex flex-col items-center text-center gap-1.5">
                                                        <Icon size={18} className={dm ? 'text-gray-300' : 'text-slate-600'} />
                                                        <span className={`text-[10px] leading-snug font-medium ${dm ? 'text-gray-400' : 'text-slate-500'}`}>
                                                            {chip.label}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    <ProductColorPicker
                                        variants={colorVariants}
                                        selectedId={selectedVariantId}
                                        onSelect={(id) => {
                                            setSelectedVariantId(id);
                                            setCurrentIndex(0);
                                        }}
                                        allowAll={colorSource !== 'tifawt'}
                                        isFr={isFr}
                                        dm={dm}
                                        appearance="swatches"
                                    />

                                    {!isOutOfStock && (
                                        <div className="hidden sm:flex items-center justify-between gap-3">
                                            <span className={`text-sm font-semibold ${dm ? 'text-gray-300' : 'text-slate-700'}`}>{t.qty} :</span>
                                            {qtyControls}
                                        </div>
                                    )}

                                    <div className="hidden sm:block space-y-3">
                                        <div className="flex gap-2">
                                            <div className="flex-1">{cartButton}</div>
                                            <a
                                                href={`https://wa.me/212664630566?text=${encodeURIComponent(`${isFr ? 'Bonjour, je suis intéressé par' : 'السلام عليكم، أريد الاستفسار بخصوص هذا المنتج'}:\n\n${fullTitle}\n${viewedProduct.ref}\n${viewedProduct.price} DH`)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center justify-center w-12 h-12 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] active:scale-95 transition-all"
                                                title="WhatsApp"
                                            >
                                                <img src={WA_ICON} alt="WhatsApp" className="w-6 h-6" />
                                            </a>
                                        </div>
                                        <div className={`flex items-start gap-2.5 rounded-2xl px-3.5 py-3 ${dm ? 'bg-emerald-950/40 text-emerald-200' : 'bg-emerald-50 text-emerald-800'}`}>
                                            <BadgeCheck size={18} className="shrink-0 mt-0.5 text-emerald-600" />
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold leading-snug">{t.ship}</p>
                                                <p className={`text-[11px] mt-0.5 ${dm ? 'text-emerald-300/80' : 'text-emerald-700/80'}`}>{t.shipMeta}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleCopyRef}
                                        className={`self-start text-[11px] font-mono ${copied ? 'text-emerald-500' : dm ? 'text-gray-500' : 'text-slate-400'}`}
                                    >
                                        {copied ? <span className="inline-flex items-center gap-1"><Check size={12} /> REF {viewedProduct.ref}</span> : `REF : ${viewedProduct.ref}`}
                                    </button>
                                </div>
                            </div>

                            <div className="px-4 sm:px-6 pb-4">
                                <RelatedProducts
                                    product={viewedProduct}
                                    onSelect={setSelectedProduct}
                                    titleAr={t.related}
                                    titleFr={t.related}
                                    lang={isFr ? 'fr' : 'ar'}
                                />
                            </div>
                        </div>

                        {infoScrollable && (
                            <button
                                type="button"
                                onClick={scrollInfo}
                                className={`absolute bottom-20 sm:bottom-4 left-1/2 -translate-x-1/2 z-10 w-8 h-8 rounded-full flex items-center justify-center
                                    shadow-lg border backdrop-blur-sm transition-all active:scale-90
                                    ${dm
                                        ? 'bg-gray-800/90 border-gray-700 text-gray-300 hover:text-white'
                                        : 'bg-white/90 border-slate-200 text-slate-500 hover:text-primary'}`}
                                title={infoAtBottom ? (isFr ? 'Haut' : 'الرجوع للأعلى') : (isFr ? 'Bas' : 'تمرير للأسفل')}
                            >
                                {infoAtBottom ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                        )}
                        </div>

                        <div className={`sm:hidden p-4 pt-2 border-t space-y-3 ${dm ? 'border-gray-800 bg-gray-900' : 'border-slate-100 bg-white'}`}>
                            {!isOutOfStock && (
                                <div className="flex items-center justify-between">
                                    <span className={`text-sm font-semibold ${dm ? 'text-gray-300' : 'text-slate-700'}`}>{t.qty}</span>
                                    {qtyControls}
                                </div>
                            )}
                            <div className="flex gap-2">
                                <div className="flex-1">{cartButton}</div>
                                <a
                                    href={`https://wa.me/212664630566?text=${encodeURIComponent(`السلام عليكم، أريد الاستفسار بخصوص هذا المنتج:\n\n*المنتج:* ${viewedProduct.name || 'بدون اسم'}\n*المرجع:* ${viewedProduct.ref}\n*الثمن:* ${viewedProduct.price} DH`)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center w-12 h-12 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] active:scale-95 transition-all"
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
