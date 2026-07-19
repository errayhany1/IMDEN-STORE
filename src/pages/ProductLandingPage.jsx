import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ShoppingCart, MessageCircle } from 'lucide-react';
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

const WA_NUMBER = '212664630566';

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

const ProductLandingPage = ({ sku: skuProp }) => {
  const darkMode = useStore((s) => s.darkMode);
  const addToCart = useStore((s) => s.addToCart);
  const storeProducts = useStore((s) => s.products);
  const setProducts = useStore((s) => s.setProducts);
  const appendProducts = useStore((s) => s.appendProducts);

  const [lang, setLang] = useState(getLang);
  const [activeImg, setActiveImg] = useState(0);
  const [loading, setLoading] = useState(true);
  const [directProduct, setDirectProduct] = useState(null);
  const [loadError, setLoadError] = useState('');

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

  // Load full catalog without cancelling when the static cache arrives,
  // then fall back to a direct SKU lookup for brand-new products.
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

      // Re-read store after catalog fetch — new uploads may only exist live
      const latest = useStore.getState().products || [];
      const found = latest.find((p) => skusMatch(p.ref, sku))
        || latest.find((p) => skusMatch(p.id, sku));

      if (!found) {
        try {
          const single = await fetchProductBySku(sku);
          if (!cancelled && single) {
            setDirectProduct(single);
            // Also merge into the store so cart/wishlist share the same object shape
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
  const description = isFr
    ? (od.description_french || od.short_description_fr || '')
    : (od.description_arabic || od.short_description_ar || '');

  const images = useMemo(() => {
    const list = (product?.images?.length
      ? product.images
      : [product?.image, product?.originalImage].filter(Boolean));
    return Array.from(new Set((list || []).filter(Boolean)));
  }, [product]);

  const dm = darkMode;

  const backHref = (() => {
    try {
      return sessionStorage.getItem('lastBrowseMode') === 'catalog' ? '/catalog' : '/';
    } catch {
      return '/';
    }
  })();

  if (loading && !product) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${dm ? 'bg-gray-950 text-white' : 'bg-slate-50 text-slate-700'}`}>
        جاري التحميل...
      </div>
    );
  }

  if (!product) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center gap-4 p-6 ${dm ? 'bg-gray-950 text-white' : 'bg-slate-50 text-slate-800'}`}>
        <p className="font-bold text-lg">المنتج غير موجود</p>
        <p className="text-sm opacity-70">{sku}</p>
        {loadError && <p className="text-xs text-red-500">{loadError}</p>}
        <a href={backHref} className="text-primary font-bold flex items-center gap-2">
          <ArrowRight size={16} /> العودة
        </a>
      </div>
    );
  }

  const waText = encodeURIComponent(
    `السلام عليكم، أريد الاستفسار عن:\n${title}\nSKU: ${product.ref}\nالثمن: ${product.price} DH\n${window.location.href}`
  );

  return (
    <div className={`min-h-screen pb-24 md:pb-6 ${dm ? 'bg-gray-950 text-gray-100' : 'bg-slate-50 text-slate-900'}`} dir={isFr ? 'ltr' : 'rtl'}>
      <header className={`sticky top-0 z-20 border-b backdrop-blur ${dm ? 'bg-gray-950/90 border-gray-800' : 'bg-white/90 border-slate-200'}`}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <a href={backHref} className="font-bold text-primary flex items-center gap-2">
            <ArrowRight size={18} className={isFr ? 'rotate-180' : ''} />
            Errayhany Store
          </a>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const next = isFr ? 'ar' : 'fr';
                localStorage.setItem('site_lang', next);
                setLang(next);
              }}
              className={`text-xs font-bold px-3 py-1.5 rounded-full border ${dm ? 'border-gray-700' : 'border-slate-200'}`}
            >
              {isFr ? 'العربية' : 'FR'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 grid md:grid-cols-2 gap-8">
        <section>
          <div className={`rounded-2xl overflow-hidden border aspect-square flex items-center justify-center ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'}`}>
            {images[activeImg] ? (
              <img
                src={images[activeImg]}
                alt={title}
                className="w-full h-full object-contain p-4"
                onError={(e) => {
                  if (product.originalImage && e.currentTarget.src !== product.originalImage) {
                    e.currentTarget.src = product.originalImage;
                  }
                }}
              />
            ) : (
              <span className="opacity-50">لا توجد صورة</span>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto">
              {images.map((src, i) => (
                <button
                  key={src + i}
                  type="button"
                  onClick={() => setActiveImg(i)}
                  className={`shrink-0 w-16 h-16 rounded-lg border overflow-hidden ${activeImg === i ? 'border-primary ring-2 ring-primary/30' : dm ? 'border-gray-700' : 'border-slate-200'}`}
                >
                  <img src={src} alt="" className="w-full h-full object-contain bg-white" />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <div>
            <p className={`text-xs font-mono mb-1 ${dm ? 'text-gray-500' : 'text-slate-400'}`}>{product.ref}</p>
            <h1 className="text-2xl md:text-3xl font-extrabold leading-snug">{title}</h1>
            <p className="mt-3 text-3xl font-black text-primary">{product.price} <span className="text-base font-bold">DH</span></p>
          </div>

          {description && (
            <div
              className={`prose prose-sm max-w-none rounded-xl p-4 border ${dm ? 'bg-gray-900 border-gray-800 prose-invert' : 'bg-white border-slate-200'}`}
              dangerouslySetInnerHTML={{ __html: description }}
            />
          )}

          <div className="flex flex-col sm:flex-row gap-3 mt-2">
            <button
              type="button"
              onClick={() => addToCart(product)}
              disabled={product.isAvailable === false}
              className="flex-1 bg-primary text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <ShoppingCart size={18} />
              {isFr ? 'Ajouter au panier' : 'أضف إلى السلة'}
            </button>
            <a
              href={`https://wa.me/${WA_NUMBER}?text=${waText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-green-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"
            >
              <MessageCircle size={18} />
              WhatsApp
            </a>
          </div>
        </section>
      </main>

      <CartSidebar />
      <WishlistSidebar />
      <AuthModal />
      <BottomNavBar />
    </div>
  );
};

export default ProductLandingPage;
