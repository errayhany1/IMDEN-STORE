import React, { useState } from 'react';
import {
    ShoppingCart,
    Check,
    Heart,
    Bell,
    BellRing,
    Eye,
    Mouse,
    Headphones,
    Keyboard,
    Gamepad2,
    Watch,
    Cable,
    Smartphone,
    Fan,
    Tag,
    BatteryCharging,
    Camera,
    Wifi,
    Mic,
    Box,
    Lightbulb,
    Monitor,
    Car,
    Usb,
} from 'lucide-react';
import useStore from '../store/useStore';
import { useTranslation } from '../hooks/useTranslation';
import QuickViewModal from './QuickViewModal';
import { ProductColorDots } from './ProductColorPicker';
import ProductRatingStars from './ProductRatingStars';
import { frenchProductTitle, isRtlText } from '../utils/productText';
import { productDiscount, productTypeChip } from '../utils/productOffer';
import { slugify } from '../utils/slugify';
import { saveBrowseRestoreFromStore } from '../utils/browseRestore';
import './ProductCard.css';

const WA_ICON = "https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg";

const CHIP_ICONS = {
    mouse: Mouse,
    headphones: Headphones,
    keyboard: Keyboard,
    gamepad: Gamepad2,
    watch: Watch,
    cable: Cable,
    phone: Smartphone,
    fan: Fan,
    tag: Tag,
    battery: BatteryCharging,
    camera: Camera,
    wifi: Wifi,
    mic: Mic,
    storage: Box,
    light: Lightbulb,
    stand: Monitor,
    car: Car,
    hub: Usb,
    tv: Monitor,
};

