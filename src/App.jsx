import React from 'react';
import Header from './components/Header';
import CategoryRail from './components/CategoryRail';
import ProductGrid from './components/ProductGrid';
import CartSidebar from './components/CartSidebar';
import FloatingWhatsApp from './components/FloatingWhatsApp';
import FeaturedStrip from './components/FeaturedStrip';
import NotificationPrompt from './components/NotificationPrompt';
import AIChatWidget from './components/AIChatWidget';
import useStore from './store/useStore';

function App() {
  const darkMode = useStore(s => s.darkMode);
  return (
    <div className={`min-h-screen font-sans flex flex-col transition-colors duration-300
      ${darkMode ? 'bg-gray-950 text-gray-100' : 'bg-background-light text-slate-800'}`}>

      {/* Header */}
      <Header />

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
    </div>
  );
}

export default App;
