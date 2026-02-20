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
        const matchesSearch = !searchQuery ||
            (p.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.ref || "").toLowerCase().includes(searchQuery.toLowerCase());

        return matchesCategory && matchesSearch;
    });

    // Mobile: 1 or 2 cols (user toggle), Desktop: always 4
    // Note: must override sm: breakpoint too when in single-col mode
    const gridClass = gridColumns === 1
        ? 'grid grid-cols-1 lg:grid-cols-4 gap-3 md:gap-5 mb-12'
        : 'grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5 mb-12';

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

    // Split into responsive chunks:
    // Mobile (2 cols): show banner after 4 products (2 rows)
    // Desktop (4 cols): show banner after 8 products (2 rows)
    const mobileFirst = filteredProducts.slice(0, 4);   // shown then banner on mobile
    const desktopFirst = filteredProducts.slice(4, 8);   // combined with mobileFirst = 8 on desktop
    const rest = filteredProducts.slice(8);

    return (
        <div className="pb-24">
            {/* First 4 products (both mobile and desktop) */}
            <section className={gridClass}>
                {mobileFirst.map(product => (
                    <ProductCard key={product.id} product={product} />
                ))}

                {/* On desktop (lg): show 4 more products before banner */}
                {desktopFirst.map(product => (
                    <ProductCard
                        key={`d-${product.id}`}
                        product={product}
                        className="hidden lg:block"
                    />
                ))}
            </section>

            {/* Banner after row 2 on desktop (8 products), row 2 on mobile (4 products) */}
            {filteredProducts.length > 0 && <PromotionalBanner />}

            {/* On mobile: show products 5–8 after the banner */}
            {desktopFirst.length > 0 && (
                <section className={`${gridClass} lg:hidden`}>
                    {desktopFirst.map(product => (
                        <ProductCard key={`m-${product.id}`} product={product} />
                    ))}
                </section>
            )}

            {/* Remaining products */}
            {rest.length > 0 && (
                <section className={gridClass}>
                    {rest.map(product => (
                        <ProductCard key={product.id} product={product} />
                    ))}
                </section>
            )}

            {filteredProducts.length === 0 && (
                <div className="text-center py-10 text-slate-500">
                    لا توجد منتجات في هذه الفئة.
                </div>
            )}

            {filteredProducts.length > 0 && (
                <div className="text-center py-6">
                    <span className="inline-block text-slate-400 text-sm">
                        عرض {filteredProducts.length} منتج
                    </span>
                </div>
            )}
        </div>
    );
};

export default ProductGrid;
