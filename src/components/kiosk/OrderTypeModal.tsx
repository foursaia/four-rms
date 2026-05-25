"use client";

import { motion } from "framer-motion";
import { Utensils, ShoppingBag } from "lucide-react";
import { useCartStore } from "@/stores/cartStore";

interface OrderTypeModalProps {
  onClose: () => void;
}

export function OrderTypeModal({ onClose }: OrderTypeModalProps) {

  const { setOrderType, setTableNumber } = useCartStore();

  const handleSelectType = (type: 'dine_in' | 'takeaway') => {
    setOrderType(type);
    setTableNumber(null); // Table assignment will be done by staff later
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-6 backdrop-blur-xl">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-surface w-full max-w-4xl rounded-[4rem] border border-white/10 p-12 text-center shadow-2xl"
      >
        <h2 className="text-5xl font-black text-white uppercase tracking-tighter mb-12 italic">How would you like to eat?</h2>
        
        <div className="grid grid-cols-2 gap-8">
          <button 
            onClick={() => handleSelectType('dine_in')}
            className="group relative bg-background/50 hover:bg-primary border-2 border-border hover:border-primary p-12 rounded-[3rem] transition-all duration-500 overflow-hidden"
          >
            <div className="relative z-10">
              <div className="w-24 h-24 rounded-full bg-primary/10 group-hover:bg-background/20 flex items-center justify-center text-primary group-hover:text-white mx-auto mb-6 transition-colors shadow-xl">
                <Utensils size={48} />
              </div>
              <p className="text-3xl font-black text-white uppercase tracking-tight">Eat In</p>
              <p className="text-muted group-hover:text-white/60 font-bold uppercase tracking-widest text-xs mt-2 transition-colors">Enjoy at our table</p>
            </div>
          </button>

          <button 
            onClick={() => handleSelectType('takeaway')}
            className="group relative bg-background/50 hover:bg-primary border-2 border-border hover:border-primary p-12 rounded-[3rem] transition-all duration-500 overflow-hidden"
          >
            <div className="relative z-10">
              <div className="w-24 h-24 rounded-full bg-primary/10 group-hover:bg-background/20 flex items-center justify-center text-primary group-hover:text-white mx-auto mb-6 transition-colors shadow-xl">
                <ShoppingBag size={48} />
              </div>
              <p className="text-3xl font-black text-white uppercase tracking-tight">Takeaway</p>
              <p className="text-muted group-hover:text-white/60 font-bold uppercase tracking-widest text-xs mt-2 transition-colors">Pack for later</p>
            </div>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
