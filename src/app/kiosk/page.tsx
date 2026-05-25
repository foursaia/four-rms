"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMenuStore } from "@/stores/menuStore";

import { useCartStore } from "@/stores/cartStore";
import { CategoryBar } from "@/components/kiosk/CategoryBar";
import { ProductCard } from "@/components/kiosk/ProductCard";
import { OrderTypeModal } from "@/components/kiosk/OrderTypeModal";
import { supabase } from "@/lib/supabase";

import { Loader2, ShoppingBasket, Search, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/utils";

export default function KioskPage() {
  const { categories, products, isLoading, fetchMenu } = useMenuStore();
  const { items, getTotal, orderType } = useCartStore();

  const [selectedCategory, setSelectedCategory] = useState<string | null>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const init = async () => {
      const { getActiveBranchId } = await import("@/lib/supabase");
      const branchId = await getActiveBranchId();
      if (branchId) {
        fetchMenu(branchId);
      }
    };
    init();
  }, [fetchMenu]);

  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory === "all" || !selectedCategory || p.category_id === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         p.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (isLoading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-background">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="text-muted text-lg animate-pulse">Loading Delicious Menu...</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className="p-4 flex justify-between items-center glass z-50 shrink-0">
        <div>
          <h1 className="text-2xl font-black text-gradient uppercase tracking-tighter">
            Royal Cuisine
          </h1>
          <p className="text-[10px] text-muted font-bold uppercase tracking-widest">Self-Service Kiosk</p>
        </div>
        
        <div className="flex-grow max-w-md mx-8 relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/50">
            <Search size={20} />
          </div>
          <input 
            type="text"
            placeholder="Search our delicious menu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-lighter border border-border rounded-2xl py-3 pl-12 pr-12 text-foreground focus:outline-none focus:border-primary/50 transition-all font-medium placeholder:text-muted/50"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] text-muted uppercase font-bold tracking-widest">Status</p>
            <p className="text-sm font-bold text-primary">Live Menu</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-surface-lighter flex items-center justify-center border border-border">
            <ShoppingBasket className="text-primary" size={20} />
          </div>
        </div>
      </header>
      
      {(!items.length && !orderType) && (
        <OrderTypeModal onClose={() => {}} />
      )}


      
      {/* Main Layout with Sidebar */}

      <div className="flex flex-grow overflow-hidden">
        <CategoryBar 
          selectedId={selectedCategory} 
          onSelect={setSelectedCategory} 
        />

        <main className="flex-grow overflow-y-auto p-8 custom-scrollbar">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-8 max-w-[1600px] mx-auto">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          
          {filteredProducts.length === 0 && (
            <div className="text-center py-20">
              <p className="text-muted text-xl">No items available in this category yet.</p>
            </div>
          )}
          
          <div className="h-32" />
        </main>
      </div>

      {/* Bottom Cart Bar */}
      {items.length > 0 && (
        <footer className="fixed bottom-6 left-[58%] -translate-x-1/2 w-[70%] max-w-4xl z-50">
          <div className="glass p-4 rounded-3xl flex items-center justify-between shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-primary/20 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-6 px-4">
              <div>
                <p className="text-[10px] text-muted font-bold uppercase tracking-widest">Total Order</p>
                <p className="text-2xl font-black text-primary">{formatCurrency(getTotal())}</p>
              </div>
              <div className="h-10 w-px bg-border" />
              <p className="text-sm font-medium text-foreground">
                <span className="text-primary font-bold">{items.reduce((sum, i) => sum + i.quantity, 0)}</span> Items in Cart
              </p>
            </div>
            
            <Link href="/kiosk/checkout">
              <Button size="lg" variant="primary" className="rounded-2xl px-12 text-xl font-black h-14">
                CHECKOUT
              </Button>
            </Link>

          </div>
        </footer>
      )}
    </div>
  );
}
