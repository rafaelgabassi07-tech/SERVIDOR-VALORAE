const CACHE_NAME = 'valorae-proxy-shell-v21-5-13-header-mobile-desktop-fix';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/logo-mark.svg',
  '/logo.svg',
  '/favicon.svg',
  '/pwa-icon-192.png',
  '/pwa-icon-512.png',
  '/apple-touch-icon.png',
  '/downloads/valorae-proxy-integration-prompt.md',
  '/downloads/valorae-proxy-integration-coordinates.json',
  '/downloads/valorae-proxy-quickstart.md'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => /^valorae-proxy-/.test(key) && key !== CACHE_NAME)
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Nunca cachear dados reais do Proxy; observability, health e scraping devem ser network-first puro.
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith((async () => {
    const cached = await caches.match(request);
    const fetchPromise = fetch(request).then(response => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
      }
      return response;
    }).catch(async () => cached || caches.match('/index.html'));
    return cached || fetchPromise;
  })());
});
