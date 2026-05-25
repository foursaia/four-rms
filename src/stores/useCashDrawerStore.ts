import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export type CashTxType = 'cash_in' | 'cash_out' | 'opening' | 'sale';

export interface CashTransaction {
  id: string;
  shift_id: string;
  branch_id: string;
  type: CashTxType;
  amount: number;
  note: string | null;
  created_at: string;
}

interface CashDrawerState {
  transactions: CashTransaction[];
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;

  fetchTransactions: (shiftId: string) => Promise<void>;
  addTransaction: (
    shiftId: string,
    branchId: string,
    type: CashTxType,
    amount: number,
    note?: string
  ) => Promise<void>;
  clearTransactions: () => void;
}

export const useCashDrawerStore = create<CashDrawerState>((set, get) => ({
  transactions: [],
  isLoading: false,
  isSubmitting: false,
  error: null,

  fetchTransactions: async (shiftId) => {
    set({ isLoading: true, error: null });
    const { data, error } = await supabase
      .from('cash_transactions')
      .select('*')
      .eq('shift_id', shiftId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      set({ transactions: data as CashTransaction[], isLoading: false });
    } else {
      set({ isLoading: false, error: error?.message || 'Failed to load transactions' });
    }
  },

  addTransaction: async (shiftId, branchId, type, amount, note = '') => {
    set({ isSubmitting: true, error: null });
    const { data, error } = await supabase
      .from('cash_transactions')
      .insert([{
        shift_id: shiftId,
        branch_id: branchId,
        type,
        amount,
        note: note || null,
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (!error && data) {
      set({
        transactions: [...get().transactions, data as CashTransaction],
        isSubmitting: false,
      });
    } else {
      set({ isSubmitting: false, error: error?.message || 'Failed to add transaction' });
      throw new Error(error?.message || 'Failed to add transaction');
    }
  },

  clearTransactions: () => set({ transactions: [], error: null }),
}));
