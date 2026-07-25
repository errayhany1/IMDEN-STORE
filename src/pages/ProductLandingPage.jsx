import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ShoppingCart,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import useStore from '../store/useStore';
import {
  fetchProducts,
  fetchProductBySku,
  skusMatch,
} from '../services/api';
import BottomNavBar from '../components/BottomNavBar';
import CartSidebar from '../components/CartSidebar';
import WishlistSidebar from '../components/WishlistSidebar';
import AuthModal from '../components/AuthModal';
import ImageModal from '../components/ImageModal';
import ProductRatingStars from '../components/ProductRatingStars';
import {
  listItemsFromHtml,
  productDescriptionHtml,
  stripHtml,
} from '../utils/productText';

const WA_NUMBER = '212664630566';
const SITE_URL = 'https://errayhany.com';
const BRAND = 'Errayhany';

function getLang() {
  try {
    return localStorage.getItem('site_lang') === 'fr' ? 'fr' : 'ar';
  } catch {
    return 'ar';
  }
}

function decodeSku(value) {
  try {
    return decodeURIComponent(String(value || '').trim());
  } catch {
    return String(value || '').trim();
  }
}

function setMetaTag(attr, key, content) {
  if (!content) return;
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

const ProductLandingPage = ({ sku: skuProp }) => {
  const addToCart = useStore((s) => s.addToCart);
  const storeProducts = useStore((s) => s.products);
  const setProducts = useStore((s) => s.setProducts);
  const appendProducts = useStore((s) => s.appendProducts);
  const toggleCart = useStore((s) => s.toggleCart);
  const darkMode = useStore((s) => s.darkMode);

  const [lang, setLang] = useState(getLang);
  const [activeImg, setActiveImg] = useState(0);
  const [loading, setLoading] = useState(true);
  const [directProduct, setDirectProduct] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [zoomOpen, setZoomOpen] = useState(false);
  const [addedFlash, setAddedFlash] = useState(false);
  const touchX = useRef(null);

  const sku = useMemo(() => {
    if (skuProp) return decodeSku(skuProp);
    const parts = window.location.pathname.split('/').filter(Boolean);
    return decodeSku(parts[1] || '');
  }, [skuProp]);

  const productFromStore = useMemo(() => {
    const list = storeProducts || [];
    return list.find((p) => skusMatch(p.ref, sku))
      || list.find((p) => skusMatch(p.id, sku))
      || null;
  }, [storeProducts, sku]);

  const product = directProduct || productFromStore;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setLoadError('');
      setDirectProduct(null);
      setActiveImg(0);
      try {
        await fetchProducts((chunk, _cats, meta = {}) => {
          if (cancelled || !chunk?.length) return;
          if (meta.replace) setProducts(chunk);
          else appendProducts(chunk);
        });
      } catch (error) {
        console.error('Landing catalog fetch failed:', error);
      }
      if (cancelled) return;
      const latest = useStore.getState().products || [];
      const found = latest.find((p) => skusMatch(p.ref, sku))
        || latest.find((p) => skusMatch(p.id, sku));
      if (!found) {
        try {
          const single = await fetchProductBySku(sku);
          if (!cancelled && single) {
            setDirectProduct(single);
            const exists = (useStore.getState().products || []).some((p) => skusMatch(p.ref, single.ref));
            if (!exists) appendProducts([single]);
          }
        } catch (error) {
          console.error('Direct SKU fetch failed:', error);
          if (!cancelled) setLoadError('تعذر تحميل المنتج حالياً.');
        }
      }
      if (!cancelled) setLoading(false);
    };
    if (!sku) {
      setLoading(false);
      return undefined;
    }
    load();
    return () => { cancelled = true; };
  }, [sku, setProducts, appendProducts]);

  const od = product?.originalData || {};
  const isFr = lang === 'fr';
  const title = isFr
    ? (od.French_Title || od.Woo_Title || product?.name || sku)
    : (od.Arabic_Title || od.Title || product?.name || sku);
  const descHtml = isFr
    ? (od.description_french || od.short_description_fr || productDescriptionHtml(product) || '')
    : (od.description_arabic || od.short_description_ar || productDescriptionHtml(product) || '');
  const plainDesc = stripHtml(descHtml);
  const bullets = useMemo(() => {
    const fromList = listItemsFromHtml(descHtml, 6);
    if (fromList.length) return fromList;
    if (!plainDesc) return [];
    return plainDesc
      .split(/[\n•●]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10)
      .slice(0, 5);
  }, [descHtml, plainDesc]);

  const images = useMemo(() => {
    const list = (product?.images?.length
      ? product.images
      : [product?.image, product?.originalImage].filter(Boolean));
    return Array.from(new Set((list || []).filter(Boolean)));
  }, [product]);

  const available = product?.isAvailable !== false;
  const dm = darkMode;

  const backHref = (() => {
    try {
      return sessionStorage.getItem('lastBrowseMode') === 'catalog' ? '/catalog' : '/';
    } catch {
      return '/';
    }
  })();

  useEffect(() => {
    if (!product) return undefined;
    const metaTitle = `${title} | ${BRAND}`;
    const metaDesc = (plainDesc || `${title} — ${product.price} DH`).slice(0, 160);
    document.title = metaTitle;
    setMetaTag('name', 'description', metaDesc);
    setMetaTag('property', 'og:title', metaTitle);
    setMetaTag('property', 'og:description', metaDesc);
    setMetaTag('property', 'og:type', 'product');
    if (images[0]) {
      setMetaTag(
        'property',
        'og:image',
        images[0].startsWith('http') ? images[0] : `${SITE_URL}${images[0]}`
      );
    }

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: title,
      sku: product.ref,
      image: images.map((src) => (src.startsWith('http') ? src : `${SITE_URL}${src}`)),
      description: metaDesc,
      brand: { '@type': 'Brand', name: BRAND },
      offers: {
        '@type': 'Offer',
        url: window.location.href,
        priceCurrency: 'MAD',
        price: product.price,
        availability: available
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      },
    };
    let script = document.getElementById('product-jsonld');
    if (!script) {
      script = document.createElement('script');
      script.id = 'product-jsonld';
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(jsonLd);
    return () => {
      script?.remove();
    };
  }, [product, title, plainDesc, images, available]);

  const handleAdd = () => {
    if (!product || !available) return;
    addToCart(product);
    setAddedFlash(true);
    setTimeout(() => setAddedFlash(false), 1600);
    if (!useStore.getState().isCartOpen) toggleCart();
  };

  const waText = encodeURIComponent(
    isFr
      ? `Bonjour, je suis intéressé par:\n${title}\nSKU: ${product?.ref}\nPrix: ${product?.price} DH\n${window.location.href}`
      : `السلام عليكم، أريد الاستفسار عن:\n${title}\nSKU: ${product?.ref}\nالثمن: ${product?.price} DH\n${window.location.href}`
  );

  const onTouchStart = (e) => {
    touchX.current = e.changedTouches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e) => {
    const start = touchX.current;
    touchX.current = null;
    if (start == null || images.length < 2) return;
    const delta = e.changedTouches[0].clientX - start;
    if (Math.abs(delta) < 40) return;
    const dir = isFr ? (delta > 0 ? -1 : 1) : (delta > 0 ? 1 : -1);
    setActiveImg((i) => (i + dir + images.length) % images.length);
  };

  const t = isFr
    ? {
      buy: 'Ajouter au panier',
      wa: 'WhatsApp',
      stock: 'En stock',
      out: 'Rupture',
      back: 'Retour',
      zoom: 'Agrandir',
      details: 'Détails',
      notFound: 'Produit introuvable',
      loading: 'Chargement…',
      added: 'Ajouté',
      rate: 'Votre avis',
    }
    : {
      buy: 'أضف إلى السلة',
      wa: 'واتساب',
      stock: 'متوفر',
      out: 'نفد',
      back: 'عودة',
      zoom: 'تكبير',
      details: 'التفاصيل',
      notFound: 'المنتج غير موجود',
      loading: 'جاري التحميل…',
      added: 'تمت الإضافة',
      rate: 'قيّم هذا المنتج',
    };

  const shell = dm ? 'bg-background-dark text-white' : 'bg-background-light text-slate-900';
  const panel = dm ? 'bg-surface-dark' : 'bg-white';
  const muted = dm ? 'text-gray-400' : 'text-slate-500';
  const soft = dm ? 'text-gray-300' : 'text-slate-600';
  const line = dm ? 'border-gray-700' : 'border-slate-200';

  if (loading && !product) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${shell}`}>
        {t.loading}
      </div>
    );
  }

  if (!product) {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center gap-4 p-6 ${shell}`}
        dir={isFr ? 'ltr' : 'rtl'}
      >
        <p className="text-xl font-bold">{t.notFound}</p>
        <p className={`text-sm ${muted}`}>{sku}</p>
        {loadError && <p className="text-xs text-red-500">{loadError}</p>}
        <a href={backHref} className="font-bold text-primary flex items-center gap-2">
          <ArrowRight size={16} className={isFr ? 'rotate-180' : ''} /> {t.back}
        </a>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen ${shell} pb-28 md:pb-8`}
      dir={isFr ? 'ltr' : 'rtl'}
    >
      <header className={`sticky top-0 z-30 border-b ${line} ${panel}/95 backdrop-blur-md`}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <a href={backHref} className="flex items-center gap-2 min-w-0">
            <ArrowRight size={18} className={`shrink-0 ${muted} ${isFr ? 'rotate-180' : ''}`} />
            <span className="text-lg font-bold text-primary truncate">{BRAND}</span>
          </a>
          <button
            type="button"
            onClick={() => {
              const next = isFr ? 'ar' : 'fr';
              localStorage.setItem('site_lang', next);
              setLang(next);
            }}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${line} ${dm ? 'hover:bg-gray-800' : 'hover:bg-slate-50'}`}
          >
            {isFr ? 'العربية' : 'FR'}
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-4 md:pt-8 md:grid md:grid-cols-2 md:gap-10 md:items-start">
        {/* Gallery */}
        <section className="md:sticky md:top-20">
          <button
            type="button"
            onClick={() => images.length && setZoomOpen(true)}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            className={`relative block w-full aspect-square overflow-hidden ${panel} ${dm ? '' : 'ring-1 ring-slate-200/80'}`}
            aria-label={t.zoom}
          >
            {images[activeImg] ? (
              <img
                key={images[activeImg]}
                src={images[activeImg]}
                alt={title}
                className="w-full h-full object-contain p-3 md:p-6"
                loading="eager"
                decoding="async"
                onError={(e) => {
                  if (product.originalImage && e.currentTarget.src !== product.originalImage) {
                    e.currentTarget.src = product.originalImage;
                  }
                }}
              />
            ) : (
              <div className={`w-full h-full flex items-center justify-center ${muted}`}>—</div>
            )}

            {images.length > 1 && (
              <>
                <span
                  className={`absolute top-3 inset-inline-end-3 text-[11px] font-semibold px-2 py-0.5 rounded-md ${dm ? 'bg-black/50 text-white' : 'bg-white/90 text-slate-600'}`}
                >
                  {activeImg + 1}/{images.length}
                </span>
                <button
                  type="button"
                  aria-label="prev"
                  className={`absolute top-1/2 -translate-y-1/2 inset-inline-start-2 p-2 rounded-full ${dm ? 'bg-black/40 text-white' : 'bg-white/90 text-slate-700 shadow-sm'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImg((i) => (i - 1 + images.length) % images.length);
                  }}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  aria-label="next"
                  className={`absolute top-1/2 -translate-y-1/2 inset-inline-end-2 p-2 rounded-full ${dm ? 'bg-black/40 text-white' : 'bg-white/90 text-slate-700 shadow-sm'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImg((i) => (i + 1) % images.length);
                  }}
                >
                  <ChevronRight size={16} />
                </button>
              </>
            )}
          </button>

          {images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {images.map((src, i) => (
                <button
                  key={src + i}
                  type="button"
                  onClick={() => setActiveImg(i)}
                  className={`shrink-0 w-14 h-14 overflow-hidden border-2 transition ${
                    activeImg === i
                      ? 'border-primary'
                      : `${line} opacity-70 hover:opacity-100`
                  } ${panel}`}
                >
                  <img src={src} alt="" loading="lazy" className="w-full h-full object-contain p-1" />
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Buy info */}
        <section className="mt-5 md:mt-0 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                  available
                    ? 'bg-emerald-50 text-emerald-700'
                    : dm ? 'bg-gray-700 text-gray-300' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {available ? t.stock : t.out}
              </span>
              {product.ref && (
                <span className={`text-[11px] font-mono ${muted}`}>{product.ref}</span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl md:text-[1.75rem] font-bold leading-snug">
              {title}
            </h1>
          </div>

          <div className="flex items-end justify-between gap-3 flex-wrap">
            <p className="text-3xl font-extrabold text-primary leading-none">
              {product.price}
              <span className="text-base font-bold ms-1 opacity-80">DH</span>
            </p>
            <div className="flex items-center gap-2">
              <ProductRatingStars product={product} size={18} emptyHint={null} darkMode={dm} />
              <span className={`text-xs font-semibold ${muted}`}>{t.rate}</span>
            </div>
          </div>

          <div className="hidden md:flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleAdd}
              disabled={!available}
              className="flex-1 min-h-12 bg-primary text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-45 hover:bg-primary-dark active:scale-[0.99] transition"
            >
              <ShoppingCart size={18} />
              {addedFlash ? t.added : t.buy}
            </button>
            <a
              href={`https://wa.me/${WA_NUMBER}?text=${waText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 min-h-12 bg-whatsapp text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:brightness-110"
            >
              <MessageCircle size={18} />
              {t.wa}
            </a>
          </div>

          {(bullets.length > 0 || plainDesc) && (
            <div className={`pt-2 border-t ${line}`}>
              <p className={`text-[11px] font-bold uppercase tracking-wide mb-2 ${muted}`}>
                {t.details}
              </p>
              {bullets.length > 0 ? (
                <ul className={`space-y-2 text-sm leading-relaxed list-disc ps-5 ${soft}`}>
                  {bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className={`text-sm leading-relaxed ${soft}`}>
                  {plainDesc.length > 320 ? `${plainDesc.slice(0, 320)}…` : plainDesc}
                </p>
              )}
            </div>
          )}
        </section>
      </main>

      {/* Sticky mobile buy bar */}
      <div className={`md:hidden fixed inset-x-0 bottom-0 z-40 border-t ${line} ${panel}/95 backdrop-blur-md px-3 pt-2.5 pb-[max(0.65rem,env(safe-area-inset-bottom))]`}>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className={`text-[10px] truncate ${muted}`}>{title}</p>
            <p className="text-lg font-extrabold leading-tight text-primary">{product.price} DH</p>
          </div>
          <a
            href={`https://wa.me/${WA_NUMBER}?text=${waText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 w-11 h-11 rounded-xl bg-whatsapp text-white flex items-center justify-center"
            aria-label={t.wa}
          >
            <MessageCircle size={20} />
          </a>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!available}
            className="shrink-0 min-h-11 px-4 rounded-xl bg-primary text-white font-bold text-sm flex items-center gap-1.5 disabled:opacity-45"
          >
            <ShoppingCart size={16} />
            {addedFlash ? t.added : t.buy}
          </button>
        </div>
      </div>

      <ImageModal
        isOpen={zoomOpen}
        onClose={() => setZoomOpen(false)}
        images={images}
        image={images[activeImg]}
        alt={title}
        productRef={product.ref}
      />

      <CartSidebar />
      <WishlistSidebar />
      <AuthModal />
      <div className="hidden md:block">
        <BottomNavBar />
      </div>
    </div>
  );
};

export default ProductLandingPage;
