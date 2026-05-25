"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/stores/cartStore';
import { useIdleTimer } from '@/hooks/useIdleTimer';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';

const IDLE_MS = 90_000; // show overlay after 90s inactivity
const COUNTDOWN = 15;     // then count down 15s before hard reset

export default function KioskLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const clearCart = useCartStore(s => s.clearCart);

  const [showOverlay, setShowOverlay] = useState(false);
  const [count, setCount] = useState(COUNTDOWN);

  // refs so the interval callback always sees latest state
  const countRef = useRef(COUNTDOWN);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  /** Hard-reset the session */
  const hardReset = () => {
    clearInterval(intervalRef.current);
    clearCart();
    setShowOverlay(false);
    setCount(COUNTDOWN);
    countRef.current = COUNTDOWN;
    router.push('/kiosk');
  };

  /** User tapped "Continue" — dismiss overlay */
  const dismiss = () => {
    clearInterval(intervalRef.current);
    setShowOverlay(false);
    setCount(COUNTDOWN);
    countRef.current = COUNTDOWN;
  };

  /** Called by idle timer after 90s inactivity */
  const onIdle = () => {
    setShowOverlay(true);
    countRef.current = COUNTDOWN;
    setCount(COUNTDOWN);

    intervalRef.current = setInterval(() => {
      countRef.current -= 1;
      setCount(countRef.current);
      if (countRef.current <= 0) hardReset();
    }, 1000);
  };

  // When overlay is showing and user interacts — dismiss it
  useEffect(() => {
    if (!showOverlay) return;
    const handler = () => dismiss();
    window.addEventListener('mousedown', handler);
    window.addEventListener('touchstart', handler);
    return () => {
      window.removeEventListener('mousedown', handler);
      window.removeEventListener('touchstart', handler);
    };
  }, [showOverlay]);

  // Cleanup on unmount
  useEffect(() => () => clearInterval(intervalRef.current), []);

  useIdleTimer(IDLE_MS, onIdle);

  // Circumference of the SVG circle
  const R = 45;
  const circ = 2 * Math.PI * R;

  return (
    <>
      {children}

      <AnimatePresence>
        {showOverlay && (
          <motion.div
            key="idle-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-xl flex items-center justify-center p-8"
          >
            <motion.div
              initial={{ scale: 0.85, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.85, y: 30 }}
              transition={{ type: 'spring', damping: 22, stiffness: 200 }}
              className="bg-[#161618] border border-white/10 rounded-[3rem] p-16 max-w-md w-full text-center shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Countdown ring */}
              <div className="relative w-36 h-36 mx-auto mb-10">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r={R} fill="none" stroke="#ffffff0f" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r={R} fill="none"
                    stroke="#f59e0b" strokeWidth="8"
                    strokeDasharray={circ}
                    strokeDashoffset={circ * (1 - count / COUNTDOWN)}
                    strokeLinecap="round"
                    className="transition-all duration-1000"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-5xl font-black text-white">
                  {count}
                </span>
              </div>

              <h2 className="text-4xl font-black text-white uppercase tracking-tighter mb-3">
                Still There?
              </h2>
              <p className="text-muted text-sm font-bold uppercase tracking-widest mb-10">
                Session resets in <span className="text-primary">{count}s</span>
              </p>

              <Button
                onClick={dismiss}
                className="w-full h-16 rounded-2xl text-xl font-black bg-primary text-black shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform"
              >
                TAP TO CONTINUE
              </Button>

              <button
                onClick={hardReset}
                className="mt-6 text-xs font-black text-muted uppercase tracking-widest hover:text-white transition-colors"
              >
                Start New Order
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
