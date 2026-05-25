"use client";

import { useState } from "react";
import { KitchenOrder } from "@/stores/useKitchenStore";
import { formatCurrency, cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { X, ArrowRight, ShoppingCart, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useReceptionStore } from "@/stores/useReceptionStore";

interface BillSplitModalProps {
  order: KitchenOrder;
  onClose: () => void;
  onSuccess: () => void;
}

export function BillSplitModal({ order, onClose, onSuccess }: BillSplitModalProps) {
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { fetchOrders } = useReceptionStore();

  const toggleItem = (itemId: string) => {
    setSelectedItemIds(prev => 
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  const selectedTotal = order.items
    .filter(item => selectedItemIds.includes(item.id))
    .reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);

  const handleSplit = async () => {
    if (selectedItemIds.length === 0) return;
    if (selectedItemIds.length === order.items.length) {
      alert("Cannot move all items to a new bill. Use payment instead.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create a new order with selected items
      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert({
          branch_id: order.branch_id,
          order_type: order.order_type,
          table_id: order.table_id,
          table_number: order.table_number,
          order_source: order.order_source,
          status: order.status,
          payment_status: 'unpaid',
          total: selectedTotal,
          order_number: `${order.order_number}-S`
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // 2. Move selected items to new order
      const { error: itemsError } = await supabase
        .from('order_items')
        .update({ order_id: newOrder.id })
        .in('id', selectedItemIds);

      if (itemsError) throw itemsError;

      // 3. Update original order total
      const newOriginalTotal = order.total - selectedTotal;
      const { error: updateError } = await supabase
        .from('orders')
        .update({ total: newOriginalTotal })
        .eq('id', order.id);

      if (updateError) throw updateError;

      await fetchOrders(order.branch_id);
      onSuccess();
    } catch (err: any) {
      alert(err.message || "Failed to split bill");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-6"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-surface border border-border rounded-[3rem] w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
      >
        <div className="p-8 border-b border-border bg-white/5 flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Split Bill by Items</h2>
            <p className="text-xs text-muted font-bold uppercase tracking-widest mt-1">
              Order <span className="text-primary">#{order.order_number}</span> • Total {formatCurrency(order.total)}
            </p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-white"><X size={24}/></button>
        </div>

        <div className="flex-grow overflow-hidden flex">
          {/* Left: Original Bill */}
          <div className="flex-1 flex flex-col p-8 border-r border-border">
            <h3 className="text-[10px] font-black text-muted uppercase tracking-widest mb-6">Select items to move</h3>
            <div className="flex-grow overflow-y-auto pr-4 custom-scrollbar space-y-4">
              {order.items.map(item => (
                <button 
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  className={cn(
                    "w-full text-left p-4 rounded-2xl border transition-all flex justify-between items-center",
                    selectedItemIds.includes(item.id) 
                      ? "bg-primary/10 border-primary text-primary" 
                      : "bg-background border-border text-white hover:border-primary/50"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center font-black",
                      selectedItemIds.includes(item.id) ? "bg-primary text-background" : "bg-surface-lighter text-muted"
                    )}>
                      {item.quantity}x
                    </div>
                    <div>
                      <p className="font-bold text-sm">{item.product_name}</p>
                      <p className="text-[10px] opacity-60 uppercase font-black">{formatCurrency(item.unit_price)} per item</p>
                    </div>
                  </div>
                  <p className="font-black">{formatCurrency(item.unit_price * item.quantity)}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Right: New Bill Preview */}
          <div className="w-[350px] bg-black/20 p-8 flex flex-col">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                <ShoppingCart size={20} />
              </div>
              <h3 className="text-xl font-black text-white uppercase tracking-tighter">New Bill</h3>
            </div>

            <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar space-y-3 mb-8">
              {order.items.filter(i => selectedItemIds.includes(i.id)).map(item => (
                <div key={item.id} className="flex justify-between items-center text-xs animate-in slide-in-from-right-4">
                  <span className="text-muted">{item.quantity}x {item.product_name}</span>
                  <span className="font-black text-white">{formatCurrency(item.unit_price * item.quantity)}</span>
                </div>
              ))}
              {selectedItemIds.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-muted opacity-20 py-20">
                  <ArrowRight size={40} className="mb-4" />
                  <p className="text-[10px] font-black uppercase">Select items</p>
                </div>
              )}
            </div>

            <div className="mt-auto space-y-6">
              <div className="flex justify-between items-center pt-6 border-t border-white/5">
                <span className="text-[10px] font-black text-muted uppercase tracking-widest">Selected Total</span>
                <span className="text-2xl font-black text-primary">{formatCurrency(selectedTotal)}</span>
              </div>

              <Button 
                onClick={handleSplit}
                disabled={selectedItemIds.length === 0 || isSubmitting}
                className="w-full h-16 rounded-2xl text-lg font-black bg-primary text-background shadow-xl shadow-primary/20"
              >
                {isSubmitting ? <Loader2 className="animate-spin" /> : "SPLIT OFF TO NEW BILL"}
              </Button>
              <p className="text-[10px] text-muted text-center font-bold uppercase tracking-widest">
                This will create a second unpaid order
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
