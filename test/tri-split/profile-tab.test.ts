import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Contract for the scholar-profile tab cache.
 *
 * Two things are worth pinning here, and neither is a detail:
 *
 *  1. **The cached half carries no identity.** Every statement in
 *     `lib/profile-sections.ts` is viewer-agnostic, and the viewer's state is
 *     layered on by a separate overlay. If a viewer id ever leaks back into the
 *     cached half, one visitor's vote / bookmark / follow state gets baked into
 *     an entry served to everybody else — the identity leak the Tri-Split
 *     refactor removed from the list pages.
 *  2. **Every tab is wired to the purge that keeps it honest.** A cache with no
 *     invalidation serves deleted rows, so these tests assert the call graph,
 *     not just the loader's shape.
 */

const revalidateTag = vi.fn();
vi.mock("next/cache", () => ({
  revalidateTag: (...args: unknown[]) => revalidateTag(...args),
  unstable_cache: (fn: unknown) => fn,
}));

let viewer: { id: string } | null = { id: "u-viewer" };
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => viewer),
  requireActiveUser: vi.fn(async () => {
    throw new Error("not used");
  }),
}));

const userFindUnique = vi.fn(async () => ({ articleCount: 4, socialPostCount: 2 }));
const activityFindMany = vi.fn(async () => [
  {
    id: "act-1",
    action: "PUBLISHED",
    moduleType: "RESEARCH_EVENT",
    entityId: "ev-1",
    entityTitle: "A conference",
    createdAt: new Date("2026-01-02T03:04:05.000Z"),
  },
]);

vi.mock("@/lib/db", () => ({
  default: {
    user: { findUnique: userFindUnique },
    userActivity: { findMany: activityFindMany },
  },
}));

type Sections = Record<string, unknown[]>;

const fetchContentSections = vi.fn(
  async (_profileId: string, _take: number) =>
    ({
      articles: [{ id: "a1", authorId: "u-author", title: "Cached row" }],
      socialPosts: [],
    }) as Sections,
);
const fetchBookmarkSections = vi.fn(
  async (_ownerId: string, _take: number) =>
    ({
      items: {
        articles: [{ id: "a1", authorId: "u-author", title: "Bookmarked row" }],
      },
      counts: { articles: 3 },
    }) as unknown as { items: Sections; counts: Record<string, number> },
);
const fetchProfileSectionsOverlay = vi.fn(
  async (_rowIds: unknown, _authorIds: string[], _viewerId: string | null) => ({
    votes: new Map([["articles", new Map([["a1", "UPVOTE"]])]]),
    bookmarks: new Map([["articles", new Map([["a1", "bm-9"]])]]),
    following: new Set(["u-author"]),
  }),
);
const collectSectionRowIds = vi.fn((_sections: Sections) => ({
  articles: ["a1"],
  socialPosts: [],
}));
const collectSectionAuthorIds = vi.fn((_sections: Sections) => ["u-author"]);
const applySectionsOverlay = vi.fn(
  (_sections: Sections, _overlay: unknown, _viewerId: string | null) => _sections,
);
// Deliberately the identity, so the test can prove `reviveSectionDates` — not
// this mock — is what turns the cache's ISO strings back into `Date`s.
const reviveSectionDates = vi.fn((_sections: Sections) => _sections);

vi.mock("@/lib/profile-sections", () => ({
  fetchContentSections,
  fetchBookmarkSections,
  fetchProfileSectionsOverlay,
  collectSectionRowIds,
  collectSectionAuthorIds,
  applySectionsOverlay,
  reviveSectionDates,
  PROFILE_SECTION_KEYS: ["articles", "socialPosts"],
}));

const {
  PROFILE_ACTIVITY_TAG,
  PROFILE_BOOKMARKS_TAG,
  PROFILE_CONTENT_TAG,
  loadProfileActivity,
  loadProfileBookmarkTab,
  loadProfileContentTab,
  profileActivityTag,
  profileBookmarksTag,
  profileContentTag,
  revalidateProfileBookmarks,
  revalidateProfileContent,
} = await import("@/lib/tri-split/modules/profile-tab");

const VIEWER = "u-viewer";
const ALICE = "u-alice";
const BOB = "u-bob";

describe("profile tab tags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scopes every tab's tag to a single profile", () => {
    // This is the whole point: one publish must not evict every scholar's tab.
    expect(profileContentTag(ALICE)).toBe(`${PROFILE_CONTENT_TAG}:${ALICE}`);
    expect(profileBookmarksTag(ALICE)).toBe(`${PROFILE_BOOKMARKS_TAG}:${ALICE}`);
    expect(profileActivityTag(ALICE)).toBe(`${PROFILE_ACTIVITY_TAG}:${ALICE}`);
  });

  it("gives Alice and Bob different tags, so neither evicts the other", () => {
    const alice = new Set([
      profileContentTag(ALICE),
      profileBookmarksTag(ALICE),
      profileActivityTag(ALICE),
    ]);
    const bob = new Set([
      profileContentTag(BOB),
      profileBookmarksTag(BOB),
      profileActivityTag(BOB),
    ]);
    for (const tag of alice) expect(bob).not.toContain(tag);
  });

  it("keeps each profile's three tabs independently addressable", () => {
    const stems = new Set([
      profileContentTag(ALICE),
      profileBookmarksTag(ALICE),
      profileActivityTag(ALICE),
    ]);
    expect(stems.size).toBe(3);
  });

  it("refuses a tag Next would reject rather than silently never purge", () => {
    // A tag over 256 chars is dropped with a warning by `validateTags`, which
    // would leave the entry permanently un-invalidatable.
    expect(() => profileContentTag("x".repeat(300))).toThrow(/too long/i);
    expect(profileContentTag("x".repeat(200)).length).toBeLessThanOrEqual(256);
  });
});

