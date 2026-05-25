import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { playChime } from '@/lib/audio';
import { KitchenOrder } from './useKitchenStore';

export interface RestaurantTable {
  id: string;
  table_number: string;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved';
  position_x: number;
  position_y: number;
  current_order_id?: string | null;
}

interface ReceptionState {
  orders: KitchenOrder[];
  tables: RestaurantTable[];
  isLoading: boolean;
  fetchOrders: (branchId: string) => Promise<void>;
  fetchTables: (branchId: string) => Promise<void>;
  markAsPaid: (orderId: string, method: string) => Promise<void>;
  cancelOrder: (orderId: string) => Promise<void>;
  updateTableStatus: (tableId: string, status: RestaurantTable['status'], orderId?: string | null) => Promise<void>;
  updateTablePosition: (tableId: string, x: number, y: number) => Promise<void>;
  addTable: (branchId: string, tableNumber: string, capacity?: number) => Promise<void>;
  removeTable: (tableId: string) => Promise<void>;
  linkOrderToTable: (tableId: string, orderId: string) => Promise<void>;
  unlinkOrderFromTable: (tableId: string) => Promise<void>;
  transferOrder: (orderId: string, fromTableId: string | null, toTableId: string) => Promise<void>;
  subscribeToAllOrders: (branchId: string) => () => void;
  subscribeToTables: (branchId: string) => () => void;
}

export const useReceptionStore = create<ReceptionState>((set, get) => ({
  orders: [],
  tables: [],
  isLoading: false,
// ... (rest of the store)


  fetchOrders: async (branchId) => {
    set({ isLoading: true });
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        items:order_items (*, customisations:order_item_customisations(*))
      `)
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      set({ orders: data as KitchenOrder[], isLoading: false });
    } else {
      set({ isLoading: false });
    }
  },

  markAsPaid: async (orderId, method) => {
    const { error } = await supabase
      .from('orders')
      .update({ 
        payment_status: 'paid',
        payment_method: method 
      })
      .eq('id', orderId);

    if (!error) {
      // Release all tables linked to this order
      await supabase
        .from('restaurant_tables')
        .update({ current_order_id: null, status: 'available' })
        .eq('current_order_id', orderId);

      set(state => ({
        orders: state.orders.map(o => o.id === orderId ? { ...o, payment_status: 'paid', payment_method: method as any } : o),
        tables: state.tables.map(t => t.current_order_id === orderId ? { ...t, current_order_id: null, status: 'available' } : t)
      }));
    }
  },


  cancelOrder: async (orderId) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', orderId);

    if (!error) {
      set({
        orders: get().orders.map(o => o.id === orderId ? { ...o, status: 'cancelled' } : o)
      });
    }
  },

  fetchTables: async (branchId) => {
    const { data, error } = await supabase
      .from('restaurant_tables')
      .select('*')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .order('table_number', { ascending: true });

    if (!error && data) {
      set({ tables: data as RestaurantTable[] });
    }
  },

  updateTableStatus: async (tableId, status, orderId = null) => {
    const updateData: any = { status };
    if (orderId !== undefined) updateData.current_order_id = orderId;

    const { error } = await supabase
      .from('restaurant_tables')
      .update(updateData)
      .eq('id', tableId);
    
    if (!error) {
      set(state => ({
        tables: state.tables.map(t => t.id === tableId ? { ...t, status, current_order_id: orderId } : t)
      }));
    }
  },

  linkOrderToTable: async (tableId, orderId) => {
    const { error } = await supabase
      .from('restaurant_tables')
      .update({ current_order_id: orderId, status: 'occupied' })
      .eq('id', tableId);
    
    if (!error) {
      set(state => ({
        tables: state.tables.map(t => t.id === tableId ? { ...t, current_order_id: orderId, status: 'occupied' } : t)
      }));
    }
  },

  unlinkOrderFromTable: async (tableId) => {
    const { error } = await supabase
      .from('restaurant_tables')
      .update({ current_order_id: null, status: 'available' })
      .eq('id', tableId);
    
    if (!error) {
      set(state => ({
        tables: state.tables.map(t => t.id === tableId ? { ...t, current_order_id: null, status: 'available' } : t)
      }));
    }
  },

  updateTablePosition: async (tableId, position_x, position_y) => {
    // Optimistic update
    set(state => ({
      tables: state.tables.map(t => t.id === tableId ? { ...t, position_x, position_y } : t)
    }));
    
    try {
      const response = await fetch('/api/manage-tables', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId, position_x, position_y })
      });
      if (!response.ok) throw new Error('Failed to update position');
    } catch (error) {
      console.error(error);
      // Optional: rollback on error
    }
  },

  addTable: async (branchId, table_number, capacity = 4) => {
    try {
      const response = await fetch('/api/manage-tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId, table_number, capacity })
      });
      const result = await response.json();
      if (result.table) {
        set(state => ({ tables: [...state.tables, result.table] }));
      }
    } catch (error) {
      console.error(error);
      alert("Failed to add table");
    }
  },

  removeTable: async (tableId) => {
    try {
      const response = await fetch(`/api/manage-tables?tableId=${tableId}`, {
        method: 'DELETE'
      });
      const result = await response.json();
      if (result.success) {
        set(state => ({
          tables: state.tables.filter(t => t.id !== tableId)
        }));
      } else {
        throw new Error(result.error || 'Failed to remove table');
      }
    } catch (error: any) {
      console.error(error);
      alert("Failed to remove table: " + error.message);
    }
  },

  transferOrder: async (orderId, fromTableId, toTableId) => {
    // 1. Update Order record
    const { error: orderError } = await supabase
      .from('orders')
      .update({ table_id: toTableId })
      .eq('id', orderId);
    
    if (orderError) throw orderError;

    // 2. Release old table
    if (fromTableId) {
      await supabase
        .from('restaurant_tables')
        .update({ current_order_id: null, status: 'available' })
        .eq('id', fromTableId);
    }

    // 3. Occupy new table
    await supabase
      .from('restaurant_tables')
      .update({ current_order_id: orderId, status: 'occupied' })
      .eq('id', toTableId);

    // 4. Update local state
    set(state => ({
      orders: state.orders.map(o => o.id === orderId ? { ...o, table_id: toTableId } : o),
      tables: state.tables.map(t => {
        if (t.id === fromTableId) return { ...t, current_order_id: null, status: 'available' };
        if (t.id === toTableId) return { ...t, current_order_id: orderId, status: 'occupied' };
        return t;
      })
    }));
  },

  subscribeToAllOrders: (branchId) => {
    const channelId = `reception-orders-${Math.random().toString(36).substring(2, 9)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `branch_id=eq.${branchId}`
        },
        (payload: any) => {
          // Play sound if a new order arrives from the Kiosk
          if (payload.eventType === 'INSERT' && payload.new?.order_source === 'kiosk') {
            playChime();
          }
          get().fetchOrders(branchId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  subscribeToTables: (branchId) => {
    const channelId = `reception-tables-${Math.random().toString(36).substring(2, 9)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'restaurant_tables',
          filter: `branch_id=eq.${branchId}`
        },
        () => {
          get().fetchTables(branchId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
}));
