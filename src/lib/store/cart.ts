import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
    id: string;
    productId: string;
    sku: string;
    name: string;
    price: number;
    originalPrice?: number;
    quantity: number;
    size?: string;
    image?: string;
}

interface CartStore {
    items: CartItem[];
    isOpen: boolean;

    // Actions
    addItem: (item: Omit<CartItem, 'id'>) => void;
    removeItem: (id: string) => void;
    updateQuantity: (id: string, quantity: number) => void;
    clearCart: () => void;
    toggleCart: () => void;
    openCart: () => void;
    closeCart: () => void;

    // Computed
    getTotalItems: () => number;
    getTotalPrice: () => number;
}

export const useCartStore = create<CartStore>()(
    persist(
        (set, get) => ({
            items: [],
            isOpen: false,

            addItem: (item) => {
                const { items } = get();
                const existingIndex = items.findIndex(
                    (i) => i.productId === item.productId && i.size === item.size
                );

                if (existingIndex >= 0) {
                    // Update quantity if item exists
                    const updated = [...items];
                    updated[existingIndex].quantity += item.quantity;
                    set({ items: updated });
                } else {
                    // Add new item
                    const newItem: CartItem = {
                        ...item,
                        id: `cart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    };
                    set({ items: [...items, newItem] });
                }
            },

            removeItem: (id) => {
                set({ items: get().items.filter((item) => item.id !== id) });
            },

            updateQuantity: (id, quantity) => {
                if (quantity <= 0) {
                    get().removeItem(id);
                    return;
                }

                const items = get().items.map((item) =>
                    item.id === id ? { ...item, quantity } : item
                );
                set({ items });
            },

            clearCart: () => set({ items: [] }),

            toggleCart: () => set({ isOpen: !get().isOpen }),
            openCart: () => set({ isOpen: true }),
            closeCart: () => set({ isOpen: false }),

            getTotalItems: () => {
                return get().items.reduce((sum, item) => sum + item.quantity, 0);
            },

            getTotalPrice: () => {
                return get().items.reduce(
                    (sum, item) => sum + item.price * item.quantity,
                    0
                );
            },
        }),
        {
            name: '3d-print-cart',
        }
    )
);

// Helper hooks
export const useCart = () => {
    const store = useCartStore();
    return {
        items: store.items,
        isOpen: store.isOpen,
        totalItems: store.getTotalItems(),
        totalPrice: store.getTotalPrice(),
        addItem: store.addItem,
        removeItem: store.removeItem,
        updateQuantity: store.updateQuantity,
        clearCart: store.clearCart,
        toggleCart: store.toggleCart,
        openCart: store.openCart,
        closeCart: store.closeCart,
    };
};
