/* ============================================================
   SERVICE WORKER — Joseph Matthos
   Cache básico para offline + fallback offline.html
   ============================================================ */

const CACHE_VERSION = 'jm-v5';
const CACHE_STATIC = [
  '/',
  '/index.html',
  '/offline.html',
  '/termos-uso.html',
  '/politica-privacidade.html',
  '/css/style.css',
  '/js/utils.js',
  '/js/config.js',
  '/js/audioDB.js',
  '/js/store.js',
  '/js/site.js',
  '/js/admin.js'
];

// Instala e faz cache dos arquivos estáticos
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      return cache.addAll(CACHE_STATIC).catch(function (err) {
        console.warn('[SW] Alguns arquivos não puderam ser cacheados:', err);
      });
    })
  );
  self.skipWaiting();
});

// Ativa e remove caches antigos
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE_VERSION; })
            .map(function (key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

// Estratégia:
// - HTML: network-first (sempre tenta atualizar, cai pro cache se offline)
// - Outros: cache-first (rápido, com fallback pra rede)
self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Nunca armazena respostas de API: sessões, compras e dados do admin
  // devem sempre ser consultados na rede e não podem ficar no cache offline.
  if (url.pathname.indexOf('/api/') === 0) return;

  // Navegação (HTML)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(function (res) {
          var clone = res.clone();
          caches.open(CACHE_VERSION).then(function (c) { c.put(req, clone); });
          return res;
        })
        .catch(function () {
          return caches.match(req).then(function (cached) {
            return cached || caches.match('/offline.html');
          });
        })
    );
    return;
  }

  // Outros recursos
  event.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (res) {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        var clone = res.clone();
        caches.open(CACHE_VERSION).then(function (c) { c.put(req, clone); });
        return res;
      }).catch(function () {
        // Fallback pra imagens
        if (req.destination === 'image') {
          return caches.match('/assets/img/placeholder.jpg');
        }
      });
    })
  );
});