const CACHE = 'valorae-proxy-monitor-v21-12-382-ui-v353';
const SHELL = [
  '/server.html',
  '/monitor-valorae.css',
  '/monitor-valorae.js',
  '/manifest.webmanifest',
  '/assets/valorae-logo.svg',
  '/assets/valorae-icon-192.png',
  '/assets/valorae-icon-512.png',
  '/assets/valorae-monitor-benchmarks.json',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE && key.startsWith('valorae-proxy-monitor-')).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put('/server.html', copy));
          return response;
        })
        .catch(() => caches.match('/server.html')),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request).then(response => {
        if (response.ok) caches.open(CACHE).then(cache => cache.put(request, response.clone()));
        return response;
      });
      return cached || network;
    }),
  );
});
