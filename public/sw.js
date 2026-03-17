// public/sw.js

// Altera o nome do cache para forçar a atualização imediata nos clientes
const CACHE_NAME = 'fluxo-royale-v2';

// Ficheiros mínimos para a app abrir sem internet
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/favicon.png',
  '/manifest.json',
  '/logo-royale.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  // Obriga o novo Service Worker a instalar imediatamente
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      // Apaga caches antigos (ex: v1) para não haver conflitos
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      );
    })
  );
  // Assume o controlo das abas abertas imediatamente
  event.waitUntil(self.clients.claim());
});

// =========================================================================
// 🔥 OUVINTE DE FETCH: REDE PRIMEIRO, CACHE DEPOIS (Network-First)
// =========================================================================
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. BYPASS COMPLETO PARA O VITE E API
  if (
    url.pathname.startsWith('/api/') || 
    url.pathname.startsWith('/@vite/') || 
    url.pathname.startsWith('/@fs/') || 
    url.pathname.startsWith('/@react-refresh') || 
    url.pathname.startsWith('/src/') || 
    url.pathname.includes('node_modules') ||
    url.hostname === 'localhost' || 
    url.hostname === '127.0.0.1' 
  ) {
    return; // Deixa passar direto
  }

  // 2. ESTRATÉGIA NETWORK-FIRST (Rede primeiro, fallback para offline)
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Se a internet funcionou e a resposta é válida, atualiza o cofre!
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            if(event.request.url.startsWith('http')) {
               cache.put(event.request, responseToCache);
            }
          });
        }
        return networkResponse; // Devolve a versão mais recente ao utilizador!
      })
      .catch(async () => {
        // 3. SE A INTERNET FALHAR (OFFLINE), VAI BUSCAR AO COFRE!
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse; // Devolve o ficheiro guardado offline
        }
        
        // Se for uma navegação de página que falhou, mostra o index.html (PWA)
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      })
  );
});

// =========================================================================
// 🔥 OUVINTE DE PUSH E CLIQUE (Notificações)
// =========================================================================
self.addEventListener('push', (event) => {
  let data = { title: 'Nova Solicitação', body: 'Há um novo pedido no almoxarifado.', url: '/requests' };
  if (event.data) {
    try { data = event.data.json(); } catch (e) { data.body = event.data.text(); }
  }

  const options = {
    body: data.body,
    icon: '/favicon.png', badge: '/favicon.png',
    vibrate: [200, 100, 200], tag: 'request-notification', renotify: true,
    data: { url: data.url || '/requests' },
    actions: [{ action: 'open', title: 'Ver Pedido' }]
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = new URL(event.notification.data.url, self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});
