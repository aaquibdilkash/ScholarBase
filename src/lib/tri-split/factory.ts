/**
 * Tri-Split list factory.
 *
 * Every list page in the app is built from this, so the identity contract is
 * enforced in one place: **the returned loader resolves the viewer from the
 * session and exposes no identity parameter.** The pre-factory loaders
 * (`getVacancies(q, userId, …)` and 17 siblings) took a `userId` straight from
 * the browser, so any caller could read another user's vote / bookmark /
 * follow state. That parameter simply does not exist here, so the bug cannot
 * be reintroduced in new code.
 *
 * ┌───────────────────────────────────────────────────────────────┐
 * │ 1. Cached batch   — viewer-agnostic rows, shared by everyone,  │
 * │    keyed by `keyParts` + `(limit, cursor)`, tagged.            │
 * ├───────────────────────────────────────────────────────────────┤
 * │ 2. Live overlay   — viewer state (signed-in) + counters (all), │
 * │    ONE indexed statement per page load.                        │
 * └───────────────────────────────────────────────────────────────┘
 */
import { revalidateTag } from "next/cache";

import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/db";

import { createCachedPage, normalizePageSize } from "./cache";
import { getLiveOverlay, type OverlayTables } from "./overlay";
import { stitchLiveState, type StitchOptions } from "./stitch";

/** Config for one module's list. */
export type TriSplitConfig<TCached, TItem> = {
  /** Cache tag, e.g. `"vacancies-public"`. Purge it on content mutations. */
  tag: string;
  /** Prisma delegate name on the client, e.g. `"jobVacancy"`. */
  model: string;
  /** Extra cache-key discriminators (ordering, sort mode, ...). */
  keyParts?: readonly string[];
  /** Viewer-agnostic projection. Must NOT include viewer state. */
  select: Record<string, unknown>;
  /** `orderBy` for the uncached (filtered) path. */
  orderBy: Record<string, unknown>;
  /** Base `where`, excluding viewer-specific and search filters. */
  where?: Record<string, unknown>;
  /** Columns holding `Date`s, serialized into the cache. */
  dateKeys?: readonly string[];
  /** Table/column names for the overlay statement. */
  overlay: OverlayTables;
  /** Folding rules for the pure stitch step. */
  stitch: StitchOptions<TCached, TItem>;
  /** Extra `where` fragments derived from caller args (search, tabs). */
  buildWhere?: (args: Record<string, unknown>) => Record<string, unknown>;
};

/** What a configured loader exposes. */
export type TriSplitLoader<TItem> = {
  /** Loads one page for the current viewer. Never takes an identity. */
  fetchPage: (args?: Record<string, unknown>) => Promise<TItem[]>;
  /** Purges this module's cached pages. Call on content mutations. */
  revalidate: () => void;
};

export function createTriSplitList<TCached, TItem>(
  config: TriSplitConfig<TCached, TItem>,
): TriSplitLoader<TItem> {
  const {
    tag,
    model,
    keyParts = [],
    select,
    orderBy,
    where: baseWhere = {},
    dateKeys = [],
    overlay,
    stitch,
    buildWhere,
  } = config;

  // The viewer-agnostic loader. Deliberately takes no identity: it is the
  // cached, shared half of the split.
  const loadPage = createCachedPage<TCached, [number, string | undefined]>(
    tag,
    async (limit, cursor) => {
      const delegate = (prisma as unknown as Record<string, {
        findMany: (args: unknown) => Promise<TCached[]>;
      }>)[model];
      return delegate.findMany({
        where: baseWhere,
        select,
        orderBy,
        take: limit,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
    },
    { dateKeys, keyParts },
  );

  return {
    async fetchPage(args = {}) {
      // Identity from the session, server-side. Never from the caller.
      const user = await getCurrentUser();
      const viewerId = user?.id ?? null;

      const limit = normalizePageSize(args.pageSize as number | undefined);
      const cursor = args.cursor as string | undefined;

      // Any caller-supplied filter (search text, a viewer-scoped tab) makes
      // the result non-shareable, so it bypasses the cache entirely. The
      // cached path serves the plain, unfiltered first page only.
      const filters = buildWhere?.(args) ?? {};
      const isFiltered = Object.keys(filters).length > 0;

      const rows = isFiltered
        ? await (prisma as unknown as Record<string, {
            findMany: (a: unknown) => Promise<TCached[]>;
          }>)[model].findMany({
            where: { ...baseWhere, ...filters },
            select,
            orderBy,
            take: limit,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          })
        : await loadPage(limit, cursor);

      if (rows.length === 0) return [];

      const rowIds = rows.map(stitch.getRowId);
      const authorIds = Array.from(
        new Set(rows.map(stitch.getAuthorId).filter(Boolean)),
      );

      const liveOverlay = await getLiveOverlay(
        viewerId,
        rowIds,
        authorIds,
        overlay,
      );

      return stitchLiveState(rows, liveOverlay, stitch);
    },

    revalidate() {
      revalidateTag(tag, { expire: 0 });
    },
  };
}
