// ficheiro: public/sw.js
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

// ✨ Subimos a versão para V5 para forçar os telemóveis a apagarem a versão antiga com tela preta!
const CACHE_NAME = 'fluxo-royale-api-cache-v5';

// 1. PRÉ-CACHE: Injeta todos os ficheiros (HTML, JS, CSS, Imagens)
precacheAndRoute(self.__WB_MANIFEST || []);

// 2. ROTA DE SEGURANÇA PARA ABAS SPA (A Batalha contra a Tela Preta)
// Tenta mapear o index.html com ou sem barra inicial, pois o Vite pode compilar de ambas as formas
let handler;
try {
  handler = createHandlerBoundToURL('/index.html');
} catch (e) {
  try {
    handler = createHandlerBoundToURL('index.html');
  } catch (e2) {
    console.warn('Aviso: index.html não encontrado no manifesto de pré-cache.');
  }
}

if (handler) {
  const navigationRoute = new NavigationRoute(handler, {
    denylist: [new RegExp('^/api/')] // Deixa as chamadas de API passarem para o nosso intercetor abaixo
  });
  registerRoute(navigationRoute);
}

// Força a instalação deste novo Service Worker de imediato
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Limpeza de cofre velho! Apaga as versões antigas que causavam a tela preta
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name.includes('fluxo-royale-api-cache') && name !== CACHE_NAME) {
            console.log('Apagando cache antigo:', name);
            return caches.delete(name);
          }
        })
      );
    })
  );
  event.waitUntil(self.clients.claim());
});

// 3. INTERCETOR DA BASE DE DADOS (SÓ DADOS GET)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Define o que é uma chamada de API
  const isApi = url.pathname.startsWith('/api') || 
                (url.hostname !== self.location.hostname && !url.hostname.includes('vite') && !url.hostname.includes('localhost'));

  if (!isApi) return; // Se não for API (ex: mudar de aba), deixa o precache/navigation route tratar!

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) return cachedResponse;
        
        // Se não houver net nem cache, devolvemos vazio para evitar ecrãs de erro fatais
        return new Response(JSON.stringify({ error: 'Offline', data: [] }), { 
          status: 503, 
          headers: { 'Content-Type': 'application/json' } 
        });
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
