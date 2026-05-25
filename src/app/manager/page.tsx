"use client";

import { useState, useEffect, useRef, cloneElement } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { 
  Search,
  Check,
  BarChart3, 
  Package, 
  Users, 
  Settings, 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  LayoutDashboard,
  FileText,
  ChevronRight,
  LogOut,
  Edit3,
  Edit2,
  Plus,
  Minus,
  Trash2,
  X,
  ImageIcon,
  Save,
  Tag,
  MonitorSmartphone,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Bell,
  Zap,
  Briefcase,
  Clock,
  UserCheck,
  Package as PackageIcon,
  Download,
  QrCode,
  MessageCircle,
  Send,
  Share2
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
import { useMenuStore } from "@/stores/menuStore";
import { useDeviceStore, DeviceType, DeviceStatus } from "@/stores/useDeviceStore";
import { useFinanceStore, ExpenseCategory, AttendanceStatus } from "@/stores/useFinanceStore";

// All data is now fetched from DB dynamically (see fetchDashboardData below)

export default function ManagerDashboard() {
  const { user, loading: authLoading } = useAuth('Manager');
  const [activeTab, setActiveTab] = useState("dashboard");
  const { 
    categories, products, ingredients, isLoading, error,
    fetchMenu, updateProductStatus, updateProductPrice, updateProduct, 
    addProduct, deleteProduct, addCategory, updateCategory, 
    deleteCategory, updateIngredientStock, updateAddonPrice 
  } = useMenuStore();
  const { devices, fetchDevices, addDevice, updateDeviceStatus, deleteDevice } = useDeviceStore();
  const { expenses, attendance, staffList, shifts, fetchExpenses, fetchAttendance, fetchStaff, fetchShifts, addExpense, markAttendance } = useFinanceStore();
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [newExpense, setNewExpense] = useState({ category: 'ingredients' as ExpenseCategory, amount: '', description: '' });
  const [deviceForm, setDeviceForm] = useState({ name: '', type: 'reception' as DeviceType });
  const [productForm, setProductForm] = useState<{ name: string; description: string; price: string; image_url: string; category_id: string; status: 'available' | 'out_of_stock' | 'hidden' }>({ name: '', description: '', price: '', image_url: '', category_id: '', status: 'available' });
  const [isSaving, setIsSaving] = useState(false);
  const branchIdRef = useRef<string | null>(null);
  const [showAddIngredient, setShowAddIngredient] = useState(false);
  const [ingredientForm, setIngredientForm] = useState({ name: '', unit: 'kg', current_stock: '', low_stock_threshold: '' });
  const [productIngredients, setProductIngredients] = useState<{ ingredient_id: string; role: 'default' | 'addon'; price_adjustment?: number; removal_reduction?: number }[]>([]);

  // Live Dashboard State
  const [weeklyData, setWeeklyData] = useState<{ name: string; sales: number; orders: number }[]>([]);
  const [hourlyData, setHourlyData] = useState<{ hour: string; orders: number }[]>([]);
  const [sourceData, setSourceData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [topItems, setTopItems] = useState<{ name: string; orders: number; color: string }[]>([]);
  const [kpiStats, setKpiStats] = useState({ revenue: 0, orders: 0, pending: 0, avgValue: 0 });
  const [statsLoading, setStatsLoading] = useState(true);
  const [todayDate, setTodayDate] = useState("");
  const [reportData, setReportData] = useState({ revenue: 0, orders: 0, avgValue: 0, list: [] as any[] });
  const [reportDates, setReportDates] = useState({ start: '', end: '' });
  const [chartView, setChartView] = useState<'weekly' | 'monthly'>('weekly');
  const [financeSubTab, setFinanceSubTab] = useState<'expenses' | 'attendance' | 'salaries' | 'shifts'>('expenses');
  const [branchSettings, setBranchSettings] = useState({ name: '', location: '', phone: '', email: '', tax_percentage: 5, currency_symbol: 'Rs.', service_charge: 0 });

  const COLORS = ["#8b5cf6", "#ec4899", "#3b82f6", "#10b981", "#f59e0b"];

  const [showQuickAddIngredient, setShowQuickAddIngredient] = useState(false);
  const [quickIngredientName, setQuickIngredientName] = useState("");
  const [ingredientSearch, setIngredientSearch] = useState("");

  const lowStockItems = ingredients.filter(ing => (ing.current_stock || 0) <= (ing.low_stock_threshold || 0));

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === null || p.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const [quickIngredientRole, setQuickIngredientRole] = useState<'default' | 'addon'>('addon');
  const [quickIngredientPrice, setQuickIngredientPrice] = useState<string>("");

  const handleQuickAdd = async () => {
    if (!quickIngredientName.trim() || isSaving) return;
    if (!branchIdRef.current) {
       alert("Branch ID is missing. Please refresh the page.");
       return;
    }
    setIsSaving(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch('/api/ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: quickIngredientName.trim(),
          unit: 'pcs',
          branch_id: branchIdRef.current
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const result = await response.json();

      if (!response.ok) throw new Error(result.error || 'Failed to add ingredient');

      if (result.data) {
        const priceVal = Number(quickIngredientPrice) || 0;
        setProductIngredients([
          ...productIngredients, 
          { 
            ingredient_id: result.data.id, 
            role: quickIngredientRole, 
            price_adjustment: quickIngredientRole === 'addon' ? priceVal : 0, 
            removal_reduction: quickIngredientRole === 'default' ? priceVal : 0 
          }
        ]);
        setQuickIngredientName("");
        setQuickIngredientPrice("");
        setQuickIngredientRole('addon');
        setShowQuickAddIngredient(false);
        await fetchMenu(branchIdRef.current);
      }
    } catch (err: any) {
      console.error("Quick Add Error:", err);
      alert("Failed to add ingredient: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    setTodayDate(new Date().toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Karachi' }));
  }, []);

  const [staffPerformance, setStaffPerformance] = useState<any[]>([]);

  const fetchDashboardData = async (branchId: string) => {
    setStatsLoading(true);
    try {
      // Fetch branch info for settings
      const { data: bData } = await supabase.from('branches').select('*').eq('id', branchId).single();
      if (bData) {
        setBranchSettings({
          name: bData.name || '',
          location: bData.location || '',
          phone: bData.phone || '',
          email: bData.email || '',
          tax_percentage: Number(bData.tax_percentage) || 5,
          currency_symbol: bData.currency_symbol || 'Rs.',
          service_charge: Number(bData.service_charge) || 0
        });
      }

      // Fetch all orders from last 7 days
      const since7Days = new Date();
      since7Days.setDate(since7Days.getDate() - 6);
      since7Days.setHours(0, 0, 0, 0);

      const { data: orders } = await supabase
        .from('orders')
        .select('id, total, status, payment_status, payment_method, order_source, created_at, user_id')
        .eq('branch_id', branchId)
        .neq('status', 'cancelled')
        .gte('created_at', since7Days.toISOString());

      if (!orders) return;

      // --- KPI Stats (Today only) ---
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayOrders = orders.filter(o => new Date(o.created_at) >= todayStart);
      const paidToday = todayOrders.filter(o => o.payment_status === 'paid');
      const revenue = paidToday.reduce((s, o) => s + (o.total || 0), 0);
      const pending = todayOrders.filter(o => o.payment_status === 'unpaid').length;

      // 2.5 Fetch Total Expenses for Profit calculation (Scoped by current month)
      const thisMonth = new Date();
      thisMonth.setDate(1);
      thisMonth.setHours(0,0,0,0);

      const { data: expensesData } = await supabase
        .from('expenses')
        .select('amount')
        .eq('branch_id', branchId)
        .gte('expense_date', thisMonth.toISOString().split('T')[0]);
        
      const totalExpenses = expensesData?.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) || 0;
      
      const realProfit = revenue - totalExpenses;

      setKpiStats({
        revenue,
        orders: todayOrders.length,
        pending,
        avgValue: realProfit, // Re-using avgValue slot for Net Profit or adding a new field
      });

      // --- Weekly Chart (7 days) ---
      const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      const weekMap: Record<string, { sales: number; orders: number }> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        weekMap[days[d.getDay()]] = { sales: 0, orders: 0 };
      }
      orders.forEach(o => {
        const day = days[new Date(o.created_at).getDay()];
        if (weekMap[day]) {
          weekMap[day].orders++;
          if (o.payment_status === 'paid') weekMap[day].sales += o.total || 0;
        }
      });
      setWeeklyData(Object.entries(weekMap).map(([name, v]) => ({ name, ...v })));

      // --- Staff Performance ---
      const staffMap: Record<string, { orders: number, revenue: number }> = {};
      orders.forEach(o => {
        if (o.user_id) {
          if (!staffMap[o.user_id]) staffMap[o.user_id] = { orders: 0, revenue: 0 };
          staffMap[o.user_id].orders++;
          if (o.payment_status === 'paid') staffMap[o.user_id].revenue += o.total || 0;
        }
      });

      const { data: staffData } = await supabase
        .from('staff')
        .select('id, full_name')
        .eq('branch_id', branchId);
        
      if (staffData) {
        const perf = staffData.map(s => ({
          name: s.full_name,
          orders: staffMap[s.id]?.orders || 0,
          revenue: staffMap[s.id]?.revenue || 0
        })).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
        setStaffPerformance(perf);
      }

      // --- Hourly Chart (Today) ---
      const hourMap: Record<string, number> = {};
      ['9am','10am','11am','12pm','1pm','2pm','3pm','4pm','5pm','6pm','7pm','8pm','9pm','10pm'].forEach(h => hourMap[h] = 0);
      todayOrders.forEach(o => {
        const h = new Date(o.created_at).getHours();
        const label = h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`;
        if (hourMap[label] !== undefined) hourMap[label]++;
        else hourMap[label] = 1;
      });
      setHourlyData(Object.entries(hourMap).map(([hour, orders]) => ({ hour, orders })));

      // --- Source Split Pie ---
      const kioskCount = orders.filter(o => o.order_source === 'kiosk').length;
      const posCount = orders.filter(o => o.order_source === 'pos').length;
      const totalCount = orders.length || 1;
      setSourceData([
        { name: 'Kiosk', value: Math.round((kioskCount / totalCount) * 100), color: '#ea580c' },
        { name: 'Reception', value: Math.round((posCount / totalCount) * 100), color: '#3b82f6' },
      ]);

      // --- Top Items (from order_items) ---
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('product_name, quantity')
        .in('order_id', orders.map(o => o.id));

      const itemMap: Record<string, number> = {};
      (orderItems || []).forEach(item => {
        itemMap[item.product_name] = (itemMap[item.product_name] || 0) + item.quantity;
      });
      const sorted = Object.entries(itemMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, orders], i) => ({ name, orders, color: COLORS[i % COLORS.length] }));
      setTopItems(sorted);

      // Initial report data (last 7 days)
      setReportData({ 
        revenue, 
        orders: orders.length, 
        avgValue: orders.length > 0 ? revenue / orders.length : 0,
        list: orders.slice(0, 10)
      });

    } catch (err) {
      console.error('[RestroSync] Dashboard fetch error:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!branchIdRef.current) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('branches')
        .update({
          name: branchSettings.name,
          location: branchSettings.location,
          phone: branchSettings.phone,
          email: branchSettings.email,
          tax_percentage: branchSettings.tax_percentage,
          currency_symbol: branchSettings.currency_symbol,
          service_charge: branchSettings.service_charge
        })
        .eq('id', branchIdRef.current);
      
      if (error) throw error;
      alert("Settings saved successfully!");
    } catch (err: any) {
      alert("Failed to save: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const fetchReport = async () => {
    if (!branchIdRef.current || !reportDates.start || !reportDates.end) return alert("Select start and end dates");
    setStatsLoading(true);
    try {
      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .eq('branch_id', branchIdRef.current)
        .gte('created_at', new Date(reportDates.start).toISOString())
        .lte('created_at', new Date(reportDates.end).toISOString())
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });

      if (orders) {
        const revenue = orders.filter(o => o.payment_status === 'paid').reduce((s, o) => s + (o.total || 0), 0);
        setReportData({
          revenue,
          orders: orders.length,
          avgValue: orders.length > 0 ? revenue / orders.length : 0,
          list: orders
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setStatsLoading(false);
    }
  };

  const hasInit = useRef(false);

  useEffect(() => {
    if (hasInit.current) return;
    hasInit.current = true;

    const init = async () => {
      // Handle both Supabase Auth and Dummy Auth
      const { data: { session: supabaseSession } } = await supabase.auth.getSession();
      const dummySessionStr = typeof window !== 'undefined' ? sessionStorage.getItem('rms_dummy_session') : null;
      const dummySession = dummySessionStr ? JSON.parse(dummySessionStr) : null;

      if (!supabaseSession && !dummySession) return;

      let branchId: string | null = null;

      // 1. Try to get branch from Supabase profile if session exists
      if (supabaseSession) {
        const { data: profile } = await supabase
          .from('staff')
          .select('branch_id, full_name')
          .eq('auth_user_id', supabaseSession.user.id)
          .single();
        if (profile?.branch_id) branchId = profile.branch_id;
      }

      // 2. If no branch found yet, try dummy session username mapping
      if (!branchId && dummySession?.username) {
        const { data: staff } = await supabase
          .from('staff')
          .select('branch_id')
          .eq('full_name', dummySession.username) // Fallback to matching by name
          .limit(1)
          .single();
        if (staff?.branch_id) branchId = staff.branch_id;
      }

      // 3. Last fallback: use the first available branch
      if (!branchId) {
        const { data: branches } = await supabase.from('branches').select('id').limit(1);
        if (branches?.[0]) branchId = branches[0].id;
      }

      if (branchId) {
        branchIdRef.current = branchId;
        fetchMenu(branchId);
        fetchDashboardData(branchId);
        fetchDevices(branchId);
        fetchExpenses(branchId);
        fetchStaff(branchId);
        fetchShifts(branchId);
        const today = new Date().toISOString().split('T')[0];
        fetchAttendance(branchId, today);
      }
    };
    init();
  }, []); // Run only once on mount

  const sidebarItems = [
    { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={20} /> },
    { id: "finance_hr", label: "Finance & HR", icon: <Briefcase size={20} /> },
    { id: "menu", label: "Menu Management", icon: <Package size={20} /> },
    { id: "inventory", label: "Stock & Inventory", icon: <BarChart3 size={20} /> },
    { id: "devices", label: "Device Management", icon: <MonitorSmartphone size={20} /> },
    { id: "reports", label: "Sales Reports", icon: <FileText size={20} /> },
    { id: "marketing", label: "Marketing & Broadcast", icon: <MessageCircle size={20} /> },
    { id: "qr_manager", label: "QR Code Manager", icon: <QrCode size={20} /> },
    { id: "feedback", label: "Customer Feedback", icon: <ShoppingBag size={20} /> },
    { id: "settings", label: "Branch Settings", icon: <Settings size={20} /> },
  ];

  if (authLoading) return <div className="min-h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="animate-spin text-primary" size={40} /></div>;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* SIDEBAR */}
      <aside className="w-72 bg-surface border-r border-border flex flex-col z-50">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <TrendingUp className="text-black" size={20} />
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tighter uppercase">Manager</h1>
              <p className="text-[10px] font-bold text-muted uppercase tracking-[0.2em]">RestroSync</p>
            </div>
          </div>

          <nav className="space-y-2">
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "w-full flex items-center gap-4 px-4 py-3 rounded-xl font-bold text-sm transition-all duration-300 group text-left",
                  activeTab === item.id 
                    ? "bg-primary/10 text-primary border border-primary/20 shadow-lg shadow-primary/5" 
                    : "text-muted hover:text-white hover:bg-white/5 border border-transparent"
                )}
              >
                <span className={cn(
                  "transition-transform duration-300 group-hover:scale-110",
                  activeTab === item.id ? "text-primary" : "text-muted"
                )}>
                  {item.icon}
                </span>
                {item.label}
                {activeTab === item.id && (
                  <span className="ml-auto">
                    <ChevronRight size={16} />
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-8">
          <button 
            onClick={() => {
               supabase.auth.signOut().then(() => { document.cookie = 'rms_dummy_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'; sessionStorage.removeItem('rms_dummy_session'); window.location.href = '/login'; });
            }}
            className="w-full flex items-center gap-4 px-4 py-3 rounded-xl font-bold text-sm text-red-400 hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20"
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-grow overflow-y-auto custom-scrollbar p-12 bg-[#09090b]">
        <header className="flex justify-between items-center mb-12">
          <div>
            <h2 className="text-4xl font-black text-white uppercase tracking-tighter mb-2">
              {sidebarItems.find(i => i.id === activeTab)?.label}
            </h2>
            <p className="text-muted font-medium">Welcome back, here's what's happening today.</p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* ALERT BELL */}
            <div className="relative group">
              <button className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center transition-all border",
                lowStockItems.length > 0 ? "bg-red-500/10 border-red-500/20 text-red-500 animate-pulse" : "bg-surface border-border text-muted hover:text-white"
              )}>
                <Bell size={20} />
                {lowStockItems.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-[#09090b]">
                    {lowStockItems.length}
                  </span>
                )}
              </button>
              
              {/* Tooltip on hover */}
              {lowStockItems.length > 0 && (
                <div className="absolute right-0 mt-2 w-64 bg-surface border border-border rounded-2xl shadow-2xl p-4 opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-[100]">
                  <p className="text-[10px] font-black text-white uppercase tracking-widest mb-3">Low Stock Alerts</p>
                  <div className="space-y-2">
                    {lowStockItems.slice(0, 3).map(item => (
                      <div key={item.id} className="flex justify-between items-center bg-white/5 p-2 rounded-lg">
                        <span className="text-xs font-bold text-white">{item.name}</span>
                        <span className="text-[10px] font-black text-red-400">{item.current_stock} left</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Button
              variant="outline"
              onClick={() => {
                const exportRows = weeklyData.map(d => ({
                  Day: d.name,
                  Sales: d.sales,
                  Orders: d.orders,
                }));
                exportToCSV(exportRows, `Manager_Sales_Report_${branchSettings.name || 'Branch'}`);
              }}
              className="h-11 px-5 rounded-2xl border-white/10 text-[10px] font-black uppercase tracking-widest gap-2"
            >
              <Download size={15} />
              Export
            </Button>
            <div className="bg-surface border border-border px-6 py-3 rounded-2xl flex items-center gap-3">
              <Calendar className="text-primary" size={18} />
              <span className="text-sm font-bold text-white">{todayDate || '...'}</span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black">
              AD
            </div>
          </div>
        </header>

         {activeTab === "dashboard" && (
          <div className="space-y-10">
            {/* CRITICAL ALERTS BANNER */}
            {lowStockItems.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/10 border border-red-500/20 p-6 rounded-[2rem] flex items-center justify-between"
              >
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-500/20">
                    <Zap size={24} />
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-white uppercase tracking-tighter">Critical Stock Warning</h4>
                    <p className="text-xs text-red-400/80 font-medium">
                      {lowStockItems.length} items are below minimum threshold. Please restock soon.
                    </p>
                  </div>
                </div>
                <Button onClick={() => setActiveTab("inventory")} variant="outline" className="rounded-xl border-red-500/20 text-red-400 hover:bg-red-500/10 px-6 font-black text-[10px] uppercase">
                  Manage Inventory
                </Button>
              </motion.div>
            )}

            {/* STATS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: "Total Revenue", value: formatCurrency(kpiStats.revenue), icon: <DollarSign />, color: "text-emerald-400", trend: kpiStats.revenue > 0 ? "+Live" : "—" },
                { label: "Total Orders", value: `${kpiStats.orders}`, icon: <ShoppingBag />, color: "text-blue-400", trend: kpiStats.orders > 0 ? "+Live" : "—" },
                { label: "Pending Bills", value: `${kpiStats.pending}`, icon: <FileText />, color: "text-orange-400", trend: kpiStats.pending > 0 ? `-${kpiStats.pending}` : "✓ Clear" },
                { label: "Est. Net Profit", value: formatCurrency(kpiStats.avgValue), icon: <TrendingUp />, color: "text-purple-400", trend: kpiStats.avgValue > 0 ? "+Live" : "—" },
              ].map((stat, i) => (
                <Card key={i} className="glass-lighter border-none group hover:scale-[1.02] transition-transform duration-500">
                  <CardContent className="p-8">
                    <div className="flex justify-between items-start mb-6">
                      <div className={cn("p-3 rounded-2xl bg-background/50 border border-white/5", stat.color)}>
                        {stat.icon}
                      </div>
                      <div className={cn(
                        "flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-full",
                        stat.trend.startsWith('+') ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                      )}>
                        {stat.trend.startsWith('+') ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                        {stat.trend}
                      </div>
                    </div>
                    <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">{stat.label}</p>
                    <p className="text-3xl font-black text-white tracking-tighter">{stat.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* CHARTS GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Sales Chart */}
              <Card className="lg:col-span-2 glass-lighter border-none p-8">
                <div className="flex justify-between items-center mb-10">
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter">Revenue Analysis</h3>
                  <div className="flex gap-2 p-1 bg-white/5 rounded-xl">
                    <button 
                      onClick={() => setChartView('weekly')}
                      className={cn(
                        "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all",
                        chartView === 'weekly' ? "bg-primary text-black" : "text-muted hover:text-white"
                      )}
                    >
                      Weekly
                    </button>
                    <button 
                      onClick={() => setChartView('monthly')}
                      className={cn(
                        "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all",
                        chartView === 'monthly' ? "bg-primary text-black" : "text-muted hover:text-white"
                      )}
                    >
                      Monthly
                    </button>
                  </div>
                </div>
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={weeklyData}>
                      <defs>
                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ea580c" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#ea580c" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                      <XAxis 
                        dataKey="name" 
                        stroke="#ffffff30" 
                        fontSize={10} 
                        fontWeight="bold"
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        stroke="#ffffff30" 
                        fontSize={10} 
                        fontWeight="bold"
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `Rs.${value}`}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #ffffff10', borderRadius: '16px' }}
                        itemStyle={{ color: '#ea580c', fontWeight: 'bold' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="sales" 
                        stroke="#ea580c" 
                        strokeWidth={4}
                        fillOpacity={1} 
                        fill="url(#colorSales)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Order Source Pie Chart */}
              <Card className="glass-lighter border-none p-8 flex flex-col">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-8">Order Sources</h3>
                <div className="flex-grow flex items-center justify-center min-h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sourceData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {sourceData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                         contentStyle={{ backgroundColor: '#18181b', border: '1px solid #ffffff10', borderRadius: '16px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-2xl font-black text-white">100%</span>
                    <span className="text-[10px] font-bold text-muted uppercase">Total</span>
                  </div>
                </div>
                <div className="flex justify-center gap-8 mt-4">
                  {sourceData.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-[10px] font-black text-white uppercase">{item.name}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               {/* Staff Performance */}
               <Card className="glass-lighter border-none p-8">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-8">Weekly Staff Performance</h3>
                <div className="space-y-6">
                  {staffPerformance.length > 0 ? staffPerformance.map((staff, i) => (
                    <div key={i} className="flex items-center gap-4 group">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center font-black text-primary text-lg">
                        {staff.name.charAt(0)}
                      </div>
                      <div className="flex-grow">
                        <div className="flex justify-between items-center mb-1">
                          <p className="font-bold text-white text-sm">{staff.name}</p>
                          <p className="font-black text-white text-xs">{formatCurrency(staff.revenue)}</p>
                        </div>
                        <div className="flex justify-between items-center">
                          <p className="text-[10px] text-muted font-bold uppercase">{staff.orders} Orders</p>
                          <div className="w-32 h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${(staff.revenue / (staffPerformance[0]?.revenue || 1)) * 100}%` }}
                              transition={{ duration: 1, delay: i * 0.1 }}
                              className="h-full bg-primary rounded-full"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="py-12 text-center opacity-30">
                      <Users size={40} className="mx-auto mb-3" />
                      <p className="text-xs font-black uppercase tracking-widest">No Performance Data</p>
                    </div>
                  )}
                </div>
              </Card>

               {/* Busiest Hours Chart */}
               <Card className="glass-lighter border-none p-8">
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-10">Busiest Hours (Live Orders)</h3>
                  <div className="h-[300px] w-full">
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={hourlyData}>
                           <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                           <XAxis 
                              dataKey="hour" 
                              stroke="#ffffff30" 
                              fontSize={10} 
                              fontWeight="bold"
                              tickLine={false}
                              axisLine={false}
                           />
                           <YAxis 
                              stroke="#ffffff30" 
                              fontSize={10} 
                              fontWeight="bold"
                              tickLine={false}
                              axisLine={false}
                           />
                           <Tooltip 
                              cursor={{ fill: '#ffffff05' }}
                              contentStyle={{ backgroundColor: '#18181b', border: '1px solid #ffffff10', borderRadius: '16px' }}
                           />
                           <Bar 
                              dataKey="orders" 
                              fill="#ea580c" 
                              radius={[6, 6, 0, 0]}
                              barSize={30}
                           />
                        </BarChart>
                     </ResponsiveContainer>
                  </div>
               </Card>

               {/* Top Items List */}
               <Card className="glass-lighter border-none p-8">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-8">Popular Items</h3>
                <div className="space-y-6">
                  {topItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-4 group">
                      <div 
                        className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-lg transition-transform group-hover:scale-110"
                        style={{ backgroundColor: `${item.color}20`, border: `2px solid ${item.color}30` }}
                      >
                        {item.name.charAt(0)}
                      </div>
                      <div className="flex-grow">
                        <div className="flex justify-between items-center mb-1">
                          <p className="font-bold text-white text-sm">{item.name}</p>
                          <p className="font-black text-white text-xs">{item.orders} Sold</p>
                        </div>
                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(item.orders / (topItems[0]?.orders || 1)) * 100}%` }}
                            transition={{ duration: 1, delay: i * 0.1 }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === "menu" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            {/* TOP STATS ROW - MINIMALIST */}
            <div className="flex gap-4 mb-8 overflow-x-auto pb-2 custom-scrollbar">
               <div className="flex-1 min-w-[200px] bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Package size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest">Total Items</p>
                    <p className="text-xl font-black text-white">{products.length}</p>
                  </div>
               </div>
               <div className="flex-1 min-w-[200px] bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500">
                    <AlertCircle size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest">Out of Stock</p>
                    <p className="text-xl font-black text-white">{products.filter(p => p.status === 'out_of_stock').length}</p>
                  </div>
               </div>
               <div className="flex-1 min-w-[200px] bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                    <Zap size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest">Low Stock</p>
                    <p className="text-xl font-black text-white">{ingredients.filter(ing => (ing.current_stock || 0) <= (ing.low_stock_threshold || 0)).length}</p>
                  </div>
               </div>
               <Button 
                  onClick={() => { setProductForm({ name: '', description: '', price: '', image_url: '', category_id: categories[0]?.id || '', status: 'available' }); setProductIngredients([]); setEditingProduct(null); setShowAddProduct(true); }}
                  className="h-full px-8 rounded-2xl font-black text-xs tracking-widest uppercase gap-3 shadow-xl shadow-primary/20 shrink-0"
               >
                 <Plus size={18} /> New Product
               </Button>
            </div>

            <div className="flex flex-col lg:flex-row gap-8 items-start">
              {/* STICKY SIDEBAR CATEGORIES */}
              <aside className="w-full lg:w-72 sticky top-4 space-y-4">
                <div className="bg-[#0f0f12] border border-white/5 rounded-3xl p-4">
                  <div className="flex items-center justify-between mb-4 px-2">
                    <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">Categories</p>
                    <button onClick={() => setShowAddCategory(true)} className="text-primary hover:scale-110 transition-transform">
                       <Plus size={16} />
                    </button>
                  </div>
                  <div className="space-y-1">
                    <button 
                      onClick={() => setSelectedCategory(null)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all text-left group",
                        selectedCategory === null ? "bg-primary text-black" : "text-muted hover:bg-white/5 hover:text-white"
                      )}
                    >
                      <div className={cn("w-1.5 h-1.5 rounded-full", selectedCategory === null ? "bg-black" : "bg-white/20 group-hover:bg-primary")} />
                      All Menu
                    </button>
                    {categories.map(cat => (
                      <div key={cat.id} className="group/cat relative">
                        <button 
                          onClick={() => setSelectedCategory(cat.id)}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all text-left",
                            selectedCategory === cat.id ? "bg-white text-black" : "text-muted hover:bg-white/5 hover:text-white"
                          )}
                        >
                          <div className={cn("w-1.5 h-1.5 rounded-full", selectedCategory === cat.id ? "bg-black" : "bg-white/20 group-hover:bg-primary")} />
                          <span className="truncate pr-12">{cat.name}</span>
                        </button>
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover/cat:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => { e.stopPropagation(); const n = prompt("Rename Category:", cat.name); if(n) updateCategory(cat.id, n); }}
                            className={cn("p-1.5 rounded-md hover:bg-black/10", selectedCategory === cat.id ? "text-black/50" : "text-white/30")}
                          >
                            <Edit3 size={12} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); if(confirm(`Delete "${cat.name}"?`)) deleteCategory(cat.id); }}
                            className="p-1.5 rounded-md hover:bg-red-500/10 text-red-500/50"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[#0f0f12] border border-white/5 rounded-3xl p-6 relative group">
                   <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary transition-colors" size={16} />
                   <input 
                      type="text" 
                      placeholder="Search menu..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-transparent pl-8 text-sm font-bold text-white outline-none placeholder:text-muted/30"
                   />
                </div>
              </aside>

              {/* PRODUCT GRID - FLEX GROW */}
              <div className="flex-grow">
                <div className="min-h-[400px]">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-32 gap-6">
                      <div className="relative">
                        <Loader2 className="animate-spin text-primary" size={64} />
                        <Package className="absolute inset-0 m-auto text-primary/40" size={24} />
                      </div>
                      <p className="text-muted font-black uppercase tracking-[0.3em] text-[10px]">Initializing...</p>
                    </div>
                  ) : filteredProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 gap-6 bg-white/[0.01] border border-dashed border-white/5 rounded-[3rem]">
                      <div className="w-24 h-24 rounded-[2rem] bg-white/5 flex items-center justify-center text-muted/20">
                         <Package size={48} />
                      </div>
                      <div className="text-center">
                        <h3 className="text-xl font-black text-white uppercase tracking-tighter">No Items Found</h3>
                        <p className="text-[10px] font-black text-muted uppercase tracking-widest mt-2">
                          Try a different search or category
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-20">
                      {filteredProducts.map((product) => (
                        <motion.div
                          layout
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          key={product.id}
                          className="group relative"
                        >
                          <Card className={cn(
                            "bg-[#0f0f12] border border-white/5 rounded-[2.5rem] overflow-hidden transition-all duration-500 hover:border-primary/40",
                            product.status === 'out_of_stock' && "opacity-60"
                          )}>
                            <div className="relative h-48 w-full overflow-hidden">
                              <img 
                                src={product.image_url || "/placeholder-food.jpg"} 
                                alt={product.name} 
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f12] via-transparent to-transparent" />
                              
                              <div className="absolute top-4 left-4">
                                 <div className={cn(
                                   "px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-2 border backdrop-blur-md",
                                   product.status === 'available' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"
                                 )}>
                                   <div className={cn("w-1 h-1 rounded-full", product.status === 'available' ? "bg-emerald-400" : "bg-red-400")} />
                                   {product.status.replace('_', ' ')}
                                 </div>
                              </div>

                              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-3">
                                 <button 
                                    onClick={() => {
                                      setProductForm({
                                        name: product.name,
                                        description: product.description || '',
                                        price: product.price.toString(),
                                        image_url: product.image_url || '',
                                        category_id: product.category_id,
                                        status: product.status
                                      });
                                      setProductIngredients(product.product_ingredients?.map(pi => ({ ingredient_id: pi.ingredient_id, role: pi.role, price_adjustment: pi.price_adjustment })) || []);
                                      setEditingProduct(product);
                                      setShowAddProduct(true);
                                    }}
                                    className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center hover:scale-110 transition-transform"
                                 >
                                    <Edit2 size={16} />
                                 </button>
                                 <button 
                                    onClick={() => { if (confirm(`Delete "${product.name}"?`)) deleteProduct(product.id); }}
                                    className="w-10 h-10 rounded-xl bg-red-500 text-white flex items-center justify-center hover:scale-110 transition-transform"
                                 >
                                    <Trash2 size={16} />
                                 </button>
                              </div>
                            </div>

                            <CardContent className="p-6 pt-0 -mt-4 relative z-10">
                              <h4 className="text-lg font-black text-white uppercase tracking-tighter mb-1 truncate">{product.name}</h4>
                              <p className="text-[10px] text-muted font-bold line-clamp-1 mb-4 h-4 uppercase tracking-widest">{product.description || "Fresh selection"}</p>
                              
                              <div className="space-y-3">
                                <div className="bg-white/[0.03] border border-white/5 p-3 rounded-xl flex items-center justify-between">
                                  <span className="text-[9px] font-black text-muted uppercase">Price</span>
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs font-black text-primary">Rs.</span>
                                    <input 
                                      type="number"
                                      value={product.price}
                                      onChange={(e) => updateProductPrice(product.id, Number(e.target.value))}
                                      className="w-20 bg-transparent text-sm font-black text-white focus:outline-none text-right tabular-nums"
                                    />
                                  </div>
                                </div>

                                <button 
                                   onClick={() => updateProductStatus(product.id, product.status === 'available' ? 'out_of_stock' : 'available')}
                                   className={cn(
                                     "w-full py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all border",
                                     product.status === 'available' ? "border-emerald-500/20 text-emerald-500 hover:bg-emerald-500 hover:text-black" : "border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white"
                                   )}
                                >
                                   {product.status === 'available' ? "Out of Stock" : "In Stock"}
                                </button>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "inventory" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
             <Card className="glass-lighter border-none overflow-hidden">
                <div className="p-8 border-b border-white/5 flex justify-between items-center">
                   <h3 className="text-xl font-black text-white uppercase tracking-tighter">Raw Material Inventory</h3>
                   <div className="flex gap-2">
                     <Button 
                       onClick={() => {
                         const exportData = ingredients.map(i => ({
                           'Ingredient': i.name,
                           'Unit': i.unit,
                           'Current Stock': i.current_stock,
                           'Threshold': i.low_stock_threshold,
                           'Status': (i.current_stock || 0) <= (i.low_stock_threshold || 0) ? 'LOW' : 'OK'
                         }));
                         exportToCSV(exportData, `Inventory_Report_${branchSettings.name || 'Branch'}`);
                       }}
                       variant="outline" 
                       className="rounded-xl h-10 px-4 text-[10px] font-black uppercase tracking-widest border-white/5"
                     >
                       Export CSV
                     </Button>
                     <Button 
                       onClick={() => setShowAddIngredient(true)}
                       variant="primary" 
                       className="rounded-xl text-[10px] font-black uppercase tracking-widest"
                     >
                       Add New Ingredient
                     </Button>
                   </div>
                </div>
                <div className="overflow-x-auto">
                   <table className="w-full text-left">
                      <thead className="bg-white/5 border-b border-white/5">
                         <tr>
                            <th className="p-6 text-[10px] font-black text-muted uppercase tracking-widest">Ingredient Name</th>
                            <th className="p-6 text-[10px] font-black text-muted uppercase tracking-widest text-center">Status</th>
                            <th className="p-6 text-[10px] font-black text-muted uppercase tracking-widest text-center">Current Stock</th>
                            <th className="p-6 text-[10px] font-black text-muted uppercase tracking-widest text-center">Threshold</th>
                            <th className="p-6 text-[10px] font-black text-muted uppercase tracking-widest text-right">Quick Actions</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                         {ingredients.map((ing) => {
                            const isLow = (ing.current_stock || 0) <= (ing.low_stock_threshold || 0);
                            return (
                               <tr key={ing.id} className="hover:bg-white/[0.02] transition-colors group">
                                  <td className="p-6">
                                     <p className="font-bold text-white text-lg">{ing.name}</p>
                                     <p className="text-[10px] text-muted font-bold uppercase tracking-widest">ID: {ing.id.slice(0, 8)}</p>
                                  </td>
                                  <td className="p-6 text-center">
                                     <div className={cn(
                                        "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest",
                                        isLow ? "bg-red-500/20 text-red-400 border border-red-500/20" : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20"
                                     )}>
                                        <div className={cn("w-2 h-2 rounded-full", isLow ? "bg-red-400 animate-pulse" : "bg-emerald-400")} />
                                        {isLow ? "Low Stock" : "In Stock"}
                                     </div>
                                  </td>
                                  <td className="p-6">
                                     <div className="flex flex-col items-center gap-2">
                                        <div className="flex items-center gap-4 bg-background p-2 rounded-xl border border-border mx-auto">
                                           <button 
                                              onClick={() => updateIngredientStock(ing.id, Math.max(0, (ing.current_stock || 0) - 1))}
                                              className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-muted hover:text-white transition-colors"
                                           >
                                              <Minus size={14} />
                                           </button>
                                           <input 
                                              type="number"
                                              value={ing.current_stock || 0}
                                              onChange={(e) => updateIngredientStock(ing.id, Number(e.target.value))}
                                              className="w-16 bg-transparent text-center font-black text-white focus:outline-none"
                                           />
                                           <button 
                                              onClick={() => updateIngredientStock(ing.id, (ing.current_stock || 0) + 1)}
                                              className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-muted hover:text-white transition-colors"
                                           >
                                              <Plus size={14} />
                                           </button>
                                        </div>
                                     </div>
                                  </td>
                                  <td className="p-6 text-center">
                                     <span className="font-black text-muted">{ing.low_stock_threshold || 0}</span>
                                  </td>
                                  <td className="p-6 text-right">
                                     <Button variant="secondary" className="rounded-xl h-10 px-6 text-[10px] font-black uppercase">
                                        Stock History
                                     </Button>
                                  </td>
                               </tr>
                            );
                         })}
                      </tbody>
                   </table>
                   {ingredients.length === 0 && (
                      <div className="p-20 text-center">
                         <p className="text-muted font-bold uppercase tracking-widest">No ingredients found.</p>
                      </div>
                   )}
                </div>
             </Card>
          </div>
        )}

        {activeTab === "devices" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <div className="flex justify-between items-center bg-surface p-6 rounded-[2rem] border border-border">
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Active Devices</h3>
                <p className="text-[10px] font-bold text-muted uppercase tracking-widest mt-1">Manage POS, Kiosk, and Kitchen screens</p>
              </div>
              <Button onClick={() => setShowAddDevice(true)} className="rounded-xl h-12 px-6 font-black uppercase tracking-widest gap-2">
                <Plus size={16} /> Add Device
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {devices.map((device) => (
                <Card key={device.id} className="glass-lighter border-none overflow-hidden relative group">
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    <div className={cn(
                      "px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5",
                      device.status === 'active' ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                    )}>
                      <div className={cn("w-1.5 h-1.5 rounded-full", device.status === 'active' ? "bg-emerald-400 animate-pulse" : "bg-red-400")} />
                      {device.status}
                    </div>
                  </div>
                  <CardContent className="p-8">
                    <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-primary mb-6">
                      <MonitorSmartphone size={24} />
                    </div>
                    <h4 className="text-lg font-black text-white uppercase tracking-tighter mb-1">{device.name}</h4>
                    <p className="text-xs font-bold text-muted uppercase tracking-widest mb-6">Type: {device.type}</p>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <Button 
                        onClick={() => updateDeviceStatus(device.id, device.status === 'active' ? 'inactive' : 'active')}
                        variant={device.status === 'active' ? 'secondary' : 'primary'}
                        className="h-10 rounded-xl text-[9px] font-black uppercase tracking-widest"
                      >
                        {device.status === 'active' ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button 
                        onClick={() => { if(confirm(`Delete device ${device.name}?`)) deleteDevice(device.id); }}
                        variant="ghost" 
                        className="h-10 rounded-xl text-[9px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500/10"
                      >
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {devices.length === 0 && (
                <div className="col-span-full py-12 flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-[2rem]">
                  <MonitorSmartphone size={48} className="text-muted/30 mb-4" />
                  <p className="text-muted font-bold text-sm uppercase tracking-widest">No devices configured</p>
                </div>
              )}
            </div>
          </div>
        )}

            {/* FINANCE & HR TAB */}
            {activeTab === "finance_hr" && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
                {/* SUB-TAB NAVIGATION */}
                <div className="flex gap-4 p-2 bg-white/5 rounded-[2rem] w-fit border border-white/5">
                  {[
                    { id: 'expenses', label: 'Expenses', icon: <DollarSign size={16} /> },
                    { id: 'attendance', label: 'Attendance', icon: <UserCheck size={16} /> },
                    { id: 'salaries', label: 'Salaries', icon: <Briefcase size={16} /> },
                    { id: 'shifts', label: 'Shift Logs', icon: <Clock size={16} /> },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setFinanceSubTab(tab.id as any)}
                      className={cn(
                        "flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
                        financeSubTab === tab.id ? "bg-primary text-black shadow-lg shadow-primary/20" : "text-muted hover:text-white"
                      )}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  {financeSubTab === 'expenses' && (
                    <motion.div key="expenses" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                      <Card className="glass-lighter border-none shadow-2xl shadow-black/20 flex flex-col h-[650px]">
                        <div className="p-8 border-b border-border/50 flex justify-between items-center bg-white/[0.02]">
                          <div>
                            <h2 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                              <DollarSign className="text-amber-500" size={24} />
                              Expense Tracker
                            </h2>
                            <p className="text-muted text-xs font-bold uppercase tracking-widest mt-1">Daily Operational Costs</p>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              onClick={() => {
                                const exportData = expenses.map(e => ({
                                  'Date': new Date(e.expense_date).toLocaleDateString(),
                                  'Category': e.category,
                                  'Description': e.description,
                                  'Amount': e.amount
                                }));
                                exportToCSV(exportData, `Expenses_${branchSettings.name || 'Branch'}`);
                              }}
                              variant="outline" 
                              className="rounded-xl h-10 px-4 text-[10px] font-black uppercase tracking-widest border-white/5"
                            >
                              Export
                            </Button>
                            <Button onClick={() => setShowExpenseModal(true)} variant="primary" className="rounded-xl h-10 px-5 text-[10px] font-black uppercase tracking-widest bg-amber-500 hover:bg-amber-600 text-black shadow-lg shadow-amber-500/20">
                              <Plus size={14} className="mr-2" /> Add Expense
                            </Button>
                          </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                          {expenses.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center opacity-50">
                              <DollarSign size={40} className="mb-4 text-muted" />
                              <p className="text-sm font-black text-white uppercase tracking-widest">No Expenses Logged</p>
                            </div>
                          ) : expenses.map(exp => (
                            <div key={exp.id} className="flex justify-between items-center p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
                              <div className="flex gap-4 items-center">
                                <div className="w-10 h-10 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center font-black">
                                  <Minus size={18} />
                                </div>
                                <div>
                                  <p className="text-sm font-black text-white uppercase tracking-wider">{exp.category}</p>
                                  <p className="text-xs text-muted font-bold truncate max-w-[200px]">{exp.description}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-black text-red-400 tracking-tighter">Rs. {exp.amount.toLocaleString()}</p>
                                <p className="text-[10px] text-muted font-bold uppercase tracking-widest">{new Date(exp.expense_date).toLocaleDateString()}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </Card>
                    </motion.div>
                  )}

                  {financeSubTab === 'attendance' && (
                    <motion.div key="attendance" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                      <Card className="glass-lighter border-none shadow-2xl shadow-black/20 flex flex-col h-[650px]">
                        <div className="p-8 border-b border-border/50 flex justify-between items-center bg-white/[0.02]">
                          <div>
                            <h2 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                              <UserCheck className="text-emerald-400" size={24} />
                              Staff Attendance
                            </h2>
                            <p className="text-muted text-xs font-bold uppercase tracking-widest mt-1">Today's Roster</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <Button 
                              onClick={() => {
                                const exportData = staffList.map(s => {
                                  const att = attendance.find(a => a.profile_id === s.id);
                                  return {
                                    'Name': s.full_name,
                                    'Role': s.role,
                                    'Status': att?.status || 'Pending',
                                    'Time': att?.check_in_time ? new Date(att.check_in_time).toLocaleTimeString() : 'N/A'
                                  };
                                });
                                exportToCSV(exportData, `Attendance_${new Date().toISOString().split('T')[0]}`);
                              }}
                              variant="outline" 
                              className="h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest border-white/5"
                            >
                              Export
                            </Button>
                            <div className="bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
                              {new Date().toLocaleDateString('en-PK', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </div>
                          </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                          {staffList.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center opacity-50">
                              <Users size={40} className="mb-4 text-muted" />
                              <p className="text-sm font-black text-white uppercase tracking-widest">No Staff Found</p>
                            </div>
                          ) : staffList.map(staff => {
                            const todayStr = new Date().toISOString().split('T')[0];
                            const att = attendance.find(a => a.profile_id === staff.id);
                            const isPresent = att?.status === 'present';

                            return (
                              <div key={staff.id} className="flex justify-between items-center p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
                                <div className="flex gap-4 items-center">
                                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center font-black">
                                    {staff.full_name.split(' ').map((n: string) => n[0]).join('')}
                                  </div>
                                  <div>
                                    <p className="text-sm font-black text-white uppercase tracking-wider">{staff.full_name}</p>
                                    <p className="text-[10px] text-muted font-bold uppercase tracking-widest">{staff.role}</p>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button 
                                    onClick={() => markAttendance(staff.id, branchIdRef.current!, 'present', todayStr)}
                                    variant="outline" 
                                    className={`h-10 px-4 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${isPresent ? 'bg-emerald-500 text-black border-transparent' : 'border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10'}`}
                                  >
                                    {isPresent ? 'Present' : 'Mark In'}
                                  </Button>
                                  <Button 
                                    onClick={() => markAttendance(staff.id, branchIdRef.current!, 'absent', todayStr)}
                                    variant="outline" 
                                    className={`h-10 px-4 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${att?.status === 'absent' ? 'bg-red-500 text-white border-transparent' : 'border-red-500/20 text-red-400 hover:bg-red-500/10'}`}
                                  >
                                    {att?.status === 'absent' ? 'Absent' : 'Mark Out'}
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </Card>
                    </motion.div>
                  )}

                  {financeSubTab === 'salaries' && (
                    <motion.div key="salaries" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                      <Card className="glass-lighter border-none shadow-2xl shadow-black/20 overflow-hidden">
                        <div className="p-8 border-b border-white/5 flex justify-between items-center">
                          <h3 className="text-xl font-black text-white uppercase tracking-tighter">Staff Salaries</h3>
                          <Button variant="outline" className="rounded-xl text-[10px] font-black uppercase tracking-widest border-white/5">Generate Payroll</Button>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead className="bg-white/5 border-b border-white/5">
                              <tr>
                                <th className="p-6 text-[10px] font-black text-muted uppercase tracking-widest">Employee</th>
                                <th className="p-6 text-[10px] font-black text-muted uppercase tracking-widest text-center">Base Salary</th>
                                <th className="p-6 text-[10px] font-black text-muted uppercase tracking-widest text-center">Attendance (%)</th>
                                <th className="p-6 text-[10px] font-black text-muted uppercase tracking-widest text-center">Bonuses</th>
                                <th className="p-6 text-[10px] font-black text-muted uppercase tracking-widest text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {staffList.map(staff => (
                                <tr key={staff.id} className="hover:bg-white/[0.02] transition-colors group">
                                  <td className="p-6">
                                    <p className="font-bold text-white">{staff.full_name}</p>
                                    <p className="text-[10px] text-muted font-bold uppercase">{staff.role}</p>
                                  </td>
                                  <td className="p-6 text-center text-white font-black">{formatCurrency(staff.salary || 25000)}</td>
                                  <td className="p-6 text-center">
                                    <span className="text-emerald-400 font-bold">92%</span>
                                  </td>
                                  <td className="p-6 text-center text-emerald-400 font-black">+Rs. 0</td>
                                  <td className="p-6 text-right">
                                    <Button size="sm" variant="secondary" className="rounded-xl text-[8px] font-black uppercase">Pay Now</Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Card>
                    </motion.div>
                  )}

                  {financeSubTab === 'shifts' && (
                    <motion.div key="shifts" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                      <Card className="glass-lighter border-none shadow-2xl shadow-black/20 overflow-hidden">
                        <div className="p-8 border-b border-border/50 flex justify-between items-center bg-white/[0.02]">
                          <div>
                            <h2 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                              <Clock className="text-primary" size={24} />
                              Shift History & Reconciliation
                            </h2>
                            <p className="text-muted text-xs font-bold uppercase tracking-widest mt-1">Cash Drawer Audit Log</p>
                          </div>
                          <Button 
                            onClick={() => {
                              const exportData = shifts.map(s => ({
                                'Opened By': s.opened_by_staff?.full_name || 'Staff',
                                'Opened At': new Date(s.opened_at).toLocaleString(),
                                'Status': s.status,
                                'Opening Float': s.opening_float,
                                'Expected Cash': s.expected_cash || 0,
                                'Actual Cash': s.actual_cash || 0,
                                'Variance': (s.actual_cash || 0) - (s.expected_cash || 0)
                              }));
                              exportToCSV(exportData, `Shift_History_${branchSettings.name || 'Branch'}`);
                            }}
                            variant="outline" 
                            className="rounded-xl h-10 px-4 text-[10px] font-black uppercase tracking-widest border-white/5"
                          >
                            Export Shift Log
                          </Button>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead className="bg-white/5 border-b border-white/5">
                              <tr>
                                <th className="p-6 text-[10px] font-black text-muted uppercase tracking-widest">Shift Period</th>
                                <th className="p-6 text-[10px] font-black text-muted uppercase tracking-widest text-right">Float</th>
                                <th className="p-6 text-[10px] font-black text-muted uppercase tracking-widest text-right">Cash Sales</th>
                                <th className="p-6 text-[10px] font-black text-muted uppercase tracking-widest text-right">Expected</th>
                                <th className="p-6 text-[10px] font-black text-muted uppercase tracking-widest text-right">Actual</th>
                                <th className="p-6 text-[10px] font-black text-muted uppercase tracking-widest text-center">Variance</th>
                                <th className="p-6 text-[10px] font-black text-muted uppercase tracking-widest text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {shifts.map((shift) => {
                                const cashSales = (shift.expected_cash || 0) - (shift.opening_float || 0);
                                const variance = (shift.actual_cash || 0) - (shift.expected_cash || 0);
                                const isShort = variance < 0;
                                const isOver = variance > 0;

                                return (
                                  <tr key={shift.id} className="hover:bg-white/[0.02] transition-colors group text-sm font-bold">
                                    <td className="p-6">
                                      <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary text-[10px] font-black border border-primary/20">
                                          {shift.opened_by_staff?.full_name?.[0] || 'U'}
                                        </div>
                                        <div>
                                          <p className="text-white text-xs font-black">{shift.opened_by_staff?.full_name || 'Staff'}</p>
                                          <p className="text-[10px] text-muted font-bold uppercase">
                                            {new Date(shift.opened_at).toLocaleDateString()} • {new Date(shift.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                          </p>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="p-6 text-right text-muted tabular-nums">{formatCurrency(shift.opening_float)}</td>
                                    <td className="p-6 text-right text-emerald-400 tabular-nums">+{formatCurrency(cashSales > 0 ? cashSales : 0)}</td>
                                    <td className="p-6 text-right text-white font-black tabular-nums">{formatCurrency(shift.expected_cash || 0)}</td>
                                    <td className="p-6 text-right text-white font-black tabular-nums">{shift.actual_cash !== null ? formatCurrency(shift.actual_cash) : '—'}</td>
                                    <td className="p-6 text-center">
                                      {shift.status === 'closed' ? (
                                        <span className={cn(
                                          "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border",
                                          variance === 0 ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : 
                                          isShort ? "text-red-400 bg-red-500/10 border-red-500/20" : 
                                          "text-amber-400 bg-amber-500/10 border-amber-500/20"
                                        )}>
                                          {variance === 0 ? "Balanced" : `${isShort ? '' : '+'}${formatCurrency(variance)}`}
                                        </span>
                                      ) : (
                                        <span className="text-primary text-[10px] font-black uppercase tracking-widest animate-pulse">In Progress</span>
                                      )}
                                    </td>
                                    <td className="p-6 text-center">
                                      <span className={cn(
                                        "px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest",
                                        shift.status === 'open' ? "bg-emerald-500 text-black" : "bg-white/10 text-muted"
                                      )}>
                                        {shift.status}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          {shifts.length === 0 && (
                            <div className="p-20 text-center flex flex-col items-center gap-4 opacity-30">
                              <Clock size={48} />
                              <p className="text-sm font-black uppercase tracking-widest">No Shift History Found</p>
                            </div>
                          )}
                        </div>
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

        {activeTab === "reports" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
             {/* Report Controls */}
             <Card className="glass-lighter border-none p-8">
                <div className="flex flex-col md:flex-row gap-8 items-end justify-between">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-grow max-w-2xl">
                      <div className="space-y-3">
                         <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-1">Start Date</label>
                         <div className="relative">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={16} />
                            <input 
                               type="date" 
                               value={reportDates.start}
                               onChange={(e) => setReportDates({ ...reportDates, start: e.target.value })}
                               className="w-full bg-background border border-border focus:border-primary rounded-xl py-3 pl-12 pr-5 text-sm font-bold text-white outline-none transition-all"
                            />
                         </div>
                      </div>
                      <div className="space-y-3">
                         <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-1">End Date</label>
                         <div className="relative">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={16} />
                            <input 
                               type="date" 
                               value={reportDates.end}
                               onChange={(e) => setReportDates({ ...reportDates, end: e.target.value })}
                               className="w-full bg-background border border-border focus:border-primary rounded-xl py-3 pl-12 pr-5 text-sm font-bold text-white outline-none transition-all"
                            />
                         </div>
                      </div>
                   </div>
                   <div className="flex gap-4 w-full md:w-auto">
                      <Button onClick={fetchReport} variant="primary" className="flex-grow md:flex-initial h-12 px-8 rounded-xl font-black text-xs tracking-widest uppercase shadow-lg shadow-primary/20">
                         Generate Report
                      </Button>
                      <Button variant="outline" className="h-12 w-12 p-0 flex items-center justify-center rounded-xl border-white/10 hover:bg-white/5 transition-all">
                         <FileText size={20} className="text-muted" />
                      </Button>
                   </div>
                </div>
             </Card>

             {/* Period Stats */}
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                   { label: "Period Revenue", value: formatCurrency(reportData.revenue), icon: <DollarSign />, color: "text-emerald-400" },
                   { label: "Period Orders", value: `${reportData.orders}`, icon: <ShoppingBag />, color: "text-blue-400" },
                   { label: "Avg Sale Value", value: formatCurrency(reportData.avgValue), icon: <TrendingUp />, color: "text-purple-400" },
                ].map((stat, i) => (
                   <Card key={i} className="glass-lighter border-none p-8 relative overflow-hidden">
                      <div className="relative z-10">
                         <div className={cn("p-3 w-fit rounded-2xl bg-background/50 border border-white/5 mb-6", stat.color)}>
                            {stat.icon}
                         </div>
                         <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">{stat.label}</p>
                         <p className="text-3xl font-black text-white tracking-tighter">{stat.value}</p>
                      </div>
                      <div className="absolute -right-4 -bottom-4 opacity-5">
                         {stat.icon && cloneElement(stat.icon as any, { size: 120 })}
                      </div>
                   </Card>
                ))}
             </div>

             {/* Detailed Log */}
             <Card className="glass-lighter border-none overflow-hidden">
                <div className="p-8 border-b border-white/5 flex justify-between items-center">
                   <h3 className="text-xl font-black text-white uppercase tracking-tighter">Transaction History</h3>
                   <div className="flex gap-2">
                      <Button variant="outline" className="rounded-lg h-8 px-4 text-[8px] font-black uppercase tracking-widest border-white/5">Export CSV</Button>
                      <Button variant="outline" className="rounded-lg h-8 px-4 text-[8px] font-black uppercase tracking-widest border-white/5">Export PDF</Button>
                   </div>
                </div>
                <div className="overflow-x-auto">
                   <table className="w-full text-left">
                      <thead className="bg-white/5 border-b border-white/5">
                         <tr>
                            <th className="p-6 text-[10px] font-black text-muted uppercase tracking-widest">Order #</th>
                            <th className="p-6 text-[10px] font-black text-muted uppercase tracking-widest">Date & Time</th>
                            <th className="p-6 text-[10px] font-black text-muted uppercase tracking-widest text-center">Type</th>
                            <th className="p-6 text-[10px] font-black text-muted uppercase tracking-widest text-center">Payment</th>
                            <th className="p-6 text-[10px] font-black text-muted uppercase tracking-widest text-right">Total Amount</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                          {reportData.list.map((order) => (
                             <tr key={order.id} className="hover:bg-white/[0.02] transition-colors group">
                                <td className="p-6">
                                   <span className="font-black text-white text-lg">#{order.id.slice(-4).toUpperCase()}</span>
                                </td>
                                <td className="p-6">
                                   <p className="font-bold text-white text-sm">{new Date(order.created_at).toLocaleDateString()}</p>
                                   <p className="text-[10px] text-muted font-bold uppercase tracking-widest">{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                </td>
                                <td className="p-6 text-center">
                                   <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-[8px] font-black uppercase tracking-widest border border-blue-500/20">
                                      {order.order_source || 'POS'}
                                   </span>
                                </td>
                                <td className="p-6 text-center">
                                   <span className={cn(
                                     "px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border",
                                     order.payment_status === 'paid' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                   )}>
                                      {order.payment_status} ({order.payment_method})
                                   </span>
                                </td>
                                <td className="p-6 text-right">
                                   <span className="font-black text-primary text-lg">{formatCurrency(order.total)}</span>
                                </td>
                             </tr>
                          ))}
                       </tbody>
                   </table>
                </div>
             </Card>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Branch Identity */}
                <div className="lg:col-span-2 space-y-8">
                   <Card className="glass-lighter border-none p-10">
                      <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-8 flex items-center gap-3">
                         <Settings className="text-primary" size={24} />
                         Branch Identity
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-3">
                             <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-1">Restaurant Name</label>
                             <input 
                                type="text" 
                                value={branchSettings.name}
                                onChange={(e) => setBranchSettings({...branchSettings, name: e.target.value})}
                                className="w-full bg-background border border-border focus:border-primary rounded-xl py-3 px-5 text-sm font-bold text-white outline-none transition-all"
                             />
                          </div>
                          <div className="space-y-3">
                             <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-1">Branch Location</label>
                             <input 
                                type="text" 
                                value={branchSettings.location}
                                onChange={(e) => setBranchSettings({...branchSettings, location: e.target.value})}
                                className="w-full bg-background border border-border focus:border-primary rounded-xl py-3 px-5 text-sm font-bold text-white outline-none transition-all"
                             />
                          </div>
                          <div className="space-y-3">
                             <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-1">Contact Phone</label>
                             <input 
                                type="text" 
                                value={branchSettings.phone}
                                onChange={(e) => setBranchSettings({...branchSettings, phone: e.target.value})}
                                className="w-full bg-background border border-border focus:border-primary rounded-xl py-3 px-5 text-sm font-bold text-white outline-none transition-all"
                             />
                          </div>
                          <div className="space-y-3">
                             <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-1">Support Email</label>
                             <input 
                                type="email" 
                                value={branchSettings.email}
                                onChange={(e) => setBranchSettings({...branchSettings, email: e.target.value})}
                                className="w-full bg-background border border-border focus:border-primary rounded-xl py-3 px-5 text-sm font-bold text-white outline-none transition-all"
                             />
                          </div>
                      </div>
                   </Card>

                   <Card className="glass-lighter border-none p-10">
                      <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-8 flex items-center gap-3">
                         <DollarSign className="text-emerald-400" size={24} />
                         Financial Settings
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                          <div className="space-y-3">
                             <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-1">Currency Symbol</label>
                             <input 
                                type="text" 
                                value={branchSettings.currency_symbol}
                                onChange={(e) => setBranchSettings({...branchSettings, currency_symbol: e.target.value})}
                                className="w-full bg-background border border-border focus:border-primary rounded-xl py-3 px-5 text-sm font-black text-white outline-none transition-all"
                             />
                          </div>
                          <div className="space-y-3">
                             <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-1">Tax Percentage (%)</label>
                             <input 
                                type="number" 
                                value={branchSettings.tax_percentage}
                                onChange={(e) => setBranchSettings({...branchSettings, tax_percentage: Number(e.target.value)})}
                                className="w-full bg-background border border-border focus:border-primary rounded-xl py-3 px-5 text-sm font-black text-white outline-none transition-all"
                             />
                          </div>
                         <div className="space-y-3">
                            <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-1">Service Charge (Fixed)</label>
                            <input 
                               type="number" 
                               value={branchSettings.service_charge}
                               onChange={(e) => setBranchSettings({...branchSettings, service_charge: Number(e.target.value)})}
                               className="w-full bg-background border border-border focus:border-primary rounded-xl py-3 px-5 text-sm font-black text-white outline-none transition-all"
                            />
                         </div>
                      </div>
                   </Card>
                </div>

                {/* Right Column: Logo & System */}
                <div className="space-y-8">
                   <Card className="glass-lighter border-none p-10 text-center">
                      <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-6">Branch Logo</p>
                      <div className="w-32 h-32 rounded-3xl bg-background border-2 border-dashed border-border flex items-center justify-center mx-auto mb-6 group hover:border-primary transition-all cursor-pointer overflow-hidden relative">
                         <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Plus className="text-primary" size={32} />
                         </div>
                         <TrendingUp className="text-muted/20" size={48} />
                      </div>
                      <Button variant="outline" className="w-full rounded-xl h-12 text-[10px] font-black uppercase tracking-widest border-white/5">Change Logo</Button>
                   </Card>

                   <Card className="glass-lighter border-none p-10">
                      <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-6">System Status</p>
                      <div className="space-y-6">
                         <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-white">POS Terminal</span>
                            <span className="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-[8px] font-black uppercase tracking-widest">Active</span>
                         </div>
                         <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-white">Kiosk Mode</span>
                            <span className="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-[8px] font-black uppercase tracking-widest">Active</span>
                         </div>
                         <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-white">Cloud Sync</span>
                            <span className="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-[8px] font-black uppercase tracking-widest">Live</span>
                         </div>
                      </div>
                   </Card>
                </div>
             </div>

             <div className="flex justify-end pt-10 border-t border-white/5">
                <Button 
                  onClick={saveSettings}
                  disabled={isSaving}
                  variant="primary" 
                  className="h-14 px-12 rounded-2xl font-black text-sm tracking-widest uppercase shadow-xl shadow-primary/30"
                >
                   {isSaving ? "Saving..." : "Save Changes"}
                </Button>
             </div>
          </div>
        )}
        {activeTab === "feedback" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <div className="flex justify-between items-center bg-surface p-8 rounded-[3rem] border border-border">
              <div>
                <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Customer Feedback</h3>
                <p className="text-[10px] font-bold text-muted uppercase tracking-widest mt-1">Review ratings and comments from the Kiosk</p>
              </div>
              <div className="bg-primary/10 border border-primary/20 px-6 py-3 rounded-2xl flex items-center gap-4">
                 <div className="text-center">
                    <p className="text-[10px] text-primary font-black uppercase tracking-widest">Avg Rating</p>
                    <p className="text-2xl font-black text-white">4.8 / 5.0</p>
                 </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {[
                 { user: 'Hassan Ali', rating: 5, comment: 'Amazing food and super fast service via the kiosk!', date: 'Today' },
                 { user: 'Sara Khan', rating: 4, comment: 'Really liked the customization options. Pizza was hot.', date: 'Yesterday' },
                 { user: 'Zainab B.', rating: 5, comment: 'The UI is very easy to use. Best restaurant tech in town.', date: '2 days ago' },
               ].map((fb, i) => (
                 <Card key={i} className="glass-lighter border-none p-8 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center font-black text-white">
                          {fb.user[0]}
                        </div>
                        <div className="flex gap-1">
                          {[...Array(fb.rating)].map((_, j) => <div key={j} className="w-2 h-2 rounded-full bg-primary" />)}
                        </div>
                      </div>
                      <p className="text-white font-bold mb-2">{fb.user}</p>
                      <p className="text-sm text-muted italic leading-relaxed">"{fb.comment}"</p>
                    </div>
                    <p className="text-[10px] text-muted font-black uppercase tracking-widest mt-8">{fb.date}</p>
                 </Card>
               ))}
            </div>
          </div>
        )}
        {activeTab === "marketing" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <Card className="glass-lighter border-none p-10">
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-8 flex items-center gap-4">
                    <MessageCircle className="text-primary" size={28} />
                    WhatsApp Broadcast Composer
                  </h3>
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Target Audience</label>
                      <select className="w-full bg-background border border-border focus:border-primary rounded-xl py-4 px-6 text-sm font-bold text-white outline-none">
                        <option>All Customers (1,240)</option>
                        <option>Recent Customers (Last 30 Days)</option>
                        <option>High Spenders (Top 10%)</option>
                        <option>Inactive Customers (60+ Days)</option>
                      </select>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Broadcast Message</label>
                      <textarea 
                        rows={6}
                        placeholder="Type your promotion here... Use {name} for personalization."
                        className="w-full bg-background border border-border focus:border-primary rounded-2xl py-4 px-6 text-sm font-medium text-white outline-none resize-none"
                      />
                    </div>
                    <div className="flex gap-4">
                      <Button variant="outline" className="flex-grow h-12 rounded-xl text-[10px] font-black uppercase tracking-widest border-white/5">
                        Save as Draft
                      </Button>
                      <Button variant="primary" className="flex-grow h-12 rounded-xl text-[10px] font-black uppercase tracking-widest bg-primary text-black shadow-lg shadow-primary/20">
                        <Send size={14} className="mr-2" /> Send Broadcast
                      </Button>
                    </div>
                  </div>
                </Card>

                <Card className="glass-lighter border-none p-10">
                  <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-6">Recent Campaigns</p>
                  <div className="space-y-4">
                    {[
                      { name: 'Eid Special Discount', sent: '2 days ago', reach: '1,100 users', status: 'delivered' },
                      { name: 'Weekend Pizza BOGO', sent: '1 week ago', reach: '950 users', status: 'delivered' },
                    ].map((c, i) => (
                      <div key={i} className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/5">
                        <div>
                          <p className="text-sm font-black text-white uppercase">{c.name}</p>
                          <p className="text-[10px] text-muted font-bold uppercase mt-1">{c.sent} • {c.reach}</p>
                        </div>
                        <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[8px] font-black uppercase tracking-widest">
                          {c.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              <div className="space-y-8">
                <Card className="glass-lighter border-none p-8">
                  <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-6">Engagement Stats</p>
                  <div className="space-y-6">
                    <div>
                      <p className="text-2xl font-black text-white">12.4%</p>
                      <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Avg Click Rate</p>
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-primary w-[12.4%]" />
                    </div>
                    <div>
                      <p className="text-2xl font-black text-white">88%</p>
                      <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Delivery Success</p>
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 w-[88%]" />
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        )}

        {activeTab === "qr_manager" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-3xl font-black text-white uppercase tracking-tighter">QR Code Manager</h3>
                <p className="text-[10px] font-bold text-muted uppercase tracking-widest mt-1">Generate and manage Kiosk scan codes</p>
              </div>
              <Button variant="primary" className="h-12 px-8 rounded-2xl font-black text-xs tracking-widest uppercase">
                <Plus size={16} className="mr-2" /> Generate New Batch
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <Card key={i} className="glass-lighter border-none p-8 text-center group hover:scale-[1.02] transition-all">
                  <div className="w-full aspect-square bg-white rounded-2xl mb-6 p-4 flex items-center justify-center relative overflow-hidden">
                    <QrCode size={120} className="text-black" />
                    <div className="absolute inset-0 bg-primary/90 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                       <Button size="sm" variant="secondary" className="rounded-xl text-[8px] font-black uppercase">Download PNG</Button>
                       <Button size="sm" variant="secondary" className="rounded-xl text-[8px] font-black uppercase">Copy URL</Button>
                    </div>
                  </div>
                  <p className="text-lg font-black text-white uppercase tracking-tight">Table {i}</p>
                  <p className="text-[10px] text-muted font-black uppercase tracking-widest mt-1">Dine-in Kiosk</p>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ADD / EDIT PRODUCT MODAL */}
      <AnimatePresence>
        {showAddProduct && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowAddProduct(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-surface border border-border p-8 rounded-[3rem] w-full max-w-5xl shadow-2xl relative z-10 overflow-y-auto max-h-[90vh] custom-scrollbar"
            >
              <div className="flex justify-between items-center mb-8 pb-4 border-b border-white/5">
                <div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter">{editingProduct ? "Edit Product" : "Create New Product"}</h3>
                  <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mt-1">Product Configuration System</p>
                </div>
                <button onClick={() => setShowAddProduct(false)} className="w-10 h-10 rounded-xl bg-background border border-border flex items-center justify-center text-muted hover:text-white transition-all hover:border-primary">
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* Left Column: Basic Info */}
                <div className="lg:col-span-5 space-y-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest mb-2 block">Product Identity</label>
                      <input
                        type="text"
                        value={productForm.name}
                        onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                        className="w-full bg-background border border-border focus:border-primary rounded-xl py-3 px-4 text-sm font-bold text-white outline-none transition-all"
                        placeholder="Product name..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black text-muted uppercase tracking-widest mb-2 block">Base Price (Rs.)</label>
                        <input
                          type="number"
                          value={productForm.price}
                          onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                          className="w-full bg-background border border-border focus:border-primary rounded-xl py-3 px-4 text-sm font-black text-white outline-none transition-all"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-muted uppercase tracking-widest mb-2 block">Category</label>
                        <select
                          value={productForm.category_id}
                          onChange={(e) => setProductForm({ ...productForm, category_id: e.target.value })}
                          className="w-full bg-background border border-border focus:border-primary rounded-xl py-3 px-4 text-sm font-bold text-white outline-none transition-all appearance-none"
                        >
                          <option value="" disabled>Select Category</option>
                          {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest mb-2 block">Display Status</label>
                      <div className="grid grid-cols-3 gap-2">
                        {['available', 'out_of_stock', 'hidden'].map((status) => (
                          <button
                            key={status}
                            type="button"
                            onClick={() => setProductForm({ ...productForm, status: status as any })}
                            className={cn(
                              "py-2 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all",
                              productForm.status === status 
                                ? "bg-primary text-black border-primary" 
                                : "bg-background/50 text-muted border-border hover:border-white/20"
                            )}
                          >
                            {status.replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest mb-2 block">Cover Image</label>
                      <div className="flex gap-3">
                        <div className="flex-grow">
                           <input
                              type="text"
                              value={productForm.image_url}
                              onChange={(e) => setProductForm({ ...productForm, image_url: e.target.value })}
                              className="w-full bg-background border border-border focus:border-primary rounded-xl py-3 px-4 text-sm font-bold text-white outline-none transition-all"
                              placeholder="Image URL..."
                           />
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-background border border-border flex items-center justify-center overflow-hidden shrink-0 group relative">
                          {productForm.image_url ? (
                            <img src={productForm.image_url} alt="Preview" className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon size={16} className="text-muted/20" />
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest mb-2 block">Description</label>
                      <textarea
                        value={productForm.description}
                        onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                        className="w-full bg-background border border-border focus:border-primary rounded-xl py-3 px-4 text-sm font-bold text-white outline-none transition-all min-h-[100px] resize-none"
                        placeholder="Describe the product for customers..."
                      />
                    </div>
                  </div>
                </div>

                {/* Right Column: Customization */}
                <div className="lg:col-span-7 space-y-6">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <div>
                      <label className="text-[10px] font-black text-white uppercase tracking-widest">Ingredient Configuration</label>
                      <p className="text-[9px] text-muted font-bold uppercase mt-1">Assign roles to ingredients below</p>
                    </div>
                    <div className="flex items-center gap-3 relative">
                       {showQuickAddIngredient ? (
                         <motion.div 
                           initial={{ opacity: 0, y: 10, scale: 0.95 }}
                           animate={{ opacity: 1, y: 0, scale: 1 }}
                           className="flex flex-col gap-3 bg-[#1a1a1f] border border-primary/20 p-4 rounded-2xl absolute z-50 top-full right-0 mt-3 shadow-2xl min-w-[280px]"
                         >
                            <label className="text-[10px] font-black text-primary uppercase tracking-widest">Add New Item</label>
                            <input 
                               autoFocus
                               type="text"
                               placeholder="Item Name (e.g. Extra Cheese)"
                               value={quickIngredientName}
                               onChange={(e) => setQuickIngredientName(e.target.value)}
                               className="w-full bg-black/50 border border-white/10 focus:border-primary rounded-xl py-2.5 px-3 text-xs font-bold text-white outline-none"
                            />
                            <div className="flex gap-2">
                               <select
                                  value={quickIngredientRole}
                                  onChange={(e) => setQuickIngredientRole(e.target.value as 'default' | 'addon')}
                                  className="flex-1 bg-black/50 border border-white/10 focus:border-primary rounded-xl py-2.5 px-3 text-xs font-bold text-white outline-none appearance-none"
                               >
                                  <option value="addon">Extra / Size</option>
                                  <option value="default">Default</option>
                               </select>
                               <input 
                                  type="number"
                                  placeholder="Rs. Price"
                                  value={quickIngredientPrice}
                                  onChange={(e) => setQuickIngredientPrice(e.target.value)}
                                  onKeyDown={async (e) => {
                                    if (e.key === 'Enter') handleQuickAdd();
                                  }}
                                  className="w-24 bg-black/50 border border-white/10 focus:border-primary rounded-xl py-2.5 px-3 text-xs font-bold text-white outline-none"
                               />
                            </div>
                            <div className="flex justify-end gap-2 mt-2">
                               <button onClick={() => setShowQuickAddIngredient(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-muted hover:bg-white/5 transition-all">
                                  Cancel
                               </button>
                               <button 
                                  onClick={handleQuickAdd}
                                  disabled={!quickIngredientName.trim() || isSaving}
                                  className="px-5 py-2 rounded-xl bg-primary text-black text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-50 flex items-center gap-2"
                               >
                                  {isSaving && <Loader2 size={12} className="animate-spin" />}
                                  Add to Product
                               </button>
                            </div>
                         </motion.div>
                       ) : (
                         <button 
                            onClick={() => setShowQuickAddIngredient(true)}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary hover:text-black transition-all text-[9px] font-black uppercase tracking-widest"
                         >
                           <Plus size={14} /> New
                         </button>
                       )}
                       <div className="h-4 w-[1px] bg-white/10 mx-1" />
                       <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                             <span className="text-[8px] font-black text-white/50 uppercase">{productIngredients.filter(pi => pi.role === 'default').length} Def</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                             <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                             <span className="text-[8px] font-black text-white/50 uppercase">{productIngredients.filter(pi => pi.role === 'addon').length} Add</span>
                          </div>
                       </div>
                    </div>
                  </div>

                  {/* SEARCH BAR */}
                  <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary transition-colors" size={16} />
                    <input 
                      type="text" 
                      placeholder="Search ingredients, extras, or sizes..." 
                      value={ingredientSearch}
                      onChange={(e) => setIngredientSearch(e.target.value)}
                      className="w-full bg-background border border-border focus:border-primary rounded-2xl py-3.5 pl-12 pr-4 text-sm font-bold text-white outline-none transition-all"
                    />
                  </div>

                  <div className="h-[450px] overflow-y-auto custom-scrollbar pr-2 space-y-3">
                    {ingredients
                      .filter(ing => ing.name.toLowerCase().includes(ingredientSearch.toLowerCase()))
                      .map(ing => {
                        const pi = productIngredients.find(p => p.ingredient_id === ing.id);
                        const isSize = ing.name.toLowerCase().match(/small|medium|large|size|inch|upgrade|variant/);
                        
                        return (
                          <div 
                            key={ing.id} 
                            className={cn(
                              "p-4 rounded-2xl border transition-all flex items-center justify-between gap-4",
                              pi ? "bg-white/[0.04] border-white/10" : "bg-background/50 border-transparent hover:border-white/5"
                            )}
                          >
                            <div className="flex items-center gap-4 min-w-0">
                               <div className={cn(
                                 "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all",
                                 pi?.role === 'default' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
                                 pi?.role === 'addon' ? "bg-blue-500/10 border-blue-500/20 text-blue-500" :
                                 "bg-background border-border text-muted"
                               )}>
                                  {pi?.role === 'default' ? <Check size={18} /> : 
                                   pi?.role === 'addon' ? <Plus size={18} /> : 
                                   <Tag size={18} />}
                               </div>
                               <div className="min-w-0">
                                  <span className={cn("text-sm font-black block truncate", pi ? "text-white" : "text-muted")}>{ing.name}</span>
                                  {pi ? (
                                    <span className={cn(
                                      "text-[8px] font-black uppercase tracking-[0.2em]",
                                      pi.role === 'default' ? "text-emerald-500" : "text-blue-500"
                                    )}>
                                      {pi.role === 'default' ? "Default (Free)" : isSize ? "Size / Variant" : "Paid Extra"}
                                    </span>
                                  ) : (
                                    <span className="text-[8px] font-black text-muted/30 uppercase tracking-[0.2em]">Not Added</span>
                                  )}
                               </div>
                            </div>

                            <div className="flex items-center gap-2">
                               {/* ROLE TOGGLES */}
                               <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                                  <button 
                                    onClick={() => {
                                      if (pi?.role === 'default') {
                                        setProductIngredients(productIngredients.filter(p => p.ingredient_id !== ing.id));
                                      } else {
                                        setProductIngredients([...productIngredients.filter(p => p.ingredient_id !== ing.id), { ingredient_id: ing.id, role: 'default' }]);
                                      }
                                    }}
                                    className={cn(
                                      "px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all",
                                      pi?.role === 'default' ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" : "text-muted hover:text-white"
                                    )}
                                  >
                                    Default
                                  </button>
                                  <button 
                                    onClick={() => {
                                      if (pi?.role === 'addon') {
                                        setProductIngredients(productIngredients.filter(p => p.ingredient_id !== ing.id));
                                      } else {
                                        setProductIngredients([...productIngredients.filter(p => p.ingredient_id !== ing.id), { ingredient_id: ing.id, role: 'addon', price_adjustment: pi?.price_adjustment || 0 }]);
                                      }
                                    }}
                                    className={cn(
                                      "px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all",
                                      pi?.role === 'addon' ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "text-muted hover:text-white"
                                    )}
                                  >
                                    {isSize ? "Size" : "Extra"}
                                  </button>
                               </div>

                               {/* PRICE INPUTS */}
                               {pi && (
                                 <div className={cn(
                                   "flex items-center gap-2 px-3 py-2 rounded-xl border transition-all",
                                   pi.role === 'default' ? "bg-emerald-500/5 border-emerald-500/10" : "bg-blue-500/5 border-blue-500/10"
                                 )}>
                                    <span className={cn("text-[8px] font-black uppercase", pi.role === 'default' ? "text-emerald-500" : "text-blue-500")}>
                                      {pi.role === 'default' ? "Disc" : "Extra"}
                                    </span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-[10px] font-bold text-white/30">Rs.</span>
                                      <input 
                                        type="number"
                                        value={pi.role === 'default' ? (pi.removal_reduction || 0) : (pi.price_adjustment || 0)}
                                        onChange={(e) => {
                                          const val = Number(e.target.value);
                                          setProductIngredients(productIngredients.map(p => 
                                            p.ingredient_id === ing.id 
                                              ? (pi.role === 'default' ? {...p, removal_reduction: val} : {...p, price_adjustment: val}) 
                                              : p
                                          ));
                                        }}
                                        className="w-14 bg-transparent text-xs font-black text-white outline-none text-right"
                                        placeholder="0"
                                      />
                                    </div>
                                 </div>
                               )}

                               {/* DELETE FROM SYSTEM BUTTON (CLEANUP) */}
                               <button 
                                 onClick={async (e) => {
                                   e.stopPropagation();
                                   if (confirm(`CRITICAL: This will PERMANENTLY DELETE "${ing.name}" from your entire inventory system. Only do this to clean up duplicates. Proceed?`)) {
                                     setIsSaving(true);
                                     try {
                                       const response = await fetch(`/api/ingredients?id=${ing.id}`, {
                                         method: 'DELETE'
                                       });
                                       if (!response.ok) {
                                         throw new Error("Cannot delete: Item might be in use by other products.");
                                       }
                                       setProductIngredients(productIngredients.filter(p => p.ingredient_id !== ing.id));
                                       if (branchIdRef.current) await fetchMenu(branchIdRef.current);
                                     } catch (err: any) {
                                       alert(err.message);
                                     } finally {
                                       setIsSaving(false);
                                     }
                                   }
                                 }}
                                 className="p-2 rounded-xl hover:bg-red-500/10 text-red-500/20 hover:text-red-500 transition-all"
                                 title="Delete from system"
                               >
                                 <Trash2 size={14} />
                               </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>

                <Button
                  onClick={async () => {
                    if (!productForm.name || !productForm.price || !productForm.category_id) return alert("Fill required fields");
                    if (!branchIdRef.current) return alert("Branch ID not found");
                    
                    setIsSaving(true);
                    try {
                      let productId = editingProduct?.id;
                      if (editingProduct) {
                        await updateProduct(editingProduct.id, {
                          name: productForm.name,
                          description: productForm.description,
                          price: Number(productForm.price),
                          image_url: productForm.image_url,
                          category_id: productForm.category_id,
                          status: productForm.status
                        });
                      } else {
                        const { data: newP, error: pErr } = await supabase
                          .from('products')
                          .insert({
                            name: productForm.name,
                            description: productForm.description,
                            price: Number(productForm.price),
                            image_url: productForm.image_url,
                            category_id: productForm.category_id,
                            status: 'available',
                            branch_id: branchIdRef.current
                          })
                          .select()
                          .single();
                        
                        if (pErr) throw pErr;
                        productId = newP.id;
                      }

                      if (productId) {
                        const response = await fetch('/api/products/ingredients', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            productId: productId,
                            ingredients: productIngredients
                          })
                        });
                        
                        const result = await response.json();
                        if (!response.ok) throw new Error(result.error || 'Failed to save product ingredients');
                      }
                      
                      fetchMenu(branchIdRef.current);
                      setShowAddProduct(false);
                    } catch (err: any) {
                      alert("Error: " + err.message);
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                  disabled={isSaving}
                  className="w-full h-12 rounded-xl font-black uppercase tracking-widest mt-4 flex items-center justify-center gap-2"
                >
                  <Save size={18} /> {isSaving ? "Saving..." : "Save Product"}
                </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ADD CATEGORY MODAL */}
      <AnimatePresence>
        {showAddCategory && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowAddCategory(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-surface border border-border p-8 rounded-[2rem] w-full max-w-sm shadow-2xl relative z-10"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-white uppercase">New Category</h3>
                <button onClick={() => setShowAddCategory(false)} className="text-muted hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-muted uppercase tracking-widest mb-2 block">Category Name</label>
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="w-full bg-background border border-border focus:border-primary rounded-xl py-3 px-4 text-sm font-bold text-white outline-none transition-all"
                    placeholder="e.g. Fast Food"
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter' && newCategoryName.trim()) {
                         if (!branchIdRef.current) return;
                         setIsSaving(true);
                         await addCategory(branchIdRef.current, newCategoryName.trim());
                         setIsSaving(false);
                         setShowAddCategory(false);
                         setNewCategoryName("");
                      }
                    }}
                  />
                </div>

                <Button
                  onClick={async () => {
                    if (!newCategoryName.trim() || !branchIdRef.current) return;
                    setIsSaving(true);
                    await addCategory(branchIdRef.current, newCategoryName.trim());
                    setIsSaving(false);
                    setShowAddCategory(false);
                    setNewCategoryName("");
                  }}
                  disabled={isSaving || !newCategoryName.trim()}
                  className="w-full h-12 rounded-xl font-black uppercase tracking-widest"
                >
                  {isSaving ? "Saving..." : "Add Category"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* ADD DEVICE MODAL */}
      <AnimatePresence>
        {showAddDevice && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowAddDevice(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-surface border border-border p-8 rounded-[2rem] w-full max-w-sm shadow-2xl relative z-10"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-white uppercase">New Device</h3>
                <button onClick={() => setShowAddDevice(false)} className="text-muted hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-muted uppercase tracking-widest mb-2 block">Device Name</label>
                  <input
                    type="text"
                    value={deviceForm.name}
                    onChange={(e) => setDeviceForm({ ...deviceForm, name: e.target.value })}
                    className="w-full bg-background border border-border focus:border-primary rounded-xl py-3 px-4 text-sm font-bold text-white outline-none transition-all"
                    placeholder="e.g. Front Desk iPad"
                  />
                </div>
                
                <div>
                  <label className="text-[10px] font-black text-muted uppercase tracking-widest mb-2 block">Device Role / Type</label>
                  <select
                    value={deviceForm.type}
                    onChange={(e) => setDeviceForm({ ...deviceForm, type: e.target.value as DeviceType })}
                    className="w-full bg-background border border-border focus:border-primary rounded-xl py-3 px-4 text-sm font-bold text-white outline-none transition-all appearance-none"
                  >
                    <option value="reception">Reception POS</option>
                    <option value="kiosk">Self-Service Kiosk</option>
                    <option value="kitchen">Kitchen Display (KDS)</option>
                    <option value="manager">Manager Tablet</option>
                  </select>
                </div>

                <Button
                  onClick={async () => {
                    if (!deviceForm.name.trim() || !branchIdRef.current) return;
                    setIsSaving(true);
                    await addDevice({
                      name: deviceForm.name.trim(),
                      type: deviceForm.type,
                      status: 'active',
                      branch_id: branchIdRef.current
                    });
                    setIsSaving(false);
                    setShowAddDevice(false);
                    setDeviceForm({ name: '', type: 'reception' });
                  }}
                  disabled={isSaving || !deviceForm.name.trim()}
                  className="w-full h-12 rounded-xl font-black uppercase tracking-widest mt-4"
                >
                  {isSaving ? "Saving..." : "Register Device"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ADD EXPENSE MODAL */}
      <AnimatePresence>
        {showExpenseModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-background border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Log Expense</h2>
                <Button variant="ghost" className="rounded-full w-10 h-10 p-0 hover:bg-white/5" onClick={() => setShowExpenseModal(false)}>
                  <X size={20} />
                </Button>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1 mb-2 block">Category</label>
                  <select
                    value={newExpense.category}
                    onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value as ExpenseCategory })}
                    className="w-full bg-white/5 border border-white/10 focus:border-amber-500 rounded-xl py-3 px-5 text-sm font-bold text-white outline-none transition-all appearance-none"
                  >
                    <option value="ingredients">Ingredients</option>
                    <option value="utilities">Utilities</option>
                    <option value="salary">Salary</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="marketing">Marketing</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1 mb-2 block">Amount (Rs.)</label>
                  <input
                    type="number"
                    placeholder="e.g. 5000"
                    value={newExpense.amount}
                    onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 focus:border-amber-500 rounded-xl py-3 px-5 text-sm font-bold text-white outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1 mb-2 block">Description</label>
                  <input
                    type="text"
                    placeholder="e.g. Monthly Electricity Bill"
                    value={newExpense.description}
                    onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 focus:border-amber-500 rounded-xl py-3 px-5 text-sm font-bold text-white outline-none transition-all"
                  />
                </div>
                <Button
                  onClick={async () => {
                    setIsSaving(true);
                    await addExpense({
                      branch_id: branchIdRef.current!,
                      category: newExpense.category,
                      amount: Number(newExpense.amount),
                      description: newExpense.description,
                      expense_date: new Date().toISOString().split('T')[0]
                    });
                    setNewExpense({ category: 'ingredients', amount: '', description: '' });
                    setShowExpenseModal(false);
                    setIsSaving(false);
                  }}
                  disabled={isSaving || !newExpense.amount || !newExpense.description}
                  variant="primary"
                  className="w-full h-14 rounded-2xl font-black text-xs tracking-widest uppercase bg-amber-500 hover:bg-amber-600 text-black"
                >
                  {isSaving ? "Saving..." : "Save Expense"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ADD INGREDIENT MODAL */}
      <AnimatePresence>
        {showAddIngredient && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowAddIngredient(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-surface border border-border p-8 rounded-[2rem] w-full max-w-md shadow-2xl relative z-10"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-white uppercase">Add Ingredient</h3>
                <button onClick={() => setShowAddIngredient(false)} className="text-muted hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-muted uppercase tracking-widest mb-2 block">Ingredient Name</label>
                  <input
                    type="text"
                    value={ingredientForm.name}
                    onChange={(e) => setIngredientForm({ ...ingredientForm, name: e.target.value })}
                    className="w-full bg-background border border-border focus:border-primary rounded-xl py-3 px-4 text-sm font-bold text-white outline-none transition-all"
                    placeholder="e.g. Chicken Breast"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest mb-2 block">Unit</label>
                    <select
                      value={ingredientForm.unit}
                      onChange={(e) => setIngredientForm({ ...ingredientForm, unit: e.target.value })}
                      className="w-full bg-background border border-border focus:border-primary rounded-xl py-3 px-4 text-sm font-bold text-white outline-none appearance-none"
                    >
                      <option value="kg">kg</option>
                      <option value="g">g</option>
                      <option value="L">Liters</option>
                      <option value="pcs">pcs</option>
                      <option value="dozen">Dozen</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest mb-2 block">Current Stock</label>
                    <input
                      type="number"
                      value={ingredientForm.current_stock}
                      onChange={(e) => setIngredientForm({ ...ingredientForm, current_stock: e.target.value })}
                      className="w-full bg-background border border-border focus:border-primary rounded-xl py-3 px-4 text-sm font-bold text-white outline-none"
                      placeholder="10"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest mb-2 block">Min Threshold</label>
                    <input
                      type="number"
                      value={ingredientForm.low_stock_threshold}
                      onChange={(e) => setIngredientForm({ ...ingredientForm, low_stock_threshold: e.target.value })}
                      className="w-full bg-background border border-border focus:border-primary rounded-xl py-3 px-4 text-sm font-bold text-white outline-none"
                      placeholder="3"
                    />
                  </div>
                </div>
                <Button
                  onClick={async () => {
                    if (!ingredientForm.name.trim() || !branchIdRef.current) return alert("Fill all fields");
                    setIsSaving(true);
                    try {
                      const { error } = await supabase.from('ingredients').insert([{
                        name: ingredientForm.name.trim(),
                        unit: ingredientForm.unit,
                        current_stock: Number(ingredientForm.current_stock) || 0,
                        low_stock_threshold: Number(ingredientForm.low_stock_threshold) || 0,
                        branch_id: branchIdRef.current
                      }]);
                      if (!error) {
                        setShowAddIngredient(false);
                        setIngredientForm({ name: '', unit: 'kg', current_stock: '', low_stock_threshold: '' });
                        // Refresh ingredients
                        if (branchIdRef.current) fetchMenu(branchIdRef.current);
                      } else {
                        alert("Error: " + error.message);
                      }
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                  disabled={isSaving || !ingredientForm.name.trim()}
                  className="w-full h-12 rounded-xl font-black uppercase tracking-widest mt-4"
                >
                  {isSaving ? "Saving..." : "Add to Inventory"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
