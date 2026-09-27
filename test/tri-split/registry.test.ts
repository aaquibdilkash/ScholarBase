import { describe, expect, it } from "vitest";

import { ENTITY_CONFIG, type ModuleKey } from "@/lib/transactions";
import { CONTENT_COUNTER_KEYS } from "@/lib/tri-split/content";
import {
  CONTENT_LIST_CONFIGS,
  CONTENT_LIST_KEYS,
  CONTENT_LISTS,
} from "@/lib/tri-split/modules/registry";

/**
 * Contract for every module wired into the Tri-Split registry.
 *
 * The modules are pure configuration, so one pass over all 13 asserts far more
 * than 13 near-identical folders would — in particular the "no viewer state in
 * the projection" rule, which is the exact shape of the identity leak that
 * used to affect every list loader in the app.
 */
describe("CONTENT_LIST_CONFIGS", () => {
  const entries = CONTENT_LIST_KEYS.map(
    (key) => [key, CONTENT_LIST_CONFIGS[key]] as const,
  );

  it("wires up the expected modules", () => {
    expect(CONTENT_LIST_KEYS.length).toBe(13);
    expect([...CONTENT_LIST_KEYS].sort()).toEqual([
      "CONTRIBUTION",
      "COURSE",
      "HELP_POST",
      "JOB_VACANCY",
      "JOURNAL",
      "PHD_ADMISSION",
      "PUBLICATION",
      "RESEARCH_EVENT",
      "RESEARCH_GRANT",
      "RESEARCH_SURVEY",
      "RESEARCH_TOOL",
      "RESULT",
      "SUPERVISOR",
    ]);
  });

  it("builds a loader for every configured module", () => {
    for (const key of CONTENT_LIST_KEYS) {
      const list = CONTENT_LISTS[key];
      expect(typeof list.fetchPage, `${key}.fetchPage`).toBe("function");
      expect(typeof list.revalidate, `${key}.revalidate`).toBe("function");
    }
  });

  it("uses a unique cache tag per module", () => {
    const tags = CONTENT_LIST_KEYS.map((key) => CONTENT_LIST_CONFIGS[key].tag);
    expect(new Set(tags).size).toBe(tags.length);
  });

  it.each(entries)(
    "%s declares a module key that exists in ENTITY_CONFIG",
    (key, config) => {
      expect(Object.keys(ENTITY_CONFIG)).toContain(config.module);
    },
  );

  it.each(entries)(
    "%s keys its config under its own ENTITY_CONFIG module name",
    (key, config) => {
      // A copy-paste slip here would silently point one module's cache at
      // another module's tables.
      expect(config.module).toBe(key as ModuleKey);
    },
  );

  it.each(entries)("%s filters soft-deleted rows", (_key, config) => {
    // RULE 3/4: a tombstoned row must never reach a list.
    expect(config.where).toMatchObject({ isDeleted: false });
  });

  it.each(entries)(
    "%s declares the materialized counters the cards render",
    (_key, config) => {
      const select = config.select;
      for (const counter of [
        "totalVotes",
        "totalBookmarks",
        "totalComments",
      ]) {
        expect(select[counter], counter).toBe(true);
      }
    },
  );

  it.each(entries)("%s selects its author relation", (_key, config) => {
    const author = config.select.author as { select?: Record<string, unknown> };
    expect(author).toBeDefined();
    for (const field of ["id", "name", "handle", "avatarUrl"]) {
      expect(author.select?.[field], field).toBe(true);
    }
  });

  it.each(entries)(
    "%s never puts viewer state in the cached projection",
    (key, config) => {
      // THE identity leak. A `votes` / `bookmarks` / `followers` key in a
      // cached select means one viewer's state can be shared with everyone, or
      // reintroduced as a client-supplied filter. Viewer state belongs to the
      // live overlay only.
      for (const forbidden of ["votes", "bookmarks", "followers"]) {
        expect(config.select[forbidden], `${key}.select.${forbidden}`).toBeUndefined();
      }
      const author = config.select.author as
        | { select?: Record<string, unknown> }
        | undefined;
      expect(author?.select?.followers, `${key}.author.select.followers`).toBeUndefined();
    },
  );

  it.each(entries)("%s declares at least one search field", (_key, config) => {
    expect((config.searchFields ?? []).length).toBeGreaterThan(0);
  });

  it.each(entries)(
    "%s declares the date columns the cache must serialize",
    (_key, config) => {
      // `createdAt` is the feed ordering, so it must always be serialized.
      expect(config.dateKeys ?? []).toContain("createdAt");
    },
  );

  it("JOURNAL reads its review aggregates through the live overlay", () => {
    // The card renders an average rating. `reviewCount` / `ratingSum` are
    // materialized on Journal and move on every posted/edited/deleted review, so
    // they belong in the overlay's counter columns: the aggregate is then
    // correct on the next page load, with no purge of the shared list batch and
    // no extra round trip (the overlay already selects these off the row).
    //
    // Purging instead would be a correctness-preserving but strictly worse
    // trade — it invalidates the batch every visitor shares.
    const journal = CONTENT_LIST_CONFIGS.JOURNAL;
    expect(journal.counterKeys).toEqual([
      ...CONTENT_COUNTER_KEYS,
      "reviewCount",
      "ratingSum",
    ]);
  });

  it.each(entries)(
    "%s selects every counter it reads live, so the stitch can fall back",
    (_key, config) => {
      // `stitchLiveState` falls back to the cached value when the overlay has no
      // row (signed out, or the row deleted between the two reads). A counter
      // that is overlaid but not selected would silently render as 0 in exactly
      // that window.
      //
      // Widened because only JOURNAL declares `counterKeys`, so the property is
      // absent from the union; the fallback mirrors `createContentList`.
      const { counterKeys = CONTENT_COUNTER_KEYS } = config as {
        counterKeys?: readonly string[];
      };
      for (const counter of counterKeys) {
        expect(config.select[counter], `${_key}.select.${counter}`).toBe(true);
      }
    },
  );
});