describe("profile tab loaders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    viewer = { id: VIEWER };
  });

  it("keeps the cached row batch and the live overlay as separate reads", async () => {
    // The batch is shared by every visitor; the overlay is the only per-viewer
    // cost, and there must be exactly one of it per page load.
    const { sections, counts } = await loadProfileContentTab({
      profileId: "u-author",
      take: 1,
      viewerId: VIEWER,
    });

    expect(fetchContentSections).toHaveBeenCalledTimes(1);
    // The viewer id is NOT a parameter of the cached read — that is the whole
    // reason the batch is shareable.
    expect(fetchContentSections.mock.calls[0]).toEqual(["u-author", 1]);
    expect(fetchProfileSectionsOverlay).toHaveBeenCalledTimes(1);
    // The overlay is keyed on the session viewer, never on a caller argument.
    expect(fetchProfileSectionsOverlay.mock.calls[0][2]).toBe(VIEWER);
    expect(applySectionsOverlay).toHaveBeenCalledTimes(1);
    expect(sections).toBeDefined();
    expect(counts.articles).toBe(4);
  });

  it("reads the bookmark batch under the owner's id, not the profile's", async () => {
    // `profileId` is caller-chosen; the owner of the bookmark rows is the
    // session user, which is what keeps bookmarks private.
    await loadProfileBookmarkTab({ ownerId: VIEWER, take: 1, viewerId: VIEWER });
    expect(fetchBookmarkSections.mock.calls[0]).toEqual([VIEWER, 1]);
  });

  it("revives dates on the way out of the cache, not just out of the query", async () => {
    // `unstable_cache` persists with `JSON.stringify`, so a cache HIT returns
    // ISO strings for a path that never touched Prisma. Reviving only inside the
    // statement (as this loader's predecessor did) would make `createdAt` a
    // string on every warm read and a `Date` on every cold one — a bug that
    // cannot reproduce in local development, where the cache is always cold.
    await loadProfileContentTab({ profileId: "u-author", take: 1, viewerId: VIEWER });
    await loadProfileBookmarkTab({ ownerId: VIEWER, take: 1, viewerId: VIEWER });

    expect(reviveSectionDates).toHaveBeenCalledTimes(2);
  });

  it("clamps a hostile page size before it reaches the cache key", async () => {
    // `take` is a cache-key input, so an unclamped value would let a caller mint
    // unbounded entries.
    await loadProfileContentTab({ profileId: "u-author", take: 1e9, viewerId: VIEWER });
    expect(fetchContentSections.mock.calls[0][1]).toBeLessThanOrEqual(50);
  });

  it("revives the activity page's dates after the cache round trip", async () => {
    const [item] = await loadProfileActivity("u-author", 10);
    expect(item.createdAt).toBeInstanceOf(Date);
    expect(item.createdAt.toISOString()).toBe("2026-01-02T03:04:05.000Z");
  });

  it("returns nothing for an empty profile id without querying", async () => {
    await expect(loadProfileActivity("", 10)).resolves.toEqual([]);
    expect(activityFindMany).not.toHaveBeenCalled();
  });
});

describe("profile tab purges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("evicts only the named profile's content and activity tabs", () => {
    // Every content action writes a UserActivity row in the same transaction,
    // so a publish / edit / delete stales both tabs — for that author only.
    revalidateProfileContent(ALICE);

    expect(revalidateTag).toHaveBeenCalledWith(
      `${PROFILE_CONTENT_TAG}:${ALICE}`,
      { expire: 0 },
    );
    expect(revalidateTag).toHaveBeenCalledWith(
      `${PROFILE_ACTIVITY_TAG}:${ALICE}`,
      { expire: 0 },
    );
    expect(revalidateTag).toHaveBeenCalledTimes(2);
    // Bob's tabs are untouched — the whole reason the tag is per profile.
    for (const [tag] of revalidateTag.mock.calls) {
      expect(String(tag)).not.toContain(BOB);
    }
  });

  it("evicts each author named by a multi-row mutation, once each", () => {
    revalidateProfileContent(ALICE, BOB, ALICE, null, undefined);

    const contentTags = revalidateTag.mock.calls
      .map(([tag]) => String(tag))
      .filter((tag) => tag.startsWith(PROFILE_CONTENT_TAG));
    // 2 profiles x (1 content + 1 activity); the duplicate and the nullish
    // entries must not each mint a purge.
    expect(revalidateTag).toHaveBeenCalledTimes(4);
    expect(new Set(contentTags).size).toBe(2);
  });

  it("purges nothing when no author is named", () => {
    // A call site that cannot determine the author must not fall back to a
    // global purge; the 5-minute TTL bounds the staleness instead.
    revalidateProfileContent();
    revalidateProfileContent(null, undefined);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("evicts one user's bookmark tab, and no other tab", () => {
    revalidateProfileBookmarks(VIEWER);

    expect(revalidateTag).toHaveBeenCalledTimes(1);
    expect(revalidateTag).toHaveBeenCalledWith(
      `${PROFILE_BOOKMARKS_TAG}:${VIEWER}`,
      { expire: 0 },
    );
  });

  it("uses `expire: 0`, never a stale-while-revalidate purge", () => {
    // A stale-while-revalidate purge keeps serving the row it was told to drop,
    // which for a deleted post or a removed bookmark is exactly wrong.
    revalidateProfileContent(ALICE, BOB);
    revalidateProfileBookmarks(VIEWER);
    for (const [tag, options] of revalidateTag.mock.calls) {
      expect(options, String(tag)).toEqual({ expire: 0 });
    }
  });
});
