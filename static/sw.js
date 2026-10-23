// Five Big Things — service worker
// Strategy:
// - App shell + static: precache, stale-while-revalidate for versioned assets
// - Navigations: network-first, fall back to cache, then /offline.html
// - /api/daily and /api/junior: network-first, NEVER serve a stale day's round
// - /api/practice and /api/junior-practice: network-first, cache fallback OK
// Bump VERSION whenever the shell changes to retire old caches.
const VERSION = 'fbt-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

const SHELL_URLS = [
  '/',
  '/junior',
  '/globe',
  '/offline.html',
  '/manifest.webmanifest',
  '/static/style.css?v=3',
  '/static/globe.css?v=1',
  '/static/app.js?v=6',
  '/static/junior.js?v=1',
  '/static/junior-data.js?v=1',
  '/static/globe.js?v=1',
  '/static/globe-countries.js?v=1',
  '/static/icons/icon.svg',
  '/static/icons/apple-touch-icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // --- Daily APIs: network only, never a stale day's questions ---
  if (sameOrigin && (url.pathname === '/api/daily' || url.pathname === '/api/junior')) {
    event.respondWith(
      fetch(request).catch(() => new Response(
        JSON.stringify({ error: 'You are offline. Today\u2019s round needs a connection.' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      ))
    );
    return;
  }

  // --- Practice APIs: network-first, cache fallback (timeless content) ---
  if (sameOrigin && (url.pathname === '/api/practice' || url.pathname === '/api/junior-practice')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((hit) => hit || new Response(
          JSON.stringify({ error: 'You are offline and no practice round is cached yet.' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        )))
    );
    return;
  }

  // --- Navigations: network-first, cache fallback, then offline page ---
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(url.pathname, copy));
          return res;
        })
        .catch(() => caches.match(url.pathname).then((hit) => hit || caches.match('/offline.html')))
    );
    return;
  }

  // --- Static / CDN / fonts / globe texture: stale-while-revalidate ---
  event.respondWith(
    caches.match(request).then((hit) => {
      const network = fetch(request)
        .then((res) => {
          if (res.ok || res.type === 'opaque') {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || network;
    })
  );
});
