"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useCartStore } from "@/stores/cartStore";
import { useMenuStore } from "@/stores/menuStore";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { formatCurrency, cn } from "@/lib/utils";
import { ArrowLeft, CreditCard, Banknote, Loader2, CheckCircle2, Trash2, Minus, Plus } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

export default function CheckoutPage() {
  const router = useRouter();
  const { items, getTotal, clearCart, orderType, tableNumber, updateQuantity, removeItem, addItem } = useCartStore();
  const { categories, products: menuProducts } = useMenuStore();
  
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'idle' | 'processing' | 'success'>('idle');
  const [orderSuccess, setOrderSuccess] = useState<{ id: string, number: string } | null>(null);
  const [showUpsell,  setShowUpsell]  = useState(false);
  const [upsellDone,  setUpsellDone]  = useState(false);
  const [selectedBev, setSelectedBev] = useState<any>(null);

  const groupedItems = Object.values(items.reduce((acc, item) => {
    if (!acc[item.id]) {
      acc[item.id] = {
        product_id: item.id,
        name: item.name,
        image_url: item.image_url,
        variations: []
      };
    }
    acc[item.id].variations.push(item);
    return acc;
  }, {} as Record<string, any>));

  const handlePlaceOrder = async () => {
    if (items.length === 0 || !orderType) return;
    
    setIsSubmitting(true);
    try {
      const { getActiveBranchId } = await import("@/lib/supabase");
      const branchId = await getActiveBranchId();

      if (!branchId) throw new Error("Branch not found. Please set a branch in settings.");

      // Prepare items for RPC
      const rpcItems = items.map(item => ({
        product_id: item.id,
        product_name: item.name,
        price: item.price,
        quantity: item.quantity,
        customisations: [
          ...(item.removedIngredients || []).map(ri => ({
            ingredient_id: ri.ingredient_id,
            ingredient_name: ri.ingredient.name,
            action: 'removed'
          })),
          ...(item.selectedAddons || []).map(sa => ({
            ingredient_id: sa.ingredient_id,
            ingredient_name: sa.ingredient.name,
            action: 'added'
          }))
        ]
      }));

      // Call Atomic RPC
      const { data: order, error: rpcError } = await supabase.rpc('place_kiosk_order', {
        p_branch_id: branchId,
        p_order_type: orderType,
        p_table_number: tableNumber,
        p_payment_method: paymentMethod,
        p_payment_status: paymentMethod === 'card' ? 'paid' : 'unpaid',
        p_total: getTotal(),
        p_items: rpcItems
      });

      if (rpcError) throw rpcError;

      setOrderSuccess({ id: order.id, number: order.order_number });
      clearCart();
      
    } catch (error: any) {
      console.error("Checkout Error:", error);
      alert("Order failed: " + (error.message || "Unknown error occurred"));
    } finally {
      setIsSubmitting(false);
      setPaymentStep('idle');
    }
  };

  const handleConfirmOrder = async () => {
    if (items.length === 0 || !orderType) return;
    
    if (paymentMethod === 'card') {
      setPaymentStep('processing');
      setTimeout(() => {
        setPaymentStep('success');
        setTimeout(() => {
          handlePlaceOrder();
        }, 1500);
      }, 2500);
    } else {
      handlePlaceOrder();
    }
  };

  // ── Beverage upsell ──────────────────────────────────────────────────
  const BEV_RE = /drink|beverage|juice|soda|cola|water|shake|tea|coffee|smoothie/i;
  const beverageCat      = categories.find(c => BEV_RE.test(c.name));
  const beverageProducts = beverageCat
    ? menuProducts.filter(p => p.category_id === beverageCat.id && p.status === 'available').slice(0, 6)
    : [];
  const hasBevInCart = items.some(i => beverageProducts.some(b => b.id === i.id));
  const shouldUpsell = beverageProducts.length > 0 && !hasBevInCart;

  const handleInitiate = () => {
    if (items.length === 0 || !orderType) return;
    if (shouldUpsell && !upsellDone) { setShowUpsell(true); return; }
    handleConfirmOrder();
  };

  const handleUpsellConfirm = () => {
    if (selectedBev) addItem(selectedBev, [], []);
    setShowUpsell(false);
    setUpsellDone(true);
    handleConfirmOrder();
  };
  // ─────────────────────────────────────────────────────────────────────

  if (orderSuccess) {
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-surface p-12 rounded-[3rem] border border-primary/20 shadow-2xl max-w-xl w-full"
        >
          <CheckCircle2 className="w-24 h-24 text-primary mx-auto mb-8" />
          <h1 className="text-5xl font-black text-white uppercase mb-2">Order Placed!</h1>
          <p className="text-muted text-lg mb-10">Your delicious meal is being prepared.</p>
          
          <div className="bg-background/50 p-10 rounded-[2.5rem] border border-border mb-10 shadow-inner">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted mb-4">Order Number</p>
            <p className="text-8xl font-black text-primary tracking-tighter">#{orderSuccess.number}</p>
          </div>

          <p className="text-sm font-bold text-muted uppercase tracking-widest mb-12 px-8 leading-relaxed">
            Please watch the <span className="text-primary">Order Status Screen</span> <br/> 
            to know when your meal is ready for collection.
          </p>

          <Button 
            onClick={() => router.push('/kiosk')} 
            size="xl" 
            variant="primary"
            className="w-full rounded-[2rem] py-10 text-2xl font-black shadow-xl shadow-primary/20"
          >
            START NEW ORDER
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden relative">
      {/* Mock Payment Overlay */}
      <AnimatePresence>
        {paymentStep !== 'idle' && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center text-center"
          >
            {paymentStep === 'processing' ? (
              <motion.div 
                initial={{ scale: 0.8 }} 
                animate={{ scale: 1 }}
                className="flex flex-col items-center"
              >
                <div className="w-24 h-24 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-8" />
                <h2 className="text-4xl font-black text-white mb-4">Processing Payment</h2>
                <p className="text-muted text-xl">Please tap or insert your card into the terminal.</p>
              </motion.div>
            ) : (
              <motion.div 
                initial={{ scale: 0.8 }} 
                animate={{ scale: 1 }}
                className="flex flex-col items-center text-primary"
              >
                <CheckCircle2 className="w-32 h-32 mb-8" />
                <h2 className="text-5xl font-black mb-4">Payment Successful</h2>
                <p className="text-white/80 text-xl">Confirming your order...</p>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Beverage Upsell Overlay */}
      <AnimatePresence>
        {showUpsell && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-xl flex items-center justify-center p-8"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
              className="bg-[#161618] border border-white/10 rounded-[3rem] p-12 max-w-2xl w-full"
            >
              <h2 className="text-4xl font-black text-white uppercase tracking-tighter mb-2">Add a Drink?</h2>
              <p className="text-muted text-xs font-black uppercase tracking-widest mb-10">Complete your meal with a refreshing beverage</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-10">
                {beverageProducts.map(bev => (
                  <button
                    key={bev.id}
                    onClick={() => setSelectedBev((p: any) => p?.id === bev.id ? null : bev)}
                    className={cn(
                      'p-4 rounded-2xl border-2 text-left transition-all',
                      selectedBev?.id === bev.id ? 'border-primary bg-primary/10' : 'border-white/10 bg-white/5 hover:border-white/30'
                    )}
                  >
                    <div className="relative h-20 rounded-xl overflow-hidden mb-3">
                      <Image src={bev.image_url || '/placeholder-food.jpg'} alt={bev.name} fill className="object-cover" />
                    </div>
                    <p className="font-black text-white text-sm truncate">{bev.name}</p>
                    <p className="text-primary font-black text-xs mt-1">{formatCurrency(bev.price)}</p>
                  </button>
                ))}
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => { setShowUpsell(false); setUpsellDone(true); handleConfirmOrder(); }}
                  className="flex-1 h-14 rounded-2xl border border-white/10 text-white font-black uppercase text-xs tracking-widest hover:bg-white/5 transition-all"
                >
                  No Thanks
                </button>
                <Button onClick={handleUpsellConfirm} className="flex-1 h-14 rounded-2xl bg-primary text-black font-black uppercase text-sm tracking-widest shadow-xl shadow-primary/20">
                  {selectedBev ? 'Add & Continue' : 'Skip & Continue'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="p-6 flex items-center justify-between glass z-50">
        <div className="flex items-center gap-6">
          <Link href="/kiosk">
            <Button variant="secondary" className="rounded-2xl w-14 h-14 p-0">
              <ArrowLeft size={24} />
            </Button>
          </Link>
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter">Checkout</h1>
        </div>
        <div className="flex gap-4">
          {tableNumber && (
            <div className="bg-primary px-6 py-2 rounded-2xl border border-primary/20">
              <span className="text-background font-black uppercase tracking-widest text-sm">
                Table {tableNumber.replace('T', '')}
              </span>
            </div>
          )}
          <div className="bg-primary/10 px-6 py-2 rounded-2xl border border-primary/20">
             <span className="text-primary font-black uppercase tracking-widest text-sm">
               {orderType === 'dine_in' ? '🍽️ Dine In' : '🛍️ Takeaway'}
             </span>
          </div>
        </div>

      </header>

      <div className="flex flex-grow overflow-hidden">
        {/* Left: Order Items List */}
        <main className="flex-grow overflow-y-auto p-12 custom-scrollbar">
          <div className="max-w-3xl mx-auto space-y-6">
            <h2 className="text-sm font-black uppercase tracking-[0.3em] text-muted mb-8">Items In Cart</h2>
            {groupedItems.map((group: any) => (
              <Card key={group.product_id} className="glass-lighter border-none overflow-visible mb-6">
                <CardContent className="p-6">
                  <div className="flex items-center gap-6 mb-4">
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-border shrink-0">
                      <Image src={group.image_url || "/placeholder-food.jpg"} alt={group.name} fill className="object-cover" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-white tracking-tighter uppercase">{group.name}</h3>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    {group.variations.map((item: any) => (
                      <div key={item.cartItemId} className="flex justify-between items-center bg-black/20 p-4 rounded-xl border border-white/5">
                        <div className="flex-1">
                          <p className="text-lg font-black text-primary mb-1">{formatCurrency(item.price)}</p>
                          {(item.removedIngredients?.length > 0 || item.selectedAddons?.length > 0) ? (
                            <div className="flex flex-wrap gap-2">
                              {item.removedIngredients?.map((ri: any) => (
                                <span key={`rm-${ri.ingredient_id}`} className="px-2 py-1 bg-red-500/10 text-red-400 text-[10px] font-black uppercase rounded-md border border-red-500/20">
                                  - No {ri.ingredient?.name}
                                </span>
                              ))}
                              {item.selectedAddons?.map((sa: any) => (
                                <span key={`add-${sa.ingredient_id}`} className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase rounded-md border border-emerald-500/20">
                                  + Extra {sa.ingredient?.name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[10px] text-muted uppercase font-bold tracking-widest">Standard Prep</p>
                          )}
                        </div>

                        <div className="flex items-center gap-4 ml-4">
                          <button 
                            onClick={() => removeItem(item.cartItemId!)} 
                            className="w-10 h-10 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center border border-red-500/20 hover:bg-red-500 hover:text-white transition-all shrink-0"
                          >
                            <Trash2 size={18} />
                          </button>
                          
                          <div className="flex items-center gap-2 bg-background/50 p-1 rounded-xl border border-border shrink-0">
                            <button 
                              onClick={() => updateQuantity(item.cartItemId!, item.quantity - 1)}
                              className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-muted hover:text-white transition-colors"
                            >
                              <Minus size={14} />
                            </button>
                            <span className="w-8 text-center text-lg font-black text-white">{item.quantity}</span>
                            <button 
                              onClick={() => updateQuantity(item.cartItemId!, item.quantity + 1)}
                              className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-muted hover:text-white transition-colors"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </main>

        {/* Right: Checkout Sidebar */}
        <aside className="w-[450px] bg-surface p-12 border-l border-border flex flex-col">
          <div className="flex-grow space-y-12">
            {/* Payment Method */}
            <section>
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-muted mb-6">Payment Method</h3>
              <div className="flex flex-col gap-4">
                <button 
                  onClick={() => setPaymentMethod('cash')}
                  className={cn(
                    "flex items-center gap-6 p-6 rounded-3xl border-2 transition-all text-left",
                    paymentMethod === 'cash' ? "border-primary bg-primary/10 text-primary" : "border-border text-muted"
                  )}
                >
                  <Banknote size={28} />
                  <div>
                    <p className="font-bold text-lg">Pay at Counter (Cash)</p>
                    <p className="text-xs opacity-60">Complete payment at the receptionist desk</p>
                  </div>
                </button>
                <button 
                  onClick={() => setPaymentMethod('card')}
                  className={cn(
                    "flex items-center gap-6 p-6 rounded-3xl border-2 transition-all text-left",
                    paymentMethod === 'card' ? "border-primary bg-primary/10 text-primary" : "border-border text-muted"
                  )}
                >
                  <CreditCard size={28} />
                  <div>
                    <p className="font-bold text-lg">Online / Card Payment</p>
                    <p className="text-xs opacity-60">Securely pay with your credit/debit card</p>
                  </div>
                </button>
              </div>
            </section>
          </div>

          {/* Final Total & Place Order */}
          <div className="pt-12 border-t border-border mt-auto">
            <div className="flex items-center justify-between mb-8">
              <span className="text-muted font-bold uppercase tracking-widest text-xs">Final Amount</span>
              <span className="text-4xl font-black text-white">{formatCurrency(getTotal())}</span>
            </div>
            <Button 
              onClick={handleInitiate}
              disabled={isSubmitting || items.length === 0 || paymentStep !== 'idle' || showUpsell}
              size="xl" 
              className="w-full rounded-[2rem] py-8 text-2xl font-black shadow-2xl"
            >
              {isSubmitting ? <Loader2 className="animate-spin" /> : "CONFIRM ORDER"}
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
