/**
 * Drift guard for the profile-section raw SQL.
 *
 * `lib/profile-sections.ts` interpolates table and column names into SQL
 * because a `UNION ALL` over 17 heterogeneously-shaped tables is not
 * expressible through the Prisma client. That makes the correctness of those
 * names load-bearing, so this file re-derives them from the live DMMF: if a
 * model, FK or vote/bookmark table is renamed, this fails before the query
 * does.
 *
 * It also pins the injection boundary — request values must be bound, never
 * interpolated — so the raw SQL cannot quietly grow a hole.
 */
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  PROFILE_SECTION_KEYS,
  SECTION_MODULE,
  applySectionsOverlay,
  buildBookmarkSectionsSql,
  buildContentSectionsSql,
  buildSectionsOverlaySql,
  reviveSectionDates,
  type ProfileSectionRow,
  type ProfileSectionsOverlay,
  type ProfileSectionsPayload,
} from "@/lib/profile-sections";
import { PROFILE_SECTION_CONFIG } from "@/lib/module-registry";
import { ENTITY_CONFIG } from "@/lib/transactions";

const dmmfModels = Prisma.dmmf.datamodel.models;

const model = (name: string) => {
  const found = dmmfModels.find((m) => m.name === name);
  if (!found) throw new Error(`model ${name} is missing from the DMMF`);
  return found;
};

/** Scalar column names (no relation) — what a table physically stores. */
const scalars = (name: string) =>
  new Set(
    model(name)
      .fields.filter((f) => !f.relationName)
      .map((f) => f.name),
  );

const pascal = (key: string) => key.charAt(0).toUpperCase() + key.slice(1);

describe("profile section registry", () => {
  it("maps every profile section to a module", () => {
    // `SECTION_MODULE` is the map the SQL generator iterates. A section with no
    // entry would silently vanish from the tab, and a stale entry would name a
    // module the section no longer uses.
    expect(Object.keys(SECTION_MODULE).sort()).toEqual(
      Object.keys(PROFILE_SECTION_CONFIG).sort(),
    );
  });

  it("maps each section to the module that actually owns its model", () => {
    for (const [section, moduleKey] of Object.entries(SECTION_MODULE)) {
      const config = ENTITY_CONFIG[moduleKey as keyof typeof ENTITY_CONFIG];
      expect(config, section).toBeDefined();
      expect(config.model, section).toBe(
        PROFILE_SECTION_CONFIG[section as keyof typeof PROFILE_SECTION_CONFIG].model,
      );
    }
  });

  it("agrees with PROFILE_SECTION_CONFIG on every bookmark table", () => {
    for (const [section, moduleKey] of Object.entries(SECTION_MODULE)) {
      expect(ENTITY_CONFIG[moduleKey as keyof typeof ENTITY_CONFIG].bookmarkModel, section).toBe(
        PROFILE_SECTION_CONFIG[section as keyof typeof PROFILE_SECTION_CONFIG].bookmarkModel,
      );
    }
  });
});

describe("raw SQL identifiers resolve against the live schema", () => {
  it.each(PROFILE_SECTION_KEYS)("%s: parent table has the filtered columns", (section) => {
    const config = ENTITY_CONFIG[SECTION_MODULE[section]];
    const columns = scalars(pascal(config.model));
    expect(columns, section).toContain("id");
    expect(columns, section).toContain("authorId");
    expect(columns, section).toContain("createdAt");
    expect(columns, section).toContain("isDeleted");
  });

  it.each(PROFILE_SECTION_KEYS)("%s: vote table has the FK and viewer columns", (section) => {
    const config = ENTITY_CONFIG[SECTION_MODULE[section]];
    const columns = scalars(pascal(config.voteModel));
    expect(columns, section).toContain(config.parentFk);
    expect(columns, section).toContain("userId");
    expect(columns, section).toContain("voteType");
  });

  it.each(PROFILE_SECTION_KEYS)("%s: bookmark table has the FK, viewer and id", (section) => {
    const config = ENTITY_CONFIG[SECTION_MODULE[section]];
    const columns = scalars(pascal(config.bookmarkModel));
    expect(columns, section).toContain(config.parentFk);
    expect(columns, section).toContain("userId");
    // `id` is what the viewer's bookmark state is keyed by, and `createdAt`
    // drives the ordering the tab pages through.
    expect(columns, section).toContain("id");
    expect(columns, section).toContain("createdAt");
  });

  it.each(PROFILE_SECTION_KEYS)("%s: bookmark parent is the section's own table", (section) => {
    const config = ENTITY_CONFIG[SECTION_MODULE[section]];
    expect(
      pascal(
        PROFILE_SECTION_CONFIG[section as keyof typeof PROFILE_SECTION_CONFIG]
          .bookmarkParent,
      ),
      section,
    ).toBe(pascal(config.model));
  });
});

