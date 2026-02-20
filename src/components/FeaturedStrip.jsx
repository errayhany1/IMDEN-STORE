import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import useStore from '../store/useStore';
import { getRotatingFeatured } from '../utils/featuredProducts';
import ProductCard from './ProductCard';

const FeaturedStrip = () => {
    const { products, darkMode, searchQuery, selectedCategory } = useStore();
    const dm = darkMode;

    const [featured, setFeatured] = useState([]);
    const [nextIn, setNextIn] = useState(0); // seconds until next rotation

    useEffect(() => {
        if (products.length === 0) return;

        // Set initial featured
        setFeatured(getRotatingFeatured(products));

        // Countdown ticker every second
        const tick = setInterval(() => {
            const now = Date.now();
            const msInSlot = now % (10 * 60 * 1000); // ms elapsed in current 10-min window
            const msLeft = (10 * 60 * 1000) - msInSlot;

            setNextIn(Math.ceil(msLeft / 1000));

            // When a new slot starts, update featured
            if (msLeft <= 1000) {
                setTimeout(() => setFeatured(getRotatingFeatured(products)), 1100);
            }
        }, 1000);

        return () => clearInterval(tick);
    }, [products]);

    if (featured.length === 0 || searchQuery || selectedCategory !== 'All') return null;

    // Format countdown mm:ss
    const mm = String(Math.floor(nextIn / 60)).padStart(2, '0');
    const ss = String(nextIn % 60).padStart(2, '0');

    return (
        <div className="mb-6">
            {/* Header row */}
            <div className="flex items-center justify-between mb-3 flex-row-reverse">
                <div className="flex items-center gap-2">
                    <RefreshCw size={16} className="text-primary animate-spin" style={{ animationDuration: '8s' }} />
                    <h2 className={`text-base font-bold ${dm ? 'text-white' : 'text-slate-800'}`}>
                        منتجات مميزة
                    </h2>
                </div>
                <span className={`text-xs font-mono px-2 py-0.5 rounded-full tabular-nums
                    ${dm ? 'bg-gray-700 text-gray-300' : 'bg-slate-100 text-slate-500'}`}>
                    تجدد بعد {mm}:{ss}
                </span>
            </div>

            {/* Product cards */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
                {featured.map((p, i) => (
                    <ProductCard key={`feat-${p.id}-${i}`} product={p} />
                ))}
            </div>

            <div className={`mt-4 h-px ${dm ? 'bg-gray-700' : 'bg-slate-200'}`} />
        </div>
    );
};

export default FeaturedStrip;
