import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { playChime } from '@/lib/audio';

export interface KitchenOrder {
  id: string;
  order_number: string;
  order_type: 'dine_in' | 'takeaway';
  order_source: 'kiosk' | 'pos';
  branch_id: string;
  table_id?: string;
  table_number?: string;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'dispatched' | 'delivered' | 'cancelled';
  payment_status: 'paid' | 'unpaid';
  payment_method: 'cash' | 'card';
  total: number;
  created_at: string;
  items: KitchenOrderItem[];
}



export interface KitchenOrderItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  notes?: string;
  customisations?: any[];
}


interface KitchenState {
  orders: KitchenOrder[];
  recentOrders: KitchenOrder[];
  isLoading: boolean;
  fetchLiveOrders: (branchId: string) => Promise<void>;
  fetchRecentOrders: (branchId: string) => Promise<void>;
  updateOrderStatus: (orderId: string, status: KitchenOrder['status']) => Promise<void>;
  subscribeToOrders: (branchId: string, callbacks?: { onNewOrder?: () => void, onReady?: () => void }) => () => void;
}

export const useKitchenStore = create<KitchenState>((set, get) => ({
  orders: [],
  recentOrders: [],
  isLoading: false,

  fetchLiveOrders: async (branchId) => {
    set({ isLoading: true });
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        items:order_items (*, customisations:order_item_customisations(*))
      `)
      .eq('branch_id', branchId)
      .eq('payment_status', 'paid')
      .in('status', ['confirmed', 'preparing', 'ready'])
      .order('created_at', { ascending: true });

    if (!error && data) {
      set({ orders: data as KitchenOrder[], isLoading: false });
    } else {
      set({ isLoading: false });
    }
  },

  fetchRecentOrders: async (branchId) => {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        items:order_items (*, customisations:order_item_customisations(*))
      `)
      .eq('branch_id', branchId)
      .eq('status', 'delivered')
      .order('updated_at', { ascending: false })
      .limit(10);

    if (!error && data) {
      set({ recentOrders: data as KitchenOrder[] });
    }
  },

  updateOrderStatus: async (orderId, status) => {
    const { error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId);

    if (!error) {
      // Refresh both lists if an order was recalled or completed
      const branchId = get().orders[0]?.branch_id || get().recentOrders[0]?.branch_id;
      if (branchId) {
        get().fetchLiveOrders(branchId);
        get().fetchRecentOrders(branchId);
      }
    }
  },

  subscribeToOrders: (branchId: string, callbacks?: { onNewOrder?: () => void, onReady?: () => void }) => {
    const channelId = `kitchen-orders-${Math.random().toString(36).substring(2, 9)}`;
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
          // New Order logic
          const isNewOrder = payload.eventType === 'INSERT' && payload.new?.status === 'confirmed';
          const isNewlyConfirmed = payload.eventType === 'UPDATE' && 
                                  payload.new?.status === 'confirmed' && 
                                  payload.old?.status !== 'confirmed';
          
          // Ready logic
          const isNewlyReady = payload.eventType === 'UPDATE' && 
                              payload.new?.status === 'ready' && 
                              payload.old?.status !== 'ready';
          
          if ((isNewOrder || isNewlyConfirmed) && callbacks?.onNewOrder) {
            callbacks.onNewOrder();
          }
          
          if (isNewlyReady && callbacks?.onReady) {
            callbacks.onReady();
          }

          get().fetchLiveOrders(branchId);
          get().fetchRecentOrders(branchId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
}));
