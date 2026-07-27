import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  Truck,
  ShieldCheck,
  BadgeCheck,
  ChevronDown,
  Heart,
  Home,
  Globe2,
  Copy,
  Check,
  Search,
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
import RelatedProducts from '../components/RelatedProducts';
import {
  listItemsFromHtml,
  productDescriptionHtml,
  stripHtml,
  textsOverlap,
  imagesFromHtml,
  normalizeImagePath,
  isProductShotPath,
  isContentInfoImagePath,
} from '../utils/productText';

const WA_NUMBER = '212664630566';
const WA_ICON = 'https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg';
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

function parseFaq(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((x) => x?.q && x?.a).slice(0, 6);
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => x?.q && x?.a).slice(0, 6) : [];
  } catch {
    return [];
  }
}

/** Keep only safe tags from NocoDB HTML descriptions (incl. specs <img>). */
function sanitizeProductHtml(html) {
  if (!html) return '';
  if (typeof document === 'undefined') {
    return String(html)
      .replace(/<(script|iframe|object|embed)[^>]*>[\s\S]*?<\/\1>/gi, '')
      .replace(/\son\w+="[^"]*"/gi, '');
  }
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  tmp.querySelectorAll('script,iframe,object,embed').forEach((n) => n.remove());
  tmp.querySelectorAll('*').forEach((el) => {
    [...el.attributes].forEach((attr) => {
      if (/^on/i.test(attr.name) || attr.name === 'srcdoc') el.removeAttribute(attr.name);
    });
  });
  return tmp.innerHTML;
}

