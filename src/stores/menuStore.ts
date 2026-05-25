import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface Category {
  id: string;
  name: string;
  image_url?: string;
  sort_order: number;
}

export interface Ingredient {
  id: string;
  name: string;
  unit?: string;
  current_stock?: number;
  low_stock_threshold?: number;
}

export const getLowStockStatus = (product: Product): boolean => {
  if (!product.product_ingredients) return false;
  
  // Check if any default ingredient is at or below its low stock threshold
  return product.product_ingredients.some(pi => {
    if (pi.role !== 'default' || !pi.ingredient) return false;
    const stock = pi.ingredient.current_stock ?? 999;
    const threshold = pi.ingredient.low_stock_threshold ?? 0;
    return stock <= threshold;
  });
};

export interface ProductIngredient {
  ingredient_id: string;
  ingredient: Ingredient;
  role: 'default' | 'addon';
  price_adjustment?: number;
  removal_reduction?: number;
}



export interface Product {
  id: string;
  category_id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  status: 'available' | 'out_of_stock' | 'hidden';
  product_ingredients?: ProductIngredient[];
}

interface MenuState {
  categories: Category[];
  products: Product[];
  ingredients: Ingredient[];
  isLoading: boolean;
  error: string | null;
  fetchMenu: (branchId: string) => Promise<void>;
  updateProductStatus: (productId: string, status: Product['status']) => Promise<void>;
  updateProductPrice: (productId: string, price: number) => Promise<void>;
  updateProduct: (productId: string, updates: Partial<Pick<Product, 'name' | 'description' | 'price' | 'image_url' | 'category_id' | 'status'>>) => Promise<void>;
  addProduct: (branchId: string, product: Omit<Product, 'id' | 'product_ingredients'>) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;
  addCategory: (branchId: string, name: string) => Promise<void>;
  updateCategory: (categoryId: string, name: string) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;
  updateIngredientStock: (ingredientId: string, newStock: number) => Promise<void>;
  updateProductIngredients: (productId: string, ingredients: { ingredient_id: string; role: 'default' | 'addon'; price_adjustment?: number }[]) => Promise<void>;
  updateAddonPrice: (productId: string, ingredientId: string, price: number) => Promise<void>;
}

export const useMenuStore = create<MenuState>((set, get) => ({
  categories: [],
  products: [],
  ingredients: [],
  isLoading: false,
  error: null,

  fetchMenu: async (branchId) => {
    set({ isLoading: true, error: null });
    try {
      const { data: categories, error: catError } = await supabase
        .from('categories')
        .select('*')
        .eq('branch_id', branchId)
        .order('sort_order', { ascending: true });

      if (catError) throw catError;

      const { data: ingredients, error: ingError } = await supabase
        .from('ingredients')
        .select('*')
        .eq('branch_id', branchId);
      
      if (ingError) throw ingError;

      const { data: products, error: prodError } = await supabase
        .from('products')
        .select(`
          *,
          product_ingredients (
            ingredient_id,
            role,
            price_adjustment,
            removal_reduction,
            ingredient:ingredients (id, name, unit, current_stock, low_stock_threshold)
          )
        `)
        .eq('branch_id', branchId);

      if (prodError) throw prodError;

      set({ categories, ingredients, products: products as any[], isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  updateIngredientStock: async (ingredientId, newStock) => {
    const { error } = await supabase
      .from('ingredients')
      .update({ current_stock: newStock })
      .eq('id', ingredientId);
    
    if (!error) {
      set({ 
        ingredients: get().ingredients.map(i => i.id === ingredientId ? { ...i, current_stock: newStock } : i) 
      });
    }
  },

  updateProductStatus: async (productId, status) => {
    const { error } = await supabase
      .from('products')
      .update({ status })
      .eq('id', productId);
    
    if (!error) {
      set({ 
        products: get().products.map(p => p.id === productId ? { ...p, status } : p) 
      });
    }
  },

  updateProductPrice: async (productId, price) => {
    const { error } = await supabase
      .from('products')
      .update({ price })
      .eq('id', productId);
    
    if (!error) {
      set({ 
        products: get().products.map(p => p.id === productId ? { ...p, price } : p) 
      });
    }
  },

  updateProduct: async (productId, updates) => {
    const { error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', productId);
    if (!error) {
      set({ products: get().products.map(p => p.id === productId ? { ...p, ...updates } : p) });
    }
  },

  addProduct: async (branchId, product) => {
    const { data, error } = await supabase
      .from('products')
      .insert({ ...product, branch_id: branchId })
      .select()
      .single();
    if (!error && data) {
      set({ products: [...get().products, { ...data, product_ingredients: [] } as Product] });
    }
  },

  deleteProduct: async (productId) => {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId);
    if (!error) {
      set({ products: get().products.filter(p => p.id !== productId) });
    }
  },

  addCategory: async (branchId, name) => {
    const maxOrder = Math.max(0, ...get().categories.map(c => c.sort_order));
    const { data, error } = await supabase
      .from('categories')
      .insert({ name, branch_id: branchId, sort_order: maxOrder + 1 })
      .select()
      .single();
    if (!error && data) {
      set({ categories: [...get().categories, data as Category] });
    }
  },

  updateCategory: async (categoryId, name) => {
    const { error } = await supabase
      .from('categories')
      .update({ name })
      .eq('id', categoryId);
    if (!error) {
      set({ categories: get().categories.map(c => c.id === categoryId ? { ...c, name } : c) });
    }
  },

  deleteCategory: async (categoryId) => {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', categoryId);
    if (!error) {
      set({ categories: get().categories.filter(c => c.id !== categoryId) });
    }
  },

  updateProductIngredients: async (productId, ingredients) => {
    const { error: delError } = await supabase
      .from('product_ingredients')
      .delete()
      .eq('product_id', productId);
    
    if (delError) throw delError;

    if (ingredients.length > 0) {
      const { error: insError } = await supabase
        .from('product_ingredients')
        .insert(ingredients.map(i => ({ ...i, product_id: productId })));
      
      if (insError) throw insError;
    }

    const { data: currentProd } = await supabase.from('products').select('branch_id').eq('id', productId).single();
    if (currentProd?.branch_id) await get().fetchMenu(currentProd.branch_id);
  },

  updateAddonPrice: async (productId, ingredientId, price) => {
    const { error } = await supabase
      .from('product_ingredients')
      .update({ price_adjustment: price })
      .eq('product_id', productId)
      .eq('ingredient_id', ingredientId);
    
    if (!error) {
      set({
        products: get().products.map(p => {
          if (p.id !== productId) return p;
          return {
            ...p,
            product_ingredients: p.product_ingredients?.map(pi => 
              pi.ingredient_id === ingredientId ? { ...pi, price_adjustment: price } : pi
            )
          };
        })
      });
    }
  },
}));

