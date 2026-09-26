import { describe, expect, it } from "vitest";

import { ENTITY_CONFIG } from "@/lib/transactions";
import { CONTENT_COUNTER_KEYS, createContentList } from "@/lib/tri-split/content";
import { stitchLiveState, type LiveOverlay } from "@/lib/tri-split";

/**
 * `createContentList` derives every table/FK name from `ENTITY_CONFIG`. These
 * guard that derivation for the modules that rely on it, since a wrong table
 * name would only surface as a runtime SQL error against a live database.
 */
describe("createContentList config derivation", () => {
  const article = ENTITY_CONFIG.ARTICLE;

  it("exposes the counter triple every content module materializes", () => {
    expect(CONTENT_COUNTER_KEYS).toEqual([
      "totalVotes",
      "totalBookmarks",
      "totalComments",
    ]);
  });

  it("maps the ARTICLE module to its vote/bookmark tables and FK", () => {
    expect(article.model).toBe("article");
    expect(article.voteModel).toBe("articleVote");
    expect(article.bookmarkModel).toBe("articleBookmark");
    expect(article.parentFk).toBe("articleId");
  });

  it("builds a loader that exposes no identity parameter", () => {
    // The loader's only argument bag is paging/filter args. There is no
    // `userId`, which is what closes the IDOR the old per-module loaders had.
    const list = createContentList({
      module: "ARTICLE",
      tag: "articles-public",
      where: { isDeleted: false },
      select: { id: true },
    });

    expect(typeof list.fetchPage).toBe("function");
    expect(typeof list.revalidate).toBe("function");
    expect(list.fetchPage.length).toBe(0); // args are optional bag, not positional
  });
});

describe("content-module fold rules", () => {
  type Row = {
    id: string;
    authorId: string;
    totalVotes: number;
    totalBookmarks: number;
    totalComments: number;
    createdAt: string;
    author: { id: string; name: string };
  };

  const row = (id: string, authorId: string, votes = 0): Row => ({
    id,
    authorId,
    totalVotes: votes,
    totalBookmarks: 0,
    totalComments: 0,
    createdAt: "2026-01-02T03:04:05.000Z",
    author: { id: authorId, name: "Scholar" },
  });

  const options = {
    getRowId: (r: Row) => r.id,
    getAuthorId: (r: Row) => r.authorId,
    counterKeys: CONTENT_COUNTER_KEYS,
    rehydrate: (r: Row) => ({ ...r }) as Record<string, unknown>,
  };

  const overlay = (o: Partial<LiveOverlay> = {}): LiveOverlay => ({
    viewerId: "viewer-1",
    votes: [],
    bookmarks: [],
    following: [],
    counters: [],
    ...o,
  });

  it("overlays live counters onto a content row", () => {
    const [item] = stitchLiveState<Row, Record<string, unknown>>(
      [row("a1", "author-1", 5)],
      overlay({
        counters: [
          { id: "a1", values: { totalVotes: 9, totalBookmarks: 1, totalComments: 2 } },
        ],
      }),
      options,
    );
    expect(item.totalVotes).toBe(9);
    expect(item.totalBookmarks).toBe(1);
    expect(item.totalComments).toBe(2);
  });

  it("falls back to the cached counters for signed-out viewers", () => {
    const [item] = stitchLiveState<Row, Record<string, unknown>>(
      [row("a1", "author-1", 5)],
      null,
      options,
    );
    expect(item.totalVotes).toBe(5);
  });

  it("keeps each row's follow state on its own author", () => {
    const items = stitchLiveState<Row, Record<string, unknown>>(
      [row("a1", "author-1"), row("a2", "author-2")],
      overlay({ following: ["author-2"] }),
      options,
    );
    expect((items[0].author as { followers: unknown[] }).followers).toEqual([]);
    expect((items[1].author as { followers: unknown[] }).followers).toEqual([
      { followerId: "viewer-1" },
    ]);
  });
});
