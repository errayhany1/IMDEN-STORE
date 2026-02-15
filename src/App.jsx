import React from 'react';
import Header from './components/Header';
import CategoryRail from './components/CategoryRail';
import ProductGrid from './components/ProductGrid';
import CartSidebar from './components/CartSidebar';
import FloatingWhatsApp from './components/FloatingWhatsApp';

function App() {
  return (
    <div className="min-h-screen bg-background-light font-sans text-slate-800 flex flex-col">
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
