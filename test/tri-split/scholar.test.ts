import { beforeEach, describe, expect, it, vi } from "vitest";

import { stitchLiveState, type LiveOverlay } from "@/lib/tri-split";
import {
  CONTENT_LISTS,
  SCHOLAR_SORT_KEY_PARTS,
  SCHOLAR_STITCH_OPTIONS,
} from "@/lib/tri-split/modules/registry";

/**
 * Loader-level harness for the directory. Registry/stitch tests prove the fold
 * rules in isolation, which is exactly how the real bug stayed green: the
 * loader never resolved a scholar's own id as the follow target, so it queried
 * no follows and every card rendered "Follow". These mocks let the actual
 * loader run end-to-end without a database.
 */
const state = vi.hoisted(() => ({
  queries: [] as string[],
  rows: [] as Record<string, unknown>[],
  following: [] as string[],
}));

function flattenSql(strings: readonly string[], values: readonly unknown[]): string {
  return strings.reduce((sql, part, index) => {
    const value = values[index];
    if (
      value &&
      typeof value === "object" &&
      "strings" in value &&
      "values" in value
    ) {
      const nested = value as { strings: readonly string[]; values: readonly unknown[] };
      return sql + part + flattenSql(nested.strings, nested.values);
    }
    return sql + part + (value === undefined ? "" : String(value));
  }, "");
}

vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => ({ id: "viewer-1" })),
}));

vi.mock("@/lib/db", () => ({
  default: {
    user: { findMany: vi.fn(async () => state.rows) },
    $queryRaw: (strings: readonly string[], ...values: unknown[]) => {
      state.queries.push(flattenSql(strings, values));
      return Promise.resolve([
        {
          votes: [],
          bookmarks: [],
          following: state.following,
          counters: [],
        },
      ]);
    },
  },
}));

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

describe("scholar directory loader", () => {
  const cachedRow = (id: string) => ({
    id,
    name: `Scholar ${id}`,
    handle: id,
    avatarUrl: null,
    institutionVerifiedAt: null,
    bio: null,
    reputation: 1,
    followersCount: 0,
    followingCount: 0,
    createdAt: "2026-01-02T03:04:05.000Z",
  });

  const loader = () =>
    (
      CONTENT_LISTS.SCHOLAR_DIRECTORY as unknown as Array<{
        fetchPage: () => Promise<Array<Record<string, unknown>>>;
      }>
    )[0];

  beforeEach(() => {
    state.queries = [];
    state.rows = [cachedRow("s1")];
    state.following = ["s1"];
  });

  it("shows 'Following' for a scholar the viewer follows", async () => {
    const [item] = await loader().fetchPage();

    // The regression: this used to be `false` on every refresh because the
    // loader resolved no author ids for directory rows.
    expect(item.isFollowed).toBe(true);
  });

  it("queries follows for the scholars on the page", async () => {
    await loader().fetchPage();

    const sql = state.queries.join("\n");
    expect(sql).toContain('"Follows"');
    expect(sql).toContain("viewer-1");
  });

  it("keeps 'Follow' when the viewer does not follow the scholar", async () => {
    state.following = [];

    const [item] = await loader().fetchPage();

    expect(item.isFollowed).toBe(false);
  });
});
