import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LOCAL_CATEGORY_IMAGES } from '../data/categories';
import {
    applyPrimaryImageMode,
    getPrimaryImageMode,
    setPrimaryImageModeStorage,
} from '../services/api';
import { uniqueProductsById } from '../utils/productList';

const useStore = create(
    persist(
        (set) => ({
            products: [],
            cart: [],
            wishlist: [],
            restockSubscriptions: [],
            isWishlistOpen: false,
            customerInfo: { name: '', phone: '', address: '' },
            user: null, // Firebase user object
            isAuthModalOpen: false,
            isAboutModalOpen: false,
            primaryImageMode: typeof window !== 'undefined' ? getPrimaryImageMode() : 'ai',
            categories: [
                'All',
                'Chargers',
                'Audio',
                'Smart Watches',
                'Gaming',
                'Mouse & Keyboard',
                'Storage',
                'Laptop Chargers',
                'Stands',
                'Lighting',
                'Cameras',
                'Network',
                'Microphones',
                'Batteries & Power Banks',
                'Cables',
                'Car Accessories',
                'Adapters & Hubs',
                'TV Boxes',
                'Cooling',
                'Phones',
                'General',
                'Out of Stock',
            ],
            selectedCategory: 'All',
            selectedFamily: null, // e.g. 'power' | 'audio' | 'devices'
            browseMode: (typeof window !== 'undefined' && window.location.pathname.startsWith('/catalog'))
                ? 'catalog'
                : 'shop',
            isLoading: false,
            isCartOpen: false,
            darkMode: false,
            gridColumns: 2, // 1 or 2 columns on mobile

            categoryImages: { ...LOCAL_CATEGORY_IMAGES }, // Template-2 artwork; NocoDB can merge on top then local overrides
            searchQuery: "",
            sortBy: 'default', // default | price-asc | price-desc | name-asc
            stockFilter: 'all', // all | in-stock | out-of-stock
            featuredProductIds: [],

            setUser: (user) => set({ user }),
            setAuthModalOpen: (isOpen) => set({ isAuthModalOpen: isOpen }),
            setAboutModalOpen: (isOpen) => set({ isAboutModalOpen: isOpen }),

            setProducts: (data) => {
                const mode = getPrimaryImageMode();
                const list = Array.isArray(data)
                    ? uniqueProductsById(data.map((p) => applyPrimaryImageMode(p, mode)))
                    : data;
                set({ products: list, primaryImageMode: mode });
            },

            setFeaturedProductIds: (ids) => set({
                featuredProductIds: Array.isArray(ids) ? ids.map((id) => String(id)) : [],
            }),

            setPrimaryImageMode: (mode) => {
                const next = setPrimaryImageModeStorage(mode);
                set((state) => ({
                    primaryImageMode: next,
                    products: (state.products || []).map((p) => applyPrimaryImageMode(p, next)),
                }));
            },

            setCustomerInfo: (info) => set({ customerInfo: info }),
            clearCustomerInfo: () => set({
                customerInfo: { name: '', phone: '', address: '' }
            }),
            setAccountState: (accountState) => set({
                cart: accountState.cart || [],
                wishlist: accountState.wishlist || [],
                restockSubscriptions: accountState.restockSubscriptions || [],
                customerInfo: accountState.customerInfo || {
                    name: '',
                    phone: '',
                    address: '',
                },
            }),
            clearAccountState: () => set({
                cart: [],
                wishlist: [],
                restockSubscriptions: [],
                customerInfo: { name: '', phone: '', address: '' },
            }),

            setSearchQuery: (query) => set({ searchQuery: query }),
            setSortBy: (sortBy) => set({ sortBy: sortBy || 'default' }),
            setStockFilter: (stockFilter) => set({ stockFilter: stockFilter || 'all' }),
            resetProductFilters: () => set({ sortBy: 'default', stockFilter: 'all' }),

            toggleDarkMode: () => set((state) => {
                const next = !state.darkMode;
                if (next) {
                    document.documentElement.classList.add('dark');
                } else {
                    document.documentElement.classList.remove('dark');
                }
                return { darkMode: next };
            }),

            toggleGridColumns: () => set((state) => ({
                gridColumns: state.gridColumns === 2 ? 1 : 2
            })),

            appendProducts: (newProducts) => {
                set((state) => {
                    const mode = state.primaryImageMode || getPrimaryImageMode();
                    const existingIds = new Set(state.products.map((p) => String(p.id)));
                    const uniqueNew = [];
                    for (const product of uniqueProductsById(newProducts || [])) {
                        const id = String(product.id);
                        if (existingIds.has(id)) continue;
                        existingIds.add(id);
                        uniqueNew.push(applyPrimaryImageMode(product, mode));
                    }
                    return { products: [...state.products, ...uniqueNew] };
                });
            },

            updateCategoryImages: (newImages) => {
                set((state) => ({
                    categoryImages: { ...state.categoryImages, ...newImages }
                }));
            },

            setLoading: (loading) => set({ isLoading: loading }),

            setCategory: (category) => set({ selectedCategory: category }),

            setFamily: (familyId) => set({
                selectedFamily: familyId || null,
                selectedCategory: 'All',
                searchQuery: '',
            }),

            clearFamily: () => set({
                selectedFamily: null,
                selectedCategory: 'All',
            }),

            setBrowseMode: (mode) => set({
                browseMode: mode === 'catalog' ? 'catalog' : 'shop',
            }),

            toggleCart: () => set((state) => ({ isCartOpen: !state.isCartOpen })),

            addToCart: (product, quantity = 1) => {
                set((state) => {
                    const existingItem = state.cart.find((item) => item.id === product.id);
                    if (existingItem) {
                        return {
                            cart: state.cart.map((item) =>
                                item.id === product.id
                                    ? { ...item, quantity: item.quantity + quantity }
                                    : item
                            ),
                        };
                    } else {
                        return {
                            cart: [...state.cart, { ...product, quantity }],
                        };
                    }
                });
            },

            removeFromCart: (productId) => {
                set((state) => ({
                    cart: state.cart.filter((item) => item.id !== productId),
                }));
            },

            updateQuantity: (productId, delta) => {
                set((state) => ({
                    cart: state.cart
                        .map((item) => {
                            if (item.id === productId) {
                                const newQuantity = Math.max(1, item.quantity + delta);
                                return { ...item, quantity: newQuantity };
                            }
                            return item;
                        })
                }));
            },

            setCartQuantity: (productId, quantity) => {
                const next = Math.min(9999, Math.max(1, Number(quantity) || 1));
                set((state) => ({
                    cart: state.cart.map((item) =>
                        item.id === productId ? { ...item, quantity: next } : item
                    ),
                }));
            },

            clearCart: () => set({ cart: [] }),

            // ── Wishlist ──
            toggleWishlistSidebar: () => set((state) => ({ isWishlistOpen: !state.isWishlistOpen })),

            toggleWishlistItem: (product) => {
                set((state) => {
                    const alreadySaved = state.wishlist.some((item) => item.id === product.id);
                    return {
                        wishlist: alreadySaved
                            ? state.wishlist.filter((item) => item.id !== product.id)
                            : [...state.wishlist, product],
                    };
                });
            },

            removeFromWishlist: (productId) => {
                set((state) => ({
                    wishlist: state.wishlist.filter((item) => item.id !== productId),
                }));
            },

            clearWishlist: () => set({ wishlist: [] }),

            moveWishlistItemToCart: (product) => {
                set((state) => {
                    const existingCartItem = state.cart.find((item) => item.id === product.id);
                    const nextCart = existingCartItem
                        ? state.cart.map((item) =>
                            item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
                        )
                        : [...state.cart, { ...product, quantity: 1 }];

                    return {
                        cart: nextCart,
                        wishlist: state.wishlist.filter((item) => item.id !== product.id),
                    };
                });
            },

            // ── Back-in-stock alerts ──
            toggleRestockSubscription: (product) => {
                set((state) => {
                    const key = String(product.id || product.ref);
                    const isSubscribed = state.restockSubscriptions.some(
                        (item) => String(item.id || item.ref) === key
                    );

                    return {
                        restockSubscriptions: isSubscribed
                            ? state.restockSubscriptions.filter(
                                (item) => String(item.id || item.ref) !== key
                            )
                            : [...state.restockSubscriptions, {
                                id: product.id,
                                ref: product.ref,
                                name: product.name,
                                image: product.image,
                            }],
                    };
                });
            },

            removeRestockSubscription: (productId) => {
                set((state) => ({
                    restockSubscriptions: state.restockSubscriptions.filter(
                        (item) => String(item.id || item.ref) !== String(productId)
                    ),
                }));
            },
        }),
        {
            name: 'wholesale-store-storage-v3', // v3: no longer persisting products/categoryImages (S3 signed URLs expire)
            partialize: (state) => ({
                cart: state.cart,
                wishlist: state.wishlist,
                restockSubscriptions: state.restockSubscriptions,
                customerInfo: state.customerInfo,
                darkMode: state.darkMode,
                primaryImageMode: state.primaryImageMode,
                // NOTE: products and categoryImages are NOT persisted because NocoDB
                // uses temporary S3 signed URLs that expire after ~2 hours.
                // Persisting them causes all images to break on subsequent visits.
            }),
        }
    )
);

export default useStore;
