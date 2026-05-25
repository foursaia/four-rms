"use client";

import { useEffect, useState, useMemo } from "react";
import { useReceptionStore, RestaurantTable } from "@/stores/useReceptionStore";
import { KitchenOrder } from "@/stores/useKitchenStore";
import { FloorMap } from "@/components/reception/FloorMap";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatCurrency, exportToCSV } from "@/lib/utils";

import { useShiftStore } from "@/stores/useShiftStore";
import { useCashDrawerStore } from "@/stores/useCashDrawerStore";
import { supabase } from "@/lib/supabase";
import { format, startOfDay, endOfDay } from "date-fns";
import { formatLocalTime, formatRelativeTime } from "@/lib/time";
import { useAuth } from "@/hooks/useAuth";
import { 
  Loader2, Search, Filter, Banknote, CreditCard, 
  CheckCircle2, Clock, LayoutDashboard,
  Receipt, ShoppingBag, Utensils, Plus, BarChart3,
  TrendingUp, Users, ArrowUpRight, Trash2, Edit3, LogOut,
  Wallet, X, Bike, DollarSign
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { useMenuStore, getLowStockStatus } from "@/stores/menuStore";
import { ManualOrderPOS } from "@/components/reception/ManualOrderPOS";
import { BillSplitModal } from "@/components/reception/BillSplitModal";
import { TableTransferModal } from "@/components/reception/TableTransferModal";
import { CashDrawerPanel } from "@/components/reception/CashDrawerPanel";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, BarChart, Bar, Cell 
} from 'recharts';

