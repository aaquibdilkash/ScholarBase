const CACHE_NAME = "scholarbase-v4";
const urlsToCache = [
  "/",
  "/manifest.json",
  "/logo.png",
  "/favicon.ico",
  "/favicon.svg",
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
  //
  // Returning *without* `respondWith` is what enforces that: the browser then
  // handles the request natively, so the caching branch below can never run.
  // Re-issuing it here with `fetch(event.request)` would also route every dev
  // request through this worker (page -> worker -> network -> worker -> page)
  // and make each one show up twice in the DevTools Network panel — once for
  // the page, once for `sw.js` — which is easy to mistake for a duplicate call.
  if (self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1") {
    return;
  }

  // API responses are per-user and must never be cached, so there is nothing
  // for this worker to do with them.
  if (url.includes("/api/")) {
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

/**
 * Message Web Push.
 *
 * The server has already decided that no ScholarBase tab was visible, so the
 * push is always rendered as a real OS notification (required by
 * `userVisibleOnly: true`). The `tag` collapses repeat messages from the same
 * conversation into a single notification instead of stacking them.
 */
self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || "New message";
  const options = {
    body: payload.body || "You have a new message on ScholarBase.",
    icon: "/logo.png",
    badge: "/favicon.ico",
    tag: payload.tag || "scholarbase-message",
    renotify: true,
    data: { url: payload.url || "/messages" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/**
 * Focus an existing ScholarBase tab if one is open (navigating it to the
 * conversation), otherwise open a new one.
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || "/messages";

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of clientList) {
        let clientUrl;
        try {
          clientUrl = new URL(client.url);
        } catch {
          continue;
        }
        if (clientUrl.origin !== self.location.origin) continue;

        await client.focus();
        if ("navigate" in client) {
          try {
            await client.navigate(targetUrl);
          } catch {
            // Cross-origin or detached client — focus alone is good enough.
          }
        }
        return;
      }

      await self.clients.openWindow(targetUrl);
    })()
  );
});
