import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface Shift {
  id: string;
  branch_id: string;
  opened_by: string;
  closed_by: string | null;
  opened_at: string;
  closed_at: string | null;
  opening_float: number;
  closing_float: number | null;
  expected_cash: number | null;
  actual_cash: number | null;
  closing_notes: string | null; // Added
  status: 'open' | 'closed';
}

interface ShiftState {
  activeShift: Shift | null;
  shiftHistory: Shift[];
  isLoading: boolean;
  error: string | null;
  
  fetchActiveShift: (branchId: string, profileId: string) => Promise<void>;
  fetchShiftHistory: (branchId: string) => Promise<void>;
  startShift: (branchId: string, profileId: string, openingFloat: number) => Promise<void>;
  closeShift: (actualCash: number, closingNotes?: string) => Promise<void>;
}

export const useShiftStore = create<ShiftState>((set, get) => ({
  activeShift: null,
  shiftHistory: [],
  isLoading: false,
  error: null,

  fetchActiveShift: async (branchId, profileId) => {
    set({ isLoading: true });
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .eq('branch_id', branchId)
      .eq('opened_by', profileId)
      .eq('status', 'open')
      .maybeSingle();

    if (!error) {
      set({ activeShift: data as Shift, isLoading: false });
    } else {
      set({ error: error.message, isLoading: false });
    }
  },

  fetchShiftHistory: async (branchId) => {
    set({ isLoading: true });
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .eq('branch_id', branchId)
      .order('opened_at', { ascending: false });

    if (!error) {
      set({ shiftHistory: data as Shift[], isLoading: false });
    } else {
      set({ error: error.message, isLoading: false });
    }
  },

  startShift: async (branchId, profileId, openingFloat) => {
    const { data, error } = await supabase
      .from('shifts')
      .insert([{
        branch_id: branchId,
        opened_by: profileId,
        opening_float: openingFloat,
        opened_at: new Date().toISOString(),
        status: 'open'
      }])
      .select()
      .single();

    if (!error && data) {
      set({ activeShift: data as Shift });
      
      // Auto-log opening float in cash_transactions
      await supabase
        .from('cash_transactions')
        .insert([{
          shift_id: data.id,
          branch_id: branchId,
          type: 'opening',
          amount: openingFloat,
          note: 'Shift opened with initial float balance'
        }]);
    } else {
      console.error("Start shift error:", error?.message || error);
    }
  },

  closeShift: async (actualCash, closingNotes = "") => {
    const shift = get().activeShift;
    if (!shift) return;

    // 1. Calculate Expected Cash: opening_float + cash sales since start_time + manual cash_in - manual cash_out
    const { data: salesData } = await supabase
      .from('orders')
      .select('total')
      .eq('branch_id', shift.branch_id)
      .eq('payment_status', 'paid')
      .filter('payment_method', 'ilike', '%cash%')
      .gte('created_at', shift.opened_at);
    
    const cashSales = salesData?.reduce((sum, o) => sum + (Number(o.total) || 0), 0) || 0;

    // Fetch manual transactions during this shift to accurately calculate expected cash
    const { data: txData } = await supabase
      .from('cash_transactions')
      .select('type, amount')
      .eq('shift_id', shift.id);

    const manualCashIn = txData?.filter(t => t.type === 'cash_in').reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    const manualCashOut = txData?.filter(t => t.type === 'cash_out').reduce((sum, t) => sum + Number(t.amount), 0) || 0;

    const expectedCash = Number(shift.opening_float) + cashSales + manualCashIn - manualCashOut;

    // 2. Update Shift
    const { data, error } = await supabase
      .from('shifts')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        expected_cash: expectedCash,
        actual_cash: Number(actualCash) || 0,
        closing_float: Number(actualCash) || 0,
        closing_notes: closingNotes
      })
      .eq('id', shift.id)
      .select()
      .single();

    if (!error && data) {
      set({ activeShift: null });
      get().fetchShiftHistory(shift.branch_id);
    } else {
      console.error("Close shift error detail:", error);
      throw new Error(error?.message || "Failed to close shift");
    }
  }
})
);
