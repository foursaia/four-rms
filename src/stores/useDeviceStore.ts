import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export type DeviceType = 'reception' | 'kitchen' | 'kiosk' | 'manager';
export type DeviceStatus = 'active' | 'inactive' | 'maintenance';

export interface Device {
  id: string;
  branch_id: string;
  name: string;
  type: DeviceType;
  status: DeviceStatus;
  last_ping: string | null;
  pairing_code?: string;
  created_at: string;
}

interface DeviceState {
  devices: Device[];
  isLoading: boolean;
  error: string | null;
  fetchDevices: (branchId: string) => Promise<void>;
  addDevice: (device: Omit<Device, 'id' | 'created_at' | 'last_ping'>) => Promise<void>;
  updateDeviceStatus: (deviceId: string, status: DeviceStatus) => Promise<void>;
  deleteDevice: (deviceId: string) => Promise<void>;
}

export const useDeviceStore = create<DeviceState>((set, get) => ({
  devices: [],
  isLoading: false,
  error: null,

  fetchDevices: async (branchId) => {
    set({ isLoading: true, error: null });
    const { data, error } = await supabase
      .from('restaurant_devices')
      .select('*')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false });

    if (error) {
      set({ error: error.message, isLoading: false });
      return;
    }
    set({ devices: data as Device[], isLoading: false });
  },

  addDevice: async (device) => {
    const { data, error } = await supabase
      .from('restaurant_devices')
      .insert({ ...device })
      .select()
      .single();

    if (!error && data) {
      set({ devices: [data as Device, ...get().devices] });
    }
  },

  updateDeviceStatus: async (deviceId, status) => {
    const { error } = await supabase
      .from('restaurant_devices')
      .update({ status })
      .eq('id', deviceId);

    if (!error) {
      set({
        devices: get().devices.map((d) => (d.id === deviceId ? { ...d, status } : d)),
      });
    }
  },

  deleteDevice: async (deviceId) => {
    const { error } = await supabase
      .from('restaurant_devices')
      .delete()
      .eq('id', deviceId);

    if (!error) {
      set({
        devices: get().devices.filter((d) => d.id !== deviceId),
      });
    }
  },
}));
