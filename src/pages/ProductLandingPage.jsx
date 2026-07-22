import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ShoppingCart,
  MessageCircle,
  Truck,
  Banknote,
  ShieldCheck,
  Star,
  Zap,
  Package,
  Headphones,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
} from 'lucide-react';
import { motion } from 'framer-motion';
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

const WA_NUMBER = '212664630566';
const SITE_URL = 'https://errayhany.com';
const BRAND = 'Errayhany';

const ACCENTS = {
  Chargers: '#0F6B8F',
  Audio: '#1A5F7A',
  'Smart Watches': '#0D7377',
  Gaming: '#2D4A6F',
  'Mouse & Keyboard': '#1E5A7A',
  Storage: '#245B6B',
  'Laptop Chargers': '#0F6B8F',
  Stands: '#3D5A5B',
  Lighting: '#B8860B',
  Cameras: '#4A5568',
  Network: '#2C5282',
  Microphones: '#553C9A',
  'Batteries & Power Banks': '#276749',
  Cables: '#2B6CB0',
  'Car Accessories': '#2C7A7B',
  'Adapters & Hubs': '#3182CE',
  'TV Boxes': '#6B46C1',
  Cooling: '#2B6CB0',
  Phones: '#2C7A7B',
  General: '#1A6BB5',
  'Out of Stock': '#718096',
};

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

function stripHtml(html) {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || '').trim();
}

function extractListItems(html) {
  if (!html) return [];
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const items = [...tmp.querySelectorAll('li')].map((li) => li.textContent.trim()).filter(Boolean);
  if (items.length) return items.slice(0, 8);
  const plain = stripHtml(html);
  return plain
    .split(/[\n•●\-–]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12)
    .slice(0, 6);
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

const fadeUp = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-40px' },
  transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
};

