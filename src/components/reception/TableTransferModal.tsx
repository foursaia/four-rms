"use client";

import { useState } from "react";
import { KitchenOrder } from "@/stores/useKitchenStore";
import { RestaurantTable, useReceptionStore } from "@/stores/useReceptionStore";
import { Button } from "@/components/ui/Button";
import { X, Utensils, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface TableTransferModalProps {
  order: KitchenOrder;
  tables: RestaurantTable[];
  onClose: () => void;
  onSuccess: () => void;
}

export function TableTransferModal({ order, tables, onClose, onSuccess }: TableTransferModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { transferOrder } = useReceptionStore();

  const handleTransfer = async (toTableId: string) => {
    setIsSubmitting(true);
    try {
      await transferOrder(order.id, order.table_id || null, toTableId);
      onSuccess();
    } catch (err: any) {
      alert("Transfer failed: " + err.message);
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
        className="bg-surface border border-border rounded-[3rem] p-12 max-w-2xl w-full shadow-2xl"
      >
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Transfer Table</h2>
            <p className="text-xs text-muted font-bold uppercase tracking-widest mt-1">
              Move Order <span className="text-primary">#{order.order_number}</span> from Table {order.table_number || "POS"}
            </p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-white"><X size={24}/></button>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar p-1">
          {tables.filter(t => t.status === 'available').map(table => (
            <button 
              key={table.id}
              disabled={isSubmitting}
              onClick={() => handleTransfer(table.id)}
              className="py-6 rounded-2xl border-2 border-border hover:border-primary/50 bg-background text-white transition-all flex flex-col items-center justify-center gap-2 group disabled:opacity-50"
            >
              <Utensils size={20} className="text-muted group-hover:text-primary transition-colors" />
              <span className="text-2xl font-black">{table.table_number}</span>
            </button>
          ))}
          {tables.filter(t => t.status === 'available').length === 0 && (
            <div className="col-span-full text-center py-20 bg-background/50 rounded-3xl border border-dashed border-border">
              <p className="text-xs font-bold text-muted uppercase tracking-widest">No available tables</p>
            </div>
          )}
        </div>

        <div className="mt-10 flex gap-4">
          <Button variant="secondary" onClick={onClose} className="flex-1 h-16 rounded-2xl font-black">CANCEL</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
