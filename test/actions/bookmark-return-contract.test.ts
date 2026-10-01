/**
 * RULE 1 — the bookmark action's return contract, across every module.
 *
 * `toggleBookmark` is the second optimistic-UI counter alongside votes. It has
 * no test at all, yet its return value is what `BookmarkButton` splices in with
 * `setQueryData`: if `data.totalBookmarks` or `data.isBookmarked` is wrong or
 * missing, the button reverts to the value it optimistically painted over, and
 * the user sees "bookmarked, 3" while the truth is "not bookmarked".
 *
 * Written data-driven rather than per-module: the toggle logic is shared
 * through `handleBookmarkTransaction`, so what matters is that EVERY module
 * agrees on the contract, not that any one module repeats it.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeDb, resetFakeDb } from "../fake-prisma";
import { toggleBookmark } from "@/app/actions/bookmarks";
import { ENTITY_CONFIG, type ModuleKey } from "@/lib/transactions";

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance");
  return { default: fakeDb.client };
});

const VOTER = "u-voter";
const AUTHOR = "u-author";
const ENTITY = "entity-1";

let frozen = false;
let rateLimitAllowed = true;
const revalidateProfileBookmarks = vi.fn();

vi.mock("@/lib/auth", () => ({
  getActiveUser: vi.fn(async () => ({
    user: { id: VOTER },
    frozen,
    message: "Account frozen",
  })),
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: rateLimitAllowed })),
  enforceRateLimit: vi.fn(async () => {}),
  RATE_LIMIT_ERROR: "Rate limit exceeded",
}));
vi.mock("@/lib/tri-split/modules/profile-tab", () => ({
  revalidateProfileBookmarks: (...args: unknown[]) =>
    revalidateProfileBookmarks(...(args as [])),
}));
vi.mock("@/lib/qstash", () => ({ queueNotification: vi.fn(async () => {}) }));
vi.mock("@/lib/notifications", () => ({
  notifyFollowersOfActivity: vi.fn(async () => {}),
  notifyMentionedUsers: vi.fn(async () => {}),
  notifyUserById: vi.fn(async () => {}),
  resolveMentionedUsers: vi.fn(async () => []),
}));

/** Modules that carry bookmarks — the same set the overlay resolves. */
const MODULES = Object.keys(ENTITY_CONFIG).filter(
  (key) => Boolean(ENTITY_CONFIG[key as ModuleKey]?.bookmarkModel),
) as ModuleKey[];

const entityRow = (moduleKey: ModuleKey) =>
  fakeDb.rows(ENTITY_CONFIG[moduleKey].model)[0];
const bookmarkRows = (moduleKey: ModuleKey) =>
  fakeDb.rows(ENTITY_CONFIG[moduleKey].bookmarkModel);

const seedEntity = (moduleKey: ModuleKey) => {
  const config = ENTITY_CONFIG[moduleKey];
  fakeDb.seed("user", [
    { id: VOTER, reputation: 0, isDeleted: false },
    { id: AUTHOR, reputation: 0, isDeleted: false },
  ]);
  const entity: Record<string, unknown> = {
    id: ENTITY,
    authorId: AUTHOR,
    isDeleted: false,
    isFrozen: false,
    totalBookmarks: 0,
    [config.titleField]: `Title of ${moduleKey}`,
  };
  if (moduleKey === "RECOMMENDATION") entity.supervisorId = "sup-1";
  if (moduleKey === "JOURNAL_REVIEW") entity.journalId = "j-1";
  fakeDb.seed(config.model, entity);
};

beforeEach(() => {
  resetFakeDb();
  frozen = false;
  rateLimitAllowed = true;
  revalidateProfileBookmarks.mockClear();
});

describe("toggleBookmark", () => {
  it("covers every bookmark-capable module", () => {
    // Guards against the table silently going stale as modules are added.
    expect(MODULES.length).toBeGreaterThan(10);
  });

  describe.each(MODULES)("%s", (moduleKey) => {
    beforeEach(() => seedEntity(moduleKey));

    it("returns the new total and the post-toggle state", async () => {
      const result = await toggleBookmark(ENTITY, moduleKey);

      expect(result.success).toBe(true);
      const data = (result as { data: Record<string, unknown> }).data;
      expect(data.totalBookmarks).toBe(1);
      expect(data.isBookmarked).toBe(true);
      expect(bookmarkRows(moduleKey)).toHaveLength(1);
      expect(entityRow(moduleKey).totalBookmarks).toBe(1);
    });

    it("clears the bookmark and returns isBookmarked false on the second call", async () => {
      await toggleBookmark(ENTITY, moduleKey);
      const off = await toggleBookmark(ENTITY, moduleKey);

      const data = (off as { data: Record<string, unknown> }).data;
      // `false`, never `undefined` — the button clears its filled state on this.
      expect(data.isBookmarked).toBe(false);
      expect(data.totalBookmarks).toBe(0);
      expect(bookmarkRows(moduleKey)).toHaveLength(0);
      expect(entityRow(moduleKey).totalBookmarks).toBe(0);
    });

    it("purges the cached Bookmarks tab", async () => {
      // The tab lists exactly these rows, so a stale tag delays the new
      // bookmark until the TTL.
      await toggleBookmark(ENTITY, moduleKey);
      expect(revalidateProfileBookmarks).toHaveBeenCalledWith(VOTER);
    });

    it("refuses a frozen account without writing", async () => {
      frozen = true;
      const result = await toggleBookmark(ENTITY, moduleKey);

      expect(result.success).toBe(false);
      expect(bookmarkRows(moduleKey)).toHaveLength(0);
      expect(entityRow(moduleKey).totalBookmarks).toBe(0);
    });

    it("honours the rate limit without writing", async () => {
      rateLimitAllowed = false;
      const result = await toggleBookmark(ENTITY, moduleKey);

      expect(result.success).toBe(false);
      expect(bookmarkRows(moduleKey)).toHaveLength(0);
    });

    it("never moves the author's reputation", async () => {
      // Bookmarks are private state; RULE 3 makes reputation vote-only.
      await toggleBookmark(ENTITY, moduleKey);
      const author = fakeDb.rows("user").find((u) => u.id === AUTHOR)!;
      expect(author.reputation).toBe(0);
    });
  });

  it("throws on missing parameters rather than writing a half bookmark", async () => {
    seedEntity("ARTICLE");
    await expect(toggleBookmark("", "ARTICLE")).rejects.toThrow(
      /Missing required parameters/i,
    );
    expect(bookmarkRows("ARTICLE")).toHaveLength(0);
  });
});
