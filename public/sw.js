const CACHE_NAME = "scholarbase-v9";
// Precached so the installed app has a usable offline shell. `addAll` is
// all-or-nothing — one failed entry aborts the entire install, the worker never
// activates, and the app silently stops being installable. So each entry is
// added individually and failures are tolerated: a missing icon must not cost
// the user the whole app.
const urlsToCache = [
  "/",
  // NOTE: "/manifest.json" is deliberately NOT precached. A cached manifest is
  // a manifest the browser cannot update, and it gates both installability and
  // `getInstalledRelatedApps`. See the fetch handler below.
  "/logo.png",
  "/icon-192.png",
  "/favicon.ico",
  "/favicon.svg",
  "/badge.png",
];

self.addEventListener("install", (event) => {
  // Added one at a time rather than via `addAll`, which rejects the whole batch
  // if any single entry fails. Tolerating partial failure is what keeps the
  // worker activating reliably, and activation is a precondition for
  // `beforeinstallprompt` — i.e. for the install button appearing at all.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        urlsToCache.map((url) =>
          // `reload` bypasses the HTTP cache so a precache never stores a stale
          // copy of a shell that has since changed.
          cache.add(new Request(url, { cache: "reload" })).catch(() => {
            // Deliberately swallowed: an unreachable asset is not a reason to
            // refuse to install the app.
          }),
        ),
      ),
    ),
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

  // NOTE: this handler used to bail out early on localhost/127.0.0.1 so that dev
  // never served stale bundles. That silently broke PWA *installability* in dev:
  // Chrome requires a service worker with a real fetch handler before it will
  // fire `beforeinstallprompt`, so skipping respondWith on localhost made the
  // app uninstallable there while working fine in production — the worst kind
  // of bug, since the one place you test is the one place it is broken.
  // Caching is versioned by CACHE_NAME below, so stale-bundle risk is handled
  // there instead.

  // The manifest must NEVER be served from the cache.
  //
  // It is precached below and matched cache-first here, which meant the browser
  // kept reading the manifest as it was at install time. Any later change to it
  // — notably adding `related_applications`, which is what makes
  // `getInstalledRelatedApps` able to report an existing install — was silently
  // ignored, so the app kept thinking it was not installed even when it was.
  // Always go to the network, and never precache it.
  if (url.endsWith("/manifest.json")) {
    event.respondWith(fetch(event.request));
    return;
  }

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
 * WhatsApp-Style Expandable Web Push with iOS Badge Sync
 */
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = {};
  }

  event.waitUntil(
    (async () => {
      const tag = payload.tag || "scholarbase-chat";
      
      // Query active notifications matching this conversation/channel
      const activeNotifications = await self.registration.getNotifications({ tag });
      const existingNotification = activeNotifications.length > 0 ? activeNotifications[0] : null;

      let messageHistory = [];
      const incomingSender = payload.title || "ScholarBase";
      const incomingText = payload.body || "New update";

      if (existingNotification && existingNotification.data?.messages) {
        messageHistory = [
          ...existingNotification.data.messages,
          { sender: incomingSender, text: incomingText },
        ];
      } else {
        messageHistory = [{ sender: incomingSender, text: incomingText }];
      }

      // WhatsApp format: Single line for 1 message, bulleted multiline for 2+ messages
      let displayTitle = incomingSender;
      let displayBody = incomingText;

      if (messageHistory.length > 1) {
        displayTitle = `ScholarBase (${messageHistory.length} messages)`;
        // Slice last 5 messages so the expanded drawer does not overflow
        displayBody = messageHistory
          .slice(-5)
          .map((m) => `• ${m.sender}: ${m.text}`)
          .join("\n");
      }

      // iOS PWA Home Screen Red Badge Update
      if ("setAppBadge" in self.navigator) {
        const unreadTotal = payload.unreadCount || messageHistory.length;
        self.navigator.setAppBadge(unreadTotal).catch(() => {});
      }

      const options = {
        body: displayBody,
        icon: "/logo.png",
        badge: "/badge.png",
        tag: tag,
        renotify: true,
        data: {
          url: payload.url || "/messages",
          messages: messageHistory,
        },
      };

      return self.registration.showNotification(displayTitle, options);
    })()
  );
});

/**
 * Handle notification clicks & clear iOS Home Screen badges
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // Clear iOS unread badge on click
  if ("clearAppBadge" in self.navigator) {
    self.navigator.clearAppBadge().catch(() => {});
  }

  const targetUrl = event.notification.data?.url || "/messages";

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
            // Client already at destination
          }
        }
        return;
      }

      await self.clients.openWindow(targetUrl);
    })()
  );
});

/**
 * Clear iOS badge if notification is dismissed
 */
self.addEventListener("notificationclose", () => {
  if ("clearAppBadge" in self.navigator) {
    self.navigator.clearAppBadge().catch(() => {});
  }
});