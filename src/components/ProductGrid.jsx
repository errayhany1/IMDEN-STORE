import React, { useEffect } from 'react';
import useStore from '../store/useStore';
import { fetchProducts } from '../services/api';
import ProductCard from './ProductCard';
import PromotionalBanner from './PromotionalBanner';

const ProductGrid = () => {
    const { products, setProducts, setLoading, isLoading, selectedCategory } = useStore();

    useEffect(() => {
        const loadProducts = async () => {
            setLoading(true);
            const data = await fetchProducts();
            setProducts(data);
            setLoading(false);
        };
        loadProducts();
    }, [setProducts, setLoading]);

    const filteredProducts = selectedCategory === 'All'
        ? products
        : products.filter(p => p.category === selectedCategory);

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 animate-pulse">
                {[...Array(8)].map((_, i) => (
                    <div key={i} className="aspect-[4/3] bg-slate-200 rounded-xl" />
                ))}
            </div>
        );
    }

    // Insert Promotional Banner every 12 items (approx 3 rows on desktop)
    const itemsWithBanners = [];
    filteredProducts.forEach((product, index) => {
        itemsWithBanners.push(<ProductCard key={product.id} product={product} />);

        // Add banner after 12 items, but only once for now as per design intuition, or strictly every 12
        if ((index + 1) === 12) {
            // We need to break the grid layout for the banner. 
            // This method of pushing to array keeps it in grid. 
            // To have a full-width banner inside a grid, we usually need to break the grid or use col-span-full.
            // However, mixing children like this in a CSS grid container is tricky if we want the banner to be a separate section relative to the grid.
            // The design shows the banner between sections of the grid.
            // Simplification: We will render grid chunks.
        }
    });

    // Better approach matching design: Split filtered products into chunks
    const firstChunk = filteredProducts.slice(0, 12);
    const restChunk = filteredProducts.slice(12);

    return (
        <div className="pb-24">
            {/* First Grid Section */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                {firstChunk.map(product => (
                    <ProductCard key={product.id} product={product} />
                ))}
            </section>

            {/* Banner Section (Only if there are products) */}
            {filteredProducts.length > 0 && <PromotionalBanner />}

            {/* Remaining Grid Section */}
            {restChunk.length > 0 && (
                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                    {restChunk.map(product => (
                        <ProductCard key={product.id} product={product} />
                    ))}
                </section>
            )}

            {filteredProducts.length === 0 && (
                <div className="text-center py-10 text-slate-500">
                    No products found in this category.
                </div>
            )}

            {filteredProducts.length > 0 && (
                <div className="text-center py-6">
                    <span className="inline-block text-slate-400 text-sm">Showing all {filteredProducts.length} products</span>
                </div>
            )}
        </div>
    );
};

export default ProductGrid;
