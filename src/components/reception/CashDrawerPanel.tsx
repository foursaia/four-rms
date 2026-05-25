"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Banknote, ArrowUpCircle, ArrowDownCircle, Clock,
  Wallet, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle2, Loader2, RefreshCw, FileText,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { useCashDrawerStore, CashTxType } from "@/stores/useCashDrawerStore";
import { useShiftStore } from "@/stores/useShiftStore";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { formatLocalTime } from "@/lib/time";

interface CashDrawerPanelProps {
  branchId: string;
  cashRevenue: number; // total cash sales from orders during this shift
}

const TX_ICONS: Record<string, React.ReactNode> = {
  cash_in:  <ArrowDownCircle size={16} className="text-emerald-400" />,
  cash_out: <ArrowUpCircle  size={16} className="text-red-400" />,
  opening:  <Wallet         size={16} className="text-primary" />,
  sale:     <Banknote       size={16} className="text-blue-400" />,
};

const TX_COLORS: Record<string, string> = {
  cash_in:  "text-emerald-400",
  cash_out: "text-red-400",
  opening:  "text-primary",
  sale:     "text-blue-400",
};

export function CashDrawerPanel({ branchId, cashRevenue }: CashDrawerPanelProps) {
  const { activeShift } = useShiftStore();
  const {
    transactions, isLoading, isSubmitting,
    fetchTransactions, addTransaction, clearTransactions,
  } = useCashDrawerStore();

  const [txType, setTxType]   = useState<"cash_in" | "cash_out">("cash_in");
  const [amount, setAmount]   = useState("");
  const [note, setNote]       = useState("");
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState(false);

  // Load transactions when shift becomes available
  useEffect(() => {
    if (activeShift?.id) {
      fetchTransactions(activeShift.id);
    } else {
      clearTransactions();
    }
  }, [activeShift?.id, fetchTransactions, clearTransactions]);

  // ── Computed totals ──────────────────────────────────────────────
  const manualCashIn = useMemo(
    () => transactions.filter(t => t.type === "cash_in").reduce((s, t) => s + Number(t.amount), 0),
    [transactions]
  );
  const manualCashOut = useMemo(
    () => transactions.filter(t => t.type === "cash_out").reduce((s, t) => s + Number(t.amount), 0),
    [transactions]
  );
  const openingFloat   = Number(activeShift?.opening_float) || 0;
  const expectedCash   = openingFloat + cashRevenue + manualCashIn - manualCashOut;
  const variance       = activeShift?.actual_cash != null
    ? Number(activeShift.actual_cash) - expectedCash
    : null;
  const isShiftClosed  = activeShift?.status === "closed";

  // ── Submit handler ───────────────────────────────────────────────
  const handleSubmit = async () => {
    const val = parseFloat(amount);
    if (!val || val <= 0) { setError("Enter a valid amount"); return; }
    if (!activeShift) { setError("No active shift"); return; }
    setError("");
    try {
      await addTransaction(activeShift.id, branchId, txType, val, note);
      setAmount("");
      setNote("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (e: any) {
      setError(e.message || "Failed to add transaction");
    }
  };

  // ── No shift fallback ────────────────────────────────────────────
  if (!activeShift) {
    return (
      <div className="flex flex-col items-center justify-center h-80 gap-4 opacity-40">
        <Wallet size={48} />
        <p className="text-sm font-black uppercase tracking-widest">No Active Shift</p>
        <p className="text-xs text-muted">Open a shift to use the cash drawer</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* ── Shift Banner ── */}
      <div className="bg-primary/10 border border-primary/20 rounded-2xl px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <p className="text-xs font-black text-emerald-400 uppercase tracking-widest">Shift Active</p>
          <p className="text-xs text-muted font-bold">Since {formatLocalTime(activeShift.opened_at)}</p>
        </div>
        <button
          onClick={() => fetchTransactions(activeShift.id)}
          className="p-2 rounded-lg text-muted hover:text-white transition-all"
          title="Refresh"
        >
          <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-lighter border-none">
          <CardContent className="p-5">
            <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-2">Opening Float</p>
            <p className="text-2xl font-black text-white">{formatCurrency(openingFloat)}</p>
          </CardContent>
        </Card>
        <Card className="glass-lighter border-none">
          <CardContent className="p-5">
            <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-2">Cash Sales</p>
            <p className="text-2xl font-black text-blue-400">{formatCurrency(cashRevenue)}</p>
          </CardContent>
        </Card>
        <Card className="glass-lighter border-none">
          <CardContent className="p-5">
            <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-2">Net Manual Flows</p>
            <p className={cn("text-2xl font-black", manualCashIn - manualCashOut >= 0 ? "text-emerald-400" : "text-red-400")}>
              {manualCashIn - manualCashOut >= 0 ? "+" : ""}{formatCurrency(manualCashIn - manualCashOut)}
            </p>
          </CardContent>
        </Card>
        <Card className="glass border-primary/20">
          <CardContent className="p-5">
            <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-2">Expected in Drawer</p>
            <p className="text-2xl font-black text-primary">{formatCurrency(expectedCash)}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Transaction Entry (only for open shifts) ── */}
      {!isShiftClosed && (
        <Card className="glass-lighter border-none">
          <CardContent className="p-8">
            <h3 className="text-xs font-black text-white uppercase tracking-widest mb-6">
              Log Cash Movement
            </h3>

            {/* Type Toggle */}
            <div className="flex gap-2 mb-6 bg-background/50 p-1.5 rounded-2xl w-fit">
              {(["cash_in", "cash_out"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTxType(t)}
                  className={cn(
                    "px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    txType === t
                      ? t === "cash_in"
                        ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
                        : "bg-red-500 text-white shadow-lg shadow-red-500/20"
                      : "text-muted hover:text-white"
                  )}
                >
                  {t === "cash_in" ? "Cash In ↓" : "Cash Out ↑"}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {/* Amount */}
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary font-black text-sm">Rs.</span>
                <input
                  type="number"
                  placeholder="Amount"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSubmit()}
                  className="w-full bg-background border border-border focus:border-primary rounded-xl py-3.5 pl-12 pr-4 text-xl font-black text-white outline-none transition-all"
                />
              </div>

              {/* Note */}
              <div className="md:col-span-2">
                <input
                  type="text"
                  placeholder={txType === "cash_in" ? "Source / reason (e.g. Change float top-up)" : "Reason (e.g. Petty cash – supplies)"}
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSubmit()}
                  className="w-full bg-background border border-border focus:border-primary rounded-xl py-3.5 px-4 text-sm font-bold text-white outline-none transition-all"
                />
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-red-400 text-xs font-bold mb-4 flex items-center gap-2"
                >
                  <AlertTriangle size={12} /> {error}
                </motion.p>
              )}
            </AnimatePresence>

            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !amount}
              className={cn(
                "h-12 px-8 rounded-xl font-black text-sm gap-2 transition-all",
                txType === "cash_in"
                  ? "bg-emerald-500 text-black hover:bg-emerald-400 shadow-lg shadow-emerald-500/20"
                  : "bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-600/20"
              )}
            >
              {isSubmitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : success ? (
                <><CheckCircle2 size={16} /> Logged!</>
              ) : (
                <>{txType === "cash_in" ? <ArrowDownCircle size={16} /> : <ArrowUpCircle size={16} />}
                  {txType === "cash_in" ? "LOG CASH IN" : "LOG CASH OUT"}</>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Closed shift Reconciliation Card ── */}
      {isShiftClosed && activeShift.actual_cash != null && (
        <Card className={cn(
          "border-none",
          variance === 0 ? "glass-lighter" :
          (variance || 0) > 0 ? "bg-emerald-500/10 border border-emerald-500/20" :
          "bg-red-500/10 border border-red-500/20"
        )}>
          <CardContent className="p-8">
            <h3 className="text-xs font-black uppercase tracking-widest mb-6 flex items-center gap-2">
              <FileText size={14} /> End-of-Shift Reconciliation
            </h3>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-2">Expected</p>
                <p className="text-2xl font-black text-white">{formatCurrency(expectedCash)}</p>
              </div>
              <div>
                <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-2">Actual (Counted)</p>
                <p className="text-2xl font-black text-white">{formatCurrency(Number(activeShift.actual_cash))}</p>
              </div>
              <div>
                <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-2">Variance</p>
                <p className={cn(
                  "text-2xl font-black flex items-center gap-2",
                  variance === 0 ? "text-emerald-400" : (variance || 0) > 0 ? "text-emerald-400" : "text-red-400"
                )}>
                  {(variance || 0) > 0 ? <TrendingUp size={20} /> : (variance || 0) < 0 ? <TrendingDown size={20} /> : <CheckCircle2 size={20} />}
                  {(variance || 0) >= 0 ? "+" : ""}{formatCurrency(variance || 0)}
                </p>
                <p className="text-[10px] text-muted font-bold mt-1 uppercase">
                  {variance === 0 ? "Balanced" : (variance || 0) > 0 ? "Overage" : "Shortage"}
                </p>
              </div>
            </div>
            {activeShift.closing_notes && (
              <div className="mt-6 pt-6 border-t border-white/10">
                <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-2">Closing Notes</p>
                <p className="text-sm text-white font-medium italic">"{activeShift.closing_notes}"</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Transaction Log ── */}
      <Card className="glass-lighter border-none overflow-hidden">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
            <Clock size={14} /> Transaction Log
          </h3>
          <span className="text-[10px] text-muted font-bold uppercase tracking-widest">
            {transactions.length} entries
          </span>
        </div>

        {isLoading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-16 flex flex-col items-center gap-3 opacity-30">
            <Banknote size={40} />
            <p className="text-xs font-black uppercase tracking-widest">No Transactions Yet</p>
            <p className="text-[10px] text-muted">Cash movements will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            <AnimatePresence initial={false}>
              {[...transactions].reverse().map((tx, i) => {
                const isPositive = tx.type === "cash_in" || tx.type === "opening" || tx.type === "sale";
                return (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i < 5 ? i * 0.04 : 0 }}
                    className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center">
                        {TX_ICONS[tx.type] ?? <Banknote size={16} />}
                      </div>
                      <div>
                        <p className="text-xs font-black text-white uppercase tracking-wide">
                          {tx.type.replace("_", " ")}
                        </p>
                        {tx.note && (
                          <p className="text-[10px] text-muted font-medium mt-0.5">{tx.note}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-sm font-black", TX_COLORS[tx.type] ?? "text-white")}>
                        {isPositive ? "+" : "-"}{formatCurrency(Number(tx.amount))}
                      </p>
                      <p className="text-[10px] text-muted font-medium">
                        {formatLocalTime(tx.created_at)}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Running balance footer */}
        {transactions.length > 0 && (
          <div className="px-6 py-4 border-t border-white/5 bg-white/[0.02] flex items-center justify-between">
            <p className="text-[10px] font-black text-muted uppercase tracking-widest">Current Drawer Balance</p>
            <p className="text-lg font-black text-primary">{formatCurrency(expectedCash)}</p>
          </div>
        )}
      </Card>
    </div>
  );
}