const ProductLandingPage = ({ sku: skuProp }) => {
  const addToCart = useStore((s) => s.addToCart);
  const storeProducts = useStore((s) => s.products);
  const setProducts = useStore((s) => s.setProducts);
  const appendProducts = useStore((s) => s.appendProducts);
  const toggleCart = useStore((s) => s.toggleCart);

  const [lang, setLang] = useState(getLang);
  const [activeImg, setActiveImg] = useState(0);
  const [loading, setLoading] = useState(true);
  const [directProduct, setDirectProduct] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [zoomOpen, setZoomOpen] = useState(false);
  const [addedFlash, setAddedFlash] = useState(false);
  const touchX = useRef(null);
  const galleryRef = useRef(null);

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
  const shortHtml = isFr
    ? (od.short_description_fr || od.description_french || '')
    : (od.short_description_ar || od.description_arabic || '');
  const longHtml = isFr
    ? (od.description_french || od.short_description_fr || '')
    : (od.description_arabic || od.short_description_ar || '');
  const plainDesc = stripHtml(shortHtml || longHtml);
  const bulletPoints = useMemo(() => extractListItems(shortHtml || longHtml), [shortHtml, longHtml]);

  const images = useMemo(() => {
    const list = (product?.images?.length
      ? product.images
      : [product?.image, product?.originalImage].filter(Boolean));
    return Array.from(new Set((list || []).filter(Boolean)));
  }, [product]);

  const accent = ACCENTS[product?.category] || ACCENTS.General;
  const available = product?.isAvailable !== false;

  const backHref = (() => {
    try {
      return sessionStorage.getItem('lastBrowseMode') === 'catalog' ? '/catalog' : '/';
    } catch {
      return '/';
    }
  })();

  // SEO
  useEffect(() => {
    if (!product) return undefined;
    const metaTitle = `${title} | ${BRAND} Grossiste`;
    const metaDesc = (plainDesc || `${title} — ${product.price} DH · جملة بالمغرب · توصيل COD`).slice(0, 160);
    document.title = metaTitle;
    setMetaTag('name', 'description', metaDesc);
    setMetaTag('property', 'og:title', metaTitle);
    setMetaTag('property', 'og:description', metaDesc);
    setMetaTag('property', 'og:type', 'product');
    if (images[0]) setMetaTag('property', 'og:image', images[0].startsWith('http') ? images[0] : `${SITE_URL}${images[0]}`);

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

  // Landing fonts (page-scoped)
  useEffect(() => {
    const id = 'lp-fonts';
    if (document.getElementById(id)) return undefined;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;700&family=Manrope:wght@400;500;600;700;800&family=Tajawal:wght@400;500;700;800&display=swap';
    document.head.appendChild(link);
    return undefined;
  }, []);

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

  const copy = isFr
    ? {
      buy: 'Ajouter au panier',
      buyNow: 'Commander maintenant',
      wa: 'WhatsApp',
      cod: 'Paiement à la livraison',
      delivery: 'Livraison partout au Maroc',
      trust: 'Grossiste de confiance',
      gallery: 'Galerie',
      benefits: 'Avantages clés',
      features: 'Caractéristiques',
      specs: 'Spécifications',
      why: 'Pourquoi ce produit ?',
      faq: 'Questions fréquentes',
      customers: 'La confiance de nos clients',
      final: 'Prêt à commander ?',
      finalSub: 'Ajoutez au panier ou contactez-nous sur WhatsApp.',
      stock: 'En stock',
      out: 'Rupture de stock',
      back: 'Retour',
      zoom: 'Agrandir',
      sku: 'Réf',
      price: 'Prix grossiste',
      notFound: 'Produit introuvable',
      loading: 'Chargement…',
      added: 'Ajouté au panier',
      warranty: 'Qualité vérifiée',
      support: 'Support WhatsApp',
      wholesale: 'Tarif grossiste',
    }
    : {
      buy: 'أضف إلى السلة',
      buyNow: 'اطلب الآن',
      wa: 'واتساب',
      cod: 'الدفع عند الاستلام',
      delivery: 'توصيل لجميع المدن',
      trust: 'جملة موثوقة',
      gallery: 'معرض الصور',
      benefits: 'أبرز المزايا',
      features: 'المواصفات العملية',
      specs: 'البيانات التقنية',
      why: 'لماذا هذا المنتج؟',
      faq: 'أسئلة شائعة',
      customers: 'ثقة التجار معنا',
      final: 'جاهز للطلب؟',
      finalSub: 'أضِف للسلة أو راسلنا على واتساب لإتمام الطلب.',
      stock: 'متوفر الآن',
      out: 'نفد المخزون',
      back: 'عودة',
      zoom: 'تكبير',
      sku: 'المرجع',
      price: 'سعر الجملة',
      notFound: 'المنتج غير موجود',
      loading: 'جاري التحميل…',
      added: 'تمت الإضافة للسلة',
      warranty: 'جودة مفحوصة',
      support: 'دعم واتساب',
      wholesale: 'سعر جملة',
    };

  const defaultBenefits = isFr
    ? [
      { icon: Truck, title: copy.delivery, text: 'Expédition rapide vers toutes les villes.' },
      { icon: Banknote, title: copy.cod, text: 'Payez à la réception — sans risque.' },
      { icon: ShieldCheck, title: copy.warranty, text: 'Produits contrôlés avant expédition.' },
      { icon: Headphones, title: copy.support, text: 'Assistance directe via WhatsApp.' },
    ]
    : [
      { icon: Truck, title: copy.delivery, text: 'شحن سريع إلى كل المدن المغربية.' },
      { icon: Banknote, title: copy.cod, text: 'ادفع عند الاستلام بدون مخاطرة.' },
      { icon: ShieldCheck, title: copy.warranty, text: 'منتجات تُفحص قبل الشحن.' },
      { icon: Headphones, title: copy.support, text: 'متابعة مباشرة عبر واتساب.' },
    ];

  const featureItems = (bulletPoints.length
    ? bulletPoints
    : (isFr
      ? ['Qualité premium pour la revente', 'Idéal pour le stock grossiste', 'Design soigné et emballage soigné', 'Excellent rapport qualité-prix']
      : ['جودة مناسبة لإعادة البيع', 'مثالي لمخزون الجملة', 'تصميم وتغليف مرتبان', 'قيمة ممتازة مقابل الثمن'])
  ).map((text, i) => ({
    icon: [Zap, Package, Star, CheckCircle2][i % 4],
    text,
  }));

  const faqs = isFr
    ? [
      { q: 'Le paiement à la livraison est-il disponible ?', a: 'Oui. Vous pouvez payer cash à la réception dans la plupart des villes du Maroc.' },
      { q: 'Puis-je commander en gros ?', a: `Oui. ${BRAND} est orienté grossiste — contactez-nous sur WhatsApp pour des quantités.` },
      { q: 'Combien de temps pour la livraison ?', a: 'Généralement 24–72h selon la ville, après confirmation de la commande.' },
    ]
    : [
      { q: 'هل يمكن الدفع عند الاستلام؟', a: 'نعم. الدفع نقداً عند الاستلام متاح في معظم المدن المغربية.' },
      { q: 'هل الطلب بالجملة متاح؟', a: `نعم. ${BRAND} متخصص في الجملة — راسلنا على واتساب للكميات.` },
      { q: 'كم مدة التوصيل؟', a: 'عادةً بين 24 و72 ساعة حسب المدينة بعد تأكيد الطلب.' },
    ];

  const fontBody = isFr
    ? "'Manrope', system-ui, sans-serif"
    : "'Tajawal', 'Manrope', sans-serif";
  const fontDisplay = isFr
    ? "'Fraunces', Georgia, serif"
    : "'Tajawal', 'Fraunces', serif";

  if (loading && !product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA] text-slate-600" style={{ fontFamily: fontBody }}>
        {copy.loading}
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-[#F5F7FA] text-slate-800" style={{ fontFamily: fontBody }} dir={isFr ? 'ltr' : 'rtl'}>
        <p className="text-xl font-bold" style={{ fontFamily: fontDisplay }}>{copy.notFound}</p>
        <p className="text-sm opacity-60">{sku}</p>
        {loadError && <p className="text-xs text-red-500">{loadError}</p>}
        <a href={backHref} className="font-bold flex items-center gap-2" style={{ color: accent }}>
          <ArrowRight size={16} className={isFr ? 'rotate-180' : ''} /> {copy.back}
        </a>
      </div>
    );
  }

  const sellLine = plainDesc
    ? plainDesc.slice(0, 140) + (plainDesc.length > 140 ? '…' : '')
    : (isFr
      ? `Produit grossiste sélectionné par ${BRAND} — qualité, prix et livraison.`
      : `منتج جملة مختار من ${BRAND} — جودة، سعر، وتوصيل.`);

  return (
    <div
      className="min-h-screen bg-[#F5F7FA] text-slate-900 pb-28 md:pb-10"
      dir={isFr ? 'ltr' : 'rtl'}
      style={{ fontFamily: fontBody, ['--lp-accent']: accent }}
    >
      {/* Top bar — brand first */}
      <header className="sticky top-0 z-30 bg-[#F5F7FA]/90 backdrop-blur-md border-b border-slate-200/70">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <a href={backHref} className="flex items-center gap-2 min-w-0">
            <ArrowRight size={18} className={`shrink-0 opacity-60 ${isFr ? 'rotate-180' : ''}`} />
            <span
              className="text-xl md:text-2xl font-bold tracking-tight truncate"
              style={{ fontFamily: fontDisplay, color: accent }}
            >
              {BRAND}
            </span>
          </a>
          <button
            type="button"
            onClick={() => {
              const next = isFr ? 'ar' : 'fr';
              localStorage.setItem('site_lang', next);
              setLang(next);
            }}
            className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
          >
            {isFr ? 'العربية' : 'FR'}
          </button>
        </div>
      </header>

      {/* HERO — one composition: brand already in header; product image dominates */}
      <section className="relative">
        <div
          className="relative w-full bg-gradient-to-b from-slate-200/40 via-[#EEF2F6] to-[#F5F7FA]"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div className="max-w-6xl mx-auto px-0 md:px-4">
            <button
              type="button"
              onClick={() => images.length && setZoomOpen(true)}
              className="relative block w-full aspect-[4/5] sm:aspect-[16/11] md:aspect-[21/10] overflow-hidden md:rounded-2xl bg-white"
              aria-label={copy.zoom}
            >
              {images[activeImg] ? (
                <motion.img
                  key={images[activeImg]}
                  initial={{ opacity: 0.6, scale: 1.02 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.35 }}
                  src={images[activeImg]}
                  alt={title}
                  className="w-full h-full object-contain p-4 md:p-8"
                  loading="eager"
                  decoding="async"
                  onError={(e) => {
                    if (product.originalImage && e.currentTarget.src !== product.originalImage) {
                      e.currentTarget.src = product.originalImage;
                    }
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400">—</div>
              )}
              <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#F5F7FA] to-transparent pointer-events-none md:hidden" />
            </button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 -mt-6 md:-mt-10 relative z-10">
          <motion.div {...fadeUp} className="max-w-xl">
            <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-slate-500 mb-2">
              {BRAND} · {copy.wholesale}
            </p>
            <h1
              className="text-[1.75rem] sm:text-4xl md:text-[2.75rem] font-bold leading-[1.15] text-slate-900"
              style={{ fontFamily: fontDisplay }}
            >
              {title}
            </h1>
            <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">{sellLine}</p>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <p className="text-3xl sm:text-4xl font-extrabold" style={{ color: accent }}>
                {product.price}
                <span className="text-base font-bold ms-1 opacity-80">DH</span>
              </p>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${available ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                {available ? copy.stock : copy.out}
              </span>
            </div>

            <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
              <span className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
                <Truck size={14} style={{ color: accent }} /> {copy.delivery}
              </span>
              <span className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
                <Banknote size={14} style={{ color: accent }} /> {copy.cod}
              </span>
              <span className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
                <ShieldCheck size={14} style={{ color: accent }} /> {copy.trust}
              </span>
            </div>

            <div className="mt-6 hidden md:flex flex-row gap-3">
              <button
                type="button"
                onClick={handleAdd}
                disabled={!available}
                className="flex-1 min-h-12 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-45 shadow-sm transition hover:brightness-110 active:scale-[0.99]"
                style={{ background: accent }}
              >
                <ShoppingCart size={18} />
                {addedFlash ? copy.added : copy.buy}
              </button>
              <a
                href={`https://wa.me/${WA_NUMBER}?text=${waText}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-h-12 bg-[#128C7E] text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm hover:brightness-110"
              >
                <MessageCircle size={18} />
                {copy.wa}
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Gallery thumbs */}
      {images.length > 1 && (
        <section className="max-w-6xl mx-auto px-4 mt-8" aria-label={copy.gallery}>
          <div ref={galleryRef} className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
            {images.map((src, i) => (
              <button
                key={src + i}
                type="button"
                onClick={() => setActiveImg(i)}
                className={`shrink-0 w-[4.5rem] h-[4.5rem] rounded-xl overflow-hidden border-2 bg-white transition ${
                  activeImg === i ? 'border-[color:var(--lp-accent)]' : 'border-transparent opacity-75 hover:opacity-100'
                }`}
              >
                <img src={src} alt="" loading="lazy" className="w-full h-full object-contain p-1" />
              </button>
            ))}
          </div>
          <div className="flex items-center justify-center gap-3 mt-3 md:hidden">
            <button type="button" aria-label="prev" className="p-2 rounded-full bg-white border border-slate-200" onClick={() => setActiveImg((i) => (i - 1 + images.length) % images.length)}>
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs text-slate-500 font-medium">{activeImg + 1} / {images.length}</span>
            <button type="button" aria-label="next" className="p-2 rounded-full bg-white border border-slate-200" onClick={() => setActiveImg((i) => (i + 1) % images.length)}>
              <ChevronRight size={16} />
            </button>
          </div>
        </section>
      )}

      {/* Benefits */}
      <section className="max-w-6xl mx-auto px-4 mt-12 md:mt-16">
        <motion.h2 {...fadeUp} className="text-2xl md:text-3xl font-bold mb-6" style={{ fontFamily: fontDisplay }}>
          {copy.benefits}
        </motion.h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          {defaultBenefits.map((b, idx) => (
            <motion.div
              key={b.title}
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: idx * 0.05 }}
              className="flex gap-3 p-4 rounded-2xl bg-white border border-slate-200/80"
            >
              <div className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${accent}14`, color: accent }}>
                <b.icon size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm md:text-base">{b.title}</h3>
                <p className="text-xs md:text-sm text-slate-600 mt-1 leading-relaxed">{b.text}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 mt-12 md:mt-16">
        <motion.h2 {...fadeUp} className="text-2xl md:text-3xl font-bold mb-2" style={{ fontFamily: fontDisplay }}>
          {copy.features}
        </motion.h2>
        <motion.p {...fadeUp} className="text-sm text-slate-600 mb-6 max-w-2xl">
          {isFr ? 'Ce qui compte pour votre stock et vos clients.' : 'ما يهم لمخزونك ولزبنائك.'}
        </motion.p>
        <ul className="space-y-3">
          {featureItems.map((f, idx) => (
            <motion.li
              key={f.text + idx}
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: idx * 0.04 }}
              className="flex items-start gap-3 bg-white/80 border border-slate-200/70 rounded-xl px-4 py-3"
            >
              <f.icon size={18} className="mt-0.5 shrink-0" style={{ color: accent }} />
              <span className="text-sm md:text-[15px] leading-relaxed text-slate-700">{f.text}</span>
            </motion.li>
          ))}
        </ul>
        {longHtml && longHtml !== shortHtml && (
          <motion.div
            {...fadeUp}
            className="mt-6 prose prose-sm max-w-none text-slate-700 bg-white rounded-2xl border border-slate-200/80 p-5"
            dangerouslySetInnerHTML={{ __html: longHtml }}
          />
        )}
      </section>

      {/* Specs */}
      <section className="max-w-6xl mx-auto px-4 mt-12 md:mt-16">
        <motion.h2 {...fadeUp} className="text-2xl md:text-3xl font-bold mb-6" style={{ fontFamily: fontDisplay }}>
          {copy.specs}
        </motion.h2>
        <motion.div {...fadeUp} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <tbody>
              {[
                [copy.sku, product.ref || '—'],
                [isFr ? 'Catégorie' : 'التصنيف', product.category || '—'],
                [copy.price, `${product.price} DH`],
                [isFr ? 'Disponibilité' : 'التوفر', available ? copy.stock : copy.out],
              ].map(([k, v], i) => (
                <tr key={k} className={i % 2 === 0 ? 'bg-slate-50/80' : 'bg-white'}>
                  <th className="text-start font-semibold text-slate-500 px-4 py-3.5 w-[42%]">{k}</th>
                  <td className="px-4 py-3.5 font-medium text-slate-800">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </section>

      {/* Why */}
      <section className="max-w-6xl mx-auto px-4 mt-12 md:mt-16">
        <motion.h2 {...fadeUp} className="text-2xl md:text-3xl font-bold mb-4" style={{ fontFamily: fontDisplay }}>
          {copy.why}
        </motion.h2>
        <motion.p {...fadeUp} className="text-sm md:text-base text-slate-600 leading-relaxed max-w-2xl">
          {isFr
            ? `${BRAND} sélectionne des références revendables rapidement : prix grossiste clair, photos réelles, et accompagnement WhatsApp pour vos commandes.`
            : `${BRAND} يختار مراجع قابلة لإعادة البيع بسرعة: سعر جملة واضح، صور حقيقية، ومتابعة واتساب لطلباتك.`}
        </motion.p>
      </section>

      {/* FAQ */}
      <section className="max-w-6xl mx-auto px-4 mt-12 md:mt-16">
        <motion.h2 {...fadeUp} className="text-2xl md:text-3xl font-bold mb-6" style={{ fontFamily: fontDisplay }}>
          {copy.faq}
        </motion.h2>
        <div className="space-y-3">
          {faqs.map((item) => (
            <motion.details
              key={item.q}
              {...fadeUp}
              className="group bg-white border border-slate-200 rounded-xl px-4 py-3 open:shadow-sm"
            >
              <summary className="cursor-pointer list-none flex items-center gap-2 font-bold text-sm md:text-base">
                <HelpCircle size={16} style={{ color: accent }} className="shrink-0" />
                {item.q}
              </summary>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed ps-6">{item.a}</p>
            </motion.details>
          ))}
        </div>
      </section>

      {/* Trust */}
      <section className="max-w-6xl mx-auto px-4 mt-12 md:mt-16">
        <motion.h2 {...fadeUp} className="text-2xl md:text-3xl font-bold mb-6" style={{ fontFamily: fontDisplay }}>
          {copy.customers}
        </motion.h2>
        <motion.div {...fadeUp} className="grid grid-cols-3 gap-3 text-center">
          {[
            { n: '10k+', l: isFr ? 'Commandes' : 'طلب' },
            { n: 'COD', l: isFr ? 'Paiement sûr' : 'دفع آمن' },
            { n: '24/7', l: isFr ? 'WhatsApp' : 'واتساب' },
          ].map((s) => (
            <div key={s.l} className="rounded-2xl bg-white border border-slate-200 py-5 px-2">
              <p className="text-xl md:text-2xl font-extrabold" style={{ color: accent, fontFamily: fontDisplay }}>{s.n}</p>
              <p className="text-[11px] md:text-xs text-slate-500 mt-1 font-medium">{s.l}</p>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Final CTA */}
      <section className="max-w-6xl mx-auto px-4 mt-12 md:mt-16 mb-8">
        <motion.div
          {...fadeUp}
          className="rounded-3xl px-6 py-8 md:px-10 md:py-10 text-white relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${accent} 0%, #0f172a 100%)` }}
        >
          <p className="text-xs font-semibold tracking-wider uppercase opacity-80 mb-2">{BRAND}</p>
          <h2 className="text-2xl md:text-3xl font-bold" style={{ fontFamily: fontDisplay }}>{copy.final}</h2>
          <p className="mt-2 text-sm md:text-base opacity-90 max-w-lg">{copy.finalSub}</p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleAdd}
              disabled={!available}
              className="min-h-12 px-6 rounded-xl bg-white font-bold text-slate-900 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <ShoppingCart size={18} />
              {copy.buyNow}
            </button>
            <a
              href={`https://wa.me/${WA_NUMBER}?text=${waText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-12 px-6 rounded-xl bg-white/15 border border-white/30 font-bold flex items-center justify-center gap-2 hover:bg-white/25"
            >
              <MessageCircle size={18} />
              {copy.wa}
            </a>
          </div>
        </motion.div>
      </section>

      {/* Sticky mobile buy bar */}
      <div className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md px-3 pt-2.5 pb-[max(0.65rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-slate-500 truncate">{title}</p>
            <p className="text-lg font-extrabold leading-tight" style={{ color: accent }}>{product.price} DH</p>
          </div>
          <a
            href={`https://wa.me/${WA_NUMBER}?text=${waText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 w-11 h-11 rounded-xl bg-[#128C7E] text-white flex items-center justify-center"
            aria-label={copy.wa}
          >
            <MessageCircle size={20} />
          </a>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!available}
            className="shrink-0 min-h-11 px-4 rounded-xl text-white font-bold text-sm flex items-center gap-1.5 disabled:opacity-45"
            style={{ background: accent }}
          >
            <ShoppingCart size={16} />
            {addedFlash ? copy.added : copy.buy}
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
