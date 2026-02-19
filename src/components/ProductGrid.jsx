import React, { useEffect } from 'react';
import useStore from '../store/useStore';
import { fetchProducts } from '../services/api';
import ProductCard from './ProductCard';
import PromotionalBanner from './PromotionalBanner';

const ProductGrid = () => {
    const { products, setProducts, appendProducts, updateCategoryImages, setLoading, isLoading, selectedCategory, searchQuery, gridColumns } = useStore();

    useEffect(() => {
        const loadProducts = async () => {
            setLoading(true);
            setProducts([]); // Clear existing

            await fetchProducts((chunk, newCategoryImages) => {
                appendProducts(chunk);
                updateCategoryImages(newCategoryImages);
                setLoading(false); // Disable loading as soon as first chunk arrives
            });

            setLoading(false);
        };
        loadProducts();
    }, []); // Run once on mount

    const filteredProducts = products.filter(p => {
        const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
        const matchesSearch = searchQuery === "" ||
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.ref.toLowerCase().includes(searchQuery.toLowerCase());

        return matchesCategory && matchesSearch;
    });

    // Mobile: 1 or 2 cols (user toggle), Desktop: always 4
    const mobileClass = gridColumns === 1 ? 'grid-cols-1' : 'grid-cols-2';
    const gridClass = `grid ${mobileClass} sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5 mb-12`;

    if (isLoading) {
        return (
            <div className={gridClass + ' animate-pulse'}>
                {[...Array(8)].map((_, i) => (
                    <div key={i} className="aspect-[4/3] bg-slate-200 dark:bg-slate-700 rounded-xl" />
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
            <section className={gridClass}>
                {firstChunk.map(product => (
                    <ProductCard key={product.id} product={product} />
                ))}
            </section>

            {/* Banner Section (Only if there are products) */}
            {filteredProducts.length > 0 && <PromotionalBanner />}

            {/* Remaining Grid Section */}
            {restChunk.length > 0 && (
                <section className={gridClass}>
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
