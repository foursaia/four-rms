import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export type ExpenseCategory = 'ingredients' | 'utilities' | 'salary' | 'maintenance' | 'marketing' | 'other';
export type AttendanceStatus = 'present' | 'absent' | 'half_day' | 'on_leave';

export interface Expense {
  id: string;
  branch_id: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  expense_date: string;
}
export interface Attendance {
  id: string;
  profile_id: string;
  branch_id: string;
  date: string;
  status: AttendanceStatus;
  check_in_time: string | null;
  check_out_time: string | null;
  staff_profile?: { full_name: string; role: string };
}

export interface ShiftRecord {
  id: string;
  branch_id: string;
  opened_by: string;
  closed_by: string | null;
  opening_float: number;
  closing_float: number | null;
  expected_cash: number | null;
  actual_cash: number | null;
  closing_notes: string | null;
  status: 'open' | 'closed';
  opened_at: string;
  closed_at: string | null;
  opened_by_staff?: { full_name: string };
  closed_by_staff?: { full_name: string };
}

interface FinanceState {
  expenses: Expense[];
  attendance: Attendance[];
  staffList: any[];
  shifts: ShiftRecord[];
  isLoading: boolean;
  error: string | null;
  fetchExpenses: (branchId: string) => Promise<void>;
  addExpense: (expense: Omit<Expense, 'id'>) => Promise<void>;
  fetchAttendance: (branchId: string, date: string) => Promise<void>;
  fetchStaff: (branchId: string) => Promise<void>;
  fetchShifts: (branchId: string) => Promise<void>;
  markAttendance: (profileId: string, branchId: string, status: AttendanceStatus, date: string) => Promise<void>;
}

export const useFinanceStore = create<FinanceState>((set, get) => ({
  expenses: [],
  attendance: [],
  staffList: [],
  shifts: [],
  isLoading: false,
  error: null,

  fetchExpenses: async (branchId) => {
    set({ isLoading: true });
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('branch_id', branchId)
      .order('expense_date', { ascending: false });

    if (!error && data) {
      set({ expenses: data as Expense[], isLoading: false });
    } else {
      set({ isLoading: false, error: error?.message });
    }
  },

  addExpense: async (expense) => {
    const { data, error } = await supabase
      .from('expenses')
      .insert([expense])
      .select()
      .single();

    if (!error && data) {
      set({ expenses: [data as Expense, ...get().expenses] });
    }
  },

  fetchStaff: async (branchId) => {
    const { data, error } = await supabase
      .from('staff')
      .select('id, full_name, role, is_active, branch_id')
      .eq('branch_id', branchId)
      .order('full_name', { ascending: true });

    if (!error && data) {
      set({ staffList: data });
    }
  },

  fetchAttendance: async (branchId, date) => {
    const { data, error } = await supabase
      .from('attendance')
      .select('*, staff_profile:staff!profile_id(full_name, role)')
      .eq('branch_id', branchId)
      .eq('date', date);

    if (!error && data) {
      set({ attendance: data as Attendance[] });
    }
  },

  markAttendance: async (profileId, branchId, status, date) => {
    // Check if exists
    const existing = get().attendance.find(a => a.profile_id === profileId && a.date === date);
    
    if (existing) {
      const { error } = await supabase
        .from('attendance')
        .update({ status, check_in_time: status === 'present' && !existing.check_in_time ? new Date().toISOString() : existing.check_in_time })
        .eq('id', existing.id);
        
      if (!error) {
        get().fetchAttendance(branchId, date);
      }
    } else {
      const { error } = await supabase
        .from('attendance')
        .insert([{
          profile_id: profileId,
          branch_id: branchId,
          date,
          status,
          check_in_time: status === 'present' ? new Date().toISOString() : null
        }]);
        
      if (!error) {
        get().fetchAttendance(branchId, date);
      }
    }
  },

  fetchShifts: async (branchId) => {
    set({ isLoading: true });
    const { data, error } = await supabase
      .from('shifts')
      .select(`
        *,
        opened_by_staff:staff!opened_by(full_name),
        closed_by_staff:staff!closed_by(full_name)
      `)
      .eq('branch_id', branchId)
      .order('opened_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      set({ shifts: data as ShiftRecord[], isLoading: false });
    } else {
      // Fallback: fetch without join if FK alias fails
      const { data: plain } = await supabase
        .from('shifts')
        .select('*')
        .eq('branch_id', branchId)
        .order('opened_at', { ascending: false })
        .limit(50);
      set({ shifts: (plain || []) as ShiftRecord[], isLoading: false, error: error?.message });
    }
  }
}));
