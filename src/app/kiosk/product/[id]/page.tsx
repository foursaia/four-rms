"use client";

import { use, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMenuStore, Product, ProductIngredient } from "@/stores/menuStore";
import { useCartStore } from "@/stores/cartStore";
import { Button } from "@/components/ui/Button";
import { formatCurrency, cn } from "@/lib/utils";
import { ArrowLeft, Minus, Plus, Check, ShoppingCart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const products = useMenuStore((state) => state.products);
  const addItem = useCartStore((state) => state.addItem);
  
  const product = products.find(p => p.id === id);

  // Same-category recommendations (exclude self, max 3)
  const recommendations = products
    .filter(p => p.id !== id && p.category_id === product?.category_id && p.status === 'available')
    .slice(0, 3);
  
  const [removedDefaults, setRemovedDefaults] = useState<string[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<ProductIngredient[]>([]);
  const [isAdded, setIsAdded] = useState(false);
  const [addedItems, setAddedItems] = useState<string[]>([]);

  if (!product) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background">
        <p className="text-muted mb-4 text-xl">Product not found.</p>
        <Link href="/kiosk"><Button>Back to Menu</Button></Link>
      </div>
    );
  }

  const sizeKeywords = ['Inches', 'Regular', 'Large'];
  const sizeAddons = product.product_ingredients?.filter(pi => 
    pi.role === 'addon' && sizeKeywords.some(k => pi.ingredient.name.includes(k))
  ) || [];

  let baseSizeName = "Standard Size";
  if (sizeAddons.some(sa => sa.ingredient.name.includes("12 Inches"))) {
    baseSizeName = "9 Inches";
  } else if (sizeAddons.some(sa => sa.ingredient.name.includes("Regular")) && sizeAddons.some(sa => sa.ingredient.name.includes("Large"))) {
    baseSizeName = "Small";
  } else if (sizeAddons.length === 1 && sizeAddons[0].ingredient.name === "Large") {
    baseSizeName = "Regular";
  }

  const selectedSize = selectedAddons.find(sa => sizeAddons.some(size => size.ingredient_id === sa.ingredient_id)) || null;

  const handleSizeSelect = (pi: ProductIngredient | null) => {
    setSelectedAddons(prev => prev.filter(sa => !sizeAddons.some(size => size.ingredient_id === sa.ingredient_id)));
    if (pi) {
      setSelectedAddons(prev => [...prev, pi]);
    }
  };

  const defaultIngredients = product.product_ingredients?.filter(pi => pi.role === 'default') || [];
  const availableNormalAddons = product.product_ingredients?.filter(pi => 
    pi.role === 'addon' && 
    !sizeKeywords.some(k => pi.ingredient.name.includes(k)) &&
    !selectedAddons.some(sa => sa.ingredient_id === pi.ingredient_id)
  ) || [];
  const hasAnyNormalAddons = product.product_ingredients?.some(pi => 
    pi.role === 'addon' && !sizeKeywords.some(k => pi.ingredient.name.includes(k))
  ) || false;

  const toggleDefault = (ingId: string) => {
    setRemovedDefaults(prev => 
      prev.includes(ingId) ? prev.filter(i => i !== ingId) : [...prev, ingId]
    );
  };

  const addAddon = (pi: ProductIngredient) => {
    setSelectedAddons(prev => [...prev, pi]);
  };

  const removeAddon = (ingId: string) => {
    setSelectedAddons(prev => prev.filter(sa => sa.ingredient_id !== ingId));
  };

  const currentTotal = 
    product.price + 
    selectedAddons.reduce((sum, sa) => sum + (sa.price_adjustment || 0), 0) -
    defaultIngredients
      .filter(di => removedDefaults.includes(di.ingredient_id))
      .reduce((sum, di) => sum + (di.removal_reduction || 0), 0);


  const handleAddToCart = () => {
    const removedItems = defaultIngredients.filter(pi => removedDefaults.includes(pi.ingredient_id));
    addItem({ ...product, price: currentTotal }, removedItems, selectedAddons);
    
    setIsAdded(true);
    // Show success for a brief moment then go back to menu
    setTimeout(() => {
      router.push('/kiosk');
    }, 800);
  };

  const handleQuickAdd = (p: Product) => {
    addItem(p, [], []);
    setAddedItems(prev => [...prev, p.id]);
    setTimeout(() => {
      setAddedItems(prev => prev.filter(id => id !== p.id));
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Left: Visual Section (Sticky) */}
      <div className="w-full md:w-1/2 h-[40vh] md:h-screen sticky top-0 bg-surface">
        <Image 
          src={product.image_url || "/placeholder-food.jpg"} 
          alt={product.name} 
          fill 
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-black/20" />
        
        <Link href="/kiosk" className="absolute top-8 left-8">
          <Button variant="secondary" className="rounded-2xl gap-2 h-14 px-8 glass shadow-2xl">
            <ArrowLeft size={20} />
            BACK TO MENU
          </Button>
        </Link>

        <div className="absolute bottom-12 left-12 right-12">
           <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-7xl font-black text-white uppercase tracking-tighter leading-[0.9]"
           >
             {product.name}
           </motion.h1>
           <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="w-24 h-2 bg-primary mt-6 rounded-full" 
           />
        </div>
      </div>

      {/* Right: Customization Section (Scrollable) */}
      <div className="w-full md:w-1/2 flex flex-col p-8 md:p-20 bg-background overflow-y-auto custom-scrollbar">
        <div className="max-w-xl">
          <section className="mb-16">
            <h2 className="text-sm font-black uppercase tracking-[0.3em] text-muted mb-8">Description</h2>
            <p className="text-2xl font-medium text-foreground leading-relaxed">
              {product.description || "Indulge in our chef's special creation."}
            </p>
          </section>

          {/* Select Size */}
          {sizeAddons.length > 0 && (
            <section className="mb-16">
              <h2 className="text-sm font-black uppercase tracking-[0.3em] text-accent mb-8">Select Size</h2>
              <div className="flex flex-col gap-4">
                {/* Base Size */}
                <button
                  onClick={() => handleSizeSelect(null)}
                  className={cn(
                    "flex items-center justify-between p-6 rounded-[2rem] transition-all border-2 w-full text-left",
                    selectedSize === null
                      ? "border-accent bg-accent/10"
                      : "border-border bg-surface-lighter hover:border-accent/50"
                  )}
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-xl">{baseSizeName}</span>
                    <span className="text-sm text-muted mt-1">Base Price</span>
                  </div>
                  <div className={cn(
                    "w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all",
                    selectedSize === null ? "border-accent bg-accent text-background" : "border-muted"
                  )}>
                    {selectedSize === null && <Check size={16} />}
                  </div>
                </button>

                {/* Upgrade Sizes */}
                {sizeAddons.map(size => (
                  <button
                    key={size.ingredient_id}
                    onClick={() => handleSizeSelect(size)}
                    className={cn(
                      "flex items-center justify-between p-6 rounded-[2rem] transition-all border-2 w-full text-left",
                      selectedSize?.ingredient_id === size.ingredient_id
                        ? "border-accent bg-accent/10"
                        : "border-border bg-surface-lighter hover:border-accent/50"
                    )}
                  >
                    <div className="flex flex-col">
                      <span className="font-bold text-xl">{size.ingredient.name}</span>
                      <span className="text-sm text-accent font-black mt-1">
                        + {formatCurrency(size.price_adjustment || 0)}
                      </span>
                    </div>
                    <div className={cn(
                      "w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all",
                      selectedSize?.ingredient_id === size.ingredient_id ? "border-accent bg-accent text-background" : "border-muted"
                    )}>
                      {selectedSize?.ingredient_id === size.ingredient_id && <Check size={16} />}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Current Ingredients (Defaults + Selected Normal Addons) */}
          {(defaultIngredients.length > 0 || selectedAddons.filter(sa => !sizeAddons.some(size => size.ingredient_id === sa.ingredient_id)).length > 0) && (
            <section className="mb-16">
              <div className="flex justify-between items-end mb-8">
                <h2 className="text-sm font-black uppercase tracking-[0.3em] text-primary">Your Selection</h2>
                {defaultIngredients.length > 0 && (
                  <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Click to remove</span>
                )}
              </div>
              <div className="flex flex-wrap gap-4">
                {/* Default Ingredients */}
                {defaultIngredients.map((pi) => (
                  <motion.button
                    layout
                    key={pi.ingredient_id}
                    onClick={() => toggleDefault(pi.ingredient_id)}
                    className={cn(
                      "px-8 py-4 rounded-3xl font-bold transition-all border-2 flex items-center gap-3",
                      removedDefaults.includes(pi.ingredient_id)
                        ? "border-red-500/30 bg-red-500/5 text-red-500 line-through"
                        : "border-border bg-surface-lighter text-foreground hover:border-primary/50"
                    )}
                  >
                    {!removedDefaults.includes(pi.ingredient_id) && <Check size={18} className="text-primary" />}
                    {pi.ingredient.name}
                  </motion.button>
                ))}

                {/* Selected Normal Addons (Moved up here) */}
                <AnimatePresence>
                  {selectedAddons.filter(sa => !sizeAddons.some(size => size.ingredient_id === sa.ingredient_id)).map((pi) => (
                    <motion.button
                      layout
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      key={pi.ingredient_id}
                      onClick={() => removeAddon(pi.ingredient_id)}
                      className="px-8 py-4 rounded-3xl font-bold transition-all border-2 border-primary bg-primary/10 text-primary flex items-center gap-3"
                    >
                      <Plus size={18} />
                      {pi.ingredient.name}
                    </motion.button>
                  ))}
                </AnimatePresence>
              </div>
            </section>
          )}

          {/* Available Normal Add-ons */}
          {hasAnyNormalAddons && (
            <section className="mb-20">
              <h2 className="text-sm font-black uppercase tracking-[0.3em] text-accent mb-8">Extra Flavors (Add-ons)</h2>
              <div className="grid grid-cols-1 gap-4">
                {availableNormalAddons.length > 0 ? availableNormalAddons.map((pi) => (
                  <motion.button
                    layout
                    key={pi.ingredient_id}
                    onClick={() => addAddon(pi)}
                    className="flex items-center justify-between p-6 rounded-[2rem] bg-surface-lighter border-2 border-border hover:border-accent/50 transition-all group"
                  >
                    <div className="flex flex-col items-start">
                      <span className="font-bold text-xl">{pi.ingredient.name}</span>
                      <span className="text-sm text-accent font-black mt-1">
                        + {formatCurrency(pi.price_adjustment || 0)}
                      </span>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-surface flex items-center justify-center border border-border group-hover:bg-accent group-hover:text-white transition-all shadow-lg">
                      <Plus size={24} />
                    </div>
                  </motion.button>
                )) : (
                  <p className="text-muted italic">All available add-ons selected.</p>
                )}
              </div>
            </section>
          )}

          {/* You Might Also Like */}
          {recommendations.length > 0 && (
            <section className="mb-12">
              <h2 className="text-sm font-black uppercase tracking-[0.3em] text-muted mb-6">You Might Also Like</h2>
              <div className="flex flex-col gap-4">
                {recommendations.map(rec => (
                  <div key={rec.id}
                    className="flex items-center gap-5 p-4 rounded-[1.5rem] bg-surface-lighter border-2 border-border hover:border-primary/40 transition-all group relative"
                  >
                    <Link href={`/kiosk/product/${rec.id}`} className="absolute inset-0 z-10 mr-24" />
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0">
                      <Image src={rec.image_url || '/placeholder-food.jpg'} alt={rec.name} fill className="object-cover group-hover:scale-110 transition-transform duration-300" />
                    </div>
                    <div className="flex-grow min-w-0">
                      <p className="font-black text-white uppercase tracking-tight truncate">{rec.name}</p>
                      <p className="text-[10px] text-primary font-black uppercase tracking-wider">{formatCurrency(rec.price)}</p>
                    </div>
                    
                    <Button 
                      onClick={(e) => { e.stopPropagation(); handleQuickAdd(rec); }}
                      className={cn(
                        "relative z-20 h-12 px-6 rounded-xl font-black text-xs uppercase tracking-widest transition-all",
                        addedItems.includes(rec.id) ? "bg-emerald-500 text-white" : "bg-primary text-black hover:scale-105"
                      )}
                    >
                      {addedItems.includes(rec.id) ? <Check size={16} /> : "ADD +"}
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Final Summary Card */}
          <div className="sticky bottom-0 bg-background/80 backdrop-blur-xl py-8 mt-auto border-t border-border">
            <div className="flex items-center justify-between mb-8 px-2">
              <div>
                <p className="text-[10px] text-muted font-bold uppercase tracking-widest">Net Total</p>
                <p className="text-4xl font-black text-foreground">{formatCurrency(currentTotal)}</p>
              </div>
              <div className="text-right">
                 <p className="text-xs font-bold text-primary uppercase tracking-tighter">
                   {selectedAddons.length > 0 ? `Includes ${selectedAddons.length} extras` : 'Standard Price'}
                 </p>
              </div>
            </div>
            
            <Button 
              onClick={handleAddToCart}
              disabled={isAdded}
              className={cn(
                "w-full rounded-[2rem] py-10 text-2xl font-black gap-4 transition-all duration-500",
                isAdded 
                  ? "bg-emerald-500 text-white scale-95" 
                  : "bg-primary text-black hover:scale-[1.02]"
              )}
            >
              {isAdded ? (
                <>
                  <Check size={32} />
                  ADDED!
                </>
              ) : (
                <>
                  <ShoppingCart size={28} />
                  ADD TO ORDER
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
