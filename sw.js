/* ================================================================
   sw.js — SkyDash-Manager Service Worker
   Estrategias:
     - Cache-first  → HTML, CSS, JS, fuentes, Leaflet CDN
     - Network-first → Open-Meteo API, Nominatim, tiles OSM
   ================================================================ */
'use strict';

var CACHE_NAME    = 'skydash-v1.3';
var CACHE_OFFLINE = 'skydash-api-v1.3';

// ─── App Shell: archivos precargados en install ──────────────────
var APP_SHELL = [
  './index.html',
  './dashboard.html',
  './css/styles.css',
  './js/auth.js',
  './js/weather.js',
  './js/favorites.js',
  './js/map.js',
  './js/app.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

/* ── INSTALL: pre-cachear app shell ────────────────────────────── */
self.addEventListener('install', function (event) {
  console.log('[SW] Instalando — precargando app shell...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      // Cache uno por uno para no fallar todo si uno falla
      return Promise.allSettled(
        APP_SHELL.map(function (url) {
          return cache.add(url).catch(function (err) {
            console.warn('[SW] No se pudo cachear:', url, err.message);
          });
        })
      );
    }).then(function () {
      return self.skipWaiting(); // Activar inmediatamente sin esperar recarga
    })
  );
});

/* ── ACTIVATE: limpiar cachés viejos ───────────────────────────── */
self.addEventListener('activate', function (event) {
  var validCaches = [CACHE_NAME, CACHE_OFFLINE];
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names.map(function (name) {
          if (validCaches.indexOf(name) === -1) {
            console.log('[SW] Eliminando caché antigua:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(function () {
      return self.clients.claim(); // Tomar control de todas las pestañas abiertas
    })
  );
});

/* ── FETCH: interceptar peticiones ─────────────────────────────── */
self.addEventListener('fetch', function (event) {
  var url = event.request.url;
  var method = event.request.method;

  // Solo interceptar GET
  if (method !== 'GET') return;

  // Ignorar extensiones del navegador
  if (url.startsWith('chrome-extension://') || url.startsWith('moz-extension://')) return;

  // ── APIs y tiles: Network-first (con fallback a caché) ──────────
  if (
    url.includes('api.open-meteo.com') ||
    url.includes('nominatim.openstreetmap.org') ||
    url.includes('tile.openstreetmap.org')
  ) {
    event.respondWith(networkFirstWithCache(event.request, CACHE_OFFLINE));
    return;
  }

  // ── Assets estáticos y navegación: Cache-first ──────────────────
  event.respondWith(cacheFirstWithNetwork(event.request));
});

/* ── Estrategia: Cache-first (estáticos) ───────────────────────── */
function cacheFirstWithNetwork(request) {
  return caches.match(request).then(function (cached) {
    if (cached) return cached;

    return fetch(request)
      .then(function (response) {
        if (response && response.status === 200 && response.type !== 'opaque') {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(request, clone);
          });
        }
        return response;
      })
      .catch(function () {
        // Sin red y sin caché → devolver index.html para navegación
        if (request.mode === 'navigate') {
          return caches.match('./index.html').then(function (fallback) {
            return fallback || new Response(
              '<h1>SkyDash-Manager</h1><p>Sin conexión. Recarga cuando tengas internet.</p>',
              { headers: { 'Content-Type': 'text/html' } }
            );
          });
        }
        return new Response('', { status: 503 });
      });
  });
}

/* ── Estrategia: Network-first (APIs / tiles) ──────────────────── */
function networkFirstWithCache(request, cacheName) {
  return fetch(request)
    .then(function (response) {
      if (response && response.status === 200) {
        var clone = response.clone();
        caches.open(cacheName).then(function (cache) {
          cache.put(request, clone);
        });
      }
      return response;
    })
    .catch(function () {
      // Sin red → intentar desde caché
      return caches.match(request).then(function (cached) {
        if (cached) {
          console.log('[SW] Sirviendo desde caché offline:', request.url);
          return cached;
        }
        // Sin caché → respuesta vacía tipo API para que weather.js maneje el error
        return new Response(
          JSON.stringify({ error: 'offline', message: 'Sin conexión a internet' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      });
    });
}
