"use client";

/**
 * Browser-side W3C Push API helpers for message notifications.
 *
 * The subscription is created with `userVisibleOnly: true` — every push we send
 * results in a visible OS notification (no silent pushes), which is what both
 * the spec and the browser vendors require.
 */

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function getVapidPublicKey(): string | null {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  return key ? key : null;
}

/** Converts the URL-safe base64 VAPID key into the raw bytes the Push API wants. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const output = new Uint8Array(new ArrayBuffer(raw.length));

  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }

  return output;
}

async function getReadyRegistration(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;

  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/** True when this browser already holds an active subscription. */
export async function hasMessagePushEnabled(): Promise<boolean> {
  if (!isPushSupported() || Notification.permission !== "granted") return false;
  return (await getExistingSubscription()) !== null;
}

type PushActionResult = { success: true } | { success: false; error: string };

export async function enableMessagePush(): Promise<PushActionResult> {
  if (!isPushSupported()) {
    return {
      success: false,
      error: "This browser does not support push notifications.",
    };
  }

  const vapidPublicKey = getVapidPublicKey();
  if (!vapidPublicKey) {
    return { success: false, error: "Push notifications are not configured." };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return {
        success: false,
        error:
          permission === "denied"
            ? "Notifications are blocked for this site in your browser settings."
            : "Notification permission was dismissed.",
      };
    }

    const registration = await getReadyRegistration();
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
    }

    const serialized = subscription.toJSON();
    const p256dh = serialized.keys?.p256dh;
    const auth = serialized.keys?.auth;

    if (!serialized.endpoint || !p256dh || !auth) {
      return {
        success: false,
        error: "Your browser returned an incomplete push subscription.",
      };
    }

    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "subscribe",
        endpoint: serialized.endpoint,
        keys: { p256dh, auth },
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        error: "Could not save your notification settings. Please try again.",
      };
    }

    return { success: true };
  } catch (error) {
    console.error("[Push] Enabling notifications failed.", error);
    return {
      success: false,
      error: "Could not enable notifications. Please try again.",
    };
  }
}

export async function disableMessagePush(): Promise<PushActionResult> {
  if (!isPushSupported()) return { success: true };

  try {
    const subscription = await getExistingSubscription();
    if (!subscription) return { success: true };

    const { endpoint } = subscription;
    await subscription.unsubscribe().catch(() => false);

    // Best-effort: the local unsubscribe already stopped delivery, this just
    // keeps the server table clean.
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unsubscribe", endpoint }),
    }).catch(() => {});

    return { success: true };
  } catch (error) {
    console.error("[Push] Disabling notifications failed.", error);
    return {
      success: false,
      error: "Could not disable notifications. Please try again.",
    };
  }
}