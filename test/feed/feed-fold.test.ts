/**
 * The feed's genuinely feed-specific fold rules.
 *
 * The generic Tri-Split fold (counters, votes, bookmarks, follow state, date
 * revival) is covered once in `test/tri-split/stitch.test.ts` and
 * `test/tri-split/cache.test.ts`. This file covers ONLY what is actually unique
 * to the feed, so the two suites cannot drift into duplicating each other.
 */
import { describe, expect, it } from "vitest";

import { CONTENT_LIST_CONFIGS } from "@/lib/tri-split/modules/registry";
import { PUBLIC_SOCIAL_POST_SELECT } from "@/types/feed";

const feed = CONTENT_LIST_CONFIGS.FEED;
const normalize = feed.stitchOverrides?.normalize;
if (!normalize) {
  throw new Error(
    "FEED must declare a `normalize` — the Json `mentions` column is the one " +
      "genuinely module-specific fold rule it has.",
  );
}

describe("the FEED registry config", () => {
  it("declares every date column the fold revives", () => {
    // `dateKeys` drives both the cache serialise step and the stitch's revive
    // step, so this one list is the whole contract. It used to be duplicated
    // by a hand-rolled `rehydratePublicSocialPost`.
    expect(feed.dateKeys).toEqual(["createdAt", "updatedAt", "editedAt"]);
  });

  it("normalises the Json mentions column", () => {
    expect(
      normalize({ mentions: [{ id: "u9", handle: "ada", name: "Ada" }] })
        .mentions,
    ).toEqual([{ id: "u9", handle: "ada", name: "Ada" }]);

    // Anything that is not an array collapses to null rather than leaking an
    // object into a component that maps over it.
    expect(normalize({ mentions: { not: "an-array" } }).mentions).toBeNull();
    expect(normalize({ mentions: null }).mentions).toBeNull();
  });

  it("carries every viewer-independent field the cards read", () => {
    // Regression guard: authorId drives owner actions, isFrozen/hasActiveAppeal
    // drive the moderation banner, mentions drive the mention links. Dropping
    // any of them from the projection breaks those silently.
    for (const key of [
      "id",
      "authorId",
      "content",
      "imageUrl",
      "mentions",
      "isFrozen",
      "hasActiveAppeal",
      "createdAt",
      "updatedAt",
      "editedAt",
      "totalVotes",
      "totalBookmarks",
      "totalComments",
      "author",
    ] as const) {
      expect(PUBLIC_SOCIAL_POST_SELECT).toHaveProperty(key);
    }
  });

  it("never selects viewer state into the shared cached batch", () => {
    // RULE 2: the cached half is viewer-agnostic. `votes` / `bookmarks` /
    // `followers` may only ever arrive via the live overlay.
    const select = PUBLIC_SOCIAL_POST_SELECT as Record<string, unknown>;
    expect(select.votes).toBeUndefined();
    expect(select.bookmarks).toBeUndefined();
    expect(
      (select.author as Record<string, unknown> | undefined)?.followers,
    ).toBeUndefined();
  });
});