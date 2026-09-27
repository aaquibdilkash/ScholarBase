/**
 * The Trending tab, built on the same cache policy as the All tab.
 *
 * Until this existed, trending was the only list read in the app with no cache on
 * either tier: all fifteen `getTrending*()` functions ran a fresh `findMany`
 * plus a `getCurrentUser()` on every navigation to any of the sixteen index
 * pages, bypassing the Tri-Split entirely. The Trending tab is the *default* tab
 * on most of those pages, so this was the largest uncached read surface in the
 * product.
 *
 * It is a strict specialisation of the Tri-Split, not a new pattern:
 *
 * ┌───────────────────────────────────────────────────────────────┐
 * │ 1. Cached batch  — top N by `trendingScore desc`, viewer-      │
 * │    agnostic, shared by everyone, tagged, 5-minute TTL.        │
 * │ 2. Live overlay  — viewer votes / bookmarks / follows AND the │
 * │    materialized counters, one indexed statement per load.    │
 * └───────────────────────────────────────────────────────────────┘
 *
 * Two things are genuinely different from an All-tab list and are why this is
 * its own file rather than a config on `createTriSplitList`:
 *
 *  1. There is no cursor. Trending is a fixed top-N, ordered by a column a
 *     background cron rewrites, so paging it would be meaningless. That also
 *     means a stale batch is *less* wrong than elsewhere: the score it was
 *     ranked by is itself only as fresh as the last cron run.
 *  2. The projection is `include` (all scalars), not an explicit `select`. The
 *     Trending tab renders the same cards as the All tab but through a looser
 *     `TrendingItem` type, so a hand-written projection here would be a second
 *     thing to keep in step with every card. `dateKeys` therefore comes from
 *     the DMMF (see `./dates`) instead of a literal list.
 */
import { revalidateTag } from "next/cache";

import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/db";
import { ENTITY_CONFIG, type ModuleKey } from "@/lib/transactions";

import { createCachedPage } from "./cache";
import { dateKeysForModel, pascal } from "./dates";
import { getLiveOverlay } from "./overlay";
import { stitchLiveState, type StitchOptions } from "./stitch";

/** How many rows a Trending tab shows. Fixed, like the existing `take: 10`. */
export const TRENDING_PAGE_SIZE = 10;

/** The author projection the Trending cards render, unchanged from before. */
const AUTHOR_SELECT = {
  id: true,
  name: true,
  handle: true,
  avatarUrl: true,
  institutionVerifiedAt: true,
} as const;

/** Counter columns overlaid live for every viewer. */
const TRENDING_COUNTER_KEYS = [
  "totalVotes",
  "totalBookmarks",
  "totalComments",
] as const;

export type TrendingLoader<TItem> = {
  fetch: () => Promise<TItem[]>;
  /** Purges this tab's cached batch. */
  revalidate: () => void;
};

/**
 * Builds the Trending loader for one standard content module.
 *
 * `type` is the discriminator `TrendingList` switches on, and `score` is the
 * raw `trendingScore` the cron wrote — both are read straight off the cached
 * row, so they cost nothing extra and cannot disagree with the ordering.
 */
