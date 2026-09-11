import { Suspense, use } from "react";
import type { ReactNode } from "react";
import { ListSkeleton } from "./ListSkeleton";

/**
 * Suspends *only* around an async data fetch (the Supabase-backed query that
 * used to run at the top of every listing page), so the surrounding shell —
 * heading, description, tabs, "Add" button — renders instantly while just the
 * list region shows the `ListSkeleton`.
 *
 * Usage:
 *   <AsyncListRegion
 *     key={q}
 *     fetcher={async () => {
 *       const journals = await getJournals(q, user?.id, 10);
 *       return { journals, userId: user?.id };
 *     }}
 *   >
 *     {({ journals, userId }) => (
 *       <JournalsList journals={journals} currentUserId={userId} />
 *     )}
 *   </AsyncListRegion>
 *
 * `use(promise)` is the standard server-component Suspense primitive: when the
 * fetcher promise is unresolved, React throws it to the nearest <Suspense>,
 * which renders `ListSkeleton` until the data resolves.
 */
export function AsyncListRegion<T>({
  fetcher,
  children,
  count,
}: {
  fetcher: () => Promise<T>;
  children: (data: T) => ReactNode;
  count?: number;
}) {
  return (
    <Suspense fallback={<ListSkeleton count={count} />}>
      <AsyncList fetcher={fetcher}>{children}</AsyncList>
    </Suspense>
  );
}

function AsyncList<T>({
  fetcher,
  children,
}: {
  fetcher: () => Promise<T>;
  children: (data: T) => ReactNode;
}) {
  const data = use(fetcher());
  return children(data);
}
