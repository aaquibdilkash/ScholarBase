const CACHE_NAME = "scholarbase-v2";
const urlsToCache = [
  "/",
  "/manifest.json",
  "/logo.png",
  "/favicon.ico",
  "/api/og-image",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keyList) =>
      Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = event.request.url;

  // Never serve cached bundles during local development. Without this guard,
  // the service worker can keep an older React client in front of Next.js HMR.
  if (self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1") {
    event.respondWith(fetch(event.request));
    return;
  }
  
  if (url.includes("/api/")) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/"))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
