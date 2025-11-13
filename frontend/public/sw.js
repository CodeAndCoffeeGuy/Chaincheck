// Service Worker for ChainCheck PWA
const CACHE_NAME = "chaincheck-v3";
const RUNTIME_CACHE = "chaincheck-runtime-v3";

// Assets to cache on install
const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/logo.png",
  "/manifest.json",
];

// Install event - cache assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE;
          })
          .map((cacheName) => caches.delete(cacheName))
      );
    })
  );
  return self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener("fetch", (event) => {
  // Skip non-GET requests
  if (event.request.method !== "GET") {
    return;
  }

  // Skip external requests (blockchain RPC, etc.)
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Don't cache assets with hashes (they're immutable and should always come from network)
  const url = new URL(event.request.url);
  const isHashedAsset = /\/assets\/.*-[a-zA-Z0-9]+\.(js|css|mjs)$/.test(url.pathname);
  
  // For hashed assets, always fetch from network first (they're immutable)
  if (isHashedAsset) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache for offline use, but always check network first
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache only if network fails
          return caches.match(event.request);
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((response) => {
          // Don't cache if not a valid response
          if (!response || response.status !== 200 || response.type !== "basic") {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          // Cache the response
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return response;
        })
        .catch(() => {
          // Return offline page if available
          if (event.request.destination === "document") {
            return caches.match("/index.html");
          }
        });
    })
  );
});