export function createContentTrending(args: {
  module: ModuleKey;
  /** Cache tag stem, e.g. `"events"` -> `"events-trending"`. */
  tag: string;
  /** The `TrendingItem` discriminator this module renders as. */
  type: string;
  /** Extra `where` beyond the soft-delete filter, e.g. published-only. */
  where?: Record<string, unknown>;
}): TrendingLoader<Record<string, unknown>> {
  const config = ENTITY_CONFIG[args.module];

  const loadBatch = createCachedPage<Record<string, unknown>, []>(
    `${args.tag}-trending`,
    async () =>
      (prismaDelegate(config.model).findMany({
        // RULE 4: soft-deleted rows never reach a public list.
        where: { isDeleted: false, ...args.where },
        include: { author: { select: AUTHOR_SELECT } },
        // RULE 2: ranked by the materialized score, never computed on read.
        orderBy: { trendingScore: "desc" },
        take: TRENDING_PAGE_SIZE,
      }) as Promise<Record<string, unknown>[]>),
    {
      // Every scalar is selected, so every DateTime column has to be revived.
      dateKeys: dateKeysForModel(config.model),
      // Discriminates this ordering from the `createdAt desc` list pages, which
      // share a stem but not a key.
      keyParts: ["trendingScore:desc"],
    },
  );

  const stitch: StitchOptions<Record<string, unknown>, Record<string, unknown>> = {
    getRowId: (row) => row.id as string,
    getAuthorId: (row) => row.authorId as string,
    counterKeys: TRENDING_COUNTER_KEYS,
    rehydrate: (row) => ({ ...row }),
    normalize: (row) => ({
      type: args.type,
      score: (row.trendingScore as number) ?? 0,
    }),
  };

  return {
    async fetch() {
      // Identity from the session, server-side. Never from the caller.
      const viewer = await getCurrentUser();
      const viewerId = viewer?.id ?? null;

      const rows = await loadBatch();
      if (rows.length === 0) return [];

      const liveOverlay = await getLiveOverlay(
        viewerId,
        rows.map((row) => String(row.id)),
        Array.from(
          new Set(rows.map((row) => row.authorId).filter(Boolean).map(String)),
        ),
        {
          row: pascal(config.model),
          vote: pascal(config.voteModel),
          bookmark: pascal(config.bookmarkModel),
          rowFk: config.parentFk,
          authorFk: "authorId",
          counterKeys: TRENDING_COUNTER_KEYS,
        },
      );

      return stitchLiveState(rows, liveOverlay, stitch);
    },

    revalidate() {
      revalidateTag(`${args.tag}-trending`, { expire: 0 });
    },
  };
}

/**
 * The Trending scholars variant.
 *
 * Kept separate because a scholar row's follow state is its own, not an author
 * relation — the same reason the directory has its own module.
 */
export function createScholarsTrending(): TrendingLoader<Record<string, unknown>> {
  const tag = "scholars-trending";

  // No `followers` filter here: that relation IS viewer state, and baking it
  // into a shared cached entry would leak one visitor's follow graph to another.
  const select = {
    id: true,
    name: true,
    handle: true,
    avatarUrl: true,
    institutionVerifiedAt: true,
    bio: true,
    reputation: true,
    trendingScore: true,
    followersCount: true,
    followingCount: true,
  } as unknown as Record<string, unknown>;

  const loadBatch = createCachedPage<Record<string, unknown>, []>(
    tag,
    () => prismaDelegate("user").findMany({
      where: { isDeleted: false },
      select,
      orderBy: { trendingScore: "desc" },
      take: TRENDING_PAGE_SIZE,
    }) as Promise<Record<string, unknown>[]>,
    {
      dateKeys: dateKeysForModel("user"),
      keyParts: ["trendingScore:desc"],
    },
  );

  const stitch: StitchOptions<Record<string, unknown>, Record<string, unknown>> = {
    getRowId: (row) => row.id as string,
    getAuthorId: (row) => row.id as string,
    counterKeys: ["reputation", "followersCount", "followingCount"],
    rehydrate: (row) => ({ ...row }),
    normalize: (row) => ({
      type: "scholar",
      score: (row.trendingScore as number) ?? 0,
    }),
    followTarget: "self",
  };

  return {
    async fetch() {
      const viewer = await getCurrentUser();
      const viewerId = viewer?.id ?? null;

      const rows = await loadBatch();
      if (rows.length === 0) return [];

      const liveOverlay = await getLiveOverlay(
        viewerId,
        rows.map((row) => String(row.id)),
        [],
        {
          row: "User",
          vote: null,
          bookmark: null,
          counterKeys: ["reputation", "followersCount", "followingCount"],
        },
      );

      return stitchLiveState(rows, liveOverlay, stitch);
    },

    revalidate() {
      revalidateTag(tag, { expire: 0 });
    },
  };
}

type Delegate = {
  findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
};

/**
 * Every Prisma delegate, without a per-model import list.
 *
 * `model` always comes from `ENTITY_CONFIG` — a compile-time literal map — never
 * from a request, so there is no injection surface here.
 */
function prismaDelegate(model: string): Delegate {
  return (
    prisma as unknown as Record<string, Delegate>
  )[model];
}
