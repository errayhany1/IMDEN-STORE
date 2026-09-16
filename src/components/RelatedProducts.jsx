import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Eye, Heart, ShoppingCart } from 'lucide-react';
import useStore from '../store/useStore';
import { frenchProductTitle, isRtlText } from '../utils/productText';
import { findRelatedProductTiers } from '../utils/relatedProducts';
import { productDiscount } from '../utils/productOffer';
import ProductRatingStars from './ProductRatingStars';

/** Only swap to the original photo when it exists and differs from the studio image. */
const hasHoverImage = (item) =>
  Boolean(item?.originalImage) && item.originalImage !== item.image;

function RelatedOfferCard({
  item,
  onSelect,
  addToCart,
  darkMode,
  isFr,
}) {
  const wishlist = useStore((state) => state.wishlist);
  const toggleWishlistItem = useStore((state) => state.toggleWishlistItem);
  const [added, setAdded] = useState(false);
  const label = frenchProductTitle(item) || item.name || item.ref;
  const rtl = isRtlText(label);
  const discount = productDiscount(item);
  const isWishlisted = wishlist.some((row) => String(row.id) === String(item.id));
  const dm = darkMode;

  const handleAdd = (event) => {
    event.stopPropagation();
    addToCart(item);
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  };

  return (
    <article
      dir="ltr"
      className={`group shrink-0 w-[220px] sm:w-[240px] md:w-[260px] rounded-3xl border overflow-hidden snap-start flex flex-col
        shadow-[0_10px_28px_rgba(15,23,42,0.06)] transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(15,23,42,0.10)]
        ${dm ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-100'}`}
    >
      <div className={`relative aspect-square overflow-hidden ${dm ? 'bg-gray-950' : 'bg-[#f4f7fb]'}`}>
        <button
          type="button"
          onClick={() => onSelect?.(item)}
          className="block w-full h-full"
        >
          {item.image ? (
            <>
              <img
                src={item.image}
                alt={label}
                className={`w-full h-full object-contain p-4 transition-opacity duration-300 ${hasHoverImage(item) ? 'group-hover:opacity-0' : ''}`}
                loading="lazy"
              />
              {hasHoverImage(item) && (
                <img
                  src={item.originalImage}
                  alt={label}
                  className="absolute inset-0 w-full h-full object-contain p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  loading="lazy"
                />
              )}
            </>
          ) : (
            <span className="h-full flex items-center justify-center text-xs text-slate-400">
              {isFr ? 'Sans image' : 'بدون صورة'}
            </span>
          )}
        </button>

        {discount.percent > 0 && (
          <span className="absolute top-3 start-3 z-10 bg-red-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-lg">
            -{discount.percent}%
          </span>
        )}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            toggleWishlistItem(item);
          }}
          className={`absolute top-3 end-3 z-10 w-9 h-9 rounded-full flex items-center justify-center shadow-sm
            ${isWishlisted
              ? 'bg-red-500 text-white'
              : dm ? 'bg-gray-800/90 text-gray-300' : 'bg-white text-slate-400 hover:text-red-500'}`}
          aria-label={isFr ? 'Favoris' : 'المفضلة'}
        >
          <Heart size={16} fill={isWishlisted ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="p-3.5 md:p-4 flex flex-col gap-2.5 flex-1">
        <button type="button" onClick={() => onSelect?.(item)} className="w-full text-start">
          <p
            className={`text-sm font-bold leading-snug line-clamp-2 min-h-[2.6rem] ${rtl ? 'text-right' : 'text-left'} ${dm ? 'text-white' : 'text-slate-900'}`}
            dir={rtl ? 'rtl' : 'ltr'}
            title={label}
          >
            {label}
          </p>
        </button>

        <ProductRatingStars
          product={item}
          darkMode={dm}
          size={14}
          readOnly
          heroMeta
          reviewsLabel={isFr ? 'avis' : 'تقييم'}
          className="!justify-start"
        />

        <div className="flex items-baseline gap-2 flex-wrap">
          <strong className={`text-xl font-extrabold leading-none ${dm ? 'text-sky-400' : 'text-[#1d4ed8]'}`}>
            DH {item.price}
          </strong>
          {discount.percent > 0 && (
            <>
              <span className={`text-sm line-through ${dm ? 'text-gray-500' : 'text-slate-400'}`}>
                DH {discount.oldPrice}
              </span>
              <span className="text-[11px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-md">
                -{discount.percent}%
              </span>
            </>
          )}
        </div>

        <div className="mt-auto grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={() => onSelect?.(item)}
            className={`h-10 rounded-xl border text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition
              ${dm
                ? 'border-gray-600 text-gray-200 hover:bg-gray-700'
                : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
          >
            <Eye size={15} />
            {isFr ? 'Voir' : 'عرض'}
          </button>
          <button
            type="button"
            onClick={handleAdd}
            className={`h-10 rounded-xl text-sm font-bold text-white inline-flex items-center justify-center gap-1.5 transition
              ${added ? 'bg-emerald-500' : 'bg-primary hover:bg-primary-dark'}`}
          >
            {added ? <Check size={15} /> : <ShoppingCart size={15} />}
            {added
              ? (isFr ? 'Ajouté' : 'تمت')
              : (isFr ? 'Panier' : 'أضف إلى السلة')}
          </button>
        </div>
      </div>
    </article>
  );
}

function RelatedStrip({
  items,
  onSelect,
  addToCart,
  darkMode,
  isFr,
  heading,
  badge,
}) {
  const scrollerRef = useRef(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const updateScrollState = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const left = el.scrollLeft;
    setCanScrollPrev(left > 4 || left < -4);
    setCanScrollNext(Math.abs(left) < max - 4);
  };

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return undefined;
    const frame = window.requestAnimationFrame(updateScrollState);
    el.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);
    return () => {
      window.cancelAnimationFrame(frame);
      el.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [items]);

  const scrollByCards = (direction) => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = Math.max(260, Math.round(el.clientWidth * 0.8));
    el.scrollBy({ left: direction * amount, behavior: 'smooth' });
  };

  if (!items?.length) return null;

  const showArrows = items.length > 2;
  const btnClass = darkMode
    ? 'border-gray-700 bg-gray-900 text-gray-200 hover:bg-gray-800 disabled:opacity-30'
    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 shadow-sm';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className={`text-lg md:text-xl font-extrabold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
          {heading}
        </h4>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${darkMode ? 'text-gray-400' : 'text-slate-500'}`}>
            {badge}
          </span>
          {showArrows && (
            <div className="flex items-center gap-1.5" dir="ltr">
              <button
                type="button"
                aria-label={isFr ? 'Précédent' : 'السابق'}
                disabled={!canScrollPrev}
                onClick={() => scrollByCards(-1)}
                className={`w-9 h-9 rounded-full border flex items-center justify-center transition-colors ${btnClass}`}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                aria-label={isFr ? 'Suivant' : 'التالي'}
                disabled={!canScrollNext}
                onClick={() => scrollByCards(1)}
                className={`w-9 h-9 rounded-full border flex items-center justify-center transition-colors ${btnClass}`}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="flex gap-4 overflow-x-auto pb-2 no-scrollbar snap-x snap-mandatory"
      >
        {items.map((item) => (
          <RelatedOfferCard
            key={item.id || item.ref}
            item={item}
            onSelect={onSelect}
            addToCart={addToCart}
            darkMode={darkMode}
            isFr={isFr}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Two horizontal strips:
 * 1) closest complementary products
 * 2) looser / exploratory related products
 */
const RelatedProducts = ({
  product,
  onSelect,
  limit = 12,
  secondaryLimit = 12,
  titleAr = 'قد يعجبك أيضاً',
  titleFr = 'Vous aimerez aussi',
  lang = 'ar',
}) => {
  const products = useStore((state) => state.products);
  const addToCart = useStore((state) => state.addToCart);
  const darkMode = useStore((state) => state.darkMode);

  const { primary, secondary } = useMemo(
    () => findRelatedProductTiers(product, products, {
      primaryLimit: limit,
      secondaryLimit,
    }),
    [product, products, limit, secondaryLimit]
  );

  if (!primary.length && !secondary.length) return null;

  const isFr = lang === 'fr';

  return (
    <section className="space-y-10">
      <RelatedStrip
        items={primary}
        onSelect={onSelect}
        addToCart={addToCart}
        darkMode={darkMode}
        isFr={isFr}
        heading={isFr ? titleFr : titleAr}
        badge={isFr ? 'Les plus vendus' : 'الأكثر مبيعاً'}
      />
      <RelatedStrip
        items={secondary}
        onSelect={onSelect}
        addToCart={addToCart}
        darkMode={darkMode}
        isFr={isFr}
        heading={isFr ? 'Vous aimerez aussi' : 'قد يهمك أيضاً'}
        badge={isFr ? 'Voir plus' : 'عرض المزيد'}
      />
    </section>
  );
};

export default RelatedProducts;
