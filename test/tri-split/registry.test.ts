import { describe, expect, it } from "vitest";

import { ENTITY_CONFIG } from "@/lib/transactions";
import { CONTENT_COUNTER_KEYS, type ContentListArgs } from "@/lib/tri-split/content";
import {
  CONTENT_LIST_CONFIGS,
  CONTENT_LIST_KEYS,
  CONTENT_LISTS,
  type ContentListLoaders,
} from "@/lib/tri-split/modules/registry";

/**
 * Contract for every module wired into the Tri-Split registry.
 *
 * The modules are pure configuration, so one pass over all of them asserts far
 * more than a near-identical folder each would — in particular the "no viewer
 * state in the projection" rule, which is the exact shape of the identity leak
 * that used to affect every list loader in the app.
 *
 * Two config shapes exist. Fifteen are content modules (`module` key, one
 * loader). `SCHOLAR_DIRECTORY` is the single non-content list (`variants`, two
 * loaders) and gets its own assertions below.
 */
describe("CONTENT_LIST_CONFIGS", () => {
  const isDirectory = (key: string) => "variants" in CONTENT_LIST_CONFIGS[key as never];
  const CONTENT_KEYS = CONTENT_LIST_KEYS.filter((k) => !isDirectory(k));
  const DIRECTORY_KEYS = CONTENT_LIST_KEYS.filter(isDirectory);

  const entries = CONTENT_KEYS.map(
    (key) => [key, CONTENT_LIST_CONFIGS[key] as ContentListArgs] as const,
  );

  it("wires up every listing surface: 15 content modules + the scholar directory", () => {
    expect(CONTENT_LIST_KEYS.length).toBe(16);
    expect([...CONTENT_KEYS].sort()).toEqual([
      "ARTICLE",
      "CONTRIBUTION",
      "COURSE",
      "FEED",
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
    expect(DIRECTORY_KEYS).toEqual(["SCHOLAR_DIRECTORY"]);
  });

  it("builds a loader for every configured module", () => {
    for (const key of CONTENT_LIST_KEYS) {
      const list = CONTENT_LISTS[key] as ContentListLoaders;
      // A content key yields one loader; a variant key yields one per ordering.
      const loaders = Array.isArray(list) ? list : [list];
      for (const loader of loaders) {
        expect(typeof loader.fetchPage, `${key}.fetchPage`).toBe("function");
        expect(typeof loader.revalidate, `${key}.revalidate`).toBe("function");
      }
    }
  });

  it("uses a unique cache key space per loader", () => {
    // Two loaders may share a tag only if their keyParts differ — that is how
    // the scholar directory's two orderings stay disjoint. Anything else
    // colliding would let one module serve another module's rows.
    const spaces = CONTENT_LIST_KEYS.map((key) => {
      const config = CONTENT_LIST_CONFIGS[key];
      return ("variants" in config
        ? config.variants
        : [config]
      ).map((variant) => {
        const v = variant as { tag: string; keyParts?: readonly string[] };
        return `${v.tag}|${(v.keyParts ?? []).join(",")}`;
      });
    }).flat();
    expect(new Set(spaces).size).toBe(spaces.length);
  });

  it.each(entries)(
    "%s declares a module key that exists in ENTITY_CONFIG",
    (key, config) => {
      expect(Object.keys(ENTITY_CONFIG)).toContain(config.module);
    },
  );

  it("maps each ENTITY_CONFIG module at most once", () => {
    // `FEED` is the one intentional alias: the listing is the feed, the row it
    // lists is a social post. Two keys resolving to one module would make them
    // share a cache and read each other's rows.
    const modules = CONTENT_KEYS.map(
      (key) => (CONTENT_LIST_CONFIGS[key] as ContentListArgs).module,
    );
    expect(new Set(modules).size).toBe(modules.length);
    expect(modules.filter((m) => m === "SOCIAL_POST")).toEqual(["SOCIAL_POST"]);
    expect(CONTENT_LIST_CONFIGS.FEED.module).toBe("SOCIAL_POST");
  });

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

/**
 * The scholar directory is the one non-content list, so it has its own shape:
 * `User` rows, no vote/bookmark tables, and one loader per ordering.
 */
describe("SCHOLAR_DIRECTORY config", () => {
  type Variant = {
    rowTable: string;
    tag: string;
    model: string;
    where: Record<string, unknown>;
    keyParts?: readonly string[];
    select: Record<string, unknown>;
    orderBy?: Record<string, unknown>;
    dateKeys?: readonly string[];
    counterKeys?: readonly string[];
    searchFields?: readonly { field: string }[];
    stitchOverrides?: { followTarget?: string };
  };

  const variants = (
    CONTENT_LIST_CONFIGS.SCHOLAR_DIRECTORY as unknown as { variants: Variant[] }
  ).variants;

  it("declares one loader per ordering", () => {
    // `unstable_cache` fixes key parts at creation time, so `latest` and
    // `reputation` must be separate loaders or one could serve the other's rows.
    expect(variants).toHaveLength(2);
  });

  it("gives the two orderings disjoint cache key spaces", () => {
    const [a, b] = variants;
    expect(a.keyParts?.[0]).toBe("latest");
    expect(b.keyParts?.[0]).toBe("reputation");
    expect(a.keyParts?.[0]).not.toBe(b.keyParts?.[0]);
    expect(a.orderBy).toEqual({ createdAt: "desc" });
    expect(b.orderBy).toEqual({ reputation: "desc", createdAt: "desc" });
  });

  it.each(variants.map((v, i) => [i, v] as const))(
    "variant %i reads the User table and filters tombstoned rows",
    (_i, variant) => {
      expect(variant.rowTable).toBe("User");
      expect(variant.model).toBe("user");
      expect(variant.where).toMatchObject({ isDeleted: false });
    },
  );

  it.each(variants.map((v, i) => [i, v] as const))(
    "variant %i never puts viewer state in the cached projection",
    (_i, variant) => {
      for (const forbidden of ["votes", "bookmarks", "followers"]) {
        expect(variant.select[forbidden], forbidden).toBeUndefined();
      }
    },
  );

  it.each(variants.map((v, i) => [i, v] as const))(
    "variant %i resolves follow state top-level, not via a nested relation",
    (_i, variant) => {
      // The leaky `followers` array must never reach the output; the stitch
      // emits an explicit `isFollowed` instead.
      expect(variant.stitchOverrides?.followTarget).toBe("self");
    },
  );

  it.each(variants.map((v, i) => [i, v] as const))(
    "variant %i overlays the scholar counters the cards render",
    (_i, variant) => {
      expect(variant.counterKeys).toEqual([
        "reputation",
        "followersCount",
        "followingCount",
      ]);
      for (const counter of variant.counterKeys ?? []) {
        expect(variant.select[counter], counter).toBe(true);
      }
    },
  );

  it.each(variants.map((v, i) => [i, v] as const))(
    "variant %i is searchable and serializes createdAt",
    (_i, variant) => {
      expect(variant.searchFields?.length).toBeGreaterThan(0);
      expect(variant.dateKeys ?? []).toContain("createdAt");
    },
  );
});