describe("generated statements are injection-safe", () => {
  // A distinctive value that must never survive as SQL text: if it shows up in
  // the statement body, some request value is being interpolated.
  const HOSTILE = "x'; DROP TABLE \"Article\"; --";

  it.each([
    ["content", buildContentSectionsSql],
    ["bookmarks", buildBookmarkSectionsSql],
  ] as const)("%s: never interpolates the profile id", (_label, build) => {
    const { sql } = build(HOSTILE, 1);
    expect(sql).not.toContain(HOSTILE);
  });

  it.each([
    ["content", buildContentSectionsSql],
    ["bookmarks", buildBookmarkSectionsSql],
  ] as const)("%s: binds the hostile values as parameters", (_label, build) => {
    const { values } = build(HOSTILE, 1);
    expect(values).toContain(HOSTILE);
  });

  it.each([
    ["content", buildContentSectionsSql],
    ["bookmarks", buildBookmarkSectionsSql],
  ] as const)("%s: carries no viewer state at all", (_label, build) => {
    // The cached half of the tab must be shareable by every visitor, so it
    // cannot resolve "did the viewer vote / bookmark / follow". If any of these
    // reappear, one visitor's state would be baked into an entry served to
    // everyone else — the identity leak the Tri-Split refactor removed.
    const { sql } = build("profile", 1);
    expect(sql).not.toContain("Follows");
    expect(sql).not.toContain("followerId");
    expect(sql).not.toContain("'votes'");
    expect(sql).not.toContain("'bookmarks'");
    // The bookmark table is still scanned — it is the tab's subject — but only
    // as the owner filter, never as the viewer's own bookmark relation.
    expect(sql).not.toContain('b."userId" = CAST(');
  });

  it.each([
    ["content", buildContentSectionsSql],
    ["bookmarks", buildBookmarkSectionsSql],
  ] as const)("%s: clamps a hostile page size to an integer literal", (_label, build) => {
    // `take` is the one value inlined as SQL, so the clamp is the whole
    // security argument for it. The two builders express the bound
    // differently — `LIMIT n` vs `WHERE _rn <= n` — so accept either.
    for (const [input, expected] of [
      ["5; DROP TABLE \"Article\"", 0],
      [-1, 0],
      [1.9, 1],
      [1e9, 100],
      [Number.NaN, 0],
    ] as const) {
      const { sql } = build("p", input as number);
      expect(sql, `take=${input}`).toMatch(
        new RegExp(`(LIMIT |_rn" <= )${expected}\\b`),
      );
      expect(sql).not.toContain("DROP TABLE");
    }
  });
});

