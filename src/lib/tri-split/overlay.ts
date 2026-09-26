/**
 * The live half of the Tri-Split: one indexed statement per page load.
 *
 * Why raw SQL: the production pool is `max: 1` (one connection per lambda, to
 * protect Supavisor), so N "parallel" Prisma queries execute sequentially — N
 * round trips. Aggregating into one row costs one.
 *
 * Every table/column name is interpolated as an identifier. These come from
 * `ENTITY_CONFIG` (a compile-time literal map) or from a module's own static
 * config — never from a request — so there is no injection surface. Values are
 * still bound as parameters via `Prisma.join` / `Prisma.sql`.
 */
import { Prisma, VoteType } from "@prisma/client";

import prisma from "@/lib/db";
import type { LiveOverlay } from "./stitch";

/** Table/column names needed to build the overlay statement for a module. */
export type OverlayTables = {
  /** e.g. `"SocialPost"` — the row table (for the counter aggregate). */
  row: string;
  /** e.g. `"SocialVote"` — vote table, or `null` if the module has no votes. */
  vote?: string | null;
  /** e.g. `"SocialPostBookmark"` — bookmark table, or `null`. */
  bookmark?: string | null;
  /** Column holding the row id inside the vote/bookmark tables. */
  rowFk?: string;
  /** Column holding the author id inside the row table. */
  authorFk?: string;
  /** Counter columns to read, e.g. `["totalVotes", "totalBookmarks"]`. */
  counterKeys: readonly string[];
};

const EMPTY = (viewerId: string | null): LiveOverlay => ({
  viewerId,
  votes: [],
  bookmarks: [],
  following: [],
  counters: [],
});

/** Quotes a SQL identifier. Names originate from static config, never input. */
const ident = (name: string) => `"${name}"`;

/**
 * Resolves viewer state + live counters for exactly the rows on this page.
 *
 * @param viewerId `null` for signed-out visitors: only the counter aggregate
 *   runs, still in a single statement.
 */
export async function getLiveOverlay(
  viewerId: string | null,
  rowIds: string[],
  authorIds: string[],
  tables: OverlayTables,
): Promise<LiveOverlay> {
  if (rowIds.length === 0) return EMPTY(viewerId);

  const { row, vote, bookmark, rowFk, authorFk, counterKeys } = tables;
  const fk = rowFk ?? "id";

  // Counter aggregate: shared verbatim by both the anonymous and signed-in
  // branches. Reads the row table's primary key, so it is an index scan.
  const counterColumns = counterKeys
    .map((key) => `'${key}', p.${ident(key)}`)
    .join(", ");
  const countersSql = Prisma.sql`
    COALESCE((
      SELECT json_agg(json_build_object('id', p.${Prisma.raw(ident("id"))}, ${Prisma.raw(counterColumns)}))
      FROM ${Prisma.raw(ident(row))} p
      WHERE p.${Prisma.raw(ident("id"))} IN (${Prisma.join(rowIds)})
    ), '[]'::json) AS counters`;

  if (!viewerId) {
    // Anonymous: counters only. Anonymous visitors cannot express "did I
    // vote/follow", so the viewer-state subqueries would be pure waste.
    const rows = await prisma.$queryRaw<{ counters: unknown }[]>`
      SELECT ${countersSql}`;
    return { ...EMPTY(null), counters: toCounters(rows[0]?.counters) };
  }

  const voteSql = vote
    ? Prisma.sql`
        COALESCE((
          SELECT json_agg(json_build_object('id', v.${Prisma.raw(ident(fk))}, 'voteType', v."voteType"))
          FROM ${Prisma.raw(ident(vote))} v
          WHERE v."userId" = ${viewerId}
            AND v.${Prisma.raw(ident(fk))} IN (${Prisma.join(rowIds)})
        ), '[]'::json) AS votes`
    : Prisma.sql`'[]'::json AS votes`;

  const bookmarkSql = bookmark
    ? Prisma.sql`
        COALESCE((
          SELECT json_agg(json_build_object('id', b."id", 'rowId', b.${Prisma.raw(ident(fk))}))
          FROM ${Prisma.raw(ident(bookmark))} b
          WHERE b."userId" = ${viewerId}
            AND b.${Prisma.raw(ident(fk))} IN (${Prisma.join(rowIds)})
        ), '[]'::json) AS bookmarks`
    : Prisma.sql`'[]'::json AS bookmarks`;

  const followSql =
    authorFk && authorIds.length > 0
      ? Prisma.sql`
        COALESCE((
          SELECT json_agg(f."followingId")
          FROM "Follows" f
          WHERE f."followerId" = ${viewerId}
            AND f."followingId" IN (${Prisma.join(authorIds)})
        ), '[]'::json) AS following`
      : Prisma.sql`'[]'::json AS following`;

  const rows = await prisma.$queryRaw<
    { votes: unknown; bookmarks: unknown; following: unknown; counters: unknown }[]
  >`
    SELECT ${voteSql}, ${bookmarkSql}, ${followSql}, ${countersSql}
  `;

  const result = rows[0];
  if (!result) return EMPTY(viewerId);

  return {
    viewerId,
    // `voteType` arrives as a JSON string; keep only known enum members so
    // schema drift can never inject an invalid value into the UI.
    votes: asArray(result.votes).flatMap((entry) => {
      const voteType = (entry as { voteType?: unknown })?.voteType;
      return voteType === VoteType.UPVOTE || voteType === VoteType.DOWNVOTE
        ? [{ id: String((entry as { id: unknown }).id), voteType }]
        : [];
    }),
    bookmarks: asArray(result.bookmarks).map((entry) => ({
      id: String((entry as { id: unknown }).id),
      rowId: String((entry as { rowId: unknown }).rowId),
    })),
    following: asArray(result.following).map(String),
    counters: toCounters(result.counters),
  };
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Normalises the counter aggregate. pg parses `json_agg` output, but coerce
 * defensively so a driver or schema change can never put a string into a
 * numeric counter.
 */
function toCounters(value: unknown): LiveOverlay["counters"] {
  return asArray(value).map((entry) => {
    const record = entry as Record<string, unknown>;
    const { id, ...values } = record;
    const numeric: Record<string, number> = {};
    for (const [key, raw] of Object.entries(values)) {
      numeric[key] = Number(raw) || 0;
    }
    return { id: String(id), values: numeric };
  });
}
