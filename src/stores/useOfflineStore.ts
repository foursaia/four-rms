import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';

export interface OfflineOrder {
  id: string; // Local temporary ID
  branch_id: string;
  order_type: 'dine_in' | 'takeaway';
  table_id: string | null;
  table_number: string | null;
  order_source: string;
  payment_method: string;
  payment_status: string;
  total: number;
  items: any[];
  created_at: string;
  queued_at: number; // timestamp for sorting
}

interface OfflineState {
  isOnline: boolean;
  queue: OfflineOrder[];
  isSyncing: boolean;

  setOnline: (online: boolean) => void;
  addToQueue: (order: Omit<OfflineOrder, 'id' | 'queued_at'>) => void;
  removeFromQueue: (localId: string) => void;
  syncQueue: () => Promise<void>;
}

export const useOfflineStore = create<OfflineState>()(
  persist(
    (set, get) => ({
      isOnline: true,
      queue: [],
      isSyncing: false,

      setOnline: (online) => {
        set({ isOnline: online });
        // Auto-sync when coming back online
        if (online && get().queue.length > 0) {
          get().syncQueue();
        }
      },

      addToQueue: (orderData) => {
        const order: OfflineOrder = {
          ...orderData,
          id: `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          queued_at: Date.now(),
        };
        set((state) => ({ queue: [...state.queue, order] }));
        console.log('[RestroSync Offline] Order queued locally:', order.id);
      },

      removeFromQueue: (localId) => {
        set((state) => ({
          queue: state.queue.filter((o) => o.id !== localId),
        }));
      },

      syncQueue: async () => {
        const { queue, isSyncing, removeFromQueue } = get();
        if (isSyncing || queue.length === 0) return;

        set({ isSyncing: true });
        console.log(`[RestroSync Sync] Syncing ${queue.length} offline orders...`);

        for (const order of queue) {
          try {
            // Insert the order to DB
            const { data: newOrder, error: orderError } = await supabase
              .from('orders')
              .insert({
                branch_id: order.branch_id,
                order_type: order.order_type,
                table_id: order.table_id,
                table_number: order.table_number,
                order_source: order.order_source,
                payment_method: order.payment_method,
                payment_status: order.payment_status,
                total: order.total,
                status: 'confirmed',
              })
              .select('id')
              .single();

            if (orderError) throw orderError;

            // Insert all order items
            if (order.items?.length > 0) {
              const itemsToInsert = order.items.map((item: any) => ({
                order_id: newOrder.id,
                product_id: item.id,
                product_name: item.name,
                unit_price: item.price,
                quantity: item.quantity,
                notes: item.notes || null,
              }));

              const { error: itemsError } = await supabase
                .from('order_items')
                .insert(itemsToInsert);

              if (itemsError) throw itemsError;
            }

            // Remove from queue on success
            removeFromQueue(order.id);
            console.log(`[RestroSync Sync] ✅ Order ${order.id} synced as DB ID: ${newOrder.id}`);
          } catch (err) {
            console.error(`[RestroSync Sync] ❌ Failed to sync order ${order.id}:`, err);
            // Keep in queue, will retry next time
          }
        }

        set({ isSyncing: false });
      },
    }),
    {
      name: 'restrosync-offline-queue', // localStorage key
      partialize: (state) => ({ queue: state.queue }), // Only persist the queue, not online status
    }
  )
);