describe("the live overlay statement", () => {
  const HOSTILE = "x'; DROP TABLE \"Article\"; --";

  const rowIds = Object.fromEntries(
    PROFILE_SECTION_KEYS.map((section) => [section, ["row-a", "row-b"]]),
  ) as Record<(typeof PROFILE_SECTION_KEYS)[number], string[]>;

  it("never interpolates the viewer id or a row id", () => {
    const { sql, values } = buildSectionsOverlaySql(
      rowIds,
      ["author-a", "author-b"],
      HOSTILE,
    );
    expect(sql).not.toContain(HOSTILE);
    // Row and author ids are bound, so a hostile one arrives as a parameter.
    expect(values).toContain(HOSTILE);
    expect(values).toContain("row-a");
    expect(values).toContain("author-b");
  });

  it("emits a branch only for sections that have rows on the page", () => {
    // A tab page is `take: 1` per section, so most sections carry no row at
    // all. Those must cost nothing — no branch, no bound ids.
    const sparse = { ...rowIds } as Record<string, string[]>;
    for (const section of PROFILE_SECTION_KEYS) sparse[section] = [];
    sparse.articles = ["row-a"];

    const { values } = buildSectionsOverlaySql(
      sparse as Parameters<typeof buildSectionsOverlaySql>[0],
      ["author-a"],
      "viewer",
    );

    // `articles` binds its key twice (vote branch + bookmark branch) and every
    // other section binds its key zero times.
    expect(values.filter((v) => v === "articles")).toHaveLength(2);
    for (const section of PROFILE_SECTION_KEYS) {
      if (section === "articles") continue;
      expect(values, section).not.toContain(section);
    }
  });

  it("resolves follow state against the authors actually on the page", () => {
    const { sql } = buildSectionsOverlaySql(rowIds, ["author-a"], "viewer");
    expect(sql).toContain('FROM "Follows" f');
    expect(sql).toContain('f."followerId" = ');
  });
});

describe("generated statements cover every section exactly once", () => {
  it.each([
    ["content", buildContentSectionsSql],
    ["bookmarks", buildBookmarkSectionsSql],
  ] as const)("%s: emits one branch per section", (_label, build) => {
    const { sql, values } = build("p", 1);
    // Each branch binds its section key once, so counting the bound section
    // keys counts the branches.
    for (const section of PROFILE_SECTION_KEYS) {
      const branches = values.filter((v) => v === section).length;
      expect(branches, section).toBe(1);
    }
    expect(sql).toContain("UNION ALL");
  });

  it("content branches never compute a section total", () => {
    // The content tab reads the materialized `User` counters; adding a
    // `count(*) OVER ()` here would turn a bounded index seek into a full scan
    // of every post the scholar has ever written.
    expect(buildContentSectionsSql("p", 1).sql).not.toContain("count(*) OVER");
  });

  it("bookmark branches compute the total before the page limit", () => {
    const { sql } = buildBookmarkSectionsSql("p", 1);
    expect(sql).toContain("count(*) OVER ()");
    // If the window were computed after the limit, `total` would be the page
    // size and the carousel would think every section was exhausted.
    expect(sql.indexOf("count(*) OVER ()")).toBeLessThan(
      sql.indexOf(`WHERE x."_rn" <=`),
    );
  });
});

describe("section visibility rules are preserved", () => {
  it("hides anonymous recommendations and reviews from the content tab", () => {
    const { sql } = buildContentSectionsSql("p", 1);
    expect(sql).toContain(`AND t."isAnonymous" = false`);
    expect(sql.match(/isAnonymous/g)?.length).toBe(2);
  });

  it("still shows a scholar their own bookmarked anonymous rows", () => {
    // The bookmark tab must not filter `isAnonymous`, or bookmarking an
    // anonymous recommendation would make it vanish.
    const { sql } = buildBookmarkSectionsSql("p", 1);
    expect(sql).not.toContain("isAnonymous");
  });

  it("keeps unapproved contributions out of both tabs", () => {
    expect(buildContentSectionsSql("p", 1).sql).toContain(
      `AND t."status" = 'APPROVED'`,
    );
    expect(buildBookmarkSectionsSql("p", 1).sql).toContain(
      `AND p."status" = 'APPROVED'`,
    );
  });
});

