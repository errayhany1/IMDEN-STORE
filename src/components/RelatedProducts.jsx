import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, ShoppingCart } from 'lucide-react';
import useStore from '../store/useStore';
import { frenchProductTitle, isRtlText } from '../utils/productText';
import { findRelatedProductTiers } from '../utils/relatedProducts';

/** Only swap to the original photo when it exists and differs from the studio image. */
const hasHoverImage = (item) =>
  Boolean(item?.originalImage) && item.originalImage !== item.image;

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
    // Support both LTR and RTL scrollLeft conventions
    setCanScrollPrev(left > 4 || left < -4);
    setCanScrollNext(Math.abs(left) < max - 4);
  };

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return undefined;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [items]);

  const scrollByCards = (direction) => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = Math.max(160, Math.round(el.clientWidth * 0.7));
    el.scrollBy({ left: direction * amount, behavior: 'smooth' });
  };

  if (!items?.length) return null;

  const showArrows = items.length > 2;
  const btnClass = darkMode
    ? 'border-gray-700 bg-gray-900 text-gray-200 hover:bg-gray-800 disabled:opacity-30'
    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-30';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>
          {heading}
        </h4>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-slate-400'}`}>
            {badge}
          </span>
          {showArrows && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label={isFr ? 'Précédent' : 'السابق'}
                disabled={!canScrollPrev}
                onClick={() => scrollByCards(isFr ? -1 : 1)}
                className={`w-7 h-7 rounded-full border flex items-center justify-center transition-colors ${btnClass}`}
              >
                <ChevronRight size={14} />
              </button>
              <button
                type="button"
                aria-label={isFr ? 'Suivant' : 'التالي'}
                disabled={!canScrollNext}
                onClick={() => scrollByCards(isFr ? 1 : -1)}
                className={`w-7 h-7 rounded-full border flex items-center justify-center transition-colors ${btnClass}`}
              >
                <ChevronLeft size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="relative">
        <div
          ref={scrollerRef}
          className="flex gap-2.5 overflow-x-auto pb-2 no-scrollbar snap-x"
        >
          {items.map((item) => {
            const label = frenchProductTitle(item) || item.name || item.ref;
            const rtl = isRtlText(label);
            return (
              <article
                key={item.id || item.ref}
                className={`group shrink-0 w-36 rounded-xl border overflow-hidden snap-start transition-all hover:-translate-y-0.5 hover:shadow-md
                  ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-200'}`}
              >
                <button
                  type="button"
                  onClick={() => onSelect?.(item)}
                  className={`relative block w-full aspect-square overflow-hidden ${darkMode ? 'bg-gray-950' : 'bg-slate-50'}`}
                >
                  {item.image ? (
                    <>
                      <img
                        src={item.image}
                        alt={label}
                        className={`w-full h-full object-contain p-1.5 transition-opacity duration-300 ${hasHoverImage(item) ? 'group-hover:opacity-0' : ''}`}
                        loading="lazy"
                      />
                      {hasHoverImage(item) && (
                        <img
                          src={item.originalImage}
                          alt={label}
                          className="absolute inset-0 w-full h-full object-contain p-1.5 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                          loading="lazy"
                        />
                      )}
                    </>
                  ) : (
                    <span className="h-full flex items-center justify-center text-[10px] text-slate-400">
                      {isFr ? 'Sans image' : 'بدون صورة'}
                    </span>
                  )}
                </button>

                <div className="p-2 space-y-2">
                  <button type="button" onClick={() => onSelect?.(item)} className="w-full">
                    <p
                      className={`text-[11px] font-semibold truncate ${rtl ? 'text-right' : 'text-left'} ${darkMode ? 'text-gray-200' : 'text-slate-700'}`}
                      dir={rtl ? 'rtl' : 'ltr'}
                      title={label}
                    >
                      {label}
                    </p>
                  </button>
                  <div className="flex items-center justify-between gap-1">
                    <strong className="text-xs text-primary whitespace-nowrap">{item.price} DH</strong>
                    <button
                      type="button"
                      onClick={() => addToCart(item)}
                      className="w-7 h-7 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white flex items-center justify-center transition-colors"
                      aria-label={isFr ? 'Ajouter au panier' : 'إضافة للسلة'}
                    >
                      <ShoppingCart size={13} />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelect?.(item)}
                    className={`w-full flex items-center justify-center gap-1 text-[10px] font-semibold py-1 rounded-lg
                      ${darkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-slate-500 hover:bg-slate-100'}`}
                  >
                    {isFr ? 'Voir' : 'عرض'} <ArrowLeft size={11} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
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
  limit = 8,
  secondaryLimit = 8,
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
    <section className="space-y-5">
      <RelatedStrip
        items={primary}
        onSelect={onSelect}
        addToCart={addToCart}
        darkMode={darkMode}
        isFr={isFr}
        heading={isFr ? titleFr : titleAr}
        badge={isFr ? 'Plus proches' : 'الأكثر صلة'}
      />
      <RelatedStrip
        items={secondary}
        onSelect={onSelect}
        addToCart={addToCart}
        darkMode={darkMode}
        isFr={isFr}
        heading={isFr ? 'Aussi intéressants' : 'قد يهمك أيضاً'}
        badge={isFr ? 'Moins proches' : 'أقل صلة'}
      />
    </section>
  );
};

export default RelatedProducts;
