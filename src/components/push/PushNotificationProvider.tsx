"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useToast } from "@/components/ui/Toast";
import { usePresence } from "@/components/interactions/PresenceProvider";
import {
  disableMessagePush,
  enableMessagePush,
  hasMessagePushEnabled,
  isPushSupported,
} from "@/lib/push";

/**
 * Single source of truth for the browser's message-push subscription.
 *
 * The subscription is browser-scoped (not account-scoped), so it is *device*
 * state — but it is rendered in several places at once: the navbar icon, the
 * mobile overflow menu, the messages sidebar and `/notifications`. Several of
 * those can be mounted simultaneously (the overflow menu renders while the
 * navbar icon is still in the DOM, and `/notifications` keeps the navbar
 * mounted), so per-component state would let one toggle leave the others
 * claiming the opposite. Everything reads this one value instead, which is why
 * flipping the switch in the dropdown updates the navbar icon in the same
 * render.
 *
 * Mounted once per app in `AppProviders`, inside `PresenceProvider` (for the
 * session) and `ToastProvider` (for the toggles' feedback).
 */

export type PushStatus = "checking" | "unsupported" | "enabled" | "disabled";

interface PushNotificationContextValue {
  status: PushStatus;
  /** True while a subscribe/unsubscribe round-trip is in flight. */
  isWorking: boolean;
  isEnabled: boolean;
  /** Flips the subscription for this browser. Every mounted consumer updates. */
  toggle: () => Promise<void>;
}

const PushNotificationContext =
  createContext<PushNotificationContextValue | null>(null);

export function usePushNotifications(): PushNotificationContextValue {
  const ctx = useContext(PushNotificationContext);
  if (!ctx) {
    throw new Error(
      "usePushNotifications must be used within a PushNotificationProvider",
    );
  }
  return ctx;
}

export function PushNotificationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { toast } = useToast();
  const { currentUserId } = usePresence();

  const [status, setStatus] = useState<PushStatus>("checking");
  const [isWorking, setIsWorking] = useState(false);

  /**
   * Guards against a double click landing before `setIsWorking` has flushed —
   * two rapid clicks would otherwise both pass the `isWorking` check and race
   * two subscribe/unsubscribe calls against the same subscription.
   */
  const workingRef = useRef(false);

  // One probe for the whole app, instead of one per rendered button.
  useEffect(() => {
    if (!currentUserId) {
      setStatus("checking");
      return;
    }

    if (!isPushSupported()) {
      setStatus("unsupported");
      return;
    }

    let cancelled = false;
    hasMessagePushEnabled()
      .then((enabled) => {
        if (!cancelled) setStatus(enabled ? "enabled" : "disabled");
      })
      .catch(() => {
        if (!cancelled) setStatus("disabled");
      });

    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  /**
   * Subscribe/unsubscribe is device state that can change outside the app: the
   * user can revoke notification permission in browser settings, and another
   * tab can toggle the subscription. Re-probe when the tab wakes up so no
   * button ever claims "On" for a subscription that is already gone. This is
   * all local (permission flag + `pushManager.getSubscription()`), no network.
   */
  useEffect(() => {
    if (!currentUserId || !isPushSupported()) return;

    const syncStatus = () => {
      if (document.visibilityState !== "visible") return;
      hasMessagePushEnabled()
        .then((enabled) => setStatus(enabled ? "enabled" : "disabled"))
        .catch(() => {});
    };

    document.addEventListener("visibilitychange", syncStatus);
    window.addEventListener("focus", syncStatus);
    return () => {
      document.removeEventListener("visibilitychange", syncStatus);
      window.removeEventListener("focus", syncStatus);
    };
  }, [currentUserId]);

  const toggle = useCallback(async () => {
    if (
      workingRef.current ||
      status === "checking" ||
      status === "unsupported"
    ) {
      return;
    }

    workingRef.current = true;
    setIsWorking(true);

    try {
      if (status === "enabled") {
        const result = await disableMessagePush();
        if (!result.success) {
          // Status is left as `enabled` — the subscription is still live.
          toast({ title: result.error, variant: "destructive" });
          return;
        }
        setStatus("disabled");
        toast("Message notifications turned off on this device.");
        return;
      }

      const result = await enableMessagePush();
      if (!result.success) {
        toast({ title: result.error, variant: "destructive" });
        return;
      }
      setStatus("enabled");
      toast("Message notifications turned on for this device.");
    } finally {
      workingRef.current = false;
      setIsWorking(false);
    }
  }, [status, toast]);

  return (
    <PushNotificationContext.Provider
      value={{ status, isWorking, isEnabled: status === "enabled", toggle }}
    >
      {children}
    </PushNotificationContext.Provider>
  );
}