describe("reviveSectionDates", () => {
  const section = "articles";

  const payload = (createdAt: unknown) =>
    ({
      [section]: [
        {
          id: "a1",
          title: "A row",
          // What `to_jsonb` produces before revival, and what a cache hit
          // produces again after `JSON.stringify`.
          createdAt,
          updatedAt: "2026-01-02T00:00:00.000Z",
          author: {
            id: "u-1",
            name: "A Scholar",
            createdAt: "2026-01-01T00:00:00.000Z",
            institutionVerifiedAt: null,
          },
        },
      ],
      socialPosts: [],
    }) as unknown as Parameters<typeof reviveSectionDates>[0];

  it("turns ISO strings back into Date objects", () => {
    const revived = reviveSectionDates(
      payload("2026-01-01T00:00:00.000Z"),
    ) as unknown as Record<string, { createdAt: unknown }[]>;

    expect(revived[section][0].createdAt).toBeInstanceOf(Date);
    expect(
      (revived[section][0].createdAt as Date).toISOString(),
    ).toBe("2026-01-01T00:00:00.000Z");
  });

  it("revives the nested author block too", () => {
    // The author is part of the cached payload, so its dates come back as
    // strings on a cache hit exactly like the row's own do.
    const revived = reviveSectionDates(
      payload("2026-01-01T00:00:00.000Z"),
    ) as unknown as Record<string, { author: { createdAt: unknown } }[]>;

    expect(revived[section][0].author.createdAt).toBeInstanceOf(Date);
  });

  it("is idempotent, so the two revival points cannot conflict", () => {
    // Revival happens twice per read — once out of the `to_jsonb` statement and
    // once out of the cache. Both are string -> Date, so running it again on an
    // already-revived payload must be a no-op rather than a crash.
    const once = reviveSectionDates(payload("2026-01-01T00:00:00.000Z"));
    expect(() => reviveSectionDates(once)).not.toThrow();

    const twice = reviveSectionDates(
      reviveSectionDates(payload("2026-01-01T00:00:00.000Z")),
    ) as unknown as Record<string, { createdAt: unknown }[]>;
    expect(twice[section][0].createdAt).toBeInstanceOf(Date);
  });

  it("leaves a null date null", () => {
    const revived = reviveSectionDates(payload(null)) as unknown as Record<
      string,
      Array<{ createdAt: unknown }>
    >;
    expect(revived[section][0].createdAt).toBeNull();
  });

  it("tolerates a row with no author block", () => {
    const orphaned = {
      [section]: [{ id: "a2", createdAt: "2026-01-01T00:00:00.000Z" }],
      socialPosts: [],
    } as unknown as Parameters<typeof reviveSectionDates>[0];
    expect(() => reviveSectionDates(orphaned)).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────
// The viewer-state fold itself.
//
// This had NO direct coverage: the rest of this file pins the generated SQL,
// the visibility rules and the date revival, while `tri-split/profile-tab`
// *mocks* `applySectionsOverlay` away. So the one function that decides whether
// a cached profile row may be trusted with vote / bookmark / follow state was
// entirely untested.
//
// It also used to re-implement the fold inline ("Mirrors `stitchLiveState`"),
// which meant a fix in the list path never reached the profile tabs. These
// tests pin the shared contract so that cannot regress.
// ─────────────────────────────────────────────────────────────

const emptyPayload = (): ProfileSectionsPayload => {
  const out = {} as ProfileSectionsPayload;
  for (const key of PROFILE_SECTION_KEYS) (out as Record<string, unknown[]>)[key] = [];
  return out;
};

const row = (
  id: string,
  authorId: string | null = "author-1",
): ProfileSectionRow => ({
  id,
  authorId,
  title: `title-${id}`,
  author: { id: authorId ?? "", name: "Scholar", handle: "scholar" },
});

/**
 * A payload holding `rows` in one section and nothing elsewhere.
 *
 * The cast is deliberate: `ProfileSectionsPayload` pins each section to its
 * exact Prisma payload type, and these fixtures deliberately carry only the
 * fields this test cares about. What is being asserted is the FOLD's contract
 * (identity state never comes from the cached half), not each section's column
 * list — that is already pinned against the live DMMF earlier in this file.
 */
const payloadWith = (
  section: string,
  rows: ProfileSectionRow[],
): ProfileSectionsPayload => {
  const out = emptyPayload();
  (out as unknown as Record<string, ProfileSectionRow[]>)[section] = rows;
  return out;
};

const overlayOf = (
  partial: Partial<ProfileSectionsOverlay> = {},
): ProfileSectionsOverlay => ({
  votes: new Map(),
  bookmarks: new Map(),
  following: new Set(),
  ...partial,
});

describe("applySectionsOverlay", () => {
  it("overlays a vote and a bookmark onto the right row only", () => {
    const sections = payloadWith("articles", [row("a1"), row("a2")]);
    const overlay = overlayOf({
      votes: new Map([["articles", new Map([["a2", "UPVOTE"]])]]),
      bookmarks: new Map([["articles", new Map([["a1", "bm-1"]])]]),
    });

    const [first, second] = applySectionsOverlay(
      sections,
      overlay,
      "viewer-1",
    ).articles;

    expect(first.votes).toEqual([]);
    expect(first.bookmarks).toEqual([{ id: "bm-1" }]);
    expect(second.votes).toEqual([{ voteType: "UPVOTE" }]);
    expect(second.bookmarks).toEqual([]);
  });

  it("emits empty arrays, never undefined, for a signed-out viewer", () => {
    // RULE 1: cards render `row.bookmarks.length`, so a missing key would throw
    // at render time on every anonymous profile view.
    //
    // The signed-out guarantee is upstream of the fold: `getLiveOverlay` returns
    // counters only when `viewerId` is null (the `!viewerId` branch in
    // tri-split/overlay.ts), so an anonymous viewer's overlay is empty by
    // construction. Assert that real shape rather than a null viewer alongside
    // a populated overlay, which the database can never produce.
    const sections = payloadWith("articles", [row("a1")]);

    const [only] = applySectionsOverlay(sections, overlayOf(), null).articles;
    expect(only.votes).toEqual([]);
    expect(only.bookmarks).toEqual([]);
    expect((only.author as { followers: unknown[] }).followers).toEqual([]);
  });

  it("never lets a stale cached row supply identity-bearing state", () => {
    // The cached half is shared by every visitor, so it must never contain a
    // vote/bookmark/follower even if one somehow got in there.
    const sections = payloadWith("articles", [
      {
        ...row("a1"),
        votes: [{ voteType: "DOWNVOTE" }],
        bookmarks: [{ id: "stale-bm" }],
        author: { id: "author-1", followers: [{ followerId: "someone" }] },
      },
    ]);

    const [only] = applySectionsOverlay(
      sections,
      overlayOf(),
      "viewer-1",
    ).articles;
    expect(only.votes).toEqual([]);
    expect(only.bookmarks).toEqual([]);
    expect((only.author as { followers: unknown[] }).followers).toEqual([]);
  });

  it("resolves follow state against the row's own author", () => {
    const sections = payloadWith("articles", [
      row("a1", "author-1"),
      row("a2", "author-2"),
    ]);
    const overlay = overlayOf({ following: new Set(["author-2"]) });

    const [first, second] = applySectionsOverlay(
      sections,
      overlay,
      "viewer-1",
    ).articles;
    expect((first.author as { followers: unknown[] }).followers).toEqual([]);
    expect((second.author as { followers: unknown[] }).followers).toEqual([
      { followerId: "viewer-1" },
    ]);
  });

  it("does not mutate the cached rows it is given", () => {
    const cached = row("a1");
    const sections = payloadWith("articles", [cached]);
    const overlay = overlayOf({
      votes: new Map([["articles", new Map([["a1", "UPVOTE"]])]]),
      following: new Set(["author-1"]),
    });

    applySectionsOverlay(sections, overlay, "viewer-1");
    expect(cached.votes).toBeUndefined();
    expect(cached.bookmarks).toBeUndefined();
    expect(
      Object.prototype.hasOwnProperty.call(cached.author, "followers"),
    ).toBe(false);
  });

  it("returns an empty row list for every section when there are no rows", () => {
    const out = applySectionsOverlay(emptyPayload(), overlayOf(), "viewer-1");
    for (const key of PROFILE_SECTION_KEYS) expect(out[key]).toEqual([]);
  });
});
