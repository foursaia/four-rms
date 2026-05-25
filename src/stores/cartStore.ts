import { create } from 'zustand';
import { Product, ProductIngredient } from './menuStore';

export interface CartItem extends Product {
  cartItemId: string; // Unique ID for this specific cart entry
  quantity: number;
  removedIngredients: ProductIngredient[];
  selectedAddons: ProductIngredient[];
  notes?: string;
}

interface CartState {
  items: CartItem[];
  orderType: 'dine_in' | 'takeaway' | null;
  tableNumber: string | null;
  tableId: string | null;
  addItem: (product: Product, removedIngredients?: ProductIngredient[], selectedAddons?: ProductIngredient[]) => void;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  updateNotes: (cartItemId: string, notes: string) => void;
  clearCart: () => void;
  getTotal: () => number;
  setOrderType: (type: 'dine_in' | 'takeaway' | null) => void;
  setTableNumber: (table: string | null) => void;
  setTableId: (id: string | null) => void;
  setItems: (items: CartItem[]) => void;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  orderType: null,
  tableNumber: null,
  tableId: null,

  addItem: (product, removedIngredients = [], selectedAddons = []) => {
    const items = get().items;
    
    // Check if an item with the exact same id and customisations exists
    const existingItemIndex = items.findIndex((item) => {
      if (item.id !== product.id) return false;
      
      const sameRemoved = item.removedIngredients.length === removedIngredients.length &&
        item.removedIngredients.every(ri => removedIngredients.some(r => r.ingredient_id === ri.ingredient_id));
        
      const sameAddons = item.selectedAddons.length === selectedAddons.length &&
        item.selectedAddons.every(sa => selectedAddons.some(s => s.ingredient_id === sa.ingredient_id));
        
      return sameRemoved && sameAddons;
    });

    if (existingItemIndex >= 0) {
      const newItems = [...items];
      newItems[existingItemIndex].quantity += 1;
      set({ items: newItems });
    } else {
      set({ 
        items: [...items, { 
          ...product, 
          cartItemId: crypto.randomUUID(),
          quantity: 1,
          removedIngredients,
          selectedAddons
        }] 
      });
    }
  },

  removeItem: (cartItemId) => {
    set({ items: get().items.filter((item) => item.cartItemId !== cartItemId) });
  },

  updateQuantity: (cartItemId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(cartItemId);
      return;
    }
    set({
      items: get().items.map((item) =>
        item.cartItemId === cartItemId ? { ...item, quantity } : item
      ),
    });
  },

  updateNotes: (cartItemId, notes) => {
    set({
      items: get().items.map((item) =>
        item.cartItemId === cartItemId ? { ...item, notes } : item
      ),
    });
  },

  clearCart: () => set({ items: [], orderType: null, tableNumber: null, tableId: null }),

  getTotal: () => {
    return get().items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  },

  setOrderType: (type) => set({ orderType: type }),
  setTableNumber: (table) => set({ tableNumber: table }),
  setTableId: (id) => set({ tableId: id }),
  setItems: (items) => set({ items }),
}));
