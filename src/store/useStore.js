import { create } from 'zustand';

const useStore = create((set, get) => ({
    products: [],
    cart: [],
    categories: [],
    selectedCategory: 'All',
    isLoading: false,
    isCartOpen: false,

    setProducts: (data) => {
        // Extract unique categories
        const uniqueCategories = ['All', ...new Set(data.map(p => p.category).filter(Boolean))];
        set({ products: data, categories: uniqueCategories });
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
