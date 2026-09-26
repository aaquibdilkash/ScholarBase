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

import { createTriSplitList, type TriSplitLoader } from "./index";
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
  /** Per-module fold tweaks (e.g. a `mentions` normaliser). */
  stitchOverrides?: Partial<
    StitchOptions<Record<string, unknown>, Record<string, unknown>>
  >;
};

/** Default fold rules for a standard content module. */
function contentStitch(
  overrides?: Partial<
    StitchOptions<Record<string, unknown>, Record<string, unknown>>
  >,
): StitchOptions<Record<string, unknown>, Record<string, unknown>> {
  return {
    getRowId: (row: Record<string, unknown>) => row.id as string,
    getAuthorId: (row: Record<string, unknown>) => row.authorId as string,
    counterKeys: CONTENT_COUNTER_KEYS,
    rehydrate: (row: Record<string, unknown>) => ({ ...row }),
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
export function createContentList(
  args: ContentListArgs,
): TriSplitLoader<Record<string, unknown>> {
  const config = ENTITY_CONFIG[args.module];
  const mode = Prisma.QueryMode.insensitive;

  return createTriSplitList<
    Record<string, unknown>,
    Record<string, unknown>
  >({
    tag: args.tag,
    model: config.model,
    where: args.where,
    select: args.select,
    orderBy: args.orderBy ?? { createdAt: "desc" },
    keyParts: args.keyParts,
    dateKeys: args.dateKeys ?? ["createdAt", "updatedAt", "editedAt"],
    overlay: {
      row: tableName(config.model),
      vote: tableName(config.voteModel),
      bookmark: tableName(config.bookmarkModel),
      rowFk: config.parentFk,
      authorFk: "authorId",
      counterKeys: CONTENT_COUNTER_KEYS,
    },
    stitch: contentStitch(args.stitchOverrides),
    buildWhere: (callArgs: Record<string, unknown>) => {
      const query =
        typeof callArgs.query === "string" ? callArgs.query.trim() : "";
      const fields = args.searchFields ?? [];
      if (!query || fields.length === 0) return {};

      return {
        OR: fields.map((entry) => {
          const match = { contains: query, mode };
          return "relation" in entry
            ? { [entry.relation]: { [entry.field]: match } }
            : { [entry.field]: match };
        }),
      };
    },
  });
}
