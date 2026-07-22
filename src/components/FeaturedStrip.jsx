import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import useStore from '../store/useStore';
import { getRotatingFeatured } from '../utils/featuredProducts';
import ProductCard from './ProductCard';

const FeaturedStrip = () => {
    const { products, darkMode, searchQuery, selectedCategory, selectedFamily } = useStore();
    const dm = darkMode;

    const [featured, setFeatured] = useState([]);
    const [nextIn, setNextIn] = useState(0); // seconds until next rotation

    const productsRef = useRef(products);

    // Keep the ref up to date without triggering re-renders of the ticker
    useEffect(() => {
        productsRef.current = products;
    }, [products]);

    // Initialize featured ONCE when products first load
    useEffect(() => {
        if (products.length > 0 && featured.length === 0) {
            setFeatured(getRotatingFeatured(products));
        }
    }, [products, featured.length]);

    // Independent ticker for the 10-minute rotation
    useEffect(() => {
        const tick = setInterval(() => {
            const now = Date.now();
            const msInSlot = now % (10 * 60 * 1000); // ms elapsed in current 10-min window
            const msLeft = (10 * 60 * 1000) - msInSlot;

            setNextIn(Math.ceil(msLeft / 1000));

            // When a new slot starts, update featured using the latest products from ref
            if (msLeft <= 1000 && productsRef.current.length > 0) {
                setTimeout(() => setFeatured(getRotatingFeatured(productsRef.current)), 1100);
            }
        }, 1000);

        return () => clearInterval(tick);
    }, []);

    if (featured.length === 0 || searchQuery || selectedCategory !== 'All' || selectedFamily) return null;

    // Format countdown mm:ss
    const mm = String(Math.floor(nextIn / 60)).padStart(2, '0');
    const ss = String(nextIn % 60).padStart(2, '0');

    return (
        <div className="mb-6">
            {/* Header row */}
            <div className="flex items-center justify-between mb-4" dir="rtl">
                <div className="flex items-center gap-2.5">
                    <span className="inline-block h-6 w-1.5 rounded-full bg-gradient-to-b from-primary to-primary-dark" />
                    <h2 className={`text-lg sm:text-xl font-extrabold tracking-tight ${dm ? 'text-white' : 'text-slate-800'}`}>
                        منتجات مميزة
                    </h2>
                </div>
                <RefreshCw size={16} className="text-primary/70 animate-spin" style={{ animationDuration: '8s' }} />
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
