import { create } from 'zustand';

export type StaffRole = 'receptionist' | 'kitchen' | 'delivery_boy' | 'manager' | 'ceo' | 'admin';

interface StaffMember {
  id: string;
  full_name: string;
  role: StaffRole;
  branch_id: string;
  staff_code: string;
}

interface AuthState {
  user: StaffMember | null;
  isAuthenticated: boolean;
  login: (user: StaffMember) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  login: (user) => set({ user, isAuthenticated: true }),
  logout: () => set({ user: null, isAuthenticated: false }),
}));
