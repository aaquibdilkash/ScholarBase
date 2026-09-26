import { describe, expect, it } from "vitest";

import { stitchLiveState, type LiveOverlay } from "@/lib/tri-split";
import {
  SCHOLAR_SORT_KEY_PARTS,
  SCHOLAR_STITCH_OPTIONS,
} from "@/lib/tri-split/modules/scholar";

type ScholarRow = {
  id: string;
  name: string | null;
  handle: string | null;
  reputation: number;
  followersCount: number;
  followingCount: number;
  createdAt: string;
};

const row = (id: string, followers = 0): ScholarRow => ({
  id,
  name: `Scholar ${id}`,
  handle: id,
  reputation: 10,
  followersCount: followers,
  followingCount: 2,
  createdAt: "2026-01-02T03:04:05.000Z",
});

const overlay = (o: Partial<LiveOverlay> = {}): LiveOverlay => ({
  viewerId: "viewer-1",
  votes: [],
  bookmarks: [],
  following: [],
  counters: [],
  ...o,
});

const stitch = (rows: ScholarRow[], o: LiveOverlay | null) =>
  stitchLiveState<ScholarRow, Record<string, unknown>>(
    rows,
    o,
    SCHOLAR_STITCH_OPTIONS as never,
  );

describe("scholar directory sort variants", () => {
  it("gives each ordering a distinct cache key part", () => {
    // `latest` and `reputation` order by different indexed columns. Sharing a
    // cache key would let a reputation-sorted request be served a
    // latest-sorted page.
    expect(SCHOLAR_SORT_KEY_PARTS).toEqual(["latest", "reputation"]);
    expect(new Set(SCHOLAR_SORT_KEY_PARTS).size).toBe(
      SCHOLAR_SORT_KEY_PARTS.length,
    );
  });
});

describe("scholar directory stitch", () => {
  it("emits a top-level isFollowed for a followed scholar", () => {
    const [item] = stitch([row("s1")], overlay({ following: ["s1"] }));
    expect(item.isFollowed).toBe(true);
  });

  it("never emits the raw followers relation", () => {
    // The leak the migration removed: a `followers` array on a cached row.
    const [item] = stitch([row("s1", 40)], overlay({ following: ["s1"] }));
    expect(item.followers).toBeUndefined();
  });

  it("reports isFollowed false for a signed-out visitor", () => {
    const [item] = stitch([row("s1")], overlay({ viewerId: null }));
    expect(item.isFollowed).toBe(false);
  });

  it("overlays live reputation and follower counters", () => {
    const [item] = stitch(
      [row("s1")],
      overlay({
        counters: [
          {
            id: "s1",
            values: {
              reputation: 99,
              followersCount: 12,
              followingCount: 3,
            },
          },
        ],
      }),
    );
    expect(item.reputation).toBe(99);
    expect(item.followersCount).toBe(12);
    expect(item.followingCount).toBe(3);
  });

  it("falls back to the cached counters for a signed-out visitor", () => {
    const [item] = stitch([row("s1", 7)], null);
    expect(item.reputation).toBe(10);
    expect(item.followersCount).toBe(7);
    expect(item.isFollowed).toBe(false);
  });

  it("revives the cached createdAt string into a Date", () => {
    const [item] = stitch([row("s1")], null);
    expect(item.createdAt).toBeInstanceOf(Date);
  });
});
