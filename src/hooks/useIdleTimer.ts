"use client";

import { useEffect, useRef } from 'react';

/**
 * Fires `onIdle` after `timeoutMs` ms of no user activity.
 * Resets the timer on any mouse / touch / keyboard / scroll event.
 */
export function useIdleTimer(timeoutMs: number, onIdle: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onIdleRef = useRef<() => void>(onIdle);
  onIdleRef.current = onIdle; // always keep the latest callback

  useEffect(() => {
    const start = () => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => onIdleRef.current(), timeoutMs);
    };

    const EVENTS = ['mousemove', 'mousedown', 'touchstart', 'keydown', 'click', 'scroll'];
    EVENTS.forEach(e => window.addEventListener(e, start, { passive: true }));
    start(); // kick off immediately

    return () => {
      EVENTS.forEach(e => window.removeEventListener(e, start));
      clearTimeout(timerRef.current);
    };
  }, [timeoutMs]);
}
