"use client";

import { useState, useEffect, cloneElement } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import {
   BarChart3,
   LayoutDashboard,
   Settings,
   Users,
   TrendingUp,
   DollarSign,
   ShoppingBag,
   FileText,
   ChevronRight,
   LogOut,
   MapPin,
   Building2,
   ArrowUpRight,
   ArrowDownRight,
   Globe,
   Briefcase,
   Loader2,
   Download,
   PieChart as PieIcon,
   History,
   Receipt,
   LineChart
} from "lucide-react";
import {
   AreaChart,
   Area,
   XAxis,
   YAxis,
   CartesianGrid,
   Tooltip,
   ResponsiveContainer,
   BarChart,
   Bar,
   PieChart,
   Pie,
   Cell
} from 'recharts';
import { formatCurrency, cn, exportToCSV } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";

// Data will be generated from DB orders
const COLORS = ["#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899"];

// Data will be mapped from branches state

export default function CEODashboard() {
   const { user, loading: authLoading } = useAuth('CEO');
   const [activeTab, setActiveTab] = useState("overview");
   const [branches, setBranches] = useState<any[]>([]);
   const [isAddingBranch, setIsAddingBranch] = useState(false);
   const [newBranch, setNewBranch] = useState({ name: '', location: '', phone: '' });

   const [kpiStats, setKpiStats] = useState({ revenue: 0, orders: 0, staff: 0, profit: 0 });
   const [globalStaff, setGlobalStaff] = useState<any[]>([]);
   const [branchStats, setBranchStats] = useState<{ sales: Record<string, number>, managers: Record<string, string> }>({ sales: {}, managers: {} });
   const [statsLoading, setStatsLoading] = useState(true);

   const [topItems, setTopItems] = useState<any[]>([]);
   const [staffPerformance, setStaffPerformance] = useState<any[]>([]);
   const [revenueData, setRevenueData] = useState<any[]>([]);
   const [branchPerfData, setBranchPerfData] = useState<any[]>([]);
   const [timeRange, setTimeRange] = useState("7d"); // Default to last 7 days
   const [sourceData, setSourceData] = useState<any[]>([
      { name: 'Kiosk', value: 0, color: '#f59e0b' },
      { name: 'Reception', value: 0, color: '#3b82f6' },
   ]);
   const [globalSettings, setGlobalSettings] = useState({
      maintenance_mode: false,
      audio_alerts: true,
      tax_percentage: 16,
      session_timeout: 30,
      primary_color: '#f59e0b',
      peak_hour_start: '18:00',
      peak_hour_end: '22:00',
      peak_hour_multiplier: 1.1
   });
   const [isAddingStaff, setIsAddingStaff] = useState(false);
   const [staffForm, setStaffForm] = useState({ name: '', email: '', role: 'staff', branch_id: '', password: 'Password123' });
   const [searchQuery, setSearchQuery] = useState("");
   const [branchFilter, setBranchFilter] = useState("All Branches");
   const [isSaving, setIsSaving] = useState(false);

   useEffect(() => {
      fetchGlobalData();
   }, [timeRange, branchFilter]);

   const fetchGlobalData = async () => {
      setStatsLoading(true);
      try {
         // 1. Fetch Branches
         const { data: branchData } = await supabase.from('branches').select('*');
         if (branchData) setBranches(branchData);

         // 2. Fetch Orders for Revenue & Analytics (Scoped by timeRange)
         let dateFilter = new Date();
         if (timeRange === 'today') dateFilter.setHours(0, 0, 0, 0);
         else if (timeRange === '7d') dateFilter.setDate(dateFilter.getDate() - 7);
         else if (timeRange === '30d') dateFilter.setDate(dateFilter.getDate() - 30);
         else dateFilter = new Date(0); // All time

         const { data: orders } = await supabase
            .from('orders')
            .select('*, order_items(*)')
            .eq('payment_status', 'paid')
            .neq('status', 'cancelled')
            .gte('created_at', dateFilter.toISOString());

         // Apply Branch Filter to orders if specific branch is selected
         const filteredOrders = branchFilter === 'All Branches'
            ? (orders || [])
            : (orders?.filter(o => {
               const branch = branches.find(b => b.name === branchFilter);
               return o.branch_id === branch?.id;
            }) || []);

         let totalRevenue = 0;
         const branchSalesMap: Record<string, number> = {};
         const itemMap: Record<string, { count: number, revenue: number }> = {};
         const staffMap: Record<string, { orders: number, revenue: number }> = {};

         const today = new Date();
         today.setHours(0, 0, 0, 0);

         filteredOrders.forEach(o => {
            totalRevenue += (o.total || 0);

            // Branch Sales
            if (o.branch_id) {
               branchSalesMap[o.branch_id] = (branchSalesMap[o.branch_id] || 0) + (o.total || 0);
            }

            // Staff Performance
            if (o.user_id) {
               staffMap[o.user_id] = {
                  orders: (staffMap[o.user_id]?.orders || 0) + 1,
                  revenue: (staffMap[o.user_id]?.revenue || 0) + (o.total || 0)
               };
            }

            // Top Items Aggregation
            o.order_items?.forEach((item: any) => {
               const name = item.product_name;
               if (!itemMap[name]) itemMap[name] = { count: 0, revenue: 0 };
               itemMap[name].count += item.quantity;
               itemMap[name].revenue += (item.unit_price * item.quantity);
            });
         });

         // Process Top Items
         const topItemsList = Object.entries(itemMap)
            .map(([name, stats]) => ({ name, orders: stats.count, revenue: stats.revenue, color: '#f59e0b' }))
            .sort((a, b) => b.orders - a.orders)
            .slice(0, 5);
         setTopItems(topItemsList);

         // 3. Fetch Total Expenses (Scoped by timeRange and Branch)
         let expenseQuery = supabase
            .from('expenses')
            .select('amount')
            .gte('expense_date', dateFilter.toISOString().split('T')[0]);

         if (branchFilter !== 'All Branches') {
            const branch = branches.find(b => b.name === branchFilter);
            if (branch) expenseQuery = expenseQuery.eq('branch_id', branch.id);
         }

         const { data: expensesData } = await expenseQuery;

         const totalExpenses = expensesData?.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) || 0;

         const realProfit = totalRevenue - totalExpenses;

         // 4. Fetch Staff List (Schema uses 'staff' table, not 'profiles')
         let staffQuery = supabase
            .from('staff')
            .select(`id, full_name, role, is_active, branch_id, branches ( name )`, { count: 'exact' });

         if (branchFilter !== 'All Branches') {
            const branch = branches.find(b => b.name === branchFilter);
            if (branch) staffQuery = staffQuery.eq('branch_id', branch.id);
         }

         const { data: staffData, count: staffCount } = await staffQuery;

         if (staffData) {
            setGlobalStaff(staffData);
            // Link staff performance back to staff
            const perf = staffData.map(s => ({
               name: s.full_name,
               branch: (s.branches as any)?.[0]?.name || (s.branches as any)?.name || 'Unknown',
               orders: staffMap[s.id]?.orders || 0,
               revenue: staffMap[s.id]?.revenue || 0
            })).sort((a, b) => b.revenue - a.revenue);
            setStaffPerformance(perf);
         }

         const managerMap: Record<string, string> = {};
         staffData?.forEach(s => {
            if (s.role?.toLowerCase().includes('manager') && s.branch_id) {
               managerMap[s.branch_id] = s.full_name;
            }
         });

         setBranchStats({ sales: branchSalesMap, managers: managerMap });

         setKpiStats({
            revenue: totalRevenue,
            orders: filteredOrders.length,
            staff: staffCount || 0,
            profit: realProfit
         });

         // Generate Revenue Data for Area Chart (Group by Day/Month)
         const revChart = Object.entries(branchSalesMap).map(([id, rev]) => ({
            name: branchData?.find(b => b.id === id)?.name || 'Branch',
            revenue: rev
         }));
         setBranchPerfData(revChart);
         // 5. Fetch Global Settings
         const { data: settingsData } = await supabase.from('global_settings').select('*').single();
         if (settingsData) {
            setGlobalSettings({
               maintenance_mode: settingsData.maintenance_mode,
               audio_alerts: settingsData.audio_alerts,
               tax_percentage: Number(settingsData.tax_percentage),
               session_timeout: Number(settingsData.session_timeout),
               primary_color: settingsData.primary_color,
               peak_hour_start: settingsData.peak_hour_start || "18:00",
               peak_hour_end: settingsData.peak_hour_end || "22:00",
               peak_hour_multiplier: Number(settingsData.peak_hour_multiplier || 1.2)
            });
         }

         // Generate Source Data (Kiosk vs Reception)
         const kioskCount = filteredOrders.filter(o => (o.order_source || '').toLowerCase() === 'kiosk').length || 0;
         const totalOrdersCount = filteredOrders.length || 1;
         const receptionCount = totalOrdersCount - kioskCount;

         setSourceData([
            { name: 'Kiosk', value: Math.round((kioskCount / totalOrdersCount) * 100), color: '#f59e0b' },
            { name: 'Reception', value: Math.round((receptionCount / totalOrdersCount) * 100), color: '#3b82f6' },
         ]);

         // 5. Generate 7-Day Revenue/Profit Trend
         const last7Days = [...Array(7)].map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            return d.toISOString().split('T')[0];
         });

         const timelineData = last7Days.map(date => {
            const dayOrders = filteredOrders.filter(o => o.created_at.startsWith(date)) || [];
            const rev = dayOrders.reduce((sum, o) => sum + (o.total || 0), 0);
            // Simple profit estimate (revenue - 30% overhead for demo/trend)
            return {
               name: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
               revenue: rev,
               profit: rev * 0.7
            };
         });
         setRevenueData(timelineData);

      } catch (error) {
         console.error("Error fetching global data:", error);
      } finally {
         setStatsLoading(false);
      }
   };

   useEffect(() => {
      fetchGlobalData();
   }, []);

   const handleAddBranch = async () => {
      if (!newBranch.name) return alert("Branch name is required");
      setIsSaving(true);
      try {
         const { error } = await supabase.from('branches').insert([{
            name: newBranch.name,
            location: newBranch.location,
            contact_phone: newBranch.phone
         }]);

         if (!error) {
            setIsAddingBranch(false);
            setNewBranch({ name: '', location: '', phone: '' });
            fetchGlobalData();
         } else {
            alert("Error: " + error.message);
         }
      } finally {
         setIsSaving(false);
      }
   };

   const handleDeleteStaff = async (id: string) => {
      if (!confirm("Are you sure you want to delete this staff member?")) return;
      setIsSaving(true);
      try {
         const { error } = await supabase.from('staff').delete().eq('id', id);
         if (!error) fetchGlobalData();
         else alert("Error: " + error.message);
      } finally {
         setIsSaving(false);
      }
   };

   const handleUpdateStaffStatus = async (id: string, currentIsActive: boolean) => {
      setIsSaving(true);
      try {
         const { error } = await supabase
            .from('staff')
            .update({ is_active: !currentIsActive })
            .eq('id', id);
         if (!error) fetchGlobalData();
         else alert("Error: " + error.message);
      } finally {
         setIsSaving(false);
      }
   };

   const handleAddStaff = async () => {
      if (!staffForm.name || !staffForm.branch_id) return alert("Name and Branch are required");
      setIsSaving(true);
      try {
         const { error } = await supabase.from('staff').insert([{
            full_name: staffForm.name,
            role: staffForm.role,
            branch_id: staffForm.branch_id,
            is_active: true
         }]);

         if (!error) {
            setIsAddingStaff(false);
            setStaffForm({ name: '', email: '', role: 'staff', branch_id: '', password: 'Password123' });
            fetchGlobalData();
         } else {
            alert(error.message);
         }
      } finally {
         setIsSaving(false);
      }
   };

   const handleSaveSettings = async () => {
      setIsSaving(true);
      // Check if settings exist first
      const { data: existing } = await supabase.from('global_settings').select('id').single();

      let error;
      if (existing) {
         const { error: updateError } = await supabase.from('global_settings')
            .update(globalSettings)
            .eq('id', existing.id);
         error = updateError;
      } else {
         const { error: insertError } = await supabase.from('global_settings')
            .insert([globalSettings]);
         error = insertError;
      }

      setIsSaving(false);
      if (!error) alert("Settings saved globally!");
      else alert(error.message);
   };

   const filteredStaff = globalStaff.filter(s => {
      const matchesSearch = s.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         s.role?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesBranch = branchFilter === "All Branches" || (s.branches as any)?.name === branchFilter;
      return matchesSearch && matchesBranch;
   });

   const sidebarItems = [
      { id: "overview", label: "Executive Overview", icon: <Globe size={20} /> },
      { id: "branches", label: "Branch Network", icon: <Building2 size={20} /> },
      { id: "analytics", label: "Deep Analytics", icon: <TrendingUp size={20} /> },
      { id: "finance", label: "Financial Audit", icon: <DollarSign size={20} /> },
      { id: "users", label: "Global Staff", icon: <Users size={20} /> },
      { id: "performance", label: "Performance Hub", icon: <LineChart size={20} /> },
      { id: "settings", label: "System Config", icon: <Settings size={20} /> },
   ];

   if (authLoading) return <div className="min-h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="animate-spin text-primary" size={40} /></div>;

   return (
      <div className="flex h-screen bg-background overflow-hidden">
         {/* SIDEBAR */}
          <aside className="w-80 bg-surface border-r border-border flex flex-col z-50 h-screen">
             <div className="flex-grow overflow-y-auto custom-scrollbar p-8">
                <div className="flex items-center gap-4 mb-12">
                   <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                      <Building2 className="text-black" size={24} />
                   </div>
                   <div>
                      <h1 className="text-2xl font-black text-white tracking-tighter uppercase">CEO Portal</h1>
                      <p className="text-[10px] font-bold text-amber-500 uppercase tracking-[0.2em]">Network Control</p>
                   </div>
                </div>
 
                <nav className="space-y-2">
                   {sidebarItems.map((item) => (
                      <button
                         key={item.id}
                         onClick={() => setActiveTab(item.id)}
                         className={cn(
                            "w-full flex items-center gap-4 px-4 py-4 rounded-2xl font-bold text-sm transition-all duration-300 group text-left",
                            activeTab === item.id
                               ? "bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-lg shadow-amber-500/5"
                               : "text-muted hover:text-white hover:bg-white/5 border border-transparent"
                         )}
                      >
                         <span className={cn(
                            "transition-transform duration-300 group-hover:scale-110 shrink-0",
                            activeTab === item.id ? "text-amber-500" : "text-muted"
                         )}>
                            {item.icon}
                         </span>
                         <span className="truncate">{item.label}</span>
                         {activeTab === item.id && (
                            <span className="ml-auto shrink-0">
                               <ChevronRight size={16} />
                            </span>
                         )}
                      </button>
                   ))}
                </nav>
             </div>
 
             <div className="p-8 border-t border-white/5 bg-surface/50 backdrop-blur-md">
                <div className="flex items-center gap-3 mb-8 p-4 rounded-2xl bg-white/5">
                   <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 font-black">AD</div>
                   <div>
                      <p className="text-xs font-black text-white uppercase">Admin User</p>
                      <p className="text-[10px] font-bold text-muted uppercase">Global CEO</p>
                   </div>
                </div>
                <button
                   onClick={() => { document.cookie = 'rms_dummy_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'; sessionStorage.removeItem('rms_dummy_session'); localStorage.removeItem('rms_dummy_session'); window.location.href = '/login'; }}
                   className="w-full flex items-center gap-4 px-4 py-3 rounded-xl font-bold text-sm text-red-400 hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20"
                >
                   <LogOut size={20} />
                   Logout
                </button>
             </div>
          </aside>

         {/* MAIN CONTENT */}
         <main className="flex-grow overflow-y-auto custom-scrollbar p-16 bg-[#09090b]">
            <header className="flex justify-between items-center mb-16">
               <div>
                  <h2 className="text-5xl font-black text-white uppercase tracking-tighter mb-4">
                     {sidebarItems.find(i => i.id === activeTab)?.label}
                  </h2>
                  <p className="text-muted text-lg font-medium">Network-wide overview of your restaurant empire.</p>
               </div>

               <div className="flex items-center gap-6">
                  {/* Time Range Selector */}
                  <div className="bg-surface border border-border p-2 rounded-[2rem] flex items-center gap-1">
                     {[
                        { id: 'today', label: 'Today' },
                        { id: '7d', label: '7 Days' },
                        { id: '30d', label: '30 Days' },
                        { id: 'all', label: 'All' }
                     ].map(range => (
                        <button
                           key={range.id}
                           onClick={() => setTimeRange(range.id)}
                           className={cn(
                              "px-6 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
                              timeRange === range.id
                                 ? "bg-amber-500 text-black shadow-lg"
                                 : "text-muted hover:text-white"
                           )}
                        >
                           {range.label}
                        </button>
                     ))}
                  </div>

                  {/* Branch Filter and Export */}
                  <div className="flex items-center gap-4">
                     <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="bg-surface border border-border px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none text-white focus:border-amber-500">
                        <option>All Branches</option>
                        {branches.map(b => (<option key={b.id} value={b.name}>{b.name}</option>))}
                     </select>
                     <Button variant="outline" onClick={() => { const data = globalStaff.map(s => ({ Name: s.full_name, Role: s.role, Branch: (s.branches as any)?.name || 'Main', Orders: staffPerformance.find(p => p.name === s.full_name)?.orders || 0, Revenue: staffPerformance.find(p => p.name === s.full_name)?.revenue || 0 })); exportToCSV(data, `CEO_Report_${branchFilter}`); }} className="h-12 px-6 rounded-2xl border-white/10 text-[10px] font-black uppercase tracking-widest gap-2">
                        <Download size={16} />
                        Export
                     </Button>
                  </div>
               </div>
            </header>

            {activeTab === "overview" && (
               <div className="space-y-12">
                  {/* GLOBAL KPI GRID */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                     {[
                        { label: "Global Revenue", value: formatCurrency(kpiStats.revenue), icon: <DollarSign />, color: "text-emerald-400", trend: "+Live" },
                        { label: "Active Branches", value: branches.length.toString(), icon: <Building2 />, color: "text-amber-400", trend: "Live" },
                        { label: "Total Staff", value: kpiStats.staff.toString(), icon: <Users />, color: "text-blue-400", trend: "Live" },
                        { label: "Est. Net Profit", value: formatCurrency(kpiStats.profit), icon: <TrendingUp />, color: "text-purple-400", trend: "+Live" },
                     ].map((stat, i) => (
                        <Card key={i} className="glass-lighter border-none p-10 relative overflow-hidden group hover:scale-[1.02] transition-all duration-500">
                           <div className="relative z-10">
                              <div className="flex justify-between items-start mb-8">
                                 <div className={cn("p-4 rounded-[2rem] bg-background/50 border border-white/5", stat.color)}>
                                    {cloneElement(stat.icon as any, { size: 24 })}
                                 </div>
                                 <div className={cn(
                                    "flex items-center gap-1 text-[10px] font-black px-3 py-1.5 rounded-full",
                                    stat.trend.startsWith('+') ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                                 )}>
                                    {stat.trend.startsWith('+') ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                                    {stat.trend}
                                 </div>
                              </div>
                              <p className="text-[10px] font-black text-muted uppercase tracking-[0.3em] mb-2">{stat.label}</p>
                              <p className="text-4xl font-black text-white tracking-tighter">{stat.value}</p>
                           </div>
                           <div className="absolute -right-8 -bottom-8 opacity-[0.03] transition-transform duration-700 group-hover:scale-125 group-hover:-rotate-12">
                              {cloneElement(stat.icon as any, { size: 200 })}
                           </div>
                        </Card>
                     ))}
                  </div>

                  {/* CHARTS GRID */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                     {/* Network Revenue Chart */}
                     <Card className="glass-lighter border-none p-12">
                        <div className="flex justify-between items-center mb-12">
                           <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Financial Growth</h3>
                           <div className="flex gap-3">
                              <Button variant="secondary" className="rounded-xl h-10 px-6 text-[10px] font-black uppercase">Revenue</Button>
                              <Button variant="outline" className="rounded-xl h-10 px-6 text-[10px] font-black uppercase border-white/5">Profit</Button>
                           </div>
                        </div>
                        <div className="h-[400px] w-full">
                           <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={revenueData}>
                                 <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                       <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                       <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                    </linearGradient>
                                 </defs>
                                 <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                 <XAxis dataKey="name" stroke="#ffffff30" fontSize={12} fontWeight="bold" tickLine={false} axisLine={false} />
                                 <YAxis stroke="#ffffff30" fontSize={12} fontWeight="bold" tickLine={false} axisLine={false} />
                                 <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #ffffff10', borderRadius: '24px' }} />
                                 <Area type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={5} fillOpacity={1} fill="url(#colorRevenue)" />
                              </AreaChart>
                           </ResponsiveContainer>
                        </div>
                     </Card>

                     {/* Branch Performance Comparison */}
                     <Card className="glass-lighter border-none p-12">
                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-12">Branch Comparison</h3>
                        <div className="h-[400px] w-full">
                           <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={branchPerfData} layout="vertical">
                                 <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" horizontal={false} />
                                 <XAxis type="number" stroke="#ffffff30" fontSize={12} fontWeight="bold" tickLine={false} axisLine={false} />
                                 <YAxis type="category" dataKey="name" stroke="#ffffff30" fontSize={12} fontWeight="bold" tickLine={false} axisLine={false} width={120} />
                                 <Tooltip cursor={{ fill: '#ffffff05' }} contentStyle={{ backgroundColor: '#18181b', border: '1px solid #ffffff10', borderRadius: '24px' }} />
                                 <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 12, 12, 0]} barSize={40}>
                                    {branchPerfData.map((entry, index) => (
                                       <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                 </Bar>
                              </BarChart>
                           </ResponsiveContainer>
                        </div>
                     </Card>
                  </div>
               </div>
            )}

            {activeTab === "branches" && (
               <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
                  {/* NETWORK SUMMARY CARDS */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                     <Card className="glass-lighter border-none p-8">
                        <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-2">Total Locations</p>
                        <p className="text-4xl font-black text-white">{branches.length}</p>
                        <div className="mt-4 flex items-center gap-2 text-emerald-400 text-[10px] font-black uppercase">
                           <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                           All Operational
                        </div>
                     </Card>
                     <Card className="glass-lighter border-none p-8">
                        <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-2">Total Network Staff</p>
                        <p className="text-4xl font-black text-white">{kpiStats.staff}</p>
                        <p className="mt-4 text-muted text-[10px] font-black uppercase tracking-widest">Across {branches.length} Branches</p>
                     </Card>
                     <Card className="glass-lighter border-none p-8 flex flex-col justify-center gap-3">
                        <Button
                           onClick={() => setIsAddingBranch(true)}
                           variant="primary"
                           className="w-full h-14 rounded-2xl font-black text-xs tracking-widest uppercase bg-amber-500 hover:bg-amber-600 text-black shadow-xl shadow-amber-500/20"
                        >
                           Register New Branch
                        </Button>
                        <Button
                           onClick={() => {
                              const exportData = branches.map(b => ({
                                 'Branch Name': b.name,
                                 'Location': b.location,
                                 'Contact': b.contact_phone,
                                 'Revenue (Period)': branchStats.sales[b.id] || 0,
                                 'Manager': branchStats.managers[b.id] || 'Unassigned'
                              }));
                              exportToCSV(exportData, 'Network_Branch_Summary');
                           }}
                           variant="outline"
                           className="w-full h-12 rounded-2xl font-black text-[10px] tracking-widest uppercase border-white/10"
                        >
                           Export Network Data
                        </Button>
                     </Card>
                  </div>

                  {/* BRANCH LISTING */}
                  <div className="grid grid-cols-1 gap-8">
                     {branches.map((branch) => (
                        <Card key={branch.id} className="glass-lighter border-none overflow-hidden group hover:border-white/10 border border-transparent transition-all">
                           <div className="flex flex-col lg:flex-row">
                              <div className="lg:w-80 p-10 bg-white/5 border-r border-white/5 flex flex-col justify-center">
                                 <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 mb-6">
                                    <Building2 size={32} />
                                 </div>
                                 <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">{branch.name}</h3>
                                 <p className="text-xs font-bold text-muted uppercase tracking-widest flex items-center gap-2">
                                    <MapPin size={12} />
                                    {branch.location || 'Location Not Set'}
                                 </p>
                              </div>

                              <div className="flex-grow p-10 grid grid-cols-1 md:grid-cols-4 gap-8 items-center">
                                 <div>
                                    <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Status</p>
                                    <div className="flex items-center gap-2">
                                       <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                       <span className="text-sm font-black text-white uppercase tracking-tighter">Active & Online</span>
                                    </div>
                                 </div>
                                 <div>
                                    <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Today's Sales</p>
                                    <p className="text-xl font-black text-amber-500 tracking-tighter">{formatCurrency(branchStats.sales[branch.id] || 0)}</p>
                                 </div>
                                 <div>
                                    <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Assigned Manager</p>
                                    <p className="text-sm font-black text-white uppercase tracking-tighter">{branchStats.managers[branch.id] || 'Unassigned'}</p>
                                 </div>
                                 <div className="flex justify-end gap-3">
                                    <Button
                                       onClick={async () => {
                                          if (confirm(`Are you sure you want to remove ${branch.name}? Note: This might fail if the branch has existing orders or staff.`)) {
                                             setIsSaving(true);
                                             const { error } = await supabase.from('branches').delete().eq('id', branch.id);
                                             setIsSaving(false);
                                             if (!error) fetchGlobalData();
                                             else alert("Could not delete: " + error.message);
                                          }
                                       }}
                                       variant="outline"
                                       disabled={isSaving}
                                       className="rounded-xl h-12 px-6 text-[10px] font-black uppercase tracking-widest border-red-500/20 text-red-400 hover:bg-red-500/10"
                                    >
                                       {isSaving ? "..." : "Remove Branch"}
                                    </Button>
                                    <Button
                                       onClick={() => {
                                          setActiveTab("overview");
                                       }}
                                       variant="secondary"
                                       className="rounded-xl h-12 px-6 text-[10px] font-black uppercase tracking-widest"
                                    >
                                       View Stats
                                    </Button>
                                 </div>
                              </div>
                           </div>
                        </Card>
                     ))}
                  </div>
               </div>
            )}

            {activeTab === "analytics" && (
               <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
                  <div className="flex justify-between items-center px-4">
                     <div>
                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter">System Intelligence</h3>
                        <p className="text-muted text-xs font-bold uppercase tracking-widest mt-1">Growth & Performance Metrics</p>
                     </div>
                     <Button
                        onClick={() => {
                           const exportData = revenueData.map(d => ({
                              'Period': d.name,
                              'Revenue': d.revenue,
                              'Estimated Profit': d.profit
                           }));
                           exportToCSV(exportData, 'CEO_Analytics_Report');
                        }}
                        variant="outline"
                        className="h-10 px-6 rounded-xl border-white/10 text-[10px] font-black uppercase tracking-widest"
                     >
                        Export Growth Data
                     </Button>
                  </div>
                  {/* TOP ANALYTICS GRID */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                     {/* Revenue vs Profit Chart */}
                     <Card className="glass-lighter border-none p-12">
                        <div className="flex justify-between items-center mb-12">
                           <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Revenue vs Profit</h3>
                           <div className="flex gap-2">
                              <div className="flex items-center gap-2 mr-4">
                                 <div className="w-3 h-3 rounded-full bg-amber-500" />
                                 <span className="text-[10px] font-black text-white uppercase">Revenue</span>
                              </div>
                              <div className="flex items-center gap-2">
                                 <div className="w-3 h-3 rounded-full bg-emerald-400" />
                                 <span className="text-[10px] font-black text-white uppercase">Profit</span>
                              </div>
                           </div>
                        </div>
                        <div className="h-[400px] w-full">
                           <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={revenueData}>
                                 <defs>
                                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                       <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                       <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorProf" x1="0" y1="0" x2="0" y2="1">
                                       <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                       <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                 </defs>
                                 <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                 <XAxis dataKey="name" stroke="#ffffff30" fontSize={12} fontWeight="bold" tickLine={false} axisLine={false} />
                                 <YAxis stroke="#ffffff30" fontSize={12} fontWeight="bold" tickLine={false} axisLine={false} />
                                 <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #ffffff10', borderRadius: '24px' }} />
                                 <Area type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={4} fillOpacity={1} fill="url(#colorRev)" />
                                 <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorProf)" />
                              </AreaChart>
                           </ResponsiveContainer>
                        </div>
                     </Card>

                     {/* Popular Items Network Wide */}
                     <Card className="glass-lighter border-none p-12">
                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter">System-Wide Bestsellers</h3>
                        <div className="space-y-8">
                           {topItems.length > 0 ? topItems.map((item, i) => (
                              <div key={i} className="space-y-3">
                                 <div className="flex justify-between items-end">
                                    <div>
                                       <p className="text-lg font-black text-white uppercase tracking-tight">{item.name}</p>
                                       <p className="text-[10px] font-bold text-muted uppercase tracking-widest">{item.orders} Sold (Net: {formatCurrency(item.revenue)})</p>
                                    </div>
                                 </div>
                                 <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                                    <motion.div
                                       initial={{ width: 0 }}
                                       animate={{ width: `${(item.orders / (topItems[0]?.orders || 1)) * 100}%` }}
                                       transition={{ duration: 1.5, delay: i * 0.1 }}
                                       className="h-full rounded-full"
                                       style={{ backgroundColor: item.color }}
                                    />
                                 </div>
                              </div>
                           )) : (
                              <div className="py-20 text-center opacity-20">
                                 <ShoppingBag size={48} className="mx-auto mb-4" />
                                 <p className="font-black uppercase tracking-widest">No Sales Data Yet</p>
                              </div>
                           )}
                        </div>
                     </Card>
                  </div>

                  {/* BOTTOM ANALYTICS GRID */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                     <Card className="glass-lighter border-none p-10">
                        <div className="flex justify-between items-center mb-8">
                           <h3 className="text-lg font-black text-white uppercase tracking-tighter">Order Distribution</h3>
                           <Button
                              onClick={() => {
                                 const exportData = sourceData.map(s => ({
                                    'Source': s.name,
                                    'Percentage': s.value
                                 }));
                                 exportToCSV(exportData, 'Order_Source_Distribution');
                              }}
                              variant="outline"
                              className="h-8 px-4 rounded-lg border-white/5 text-[8px] font-black uppercase tracking-widest"
                           >
                              Export
                           </Button>
                        </div>
                        <div className="h-64 relative">
                           <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                 <Pie
                                    data={sourceData}
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={8}
                                    dataKey="value"
                                 >
                                    {sourceData.map((entry, index) => (
                                       <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                 </Pie>
                                 <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #ffffff10', borderRadius: '16px' }} />
                              </PieChart>
                           </ResponsiveContainer>
                           <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                              <span className="text-3xl font-black text-white">{sourceData[0]?.value}%</span>
                              <span className="text-[8px] font-black text-muted uppercase tracking-[0.2em]">{sourceData[0]?.name}</span>
                           </div>
                        </div>
                        <div className="space-y-4 mt-6">
                           {sourceData.map((s, i) => (
                              <div key={i} className="flex items-center justify-between">
                                 <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                                    <span className="text-xs font-bold text-white uppercase">{s.name}</span>
                                 </div>
                                 <span className="text-xs font-black text-muted">{s.value}%</span>
                              </div>
                           ))}
                        </div>
                     </Card>

                     <Card className="md:col-span-2 glass-lighter border-none p-10">
                        <div className="flex justify-between items-center mb-8">
                           <h3 className="text-lg font-black text-white uppercase tracking-tighter">Average Ticket Size per Branch</h3>
                           <Button
                              onClick={() => {
                                 const exportData = branchPerfData.map(b => ({
                                    'Branch': b.name,
                                    'Revenue': b.revenue
                                 }));
                                 exportToCSV(exportData, 'Branch_Performance_Summary');
                              }}
                              variant="outline"
                              className="h-8 px-4 rounded-lg border-white/5 text-[8px] font-black uppercase tracking-widest"
                           >
                              Export
                           </Button>
                        </div>
                        <div className="h-64">
                           <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={branchPerfData}>
                                 <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                 <XAxis dataKey="name" stroke="#ffffff30" fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} />
                                 <YAxis stroke="#ffffff30" fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} />
                                 <Tooltip cursor={{ fill: '#ffffff05' }} contentStyle={{ backgroundColor: '#18181b', border: '1px solid #ffffff10', borderRadius: '16px' }} />
                                 <Bar dataKey="revenue" fill="#3b82f6" radius={[8, 8, 0, 0]} barSize={50} />
                              </BarChart>
                           </ResponsiveContainer>
                        </div>
                        <p className="mt-8 text-[10px] font-bold text-muted uppercase tracking-widest text-center">
                           Average customer spend across the network is <span className="text-white">Rs. 342</span>
                        </p>
                     </Card>
                  </div>
               </div>
            )}
            {activeTab === "users" && (
               <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
                  {/* STAFF CONTROLS */}
                  <Card className="glass-lighter border-none p-8">
                     <div className="flex flex-col md:flex-row gap-8 items-end justify-between">
                        <div className="flex gap-6 flex-grow max-w-2xl">
                           <div className="space-y-3 flex-grow">
                              <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Search Staff</label>
                              <input
                                 type="text"
                                 placeholder="Name, Role, or ID..."
                                 value={searchQuery}
                                 onChange={(e) => setSearchQuery(e.target.value)}
                                 className="w-full bg-background border border-border focus:border-amber-500 rounded-xl py-3 px-5 text-sm font-bold text-white outline-none transition-all"
                              />
                           </div>
                           <div className="space-y-3 w-64">
                              <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Filter by Branch</label>
                              <select
                                 value={branchFilter}
                                 onChange={(e) => setBranchFilter(e.target.value)}
                                 className="w-full bg-background border border-border focus:border-amber-500 rounded-xl py-3 px-5 text-sm font-bold text-white outline-none transition-all appearance-none"
                              >
                                 <option>All Branches</option>
                                 {branches.map(b => <option key={b.id}>{b.name}</option>)}
                              </select>
                           </div>
                        </div>
                        <Button onClick={() => setIsAddingStaff(true)} variant="primary" className="h-12 px-8 rounded-xl font-black text-xs tracking-widest uppercase bg-amber-500 text-black shadow-lg shadow-amber-500/20">
                           Add New Staff Member
                        </Button>
                     </div>
                  </Card>

                  {/* STAFF DIRECTORY */}
                  <Card className="glass-lighter border-none overflow-hidden">
                     <div className="p-10 border-b border-white/5">
                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Network Staff Directory</h3>
                     </div>
                     <div className="overflow-x-auto">
                        <table className="w-full text-left">
                           <thead className="bg-white/5 border-b border-white/5">
                              <tr>
                                 <th className="p-8 text-[11px] font-black text-muted uppercase tracking-[0.2em]">Employee</th>
                                 <th className="p-8 text-[11px] font-black text-muted uppercase tracking-[0.2em]">Current Branch</th>
                                 <th className="p-8 text-[11px] font-black text-muted uppercase tracking-[0.2em]">Role</th>
                                 <th className="p-8 text-[11px] font-black text-muted uppercase tracking-[0.2em] text-center">Status</th>
                                 <th className="p-8 text-[11px] font-black text-muted uppercase tracking-[0.2em] text-right">Actions</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-white/5">
                              {filteredStaff.length > 0 ? filteredStaff.map((staff) => (
                                 <tr key={staff.id} className="hover:bg-white/[0.02] transition-colors group">
                                    <td className="p-8">
                                       <div className="flex items-center gap-4">
                                          <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 font-black">
                                             {(staff.full_name || 'U').split(' ').map((n: string) => n[0]).join('')}
                                          </div>
                                          <div>
                                             <p className="text-lg font-black text-white uppercase tracking-tight">{staff.full_name || 'Unknown Staff'}</p>
                                             <p className="text-xs text-muted font-bold uppercase tracking-widest">{staff.role || 'Staff'}</p>
                                          </div>
                                       </div>
                                    </td>
                                    <td className="p-8">
                                       <div className="flex items-center gap-2 text-white font-bold">
                                          <Building2 size={14} className="text-amber-500" />
                                          {(staff.branches as any)?.name || 'Unassigned'}
                                       </div>
                                    </td>
                                    <td className="p-8">
                                       <span className="px-3 py-1 rounded-lg bg-white/5 border border-white/5 text-[10px] font-black text-white uppercase tracking-widest">
                                          {staff.role || 'Staff'}
                                       </span>
                                    </td>
                                    <td className="p-8 text-center">
                                       <div className={cn(
                                          "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest",
                                          staff.is_active !== false ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                                       )}>
                                          <div className={cn("w-1.5 h-1.5 rounded-full", staff.is_active !== false ? "bg-emerald-400" : "bg-orange-400")} />
                                          {staff.is_active !== false ? 'Active' : 'Inactive'}
                                       </div>
                                    </td>
                                    <td className="p-8 text-right">
                                       <div className="flex justify-end gap-2">
                                          <Button
                                             onClick={() => handleUpdateStaffStatus(staff.id, staff.is_active !== false)}
                                             disabled={isSaving}
                                             variant="outline"
                                             className="h-10 px-4 rounded-xl border-white/5 hover:bg-white/5 text-[10px] font-black uppercase tracking-widest"
                                          >
                                             {staff.is_active !== false ? 'Block' : 'Activate'}
                                          </Button>
                                          <Button
                                             onClick={() => handleDeleteStaff(staff.id)}
                                             disabled={isSaving}
                                             variant="secondary"
                                             className="h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                                          >
                                             Delete
                                          </Button>
                                       </div>
                                    </td>
                                 </tr>
                              )) : (
                                 <tr>
                                    <td colSpan={5} className="p-12 text-center">
                                       <div className="flex flex-col items-center justify-center opacity-50">
                                          <Users size={32} className="mb-4 text-amber-500" />
                                          <p className="text-sm font-black text-white uppercase tracking-widest">No Staff Records Found</p>
                                          <p className="text-[10px] font-bold text-muted uppercase tracking-[0.2em] mt-1">Network staff directory is empty</p>
                                       </div>
                                    </td>
                                 </tr>
                              )}
                           </tbody>
                        </table>
                     </div>
                  </Card>
               </div>
            )}
            {activeTab === "settings" && (
               <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                     {/* Global Controls */}
                     <div className="lg:col-span-2 space-y-12">
                        <Card className="glass-lighter border-none p-12">
                           <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-10 flex items-center gap-4">
                              <Globe className="text-amber-500" size={28} />
                              Global System Rules
                           </h3>
                           <div className="space-y-10">
                              <div className="flex items-center justify-between p-8 bg-white/5 rounded-[2rem] border border-white/5 group hover:border-amber-500/30 transition-all">
                                 <div>
                                    <p className="text-lg font-black text-white uppercase tracking-tight">Maintenance Mode</p>
                                    <p className="text-xs text-muted font-bold">Temporarily disable all Kiosks and POS terminals globally.</p>
                                 </div>
                                 <div
                                    onClick={() => setGlobalSettings({ ...globalSettings, maintenance_mode: !globalSettings.maintenance_mode })}
                                    className={cn(
                                       "w-16 h-8 rounded-full p-1 relative cursor-pointer transition-colors",
                                       globalSettings.maintenance_mode ? "bg-red-500" : "bg-background border border-border"
                                    )}
                                 >
                                    <div className={cn("w-6 h-6 bg-white rounded-full transition-all", globalSettings.maintenance_mode ? "translate-x-8" : "translate-x-0")} />
                                 </div>
                              </div>

                              <div className="flex items-center justify-between p-8 bg-white/5 rounded-[2rem] border border-white/5 group hover:border-amber-500/30 transition-all">
                                 <div>
                                    <p className="text-lg font-black text-white uppercase tracking-tight">Audio Alerts</p>
                                    <p className="text-xs text-muted font-bold">Enable real-time voice and sound alerts for new orders.</p>
                                 </div>
                                 <div
                                    onClick={() => setGlobalSettings({ ...globalSettings, audio_alerts: !globalSettings.audio_alerts })}
                                    className={cn(
                                       "w-16 h-8 rounded-full p-1 relative cursor-pointer transition-colors",
                                       globalSettings.audio_alerts ? "bg-amber-500" : "bg-background border border-border"
                                    )}
                                 >
                                    <div className={cn("w-6 h-6 bg-black rounded-full transition-all", globalSettings.audio_alerts ? "translate-x-8" : "translate-x-0")} />
                                 </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6">
                                 <div className="space-y-3">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Global Tax Basis (%)</label>
                                    <input
                                       type="number"
                                       value={globalSettings.tax_percentage}
                                       onChange={(e) => setGlobalSettings({ ...globalSettings, tax_percentage: Number(e.target.value) })}
                                       className="w-full bg-background border border-border focus:border-amber-500 rounded-2xl py-4 px-6 text-lg font-bold text-white outline-none"
                                    />
                                 </div>
                                 <div className="space-y-3">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Session Timeout (Mins)</label>
                                    <input
                                       type="number"
                                       value={globalSettings.session_timeout}
                                       onChange={(e) => setGlobalSettings({ ...globalSettings, session_timeout: Number(e.target.value) })}
                                       className="w-full bg-background border border-border focus:border-amber-500 rounded-2xl py-4 px-6 text-lg font-bold text-white outline-none"
                                    />
                                 </div>
                              </div>

                              {/* Peak Hour Config */}
                              <div className="p-8 bg-amber-500/5 rounded-[2rem] border border-amber-500/10 space-y-8">
                                 <div className="flex items-center gap-4">
                                    <TrendingUp className="text-amber-500" size={24} />
                                    <div>
                                       <p className="text-lg font-black text-white uppercase tracking-tight">Peak Hour Intelligence</p>
                                       <p className="text-xs text-muted font-bold">Automated pricing and surge management for busy periods.</p>
                                    </div>
                                 </div>
                                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-3">
                                       <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Start Time</label>
                                       <input
                                          type="time"
                                          value={globalSettings.peak_hour_start}
                                          onChange={(e) => setGlobalSettings({ ...globalSettings, peak_hour_start: e.target.value })}
                                          className="w-full bg-background border border-border focus:border-amber-500 rounded-xl py-3 px-5 text-sm font-bold text-white outline-none"
                                       />
                                    </div>
                                    <div className="space-y-3">
                                       <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">End Time</label>
                                       <input
                                          type="time"
                                          value={globalSettings.peak_hour_end}
                                          onChange={(e) => setGlobalSettings({ ...globalSettings, peak_hour_end: e.target.value })}
                                          className="w-full bg-background border border-border focus:border-amber-500 rounded-xl py-3 px-5 text-sm font-bold text-white outline-none"
                                       />
                                    </div>
                                    <div className="space-y-3">
                                       <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Price Multiplier (x)</label>
                                       <input
                                          type="number"
                                          step="0.1"
                                          value={globalSettings.peak_hour_multiplier}
                                          onChange={(e) => setGlobalSettings({ ...globalSettings, peak_hour_multiplier: Number(e.target.value) })}
                                          className="w-full bg-background border border-border focus:border-amber-500 rounded-xl py-3 px-5 text-sm font-bold text-white outline-none"
                                       />
                                    </div>
                                 </div>
                              </div>
                           </div>
                        </Card>

                        <Card className="glass-lighter border-none p-12">
                           <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-10">Data & Security</h3>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <Button
                                 onClick={() => alert("Database backup initiated. A download link will be sent to your email.")}
                                 variant="secondary"
                                 className="h-20 rounded-3xl flex flex-col items-center justify-center gap-1 group"
                              >
                                 <FileText size={20} className="group-hover:scale-110 transition-transform" />
                                 <span className="text-[10px] font-black uppercase tracking-widest">Generate Backup</span>
                              </Button>
                              <Button
                                 onClick={() => {
                                    if (confirm("This will force all users to log in again. Proceed?")) {
                                       alert("Global session reset successfully.");
                                    }
                                 }}
                                 variant="outline"
                                 className="h-20 rounded-3xl border-white/5 bg-white/5 hover:bg-red-500/10 hover:border-red-500/20 flex flex-col items-center justify-center gap-1 group text-red-400"
                              >
                                 <LogOut size={20} className="group-hover:scale-110 transition-transform" />
                                 <span className="text-[10px] font-black uppercase tracking-widest text-red-400">Force Logout All</span>
                              </Button>
                           </div>
                        </Card>
                     </div>

                     {/* System Appearance */}
                     <div className="space-y-12">
                        <Card className="glass-lighter border-none p-12">
                           <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-8">Brand Identity</p>
                           <div className="space-y-8">
                              <div className="text-center">
                                 <div className="w-24 h-24 rounded-[2rem] bg-amber-500/10 border-2 border-dashed border-amber-500/30 flex items-center justify-center mx-auto mb-6">
                                    <Globe className="text-amber-500/50" size={32} />
                                 </div>
                                 <Button variant="outline" className="w-full rounded-2xl h-12 text-[10px] font-black uppercase tracking-widest border-white/5">Update Global Logo</Button>
                              </div>

                              <div className="space-y-4">
                                 <p className="text-[10px] font-black text-muted uppercase tracking-widest">Primary System Color</p>
                                 <div className="flex gap-4">
                                    {['#f59e0b', '#3b82f6', '#10b981', '#ec4899'].map(color => (
                                       <div
                                          key={color}
                                          className={cn(
                                             "w-10 h-10 rounded-xl cursor-pointer border-2 transition-all",
                                             color === '#f59e0b' ? "border-white scale-110 shadow-lg shadow-amber-500/20" : "border-transparent opacity-50 hover:opacity-100"
                                          )}
                                          style={{ backgroundColor: color }}
                                       />
                                    ))}
                                 </div>
                              </div>
                           </div>
                        </Card>

                        <Card className="glass-lighter border-none p-12">
                           <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-6">Subscription</p>
                           <div className="bg-amber-500/10 border border-amber-500/20 p-6 rounded-3xl">
                              <p className="text-amber-500 font-black text-lg mb-1">ENTERPRISE PLAN</p>
                              <p className="text-[10px] font-bold text-muted uppercase mb-6">Unlimited Branches</p>
                              <div className="flex justify-between items-center text-white font-bold text-xs">
                                 <span>Renewal Date</span>
                                 <span>Oct 2024</span>
                              </div>
                           </div>
                        </Card>
                     </div>
                  </div>

                  <div className="flex justify-end pt-12 border-t border-white/5">
                     <Button
                        onClick={handleSaveSettings}
                        disabled={isSaving}
                        variant="primary"
                        className="h-16 px-16 rounded-3xl font-black text-sm tracking-widest uppercase bg-amber-500 text-black shadow-2xl shadow-amber-500/30"
                     >
                        {isSaving ? "Saving..." : "Save System Configuration"}
                     </Button>
                  </div>
               </div>
            )}

            {activeTab === "finance" && (
               <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                     <Card className="glass-lighter border-none p-10">
                        <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-2">Total Net Profit</p>
                        <p className="text-4xl font-black text-emerald-400 tracking-tighter">{formatCurrency(kpiStats.profit)}</p>
                        <div className="mt-4 flex items-center gap-2 text-emerald-400 text-[10px] font-black uppercase">
                           <ArrowUpRight size={14} /> 12% vs last month
                        </div>
                     </Card>
                     <Card className="glass-lighter border-none p-10">
                        <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-2">Global Tax Liability</p>
                        <p className="text-4xl font-black text-white tracking-tighter">{formatCurrency(kpiStats.revenue * 0.16)}</p>
                        <p className="mt-4 text-muted text-[10px] font-black uppercase tracking-widest">Q3 Estimated</p>
                     </Card>
                     <Card className="glass-lighter border-none p-10">
                        <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-2">Payroll Commitments</p>
                        <p className="text-4xl font-black text-blue-400 tracking-tighter">{formatCurrency(kpiStats.staff * 25000)}</p>
                        <p className="mt-4 text-muted text-[10px] font-black uppercase tracking-widest">Global Monthly Avg</p>
                     </Card>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                     <Card className="glass-lighter border-none p-12">
                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-10 flex items-center gap-4">
                           <History className="text-amber-500" size={24} />
                           Refunds & Cancellations
                        </h3>
                        <div className="space-y-6">
                           {[
                              { id: '#88A2', amount: 4500, reason: 'Wrong Order', branch: 'Lahore Main', status: 'Approved' },
                              { id: '#91C4', amount: 1200, reason: 'Late Delivery', branch: 'Islamabad HQ', status: 'Pending' },
                           ].map((r, i) => (
                              <div key={i} className="flex justify-between items-center p-6 bg-white/5 rounded-2xl border border-white/5">
                                 <div>
                                    <p className="text-sm font-black text-white">{r.id} • {r.branch}</p>
                                    <p className="text-[10px] text-muted font-bold uppercase mt-1">{r.reason}</p>
                                 </div>
                                 <div className="text-right">
                                    <p className="text-lg font-black text-red-400">-{formatCurrency(r.amount)}</p>
                                    <p className="text-[10px] text-muted font-bold uppercase">{r.status}</p>
                                 </div>
                              </div>
                           ))}
                        </div>
                     </Card>

                     <Card className="glass-lighter border-none p-12">
                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-10 flex items-center gap-4">
                           <Receipt className="text-blue-500" size={24} />
                           Top Expense Categories
                        </h3>
                        <div className="space-y-8">
                           {[
                              { label: 'Inventory / Supplies', value: 65, color: '#f59e0b' },
                              { label: 'Staff Salaries', value: 25, color: '#3b82f6' },
                              { label: 'Marketing', value: 10, color: '#10b981' },
                           ].map((item, i) => (
                              <div key={i} className="space-y-3">
                                 <div className="flex justify-between items-end">
                                    <p className="text-sm font-black text-white uppercase">{item.label}</p>
                                    <p className="text-sm font-black text-white">{item.value}%</p>
                                 </div>
                                 <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${item.value}%`, backgroundColor: item.color }} />
                                 </div>
                              </div>
                           ))}
                        </div>
                     </Card>
                  </div>
               </div>
            )}

            {activeTab === "performance" && (
               <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
                  <Card className="glass-lighter border-none p-12">
                     <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-10 flex items-center gap-4">
                        <LineChart className="text-amber-500" size={28} />
                        Network Demand Forecast
                     </h3>
                     <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                           <AreaChart data={revenueData}>
                              <XAxis dataKey="name" stroke="#ffffff30" fontSize={12} fontWeight="bold" />
                              <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #ffffff10' }} />
                              <Area type="monotone" dataKey="revenue" stroke="#f59e0b" fill="#f59e0b10" strokeDasharray="5 5" name="Forecast" />
                              <Area type="monotone" dataKey="profit" stroke="#3b82f6" fill="#3b82f610" name="Staff Required" />
                           </AreaChart>
                        </ResponsiveContainer>
                     </div>
                     <p className="mt-8 text-xs text-muted font-bold text-center uppercase tracking-widest">★ AI Prediction: Weekend volume expected to increase by 18% based on last 4 weeks trend.</p>
                  </Card>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                     <Card className="glass-lighter border-none p-12">
                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-10">Staff Leaderboard</h3>
                        <div className="space-y-6">
                           {staffPerformance.slice(0, 5).map((p, i) => (
                              <div key={i} className="flex justify-between items-center p-6 bg-white/5 rounded-2xl border border-white/5">
                                 <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-black">#{i + 1}</div>
                                    <div>
                                       <p className="text-sm font-black text-white">{p.name}</p>
                                       <p className="text-[10px] text-muted font-bold uppercase">{p.branch}</p>
                                    </div>
                                 </div>
                                 <div className="text-right">
                                    <p className="text-lg font-black text-white">{formatCurrency(p.revenue)}</p>
                                    <p className="text-[10px] text-emerald-400 font-bold uppercase">{p.orders} Orders</p>
                                 </div>
                              </div>
                           ))}
                        </div>
                     </Card>

                     <Card className="glass-lighter border-none p-12">
                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-10">System Load Audit</h3>
                        <div className="space-y-8">
                           {[
                              { label: 'API Latency', value: '42ms', color: 'text-emerald-400' },
                              { label: 'DB Connections', value: '18/100', color: 'text-blue-400' },
                              { label: 'Storage Usage', value: '4.2 GB', color: 'text-purple-400' },
                              { label: 'Sync Health', value: '100%', color: 'text-emerald-400' },
                           ].map((s, i) => (
                              <div key={i} className="flex justify-between items-center">
                                 <p className="text-sm font-bold text-muted uppercase tracking-widest">{s.label}</p>
                                 <p className={cn("text-xl font-black", s.color)}>{s.value}</p>
                              </div>
                           ))}
                        </div>
                     </Card>
                  </div>
               </div>
            )}

            {/* MODALS */}
            <AnimatePresence>
               {isAddingBranch && (
                  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                     <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsAddingBranch(false)} />
                     <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        className="bg-surface border border-border p-10 rounded-[2.5rem] w-full max-w-lg shadow-2xl relative z-10"
                     >
                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-8">Register Branch</h3>
                        <div className="space-y-6">
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Branch Name</label>
                              <input type="text" value={newBranch.name} onChange={e => setNewBranch({ ...newBranch, name: e.target.value })} className="w-full bg-background border border-border focus:border-amber-500 rounded-xl py-4 px-6 text-sm font-bold text-white outline-none" placeholder="e.g. Lahore Main" />
                           </div>
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Location Address</label>
                              <input type="text" value={newBranch.location} onChange={e => setNewBranch({ ...newBranch, location: e.target.value })} className="w-full bg-background border border-border focus:border-amber-500 rounded-xl py-4 px-6 text-sm font-bold text-white outline-none" placeholder="e.g. Gulberg III" />
                           </div>
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Contact Phone</label>
                              <input type="text" value={newBranch.phone} onChange={e => setNewBranch({ ...newBranch, phone: e.target.value })} className="w-full bg-background border border-border focus:border-amber-500 rounded-xl py-4 px-6 text-sm font-bold text-white outline-none" placeholder="+92 3XX XXXXXXX" />
                           </div>
                           <Button onClick={handleAddBranch} disabled={isSaving} className="w-full h-14 rounded-2xl font-black uppercase bg-amber-500 text-black mt-4">Create Branch</Button>
                        </div>
                     </motion.div>
                  </div>
               )}

               {isAddingStaff && (
                  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                     <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsAddingStaff(false)} />
                     <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        className="bg-surface border border-border p-10 rounded-[2.5rem] w-full max-w-lg shadow-2xl relative z-10"
                     >
                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-8">Add Staff Member</h3>
                        <div className="space-y-6">
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Full Name</label>
                              <input type="text" value={staffForm.name} onChange={e => setStaffForm({ ...staffForm, name: e.target.value })} className="w-full bg-background border border-border focus:border-amber-500 rounded-xl py-4 px-6 text-sm font-bold text-white outline-none" placeholder="Staff Name" />
                           </div>
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Email Address</label>
                              <input type="email" value={staffForm.email} onChange={e => setStaffForm({ ...staffForm, email: e.target.value })} className="w-full bg-background border border-border focus:border-amber-500 rounded-xl py-4 px-6 text-sm font-bold text-white outline-none" placeholder="email@example.com" />
                           </div>
                           <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                 <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Role</label>
                                 <select value={staffForm.role} onChange={e => setStaffForm({ ...staffForm, role: e.target.value })} className="w-full bg-background border border-border focus:border-amber-500 rounded-xl py-4 px-6 text-sm font-bold text-white outline-none appearance-none">
                                    <option value="staff">Staff</option>
                                    <option value="manager">Manager</option>
                                    <option value="rider">Rider</option>
                                    <option value="reception">Reception</option>
                                 </select>
                              </div>
                              <div className="space-y-2">
                                 <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Assign Branch</label>
                                 <select value={staffForm.branch_id} onChange={e => setStaffForm({ ...staffForm, branch_id: e.target.value })} className="w-full bg-background border border-border focus:border-amber-500 rounded-xl py-4 px-6 text-sm font-bold text-white outline-none appearance-none">
                                    <option value="">Select Branch</option>
                                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                 </select>
                              </div>
                           </div>
                           <Button onClick={handleAddStaff} disabled={isSaving} className="w-full h-14 rounded-2xl font-black uppercase bg-amber-500 text-black mt-4">Add Staff Member</Button>
                        </div>
                     </motion.div>
                  </div>
               )}
            </AnimatePresence>
         </main>
      </div>
   );
}
