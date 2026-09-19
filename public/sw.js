const CACHE_NAME = "scholarbase-v6";
const urlsToCache = [
  "/",
  "/manifest.json",
  "/logo.png",
  "/favicon.ico",
  "/favicon.svg",
  "/badge.png",
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

  if (self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1") {
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