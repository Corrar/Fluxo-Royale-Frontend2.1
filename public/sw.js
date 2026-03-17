// ficheiro: public/sw.js
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

const CACHE_NAME = 'fluxo-royale-api-cache-v3';

// 1. ✨ PRÉ-CACHE MÁGICO: O VitePWA injeta aqui todos os ficheiros (HTML, JS, CSS, Imagens)
// Isto resolve a TELA PRETA. O código das abas já vai estar guardado aqui!
precacheAndRoute(self.__WB_MANIFEST || []);

// 2. ✨ ROTA SPA: Garante que as abas e o botão "Atualizar" funcionem offline
try {
  const handler = createHandlerBoundToURL('/index.html');
  const navigationRoute = new NavigationRoute(handler, {
    denylist: [new RegExp('^/api/')] // Não aplica isto a chamadas de base de dados
  });
  registerRoute(navigationRoute);
} catch (e) {
  console.warn('Aviso: Navegação offline não configurada.', e);
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// 3. ✨ INTERCETOR DA API: Guarda apenas os dados do backend
self.addEventListener('fetch', (event) => {
  // Só intercetamos tentativas de ler dados (GET)
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Define o que é uma chamada de API (para a nossa Base de Dados)
  // Ignora ficheiros locais, imagens e scripts (o código lá em cima já tratou deles!)
  const isApi = url.pathname.startsWith('/api') || 
                (url.hostname !== self.location.hostname && !url.hostname.includes('vite') && !url.hostname.includes('localhost'));

  if (!isApi) {
    return; // Passa o controlo de volta para o navegador carregar as abas normalmente
  }

  // Tenta ir à internet buscar os dados novos. Se falhar, vai ao cofre!
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
        if (cachedResponse) {
          return cachedResponse;
        }
        // Se falhar a net e não houver cache, devolvemos um array vazio para a tela não dar erro
        return new Response(JSON.stringify({ error: 'Offline', data: [] }), { 
          status: 503, 
          headers: { 'Content-Type': 'application/json' } 
        });
      })
  );
});

// =========================================================================
// 🔥 OUVINTE DE PUSH E CLIQUE (Notificações) - Intacto e Funcional!
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
