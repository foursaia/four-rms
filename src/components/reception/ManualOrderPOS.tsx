"use client";

import { useState, useEffect } from "react";
import { useMenuStore, Product, ProductIngredient, getLowStockStatus } from "@/stores/menuStore";
import { useCartStore } from "@/stores/cartStore";
import { useKitchenStore, KitchenOrder } from "@/stores/useKitchenStore";
import { useReceptionStore } from "@/stores/useReceptionStore";
import { useOfflineStore } from "@/stores/useOfflineStore";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatCurrency, cn } from "@/lib/utils";
import { X, Search, Plus, Minus, ShoppingCart, Loader2, ChevronRight, Edit3 } from "lucide-react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

interface ManualOrderPOSProps {
  onClose: () => void;
  editingOrder?: KitchenOrder | null;
  profileId: string | null;
}

export function ManualOrderPOS({ onClose, editingOrder, profileId }: ManualOrderPOSProps) {
  const { isOnline, addToQueue } = useOfflineStore();
  const { categories, products, fetchMenu } = useMenuStore();
  const { 
    items, addItem, updateQuantity, updateNotes, getTotal, clearCart, 
    setOrderType, orderType, setTableNumber, tableNumber, 
    setTableId, tableId, setItems 
  } = useCartStore();
  
  const [selectedCat, setSelectedCat] = useState("all");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null);

  // New Payment & Split State
  const [showPaymentView, setShowPaymentView] = useState(false);
  const [splitCount, setSplitCount] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<'cash'|'card'|'mixed'>('cash');

  useEffect(() => {
    const init = async () => {
      const { data: branches } = await supabase.from('branches').select('id').limit(1);
      if (branches?.[0]) {
        fetchMenu(branches[0].id);
      }
    };
    init();

    // If editing, load the existing order into cart
    if (editingOrder) {
      setOrderType(editingOrder.order_type);
      setTableNumber(editingOrder.table_number || null);
      setTableId(editingOrder.table_id || null);
      
      const cartItems = (editingOrder.items || []).map(item => ({
        id: item.product_id, // We need product_id here
        name: item.product_name,
        price: item.unit_price,
        quantity: item.quantity,
        category_id: '',
        image_url: '',
        removedIngredients: item.customisations?.filter((c: any) => c.action === 'removed').map((c: any) => ({ ingredient_id: c.ingredient_id, ingredient: { name: c.ingredient_name } })) || [],
        selectedAddons: item.customisations?.filter((c: any) => c.action === 'added').map((c: any) => ({ ingredient_id: c.ingredient_id, ingredient: { name: c.ingredient_name } })) || [],
        cartItemId: Math.random().toString(36).substring(2, 11)
      } as any));
      
      setItems(cartItems);
    } else {
      clearCart();
    }
  }, [fetchMenu, editingOrder]);

  const filteredProducts = selectedCat === "all" ? products : products.filter(p => p.category_id === selectedCat);

  const handleCompleteOrder = async (isCheckout: boolean = false) => {
    if (items.length === 0 || !orderType) {
      alert("Please select items and order type");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const { data: branches } = await supabase.from('branches').select('id').limit(1);
      const branchId = branches?.[0]?.id;

      if (!branchId) {
        alert("System Error: Branch ID not found. Please refresh.");
        setIsSubmitting(false);
        return;
      }

      // ONLY treat as update if we have a valid order ID
      if (editingOrder && editingOrder.id) {
        // UPDATE EXISTING ORDER
        const { error: orderError } = await supabase
          .from('orders')
          .update({
            order_type: orderType,
            table_id: tableId || null,
            table_number: tableNumber || null,
            total: getTotal(),
            status: isCheckout ? 'delivered' : editingOrder.status, // If checkout, close the order
            payment_status: isCheckout ? 'paid' : editingOrder.payment_status,
            payment_method: isCheckout ? paymentMethod : editingOrder.payment_method,
          })
          .eq('id', editingOrder.id);

        if (orderError) throw orderError;

        // TABLE TRANSFER LOGIC: Proper unlink/link
        if (editingOrder.table_id && tableId && editingOrder.table_id !== tableId) {
            await useReceptionStore.getState().unlinkOrderFromTable(editingOrder.table_id);
            if (!isCheckout) {
                await useReceptionStore.getState().linkOrderToTable(tableId, editingOrder.id);
            }
        }

        // Simple approach: Delete old items and insert new ones
        await supabase.from('order_items').delete().eq('order_id', editingOrder.id);
        
        for (const item of items) {
          const { data: insertedItem, error: itemError } = await supabase
            .from('order_items')
            .insert({
              order_id: editingOrder.id,
              product_id: item.id,
              product_name: item.name,
              unit_price: item.price,
              quantity: item.quantity,
              notes: item.notes || null,
            })
            .select('id')
            .single();

          if (itemError) throw itemError;

          const customisations: any[] = [];
          if (item.removedIngredients) {
            item.removedIngredients.forEach((ri: any) => {
              customisations.push({
                order_item_id: insertedItem.id,
                ingredient_id: ri.ingredient_id,
                ingredient_name: ri.ingredient?.name || 'Removed Ingredient',
                action: 'removed'
              });
            });
          }
          if (item.selectedAddons) {
            item.selectedAddons.forEach((sa: any) => {
              customisations.push({
                order_item_id: insertedItem.id,
                ingredient_id: sa.ingredient_id,
                ingredient_name: sa.ingredient?.name || 'Extra Addon',
                action: 'added'
              });
            });
          }

          if (customisations.length > 0) {
            const { error: custError } = await supabase.from('order_item_customisations').insert(customisations);
            if (custError) throw custError;
          }
        }

        // Update table status if checking out
        if (isCheckout && editingOrder.table_id) {
            await useReceptionStore.getState().updateTableStatus(editingOrder.table_id, 'available');
        }

      } else {
        // OFFLINE FALLBACK: If no internet, queue the order locally
        if (!navigator.onLine) {
          addToQueue({
            branch_id: branchId,
            order_type: orderType as 'dine_in' | 'takeaway',
            table_id: tableId || null,
            table_number: tableNumber || null,
            order_source: 'pos',
            payment_method: isCheckout ? paymentMethod : 'cash',
            payment_status: isCheckout ? 'paid' : 'unpaid',
            total: getTotal(),
            items,
            created_at: new Date().toISOString(),
          });
          clearCart();
          onClose();
          return;
        }

        // ONLINE: CREATE NEW ORDER normally
        const { data: order, error } = await supabase
          .from('orders')
          .insert({
            branch_id: branchId,
            order_type: orderType,
            table_id: tableId || null,
            table_number: tableNumber || null,
            order_source: 'pos',
            status: isCheckout ? 'delivered' : 'confirmed',
            payment_method: isCheckout ? paymentMethod : 'cash',
            payment_status: isCheckout ? 'paid' : 'unpaid',
            total: getTotal(),
            user_id: profileId,
            receptionist_id: profileId,
          })
          .select('id')
          .single();

        if (error) throw error;

        for (const item of items) {
          const { data: insertedItem, error: itemError } = await supabase
            .from('order_items')
            .insert({
              order_id: order.id,
              product_id: item.id,
              product_name: item.name,
              unit_price: item.price,
              quantity: item.quantity,
              notes: item.notes || null,
            })
            .select('id')
            .single();

          if (itemError) throw itemError;

          const customisations: any[] = [];
          if (item.removedIngredients) {
            item.removedIngredients.forEach((ri: any) => {
              customisations.push({
                order_item_id: insertedItem.id,
                ingredient_id: ri.ingredient_id,
                ingredient_name: ri.ingredient?.name || 'Removed Ingredient',
                action: 'removed'
              });
            });
          }
          if (item.selectedAddons) {
            item.selectedAddons.forEach((sa: any) => {
              customisations.push({
                order_item_id: insertedItem.id,
                ingredient_id: sa.ingredient_id,
                ingredient_name: sa.ingredient?.name || 'Extra Addon',
                action: 'added'
              });
            });
          }

          if (customisations.length > 0) {
            const { error: custError } = await supabase.from('order_item_customisations').insert(customisations);
            if (custError) throw custError;
          }
        }

        // If it's a new dine-in order that is NOT immediately checked out, link table to order
        if (!isCheckout && orderType === 'dine_in' && tableId) {
            await useReceptionStore.getState().linkOrderToTable(tableId, order.id);
        }
      }
      
      clearCart();
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const groupedItems = Object.values(items.reduce((acc, item) => {
    if (!acc[item.id]) {
      acc[item.id] = {
        product_id: item.id,
        name: item.name,
        variations: []
      };
    }
    acc[item.id].variations.push(item);
    return acc;
  }, {} as Record<string, any>));

  return (
    <div className="fixed inset-0 z-[100] bg-background flex">
      {/* Left: Product Selection */}
      <div className="flex-grow min-w-0 flex flex-col border-r border-border">
        <div className="p-6 bg-surface border-b border-border flex items-center gap-4 overflow-x-auto no-scrollbar">
          <Button 
            variant={selectedCat === "all" ? "primary" : "secondary"}
            onClick={() => setSelectedCat("all")}
            className="rounded-xl shrink-0"
          >
            All Items
          </Button>
          {categories.map(cat => (
            <Button 
              key={cat.id}
              variant={selectedCat === cat.id ? "primary" : "secondary"}
              onClick={() => setSelectedCat(cat.id)}
              className="rounded-xl shrink-0"
            >
              {cat.name}
            </Button>
          ))}
        </div>

        <div className="flex-grow overflow-y-auto p-6 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 custom-scrollbar">
          {filteredProducts.map(product => {
            const isLowStock = getLowStockStatus(product);
            
            return (
              <Card 
                key={product.id}
                onClick={() => setCustomizingProduct(product)}
                className={cn(
                  "group cursor-pointer hover:border-primary/50 transition-all overflow-hidden h-fit relative",
                  isLowStock ? "border-orange-500/30" : ""
                )}
              >
                <div className="relative aspect-square w-full">
                  <Image src={product.image_url || "/placeholder.jpg"} alt={product.name} fill className="object-cover" />
                  {isLowStock && (
                    <div className="absolute top-2 right-2 bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded shadow-lg animate-pulse">
                      Low Stock
                    </div>
                  )}
                </div>
                <div className="p-3 text-center">
                  <p className="font-bold text-sm truncate">{product.name}</p>
                  <p className="text-primary font-black">{formatCurrency(product.price)}</p>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Right: Cart & Actions */}
      <div className="w-[450px] shrink-0 bg-surface flex flex-col">
        <div className="p-6 border-b border-border flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Edit3 className="text-primary" size={24} />
            <h2 className="text-xl font-black uppercase tracking-tighter">
              {editingOrder ? `Editing Order #${editingOrder.order_number}` : "Manual POS"}
            </h2>
          </div>
          <button onClick={onClose} className="text-muted hover:text-white"><X size={24} /></button>
        </div>

        {showPaymentView ? (
          <div className="flex-grow flex flex-col p-8 overflow-y-auto custom-scrollbar">
            <h3 className="font-black text-2xl mb-8 uppercase tracking-tighter">Payment Phase</h3>
            
            <div className="mb-10">
              <p className="text-xs font-bold text-muted uppercase mb-4 tracking-widest">Payment Method</p>
              <div className="grid grid-cols-3 gap-3">
                {['cash', 'card', 'mixed'].map(method => (
                  <Button 
                    key={method} 
                    variant={paymentMethod === method ? 'primary' : 'outline'}
                    onClick={() => setPaymentMethod(method as any)}
                    className="uppercase text-xs font-black h-12 rounded-xl"
                  >
                    {method}
                  </Button>
                ))}
              </div>
            </div>

            <div className="mb-10">
              <p className="text-xs font-bold text-muted uppercase mb-4 tracking-widest">Split Bill (Ways)</p>
              <div className="flex items-center gap-4 bg-background p-4 rounded-2xl border border-border">
                <Button variant="secondary" onClick={() => setSplitCount(Math.max(1, splitCount - 1))} className="w-12 h-12 p-0 rounded-full"><Minus size={20}/></Button>
                <div className="flex-grow text-center font-black text-2xl">{splitCount} <span className="text-sm text-muted ml-1">{splitCount === 1 ? 'Way' : 'Ways'}</span></div>
                <Button variant="secondary" onClick={() => setSplitCount(splitCount + 1)} className="w-12 h-12 p-0 rounded-full"><Plus size={20}/></Button>
              </div>
            </div>

            {splitCount > 1 && (
              <div className="bg-primary/10 border border-primary/20 p-6 rounded-2xl mb-8 text-center animate-in fade-in zoom-in duration-300">
                <p className="text-[10px] font-black text-primary mb-2 uppercase tracking-[0.2em]">Amount Per Person</p>
                <p className="text-4xl font-black text-white">{formatCurrency(getTotal() / splitCount)}</p>
              </div>
            )}

            <div className="mt-auto pt-6 border-t border-border">
              <Button onClick={() => setShowPaymentView(false)} variant="secondary" className="w-full h-14 rounded-xl font-bold">BACK TO CART</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="p-6 grid grid-cols-2 gap-4 border-b border-border">
              <Button 
                variant={orderType === 'dine_in' ? 'primary' : 'secondary'} 
                className="rounded-xl h-14 font-bold"
                onClick={() => setOrderType('dine_in')}
              >
                🍽️ DINE IN
              </Button>
              <Button 
                variant={orderType === 'takeaway' ? 'primary' : 'secondary'} 
                className="rounded-xl h-14 font-bold"
                onClick={() => setOrderType('takeaway')}
              >
                🛍️ TAKEAWAY
              </Button>
            </div>

            {orderType === 'dine_in' && (
              <div className="p-6 border-b border-border">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[10px] font-black text-muted uppercase tracking-widest">
                    {tableId ? "Selected Table" : "Assign Table"}
                  </h3>
                  {tableId && (
                    <button 
                      onClick={() => {
                        setTableId(null);
                        setTableNumber(null);
                      }}
                      className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline"
                    >
                      Transfer Table
                    </button>
                  )}
                </div>
                
                {tableId ? (
                  <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 p-3 rounded-xl">
                    <div className="w-10 h-10 rounded-lg bg-primary text-background flex items-center justify-center font-black">
                      {tableNumber}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Dine-in Order</p>
                      <p className="text-[10px] text-muted uppercase font-black tracking-widest">Connected to Table ID</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                    {/* Use real tables from reception store */}
                    {Array.isArray(useReceptionStore.getState().tables) && useReceptionStore.getState().tables.length > 0 ? (
                      useReceptionStore.getState().tables.map(table => (
                        <button 
                          key={table.id}
                          onClick={() => {
                            setTableNumber(table.table_number);
                            setTableId(table.id);
                          }}
                          className={cn(
                            "py-3 rounded-lg border text-sm font-bold transition-all flex flex-col items-center justify-center gap-1",
                            tableId === table.id ? "border-primary bg-primary text-background" : "border-border hover:border-primary/50 text-white",
                            table.status === 'occupied' ? "opacity-30 cursor-not-allowed grayscale" : "hover:scale-105"
                          )}
                          disabled={table.status === 'occupied'}
                        >
                          <span className="text-[10px] opacity-60">TABLE</span>
                          {table.table_number}
                        </button>
                      ))
                    ) : (
                      <p className="col-span-full text-center text-xs text-muted py-4 italic">No tables configured in system</p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex-grow overflow-y-auto p-6 custom-scrollbar">
              {groupedItems.length > 0 ? (
                <div className="space-y-4">
                  {groupedItems.map((group: any) => (
                    <div key={group.product_id} className="bg-background p-3 rounded-xl border border-border">
                      <p className="font-bold text-sm leading-tight mb-2">{group.name}</p>
                      <div className="space-y-2">
                        {group.variations.map((item: any) => (
                          <div key={item.cartItemId} className="flex justify-between items-center bg-surface p-2 rounded-lg border border-white/5">
                            <div className="flex-1">
                              <p className="text-primary font-black text-sm">{formatCurrency(item.price)}</p>
                              {(item.removedIngredients?.length > 0 || item.selectedAddons?.length > 0) ? (
                                <div className="mt-1">
                                  {item.removedIngredients?.map((ri: any) => (
                                    <p key={`rm-${ri.ingredient_id}`} className="text-[10px] text-red-400 font-bold">- No {ri.ingredient?.name}</p>
                                  ))}
                                  {item.selectedAddons?.map((sa: any) => (
                                    <p key={`add-${sa.ingredient_id}`} className="text-[10px] text-emerald-400 font-bold">+ Extra {sa.ingredient?.name}</p>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[10px] text-muted font-bold">Standard Prep</p>
                              )}

                              <div className="mt-2 pr-4">
                                <input 
                                  type="text" 
                                  placeholder="Kitchen note (e.g. Extra Spicy)"
                                  value={item.notes || ""}
                                  onChange={(e) => updateNotes(item.cartItemId, e.target.value)}
                                  className="w-full bg-black/30 border border-white/5 rounded-lg py-1.5 px-3 text-[10px] text-white placeholder:text-muted/30 focus:border-primary/50 transition-all outline-none"
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-2 bg-background p-1 rounded-md border border-border shrink-0">
                              <button 
                                onClick={() => updateQuantity(item.cartItemId!, item.quantity - 1)}
                                className="w-6 h-6 flex items-center justify-center hover:bg-white/5 rounded text-muted hover:text-white"
                              >
                                <Minus size={12} />
                              </button>
                              <span className="w-4 text-center font-bold text-xs">{item.quantity}</span>
                              <button 
                                onClick={() => updateQuantity(item.cartItemId!, item.quantity + 1)}
                                className="w-6 h-6 flex items-center justify-center hover:bg-white/5 rounded text-muted hover:text-white"
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted opacity-20">
                  <ShoppingCart size={64} className="mb-4" />
                  <p className="font-bold uppercase tracking-widest">Cart is empty</p>
                </div>
              )}
            </div>
          </>
        )}

        <div className="p-8 border-t border-border bg-black/20">
          <div className="flex justify-between items-center mb-6">
            <span className="text-muted font-bold text-xs uppercase tracking-widest">Grand Total</span>
            <span className="text-3xl font-black text-primary">{formatCurrency(getTotal())}</span>
          </div>
          
          {showPaymentView ? (
            <Button 
              onClick={() => handleCompleteOrder(true)}
              disabled={isSubmitting}
              className="w-full h-16 rounded-2xl text-xl font-black bg-emerald-600 hover:bg-emerald-500"
            >
              {isSubmitting ? <Loader2 className="animate-spin" /> : "COMPLETE PAYMENT"}
            </Button>
          ) : (
            <div className="flex gap-3">
              {editingOrder && editingOrder.id ? (
                <Button 
                  onClick={() => handleCompleteOrder(false)}
                  disabled={isSubmitting || items.length === 0}
                  variant="outline"
                  className="w-1/2 h-16 rounded-2xl text-sm font-black border-dashed"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" /> : "UPDATE ONLY"}
                </Button>
              ) : null}
              <Button 
                onClick={() => setShowPaymentView(true)}
                disabled={items.length === 0}
                className={cn("h-16 rounded-2xl text-xl font-black transition-all", (editingOrder && editingOrder.id) ? "w-1/2" : "w-full")}
              >
                CHECKOUT <ChevronRight size={20} className="ml-2" />
              </Button>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {customizingProduct && (
          <POSCustomizationOverlay 
            product={customizingProduct} 
            onClose={() => setCustomizingProduct(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function POSCustomizationOverlay({ product, onClose }: { product: Product, onClose: () => void }) {
  const { addItem } = useCartStore();
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [currentPrice, setCurrentPrice] = useState(product.price);

  const defaultIngredients = product.product_ingredients?.filter(i => i.role === 'default') || [];
  const addOns = product.product_ingredients?.filter(i => i.role === 'addon') || [];

  useEffect(() => {
    let price = product.price;
    extraIds.forEach(id => {
      const addon = addOns.find(a => a.ingredient_id === id);
      if (addon) price += (addon.price_adjustment || 0);
    });
    removedIds.forEach(id => {
      const standard = defaultIngredients.find(s => s.ingredient_id === id);
      if (standard) price -= (standard.removal_reduction || 0);
    });
    setCurrentPrice(price);
  }, [removedIds, extraIds, product.price, addOns, defaultIngredients]);

  const handleAddToOrder = () => {
    const customizedProduct = {
      ...product,
      price: currentPrice,
      name: product.name
    };
    const removedIngredients = defaultIngredients.filter(i => removedIds.includes(i.ingredient_id));
    const selectedAddons = addOns.filter(i => extraIds.includes(i.ingredient_id));
    addItem(customizedProduct, removedIngredients, selectedAddons);
    onClose();
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] bg-black/80 flex items-center justify-center p-8 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-surface w-full max-w-2xl rounded-[2rem] border border-border overflow-hidden"
      >
        <div className="p-6 border-b border-border flex justify-between items-center bg-white/5">
          <div>
            <h3 className="text-xl font-black uppercase tracking-tighter">Customize: {product.name}</h3>
            <p className="text-primary font-black text-sm">Base Price: {formatCurrency(product.price)}</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-white"><X size={24} /></button>
        </div>

        <div className="p-8 space-y-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {defaultIngredients.length === 0 && addOns.length === 0 && (
            <div className="py-20 text-center text-muted">
              <p className="font-bold uppercase tracking-widest opacity-30">No customizations available for this item</p>
            </div>
          )}

          {defaultIngredients.length > 0 && (
            <div>
              <h4 className="text-xs font-black text-muted uppercase tracking-[0.2em] mb-4">Standard Ingredients</h4>
              <div className="flex flex-wrap gap-3">
                {defaultIngredients.map(item => (
                  <button 
                    key={item.ingredient_id}
                    onClick={() => {
                      if (removedIds.includes(item.ingredient_id)) setRemovedIds(prev => prev.filter(id => id !== item.ingredient_id));
                      else setRemovedIds(prev => [...prev, item.ingredient_id]);
                    }}
                    className={cn(
                      "px-4 py-2 rounded-xl border text-sm font-bold transition-all",
                      removedIds.includes(item.ingredient_id) ? "border-red-500/50 bg-red-500/10 text-red-400 line-through" : "border-border bg-background text-white"
                    )}
                  >
                    {item.ingredient?.name}
                    {item.removal_reduction ? <span className="ml-2 opacity-50">(-{formatCurrency(item.removal_reduction)})</span> : null}
                  </button>
                ))}
              </div>
            </div>
          )}

          {addOns.length > 0 && (
            <div>
              <h4 className="text-xs font-black text-muted uppercase tracking-[0.2em] mb-4">Extra Paid Add-ons</h4>
              <div className="grid grid-cols-2 gap-3">
                {addOns.map(item => (
                  <button 
                    key={item.ingredient_id}
                    onClick={() => {
                      if (extraIds.includes(item.ingredient_id)) setExtraIds(prev => prev.filter(id => id !== item.ingredient_id));
                      else setExtraIds(prev => [...prev, item.ingredient_id]);
                    }}
                    className={cn(
                      "p-4 rounded-xl border text-sm font-bold flex justify-between items-center transition-all",
                      extraIds.includes(item.ingredient_id) ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-white"
                    )}
                  >
                    <span>{item.ingredient?.name}</span>
                    <span className="text-xs opacity-60">+{formatCurrency(item.price_adjustment || 0)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-8 border-t border-border bg-black/20 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-1">Total Adjusted Price</p>
            <p className="text-3xl font-black text-white">{formatCurrency(currentPrice)}</p>
          </div>
          <div className="flex gap-4">
            <Button variant="secondary" onClick={onClose} className="rounded-xl h-14 px-8">CANCEL</Button>
            <Button onClick={handleAddToOrder} className="rounded-xl h-14 px-12 font-black bg-primary text-background">ADD TO ORDER</Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
