"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { 
  Bike, 
  MapPin, 
  Phone, 
  Clock, 
  CheckCircle2, 
  Package, 
  Navigation,
  Search,
  User,
  Plus,
  Loader2,
  LogOut
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { formatLocalTime, formatRelativeTime } from "@/lib/time";

export default function DeliveryDashboard() {
  const { user: authUser, loading: authLoading } = useAuth('Dispatcher');
  const [activeDeliveries, setActiveDeliveries] = useState<any[]>([]);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [riders, setRiders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isAddingRider, setIsAddingRider] = useState(false);
  const [riderForm, setRiderForm] = useState({ name: '', phone: '' });

  if (authLoading) return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-primary" size={40} /></div>;

  // FETCH RIDERS & ORDERS
  useEffect(() => {
    const fetchData = async () => {
      // Fetch Pending Orders (Ready from kitchen)
      const { data: pData } = await supabase
        .from('orders')
        .select('*')
        .eq('order_type', 'delivery')
        .eq('status', 'ready')
        .is('rider_id', null);
      if (pData) setPendingOrders(pData);

      // Fetch Active Deliveries (With riders)
      const { data: aData } = await supabase
        .from('orders')
        .select('*, riders(*)')
        .eq('order_type', 'delivery')
        .in('status', ['dispatched', 'out_for_delivery']);
      if (aData) setActiveDeliveries(aData);

      // Fetch Riders
      const { data: rData } = await supabase
        .from('riders')
        .select('*');
      if (rData) setRiders(rData);
    };

    fetchData();
    const channel = supabase.channel('delivery_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'riders' }, fetchData)
      .subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleAssignRider = async (riderId: string) => {
    if (!selectedOrder) return;

    const { error } = await supabase
      .from('orders')
      .update({ 
        rider_id: riderId,
        status: 'dispatched'
      })
      .eq('id', selectedOrder.id);

    if (!error) {
      setSelectedOrder(null);
    }
  };

  const handleAddRider = async () => {
    if (!riderForm.name || !riderForm.phone) return;
    const { error } = await supabase.from('riders').insert([{ ...riderForm, status: 'Available' }]);
    if (!error) {
      setIsAddingRider(false);
      setRiderForm({ name: '', phone: '' });
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white p-8 lg:p-12">
      {/* HEADER */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-16">
        <div>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center text-primary shadow-xl shadow-primary/10">
              <Bike size={32} />
            </div>
            <div>
              <h1 className="text-5xl font-black uppercase tracking-tighter">Delivery Hub</h1>
              <div className="text-muted font-bold flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Dispatcher Control
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <Card className="glass-lighter border-none p-6 flex flex-col items-center justify-center min-w-[140px]">
             <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">In Transit</p>
             <p className="text-3xl font-black text-blue-400">{activeDeliveries.length}</p>
          </Card>
          <Card className="glass-lighter border-none p-6 flex flex-col items-center justify-center min-w-[140px]">
             <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Available Riders</p>
             <p className="text-3xl font-black text-emerald-400">{riders.filter(r => r.status === 'Available').length}</p>
          </Card>
          <Button 
            onClick={() => { document.cookie = 'rms_dummy_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'; sessionStorage.removeItem('rms_dummy_session'); localStorage.removeItem('rms_dummy_session'); window.location.href = '/login'; }}
            variant="secondary" 
            className="h-auto px-6 py-4 rounded-2xl flex flex-col items-center gap-1 border-red-500/10 hover:bg-red-500/10 group"
          >
            <LogOut size={20} className="text-red-400 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">Logout</span>
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        
        {/* PENDING DISPATCH LIST */}
        <div className="lg:col-span-3 space-y-8">
          <h2 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">
            <Package className="text-primary" size={20} />
            Pending Dispatch ({pendingOrders.length})
          </h2>

          <div className="space-y-4">
            {pendingOrders.map((order) => (
              <motion.div 
                layoutId={order.id}
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className={cn(
                  "p-6 rounded-[1.5rem] cursor-pointer transition-all border-2",
                  selectedOrder?.id === order.id 
                    ? "bg-primary/10 border-primary" 
                    : "glass-lighter border-transparent hover:border-white/10"
                )}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-lg font-black text-white">#{order.id.slice(-4)}</span>
                  <span className="text-sm font-black text-primary">Rs. {order.total}</span>
                </div>
                <p className="text-[10px] font-bold text-muted truncate">{order.delivery_address}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ACTIVE DELIVERIES */}
        <div className="lg:col-span-5 space-y-8">
          <h2 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">
            <Navigation className="text-blue-400" size={20} />
            Active Deliveries ({activeDeliveries.length})
          </h2>

          <div className="space-y-4">
            {activeDeliveries.map((order) => (
              <Card key={order.id} className="glass-lighter border-none p-6">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <p className="text-sm font-black text-white uppercase tracking-tight">Order #{order.id.slice(-4)}</p>
                    <p className="text-[10px] font-bold text-muted uppercase mt-1">Rider: {order.riders?.name || 'Assigned'}</p>
                  </div>
                  <div className={cn(
                    "px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest",
                    order.status === 'out_for_delivery' ? "bg-amber-500/10 text-amber-400" : "bg-blue-500/10 text-blue-400"
                  )}>
                    {order.status === 'out_for_delivery' ? 'On the way' : 'Dispatched'}
                  </div>
                </div>
                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                   <div className={cn("h-full transition-all duration-1000", order.status === 'out_for_delivery' ? "w-2/3 bg-amber-500" : "w-1/3 bg-blue-500")} />
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* RIDER NETWORK */}
        <div className="lg:col-span-4 space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">
              <User className="text-emerald-400" size={20} />
              Riders
            </h2>
            <Button 
              onClick={() => setIsAddingRider(true)}
              variant="primary" 
              className="rounded-xl h-10 px-6 text-[10px] font-black uppercase tracking-widest"
            >
              Add Rider
            </Button>
          </div>

          <div className="space-y-4">
            {riders.map((rider) => (
              <Card key={rider.id} className="glass-lighter border-none p-6 group relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black",
                      rider.status === 'Available' ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
                    )}>
                      {rider.name[0]}
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white uppercase">{rider.name}</h4>
                      <p className="text-[10px] font-bold text-muted">{rider.phone}</p>
                    </div>
                  </div>
                  {selectedOrder && rider.status === 'Available' && (
                    <Button 
                      onClick={() => handleAssignRider(rider.id)}
                      className="h-10 px-4 rounded-xl bg-primary text-black text-[10px] font-black uppercase"
                    >
                      Assign
                    </Button>
                  )}
                  {rider.status === 'Busy' && (
                    <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Busy</span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* ADD RIDER MODAL */}
      <AnimatePresence>
        {isAddingRider && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setIsAddingRider(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-surface border border-border p-10 rounded-[2.5rem] w-full max-w-md relative z-10 shadow-2xl">
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-8">Register New Rider</h3>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Full Name</label>
                  <input type="text" value={riderForm.name} onChange={e => setRiderForm({ ...riderForm, name: e.target.value })} className="w-full bg-background border border-border focus:border-primary rounded-xl py-4 px-6 text-sm font-bold text-white outline-none" placeholder="Rider Name" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Phone Number</label>
                  <input type="text" value={riderForm.phone} onChange={e => setRiderForm({ ...riderForm, phone: e.target.value })} className="w-full bg-background border border-border focus:border-primary rounded-xl py-4 px-6 text-sm font-bold text-white outline-none" placeholder="+92 3XX XXXXXXX" />
                </div>
                <Button onClick={handleAddRider} className="w-full h-14 rounded-2xl bg-primary text-black font-black uppercase mt-4">Create Rider Record</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* RIDER OVERLAY FOR ASSIGNMENT */}
      <AnimatePresence>
        {selectedOrder && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[100] w-full max-w-lg px-8"
          >
             <div className="bg-primary text-black p-6 rounded-[2rem] shadow-2xl flex items-center justify-between">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 bg-black/10 rounded-2xl flex items-center justify-center">
                      <Navigation size={24} />
                   </div>
                   <div>
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Assigning Order</p>
                      <p className="text-xl font-black uppercase tracking-tighter">Order #{selectedOrder.id.slice(-4)}</p>
                   </div>
                </div>
                <Button 
                  variant="ghost" 
                  onClick={() => setSelectedOrder(null)}
                  className="font-black uppercase text-xs tracking-widest hover:bg-black/10"
                >
                   Cancel
                </Button>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
