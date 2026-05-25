"use client";

import { useEffect, useState } from "react";
import { useKitchenStore } from "@/stores/useKitchenStore";
import { supabase } from "@/lib/supabase";
import { playChime } from "@/lib/audio";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, CheckCircle2, UtensilsCrossed, BellRing } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export default function PublicDisplayPage() {
  const { orders, fetchLiveOrders, subscribeToOrders } = useKitchenStore();
  const [time, setTime] = useState<string>("--:--");
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [branchName, setBranchName] = useState("RestroSync");
  




  useEffect(() => {
    // Update time only on client side to avoid hydration mismatch
    const updateClock = () => {
      setTime(new Date().toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: 'Asia/Karachi'
      }));
    };
    
    updateClock();
    const timer = setInterval(updateClock, 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let unsubscribe: () => void;
    const init = async () => {
      const { data: branches } = await supabase.from('branches').select('id, name').limit(1);
      if (branches?.[0]) {
        if (branches[0].name) setBranchName(branches[0].name);
        fetchLiveOrders(branches[0].id);
        unsubscribe = subscribeToOrders(branches[0].id, {
          onReady: () => playChime()
        });
      }
    };
    init();
    return () => unsubscribe?.();
  }, [fetchLiveOrders, subscribeToOrders]);


  // Filter orders for display
  const preparingOrders = orders.filter(o => o.status === 'preparing' || o.status === 'confirmed');
  const readyOrders = orders.filter(o => o.status === 'ready');

  return (
    <div className="min-h-screen bg-black text-white flex flex-col overflow-hidden font-sans">
      {/* Audio Enable Overlay */}
      <AnimatePresence>
        {!audioEnabled && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-zinc-900 border border-white/10 p-12 rounded-[3rem] shadow-2xl max-w-lg"
            >
              <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center text-primary mx-auto mb-8 border border-primary/20">
                <BellRing size={48} className="animate-bounce" />
              </div>
              <h2 className="text-4xl font-black text-white uppercase tracking-tighter mb-4">Enable Audio Alerts</h2>
              <p className="text-muted font-bold uppercase tracking-widest text-xs mb-10">Click below to enable sound notifications for ready orders.</p>
              
              <Button 
                onClick={() => { setAudioEnabled(true); }}
                className="w-full h-20 rounded-2xl text-2xl font-black bg-primary text-black"
              >
                START DISPLAY
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Top Header / Branding */}
      <header className="p-8 border-b border-white/10 flex justify-between items-center bg-zinc-900/50 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center">
            <UtensilsCrossed className="text-black" size={32} />
          </div>
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tighter">{branchName}</h1>
            <p className="text-primary font-bold tracking-widest text-sm uppercase">Order Status Board</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-5xl font-black text-white tabular-nums">
            {time}
          </p>
        </div>
      </header>

      {/* Main Display Grid */}
      <main className="flex-grow flex divide-x divide-white/10">
        
        {/* PREPARING COLUMN */}
        <section className="flex-1 flex flex-col p-8 bg-zinc-950">
          <div className="flex-grow flex flex-col">
            <div className="flex items-center gap-4 mb-12 border-l-8 border-blue-500 pl-6 py-2">
              <div className="w-14 h-14 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500">
                <Clock size={32} className="animate-pulse" />
              </div>
              <h2 className="text-6xl font-black uppercase tracking-tighter text-blue-500">Preparing</h2>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence mode="popLayout">
                {preparingOrders.map((order) => (
                  <motion.div
                    layout
                    key={order.id}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 1.1, opacity: 0 }}
                    className="bg-zinc-900 border border-white/5 rounded-[2rem] p-8 flex flex-col items-center justify-center shadow-2xl relative overflow-hidden group"
                  >
                    <div className="absolute top-0 left-0 w-full h-1 bg-blue-500/50" />
                    <span className="text-7xl font-black tracking-tighter text-white group-hover:scale-110 transition-transform">
                      {order.order_number}
                    </span>
                    <p className="text-blue-500 font-bold mt-4 tracking-widest uppercase text-xs">Cooking Now</p>
                  </motion.div>
                ))}
              </AnimatePresence>
              {preparingOrders.length === 0 && (
                <p className="text-white/10 text-2xl font-bold uppercase tracking-widest col-span-full text-center py-20">No active orders</p>
              )}
            </div>
          </div>


        </section>

        {/* READY COLUMN */}
        <section className="flex-1 flex flex-col p-8 bg-zinc-900/30">
          <div className="flex items-center gap-4 mb-12 border-l-8 border-emerald-500 pl-6 py-2">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
              <BellRing size={32} className="animate-bounce" />
            </div>
            <h2 className="text-6xl font-black uppercase tracking-tighter text-emerald-500">Ready</h2>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {readyOrders.map((order) => (
                <motion.div
                  layout
                  key={order.id}
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ scale: 1.2, opacity: 0 }}
                  className="bg-emerald-500 rounded-[2rem] p-8 flex flex-col items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.3)] relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-50" />
                  <span className="text-8xl font-black tracking-tighter text-black relative z-10">
                    {order.order_number}
                  </span>
                  <p className="text-black/60 font-black mt-2 tracking-widest uppercase text-xs relative z-10">Please Collect</p>
                </motion.div>
              ))}
            </AnimatePresence>
            {readyOrders.length === 0 && (
              <p className="text-white/10 text-2xl font-bold uppercase tracking-widest col-span-full text-center py-20">Waiting for kitchen...</p>
            )}
          </div>
        </section>
      </main>

      {/* Footer / Scrolling Ticker (Optional) */}
      <footer className="p-6 bg-primary text-black flex justify-between items-center font-black uppercase tracking-widest overflow-hidden">
        <div className="flex gap-12 whitespace-nowrap animate-marquee">
          <span>★ Delicious Food Awaits</span>
          <span>★ Fresh Ingredients Only</span>
          <span>★ Fast Service Guaranteed</span>
          <span>★ Thank you for choosing us!</span>
          <span>★ Rate us on Google</span>
        </div>
      </footer>

      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          display: inline-flex;
          animation: marquee 20s linear infinite;
        }
      `}</style>
    </div>
  );
}
