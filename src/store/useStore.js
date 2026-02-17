import { create } from 'zustand';

const useStore = create((set, get) => ({
    products: [],
    cart: [],
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
        'Stabilizers',
        'General'
    ],
    selectedCategory: 'All',
    isLoading: false,
    isCartOpen: false,

    categoryImages: {}, // Stores category images: { "Chargers": "url", ... }
    searchQuery: "",

    setProducts: (data) => {
        set({ products: data });
    },

    setSearchQuery: (query) => set({ searchQuery: query }),

    appendProducts: (newProducts) => {
        set((state) => {
            // Avoid duplicates just in case
            const existingIds = new Set(state.products.map(p => p.id));
            const uniqueNew = newProducts.filter(p => !existingIds.has(p.id));
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

    clearCart: () => set({ cart: [] }),
}));

export default useStore;
