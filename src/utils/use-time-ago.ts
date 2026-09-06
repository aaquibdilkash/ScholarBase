"use client";

import { useEffect, useState } from "react";
import { formatTimeAgo } from "./time-ago";

/**
 * ⚡ Shared-interval relative-time hook (Issue 2)
 *
 * All relative timestamps across the app subscribe to a single module-level
 * 30s ticker instead of each component owning its own interval. This keeps
 * sidebar previews and chat bubbles ("just now" → "1m ago") fresh without
 * hydration mismatches or timer explosions.
 */
const listeners = new Set<() => void>();
let intervalId: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!intervalId) {
    intervalId = setInterval(() => {
      listeners.forEach((fn) => fn());
    }, 30_000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

export function useTimeAgo(
  date: Date | string | number | null | undefined,
): string {
  const [label, setLabel] = useState(() => formatTimeAgo(date));

  useEffect(() => {
    const update = () => setLabel(formatTimeAgo(date));
    update();
    return subscribe(update);
  }, [date]);

  return label;
}
