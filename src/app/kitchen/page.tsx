"use client";

import { useEffect, useState } from "react";
import { useKitchenStore, KitchenOrder } from "@/stores/useKitchenStore";
import { supabase, getActiveBranchId } from "@/lib/supabase";
import { formatRelativeTime } from "@/lib/time";
import { playChime, playUrgentAlert, playLateAlert } from "@/lib/audio";
import { Loader2, ChefHat, CheckCircle2, Clock, Utensils, ShoppingBag, Edit3, Maximize2, Minimize2, Package, Filter, X } from "lucide-react";
import { useMenuStore } from "@/stores/menuStore";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export default function KitchenPage() {
  const { 
    orders, 
    recentOrders, 
    isLoading, 
    fetchLiveOrders, 
    fetchRecentOrders, 
    updateOrderStatus, 
    subscribeToOrders 
  } = useKitchenStore();
  const [showRecent, setShowRecent] = useState(false);
  const [orderFilter, setOrderFilter] = useState<'all' | 'dine_in' | 'takeaway' | 'delivery'>('all');
  const [showStockPanel, setShowStockPanel] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { products, updateProductStatus, fetchMenu } = useMenuStore();

  useEffect(() => {
    let unsubscribe: () => void;
    
    const init = async () => {
      const branchId = await getActiveBranchId();
      if (branchId) {
        fetchLiveOrders(branchId);
        fetchRecentOrders(branchId);
        unsubscribe = subscribeToOrders(branchId, {
          onNewOrder: () => playChime()
        });
      }
    };

    init();
    return () => unsubscribe?.();
  }, [fetchLiveOrders, fetchRecentOrders, subscribeToOrders]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  };

  // Urgency Alert Loop
  useEffect(() => {
    const checkUrgency = () => {
      const activeOrders = orders.filter(o => o.status === 'confirmed' || o.status === 'preparing');
      if (activeOrders.length === 0) return;

      const now = new Date().getTime();
      let hasLate = false;
      let hasUrgent = false;

      activeOrders.forEach(order => {
        const ageInMinutes = (now - new Date(order.created_at).getTime()) / 60000;
        if (ageInMinutes >= 20) hasLate = true;
        else if (ageInMinutes >= 10) hasUrgent = true;
      });

      if (hasLate) playLateAlert();
      else if (hasUrgent) playUrgentAlert();
    };

    const interval = setInterval(checkUrgency, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [orders]);

  const filteredOrders = orderFilter === 'all' ? orders : orders.filter(o => (o as any).order_type === orderFilter);
  const activeProductIds = [...new Set(orders.flatMap(o => o.items.map(i => i.product_id)))];
  const stockProducts = products.filter(p => activeProductIds.includes(p.id));

  if (isLoading && orders.length === 0) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-background">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="text-muted text-lg">Initializing Kitchen System...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col overflow-hidden relative">
      {/* Header */}
      <header className="p-6 flex justify-between items-center glass border-b border-white/5 z-50 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center border border-primary/30">
            <ChefHat className="text-primary" size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Kitchen Dashboard</h1>
            <p className="text-[10px] text-muted font-bold uppercase tracking-widest">Real-time Order Monitoring</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <Button onClick={() => setShowRecent(!showRecent)} variant="secondary" className="rounded-xl h-12 gap-2 border-white/10">
            <Clock size={18} />
            RECALL
          </Button>

          <Button onClick={() => setShowStockPanel(true)} variant="secondary" className="rounded-xl h-12 gap-2 border-white/10">
            <Package size={18} />
            STOCK
          </Button>

          <Button
            onClick={toggleFullscreen}
            variant="secondary"
            className={cn("rounded-xl h-12 gap-2 border-white/10", isFullscreen && "border-primary/30 text-primary")}
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            {isFullscreen ? 'EXIT' : 'FULLSCREEN'}
          </Button>

          <div className="h-10 w-px bg-white/10" />

          <div className="text-center px-6 py-2 rounded-2xl bg-surface-lighter border border-border">
            <p className="text-[10px] text-muted font-bold uppercase tracking-widest">Active Orders</p>
            <p className="text-xl font-black text-white">{orders.filter(o => o.status !== 'ready').length}</p>
          </div>
          <div className="text-center px-6 py-2 rounded-2xl bg-primary/10 border border-primary/20">
            <p className="text-[10px] text-primary font-bold uppercase tracking-widest">Ready to Serve</p>
            <p className="text-xl font-black text-primary">{orders.filter(o => o.status === 'ready').length}</p>
          </div>
        </div>
      </header>

      {/* Recently Served Overlay/Panel */}
      <AnimatePresence>
        {showRecent && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRecent(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="absolute top-0 right-0 h-full w-[450px] bg-surface border-l border-white/10 z-[70] p-8 shadow-2xl overflow-y-auto custom-scrollbar"
            >
              <div className="flex justify-between items-center mb-10">
                <div>
                  <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Recently Served</h2>
                  <p className="text-[10px] text-muted font-bold uppercase tracking-widest">Last 10 completed orders</p>
                </div>
                <Button variant="ghost" onClick={() => setShowRecent(false)} className="rounded-full w-12 h-12">✕</Button>
              </div>

              <div className="space-y-6">
                {recentOrders.map(order => (
                  <div key={order.id} className="p-6 rounded-[2rem] bg-white/[0.03] border border-white/5 flex justify-between items-center group hover:bg-white/[0.05] transition-all">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-2xl font-black text-white">#{order.order_number}</span>
                        <span className="text-[10px] font-bold text-muted uppercase tracking-widest">
                          {formatRelativeTime(order.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-muted truncate w-48">
                        {order.items.map(i => `${i.quantity}x ${i.product_name}`).join(', ')}
                      </p>
                    </div>
                    <Button 
                      onClick={() => {
                        updateOrderStatus(order.id, 'preparing');
                        setShowRecent(false);
                      }}
                      className="rounded-xl h-12 px-6 font-black text-xs"
                      variant="secondary"
                    >
                      UNDO
                    </Button>
                  </div>
                ))}
                {recentOrders.length === 0 && (
                  <div className="text-center py-20 text-muted">
                    <p className="font-bold uppercase tracking-widest text-xs">No recently served orders</p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Item Stock Panel */}
      <AnimatePresence>
        {showStockPanel && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowStockPanel(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[60]" />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="absolute top-0 right-0 h-full w-[400px] bg-surface border-l border-white/10 z-[70] p-8 shadow-2xl overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Item Availability</h2>
                  <p className="text-[10px] text-muted font-bold uppercase tracking-widest mt-1">Toggle items from active orders</p>
                </div>
                <Button variant="ghost" onClick={() => setShowStockPanel(false)} className="rounded-full w-12 h-12"><X size={20} /></Button>
              </div>
              <div className="space-y-3">
                {stockProducts.length === 0 ? (
                  <div className="text-center py-16 opacity-30"><Package size={40} className="mx-auto mb-4" /><p className="text-xs font-black uppercase tracking-widest">No items in active orders</p></div>
                ) : stockProducts.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-5 rounded-2xl bg-white/5 border border-white/5">
                    <p className="font-black text-white uppercase tracking-tight">{p.name}</p>
                    <button
                      onClick={() => updateProductStatus(p.id, p.status === 'available' ? 'out_of_stock' : 'available')}
                      className={cn('px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border',
                        p.status === 'out_of_stock'
                          ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-400'
                          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400'
                      )}
                    >
                      {p.status === 'out_of_stock' ? '⚠ Out of Stock' : '✓ Available'}
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Prep Summary Bar */}
      <div className="bg-surface-lighter/50 border-b border-white/5 p-3 overflow-x-auto no-scrollbar flex gap-4 items-center px-8">
        <span className="text-[10px] font-black text-muted uppercase tracking-widest shrink-0 border-r border-white/10 pr-4">Prep Summary</span>
        <div className="flex gap-4">
          {Object.entries(orders
            .filter(o => o.status === 'confirmed' || o.status === 'preparing')
            .reduce((acc, order) => {
              order.items.forEach(item => {
                acc[item.product_name] = (acc[item.product_name] || 0) + item.quantity;
              });
              return acc;
            }, {} as Record<string, number>)
          ).map(([name, qty]) => (
            <div key={name} className="flex items-center gap-2 bg-white/5 px-4 py-1.5 rounded-xl border border-white/5">
              <span className="text-primary font-black text-sm">{qty}</span>
              <span className="text-white font-bold text-xs whitespace-nowrap">{name}</span>
            </div>
          ))}
          {orders.filter(o => o.status === 'confirmed' || o.status === 'preparing').length === 0 && (
            <span className="text-[10px] text-muted font-bold uppercase italic">No active prep needed</span>
          )}
        </div>
      </div>

      {/* KDS Filter Bar */}
      <div className="bg-[#050505] border-b border-white/5 px-8 py-3 flex items-center gap-3 shrink-0">
        <Filter size={12} className="text-muted shrink-0" />
        <span className="text-[10px] font-black text-muted uppercase tracking-widest shrink-0 border-r border-white/10 pr-4">Filter</span>
        {(['all', 'dine_in', 'takeaway', 'delivery'] as const).map(f => (
          <button key={f} onClick={() => setOrderFilter(f)}
            className={cn('px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
              orderFilter === f ? 'bg-primary text-black shadow-lg shadow-primary/20' : 'text-muted hover:text-white hover:bg-white/5'
            )}
          >
            {f === 'all' ? `All (${orders.length})` : f === 'dine_in' ? `Dine-In (${orders.filter(o=>(o as any).order_type==='dine_in').length})` : f === 'takeaway' ? `Takeaway (${orders.filter(o=>(o as any).order_type==='takeaway').length})` : `Delivery (${orders.filter(o=>(o as any).order_type==='delivery').length})`}
          </button>
        ))}
      </div>

      {/* Main Grid Area */}
      <main className="flex-grow overflow-x-auto p-8 custom-scrollbar">
        <div className="flex gap-8 h-full min-w-max pb-4">
          <AnimatePresence mode="popLayout">
            {filteredOrders.map((order) => (
              <OrderCard 
                key={order.id} 
                order={order} 
                onStatusUpdate={updateOrderStatus} 
              />
            ))}
          </AnimatePresence>

          {filteredOrders.length === 0 && (
            <div className="w-full flex flex-col items-center justify-center text-muted py-40">
              <Clock size={64} className="mb-6 opacity-20" />
              <p className="text-2xl font-medium">Waiting for new orders...</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function OrderCard({ order, onStatusUpdate }: { order: KitchenOrder, onStatusUpdate: any }) {
  const [now, setNow] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const isReady = order.status === 'ready';
  const isPreparing = order.status === 'preparing';
  const minutesElapsed = Math.floor((now.getTime() - new Date(order.created_at).getTime()) / 60000);
  const isLate = !isReady && minutesElapsed >= 10;
  const isUrgent = !isReady && minutesElapsed >= 20;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 50, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="w-[400px] flex flex-col h-full"
    >
      <Card className={cn(
        "h-full flex flex-col border-2 overflow-hidden transition-all duration-500",
        isReady ? "border-primary/50 shadow-[0_0_40px_rgba(234,179,8,0.15)] bg-primary/5" : 
        isUrgent ? "border-red-500 shadow-[0_0_50px_rgba(239,68,68,0.2)] bg-red-500/10 animate-pulse" :
        isLate ? "border-orange-500 shadow-[0_0_40px_rgba(249,115,22,0.15)] bg-orange-500/10" :
        isPreparing ? "border-blue-500/30 bg-blue-500/5 shadow-2xl" : "border-border glass"
      )}>
        {/* Card Header */}
        <div className={cn(
          "p-6 flex justify-between items-start",
          isReady ? "bg-primary/20" : isPreparing ? "bg-blue-500/10" : "bg-white/5"
        )}>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl font-black text-white tracking-tighter">#{order.order_number}</span>
              <div className="flex flex-col gap-1">
                <div className={cn(
                  "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5",
                  order.order_type === 'dine_in' ? "bg-emerald-500/20 text-emerald-400" : "bg-orange-500/20 text-orange-400"
                )}>
                  {order.order_type === 'dine_in' ? <Utensils size={10} /> : <ShoppingBag size={10} />}
                  {order.order_type === 'dine_in' ? 'DINE IN' : 'TAKEAWAY'}
                </div>
                {order.table_number && (
                  <span className="text-xs font-black text-primary uppercase tracking-tighter px-3">
                    Table {order.table_number.replace('T', '')}
                  </span>
                )}
              </div>
            </div>

            <p className="text-xs text-muted font-medium">
              {formatRelativeTime(order.created_at)}
            </p>
          </div>
          
          <div className={cn(
            "w-3 h-3 rounded-full animate-pulse",
            isReady ? "bg-primary" : isPreparing ? "bg-blue-500" : "bg-white/20"
          )} />
        </div>

        {/* Card Content: Items */}
        <CardContent className="p-8 flex-grow overflow-y-auto custom-scrollbar">
          <ul className="space-y-6">
            {Object.values(order.items.reduce((acc, item) => {
              if (!acc[item.product_id]) {
                acc[item.product_id] = {
                  product_id: item.product_id,
                  product_name: item.product_name,
                  variations: []
                };
              }
              acc[item.product_id].variations.push(item);
              return acc;
            }, {} as Record<string, any>)).map((group: any) => (
              <li key={group.product_id} className="flex flex-col gap-2">
                <p className="text-xl font-bold text-white leading-tight mb-2">{group.product_name}</p>
                <div className="space-y-3">
                  {group.variations.map((item: any) => (
                    <div key={item.id} className="flex items-start gap-4 bg-black/20 p-3 rounded-xl border border-white/5">
                      <div className="w-8 h-8 rounded-lg bg-surface-lighter flex items-center justify-center font-black text-primary border border-border shrink-0">
                        {item.quantity}
                      </div>
                      <div>
                        {item.customisations && item.customisations.length > 0 ? (
                          <div className="space-y-1 mt-0.5">
                            {item.customisations.map((cust: any) => (
                              <p 
                                key={cust.id || cust.ingredient_id} 
                                className={cn(
                                  "text-[11px] font-black uppercase tracking-widest",
                                  cust.action === 'removed' ? "text-red-400" : "text-emerald-400"
                                )}
                              >
                                {cust.action === 'removed' ? `- NO ${cust.ingredient_name}` : `+ EXTRA ${cust.ingredient_name}`}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-muted mt-1 uppercase tracking-widest font-bold">Standard Prep</p>
                        )}

                        {item.notes && (
                          <div className="mt-2 bg-primary/10 border border-primary/20 p-2 rounded-lg">
                            <p className="text-[10px] font-black text-primary uppercase tracking-tighter flex items-center gap-1 leading-tight">
                              <Edit3 size={10} className="shrink-0" />
                              {item.notes}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>

        {/* Card Footer: Actions */}
        <div className="p-6 border-t border-white/5 bg-black/20">
          {!isReady ? (
            <Button 
              onClick={() => onStatusUpdate(order.id, isPreparing ? 'ready' : 'preparing')}
              size="xl" 
              className={cn(
                "w-full rounded-2xl py-8 text-xl font-black gap-3 transition-all duration-500",
                isPreparing ? "bg-primary hover:bg-primary/80 text-background" : "bg-blue-600 hover:bg-blue-500 text-white"
              )}
            >
              {isPreparing ? (
                <>
                  <CheckCircle2 size={24} />
                  MARK AS READY
                </>
              ) : (
                <>
                  <ChefHat size={24} />
                  START COOKING
                </>
              )}
            </Button>
          ) : (
            <Button 
              onClick={() => onStatusUpdate(order.id, 'delivered')}
              variant="outline"
              size="xl" 
              className="w-full rounded-2xl py-8 text-xl font-black border-primary text-primary hover:bg-primary/10"
            >
              SERVED & CLEAR
            </Button>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
