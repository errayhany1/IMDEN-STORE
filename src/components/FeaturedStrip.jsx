import React, { useState, useEffect, useRef } from 'react';
import useStore from '../store/useStore';
import { getRotatingFeatured } from '../utils/featuredProducts';
import ProductCard from './ProductCard';
import ProductFilters from './ProductFilters';

const FeaturedStrip = () => {
    const { products, searchQuery, selectedCategory, selectedFamily } = useStore();

    const [featured, setFeatured] = useState([]);
    const productsRef = useRef(products);

    useEffect(() => {
        productsRef.current = products;
    }, [products]);

    useEffect(() => {
        if (products.length > 0 && featured.length === 0) {
            setFeatured(getRotatingFeatured(products));
        }
    }, [products, featured.length]);

    useEffect(() => {
        const tick = setInterval(() => {
            const now = Date.now();
            const msInSlot = now % (10 * 60 * 1000);
            const msLeft = (10 * 60 * 1000) - msInSlot;

            if (msLeft <= 1000 && productsRef.current.length > 0) {
                setTimeout(() => setFeatured(getRotatingFeatured(productsRef.current)), 1100);
            }
        }, 1000);

        return () => clearInterval(tick);
    }, []);

    const showFeatured =
        featured.length > 0 && !searchQuery && selectedCategory === 'All' && !selectedFamily;

    return (
        <div className="mb-6">
            <ProductFilters />

            {showFeatured && (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
                        {featured.map((p, i) => (
                            <ProductCard key={`feat-${p.id}-${i}`} product={p} />
                        ))}
                    </div>
                    <div className="mt-4 h-px bg-slate-200 dark:bg-gray-700" />
                </>
            )}
        </div>
    );
};

export default FeaturedStrip;
