import type { QueryClient } from "@tanstack/react-query";
import type {
  AdminAppealItem,
  AdminContentItem,
  AdminPage,
} from "@/types/admin";

/**
 * RULE 1 helper: surgically patch every cached admin content list that
 * contains the given row, instead of invalidating + refetching from the
 * database (free-tier friendly — zero extra queries after an action).
 */
export function patchAdminContentCache(
  queryClient: QueryClient,
  id: string,
  patch: Partial<AdminContentItem> | { removed: true },
) {
  queryClient.setQueriesData<AdminPage<AdminContentItem>>(
    { queryKey: ["admin-content"] },
    (old) => {
      if (!old || !old.items.some((it) => it.id === id)) return old;
      if ("removed" in patch && patch.removed) {
        return {
          ...old,
          items: old.items.filter((it) => it.id !== id),
          total: Math.max(0, old.total - 1),
        };
      }
      return {
        ...old,
        items: old.items.map((it) =>
          it.id === id ? { ...it, ...patch } : it,
        ),
      };
    },
  );
}

/**
 * RULE 1 helper: surgically patch every cached admin appeals list. Used
 * after a moderation action (FREEZE/UNFREEZE/DELETE/RECOVER) so the
 * Appeals tab reflects the appealed entity's new state without refetch.
 * Lookup is by `entityId` because the appeals cache stores the underlying
 * entity id, not the appeal row id (which is internal to the appeals tab).
 */
export function patchAdminAppealsCache(
  queryClient: QueryClient,
  entityId: string,
  patch: Partial<AdminAppealItem>,
) {
  queryClient.setQueriesData<AdminPage<AdminAppealItem>>(
    { queryKey: ["admin-appeals"] },
    (old) => {
      if (!old) return old;
      return {
        ...old,
        items: old.items.map((it) =>
          it.entityId === entityId ? { ...it, ...patch } : it,
        ),
      };
    },
  );
}

/**
 * Optimistically adjust the admin stats header cards after a hard list
 * change (e.g. a row was removed by delete). No server round-trip.
 */
export function adjustAdminStatsCache(
  queryClient: QueryClient,
  sectionId: string,
  delta: number,
) {
  queryClient.setQueriesData<{
    totalUsers: number;
    totalContent: number;
    sections: Record<string, number>;
  }>({ queryKey: ["admin-stats"] }, (old) => {
    if (!old) return old;
    const isUsers = sectionId === "users";
    return {
      totalUsers: old.totalUsers + (isUsers ? delta : 0),
      totalContent: old.totalContent + (isUsers ? 0 : delta),
      sections: {
        ...old.sections,
        [sectionId]: Math.max(0, (old.sections[sectionId] ?? 0) + delta),
      },
    };
  });
}
