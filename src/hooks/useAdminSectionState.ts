"use client";

import { useCallback, useEffect, useState } from "react";
import type { ContentView } from "@/lib/adminConfig";

/**
 * Per-section UI state for the admin dashboard (posts/comments sub-view,
 * page, sort, status filters). Persisted to localStorage so a refresh
 * reopens the exact same table configuration for EVERY section, not just
 * the active one.
 *
 * Hydration-safe: the first render always uses defaults (matching SSR),
 * then a mount effect reads localStorage and syncs state — never mutating
 * URL query strings (which would defeat the React Query cache).
 */
export type SectionUiState = {
  view: ContentView;
  page: number;
  sortBy: "createdAt" | "reportCount";
  statusFilter: "all" | "active" | "frozen" | "deleted";
  /** Appeals-only: independent filter on the appealed entity's moderation
   *  state (Active / Frozen / Deleted). Falls back to "all" on non-appeal
   *  sections. */
  entityStatusFilter: "all" | "active" | "frozen" | "deleted";
};

export const DEFAULT_SECTION_STATE: SectionUiState = {
  view: "posts",
  page: 1,
  sortBy: "createdAt",
  statusFilter: "all",
  entityStatusFilter: "all",
};

const STORAGE_KEY = "sb_admin_sections";

const VIEWS: readonly string[] = ["posts", "comments"];
const SORTS: readonly string[] = ["createdAt", "reportCount"];
const STATUS_FILTERS: readonly string[] = ["all", "active", "frozen", "deleted"];

/** Validate one stored section entry — a stale/corrupt key falls back to
 *  defaults instead of poisoning the table (e.g. page: "3" or an unknown
 *  enum after a rename). */
function sanitize(raw: unknown): SectionUiState {
  if (!raw || typeof raw !== "object") return DEFAULT_SECTION_STATE;
  const v = raw as Record<string, unknown>;
  const pick = <T extends string>(
    value: unknown,
    allowed: readonly string[],
    fallback: T,
  ): T => (allowed.includes(value as string) ? (value as T) : fallback);
  return {
    view: pick(v.view, VIEWS, DEFAULT_SECTION_STATE.view),
    // Bound the page to something sane so a corrupt value can't request
    // an absurd offset against the DB.
    page:
      typeof v.page === "number" &&
      Number.isInteger(v.page) &&
      v.page >= 1 &&
      v.page <= 10_000
        ? v.page
        : DEFAULT_SECTION_STATE.page,
    sortBy: pick(v.sortBy, SORTS, DEFAULT_SECTION_STATE.sortBy),
    statusFilter: pick(
      v.statusFilter,
      STATUS_FILTERS,
      DEFAULT_SECTION_STATE.statusFilter,
    ),
    entityStatusFilter: pick(
      v.entityStatusFilter,
      STATUS_FILTERS,
      DEFAULT_SECTION_STATE.entityStatusFilter,
    ),
  };
}

export function useAdminSectionState() {
  // Server render + first client render use defaults → no hydration mismatch.
  const [sectionStates, setSectionStates] = useState<
    Record<string, SectionUiState>
  >({});
  const [isHydrated, setIsHydrated] = useState(false);

  // On mount: restore the persisted per-section state.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const restored: Record<string, SectionUiState> = {};
        for (const [sectionId, value] of Object.entries(parsed)) {
          if (!value || typeof value !== "object") continue;
          restored[sectionId] = sanitize(value);
        }
        if (Object.keys(restored).length > 0) setSectionStates(restored);
      }
    } catch {
      // Corrupt storage — fall through to defaults.
    }
    setIsHydrated(true);
  }, []);

  // On any change (post-hydration): persist.
  useEffect(() => {
    if (!isHydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sectionStates));
    } catch {
      // Storage unavailable (private mode / quota) — UI still works.
    }
  }, [sectionStates, isHydrated]);

  const setSectionState = useCallback(
    (sectionId: string, patch: Partial<SectionUiState>) => {
      setSectionStates((prev) => ({
        ...prev,
        [sectionId]: { ...(prev[sectionId] ?? DEFAULT_SECTION_STATE), ...patch },
      }));
    },
    [],
  );

  return { sectionStates, setSectionState };
}