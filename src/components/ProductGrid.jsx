import React, { useEffect } from 'react';
import useStore from '../store/useStore';
import { fetchProducts } from '../services/api';
import ProductCard from './ProductCard';
import PromotionalBanner from './PromotionalBanner';

import { categoryTranslation } from './CategoryRail';
import { getFamilyById } from '../data/families';
import { LOCAL_CATEGORY_IMAGES } from '../data/categories';
const ProductGrid = () => {
    const {
        products,
        setProducts,
        appendProducts,
        updateCategoryImages,
        setLoading,
        isLoading,
        selectedCategory,
        selectedFamily,
        searchQuery,
        sortBy,
        stockFilter,
        gridColumns,
    } = useStore();

    const [displayLimit, setDisplayLimit] = React.useState(20);
    const hasFetched = React.useRef(false);

    useEffect(() => {
        const loadProducts = async () => {
            if (hasFetched.current) return;
            hasFetched.current = true;
            
            // Only show loading spinner and clear state on initial load
            const isInitialLoad = products.length === 0;
            if (isInitialLoad) {
                setLoading(true);
                setProducts([]);
            }

            await fetchProducts((chunk, newCategoryImages, options = {}) => {
                if (options.replace) {
                    setProducts(chunk);
                } else {
                    appendProducts(chunk);
                }
                updateCategoryImages({ ...(newCategoryImages || {}), ...LOCAL_CATEGORY_IMAGES });
                setLoading(false); // Disable loading as soon as first chunk arrives
            });

            setLoading(false);
        };

        loadProducts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run once on mount

    // Reset display limit when category, family, search, or filters change
    useEffect(() => {
        setDisplayLimit(20);
    }, [selectedCategory, selectedFamily, searchQuery, sortBy, stockFilter]);

    const activeFamily = selectedFamily ? getFamilyById(selectedFamily) : null;
    const familyCategories = activeFamily?.categories || null;

    const isOutOfStock = (p) =>
        p.category === 'Out of Stock' || p.isAvailable === false;

    const filteredProducts = products
        .filter(p => {
            let matchesSearch = true;

            if (searchQuery) {
                const cleanQuery = searchQuery.toLowerCase()
                    .replace(/(جملة|بالجملة|للجملة|wholesale|gros|en gros)/g, '')
                    .trim();

                if (cleanQuery !== '') {
                    const terms = cleanQuery.split(/\s+/).filter(Boolean);
                    const arabicCategory = categoryTranslation[p.category] || "";
                    const arabicTitle = p.originalData?.Arabic_Title || "";
                    const arabicDesc = p.originalData?.description_arabic || "";
                    const searchableText = `${p.name || ""} ${p.ref || ""} ${p.category || ""} ${arabicCategory} ${arabicTitle} ${arabicDesc}`.toLowerCase();
                    matchesSearch = terms.every(term => searchableText.includes(term));
                }

                // If the user is actively searching, show the product regardless of the selected category tab!
                // However, we still hide Out of Stock items from the general search unless they specifically search for them.
                if (isOutOfStock(p) && stockFilter !== 'out-of-stock' && !cleanQuery.includes('نفد') && !cleanQuery.includes('stock')) {
                    return false;
                }
                if (!matchesSearch) return false;
            } else if (familyCategories) {
                // Family view: only products that belong to this family's categories
                // (use baseCategory when stock forced the display category to Out of Stock)
                const productType = p.baseCategory || p.category;
                const inFamily = familyCategories.includes(productType)
                    || (p.category !== 'Out of Stock' && familyCategories.includes(p.category));
                if (!inFamily) return false;
                if (selectedCategory === 'All') {
                    if (p.category === 'Out of Stock' && stockFilter !== 'out-of-stock') return false;
                } else if (!(productType === selectedCategory || p.category === selectedCategory)) {
                    return false;
                }
            } else {
                // Home view: category filtering
                const matchesCategory = (selectedCategory === 'All' && p.category !== 'Out of Stock')
                    || p.category === selectedCategory;
                if (!matchesCategory && !(stockFilter === 'out-of-stock' && selectedCategory === 'All' && isOutOfStock(p))) {
                    return false;
                }
            }

            if (stockFilter === 'in-stock' && isOutOfStock(p)) return false;
            if (stockFilter === 'out-of-stock' && !isOutOfStock(p)) return false;
            return true;
        })
        .sort((a, b) => {
            if (sortBy === 'price-asc') return (Number(a.price) || 0) - (Number(b.price) || 0);
            if (sortBy === 'price-desc') return (Number(b.price) || 0) - (Number(a.price) || 0);
            if (sortBy === 'name-asc') {
                return String(a.name || a.ref || '').localeCompare(String(b.name || b.ref || ''), 'ar');
            }
            return 0;
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
            <div className={gridClass}>
                {[...Array(8)].map((_, i) => (
                    <div key={i} className="rounded-xl shadow-sm border p-3 flex flex-col gap-3 animate-pulse bg-white border-slate-100 dark:bg-gray-800 dark:border-gray-700">
                        <div className="w-full aspect-[3/4] bg-slate-200 dark:bg-gray-700 rounded-lg"></div>
                        <div className="flex justify-between items-center">
                            <div className="h-5 bg-slate-200 dark:bg-gray-700 rounded w-1/4"></div>
                            <div className="h-6 bg-slate-200 dark:bg-gray-700 rounded w-1/3"></div>
                        </div>
                        <div className="h-3 bg-slate-200 dark:bg-gray-700 rounded w-full mt-1"></div>
                        <div className="h-3 bg-slate-200 dark:bg-gray-700 rounded w-2/3 ml-auto"></div>
                        <div className="flex gap-2 flex-row-reverse mt-2">
                            <div className="h-10 bg-slate-200 dark:bg-gray-700 flex-1 rounded-lg"></div>
                            <div className="h-10 w-10 bg-slate-200 dark:bg-gray-700 rounded-lg"></div>
                        </div>
                    </div>
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
                {mobileFirst.map((product, index) => (
                    <ProductCard
                        key={product.id}
                        product={product}
                        priority={index < 4}
                    />
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
