import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Contract for the Trending tab cache.
 *
 * Trending used to be the only list in the app with no cache on either tier — 15
 * `getTrending*` functions each running a fresh `findMany` on every navigation
 * to any index page. It is now a `unstable_cache`d top-N batch plus the shared
 * live overlay, and these tests pin the two properties that make that safe:
 *
 *  1. the cached batch is viewer-agnostic (otherwise one visitor's vote state
 *     would be served to everybody), and
 *  2. every content mutation purges the Trending tab as well as the All tab, so
 *     a deleted row cannot linger in a ranking.
 */

const revalidateTag = vi.fn();
vi.mock("next/cache", () => ({
  revalidateTag: (...args: unknown[]) => revalidateTag(...args),
  unstable_cache: (fn: unknown) => fn,
}));

let viewer: { id: string } | null = { id: "u-viewer" };
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => viewer),
}));

type FindManyArgs = Record<string, unknown>;

const articleFindMany = vi.fn(async (_args?: FindManyArgs) => []);
const eventFindMany = vi.fn(async (_args?: FindManyArgs) => [
  {
    id: "ev-1",
    authorId: "u-author",
    title: "A conference",
    trendingScore: 42,
    totalVotes: 7,
    totalBookmarks: 2,
    totalComments: 1,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  },
]);

vi.mock("@/lib/db", () => ({
  default: {
    researchEvent: { findMany: eventFindMany },
    article: { findMany: articleFindMany },
  },
}));

const getLiveOverlay = vi.fn(async (viewerId: string | null, rowIds: string[]) => ({
  viewerId,
  votes: rowIds.map((id) => ({ id, voteType: "UPVOTE" })),
  bookmarks: rowIds.map((id) => ({ id: `bm-${id}`, rowId: id })),
  following: ["u-author"],
  counters: [],
}));

vi.mock("@/lib/tri-split/overlay", () => ({ getLiveOverlay }));

const { createContentTrending, TRENDING_PAGE_SIZE } = await import(
  "@/lib/tri-split/trending"
);

describe("content trending", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    viewer = { id: "u-viewer" };
  });

  it("ranks by the materialized score, not by a computed one", async () => {
    await createContentTrending({
      module: "RESEARCH_EVENT",
      tag: "events",
      type: "event",
    }).fetch();

    const args = eventFindMany.mock.calls[0][0]!;
    // RULE 2: read the column a cron maintains; never aggregate on the fly.
    expect(args.orderBy).toEqual({ trendingScore: "desc" });
    expect(args.take).toBe(TRENDING_PAGE_SIZE);
  });

  it("excludes soft-deleted rows and applies the module's own filter", async () => {
    await createContentTrending({
      module: "ARTICLE",
      tag: "articles",
      type: "article",
      where: { published: true },
    }).fetch();

    const args = articleFindMany.mock.calls[0][0]!;
    // RULE 4 soft-delete, plus whatever the module gates on.
    expect(args.where).toEqual({ isDeleted: false, published: true });
  });

  it("requests no viewer state in the cached batch", async () => {
    await createContentTrending({
      module: "RESEARCH_EVENT",
      tag: "events",
      type: "event",
    }).fetch();

    const args = eventFindMany.mock.calls[0][0]!;
    // The batch has to be shareable, so the only relation it may read is the
    // author projection. Votes and bookmarks come from the overlay.
    expect(Object.keys(args.include as object).sort()).toEqual(["author"]);
  });

  it("stamps the TrendingItem discriminator and the raw score", async () => {
    const [item] = await createContentTrending({
      module: "RESEARCH_EVENT",
      tag: "events",
      type: "event",
    }).fetch();

    expect(item.type).toBe("event");
    expect(item.score).toBe(42);
  });

  it("overlays the session viewer's state after the cached read", async () => {
    const [item] = await createContentTrending({
      module: "RESEARCH_EVENT",
      tag: "events",
      type: "event",
    }).fetch();

    // `stitchLiveState` puts the overlay back, so the card still knows the
    // viewer voted — from a cache that never knew it.
    expect(item.votes).toEqual([{ voteType: "UPVOTE" }]);
    expect(item.bookmarks).toEqual([{ id: "bm-ev-1" }]);
    expect(getLiveOverlay.mock.calls[0][0]).toBe("u-viewer");
  });

  it("spends no overlay query on an empty batch", async () => {
    eventFindMany.mockResolvedValueOnce([]);
    const items = await createContentTrending({
      module: "RESEARCH_EVENT",
      tag: "events",
      type: "event",
    }).fetch();

    expect(items).toEqual([]);
    expect(getLiveOverlay).not.toHaveBeenCalled();
  });

  it("hard-expires its own tag, distinct from the All-tab tag", () => {
    createContentTrending({
      module: "RESEARCH_EVENT",
      tag: "events",
      type: "event",
    }).revalidate();

    expect(revalidateTag).toHaveBeenCalledWith("events-trending", { expire: 0 });
  });
});