const ProductCard = ({ product, priority = false }) => {
    const addToCart = useStore((state) => state.addToCart);
    const darkMode = useStore((state) => state.darkMode);
    const gridColumns = useStore((state) => state.gridColumns);
    const browseMode = useStore((state) => state.browseMode);
    const wishlist = useStore((state) => state.wishlist);
    const toggleWishlistItem = useStore((state) => state.toggleWishlistItem);
    const restockSubscriptions = useStore((state) => state.restockSubscriptions);
    const toggleRestockSubscription = useStore((state) => state.toggleRestockSubscription);
    const language = useTranslation((state) => state.language);
    const t = useTranslation((state) => state.t);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [hoveredThumb, setHoveredThumb] = useState(null);
    const [addedToCart, setAddedToCart] = useState(false);

    const isWishlisted = wishlist.some((item) => item.id === product.id);
    const isCatalog = browseMode === 'catalog';
    const cardTitle = frenchProductTitle(product);
    const cardTitleRtl = isRtlText(cardTitle);
    const productSlug = slugify(product.name || cardTitle || '');
    const productHref = `/p/${encodeURIComponent(product.ref || product.id)}${productSlug ? `/${productSlug}` : ''}`;

    const dm = darkMode;
    const isFr = language === 'fr';
    const singleCol = gridColumns === 1;
    const isOutOfStock = product.category === 'Out of Stock' || product.isAvailable === false;
    const hasColors = Array.isArray(product.variants) && product.variants.length > 1;
    const isWatchingRestock = restockSubscriptions.some(
        (item) => String(item.id || item.ref) === String(product.id || product.ref)
    );
    const discount = productDiscount(product);
    const typeChip = productTypeChip(product, isFr);
    const ChipIcon = CHIP_ICONS[typeChip.icon] || Tag;

    const rememberBrowseMode = () => {
        try {
            sessionStorage.setItem('lastBrowseMode', isCatalog ? 'catalog' : 'shop');
        } catch {
            /* ignore */
        }
        saveBrowseRestoreFromStore(useStore.getState);
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

    const handleAddToCart = () => {
        if (isOutOfStock || addedToCart) return;
        if (hasColors) {
            if (isCatalog) setIsModalOpen(true);
            else openProductPage();
            return;
        }
        addToCart(product);
        setAddedToCart(true);
        setTimeout(() => setAddedToCart(false), 1500);
    };

    const allImages = product.images && product.images.length > 0 ? product.images : (product.image ? [product.image] : []);
    const displayImage = hoveredThumb !== null
        ? allImages[hoveredThumb]
        : (product.thumbnail || product.image || null);
    const extraThumbs = allImages.length > 1 ? allImages.slice(1, 3) : [];
    const overlayBtn = `w-8 h-8 rounded-full flex items-center justify-center shadow-sm backdrop-blur-sm transition-all duration-300 active:scale-90 ${
        dm ? 'bg-gray-900/70 text-gray-200' : 'bg-white text-slate-500 hover:text-slate-800'
    }`;

    return (
        <>
        <article
            dir="ltr"
            className={`rounded-2xl hover:shadow-[0_16px_36px_rgba(15,23,42,0.10)] shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition-all duration-300 border flex flex-col overflow-hidden group h-full relative
                ${dm ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-100'}`}
        >
                {isOutOfStock && (
                    <div className="absolute inset-0 z-20 pointer-events-none bg-black/5 flex items-center justify-center">
                        <div className="bg-red-600/90 text-white font-bold px-4 py-1 rounded-md transform -rotate-12 border border-red-200 shadow-xl text-sm">
                            {t('outOfStock')}
                        </div>
                    </div>
                )}

                <div
                    className={`relative aspect-[4/5] overflow-hidden cursor-pointer ${dm ? 'bg-gray-950' : 'bg-[#f4f7fb]'}`}
                    onClick={handleMediaClick}
                >
                    {discount.percent > 0 && !isOutOfStock && (
                        <span className="absolute top-2.5 start-2.5 z-30 bg-red-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-lg">
                            -{discount.percent}%
                        </span>
                    )}

                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleWishlistItem(product); }}
                        className={`absolute top-2.5 end-2.5 z-30 ${overlayBtn}
                            ${isWishlisted ? '!bg-red-500 !text-white' : 'hover:text-red-500'}`}
                        title={isWishlisted ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
                        aria-label="المفضلة"
                    >
                        <Heart size={15} fill={isWishlisted ? 'currentColor' : 'none'} className={isWishlisted ? 'animate-heart-pop' : ''} />
                    </button>

                    {isCatalog && (
                        <a
                            href={productHref}
                            onClick={(e) => {
                                e.stopPropagation();
                                rememberBrowseMode();
                            }}
                            className={`absolute top-12 end-2.5 z-30 ${overlayBtn} ${dm ? 'text-sky-300' : 'text-sky-600 hover:text-sky-700'}`}
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
                            className={`absolute top-2.5 start-2.5 z-30 h-8 px-2 rounded-full flex items-center gap-1 backdrop-blur-sm shadow-sm transition-all active:scale-95 text-[10px] font-bold
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
                            className={`w-full h-full object-contain p-2 transform group-hover:scale-105 transition-transform duration-500 ${isOutOfStock ? 'opacity-90' : ''}`}
                            loading={priority ? 'eager' : 'lazy'}
                            fetchPriority={priority ? 'high' : 'auto'}
                            decoding="async"
                            width="300"
                            height="375"
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
                    className={`p-3 md:p-3.5 flex flex-col gap-2 flex-1 ${isOutOfStock ? 'opacity-80' : ''} ${!isCatalog ? 'cursor-pointer' : ''}`}
                    onClick={!isCatalog ? openProductPage : undefined}
                >
                    <span className={`inline-flex items-center gap-1 self-start max-w-full text-[11px] font-medium px-2 py-0.5 rounded-full
                        ${dm ? 'bg-gray-700 text-gray-300' : 'bg-slate-100 text-slate-500'}`}>
                        <ChipIcon size={12} className="shrink-0 opacity-80" />
                        <span className="truncate">{typeChip.label}</span>
                    </span>

                    {cardTitle && cardTitle !== 'Unnamed Product' && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleMediaClick();
                            }}
                            className={`text-[13px] sm:text-sm font-bold leading-snug line-clamp-2 min-h-[2.5rem] text-start ${cardTitleRtl ? 'text-right' : 'text-left'} ${dm ? 'text-white' : 'text-slate-900'}`}
                            dir={cardTitleRtl ? 'rtl' : 'ltr'}
                            title={cardTitle}
                        >
                            {cardTitle}
                        </button>
                    )}

                    <ProductRatingStars
                        product={product}
                        darkMode={dm}
                        readOnly
                        size={singleCol ? 15 : 13}
                        onRequestRate={handleMediaClick}
                        className="!flex-row !justify-start"
                    />

                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-baseline gap-1.5 min-w-0">
                            <strong className={`text-base sm:text-lg font-extrabold leading-none ${dm ? 'text-white' : 'text-slate-900'}`}>
                                DH {product.price}
                            </strong>
                            {discount.percent > 0 && (
                                <span className={`text-xs line-through ${dm ? 'text-gray-500' : 'text-slate-400'}`}>
                                    DH {discount.oldPrice}
                                </span>
                            )}
                        </div>
                        {!isOutOfStock && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                {isFr ? 'En stock' : 'متوفر'}
                            </span>
                        )}
                    </div>

                    {hasColors && <ProductColorDots variants={product.variants} />}

                    <div className="mt-auto flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                        <button
                            type="button"
                            onClick={handleAddToCart}
                            disabled={isOutOfStock}
                            className={`flex-1 min-w-0 font-semibold h-10 px-2 rounded-xl flex items-center justify-center gap-1.5 text-white text-[12px] sm:text-sm transition-all duration-300 active:scale-[0.96]
                                ${addedToCart ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30'
                                    : isOutOfStock ? 'bg-gray-400 cursor-not-allowed shadow-none'
                                    : 'bg-primary hover:bg-primary-dark shadow-sm'}`}
                        >
                            {addedToCart ? (
                                <><Check size={16} className="shrink-0" /> {t('added')}</>
                            ) : (
                                <><ShoppingCart size={16} className="shrink-0" /> <span className="truncate">{t('addToCart')}</span></>
                            )}
                        </button>
                        <a
                            href={`https://wa.me/212664630566?text=السلام عليكم، أريد الاستفسار بخصوص هذا المنتج:%0A%0A*المنتج:* ${product.name || 'بدون اسم'}%0A*المرجع:* ${product.ref}%0A*الثمن:* ${product.price} DH`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center w-10 h-10 shrink-0 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] active:scale-95 transition-all shadow-sm"
                        >
                            <img src={WA_ICON} alt="WhatsApp" className="w-5 h-5" />
                        </a>
                    </div>
                </div>
            </article>

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
