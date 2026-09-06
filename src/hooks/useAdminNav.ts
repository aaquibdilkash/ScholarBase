"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Persisted admin navigation state. Refreshing /admin restores the last
 * active section from localStorage (key: "sb_admin_nav") instead of
 * resetting to "Feed". The per-section table state (posts/comments view,
 * page, sort, filters) is persisted separately by `useAdminSectionState`.
 *
 * Hydration-safe: the first render always uses the defaults (matching SSR),
 * then a mount effect reads localStorage and syncs state — never mutating
 * URL query strings.
 */
const DEFAULT_SECTION = "feed";

const STORAGE_KEY = "sb_admin_nav";

function readStoredSection(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { activeSection?: unknown };
    return typeof parsed.activeSection === "string" && parsed.activeSection
      ? parsed.activeSection
      : undefined;
  } catch {
    return undefined;
  }
}

export function useAdminNav() {
  // Server render + first client render use defaults → no hydration mismatch.
  const [activeSection, setActiveSectionState] =
    useState<string>(DEFAULT_SECTION);
  const [isHydrated, setIsHydrated] = useState(false);

  // On mount: restore the persisted state.
  useEffect(() => {
    const stored = readStoredSection();
    if (stored) setActiveSectionState(stored);
    setIsHydrated(true);
  }, []);

  // On any change (post-hydration): persist.
  useEffect(() => {
    if (!isHydrated) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ activeSection }),
      );
    } catch {
      // Storage unavailable (private mode / quota) — nav still works.
    }
  }, [activeSection, isHydrated]);

  const setActiveSection = useCallback((section: string) => {
    setActiveSectionState(section);
  }, []);

  return { activeSection, isHydrated, setActiveSection };
}