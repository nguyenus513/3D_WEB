import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Item types
export type CartItemType = 'product' | 'custom' | 'print';

// Print file info
export interface PrintFileInfo {
    id: string;
    name: string;
    url?: string;
    thumbnail?: string;
    analysis?: {
        volume: number;
        grams: number;
        hours: number;
        price: number;
        boundingBox?: { x: number; y: number; z: number };
    };
}

// Print options
export interface PrintOptions {
    type: 'fdm' | 'resin';
    color: string;
    infill: string;
    layerHeight: string;
}

// Unified cart item supporting all types
export interface CartItem {
    id: string;
    type: CartItemType;

    // Common fields
    name: string;
    price: number;
    quantity: number;
    image?: string;
    notes?: string; // User notes for any item type

    // Product-specific fields
    productId?: string;
    sku?: string;
    size?: string;
    originalPrice?: number;

    // Print-specific fields
    printOptions?: PrintOptions;
    printFiles?: PrintFileInfo[];

    // Custom-specific fields
    description?: string;
    customFiles?: { name: string; url: string }[];
    customConfig?: {
        orderType: string;
        size: string;
        imageCount: number;
    };
}

interface CartStore {
    items: CartItem[];
    isOpen: boolean;
    isHydrated: boolean;

    // Actions
    addItem: (item: Omit<CartItem, 'id'>) => void;
    removeItem: (id: string) => void;
    updateQuantity: (id: string, quantity: number) => void;
    updateItem: (id: string, updates: Partial<CartItem>) => void;
    clearCart: () => void;
    clearItemsByType: (type: CartItemType) => void;
    toggleCart: () => void;
    openCart: () => void;
    closeCart: () => void;
    setHydrated: () => void;

    // Computed
    getTotalItems: () => number;
    getTotalPrice: () => number;

    // Type-specific getters
    getProductItems: () => CartItem[];
    getPrintItems: () => CartItem[];
    getCustomItems: () => CartItem[];
    getGroupedTotals: () => {
        products: { count: number; total: number };
        prints: { count: number; total: number };
        customs: { count: number; total: number };
    };
}

export const useCartStore = create<CartStore>()(
    persist(
        (set, get) => ({
            items: [],
            isOpen: false,
            isHydrated: false,

            addItem: (item) => {
                const { items } = get();

                // For products, check if same product+size exists
                if (item.type === 'product' && item.productId) {
                    const existingIndex = items.findIndex(
                        (i) => i.type === 'product' && i.productId === item.productId && i.size === item.size
                    );

                    if (existingIndex >= 0) {
                        const updated = [...items];
                        updated[existingIndex].quantity += item.quantity;
                        set({ items: updated });
                        return;
                    }
                }

                // Add new item
                const newItem: CartItem = {
                    ...item,
                    id: `cart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                };
                set({ items: [...items, newItem] });
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

            updateItem: (id, updates) => {
                const items = get().items.map((item) =>
                    item.id === id ? { ...item, ...updates } : item
                );
                set({ items });
            },

            clearCart: () => set({ items: [] }),

            clearItemsByType: (type) => {
                set({ items: get().items.filter((item) => item.type !== type) });
            },

            toggleCart: () => set({ isOpen: !get().isOpen }),
            openCart: () => set({ isOpen: true }),
            closeCart: () => set({ isOpen: false }),

            setHydrated: () => set({ isHydrated: true }),

            getTotalItems: () => {
                return get().items.reduce((sum, item) => sum + item.quantity, 0);
            },

            getTotalPrice: () => {
                return get().items.reduce(
                    (sum, item) => sum + item.price * item.quantity,
                    0
                );
            },

            // Type-specific getters
            getProductItems: () => get().items.filter((i) => i.type === 'product'),
            getPrintItems: () => get().items.filter((i) => i.type === 'print'),
            getCustomItems: () => get().items.filter((i) => i.type === 'custom'),

            getGroupedTotals: () => {
                const items = get().items;
                const calc = (type: CartItemType) => {
                    const filtered = items.filter((i) => i.type === type);
                    return {
                        count: filtered.reduce((s, i) => s + i.quantity, 0),
                        total: filtered.reduce((s, i) => s + i.price * i.quantity, 0),
                    };
                };
                return {
                    products: calc('product'),
                    prints: calc('print'),
                    customs: calc('custom'),
                };
            },
        }),
        {
            name: '3d-print-cart',
            onRehydrateStorage: () => (state) => {
                if (state) {
                    // Migrate legacy cart item types to current schema
                    const typeMap: Record<string, 'product' | 'custom' | 'print'> = {
                        'printing': 'print',
                        'ready_made': 'product',
                        'custom_single': 'custom',
                        'custom_couple': 'custom',
                        'custom_group': 'custom',
                        'custom_main': 'custom',
                        'custom_accessory': 'custom',
                        'custom_preview': 'custom',
                    };

                    const migratedItems = state.items.map(item => {
                        const mappedType = typeMap[item.type as string];
                        if (mappedType) {
                            return { ...item, type: mappedType };
                        }
                        return item;
                    });

                    // Only update if there were changes
                    const hasChanges = migratedItems.some((item, i) => item.type !== state.items[i].type);
                    if (hasChanges) {
                        state.items = migratedItems as typeof state.items;
                    }

                    state.setHydrated();
                }
            },
        }
    )
);

// Helper hooks
export const useCart = () => {
    const store = useCartStore();
    return {
        items: store.items,
        isOpen: store.isOpen,
        isHydrated: store.isHydrated,
        totalItems: store.getTotalItems(),
        totalPrice: store.getTotalPrice(),

        // Actions
        addItem: store.addItem,
        removeItem: store.removeItem,
        updateQuantity: store.updateQuantity,
        updateItem: store.updateItem,
        clearCart: store.clearCart,
        clearItemsByType: store.clearItemsByType,
        toggleCart: store.toggleCart,
        openCart: store.openCart,
        closeCart: store.closeCart,

        // Type-specific
        productItems: store.getProductItems(),
        printItems: store.getPrintItems(),
        customItems: store.getCustomItems(),
        groupedTotals: store.getGroupedTotals(),
    };
};
