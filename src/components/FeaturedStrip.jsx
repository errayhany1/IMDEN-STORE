import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Star, Sparkles } from 'lucide-react';
import useStore from '../store/useStore';
import { getHourlyFeatured, getTodayNewProducts } from '../utils/featuredProducts';
import ProductCard from './ProductCard';

const FeaturedStrip = () => {
    const { products, darkMode } = useStore();
    const dm = darkMode;

    const [featured, setFeatured] = useState([]);
    const [newToday, setNewToday] = useState([]);

    // Compute featured on load and refresh every hour
    useEffect(() => {
        const compute = () => {
            setFeatured(getHourlyFeatured(products));
            setNewToday(getTodayNewProducts(products));
        };
        if (products.length > 0) compute();

        // Refresh at the start of the next hour
        const now = Date.now();
        const msUntilNextHour = 3600000 - (now % 3600000);
        const timeout = setTimeout(() => {
            compute();
        }, msUntilNextHour);

        return () => clearTimeout(timeout);
    }, [products]);

    if (featured.length === 0 && newToday.length === 0) return null;

    return (
        <div className="mb-4">
            {/* ── New Today Section ── */}
            {newToday.length > 0 && (
                <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3 flex-row-reverse">
                        <Sparkles size={18} className="text-yellow-500" />
                        <h2 className={`text-base font-bold ${dm ? 'text-white' : 'text-slate-800'}`}>
                            وصل اليوم
                        </h2>
                        <span className="text-xs font-semibold bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full">
                            جديد
                        </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
                        {newToday.slice(0, 4).map(p => (
                            <ProductCard key={`new-${p.id}`} product={p} />
                        ))}
                    </div>
                </div>
            )}

            {/* ── Hourly Featured Section ── */}
            {featured.length > 0 && (
                <div className="mb-4">
                    <div className="flex items-center gap-2 mb-3 flex-row-reverse">
                        <Star size={18} className="text-primary fill-primary" />
                        <h2 className={`text-base font-bold ${dm ? 'text-white' : 'text-slate-800'}`}>
                            منتجات مميزة
                        </h2>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${dm ? 'bg-gray-700 text-gray-300' : 'bg-slate-100 text-slate-500'}`}>
                            تتجدد كل ساعة
                        </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
                        {featured.map(p => (
                            <ProductCard key={`feat-${p.id}`} product={p} />
                        ))}
                    </div>
                    <div className={`mt-3 h-px ${dm ? 'bg-gray-700' : 'bg-slate-200'}`} />
                </div>
            )}
        </div>
    );
};

export default FeaturedStrip;
