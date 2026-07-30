import React, { useEffect, useState } from 'react';
import Header from './components/Header';
import CategoryRail from './components/CategoryRail';
import FamilyHeroSlider from './components/FamilyHeroSlider';
import BottomNavBar from './components/BottomNavBar';
import ProductGrid from './components/ProductGrid';
import { getFamilyById } from './data/families';
import CartSidebar from './components/CartSidebar';
import WishlistSidebar from './components/WishlistSidebar';
import FloatingWhatsApp from './components/FloatingWhatsApp';
import FeaturedStrip from './components/FeaturedStrip';
import NotificationPrompt from './components/NotificationPrompt';
import AuthModal from './components/AuthModal';
import AboutModal from './components/AboutModal';
import AdminDashboard from './pages/AdminDashboard';
import OrderTracking from './pages/OrderTracking';
import AccountPage from './pages/AccountPage';
import CategoriesPage from './pages/CategoriesPage';
import ProductLandingPage from './pages/ProductLandingPage';
import PurchaseCountPage from './pages/PurchaseCountPage';
import IOSInstallPrompt from './components/IOSInstallPrompt';
import InstallAppBanner from './components/InstallAppBanner';
import useStore from './store/useStore';
import { auth } from './services/firebase';
import { syncCustomerAccount } from './services/customerAccount';
import {
  loadCloudAccount,
  mergeAccountState,
  saveCloudAccount,
} from './services/cloudAccount';
import { upsertOffersLead } from './services/offersLead';
import { initNativeShell } from './services/nativeShell';
import { onAuthStateChanged, getRedirectResult } from 'firebase/auth';
import { User, X, ChevronUp, Loader2 } from 'lucide-react';