export default function ReceptionPage() {
  const { user: authUser, loading: authLoading } = useAuth('Receptionist');
  const { 
    orders, isLoading, fetchOrders, markAsPaid, cancelOrder, subscribeToAllOrders,
    tables, fetchTables, subscribeToTables 
  } = useReceptionStore();
  const { activeShift, fetchActiveShift, startShift, closeShift, isLoading: shiftLoading } = useShiftStore();
  const { transactions, fetchTransactions: fetchDrawerTransactions } = useCashDrawerStore();
  const { products, fetchMenu } = useMenuStore();

  const [branchId, setBranchId] = useState<string | null>(null);
  const [orderToPrint, setOrderToPrint] = useState<{ order: KitchenOrder; type: 'receipt' | 'kot' } | null>(null);
  const [branchSettings, setBranchSettings] = useState({
    name: 'Tawakkal RMS',
    location: 'G-11, Islamabad',
    phone: '051-1234567',
    tax_percentage: 18
  });

  const [search, setSearch] = useState("");
  const [showPOS, setShowPOS] = useState(false);
  const [editingOrder, setEditingOrder] = useState<KitchenOrder | null>(null);
  const [activeTab, setActiveTab] = useState<'orders' | 'floor' | 'reports' | 'cash'>('orders');
  const [openingFloat, setOpeningFloat] = useState("");
  const [closingCash, setClosingCash] = useState("");
  const [actualCash, setActualCash] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [closingNotes, setClosingNotes] = useState("");
  const [profileId, setProfileId] = useState<string | null>(null);
  const [showClosingModal, setShowClosingModal] = useState(false);
  const [showKioskAlert, setShowKioskAlert] = useState(false);
  const [orderToTransfer, setOrderToTransfer] = useState<KitchenOrder | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [orderToSplit, setOrderToSplit] = useState<KitchenOrder | null>(null);
  const [showSplitModal, setShowSplitModal] = useState(false);
  
  // Filter States
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  const handleEditOrder = (order: KitchenOrder) => {
    setEditingOrder(order);
    setShowPOS(true);
  };

  useEffect(() => {
    let unsubscribeOrders: () => void;
    let unsubscribeTables: () => void;

    const init = async () => {
      // Use auth session for reliable branch identification
      const { data: { session } } = await supabase.auth.getSession();
      
      let branchId: string | null = null;
      if (session) {
        const { data: profile } = await supabase
          .from('staff')
          .select('branch_id')
          .eq('auth_user_id', session.user.id)
          .single();
        branchId = profile?.branch_id || null;
      }

      // Fallback to first branch for demo/dev
      if (!branchId) {
        const { data: branches } = await supabase.from('branches').select('id').limit(1);
        branchId = branches?.[0]?.id || null;
      }

      if (branchId) {
        fetchOrders(branchId);
        fetchTables(branchId);
        
        // Fetch branch details dynamically
        const { data: bData } = await supabase.from('branches').select('*').eq('id', branchId).single();
        if (bData) {
          setBranchSettings({
            name: bData.name || 'Tawakkal RMS',
            location: bData.location || 'Branch Location',
            phone: bData.phone || '000-0000',
            tax_percentage: bData.tax_percentage || 18
          });
        }

        // Fetch specific staff ID for this user session
        if (session) {
          const { data: staff } = await supabase.from('staff').select('id').eq('auth_user_id', session.user.id).single();
          if (staff) {
            setProfileId(staff.id);
            setBranchId(branchId);
            fetchActiveShift(branchId, staff.id);
            fetchMenu(branchId);
          }
        } else if (authUser?.username) {
           // Fallback for dummy login
           const { data: staff } = await supabase.from('staff').select('id, full_name').limit(20);
           const match = staff?.find(s => s.full_name?.toLowerCase().includes(authUser.username.toLowerCase()));
           if (match) {
             setProfileId(match.id);
             setBranchId(branchId);
             fetchActiveShift(branchId, match.id);
             fetchMenu(branchId);
           }
        }
        
        unsubscribeOrders = subscribeToAllOrders(branchId);
        unsubscribeTables = subscribeToTables(branchId);
      }
    };
    init();
    return () => {
      unsubscribeOrders?.();
      unsubscribeTables?.();
    };
  }, [fetchOrders, fetchTables, subscribeToAllOrders, subscribeToTables, fetchActiveShift]);

  // Load cash transactions for current shift to sync expected cash
  useEffect(() => {
    if (activeShift?.id) {
      fetchDrawerTransactions(activeShift.id);
    }
  }, [activeShift?.id, fetchDrawerTransactions]);

  // Print handler with event listeners for automated printing cleanup
  const handlePrint = (order: KitchenOrder, type: 'receipt' | 'kot') => {
    setOrderToPrint({ order, type });
    setTimeout(() => {
      window.print();
    }, 250);
  };

  useEffect(() => {
    const handleAfterPrint = () => {
      setOrderToPrint(null);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);


  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.order_number?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    const matchesType = typeFilter === 'all' || o.order_type === typeFilter;
    const matchesPayment = paymentFilter === 'all' || o.payment_status === paymentFilter;
    
    return o.status !== 'cancelled' && matchesSearch && matchesStatus && matchesType && matchesPayment;
  });



  // Analytics Logic - Relaxed for better visibility (Last 24 Hours)
  const todayOrders = orders.filter(o => {
    const dateStr = o.created_at.includes('Z') || o.created_at.includes('+') ? o.created_at : o.created_at.replace(' ', 'T') + 'Z';
    const orderDate = new Date(dateStr);
    const now = new Date();
    const diffInHours = Math.abs(now.getTime() - orderDate.getTime()) / (1000 * 60 * 60);
    return diffInHours <= 24 && o.status !== 'cancelled';
  });

  const stats = {
    totalRevenue: todayOrders.filter(o => o.payment_status === 'paid').reduce((sum, o) => sum + (o.total || 0), 0),
    cashRevenue: todayOrders.filter(o => o.payment_status === 'paid' && o.payment_method === 'cash').reduce((sum, o) => sum + (o.total || 0), 0),
    cardRevenue: todayOrders.filter(o => o.payment_status === 'paid' && o.payment_method === 'card').reduce((sum, o) => sum + (o.total || 0), 0),
    totalOrders: todayOrders.length,
    dineIn: todayOrders.filter(o => o.order_type === 'dine_in').length,
    takeaway: todayOrders.filter(o => o.order_type === 'takeaway').length,
    unpaidCount: orders.filter(o => o.payment_status === 'unpaid').length,
    unpaidAmount: orders.filter(o => o.payment_status === 'unpaid').reduce((sum, o) => sum + (o.total || 0), 0),
    readyCount: orders.filter(o => o.status === 'ready').length
  };

  // Calculate cash revenue specifically collected during the active shift
  const cashRevenueSinceShiftStart = useMemo(() => {
    if (!activeShift) return 0;
    return orders
      .filter(o => {
        if (o.payment_status !== 'paid' || o.payment_method !== 'cash') return false;
        if (o.status === 'cancelled') return false;
        
        const dateStr = o.created_at.includes('Z') || o.created_at.includes('+') ? o.created_at : o.created_at.replace(' ', 'T') + 'Z';
        const orderDate = new Date(dateStr);
        const shiftStartDate = new Date(activeShift.opened_at);
        
        return orderDate >= shiftStartDate;
      })
      .reduce((sum, o) => sum + (o.total || 0), 0);
  }, [orders, activeShift]);

  // Compute manual drawer transactions totals
  const manualCashIn = useMemo(
    () => transactions.filter(t => t.type === "cash_in").reduce((s, t) => s + Number(t.amount), 0),
    [transactions]
  );
  const manualCashOut = useMemo(
    () => transactions.filter(t => t.type === "cash_out").reduce((s, t) => s + Number(t.amount), 0),
    [transactions]
  );
  
  const expectedCashAmount = useMemo(() => {
    if (!activeShift) return 0;
    return (Number(activeShift.opening_float) || 0) + cashRevenueSinceShiftStart + manualCashIn - manualCashOut;
  }, [activeShift, cashRevenueSinceShiftStart, manualCashIn, manualCashOut]);

  // Advanced Analytics Processing
  const hourlySalesData = Array.from({ length: 24 }, (_, i) => {
    const hourNum = i; 
    const hour = (hourNum % 12 || 12) + (hourNum >= 12 ? " PM" : " AM");
    
    const sales = todayOrders
      .filter(o => {
        const dateStr = o.created_at.includes('Z') || o.created_at.includes('+') ? o.created_at : o.created_at.replace(' ', 'T') + 'Z';
        return new Date(dateStr).getHours() === hourNum && o.payment_status === 'paid';
      })
      .reduce((sum, o) => sum + (o.total || 0), 0);
      
    const volume = todayOrders
      .filter(o => {
        const dateStr = o.created_at.includes('Z') || o.created_at.includes('+') ? o.created_at : o.created_at.replace(' ', 'T') + 'Z';
        return new Date(dateStr).getHours() === hourNum;
      })
      .length;

    return { hour, sales, volume };
  });

  // Peak Hour based on order volume (even unpaid)
  const peakHourByCount = [...hourlySalesData].sort((a, b) => b.volume - a.volume)[0];
  const peakHourData = {
    time: peakHourByCount?.hour || "N/A",
    count: peakHourByCount?.volume || 0
  };

  // Top Products Calculation
  const productSalesMap: Record<string, number> = {};
  todayOrders.forEach(order => {
    if (Array.isArray(order.items)) {
      order.items.forEach((item: any) => {
        const name = item.product_name || 'Item';
        productSalesMap[name] = (productSalesMap[name] || 0) + (item.quantity || 1);
      });
    }
  });

  const productData = Object.entries(productSalesMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);


  if (authLoading) return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-primary" size={40} /></div>;

  const lowStockProducts = products.filter(p => getLowStockStatus(p));

  if (isLoading && orders.length === 0) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-background">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="text-muted text-lg">Loading Receptionist Portal...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 bottom-0 w-20 bg-surface border-r border-border flex flex-col items-center py-8 gap-8 z-50">
        <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center">
          <LayoutDashboard className="text-background" size={24} />
        </div>
        <div className="w-10 h-px bg-border" />
        <div className="flex flex-col gap-6">
          <button 
            onClick={() => setActiveTab('orders')}
            className={cn("p-3 rounded-xl transition-all", activeTab === 'orders' ? "bg-primary text-background" : "text-muted hover:text-white")}
            title="Orders List"
          >
            <Receipt size={24} />
          </button>
          <button 
            onClick={() => setActiveTab('floor')}
            className={cn("p-3 rounded-xl transition-all", activeTab === 'floor' ? "bg-primary text-background" : "text-muted hover:text-white")}
            title="Floor Map"
          >
            <Utensils size={24} />
          </button>
          <button 
            onClick={() => setActiveTab('reports')}
            className={cn("p-3 rounded-xl transition-all", activeTab === 'reports' ? "bg-primary text-background" : "text-muted hover:text-white")}
            title="Analytics"
          >
            <BarChart3 size={24} />
          </button>
          <button 
            onClick={() => setActiveTab('cash')}
            className={cn("p-3 rounded-xl transition-all relative", activeTab === 'cash' ? "bg-primary text-background" : "text-muted hover:text-white")}
            title="Cash Drawer"
          >
            <DollarSign size={24} />
            {activeShift && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400" />
            )}
          </button>
        </div>

        <div className="mt-auto mb-8">
           <button 
            onClick={() => setShowClosingModal(true)}
            className="p-3 rounded-xl text-red-500 hover:bg-red-500/10 transition-all"
            title="Close Shift"
          >
            <LogOut size={24} />
          </button>
        </div>
      </div>

      <div className="pl-20 flex flex-col flex-grow">
        {/* Header */}
        <header className="p-8 flex justify-between items-center glass-lighter sticky top-0 z-40 border-b border-border">
          <div>
            <h1 className="text-3xl font-black text-white uppercase tracking-tighter">
              {activeTab === 'orders' ? "Receptionist Desk" :
               activeTab === 'floor' ? "Visual Floor Map" :
               activeTab === 'cash' ? "Cash Drawer" :
               "Sales Analytics"}
            </h1>
            <p className="text-sm text-muted font-bold uppercase tracking-widest mt-1">
              {activeTab === 'orders' ? "Management & Billing" :
               activeTab === 'floor' ? "Realtime Table Status" :
               activeTab === 'cash' ? "Shift Reconciliation & Flow" :
               "Today's Performance Overview"}
            </p>
          </div>

          <div className="flex gap-4">
             {/* Live Stats */}
             <div className="hidden lg:flex items-center gap-6 bg-white/[0.03] border border-white/10 px-6 py-2 rounded-2xl">
               <div className="text-right">
                 <p className="text-[10px] text-muted font-black uppercase tracking-widest">Today's Revenue</p>
                 <p className="text-xl font-black text-primary">{formatCurrency(stats.totalRevenue)}</p>
               </div>
               <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                 <TrendingUp size={20} />
               </div>
             </div>

             <div className="hidden xl:flex items-center gap-6 bg-white/[0.03] border border-white/10 px-6 py-2 rounded-2xl">
               <div className="text-right">
                 <p className="text-[10px] text-muted font-black uppercase tracking-widest">Pending Payment</p>
                 <p className="text-xl font-black text-red-500">{formatCurrency(stats.unpaidAmount)}</p>
               </div>
               <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20">
                 <Banknote size={20} />
               </div>
             </div>

             <div className="w-px h-10 bg-border mx-2" />
          </div>

          <div className="flex gap-4">
             {activeTab === 'orders' && (
               <>
                 <Button 
                   onClick={() => setShowPOS(true)} 
                   className="rounded-2xl gap-2 h-12 px-8 font-black bg-primary text-background shadow-lg shadow-primary/20"
                 >
                   <Plus size={20} />
                   NEW ORDER
                 </Button>

                 <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                    <input 
                      type="text" 
                      placeholder="Search Order Number..." 
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="bg-surface border border-border rounded-2xl pl-12 pr-6 py-3 w-80 text-sm focus:outline-none focus:border-primary transition-all"
                    />
                 </div>
               </>
             )}
             <div className="relative">
               <Button 
                 onClick={() => setShowFilterMenu(!showFilterMenu)}
                 variant={showFilterMenu ? "primary" : "secondary"} 
                 className="rounded-2xl gap-2 h-12 px-6"
               >
                 <Filter size={18} />
                 FILTER {(statusFilter !== 'all' || typeFilter !== 'all' || paymentFilter !== 'all') && "•"}
               </Button>

               <AnimatePresence>
                 {showFilterMenu && (
                   <motion.div 
                     initial={{ opacity: 0, y: 10, scale: 0.95 }}
                     animate={{ opacity: 1, y: 0, scale: 1 }}
                     exit={{ opacity: 0, y: 10, scale: 0.95 }}
                     className="absolute right-0 mt-4 w-72 bg-surface border border-border rounded-3xl p-6 shadow-2xl z-50 backdrop-blur-xl"
                   >
                     <div className="space-y-6">
                       <div>
                         <label className="text-[10px] font-black text-muted uppercase tracking-widest mb-3 block">Order Status</label>
                         <div className="grid grid-cols-2 gap-2">
                           {['all', 'pending', 'preparing', 'ready'].map(s => (
                             <button
                               key={s}
                               onClick={() => setStatusFilter(s)}
                               className={cn(
                                 "px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all border",
                                 statusFilter === s ? "bg-primary border-primary text-background" : "bg-background/50 border-border text-muted hover:text-white"
                               )}
                             >
                               {s}
                             </button>
                           ))}
                         </div>
                       </div>

                       <div>
                         <label className="text-[10px] font-black text-muted uppercase tracking-widest mb-3 block">Payment Status</label>
                         <div className="grid grid-cols-2 gap-2">
                           {['all', 'paid', 'unpaid'].map(p => (
                             <button
                               key={p}
                               onClick={() => setPaymentFilter(p)}
                               className={cn(
                                 "px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all border",
                                 paymentFilter === p ? "bg-primary border-primary text-background" : "bg-background/50 border-border text-muted hover:text-white"
                               )}
                             >
                               {p}
                             </button>
                           ))}
                         </div>
                       </div>

                       <div className="pt-4 border-t border-border flex justify-between items-center">
                         <button 
                           onClick={() => {
                             setStatusFilter('all');
                             setPaymentFilter('all');
                             setTypeFilter('all');
                           }}
                           className="text-[10px] font-black text-primary uppercase hover:underline"
                         >
                           Reset All
                         </button>
                         <Button size="sm" className="rounded-lg px-4 text-[10px]" onClick={() => setShowFilterMenu(false)}>Apply</Button>
                       </div>
                     </div>
                   </motion.div>
                 )}
               </AnimatePresence>
             </div>

          </div>
        </header>

        {/* Low Stock Warning Bar */}
        <AnimatePresence>
          {lowStockProducts.length > 0 && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-amber-500/10 border-b border-amber-500/20 px-8 py-2 overflow-hidden"
            >
              <div className="flex items-center gap-4 animate-pulse">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em]">
                  Inventory Alert: {lowStockProducts.map(p => p.name).join(' • ')}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <main className="p-8 space-y-8">
          {activeTab === 'floor' ? (
            <FloorMap 
              onTableClick={(table) => {
                const activeOrder = orders.find(o => o.table_id === table.id && o.status !== 'delivered' && o.status !== 'cancelled' && o.payment_status === 'unpaid');
                if (activeOrder) {
                  handleEditOrder(activeOrder);
                } else {
                  setEditingOrder({
                    id: undefined,
                    table_id: table.id,
                    table_number: table.table_number,
                    order_type: 'dine_in',
                    items: []
                  } as any);
                  setShowPOS(true);
                }
              }} 
            />
          ) : activeTab === 'orders' ? (
            <>
              {/* Stats Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="glass-lighter border-none">
                  <CardContent className="p-6 flex items-center gap-6">
                    <div className="w-16 h-16 rounded-[1.5rem] bg-orange-500/20 flex items-center justify-center text-orange-500 border border-orange-500/30">
                      <Banknote size={32} />
                    </div>
                    <div>
                      <p className="text-xs text-muted font-black uppercase tracking-widest mb-1">Unpaid Payments</p>
                      <p className="text-3xl font-black text-white">{stats.unpaidCount} <span className="text-sm text-muted font-medium font-sans">Orders</span></p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-lighter border-none">
                  <CardContent className="p-6 flex items-center gap-6">
                    <div className="w-16 h-16 rounded-[1.5rem] bg-emerald-500/20 flex items-center justify-center text-emerald-500 border border-emerald-500/30">
                      <CheckCircle2 size={32} />
                    </div>
                    <div>
                      <p className="text-xs text-muted font-black uppercase tracking-widest mb-1">Ready for Pickup</p>
                      <p className="text-3xl font-black text-white">{stats.readyCount} <span className="text-sm text-muted font-medium font-sans">Orders</span></p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass border-primary/20">
                  <CardContent className="p-6 flex items-center gap-6">
                    <div className="w-16 h-16 rounded-[1.5rem] bg-primary/20 flex items-center justify-center text-primary border border-primary/30">
                      <CreditCard size={32} />
                    </div>
                    <div>
                      <p className="text-xs text-muted font-black uppercase tracking-widest mb-1">Total Outstanding</p>
                      <p className="text-3xl font-black text-primary">{formatCurrency(stats.unpaidAmount)}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Orders Table */}
              <div className="bg-surface rounded-[2rem] border border-border overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-border bg-white/5 flex justify-between items-center">
                  <h2 className="font-bold text-lg">Live Order Monitor</h2>
                  <span className="text-xs font-bold text-muted uppercase tracking-widest">{filteredOrders.length} Recent Records</span>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-white/[0.02]">
                        <th className="p-6 text-xs font-black uppercase tracking-widest text-muted">Order ID</th>
                        <th className="p-6 text-xs font-black uppercase tracking-widest text-muted">Type</th>
                        <th className="p-6 text-xs font-black uppercase tracking-widest text-muted">Status</th>
                        <th className="p-6 text-xs font-black uppercase tracking-widest text-muted">Payment</th>
                        <th className="p-6 text-xs font-black uppercase tracking-widest text-muted">Amount</th>
                        <th className="p-6 text-xs font-black uppercase tracking-widest text-muted">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      <AnimatePresence mode="popLayout">
                        {filteredOrders.map((order) => (
                          <motion.tr 
                            layout
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            key={order.id} 
                            className="hover:bg-white/[0.03] transition-colors"
                          >
                            <td className="p-6">
                              <span className="font-black text-xl text-white">#{order.order_number}</span>
                              <p className="text-[10px] text-muted mt-1">{formatLocalTime(order.created_at)}</p>
                            </td>
                            <td className="p-6">
                              <div className="flex flex-col gap-1">
                                <div className={cn(
                                  "inline-flex items-center gap-2 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest w-fit",
                                  order.order_type === 'dine_in' ? "bg-blue-500/10 text-blue-400" : "bg-orange-500/10 text-orange-400"
                                )}>
                                  {order.order_type === 'dine_in' ? <Utensils size={12} /> : <ShoppingBag size={12} />}
                                  {order.order_type === 'dine_in' ? 'Dine In' : 'Takeaway'}
                                </div>
                                {order.table_number && (
                                  <span className="text-[10px] font-black text-primary px-3 uppercase tracking-tighter">
                                    Table {order.table_number.replace('T', '')}
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="p-6">
                              <div className={cn(
                                "inline-flex items-center gap-2 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                                order.status === 'ready' ? "bg-emerald-500/10 text-emerald-400" : 
                                order.status === 'preparing' ? "bg-blue-500/10 text-blue-400" : "bg-white/10 text-muted"
                              )}>
                                <Clock size={12} />
                                {order.status}
                              </div>
                            </td>
                            <td className="p-6">
                              <span className={cn(
                                "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border",
                                order.payment_status === 'paid' ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"
                              )}>
                                {order.payment_status}
                              </span>
                            </td>
                            <td className="p-6">
                              <span className="font-black text-lg text-white">{formatCurrency(order.total)}</span>
                            </td>
                            <td className="p-6">
                              <div className="flex gap-2 items-center">
                                {/* Thermal Printer Actions */}
                                <Button 
                                  onClick={() => handlePrint(order, 'receipt')}
                                  variant="secondary"
                                  size="sm" 
                                  className="rounded-xl h-10 px-4 text-primary hover:bg-primary/10 border border-primary/20"
                                  title="Print Receipt"
                                >
                                  <Receipt size={16} />
                                </Button>
                                <Button 
                                  onClick={() => handlePrint(order, 'kot')}
                                  variant="secondary"
                                  size="sm" 
                                  className="rounded-xl h-10 px-4 text-amber-500 hover:bg-amber-500/10 border border-amber-500/20"
                                  title="Print KOT"
                                >
                                  <Utensils size={16} />
                                </Button>

                                {order.status === 'ready' && (
                                  <Button 
                                    onClick={async () => {
                                      const { error } = await supabase
                                        .from('orders')
                                        .update({ status: 'dispatched' })
                                        .eq('id', order.id);
                                      
                                      // Get branch ID to refresh
                                      const { data: branches } = await supabase.from('branches').select('id').limit(1);
                                      if (!error && branches?.[0]) fetchOrders(branches[0].id);
                                    }}
                                    className="bg-primary hover:bg-primary/90 text-black font-black rounded-xl h-10 px-6 text-[10px] uppercase shadow-lg shadow-primary/20"
                                  >
                                    <Bike size={14} className="mr-2" />
                                    Dispatch
                                  </Button>
                                )}
                                {order.status === 'dispatched' && (
                                  <div className="px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-xl flex items-center gap-2">
                                    <Bike size={14} className="animate-bounce" />
                                    <span className="text-[10px] font-black uppercase">On Way</span>
                                  </div>
                                )}
                                {order.payment_status === 'unpaid' ? (
                                  <>
                                    <div className="flex flex-col gap-1">
                                      <Button 
                                        onClick={async () => {
                                          await markAsPaid(order.id, 'cash');
                                          // Auto-print receipt on payment confirmation
                                          handlePrint(order, 'receipt');
                                          // Refresh orders with branch ID
                                          const { data: branches } = await supabase.from('branches').select('id').limit(1);
                                          if (branches?.[0]) fetchOrders(branches[0].id);
                                        }}
                                        size="sm" 
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl h-8 px-4 text-[10px]"
                                      >
                                        CASH
                                      </Button>
                                      <Button 
                                        onClick={async () => {
                                          await markAsPaid(order.id, 'card');
                                          // Auto-print receipt on payment confirmation
                                          handlePrint(order, 'receipt');
                                          // Refresh orders with branch ID
                                          const { data: branches } = await supabase.from('branches').select('id').limit(1);
                                          if (branches?.[0]) fetchOrders(branches[0].id);
                                        }}
                                        size="sm" 
                                        className="bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl h-8 px-4 text-[10px]"
                                      >
                                        CARD
                                      </Button>
                                    </div>
                                    <Button 
                                      onClick={() => handleEditOrder(order)}
                                      variant="secondary"
                                      size="sm" 
                                      className="rounded-xl h-10 px-4"
                                    >
                                      <Edit3 size={16} />
                                    </Button>
                                    <Button 
                                      onClick={() => {
                                        setOrderToTransfer(order);
                                        setShowTransferModal(true);
                                      }}
                                      variant="secondary"
                                      size="sm" 
                                      className="rounded-xl h-10 px-4 text-blue-400 hover:bg-blue-400/10"
                                      title="Transfer Table"
                                    >
                                      <Utensils size={16} />
                                    </Button>
                                    <Button 
                                      onClick={() => {
                                        setOrderToSplit(order);
                                        setShowSplitModal(true);
                                      }}
                                      variant="secondary"
                                      size="sm" 
                                      className="rounded-xl h-10 px-4 text-emerald-400 hover:bg-emerald-400/10"
                                      title="Split Bill"
                                    >
                                      <Receipt size={16} />
                                    </Button>
                                    <Button 
                                      onClick={() => {
                                        if (confirm("Are you sure you want to cancel this order?")) {
                                          cancelOrder(order.id);
                                        }
                                      }}
                                      variant="ghost"
                                      size="sm" 
                                      className="rounded-xl h-10 px-4 text-red-500 hover:bg-red-500/10"
                                    >
                                      <Trash2 size={16} />
                                    </Button>
                                  </>
                                ) : (
                                  <Button variant="outline" size="sm" className="rounded-xl border-border h-10 px-6 text-muted">
                                    PAID
                                  </Button>
                                )}
                              </div>
                            </td>

                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            /* ADVANCED ANALYTICS VIEW */
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              {/* Top Summary Row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="bg-surface border-border shadow-xl overflow-hidden relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <CardContent className="p-6 relative">
                    <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-1">Peak Hour Today</p>
                    <div className="flex items-center gap-2">
                      <p className="text-3xl font-black text-white">{peakHourData.time}</p>
                      <div className="px-2 py-0.5 bg-primary/20 text-primary text-[8px] font-black rounded-full border border-primary/20 uppercase">Rush</div>
                    </div>
                    <p className="text-[10px] text-muted font-bold mt-2 uppercase">{peakHourData.count} Orders in 1hr</p>
                  </CardContent>
                </Card>

                <Card className="bg-surface border-border shadow-xl">
                  <CardContent className="p-6">
                    <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-1">Avg. Order Value</p>
                    <p className="text-3xl font-black text-white">
                      {formatCurrency(stats.totalOrders > 0 ? stats.totalRevenue / stats.totalOrders : 0)}
                    </p>
                    <div className="w-full bg-surface-lighter h-1 mt-3 rounded-full overflow-hidden">
                      <div className="bg-primary h-full" style={{ width: '65%' }} />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-surface border-border shadow-xl">
                  <CardContent className="p-6">
                    <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-1">Orders Velocity</p>
                    <p className="text-3xl font-black text-white">{(stats.totalOrders / 12).toFixed(1)} <span className="text-xs text-muted font-medium">Orders/hr</span></p>
                    <p className="text-[10px] text-emerald-500 font-bold mt-2 uppercase">Steady Flow</p>
                  </CardContent>
                </Card>

                <Card className="bg-surface border-border shadow-xl">
                  <CardContent className="p-6">
                    <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-1">Source Split</p>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex-1">
                        <div className="flex justify-between text-[10px] font-black mb-1 uppercase">
                          <span className="text-blue-400">POS</span>
                          <span className="text-primary">Kiosk</span>
                        </div>
                        <div className="w-full flex h-2 rounded-full overflow-hidden bg-surface-lighter">
                          <div className="bg-blue-500" style={{ width: `${(todayOrders.filter(o => o.order_source === 'pos').length / stats.totalOrders * 100) || 50}%` }} />
                          <div className="bg-primary" style={{ width: `${(todayOrders.filter(o => o.order_source === 'kiosk').length / stats.totalOrders * 100) || 50}%` }} />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Hourly Sales Chart */}
                <Card className="bg-surface border-border p-8">
                  <div className="flex justify-between items-center mb-8">
                    <div>
                      <h3 className="text-xl font-black text-white uppercase tracking-tighter">Hourly Sales Trend</h3>
                      <p className="text-xs text-muted font-bold uppercase tracking-widest mt-1">Revenue flow throughout the day</p>
                    </div>
                    <TrendingUp className="text-primary" size={24} />
                  </div>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={hourlySalesData}>
                        <defs>
                          <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#EAB308" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#EAB308" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                        <XAxis dataKey="hour" stroke="#666" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} />
                        <YAxis stroke="#666" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : `Rs.${v}`} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #333', borderRadius: '12px' }}
                          itemStyle={{ fontWeight: 'bold' }}
                        />
                        <Area type="monotone" dataKey="sales" name="Revenue (Rs.)" stroke="#EAB308" strokeWidth={4} fillOpacity={1} fill="url(#colorSales)" />
                        <Area type="monotone" dataKey="volume" name="Orders Count" stroke="#3B82F6" strokeWidth={2} fillOpacity={0} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                {/* Popular Items Chart */}
                <Card className="bg-surface border-border p-8">
                  <div className="flex justify-between items-center mb-8">
                    <div>
                      <h3 className="text-xl font-black text-white uppercase tracking-tighter">Top Performing Items</h3>
                      <p className="text-xs text-muted font-bold uppercase tracking-widest mt-1">Best selling products by volume</p>
                    </div>
                    <Plus className="text-primary rotate-45" size={24} />
                  </div>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={productData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" stroke="#fff" fontSize={10} fontWeight="bold" width={100} axisLine={false} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #333', borderRadius: '12px' }}
                        />
                        <Bar dataKey="count" fill="#EAB308" radius={[0, 4, 4, 0]} barSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>

              {/* Recent Transactions (Re-styled) */}
              <Card className="bg-surface border-border overflow-hidden">
                <div className="p-6 border-b border-border flex justify-between items-center bg-white/5">
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">Financial Audit Log</h3>
                  <div className="flex gap-2">
                     <Button variant="outline" size="sm" className="rounded-xl border-border text-[10px] font-black uppercase tracking-widest">Today</Button>
                     <Button 
                       variant="secondary" 
                       size="sm" 
                       className="rounded-xl font-bold"
                       onClick={() => {
                         const exportData = todayOrders.map(o => ({
                           'Order #': o.order_number,
                           'Time': new Date(o.created_at).toLocaleTimeString(),
                           'Source': o.order_source || 'POS',
                           'Method': o.payment_method || 'Pending',
                           'Status': o.payment_status,
                           'Total': o.total
                         }));
                         exportToCSV(exportData, `Sales_Report_Reception_${new Date().toISOString().split('T')[0]}`);
                       }}
                     >
                       Download CSV
                     </Button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-border bg-background/30">
                        <th className="p-4 text-[10px] font-black text-muted uppercase tracking-widest">Order</th>
                        <th className="p-4 text-[10px] font-black text-muted uppercase tracking-widest">Time</th>
                        <th className="p-4 text-[10px] font-black text-muted uppercase tracking-widest">Source</th>
                        <th className="p-4 text-[10px] font-black text-muted uppercase tracking-widest">Method</th>
                        <th className="p-4 text-[10px] font-black text-muted uppercase tracking-widest">Status</th>
                        <th className="p-4 text-[10px] font-black text-muted uppercase tracking-widest">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {todayOrders.slice(0, 10).map(order => (
                        <tr key={order.id} className="hover:bg-white/5 transition-colors">
                          <td className="p-4 font-black text-white">#{order.order_number}</td>
                          <td className="p-4 text-sm text-muted">{formatLocalTime(order.created_at)}</td>
                          <td className="p-4">
                            <span className="text-[10px] font-bold uppercase px-2 py-1 bg-surface-lighter rounded-md border border-border">
                              {order.order_source}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className={cn(
                              "text-[10px] font-bold uppercase px-2 py-1 rounded-md border",
                              order.payment_method === 'cash' ? "bg-orange-500/10 border-orange-500/20 text-orange-500" : "bg-blue-500/10 border-blue-500/20 text-blue-500"
                            )}>
                              {order.payment_method || 'pending'}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className={cn(
                              "w-2 h-2 rounded-full inline-block mr-2",
                              order.payment_status === 'paid' ? "bg-emerald-500" : "bg-red-500"
                            )} />
                            <span className="text-[10px] font-black uppercase text-white">{order.payment_status}</span>
                          </td>
                          <td className="p-4 font-black text-primary">{formatCurrency(order.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'cash' && branchId && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <CashDrawerPanel
                branchId={branchId}
                cashRevenue={cashRevenueSinceShiftStart}
              />
            </div>
          )}

        </main>

        {/* Modal Stack */}
        <AnimatePresence>
          {/* Bill Split Modal */}
          {showSplitModal && orderToSplit && (
            <BillSplitModal 
              order={orderToSplit} 
              onClose={() => {
                setShowSplitModal(false);
                setOrderToSplit(null);
              }} 
              onSuccess={() => {
                setShowSplitModal(false);
                setOrderToSplit(null);
              }} 
            />
          )}

          {/* Table Transfer Modal */}
          {showTransferModal && orderToTransfer && (
            <TableTransferModal 
              order={orderToTransfer}
              tables={tables}
              onClose={() => {
                setShowTransferModal(false);
                setOrderToTransfer(null);
              }}
              onSuccess={() => {
                setShowTransferModal(false);
                setOrderToTransfer(null);
              }}
            />
          )}

          {/* Manual Order POS Modal */}
          {showPOS && (
            <ManualOrderPOS 
              profileId={profileId}
              editingOrder={editingOrder} 
              onClose={() => {
                setShowPOS(false);
                setEditingOrder(null);
              }} 
            />
          )}

          {/* OPENING SHIFT MODAL */}
          {!activeShift && !isLoading && !shiftLoading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-6 backdrop-blur-xl"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-surface w-full max-w-lg rounded-[3rem] border border-border p-12 text-center shadow-2xl"
              >
                <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-primary mx-auto mb-8 border border-primary/20">
                  <Wallet size={48} />
                </div>
                <h2 className="text-4xl font-black text-white uppercase tracking-tighter mb-4">Open Your Shift</h2>
                <p className="text-muted font-bold uppercase tracking-widest text-xs mb-10">Enter the starting cash amount in your drawer</p>
                
                <div className="relative mb-10 text-left">
                   <label className="text-[10px] font-black text-muted uppercase tracking-widest mb-3 block">Opening Float</label>
                  <div className="relative">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-primary font-black text-2xl">Rs.</span>
                    <input 
                      type="number"
                      placeholder="0.00"
                      value={openingFloat}
                      onChange={(e) => setOpeningFloat(e.target.value)}
                      className="w-full bg-background border-2 border-border focus:border-primary rounded-3xl py-6 pl-20 pr-8 text-4xl font-black text-white outline-none transition-all"
                    />
                  </div>
                </div>

                <Button 
                  disabled={!openingFloat || isSubmitting}
                  onClick={async () => {
                    try {
                      setIsSubmitting(true);
                      const cash = parseFloat(openingFloat);
                      if (isNaN(cash)) return;
                      await startShift(branchId!, profileId!, cash);
                      setOpeningFloat("");
                    } catch (err: any) {
                      alert("Failed to start shift");
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  className="w-full h-20 rounded-2xl text-2xl font-black shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" /> : "START SHIFT"}
                </Button>
              </motion.div>
            </motion.div>
          )}

          {/* CLOSING SHIFT MODAL */}
          {showClosingModal && activeShift && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-6 backdrop-blur-xl"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-surface w-full max-w-xl rounded-[3rem] border border-border p-12 shadow-2xl"
              >
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Close Shift</h2>
                  <button onClick={() => setShowClosingModal(false)} className="text-muted hover:text-white"><X size={24} /></button>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-10">
                  <div className="bg-background/50 p-6 rounded-2xl border border-border">
                    <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-1">Opening Cash</p>
                    <p className="text-2xl font-black text-white">{formatCurrency(Number(activeShift.opening_float) || 0)}</p>
                  </div>
                  <div className="bg-background/50 p-6 rounded-2xl border border-border">
                    <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-1">Cash Sales</p>
                    <p className="text-2xl font-black text-emerald-400">+{formatCurrency(cashRevenueSinceShiftStart)}</p>
                  </div>
                  <div className="bg-background/50 p-6 rounded-2xl border border-border">
                    <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-1">Net Manual Flows</p>
                    <p className={cn("text-2xl font-black", manualCashIn - manualCashOut >= 0 ? "text-emerald-400" : "text-red-400")}>
                      {manualCashIn - manualCashOut >= 0 ? "+" : ""}{formatCurrency(manualCashIn - manualCashOut)}
                    </p>
                  </div>
                  <div className="bg-background/50 p-6 rounded-2xl border border-primary/20">
                    <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-1">Expected Cash</p>
                    <p className="text-2xl font-black text-primary">{formatCurrency(expectedCashAmount)}</p>
                  </div>
                </div>

                <div className="relative mb-6 text-left">
                  <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-3 text-center">Actual Cash in Drawer</p>
                  <div className="relative">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-primary font-black text-2xl">Rs.</span>
                    <input 
                      type="number"
                      placeholder="0.00"
                      value={actualCash}
                      onChange={(e) => setActualCash(e.target.value)}
                      className="w-full bg-background border-2 border-border focus:border-primary rounded-3xl py-6 pl-20 pr-8 text-4xl font-black text-white outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="relative mb-10 text-left">
                  <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-3">Closing Notes (Optional)</p>
                  <textarea 
                    placeholder="Any cash discrepancies, missing receipts, etc..."
                    value={closingNotes}
                    onChange={(e) => setClosingNotes(e.target.value)}
                    className="w-full bg-background border-2 border-border focus:border-primary rounded-2xl p-4 text-white outline-none transition-all resize-none h-24"
                  />
                </div>

                <div className="flex gap-4">
                  <Button variant="secondary" onClick={() => setShowClosingModal(false)} className="flex-1 h-16 rounded-2xl font-black">CANCEL</Button>
                  <Button 
                    disabled={!actualCash || isSubmitting}
                    onClick={async () => {
                      try {
                        setIsSubmitting(true);
                        await closeShift(parseFloat(actualCash), closingNotes);
                        setShowClosingModal(false);
                        setActualCash("");
                        setClosingNotes("");
                      } catch (err: any) {
                        alert(err.message || "Failed to close shift");
                      } finally {
                        setIsSubmitting(false);
                      }
                    }}
                    className="flex-[2] h-16 rounded-2xl font-black bg-red-600 hover:bg-red-500 shadow-lg shadow-red-600/20"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" /> : "CONFIRM & CLOSE"}
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Thermal Receipt Print Container */}
          {orderToPrint && (
            <div id="thermal-print-area" className="hidden print:block bg-white text-black p-4 w-[76mm] mx-auto font-mono text-[12px] leading-relaxed">
              {orderToPrint.type === 'kot' ? (
                // ── KITCHEN ORDER TICKET (KOT) ──
                <div className="space-y-4">
                  <div className="text-center border-b border-dashed border-black pb-2">
                    <h2 className="text-lg font-black uppercase">*** KOT ***</h2>
                    <p className="text-sm font-bold uppercase mt-1">Kitchen Ticket</p>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between font-bold">
                      <span>Order #:</span>
                      <span>#{orderToPrint.order.order_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Date:</span>
                      <span>{formatLocalTime(orderToPrint.order.created_at)}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>Type:</span>
                      <span className="uppercase">{orderToPrint.order.order_type.replace('_', ' ')}</span>
                    </div>
                    {orderToPrint.order.table_number && (
                      <div className="flex justify-between font-bold">
                        <span>Table:</span>
                        <span>{orderToPrint.order.table_number}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="border-t border-b border-dashed border-black py-2 my-2">
                    <div className="flex justify-between font-bold text-sm mb-2">
                      <span>Item</span>
                      <span className="text-right">Qty</span>
                    </div>
                    <div className="space-y-2">
                      {orderToPrint.order.items?.map((item: any, idx: number) => (
                        <div key={idx} className="space-y-0.5">
                          <div className="flex justify-between font-bold text-sm">
                            <span>{item.product_name}</span>
                            <span className="text-right font-black text-lg">x{item.quantity}</span>
                          </div>
                          {item.notes && (
                            <p className="text-xs pl-2 italic font-bold text-black bg-black/5">
                              * Note: {item.notes}
                            </p>
                          )}
                          {Array.isArray(item.customisations) && item.customisations.map((c: any, cIdx: number) => (
                            <p key={cIdx} className="text-xs pl-4 font-medium">- {c.addon_name} (x{c.quantity})</p>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="text-center border-t border-dashed border-black pt-2 mt-4 font-bold text-sm uppercase">
                    *** End of Ticket ***
                  </div>
                </div>
              ) : (
                // ── CUSTOMER BILL RECEIPT ──
                <div className="space-y-4">
                  <div className="text-center pb-2 border-b border-dashed border-black">
                    <h1 className="text-xl font-black tracking-tight uppercase">{branchSettings.name}</h1>
                    <p className="text-xs font-bold mt-1">{branchSettings.location}</p>
                    <p className="text-[10px] mt-0.5">Tel: {branchSettings.phone}</p>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between font-bold">
                      <span>Order #:</span>
                      <span>#{orderToPrint.order.order_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Date:</span>
                      <span>{formatLocalTime(orderToPrint.order.created_at)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cashier:</span>
                      <span>{authUser?.username || 'Staff'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Type:</span>
                      <span className="uppercase">{orderToPrint.order.order_type.replace('_', ' ')}</span>
                    </div>
                    {orderToPrint.order.table_number && (
                      <div className="flex justify-between">
                        <span>Table:</span>
                        <span>{orderToPrint.order.table_number}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold">
                      <span>Status:</span>
                      <span className="uppercase">{orderToPrint.order.payment_status}</span>
                    </div>
                  </div>
                  
                  <div className="border-t border-b border-dashed border-black py-2 my-2">
                    <div className="grid grid-cols-4 font-bold text-xs mb-2">
                      <span className="col-span-2">Item</span>
                      <span className="text-center">Qty</span>
                      <span className="text-right">Price</span>
                    </div>
                    <div className="space-y-2 divide-y divide-dashed divide-black/10">
                      {orderToPrint.order.items?.map((item: any, idx: number) => {
                        const itemTotal = Number(item.unit_price) * Number(item.quantity);
                        return (
                          <div key={idx} className="pt-2 first:pt-0">
                            <div className="grid grid-cols-4 text-xs font-medium">
                              <span className="col-span-2 font-bold">{item.product_name}</span>
                              <span className="text-center font-bold">x{item.quantity}</span>
                              <span className="text-right tabular-nums">{formatCurrency(itemTotal)}</span>
                            </div>
                            {item.notes && (
                              <p className="text-[10px] pl-2 italic">* {item.notes}</p>
                            )}
                            {Array.isArray(item.customisations) && item.customisations.map((c: any, cIdx: number) => {
                              const cTotal = Number(c.addon_price || 0) * Number(c.quantity || 1);
                              return (
                                <div key={cIdx} className="grid grid-cols-4 text-[10px] pl-4 italic text-black/80">
                                  <span className="col-span-2">- {c.addon_name} (x{c.quantity})</span>
                                  <span className="text-center"></span>
                                  <span className="text-right tabular-nums">+{formatCurrency(cTotal)}</span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  <div className="space-y-1 pt-2">
                    <div className="flex justify-between font-medium">
                      <span>Subtotal:</span>
                      <span className="tabular-nums">{formatCurrency(orderToPrint.order.total / (1 + (branchSettings.tax_percentage || 0) / 100))}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>GST ({branchSettings.tax_percentage}%):</span>
                      <span className="tabular-nums">{formatCurrency(orderToPrint.order.total - (orderToPrint.order.total / (1 + (branchSettings.tax_percentage || 0) / 100)))}</span>
                    </div>
                    <div className="flex justify-between font-black text-lg border-t border-dashed border-black pt-2">
                      <span>Total:</span>
                      <span className="tabular-nums">{formatCurrency(orderToPrint.order.total)}</span>
                    </div>
                    {orderToPrint.order.payment_method && (
                      <div className="flex justify-between font-bold text-xs uppercase pt-1">
                        <span>Method:</span>
                        <span>{orderToPrint.order.payment_method}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-center border-t border-dashed border-black pt-4 mt-6 space-y-1">
                    <p className="font-bold">Thank you for dining with us!</p>
                    <p className="text-[9px] text-black/60 font-sans">Software powered by Antigravity RMS</p>
                    <div className="w-48 h-6 bg-black mx-auto mt-3 flex items-center justify-center text-white text-[9px] tracking-[0.4em] font-sans font-bold">
                      ||||| {orderToPrint.order.order_number} |||||
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
