import React from 'react';
import Header from './components/Header';
import CategoryRail from './components/CategoryRail';
import ProductGrid from './components/ProductGrid';
import CartSidebar from './components/CartSidebar';
import FloatingWhatsApp from './components/FloatingWhatsApp';
import useStore from './store/useStore';

function App() {
  const darkMode = useStore(s => s.darkMode);
  return (
    <div className={`min-h-screen font-sans flex flex-col transition-colors duration-300
      ${darkMode ? 'bg-gray-950 text-gray-100' : 'bg-background-light text-slate-800'}`}>
      {/* Header */}
      <Header />

      {/* Main Content */}
      <main className="flex-grow max-w-7xl mx-auto w-full px-4 py-8">

        {/* Categories Rail */}
        <CategoryRail />

        {/* Product Grid (includes Banners inside) */}
        <ProductGrid />

      </main>

      {/* Overlays */}
      <CartSidebar />
      <FloatingWhatsApp />
    </div>
  );
}

export default App;
