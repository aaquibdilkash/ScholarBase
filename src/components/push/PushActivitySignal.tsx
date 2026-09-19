"use client";

import { useEffect } from "react";
import { usePresence } from "@/components/interactions/PresenceProvider";
import { ACTIVITY_HEARTBEAT_MS } from "@/lib/push-constants";

/**
 * Invisible app-wide presence beacon for the push gate.
 *
 * Mounted once per browser tab (inside `PresenceProvider`, so it reuses the
 * already-resolved session instead of triggering another auth round-trip).
 *
 *  - tab becomes visible  -> immediate `active: true` + a slow refresh timer
 *  - tab hidden / closed  -> immediate `active: false` via `sendBeacon`, which
 *                            survives page teardown where `fetch` would be
 *                            cancelled.
 *
 * The tab id is per-tab (`sessionStorage`) so multi-tab sessions are tracked
 * independently: hiding one tab never clears another tab's presence.
 */

const TAB_ID_STORAGE_KEY = "sb-push-tab-id";

/**
 * Dedupe window for beacons. `visibilitychange` and `pageshow` can both fire on
 * a single tab restore, and the user may flick between tabs quickly — there is
 * no value in posting the same state twice. Also keeps Redis + Supabase Auth
 * round-trips to the minimum the free tier allows.
 */
const MIN_REPEAT_INTERVAL_MS = 5_000;

function getTabId(): string {
  try {
    const existing = window.sessionStorage.getItem(TAB_ID_STORAGE_KEY);
    if (existing) return existing;

    const generated =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    window.sessionStorage.setItem(TAB_ID_STORAGE_KEY, generated);
    return generated;
  } catch {
    // Private mode / storage disabled: fall back to a per-mount id. Presence
    // then ages out through the staleness window instead of a beacon.
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function PushActivitySignal() {
  const { currentUserId } = usePresence();

  useEffect(() => {
    if (!currentUserId) return;
    if (typeof document === "undefined") return;

    const tabId = getTabId();
    let intervalId: number | null = null;
    let lastReportedState: boolean | null = null;
    let lastReportedAt = 0;

    const send = (active: boolean, useBeacon = false, force = false) => {
      const now = Date.now();

      // Skip no-op repeats (e.g. `pageshow` right after `visibilitychange`).
      if (
        !force &&
        lastReportedState === active &&
        now - lastReportedAt < MIN_REPEAT_INTERVAL_MS
      ) {
        return;
      }

      lastReportedState = active;
      lastReportedAt = now;

      const body = JSON.stringify({ tabId, active });

      if (useBeacon && typeof navigator.sendBeacon === "function") {
        try {
          const blob = new Blob([body], { type: "application/json" });
          if (navigator.sendBeacon("/api/push/active", blob)) return;
        } catch {
          // fall through to fetch
        }
      }

      void fetch("/api/push/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    };

    const startHeartbeat = () => {
      if (intervalId !== null) return;
      intervalId = window.setInterval(() => {
        // Forced: the heartbeat's whole purpose is to refresh the timestamp.
        if (document.visibilityState === "visible") send(true, false, true);
      }, ACTIVITY_HEARTBEAT_MS);
    };

    const stopHeartbeat = () => {
      if (intervalId === null) return;
      window.clearInterval(intervalId);
      intervalId = null;
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        send(true);
        startHeartbeat();
        return;
      }
      stopHeartbeat();
      send(false, true);
    };

    const handlePageHide = () => {
      stopHeartbeat();
      send(false, true);
    };

    const handlePageShow = () => {
      if (document.visibilityState === "visible") {
        send(true);
        startHeartbeat();
      }
    };

    if (document.visibilityState === "visible") {
      send(true, false, true);
      startHeartbeat();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
      stopHeartbeat();
      send(false, true);
    };
  }, [currentUserId]);

  return null;
}