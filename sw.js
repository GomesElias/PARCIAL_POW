/* ================================================================
   sw.js — SkyDash-Manager Service Worker
   Provides offline capability:
     - App shell cached on install
     - Cache-first for static assets
     - Network-first for API calls (with cache fallback)
   ================================================================ */
'use strict';

var CACHE_NAME    = 'skydash-v1.2';
var CACHE_OFFLINE = 'skydash-offline-v1.2';

// App shell – static assets to pre-cache on install
var APP_SHELL = [
  './',
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

/* ── Install: Pre-cache App Shell ───────────────────────────────── */
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('[SW] Pre-caching app shell...');
        // Cache individually to avoid failing the whole install on one miss
        return Promise.allSettled(
          APP_SHELL.map(function(url) {
            return cache.add(url).catch(function(err) {
              console.warn('[SW] Failed to cache:', url, err);
            });
          })
        );
      })
      .then(function() {
        // Skip waiting to activate immediately
        return self.skipWaiting();
      })
  );
});

/* ── Activate: Clean up old caches ──────────────────────────────── */
self.addEventListener('activate', function(event) {
  var validCaches = [CACHE_NAME, CACHE_OFFLINE];

  event.waitUntil(
    caches.keys()
      .then(function(cacheNames) {
        return Promise.all(
          cacheNames.map(function(name) {
            if (validCaches.indexOf(name) === -1) {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            }
          })
        );
      })
      .then(function() {
        return self.clients.claim();
      })
  );
});

/* ── Fetch: Network-first with cache fallback ────────────────────── */
self.addEventListener('fetch', function(event) {
  var url = event.request.url;

  // Skip non-GET requests and browser extensions
  if (event.request.method !== 'GET') return;
  if (url.startsWith('chrome-extension://')) return;
  if (url.startsWith('moz-extension://'))    return;

  // API requests (Open-Meteo, Nominatim, map tiles): Network-first
  if (
    url.includes('api.open-meteo.com') ||
    url.includes('nominatim.openstreetmap.org') ||
    url.includes('tile.openstreetmap.org')
  ) {
    event.respondWith(networkFirstWithCache(event.request));
    return;
  }

  // Static assets: Cache-first
  event.respondWith(cacheFirstWithNetwork(event.request));
});

/* ── Strategy: Cache-First ──────────────────────────────────────── */
function cacheFirstWithNetwork(request) {
  return caches.match(request)
    .then(function(cachedResponse) {
      if (cachedResponse) return cachedResponse;

      return fetch(request)
        .then(function(networkResponse) {
          if (networkResponse && networkResponse.status === 200) {
            var cloned = networkResponse.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(request, cloned);
            });
          }
          return networkResponse;
        })
        .catch(function() {
          // Return offline fallback for navigation requests
          if (request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return new Response('', { status: 503, statusText: 'Service Unavailable' });
        });
    });
}

/* ── Strategy: Network-First ────────────────────────────────────── */
function networkFirstWithCache(request) {
  return fetch(request)
    .then(function(networkResponse) {
      if (networkResponse && networkResponse.status === 200) {
        var cloned = networkResponse.clone();
        caches.open(CACHE_OFFLINE).then(function(cache) {
          cache.put(request, cloned);
        });
      }
      return networkResponse;
    })
    .catch(function() {
      // Offline → try cache
      return caches.match(request)
        .then(function(cached) {
          return cached || new Response(
            JSON.stringify({ error: 'offline' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          );
        });
    });
}