const ProductLandingPage = ({ sku: skuProp }) => {
  const addToCart = useStore((s) => s.addToCart);
  const storeProducts = useStore((s) => s.products);
  const setProducts = useStore((s) => s.setProducts);
  const appendProducts = useStore((s) => s.appendProducts);
  const toggleCart = useStore((s) => s.toggleCart);
  const toggleWishlistSidebar = useStore((s) => s.toggleWishlistSidebar);
  const cart = useStore((s) => s.cart);
  const wishlist = useStore((s) => s.wishlist);
  const darkMode = useStore((s) => s.darkMode);

  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const wishlistCount = wishlist.length;

  const [lang, setLang] = useState(getLang);
  const [activeImg, setActiveImg] = useState(0);
  const [loading, setLoading] = useState(true);
  const [directProduct, setDirectProduct] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [zoomOpen, setZoomOpen] = useState(false);
  const [zoomImages, setZoomImages] = useState([]);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [addedFlash, setAddedFlash] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);
  const [refCopied, setRefCopied] = useState(false);
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
      queueMicrotask(() => setLoading(false));
      return undefined;
    }
    load();
    return () => { cancelled = true; };
  }, [sku, setProducts, appendProducts]);

  const od = useMemo(() => product?.originalData || {}, [product]);
  const isFr = lang === 'fr';
  const title = isFr
    ? (od.French_Title || od.Woo_Title || product?.name || sku)
    : (od.Arabic_Title || od.Title || product?.name || sku);
  const heroLine = isFr
    ? (od.Hero_Line_FR || od.hero_line_fr || '')
    : (od.Hero_Line_AR || od.hero_line_ar || '');
  const shortHtml = isFr
    ? (od.short_description_fr || '')
    : (od.short_description_ar || '');
  const descHtml = isFr
    ? (od.description_french || od.short_description_fr || productDescriptionHtml(product) || '')
    : (od.description_arabic || od.short_description_ar || productDescriptionHtml(product) || '');
  const plainDesc = stripHtml(descHtml);
  const safeDescHtml = useMemo(() => sanitizeProductHtml(descHtml), [descHtml]);
  const bullets = useMemo(() => {
    const fromShort = listItemsFromHtml(shortHtml, 6);
    if (fromShort.length) return fromShort;
    return listItemsFromHtml(descHtml, 6);
  }, [shortHtml, descHtml]);

  const showHeroLine = useMemo(() => {
    if (!heroLine?.trim()) return false;
    return !textsOverlap(heroLine, title);
  }, [heroLine, title]);

  const showHighlights = useMemo(() => {
    if (!bullets.length) return false;
    const joined = bullets.join(' ');
    if (showHeroLine && textsOverlap(joined, heroLine)) return false;
    return !textsOverlap(joined, title);
  }, [bullets, showHeroLine, heroLine, title]);

  const faq = useMemo(
    () => parseFaq(isFr ? (od.Landing_FAQ_FR || od.faq_fr) : (od.Landing_FAQ_AR || od.faq_ar)),
    [od, isFr]
  );

  const images = useMemo(() => {
    const list = (product?.images?.length
      ? product.images
      : [product?.image, product?.originalImage].filter(Boolean));
    return Array.from(new Set((list || []).filter(Boolean)));
  }, [product]);

  /** Product shots only — specs / A+ cards stay in the description section. */
  const carouselImages = useMemo(
    () => images.filter((src) => !isContentInfoImagePath(src)),
    [images]
  );

  const specsImage = useMemo(() => {
    const fromGallery = images.find((src) => /specs-/i.test(src));
    if (fromGallery) return fromGallery;
    const match = String(descHtml || '').match(/<img[^>]+src=["']([^"']+)["']/i);
    return match?.[1] || '';
  }, [images, descHtml]);

  const heroImagePaths = useMemo(
    () => new Set(carouselImages.map((src) => normalizeImagePath(src, SITE_URL))),
    [carouselImages]
  );

  /** Amazon A+ body: keep copy + info images (specs/amazon), drop hero product shots. */
  const descriptionForAplus = useMemo(() => {
    if (!safeDescHtml) return '';
    return safeDescHtml.replace(/<img\b[^>]*>/gi, (tag) => {
      const m = tag.match(/src=["']([^"']+)["']/i);
      if (!m) return tag;
      const path = normalizeImagePath(m[1], SITE_URL);
      if (heroImagePaths.has(path) && isProductShotPath(m[1])) return '';
      return tag;
    });
  }, [safeDescHtml, heroImagePaths]);

  const inlineContentImages = useMemo(
    () => imagesFromHtml(descriptionForAplus).filter((src) => !isProductShotPath(src)),
    [descriptionForAplus]
  );

  const inlineContentPaths = useMemo(
    () => new Set(inlineContentImages.map((src) => normalizeImagePath(src, SITE_URL))),
    [inlineContentImages]
  );

  /** Info/lifestyle images stored in gallery but not shown in the top carousel. */
  const extraContentImages = useMemo(
    () => images.filter((src) => {
      if (!isContentInfoImagePath(src)) return false;
      const path = normalizeImagePath(src, SITE_URL);
      return !inlineContentPaths.has(path);
    }),
    [images, inlineContentPaths]
  );

  const aplusPlain = useMemo(() => stripHtml(descriptionForAplus), [descriptionForAplus]);

  const showAplusSection = useMemo(() => {
    if (aplusPlain.length >= 40) return true;
    if (inlineContentImages.length > 0) return true;
    if (extraContentImages.length > 0) return true;
    return false;
  }, [aplusPlain, inlineContentImages, extraContentImages]);

  const showFullDescription = useMemo(() => {
    if (!aplusPlain || aplusPlain.length < 60) return false;
    if (textsOverlap(aplusPlain, title)) return false;
    if (showHeroLine && textsOverlap(aplusPlain, heroLine)) return false;
    if (showHighlights && textsOverlap(aplusPlain, bullets.join(' '))) return false;
    return true;
  }, [aplusPlain, title, showHeroLine, heroLine, showHighlights, bullets]);

  const specRows = useMemo(() => {
    const rows = [];
    if (product?.ref) rows.push({ label: 'SKU', value: product.ref });
    if (od.brand || od.Brand) rows.push({ label: isFr ? 'Marque' : 'العلامة', value: od.brand || od.Brand });
    if (od.color || od.Color) rows.push({ label: isFr ? 'Couleur' : 'اللون', value: od.color || od.Color });
    if (product?.baseCategory || (product?.category && product.category !== 'Out of Stock')) {
      rows.push({
        label: isFr ? 'Catégorie' : 'الفئة',
        value: product.baseCategory || product.category,
      });
    }
    if (product?.price != null) rows.push({ label: isFr ? 'Prix' : 'الثمن', value: `${product.price} DH` });
    return rows;
  }, [product, od, isFr]);

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
    if (start == null || carouselImages.length < 2) return;
    const delta = e.changedTouches[0].clientX - start;
    if (Math.abs(delta) < 40) return;
    const dir = isFr ? (delta > 0 ? -1 : 1) : (delta > 0 ? 1 : -1);
    setActiveImg((i) => (i + dir + carouselImages.length) % carouselImages.length);
  };

  const t = isFr
    ? {
      buy: 'Ajouter au panier',
      wa: 'Commander WhatsApp',
      stock: 'En stock',
      out: 'Rupture de stock',
      back: 'Retour',
      zoom: 'Agrandir',
      highlights: 'Points clés',
      description: 'Description',
      shortDesc: 'Description courte',
      specs: 'Fiche technique',
      illustrated: 'Aperçu en images',
      faq: 'Questions fréquentes',
      delivery: 'Livraison & paiement',
      deliveryBody: 'Paiement à la livraison (COD). Expédition sous 24–72h selon la ville. Commandes gros via WhatsApp.',
      trustQuality: 'Produits vérifiés pour la revente',
      trustShip: 'Livraison Maroc rapide',
      trustCod: 'Paiement à la réception',
      notFound: 'Produit introuvable',
      loading: 'Chargement…',
      added: 'Ajouté',
      rate: 'Noter ce produit',
      related: 'Produits complémentaires',
    }
    : {
      buy: 'أضف إلى السلة',
      wa: 'اطلب عبر واتساب',
      stock: 'متوفر',
      out: 'نفد المخزون',
      back: 'عودة',
      zoom: 'تكبير',
      highlights: 'أبرز المميزات',
      description: 'الوصف',
      shortDesc: 'وصف قصير',
      specs: 'المواصفات',
      illustrated: 'نظرة سريعة بالصور',
      faq: 'أسئلة شائعة',
      delivery: 'التوصيل والدفع',
      deliveryBody: 'الدفع عند الاستلام. الشحن خلال 24–72 ساعة حسب المدينة. طلبات الجملة عبر واتساب.',
      trustQuality: 'منتجات مناسبة لإعادة البيع',
      trustShip: 'توصيل سريع داخل المغرب',
      trustCod: 'الدفع عند الاستلام',
      notFound: 'المنتج غير موجود',
      loading: 'جاري التحميل…',
      added: 'تمت الإضافة',
      rate: 'قيّم هذا المنتج',
      related: 'منتجات مكملة',
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

  const openCatalogSearch = () => {
    try {
      sessionStorage.setItem('focusHeaderSearch', '1');
    } catch {
      /* ignore */
    }
    window.location.assign(backHref);
  };

  const navBtnClass = dm
    ? 'bg-[#142038] border-white/10 text-gray-200 hover:bg-white/10'
    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm';

  return (
    <div
      className={`min-h-screen ${shell} pb-28 md:pb-16`}
      dir={isFr ? 'ltr' : 'rtl'}
    >
      <header className={`sticky top-0 z-40 pt-[env(safe-area-inset-top)] ${dm ? 'bg-gray-950' : 'bg-background-light'}`}>
        <div className="max-w-6xl mx-auto px-3 sm:px-4 pt-2.5 sm:pt-3 pb-2">
          <div
            className={`flex items-center gap-2 sm:gap-3 h-14 sm:h-[58px] px-2.5 sm:px-4 rounded-2xl border shadow-[0_4px_18px_rgba(15,23,42,0.07)]
              ${dm ? 'bg-[#142038] border-white/5 shadow-black/30' : 'bg-white border-slate-100'}`}
          >
            {/* Back */}
            <a
              href={backHref}
              className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors
                ${dm ? 'text-gray-300 hover:bg-white/10' : 'text-slate-600 hover:bg-slate-100'}`}
              aria-label={t.back}
              title={t.back}
            >
              <ArrowRight size={18} className={isFr ? 'rotate-180' : ''} />
            </a>

            {/* Brand */}
            <a href={backHref} className="flex items-center min-w-0 flex-1 gap-2.5">
              <img
                src={dm ? '/logo-dark.png' : '/logo.png'}
                alt={BRAND}
                className="h-8 sm:h-9 w-auto object-contain"
                style={{ maxWidth: '140px' }}
              />
              <span className={`hidden sm:inline text-[11px] font-semibold truncate ${muted}`}>
                {isFr ? 'Grossiste électronique' : 'إلكترونيات بالجملة'}
              </span>
            </a>

            {/* Actions */}
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={openCatalogSearch}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors
                  ${dm ? 'text-gray-300 hover:bg-white/10' : 'text-slate-600 hover:text-primary hover:bg-slate-100'}`}
                aria-label={isFr ? 'Rechercher' : 'بحث'}
                title={isFr ? 'Rechercher' : 'بحث'}
              >
                <Search size={18} />
              </button>

              <button
                type="button"
                onClick={() => {
                  const next = isFr ? 'ar' : 'fr';
                  localStorage.setItem('site_lang', next);
                  setLang(next);
                }}
                className={`inline-flex items-center gap-1.5 h-9 px-2.5 rounded-xl text-[11px] font-bold border transition-colors
                  ${dm
                    ? 'border-white/10 text-gray-200 hover:bg-white/10'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                aria-label={isFr ? 'العربية' : 'Français'}
              >
                <Globe2 size={14} />
                {isFr ? 'AR' : 'FR'}
              </button>

              <a
                href={backHref}
                className={`hidden sm:inline-flex w-10 h-10 rounded-xl items-center justify-center transition-colors
                  ${dm ? 'text-gray-300 hover:bg-white/10' : 'text-slate-600 hover:bg-slate-100'}`}
                aria-label={isFr ? 'Boutique' : 'المتجر'}
                title={isFr ? 'Boutique' : 'المتجر'}
              >
                <Home size={18} />
              </a>

              <button
                type="button"
                onClick={toggleWishlistSidebar}
                className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-colors
                  ${dm ? 'text-gray-300 hover:bg-white/10' : 'text-slate-600 hover:text-red-500 hover:bg-slate-100'}`}
                aria-label={isFr ? 'Favoris' : 'المفضلة'}
              >
                <Heart size={18} />
                {wishlistCount > 0 && (
                  <span className="absolute top-1 end-1 flex h-4 min-w-4 px-0.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                    {wishlistCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={toggleCart}
                className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-colors
                  ${dm ? 'text-gray-300 hover:bg-white/10' : 'text-slate-600 hover:text-primary hover:bg-slate-100'}`}
                aria-label={isFr ? 'Panier' : 'السلة'}
              >
                <ShoppingCart size={18} />
                {cartCount > 0 && (
                  <span className="absolute top-1 end-1 flex h-4 min-w-4 px-0.5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white">
                    {cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pt-4 md:pt-8">
        <div className="md:grid md:grid-cols-2 md:gap-10 md:items-start">
          {/* Gallery */}
          <section className="md:sticky md:top-20">
            <div className="flex items-center gap-1.5 sm:gap-2">
              {carouselImages.length > 1 && (
                <button
                  type="button"
                  aria-label={isFr ? 'Image précédente' : 'الصورة السابقة'}
                  className={`shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full border flex items-center justify-center transition-colors ${navBtnClass}`}
                  onClick={() => setActiveImg((i) => (i - 1 + carouselImages.length) % carouselImages.length)}
                >
                  <ChevronLeft size={18} />
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (!carouselImages.length) return;
                  setZoomImages(carouselImages);
                  setZoomIndex(activeImg);
                  setZoomOpen(true);
                }}
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
                className={`relative flex-1 min-w-0 aspect-square overflow-hidden rounded-2xl ${panel} ${dm ? '' : 'ring-1 ring-slate-200/80 shadow-sm'}`}
                aria-label={t.zoom}
              >
                {carouselImages[activeImg] ? (
                  <img
                    key={carouselImages[activeImg]}
                    src={carouselImages[activeImg]}
                    alt={title}
                    className="w-full h-full object-contain"
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

                {carouselImages.length > 1 && (
                  <span
                    className={`absolute top-3 inset-inline-end-3 text-[11px] font-semibold px-2 py-0.5 rounded-md ${dm ? 'bg-black/50 text-white' : 'bg-white/90 text-slate-600'}`}
                  >
                    {activeImg + 1}/{carouselImages.length}
                  </span>
                )}
              </button>

              {carouselImages.length > 1 && (
                <button
                  type="button"
                  aria-label={isFr ? 'Image suivante' : 'الصورة التالية'}
                  className={`shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full border flex items-center justify-center transition-colors ${navBtnClass}`}
                  onClick={() => setActiveImg((i) => (i + 1) % carouselImages.length)}
                >
                  <ChevronRight size={18} />
                </button>
              )}
            </div>

            {carouselImages.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {carouselImages.map((src, i) => (
                  <button
                    key={src + i}
                    type="button"
                    onClick={() => setActiveImg(i)}
                    className={`shrink-0 w-16 h-16 overflow-hidden rounded-xl border-2 transition ${
                      activeImg === i
                        ? 'border-primary'
                        : `${line} opacity-70 hover:opacity-100`
                    } ${panel}`}
                  >
                    <img src={src} alt="" loading="lazy" className="w-full h-full object-contain" />
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Buy column */}
          <section className="mt-5 md:mt-0 space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {!available && (
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded ${dm ? 'bg-gray-700 text-gray-300' : 'bg-slate-200 text-slate-600'}`}
                  >
                    {t.out}
                  </span>
                )}
                {product.ref && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(product.ref);
                      setRefCopied(true);
                      setTimeout(() => setRefCopied(false), 1500);
                    }}
                    className={`inline-flex items-center gap-1.5 text-[11px] font-mono px-2 py-0.5 rounded-md border transition-colors
                      ${refCopied
                        ? 'border-emerald-300 text-emerald-600 bg-emerald-50'
                        : dm ? 'border-white/10 text-gray-400 hover:bg-white/10' : 'border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                    title={isFr ? 'Copier la référence' : 'نسخ المرجع'}
                    aria-label={isFr ? 'Copier la référence' : 'نسخ المرجع'}
                  >
                    {refCopied ? <Check size={12} /> : <Copy size={12} />}
                    {product.ref}
                  </button>
                )}
                <ProductRatingStars
                  product={product}
                  size={16}
                  emptyHint={null}
                  darkMode={dm}
                  className="!flex-row !items-center gap-1"
                />
              </div>
              <h1 className="text-xl sm:text-2xl md:text-[1.85rem] font-bold leading-snug">
                {title}
              </h1>
              {showHeroLine && (
                <p className={`mt-2 text-sm md:text-base leading-relaxed ${soft}`}>
                  {heroLine}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-3xl md:text-4xl font-extrabold text-primary leading-none">
                {product.price}
                <span className="text-base font-bold ms-1 opacity-80">DH</span>
              </p>
              <button
                type="button"
                onClick={handleAdd}
                disabled={!available}
                className="shrink-0 min-h-11 px-4 sm:px-5 bg-primary text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-45 hover:bg-primary-dark active:scale-[0.99] transition text-sm sm:text-base"
              >
                <ShoppingCart size={18} />
                {addedFlash ? t.added : t.buy}
              </button>
            </div>

            <div className="hidden md:flex">
              <a
                href={`https://wa.me/${WA_NUMBER}?text=${waText}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-h-12 bg-whatsapp text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:brightness-110"
              >
                <img src={WA_ICON} alt="" aria-hidden="true" className="w-6 h-6 drop-shadow-md" />
                {t.wa}
              </a>
            </div>

            {showHighlights && (
              <div className={`pt-1 border-t ${line}`}>
                <p className={`text-[11px] font-bold uppercase tracking-wide mb-2.5 ${muted}`}>
                  {t.highlights}
                </p>
                <ul className={`space-y-2.5 text-sm leading-relaxed list-disc ps-5 ${soft}`}>
                  {bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {[
                { icon: BadgeCheck, text: t.trustQuality },
                { icon: Truck, text: t.trustShip },
                { icon: ShieldCheck, text: t.trustCod },
              ].map((row) => {
                const TrustIcon = row.icon;
                return (
                  <div
                    key={row.text}
                    className={`flex items-start gap-2.5 rounded-xl px-3 py-2.5 border ${line} ${dm ? 'bg-gray-800/40' : 'bg-slate-50'}`}
                  >
                    <TrustIcon size={18} className="text-primary shrink-0 mt-0.5" />
                    <span className={`text-xs leading-snug font-medium ${soft}`}>{row.text}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Delivery */}
        <section className={`mt-8 pt-6 border-t ${line}`}>
          <h2 className="text-lg font-bold mb-2">{t.delivery}</h2>
          <p className={`text-sm leading-relaxed max-w-2xl ${soft}`}>{t.deliveryBody}</p>
        </section>

        {/* FAQ */}
        {faq.length > 0 && (
          <section className={`mt-8 pt-6 border-t ${line}`}>
            <h2 className="text-lg font-bold mb-4">{t.faq}</h2>
            <div className="space-y-2 max-w-2xl">
              {faq.map((item, idx) => {
                const open = openFaq === idx;
                return (
                  <div
                    key={`${item.q}-${idx}`}
                    className={`rounded-xl border ${line} overflow-hidden ${dm ? 'bg-gray-800/30' : 'bg-white'}`}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(open ? -1 : idx)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 text-start"
                    >
                      <span className="text-sm font-semibold">{item.q}</span>
                      <ChevronDown
                        size={16}
                        className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''} ${muted}`}
                      />
                    </button>
                    {open && (
                      <p className={`px-4 pb-3 text-sm leading-relaxed ${soft}`}>{item.a}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Specs table — info images live in the A+ description below */}
        {specRows.length > 0 && (
          <section className={`mt-10 pt-8 border-t ${line}`}>
            <h2 className="text-lg font-bold mb-3">{t.specs}</h2>
            <dl className={`rounded-2xl border overflow-hidden max-w-xl ${line} ${panel}`}>
              {specRows.map((row) => (
                <div
                  key={row.label}
                  className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm border-b last:border-b-0 ${line}`}
                >
                  <dt className={`font-semibold shrink-0 ${muted}`}>{row.label}</dt>
                  <dd className={`font-medium text-end ${soft}`}>{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {/* Related strip */}
        <div className={`mt-10 pt-8 border-t ${line}`}>
          <RelatedProducts
            product={product}
            lang={lang}
            limit={8}
            onSelect={(item) => {
              const ref = encodeURIComponent(item.ref || item.id);
              window.location.assign(`/p/${ref}`);
            }}
          />
        </div>

        {/* Amazon-style A+ description — text + info images only (no hero gallery repeats) */}
        {showAplusSection && (
          <section className={`mt-10 pt-8 border-t ${line} space-y-6`}>
            <h2 className="text-lg font-bold">{t.description}</h2>

            {showFullDescription && (
              <div
                className={`product-desc amazon-aplus prose prose-sm md:prose-base max-w-none leading-relaxed
                  [&_p]:mb-4 [&_ul]:mb-4 [&_li]:mb-1
                  [&_figure]:my-6 [&_figure]:mx-0
                  [&_img]:w-full [&_img]:h-auto [&_img]:rounded-2xl [&_img]:border [&_img]:object-contain
                  ${dm
                    ? 'prose-invert [&_img]:border-gray-700 [&_img]:bg-gray-900/40 [&_figcaption]:text-gray-400'
                    : '[&_img]:border-slate-200 [&_img]:bg-white [&_figcaption]:text-slate-500'}
                  ${soft}`}
                dangerouslySetInnerHTML={{ __html: descriptionForAplus }}
              />
            )}

            {extraContentImages.map((src) => (
              <figure key={src} className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    const idx = images.indexOf(src);
                    setZoomImages(images);
                    setZoomIndex(idx >= 0 ? idx : 0);
                    setZoomOpen(true);
                  }}
                  className={`block w-full overflow-hidden rounded-2xl border ${line} ${panel}`}
                >
                  <img
                    src={src}
                    alt={t.illustrated}
                    className="w-full h-auto object-contain"
                    loading="lazy"
                  />
                </button>
              </figure>
            ))}
          </section>
        )}
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
            className="shrink-0 w-11 h-11 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center"
            aria-label={t.wa}
          >
            <img src={WA_ICON} alt="WhatsApp" className="w-8 h-8 drop-shadow-md" />
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
        images={zoomImages.length ? zoomImages : carouselImages}
        image={zoomImages[zoomIndex] || carouselImages[activeImg] || specsImage}
        initialIndex={zoomIndex}
        alt={title}
        productRef={product.ref}
      />

      <CartSidebar />
      <WishlistSidebar />
      <AuthModal />
      <div className="hidden md:block">
        <BottomNavBar />
      </div>

      <style>{`
        .product-desc img {
          max-width: 100%;
          height: auto;
          border-radius: 1rem;
          margin: 1rem 0;
        }
        .product-desc figure {
          margin: 1.25rem 0;
        }
        .product-desc figcaption {
          font-size: 0.75rem;
          opacity: 0.65;
          margin-top: 0.35rem;
        }
        .product-desc ul {
          list-style: disc;
          padding-inline-start: 1.25rem;
          margin: 0.75rem 0;
        }
        .product-desc p {
          margin: 0.65rem 0;
        }
      `}</style>
    </div>
  );
};

export default ProductLandingPage;
