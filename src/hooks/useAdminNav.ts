"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Persisted admin navigation state. Refreshing /admin restores the last
 * active section, posts/comments sub-tab and status filter from
 * localStorage (key: "sb_admin_nav") instead of resetting to defaults.
 *
 * Hydration-safe: the first render always uses the defaults (matching SSR),
 * then a mount effect reads localStorage and syncs state — never mutating
 * URL query strings.
 */
export type EntityStatusFilter = "all" | "active" | "frozen" | "deleted";
export type AdminStatusFilter =
  | "all"
  | "pending"
  | "actioned"
  | "dismissed";

export interface AdminNavState {
  activeSection: string; // "feed" | "appeals" | "blog" | ...
  activeSubTab: "posts" | "comments";
  statusFilter: string;
  /** Appeals-only: filters by the moderation state of the appealed entity
   *  (Active / Frozen / Deleted). Independent from `statusFilter` which
   *  filters the appeal's own admin lifecycle (Pending/Actioned/Dismissed). */
  entityStatusFilter: EntityStatusFilter;
}

const STORAGE_KEY = "sb_admin_nav";

const DEFAULT_NAV: AdminNavState = {
  activeSection: "feed",
  activeSubTab: "posts",
  statusFilter: "all",
  entityStatusFilter: "all",
};

function isEntityStatusFilter(v: unknown): v is EntityStatusFilter {
  return v === "all" || v === "active" || v === "frozen" || v === "deleted";
}

function isSubTab(v: unknown): v is AdminNavState["activeSubTab"] {
  return v === "posts" || v === "comments";
}

function readStoredNav(): Partial<AdminNavState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<AdminNavState>;
    return {
      activeSection:
        typeof parsed.activeSection === "string"
          ? parsed.activeSection
          : undefined,
      activeSubTab: isSubTab(parsed.activeSubTab)
        ? parsed.activeSubTab
        : undefined,
      statusFilter:
        typeof parsed.statusFilter === "string"
          ? parsed.statusFilter
          : undefined,
      entityStatusFilter: isEntityStatusFilter(parsed.entityStatusFilter)
        ? parsed.entityStatusFilter
        : undefined,
    };
  } catch {
    return {};
  }
}

export function useAdminNav() {
  // Server render + first client render use defaults → no hydration mismatch.
  const [nav, setNav] = useState<AdminNavState>(DEFAULT_NAV);
  const [isHydrated, setIsHydrated] = useState(false);

  // On mount: restore the persisted state.
  useEffect(() => {
    const stored = readStoredNav();
    setNav((prev) => ({ ...prev, ...stored }));
    setIsHydrated(true);
  }, []);

  // On any change (post-hydration): persist.
  useEffect(() => {
    if (!isHydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nav));
    } catch {
      // Storage unavailable (private mode / quota) — nav still works.
    }
  }, [nav, isHydrated]);

  const setActiveSection = useCallback((activeSection: string) => {
    setNav((prev) => ({ ...prev, activeSection }));
  }, []);

  const setActiveSubTab = useCallback(
    (activeSubTab: AdminNavState["activeSubTab"]) => {
      setNav((prev) => ({ ...prev, activeSubTab }));
    },
    [],
  );

  const setStatusFilter = useCallback((statusFilter: string) => {
    setNav((prev) => ({ ...prev, statusFilter }));
  }, []);

  const setEntityStatusFilter = useCallback(
    (entityStatusFilter: EntityStatusFilter) => {
      setNav((prev) => ({ ...prev, entityStatusFilter }));
    },
    [],
  );

  return {
    ...nav,
    isHydrated,
    setActiveSection,
    setActiveSubTab,
    setStatusFilter,
    setEntityStatusFilter,
  };
}