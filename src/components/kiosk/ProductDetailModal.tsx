"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Product, ProductIngredient } from "@/stores/menuStore";
import { useCartStore } from "@/stores/cartStore";
import { Button } from "../ui/Button";
import { formatCurrency } from "@/lib/utils";
import { X, Minus, Plus, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
}

export function ProductDetailModal({ product, onClose }: ProductDetailModalProps) {
  const addItem = useCartStore((state) => state.addItem);
  const [removedIngredients, setRemovedIngredients] = useState<string[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  
  if (!product) return null;

  const defaultIngredients = product.product_ingredients?.filter(pi => pi.role === 'default') || [];
  const addons = product.product_ingredients?.filter(pi => pi.role === 'addon') || [];

  const toggleIngredient = (id: string) => {
    setRemovedIngredients(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleAddon = (id: string) => {
    setSelectedAddons(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleAddToCart = () => {
    const removedItems = defaultIngredients.filter(pi => removedIngredients.includes(pi.ingredient_id));
    const addedItems = addons.filter(pi => selectedAddons.includes(pi.ingredient_id));
    
    addItem(product, removedItems, addedItems);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />
        
        <motion.div 
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-4xl bg-surface rounded-[2.5rem] overflow-hidden border border-border shadow-2xl flex flex-col md:flex-row h-[80vh]"
        >
          {/* Close Button */}
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 z-10 w-12 h-12 rounded-full bg-black/20 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white hover:bg-primary hover:text-background transition-all"
          >
            <X size={24} />
          </button>

          {/* Left: Image Section */}
          <div className="relative w-full md:w-1/2 h-64 md:h-auto">
            <Image 
              src={product.image_url || "/placeholder-food.jpg"} 
              alt={product.name} 
              fill 
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent" />
            <div className="absolute bottom-8 left-8">
              <h2 className="text-4xl font-black text-white uppercase tracking-tighter mb-2">{product.name}</h2>
              <p className="text-white/60 font-medium max-w-xs">{product.description}</p>
            </div>
          </div>

          {/* Right: Customization Section */}
          <div className="w-full md:w-1/2 flex flex-col p-8 md:p-12 overflow-y-auto custom-scrollbar bg-surface">
            <div className="flex-grow">
              {/* Default Ingredients */}
              <div className="mb-10">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-primary mb-6">Default Ingredients</h3>
                <div className="flex flex-wrap gap-3">
                  {defaultIngredients.length > 0 ? defaultIngredients.map((pi) => (
                    <button
                      key={pi.ingredient_id}
                      onClick={() => toggleIngredient(pi.ingredient_id)}
                      className={cn(
                        "px-6 py-3 rounded-2xl font-bold text-sm transition-all border flex items-center gap-2",
                        removedIngredients.includes(pi.ingredient_id)
                          ? "border-red-500/50 bg-red-500/10 text-red-500"
                          : "border-border bg-surface-lighter text-foreground hover:border-primary/50"
                      )}
                    >
                      {removedIngredients.includes(pi.ingredient_id) ? <Minus size={14} /> : <Check size={14} className="text-primary" />}
                      {pi.ingredient.name}
                    </button>
                  )) : <p className="text-muted text-sm italic">Standard preparation</p>}
                </div>
              </div>

              {/* Add-ons */}
              <div className="mb-10">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-accent mb-6">Popular Add-ons</h3>
                <div className="grid grid-cols-1 gap-3">
                  {addons.length > 0 ? addons.map((pi) => {
                    const isSelected = selectedAddons.includes(pi.ingredient_id);
                    return (
                      <button
                        key={pi.ingredient_id}
                        onClick={() => toggleAddon(pi.ingredient_id)}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-2xl border transition-all group",
                          isSelected 
                            ? "bg-accent/10 border-accent/50 text-white" 
                            : "bg-surface-lighter border-border hover:border-accent/50"
                        )}
                      >
                        <span className="font-bold">{pi.ingredient.name}</span>
                        <div className="flex items-center gap-4">
                          <span className={cn("font-black", isSelected ? "text-accent" : "text-accent/60")}>
                            {pi.price_adjustment ? `+ ${formatCurrency(pi.price_adjustment)}` : '+ Free'}
                          </span>
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center border transition-all",
                            isSelected 
                              ? "bg-accent text-white border-accent" 
                              : "bg-surface border-border group-hover:bg-accent group-hover:text-white"
                          )}>
                            {isSelected ? <Check size={16} /> : <Plus size={16} />}
                          </div>
                        </div>
                      </button>
                    );
                  }) : <p className="text-muted text-sm italic">No add-ons available for this item</p>}
                </div>
              </div>
            </div>

            {/* Final Action */}
            <div className="pt-8 mt-auto border-t border-border">
              <div className="flex items-center justify-between mb-6">
                <span className="text-muted font-bold uppercase tracking-widest text-xs">Subtotal</span>
                <span className="text-3xl font-black text-foreground">{formatCurrency(product.price)}</span>
              </div>
              <Button 
                onClick={handleAddToCart}
                size="xl" 
                className="w-full rounded-[1.5rem] py-6 text-xl font-black"
              >
                ADD TO ORDER
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// Helper for Tailwind classes
function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
