import React, { useEffect } from 'react';
import useStore from '../store/useStore';
import { fetchProducts } from '../services/api';
import ProductCard from './ProductCard';
import PromotionalBanner from './PromotionalBanner';

const ProductGrid = () => {
    const { products, setProducts, appendProducts, updateCategoryImages, setLoading, isLoading, selectedCategory, searchQuery, gridColumns } = useStore();

    const [displayLimit, setDisplayLimit] = React.useState(20);

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

        // Only load if empty, to prevent reloading when navigating back to this component
        if (products.length === 0) {
            loadProducts();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run once on mount

    // Reset display limit when category or search changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        setDisplayLimit(20);
    }, [selectedCategory, searchQuery]);

    const filteredProducts = products.filter(p => {
        const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
        let matchesSearch = true;

        if (searchQuery) {
            // Remove common wholesale words from the query so they don't block actual product findings
            const cleanQuery = searchQuery.toLowerCase()
                .replace(/(جملة|بالجملة|للجملة|wholesale|gros|en gros)/g, '')
                .trim();

            if (cleanQuery !== '') {
                // Split remaining query into words and ensure ALL words match the product info
                const terms = cleanQuery.split(/\s+/).filter(Boolean);
                const searchableText = `${p.name || ""} ${p.ref || ""} ${p.category || ""}`.toLowerCase();
                matchesSearch = terms.every(term => searchableText.includes(term));
            }
        }

        return matchesCategory && matchesSearch;
    });

    const displayedProducts = filteredProducts.slice(0, displayLimit);

    // Intersection observer for infinite scroll
    const loadMoreRef = React.useRef(null);
    useEffect(() => {
        const currentRef = loadMoreRef.current;
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && displayLimit < filteredProducts.length) {
                setDisplayLimit(prev => prev + 20);
            }
        }, { threshold: 0.1 });

        if (currentRef) observer.observe(currentRef);

        return () => {
            if (currentRef) observer.unobserve(currentRef);
        };
    }, [displayLimit, filteredProducts.length]);

    // Mobile: 1 or 2 cols (user toggle), Desktop: always 4
    // Note: must override sm: breakpoint too when in single-col mode
    const gridClass = gridColumns === 1
        ? 'grid grid-cols-1 lg:grid-cols-4 gap-3 md:gap-5 mb-12'
        : 'grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5 mb-12';

    if (isLoading && products.length === 0) {
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
    displayedProducts.forEach((product) => {
        itemsWithBanners.push(<ProductCard key={product.id} product={product} />);
        // simplified banner logic
    });

    // Split into responsive chunks:
    // Mobile (2 cols): show banner after 4 products (2 rows)
    // Desktop (4 cols): show banner after 8 products (2 rows)
    const mobileFirst = displayedProducts.slice(0, 4);   // shown then banner on mobile
    const desktopFirst = displayedProducts.slice(4, 8);   // combined with mobileFirst = 8 on desktop
    const rest = displayedProducts.slice(8);

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

            {/* Invisible observer element to trigger next page */}
            {displayLimit < filteredProducts.length && (
                <div ref={loadMoreRef} className="h-10 w-full" />
            )}
        </div>
    );
};

export default ProductGrid;
