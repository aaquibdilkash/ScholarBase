const CACHE_NAME = "scholarbase-v13";
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
        }),
      ),
    ),
  );
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = event.request.url;

  // Never touch cross-origin requests. Two reasons, and the second is the one
  // that bit us in production-shaped dev:
  //
  //   1. They are not ours to cache. The cache holds our own app shell only.
  //
  //   2. Re-issuing one from the worker runs it under the WORKER's OWN CSP,
  //      which by design does not enumerate every external host. A remote avatar
  //      (lh3.googleusercontent.com, res.cloudinary.com) is then blocked by the
  //      worker's `connect-src`: the browser logs
  //        directive=connect-src blocked=https://lh3.googleusercontent.com/…
  //        page=http://localhost:3000/sw.js
  //      and the image silently fails to render. Handing the request back to the
  //      browser means it loads under the PAGE's `img-src`, which is precisely
  //      the directive that already lists those hosts.
  if (new URL(url).origin !== self.location.origin) {
    return;
  }

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

  // Never touch non-GET requests or Next.js RSC / Server Action traffic.
  // Server Actions are POSTs to the page URL carrying a `Next-Action` header,
  // and client navigations fetch RSC payloads (`RSC` header / `_rsc` param).
  // Re-issuing these from the worker — or matching them against the cached
  // HTML shell — can hand Next.js a non-RSC response, which surfaces as
  // "An unexpected response was received from the server."
  const headers = event.request.headers;
  if (
    event.request.method !== "GET" ||
    headers.has("Next-Action") ||
    headers.has("RSC") ||
    headers.has("Next-Router-State-Tree") ||
    new URL(url).searchParams.has("_rsc")
  ) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("/")));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    }),
  );
});

/**
 * WhatsApp-Style Expandable Web Push with iOS Badge Sync
 *
 * Exactly-once rendering: QStash may redeliver the same logical message
 * (retry after a transient push-service failure). Every payload carries
 * `messageId`; an id already present in the visible notification's
 * `data.seenIds` OR in the 24h IndexedDB ledger is dropped before
 * `showNotification` — no second buzz, no duplicate `• Sender: hi` line.
 * The per-conversation `tag` still collapses N distinct messages into one OS
 * notification.
 */
const SEEN_PUSH_DB = "scholarbase-push-seen";
const SEEN_PUSH_STORE = "seen-message-ids";
const SEEN_PUSH_TTL_MS = 24 * 60 * 60 * 1000;

function openSeenPushDb() {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(SEEN_PUSH_DB, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(SEEN_PUSH_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function hasSeenPushMessage(db, messageId) {
  if (!db || !messageId) return false;
  try {
    const entry = await new Promise((resolve) => {
      try {
        const tx = db.transaction(SEEN_PUSH_STORE, "readonly");
        const get = tx.objectStore(SEEN_PUSH_STORE).get(messageId);
        get.onsuccess = () => resolve(get.result);
        get.onerror = () => resolve(undefined);
      } catch {
        resolve(undefined);
      }
    });
    return !!entry && Date.now() - entry.seenAt < SEEN_PUSH_TTL_MS;
  } catch {
    return false;
  }
}

async function markPushMessageSeen(db, messageId) {
  if (!db || !messageId) return;
  try {
    await new Promise((resolve) => {
      try {
        const tx = db.transaction(SEEN_PUSH_STORE, "readwrite");
        tx.objectStore(SEEN_PUSH_STORE).put(
          { seenAt: Date.now() },
          messageId,
        );
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch {
    // Best-effort ledger — a failure just means this device relies on the
    // in-notification `seenIds` instead.
  }
}

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
      const incomingId = payload.messageId || null;

      // Query active notifications matching this conversation/channel
      const activeNotifications = await self.registration.getNotifications({
        tag,
      });
      const existingNotification =
        activeNotifications.length > 0 ? activeNotifications[0] : null;

      const seenIds = Array.isArray(existingNotification?.data?.seenIds)
        ? existingNotification.data.seenIds
        : [];

      // Fast path: duplicate still attached to the visible notification.
      if (incomingId && seenIds.includes(incomingId)) return;

      // Slow path: notification was dismissed, but the retry arrives within
      // 24h — the ledger remembers it.
      let seenDb = null;
      if (incomingId && !seenIds.includes(incomingId)) {
        seenDb = await openSeenPushDb();
        if (await hasSeenPushMessage(seenDb, incomingId)) {
          if (seenDb) seenDb.close();
          return;
        }
      }

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

      const nextSeenIds = incomingId ? [...seenIds, incomingId].slice(-50) : seenIds;
      if (seenDb) {
        await markPushMessageSeen(seenDb, incomingId);
        seenDb.close();
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
          seenIds: nextSeenIds,
        },
      };

      return self.registration.showNotification(displayTitle, options);
    })(),
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
    })(),
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
