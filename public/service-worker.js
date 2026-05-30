// Compat: supersedes v21-12-0; UI patch v21-12-49; compat legacy v21-12-48
const CACHE_NAME = 'valorae-proxy-server-v21-12-49';// Compat: v21-12-0; patch v21-12-49
const STATIC_ASSETS = [
  '/server.html',
  '/index.html',
  '/manifest.webmanifest',
  '/assets/valorae-logo.svg',
  '/assets/valorae-icon-192.png',
  '/assets/valorae-icon-512.png',
  '/downloads/README_INTEGRACAO.md',
  '/downloads/VALORAE_INTEGRATION_PROMPT.md',
  '/downloads/valorae-client-web.js',
  '/downloads/valorae-android-kotlin.kt',
  '/downloads/valorae-api-contract.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  // Ignora qualquer requisição que não seja GET (seguro contra requisições POST/PUT que não podem ser cacheadas)
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  // Ignora qualquer rota de API (/api, /api/server/metrics, /api/health, etc)
  if (url.pathname.startsWith('/api')) return;
  
  // Network-First Strategy: Sempre tenta a rede primeiro para garantir atualizações visuais. APIs nunca são interceptadas.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          
          // Se for uma requisição de página/navegação, serve o Painel como fallback
          if (url.pathname.endsWith('.html') || url.pathname === '/' || !url.pathname.includes('.')) {
            return caches.match('/server.html');
          }
          
          // Retorna uma resposta válida de offline/indisponível para evitar que o navegador dispare "Failed to fetch" (TypeError)
          return new Response('Indisponível (Offline)', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({ 'Content-Type': 'text/plain; charset=utf-8' })
          });
        });
      })
  );
});
