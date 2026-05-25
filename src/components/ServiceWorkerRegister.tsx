'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('[RMS] Service Worker registered:', reg.scope))
        .catch((err) => console.error('[RMS] SW registration failed:', err));
    }
  }, []);

  return null;
}
