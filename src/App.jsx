import React, { useEffect, useState } from 'react';
import Header from './components/Header';
import CategoryRail from './components/CategoryRail';
import ProductGrid from './components/ProductGrid';
import CartSidebar from './components/CartSidebar';
import FloatingWhatsApp from './components/FloatingWhatsApp';
import FeaturedStrip from './components/FeaturedStrip';
import NotificationPrompt from './components/NotificationPrompt';
import AIChatWidget from './components/AIChatWidget';
import AuthModal from './components/AuthModal';
import AdminDashboard from './pages/AdminDashboard';
import OrderTracking from './pages/OrderTracking';
import AccountPage from './pages/AccountPage';
import IOSInstallPrompt from './components/IOSInstallPrompt';
import useStore from './store/useStore';
import { User, X, ChevronUp } from 'lucide-react';

function App() {
  const { darkMode, setUser, user, setAuthModalOpen } = useStore();
  const [showLoginToast, setShowLoginToast] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    // Dynamically load Firebase to avoid TDZ issues in production builds
    let unsubscribe = null;
    import('./services/firebase').then(({ auth }) => {
      import('firebase/auth').then(({ onAuthStateChanged }) => {
        unsubscribe = onAuthStateChanged(auth, (currentUser) => {
          setUser(currentUser);
        });
      });
    }).catch(err => console.error("Firebase init error:", err));
    return () => { if (unsubscribe) unsubscribe(); };
  }, [setUser]);

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
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Simple Router ──
  const path = window.location.pathname;
  if (path === '/admin') {
      return <AdminDashboard />;
  }
  if (path === '/tracking') {
      return <OrderTracking />;
  }
  if (path === '/account') {
      return <AccountPage />;
  }

  return (
    <div className={`min-h-screen font-sans flex flex-col transition-colors duration-300
      ${darkMode ? 'bg-gray-950 text-gray-100' : 'bg-background-light text-slate-800'}`}>

      {/* Header */}
      <Header />

      {/* SEO H1 Tag (Visually Hidden) */}
      <h1 className="sr-only">IMDEN TECHNOLOGY - استيراد وبيع الإلكترونيات وإكسسوارات الهواتف بالجملة في المغرب والدار البيضاء</h1>

      {/* Notification prompt */}
      <NotificationPrompt />

      {/* Main Content */}
      <main className="flex-grow max-w-7xl mx-auto w-full px-4 py-6">

        {/* Categories Rail */}
        <CategoryRail />

        {/* Featured & New Products (hourly rotation + today's new) */}
        <FeaturedStrip />

        {/* Full Product Grid */}
        <ProductGrid />

      </main>

      {/* Overlays */}
      <CartSidebar />
      <FloatingWhatsApp />
      <AIChatWidget />
      <AuthModal />
      <IOSInstallPrompt />

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className={`fixed bottom-24 left-6 z-50 w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 active:scale-95
          ${darkMode ? 'bg-gray-800 text-white border border-gray-700 hover:bg-gray-700' : 'bg-white text-primary border border-slate-200 hover:bg-primary hover:text-white'}`}
          style={{ animation: 'slideUp 0.3s ease-out' }}
          aria-label="العودة للأعلى"
        >
          <ChevronUp size={20} />
        </button>
      )}

      {/* Login Toast Notification */}
      {showLoginToast && !user && (
        <div 
          className={`fixed bottom-24 left-4 right-4 sm:left-auto sm:right-6 sm:w-80 z-50 
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
