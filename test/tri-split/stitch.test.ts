import { describe, expect, it } from "vitest";

import { stitchLiveState, type LiveOverlay, type StitchOptions } from "@/lib/tri-split";

type Row = {
  id: string;
  authorId: string;
  totalVotes: number;
  totalBookmarks: number;
  createdAt: string;
  author: { id: string; name: string };
};

function row(id: string, authorId: string, overrides: Partial<Row> = {}): Row {
  return {
    id,
    authorId,
    totalVotes: 0,
    totalBookmarks: 0,
    createdAt: "2026-01-02T03:04:05.000Z",
    author: { id: authorId, name: "Scholar" },
    ...overrides,
  };
}

function overlay(overrides: Partial<LiveOverlay> = {}): LiveOverlay {
  return {
    viewerId: "viewer-1",
    votes: [],
    bookmarks: [],
    following: [],
    counters: [],
    ...overrides,
  };
}

const options: StitchOptions<Row, Record<string, unknown>> = {
  getRowId: (r) => r.id,
  getAuthorId: (r) => r.authorId,
  counterKeys: ["totalVotes", "totalBookmarks"],
  rehydrate: (r) => ({ ...r, createdAt: new Date(r.createdAt) }),
};

describe("stitchLiveState", () => {
  it("revives cached ISO date strings into Date objects", () => {
    const [item] = stitchLiveState<Row, Record<string, unknown>>(
      [row("p1", "a1")],
      null,
      options,
    );
    expect(item.createdAt).toBeInstanceOf(Date);
  });

  it("prefers live counters over the cached values", () => {
    const [item] = stitchLiveState<Row, Record<string, unknown>>(
      [row("p1", "a1", { totalVotes: 40, totalBookmarks: 2 })],
      overlay({
        counters: [
          { id: "p1", values: { totalVotes: 43, totalBookmarks: 5 } },
        ],
      }),
      options,
    );
    expect(item.totalVotes).toBe(43);
    expect(item.totalBookmarks).toBe(5);
  });

  it("falls back to cached counters when the overlay has no row", () => {
    const [item] = stitchLiveState<Row, Record<string, unknown>>(
      [row("p1", "a1", { totalVotes: 40, totalBookmarks: 2 })],
      overlay({ counters: [] }),
      options,
    );
    expect(item.totalVotes).toBe(40);
    expect(item.totalBookmarks).toBe(2);
  });

  it("applies only the overlay rows that belong to their own row", () => {
    const items = stitchLiveState<Row, Record<string, unknown>>(
      [row("p1", "a1", { totalVotes: 40 }), row("p2", "a2", { totalVotes: 1 })],
      overlay({
        counters: [{ id: "p1", values: { totalVotes: 43, totalBookmarks: 0 } }],
      }),
      options,
    );
    expect(items[0].totalVotes).toBe(43);
    // p2 has no overlay row -> its own cached value survives.
    expect(items[1].totalVotes).toBe(1);
  });

  it("overlays the viewer's vote and bookmark state", () => {
    const [item] = stitchLiveState<Row, Record<string, unknown>>(
      [row("p1", "a1")],
      overlay({
        votes: [{ id: "p1", voteType: "UPVOTE" }],
        bookmarks: [{ id: "b1", rowId: "p1" }],
      }),
      options,
    );
    expect(item.votes).toEqual([{ voteType: "UPVOTE" }]);
    expect(item.bookmarks).toEqual([{ id: "b1" }]);
  });

  it("renders empty arrays, never false/undefined, for signed-out viewers", () => {
    const [item] = stitchLiveState<Row, Record<string, unknown>>(
      [row("p1", "a1")],
      null,
      options,
    );
    expect(item.votes).toEqual([]);
    expect(item.bookmarks).toEqual([]);
    expect((item.author as { followers: unknown[] }).followers).toEqual([]);
  });

  it("resolves follow state onto author.followers for signed-in viewers", () => {
    const [item] = stitchLiveState<Row, Record<string, unknown>>(
      [row("p1", "a1")],
      overlay({ following: ["a1"] }),
      options,
    );
    expect((item.author as { followers: unknown[] }).followers).toEqual([
      { followerId: "viewer-1" },
    ]);
  });

  it("emits a top-level isFollowed boolean when followTarget is 'self'", () => {
    const selfOptions: StitchOptions<Row, Record<string, unknown>> = {
      ...options,
      followTarget: "self",
    };
    const [followed] = stitchLiveState<Row, Record<string, unknown>>(
      [row("p1", "a1")],
      overlay({ following: ["a1"] }),
      selfOptions,
    );
    expect(followed.isFollowed).toBe(true);
    // The leaky raw array must not survive into the stitched output.
    expect(followed.followers).toBeUndefined();
  });

  it("never reports isFollowed for a signed-out viewer", () => {
    const selfOptions: StitchOptions<Row, Record<string, unknown>> = {
      ...options,
      followTarget: "self",
    };
    const [item] = stitchLiveState<Row, Record<string, unknown>>(
      [row("p1", "a1")],
      overlay({ viewerId: null, following: ["a1"] }),
      selfOptions,
    );
    expect(item.isFollowed).toBe(false);
  });

  it("does not mutate the cached rows it is given", () => {
    const cached = row("p1", "a1", { totalVotes: 10 });
    stitchLiveState<Row, Record<string, unknown>>(
      [cached],
      overlay({
        votes: [{ id: "p1", voteType: "UPVOTE" }],
        counters: [{ id: "p1", values: { totalVotes: 99, totalBookmarks: 0 } }],
      }),
      options,
    );
    expect(cached.totalVotes).toBe(10);
    expect(cached).not.toHaveProperty("votes");
    expect(cached.author).not.toHaveProperty("followers");
  });
});
