// RestroSync Service Worker - Offline Caching Strategy
const CACHE_NAME = 'restrosync-cache-v1';

// Core app shell files to cache immediately on install
const APP_SHELL = [
  '/',
  '/kitchen',
  '/kiosk',
  '/reception',
  '/display',
  '/manifest.json',
];

// On install: cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[RestroSync SW] Caching app shell');
      return cache.addAll(APP_SHELL);
    })
  );
  // Skip waiting so new SW activates immediately
  self.skipWaiting();
});

// On activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch strategy: Network First, fallback to Cache
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip Supabase API calls — always go to network
  if (url.hostname.includes('supabase.co')) {
    return;
  }

  // For navigation (page loads): Network first, fallback to cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  // For static assets (JS, CSS, images): Network First, fallback to Cache
  if (
    url.pathname.startsWith('/_next/static') ||
    url.pathname.startsWith('/icons') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg')
  ) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  }
});
