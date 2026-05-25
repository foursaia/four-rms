"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bike, 
  MapPin, 
  Phone, 
  CheckCircle2, 
  Clock, 
  Navigation,
  ChevronRight,
  Package,
  LogOut,
  Loader2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0
  }).format(amount).replace('PKR', 'Rs.');
};

interface RiderOrder {
  id: string;
  customer_name: string;
  phone?: string;
  customer_phone?: string;
  delivery_address: string;
  total: number;
  status: string;
  created_at: string;
  order_items: any[];
}

export default function RiderPortal() {
  const { user: authUser, loading: authLoading } = useAuth('Rider');
  const [orders, setOrders] = useState<RiderOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeOrder, setActiveOrder] = useState<RiderOrder | null>(null);

  // For demo/testing, we'll fetch orders assigned to 'Rider' role or specific rider ID
  // In real use, this would filter by the logged-in user's profile ID
  const [stats, setStats] = useState({ todayCount: 0, earnings: 0 });

  const fetchAssignedOrders = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .in('status', ['ready', 'dispatched', 'out_for_delivery'])
      .order('created_at', { ascending: false });

    if (!error && data) {
      setOrders(data);
      // Fetch stats for today
      const today = new Date();
      today.setHours(0,0,0,0);
      const { data: deliveredToday } = await supabase
        .from('orders')
        .select('total')
        .eq('status', 'delivered')
        .gte('updated_at', today.toISOString());
      
      if (deliveredToday) {
        setStats({
          todayCount: deliveredToday.length,
          earnings: deliveredToday.reduce((sum, o) => sum + (o.total || 0), 0)
        });
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchAssignedOrders();
    
    // Subscribe to new assignments
    const channel = supabase
      .channel('rider_orders')
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchAssignedOrders();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const updateStatus = async (orderId: string, status: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId);

    if (!error) {
      if (status === 'delivered') setActiveOrder(null);
      fetchAssignedOrders();
    }
  };

  const openNavigation = (address: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    window.open(url, '_blank');
  };

  if (authLoading) return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-primary" size={40} /></div>;

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white pb-24 font-sans">
      {/* Header */}
      <div className="p-6 pt-12 bg-[#161618] border-b border-white/5 sticky top-0 z-50 backdrop-blur-xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-black tracking-tighter uppercase italic">Rider Portal</h1>
            <p className="text-[10px] text-primary font-black uppercase tracking-widest mt-1">Status: Online & Ready</p>
          </div>
          <div 
            onClick={() => supabase.auth.signOut().then(() => { document.cookie = 'rms_dummy_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'; sessionStorage.removeItem('rms_dummy_session'); window.location.href = '/login'; })}
            className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center border border-red-500/20 text-red-400 cursor-pointer hover:bg-red-500/20 transition-all"
          >
            <LogOut size={20} />
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
            <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Today's Jobs</p>
            <p className="text-xl font-black text-white">{stats.todayCount}</p>
          </div>
          <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
            <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Total Earnings</p>
            <p className="text-xl font-black text-emerald-400">{formatCurrency(stats.earnings)}</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {isLoading ? (
          <div className="py-20 text-center">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted text-xs font-black uppercase tracking-widest">Finding Orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="py-32 text-center opacity-30">
            <Package size={64} className="mx-auto mb-6" />
            <p className="text-xl font-black uppercase tracking-tighter">No Active Orders</p>
            <p className="text-xs font-bold mt-2">Take a break, you're all caught up!</p>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-xs font-black text-muted uppercase tracking-[0.2em] ml-1">New Deliveries ({orders.length})</h2>
            {orders.map((order) => (
              <Card 
                key={order.id} 
                onClick={() => setActiveOrder(order)}
                className="bg-[#161618] border-none p-5 rounded-[2rem] active:scale-95 transition-all cursor-pointer group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-black text-white">{order.customer_name || 'Guest'}</h3>
                    <p className="text-[10px] text-muted font-bold uppercase mt-1">Order #{order.id.slice(0, 5)}</p>
                  </div>
                  <div className="px-3 py-1 bg-primary text-black rounded-lg text-[10px] font-black uppercase">
                    Ready
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-muted">
                    <MapPin size={16} className="text-primary" />
                    <p className="text-xs font-bold truncate">{order.delivery_address || 'No Address Provided'}</p>
                  </div>
                  <div className="flex items-center gap-3 text-muted">
                    <Phone size={16} className="text-emerald-400" />
                    <p className="text-xs font-bold">{order.customer_phone || order.phone || 'No Phone'}</p>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-white/5 flex justify-between items-center">
                  <p className="text-sm font-black text-white">{formatCurrency(order.total)}</p>
                  <ChevronRight size={20} className="text-primary group-hover:translate-x-1 transition-transform" />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ACTIVE ORDER MODAL */}
      <AnimatePresence>
        {activeOrder && (
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col"
          >
            <div className="flex-1 overflow-y-auto p-8 pt-16">
              <button 
                onClick={() => setActiveOrder(null)}
                className="mb-8 text-muted font-black uppercase text-xs flex items-center gap-2"
              >
                <ChevronRight className="rotate-180" size={16} />
                Back to List
              </button>

              <div className="space-y-8">
                <div>
                  <h2 className="text-4xl font-black tracking-tighter uppercase italic mb-2">Delivery Details</h2>
                  <p className="text-muted font-bold uppercase tracking-widest text-xs">Customer: {activeOrder.customer_name || 'Guest'}</p>
                </div>

                <div className="bg-white/5 rounded-[2.5rem] p-8 border border-white/5 space-y-6">
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest">Delivery Address</p>
                    <p className="text-xl font-bold">{activeOrder.delivery_address || 'Check Order Notes'}</p>
                  </div>
                  
                  <div className="flex gap-4">
                    <Button 
                      onClick={() => openNavigation(activeOrder.delivery_address)}
                      className="flex-1 h-16 rounded-2xl bg-white text-black font-black hover:bg-white/90"
                    >
                      <Navigation size={20} className="mr-2" />
                      NAVIGATE
                    </Button>
                    <Button 
                      className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-0"
                      onClick={() => window.open(`tel:${activeOrder.customer_phone || activeOrder.phone || ''}`)}
                    >
                      <Phone size={24} />
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-black text-muted uppercase tracking-widest ml-1">Order Summary</h3>
                  <div className="space-y-2">
                    {activeOrder.order_items?.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm font-bold bg-white/[0.02] p-4 rounded-xl">
                        <span>{item.quantity}x {item.product_name}</span>
                        <span className="text-muted">{formatCurrency(item.unit_price * item.quantity)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center text-xl font-black p-4 pt-6 text-primary">
                      <span>Total to Collect</span>
                      <span>{formatCurrency(activeOrder.total)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 bg-[#161618] border-t border-white/5 pb-12">
              {activeOrder.status !== 'out_for_delivery' ? (
                <Button 
                  onClick={() => updateStatus(activeOrder.id, 'out_for_delivery')}
                  className="w-full h-20 rounded-[2rem] bg-emerald-500 text-black text-xl font-black shadow-2xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  <Navigation size={24} className="mr-3" />
                  START DELIVERY
                </Button>
              ) : (
                <Button 
                  onClick={() => updateStatus(activeOrder.id, 'delivered')}
                  className="w-full h-20 rounded-[2rem] bg-primary text-black text-xl font-black shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  <CheckCircle2 size={24} className="mr-3" />
                  MARK DELIVERED
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