function App() {
  const {
    darkMode,
    setUser,
    user,
    setAuthModalOpen,
    products,
    restockSubscriptions,
    removeRestockSubscription,
    setSearchQuery,
    setCustomerInfo,
    setAccountState,
    clearAccountState,
    setFamily,
    clearFamily,
    setBrowseMode,
    browseMode,
  } = useStore();
  const [showLoginToast, setShowLoginToast] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showCatalogToast, setShowCatalogToast] = useState(false);
  // AuthModal sets this flag right before signInWithRedirect. Show a
  // full-screen overlay until Google sends the user back so the site
  // doesn't flash as "logged out" while the redirect is still resolving.
  const [completingRedirect, setCompletingRedirect] = useState(
    () => sessionStorage.getItem('pendingAuthRedirect') === '1'
  );

  useEffect(() => {
    initNativeShell().catch(error => {
      console.warn('Native shell init failed:', error);
    });
  }, []);

  // Brief tip when entering catalog mode — auto-hides so it never stays on screen.
  useEffect(() => {
    if (browseMode !== 'catalog') {
      setShowCatalogToast(false);
      return undefined;
    }
    setShowCatalogToast(true);
    const timer = setTimeout(() => setShowCatalogToast(false), 4500);
    return () => clearTimeout(timer);
  }, [browseMode]);

  // Sync shop/catalog + /family/:id URLs with store
  useEffect(() => {
    const syncFromPath = () => {
      const path = window.location.pathname;
      const catalog = path === '/catalog' || path.startsWith('/catalog/');
      setBrowseMode(catalog ? 'catalog' : 'shop');

      const match = path.match(/^\/(?:catalog\/)?family\/([a-z0-9-]+)\/?$/i);
      const familyId = match?.[1]?.toLowerCase();
      if (familyId && getFamilyById(familyId)) {
        setFamily(familyId);
      } else if (
        path === '/' ||
        path === '' ||
        path === '/catalog' ||
        path === '/catalog/'
      ) {
        clearFamily();
      }
    };

    syncFromPath();
    window.addEventListener('popstate', syncFromPath);
    return () => window.removeEventListener('popstate', syncFromPath);
  }, [setFamily, clearFamily, setBrowseMode]);

  // Support /#categories-section deep links (e.g. from bottom nav on Account page)
  useEffect(() => {
    if (window.location.hash !== '#categories-section') return undefined;
    const timer = setTimeout(() => {
      document.getElementById('categories-section')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 120);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!completingRedirect) return undefined;

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      sessionStorage.removeItem('pendingAuthRedirect');
      setCompletingRedirect(false);
    };

    getRedirectResult(auth)
      .then((result) => {
        // onAuthStateChanged also fires for this, but resolving here first
        // makes the UI update the moment the redirect completes.
        if (result?.user) setUser(result.user);
      })
      .catch((err) => {
        console.error('Redirect auth error:', err);
      })
      .finally(finish);

    // Safety net: if getRedirectResult never settles (e.g. storage blocked
    // by the browser), don't leave the visitor stuck behind the overlay.
    const timeout = setTimeout(finish, 8000);
    return () => clearTimeout(timeout);
  }, [completingRedirect, setUser]);

  useEffect(() => {
    let activeUid = '';
    let stopCloudSync;
    let saveTimer;

    const stopCurrentCloudSync = () => {
      stopCloudSync?.();
      stopCloudSync = undefined;
      clearTimeout(saveTimer);
    };

    // Listen for Firebase Auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      stopCurrentCloudSync();
      activeUid = currentUser?.uid || '';
      setUser(currentUser);
      if (!currentUser) {
        // Never leave one customer's private data visible after logout.
        if (useStore.getState().customerInfo?.uid) clearAccountState();
        return;
      }

      const localState = useStore.getState();
      // Never leave another customer's persisted details visible while the
      // signed-in account is being resolved from cloud storage.
      setCustomerInfo({
        name: currentUser.displayName || '',
        phone: currentUser.phoneNumber || '',
        address: '',
        uid: currentUser.uid,
        phoneVerified: Boolean(currentUser.phoneNumber),
      });

      try {
        const [cloudAccount, account] = await Promise.all([
          loadCloudAccount(currentUser),
          syncCustomerAccount(currentUser).catch((error) => {
            console.error('NocoDB account sync failed:', error);
            return null;
          }),
        ]);
        if (activeUid !== currentUser.uid) return;

        const merged = mergeAccountState(localState, cloudAccount);
        merged.customerInfo = {
          ...merged.customerInfo,
          ...(account?.customerInfo || {}),
          // Prefer already-verified cloud/local values over empty NocoDB gaps.
          name: account?.customerInfo?.name
            || merged.customerInfo?.name
            || currentUser.displayName
            || '',
          phone: account?.customerInfo?.phone
            || merged.customerInfo?.phone
            || currentUser.phoneNumber
            || '',
          address: account?.customerInfo?.address
            || merged.customerInfo?.address
            || '',
          normalizedPhone: account?.customerInfo?.normalizedPhone
            || merged.customerInfo?.normalizedPhone
            || '',
          phoneVerified: Boolean(
            account?.customerInfo?.phoneVerified
            || merged.customerInfo?.phoneVerified
            || currentUser.phoneNumber
          ),
          uid: currentUser.uid,
        };
        setAccountState(merged);
        await saveCloudAccount(currentUser, merged);
        // Collect registrant emails for wholesale offer campaigns.
        upsertOffersLead(currentUser, {
          name: merged.customerInfo?.name,
          phone: merged.customerInfo?.phone,
          source: 'auth',
          offersOptIn: true,
        }).catch((error) => {
          console.error('Offers lead save failed:', error);
        });

        // Persist every relevant customer action after the initial restore.
        stopCloudSync = useStore.subscribe((state, previousState) => {
          if (
            state.cart === previousState.cart
            && state.wishlist === previousState.wishlist
            && state.restockSubscriptions === previousState.restockSubscriptions
            && state.customerInfo === previousState.customerInfo
          ) return;

          clearTimeout(saveTimer);
          saveTimer = setTimeout(() => {
            if (auth.currentUser?.uid !== currentUser.uid) return;
            saveCloudAccount(currentUser, useStore.getState()).catch(error => {
              console.error('Customer cloud save failed:', error);
            });
          }, 800);
        });
      } catch (error) {
        console.error('Customer cloud restore failed:', error);
      }
    });

    return () => {
      activeUid = '';
      stopCurrentCloudSync();
      unsubscribe();
    };
  }, [clearAccountState, setAccountState, setCustomerInfo, setUser]);

  // Open a product directly from a back-in-stock notification.
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const search = query.get('search');
    if (search) setSearchQuery(search);
  }, [setSearchQuery]);

  // Reconcile saved restock alerts whenever fresh catalog data arrives.
  useEffect(() => {
    if (products.length === 0 || restockSubscriptions.length === 0) return;

    restockSubscriptions.forEach((subscription) => {
      const key = String(subscription.id || subscription.ref);
      const liveProduct = products.find(
        (item) => String(item.id || item.ref) === key
      );
      if (!liveProduct || liveProduct.category === 'Out of Stock' || liveProduct.isAvailable === false) return;

      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('عاد المنتج للمخزون 🔔', {
          body: `${liveProduct.name || subscription.name || 'المنتج'} متوفر الآن.`,
          icon: '/app-icon-192.png',
          tag: `restock-${key}`,
        });
      }
      removeRestockSubscription(key);
    });
  }, [products, restockSubscriptions, removeRestockSubscription]);

  // Keep the local state in sync when the service worker detects a restock.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;
    const handleMessage = (event) => {
      if (event.data?.type !== 'RESTOCK_AVAILABLE') return;
      event.data.productKeys?.forEach(removeRestockSubscription);
    };
    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, [removeRestockSubscription]);

  // Track scroll position for scroll-to-top button
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-prompt login after 60 seconds for non-logged-in visitors (once per session)
  useEffect(() => {
    const alreadyPrompted = sessionStorage.getItem('login_prompted');
    if (alreadyPrompted) return;

    const timer = setTimeout(() => {
      if (!user) {
        setShowLoginToast(true);
        sessionStorage.setItem('login_prompted', 'true');
        // Auto-hide after 10 seconds
        setTimeout(() => setShowLoginToast(false), 10000);
      }
    }, 60000); // 60 seconds

    return () => clearTimeout(timer);
  }, [user]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (completingRedirect) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center gap-3 ${darkMode ? 'bg-gray-950 text-gray-100' : 'bg-white text-slate-700'}`}>
        <Loader2 className="animate-spin text-primary" size={36} />
        <p className="text-sm font-bold">جاري إكمال تسجيل الدخول...</p>
      </div>
    );
  }

  // ── Simple Router ──
  const path = window.location.pathname;
  if (path === '/admin') {
      return <AdminDashboard />;
  }
  if (path === '/tracking') {
      return <OrderTracking />;
  }
  if (path === '/purchase-count') {
      return <PurchaseCountPage />;
  }
  if (path === '/account') {
      return <AccountPage />;
  }
  if (path === '/categories' || path.startsWith('/categories/')) {
      return <CategoriesPage />;
  }
  if (path.startsWith('/p/')) {
      const sku = decodeURIComponent(path.slice(3));
      return <ProductLandingPage sku={sku} />;
  }
  // /family/:id and /catalog(/family/:id) are handled by the main storefront + store state

  return (
    <div className={`min-h-screen font-sans flex flex-col transition-colors duration-300
      ${darkMode ? 'bg-gray-950 text-gray-100' : 'bg-background-light text-slate-800'}`}>

      {/* Header */}
      <Header />

      {/* SEO H1 Tag (Visually Hidden) */}
      <h1 className="sr-only">Errayhany Grossiste - استيراد وبيع الإلكترونيات وإكسسوارات الهواتف بالجملة في المغرب والدار البيضاء</h1>

      {/* Notification prompt */}
      <NotificationPrompt />

      {/* Main Content — extra bottom padding clears the mobile bottom nav */}
      <main className="flex-grow max-w-[1600px] mx-auto w-full px-4 md:px-6 pt-3 pb-28">

        {/* Family hero slider — click opens the family catalog */}
        <FamilyHeroSlider />

        {/* Categories Rail (narrows to family subcategories when a family is open) */}
        <CategoryRail />

        {/* Featured & New Products (hourly rotation + today's new) */}
        <FeaturedStrip />

        {/* Full Product Grid */}
        <ProductGrid />

      </main>

      {/* Overlays */}
      <CartSidebar />
      <WishlistSidebar />
      <FloatingWhatsApp />
      <AuthModal />
      <AboutModal />
      <IOSInstallPrompt />
      <InstallAppBanner />
      <BottomNavBar />

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className={`fixed bottom-28 left-6 z-50 w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 active:scale-95
          ${darkMode ? 'bg-gray-800 text-white border border-gray-700 hover:bg-gray-700' : 'bg-white text-primary border border-slate-200 hover:bg-primary hover:text-white'}`}
          style={{ animation: 'slideUp 0.3s ease-out' }}
          aria-label="العودة للأعلى"
        >
          <ChevronUp size={20} />
        </button>
      )}

      {/* Catalog mode tip — temporary toast */}
      {showCatalogToast && (
        <div
          className={`fixed top-20 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50
            rounded-2xl shadow-2xl border px-4 py-3 flex items-start gap-3
            ${darkMode ? 'bg-gray-900 border-violet-500/40 text-violet-100' : 'bg-white border-violet-200 text-violet-900'}`}
          style={{ direction: 'rtl', animation: 'slideUp 0.35s ease-out' }}
          role="status"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">وضع الكتالوج</p>
            <p className={`text-xs mt-0.5 leading-relaxed ${darkMode ? 'text-gray-300' : 'text-slate-600'}`}>
              اضغط العين لفتح صفحة المنتج، أو على الصورة للمعاينة السريعة
            </p>
            <a
              href="/"
              className="inline-block mt-1.5 text-xs font-bold underline underline-offset-2 text-primary"
            >
              العودة للمتجر
            </a>
          </div>
          <button
            type="button"
            onClick={() => setShowCatalogToast(false)}
            className={`shrink-0 p-1 rounded-lg ${darkMode ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-slate-100 text-slate-400'}`}
            aria-label="إغلاق"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Login Toast Notification */}
      {showLoginToast && !user && (
        <div 
          className={`fixed bottom-28 left-4 right-4 sm:left-auto sm:right-6 sm:w-80 z-50
          rounded-2xl shadow-2xl border p-4 flex items-center gap-3 cursor-pointer
          ${darkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`}
          style={{ direction: 'rtl', animation: 'slideUp 0.4s ease-out' }}
          onClick={() => { setShowLoginToast(false); setAuthModalOpen(true); }}
        >
          <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${darkMode ? 'bg-primary/20' : 'bg-primary/10'}`}>
            <User size={20} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">سجل دخولك الآن!</p>
            <p className={`text-xs mt-0.5 ${darkMode ? 'text-gray-400' : 'text-slate-500'}`}>
              لتتبع طلباتك وحفظ بياناتك تلقائياً
            </p>
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); setShowLoginToast(false); }}
            className={`shrink-0 p-1 rounded-full ${darkMode ? 'hover:bg-gray-800' : 'hover:bg-slate-100'}`}
          >
            <X size={16} className={darkMode ? 'text-gray-500' : 'text-slate-400'} />
          </button>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default App;
