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
    return oldData.map((x) => (x.id === item.id ? item : x));
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