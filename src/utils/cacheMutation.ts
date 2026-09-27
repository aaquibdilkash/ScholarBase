import type { QueryClient } from "@tanstack/react-query";

/**
 * Client-side cache mutation helpers (RULE 2).
 *
 * `setQueriesData({ queryKey: prefix })` uses prefix matching so a mutation
 * updates every cached variant of a list (e.g. `["courses", ""]`,
 * `["courses", "query"]`) in a single call, avoiding read-after-write refetches.
 */

/** Insert (create) or replace (edit) a single item across all list variants. */
export function upsertToList<T extends { id: string }>(
  queryClient: QueryClient,
  key: readonly unknown[],
  item: T,
  mode: "create" | "edit",
): void {
  queryClient.setQueriesData({ queryKey: key }, (oldData: T[] = []) => {
    if (mode === "create") return [item, ...oldData];
    return oldData.map((x) => (x.id === item.id ? { ...x, ...item } : x));
  });
}

/** Remove an item by id across all list variants. */
export function removeFromList<T extends { id: string }>(
  queryClient: QueryClient,
  key: readonly unknown[],
  id: string,
): void {
  queryClient.setQueriesData({ queryKey: key }, (oldData: T[] = []) =>
    oldData.filter((x) => x.id !== id),
  );
}

/** The three data tabs on a scholar profile, keyed by tab. */
export const PROFILE_TAB_KEYS = {
  content: ["profile-content"] as const,
  bookmarks: ["profile-bookmarks"] as const,
  activity: ["profile-activity"] as const,
};

/**
 * Marks the scholar-profile Content and Activity tabs stale.
 *
 * Both list what a publish / edit / delete changes, so a mutation has to clear
 * them. `refetchType: "none"` is deliberate: the server cache is purged by the
 * same mutation (see `tri-split/modules/profile-tab`), so any later read is
 * already correct, and there is no reason to spend a round trip while the tab
 * is closed. The tab refetches the moment it is actually opened, because a
 * stale query refetches as soon as it becomes enabled.
 */
export function invalidateProfileTabs(
  queryClient: QueryClient,
  ...tabs: (keyof typeof PROFILE_TAB_KEYS)[]
): void {
  for (const tab of tabs) {
    queryClient.invalidateQueries({
      queryKey: PROFILE_TAB_KEYS[tab],
      refetchType: "none",
    });
  }
}
