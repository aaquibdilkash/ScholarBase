/**
 * Shared wiring for the standard content modules.
 *
 * Nearly every module (article, vacancy, admission, event, ...) has the same
 * shape: an author relation, a `createdAt desc` feed, three materialized
 * counters, and votes/bookmarks/follows. Only the table names and the
 * search fields differ. This helper derives all of that from `ENTITY_CONFIG`,
 * so a module's own file only declares what is genuinely unique to it.
 */
import { Prisma } from "@prisma/client";

import { ENTITY_CONFIG, type ModuleKey } from "@/lib/transactions";
import { isSearchableQuery } from "@/lib/search-guard";

import { createTriSplitList, type TriSplitLoader } from "./index";
import { reviveDates } from "./cache";
import type { StitchOptions } from "./stitch";

/** The counter triple every content module materializes. */
export const CONTENT_COUNTER_KEYS = [
  "totalVotes",
  "totalBookmarks",
  "totalComments",
] as const;

/** PascalCase table name for a Prisma model delegate, e.g. `socialPost` -> `SocialPost`. */
const tableName = (model: string) =>
  model.charAt(0).toUpperCase() + model.slice(1);

/** Search fields a module exposes, e.g. `["title", "institution"]`. */
export type SearchField =
  | { field: string }
  | { field: string; relation: string };

export type ContentListArgs = {
  /** `ENTITY_CONFIG` key, which supplies every table and FK name. */
  module: ModuleKey;
  /** Cache tag, e.g. `"articles-public"`. */
  tag: string;
  /** Prisma `where` always applied (soft-delete filter, etc.). */
  where: Record<string, unknown>;
  /** Viewer-agnostic projection. Must NOT include viewer state. */
  select: Record<string, unknown>;
  /** Free-text search fields, combined with OR + case-insensitive contains. */
  searchFields?: readonly SearchField[];
  /** `orderBy`; defaults to `createdAt desc`. */
  orderBy?: Record<string, unknown>;
  /**
   * Columns holding `Date`s, serialized into the cache. Defaults to the three
   * timestamps every content row carries; override for a module whose
   * projection selects fewer.
   */
  dateKeys?: readonly string[];
  /** Extra cache-key discriminators beyond the tag. */
  keyParts?: readonly string[];
  /**
   * Materialized counters read live in the overlay on every page load, with the
   * cached batch as fallback. Defaults to {@link CONTENT_COUNTER_KEYS}.
   *
   * A module whose card renders an extra materialized aggregate (e.g. Journal's
   * `reviewCount` / `ratingSum`) adds it here rather than purging the shared
   * list cache whenever the aggregate moves. The overlay statement already
   * selects these columns off the row it is reading, so the extra keys cost
   * nothing — whereas a purge would invalidate the batch for every visitor.
   */
  counterKeys?: readonly string[];
  /** Per-module fold tweaks (e.g. a `mentions` normaliser). */
  stitchOverrides?: Partial<
    StitchOptions<Record<string, unknown>, Record<string, unknown>>
  >;
};

/** Default fold rules for a standard content module. */
function contentStitch(
  counterKeys: readonly string[],
  dateKeys: readonly string[],
  overrides?: Partial<
    StitchOptions<Record<string, unknown>, Record<string, unknown>>
  >,
): StitchOptions<Record<string, unknown>, Record<string, unknown>> {
  return {
    getRowId: (row: Record<string, unknown>) => row.id as string,
    getAuthorId: (row: Record<string, unknown>) => row.authorId as string,
    counterKeys,
    // Derived from the SAME `dateKeys` that `cache.ts` serialised with, so the
    // revive step cannot drift from the serialise step. No module declares
    // `rehydrate` any more.
    rehydrate: (row: Record<string, unknown>) => reviveDates(row, dateKeys),
    ...overrides,
  };
}

/**
 * Builds the loader for one standard content module.
 *
 * The returned loader takes no identity: it resolves the viewer from the
 * session internally (see `createTriSplitList`), which is what closes the
 * "client can read another user's vote/bookmark/follow state" hole the old
 * per-module loaders had via a `userId` argument.
 */
/**
 * Builds the OR-search clause for a module's declared search fields.
 *
 * Shared by every list so the P0-3 minimum-length floor is applied in exactly
 * one place. Below the floor it returns `{}` — the same shape an empty query
 * produces — so the caller falls back to the unfiltered list and a 1-character
 * search costs zero database work (and, because it is unfiltered, is served
 * from the cache).
 */
