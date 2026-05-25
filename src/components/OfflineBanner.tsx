'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, RefreshCw, Loader2 } from 'lucide-react';
import { useOfflineStore } from '@/stores/useOfflineStore';

export function OfflineBanner() {
  const { isOnline, isSyncing, queue, setOnline, syncQueue } = useOfflineStore();

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    // Set initial state
    setOnline(navigator.onLine);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setOnline]);

  return (
    <AnimatePresence>
      {/* OFFLINE BANNER */}
      {!isOnline && (
        <motion.div
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed top-0 left-0 right-0 z-[999] bg-red-600 text-white px-6 py-3 flex items-center justify-between shadow-2xl"
        >
          <div className="flex items-center gap-3">
            <WifiOff size={18} />
            <span className="font-black uppercase tracking-widest text-sm">
              Offline Mode — Orders will sync when connected
            </span>
          </div>
          {queue.length > 0 && (
            <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-black">
              {queue.length} order{queue.length > 1 ? 's' : ''} queued
            </span>
          )}
        </motion.div>
      )}

      {/* SYNCING BANNER — shows briefly when coming back online */}
      {isOnline && isSyncing && (
        <motion.div
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-[999] bg-amber-500 text-black px-6 py-3 flex items-center gap-3 shadow-2xl"
        >
          <Loader2 size={18} className="animate-spin" />
          <span className="font-black uppercase tracking-widest text-sm">
            Syncing {queue.length} offline order{queue.length > 1 ? 's' : ''} to server...
          </span>
        </motion.div>
      )}

      {/* ONLINE + QUEUE CLEARED confirmation */}
      {isOnline && !isSyncing && queue.length === 0 && (
        <></>  
      )}
    </AnimatePresence>
  );
}