function searchWhere(
  fields: readonly SearchField[],
  callArgs: Record<string, unknown>,
  mode: Prisma.QueryMode,
): Record<string, unknown> {
  const query = typeof callArgs.query === "string" ? callArgs.query.trim() : "";
  if (!isSearchableQuery(query) || fields.length === 0) return {};

  return {
    OR: fields.map((entry) => {
      const match = { contains: query, mode };
      return "relation" in entry
        ? { [entry.relation]: { [entry.field]: match } }
        : { [entry.field]: match };
    }),
  };
}

/** Overlay wiring, stated explicitly. Derived from ENTITY_CONFIG for content. */
type ListOverlay = {
  row: string;
  vote: string | null;
  bookmark: string | null;
  rowFk?: string;
  authorFk?: string;
  counterKeys: readonly string[];
};

/** Everything the two public builders below have in common. */
type BaseListArgs = {
  tag: string;
  model: string;
  where: Record<string, unknown>;
  select: Record<string, unknown>;
  searchFields?: readonly SearchField[];
  orderBy?: Record<string, unknown>;
  dateKeys?: readonly string[];
  keyParts?: readonly string[];
  counterKeys?: readonly string[];
  stitchOverrides?: Partial<
    StitchOptions<Record<string, unknown>, Record<string, unknown>>
  >;
  overlay: ListOverlay;
};

/** The single place a Tri-Split list is actually assembled. */
function buildList(args: BaseListArgs): TriSplitLoader<Record<string, unknown>> {
  const mode = Prisma.QueryMode.insensitive;
  const counterKeys = args.counterKeys ?? CONTENT_COUNTER_KEYS;
  const searchFields = args.searchFields ?? [];
  const dateKeys = args.dateKeys ?? ["createdAt", "updatedAt", "editedAt"];

  return createTriSplitList<
    Record<string, unknown>,
    Record<string, unknown>
  >({
    tag: args.tag,
    model: args.model,
    where: args.where,
    select: args.select,
    orderBy: args.orderBy ?? { createdAt: "desc" },
    keyParts: args.keyParts,
    dateKeys,
    overlay: args.overlay,
    stitch: contentStitch(counterKeys, dateKeys, args.stitchOverrides),
    buildWhere: (callArgs) => searchWhere(searchFields, callArgs, mode),
  });
}

/**
 * Builds the loader for one standard content module.
 *
 * Every table and FK name is derived from `ENTITY_CONFIG`, so a module cannot
 * drift from its write path.
 *
 * The returned loader takes no identity: it resolves the viewer from the
 * session internally (see `createTriSplitList`), which is what closes the
 * "client can read another user's vote/bookmark/follow state" hole the old
 * per-module loaders had via a `userId` argument.
 */
export function createContentList(
  args: ContentListArgs,
): TriSplitLoader<Record<string, unknown>> {
  const config = ENTITY_CONFIG[args.module];
  const counterKeys = args.counterKeys ?? CONTENT_COUNTER_KEYS;

  return buildList({
    tag: args.tag,
    model: config.model,
    where: args.where,
    select: args.select,
    searchFields: args.searchFields,
    orderBy: args.orderBy,
    dateKeys: args.dateKeys,
    keyParts: args.keyParts,
    counterKeys: args.counterKeys,
    stitchOverrides: args.stitchOverrides,
    overlay: {
      row: tableName(config.model),
      vote: tableName(config.voteModel),
      bookmark: tableName(config.bookmarkModel),
      rowFk: config.parentFk,
      authorFk: "authorId",
      counterKeys,
    },
  });
}

/**
 * Builds the loader for a list that is NOT a content module — the scholar
 * directory, which lists `User` rows and therefore has no vote, bookmark or
 * comment tables to derive.
 *
 * Same factory, same cache policy, same identity contract and the same P0-3
 * search floor as every content module; only the table names are stated rather
 * than derived. `createTriSplitList` already supports `vote: null` /
 * `bookmark: null` overlays, so nothing else changes.
 */
export function createDirectoryList(
  args: Omit<BaseListArgs, "overlay"> & { rowTable: string },
): TriSplitLoader<Record<string, unknown>> {
  const counterKeys = args.counterKeys ?? CONTENT_COUNTER_KEYS;
  const { rowTable, ...rest } = args;

  return buildList({
    ...rest,
    counterKeys: args.counterKeys,
    overlay: {
      row: rowTable,
      // Scholars have no votes or bookmarks of their own.
      vote: null,
      bookmark: null,
      counterKeys,
    },
  });
}
