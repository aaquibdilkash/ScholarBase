/**
 * Scholar-profile content and bookmark sections, one statement per tab.
 *
 * Why raw SQL: the production pool is `max: 1` (see `lib/db.ts`), so the 18
 * (content) and 34 (bookmarks) Prisma round trips these tabs used to cost ran
 * strictly one after another — `Promise.all` bought nothing. A single
 * `UNION ALL` over the section tables collapses each tab to one trip, and the
 * bookmark tab folds its 17 separate `count()` calls into the same scan with
 * `count(*) OVER ()`.
 *
 * The content tab keeps its `LIMIT`-only shape (no window function) so a
 * prolific scholar's first item costs an index seek, not a full scan.
 *
 * Every statement here is VIEWER-AGNOSTIC. The viewer's vote, bookmark and
 * follow state is resolved separately by `fetchProfileSectionsOverlay`, in one
 * statement, and folded in by the pure `applySectionsOverlay`. That split is
 * what lets `tri-split/modules/profile-tab` cache the row half: a payload with
 * no identity in it is shareable by every visitor of a profile, and the state
 * that must never be stale still costs one query per page load.
 *
 * Why it is safe: every table and column name is interpolated as an identifier
 * and comes from `ENTITY_CONFIG` / `PROFILE_SECTION_CONFIG` (compile-time
 * literals) or from `Prisma.dmmf` — never from a request. Request values are
 * bound as parameters, except `take`, which is clamped to an integer literal
 * first. `test/profile-sections.test.ts` re-checks all of this against the live
 * DMMF, so a schema change cannot leave a stale table or FK name behind.
 *
 * The `total` the bookmarks branch returns is a per-user bookmark count, which
 * has no materialized counter to read; the content tab keeps reading the
 * materialized `User` counters so the numbers on screen do not shift.
 */
import { Prisma, VoteType } from "@prisma/client";

import prisma from "@/lib/db";
import type { ProfileSection } from "@/lib/module-registry";
import { dateKeysForModel } from "@/lib/tri-split/dates";
import { ENTITY_CONFIG, type ModuleKey } from "@/lib/transactions";

/** Section key -> `ENTITY_CONFIG` module. Checked for completeness by a test. */
const SECTION_MODULE = {
  articles: "ARTICLE",
  socialPosts: "SOCIAL_POST",
  vacancies: "JOB_VACANCY",
  admissions: "PHD_ADMISSION",
  events: "RESEARCH_EVENT",
  helpPosts: "HELP_POST",
  journals: "JOURNAL",
  researchTools: "RESEARCH_TOOL",
  recommendations: "RECOMMENDATION",
  journalReviews: "JOURNAL_REVIEW",
  supervisors: "SUPERVISOR",
  results: "RESULT",
  contributionPosts: "CONTRIBUTION",
  publications: "PUBLICATION",
  surveys: "RESEARCH_SURVEY",
  researchGrants: "RESEARCH_GRANT",
  courses: "COURSE",
} as const satisfies Record<ProfileSection, ModuleKey>;

export type Section = keyof typeof SECTION_MODULE;

const SECTIONS = Object.keys(SECTION_MODULE) as Section[];

/**
 * Soft-delete is the only universal content filter. These are the two modules
 * that additionally hide anonymous rows, plus the one gated on approval —
 * mirroring `getProfileParentWhere` in `app/actions/profile.ts`.
 */
const CONTENT_FILTER: Partial<Record<Section, string>> = {
  recommendations: `AND t."isAnonymous" = false`,
  journalReviews: `AND t."isAnonymous" = false`,
  contributionPosts: `AND t."status" = 'APPROVED'`,
};

/**
 * Applied to the bookmark tab too: an unapproved contribution is not something
 * to show, but an anonymous one is — the viewer bookmarked it themselves.
 */
const BOOKMARK_FILTER: Partial<Record<Section, string>> = {
  contributionPosts: `AND p."status" = 'APPROVED'`,
};

/** Nested `include`s beyond `author` / `votes` / `bookmarks`. */
const EXTRA_INCLUDE: Partial<
  Record<
    Section,
    { key: string; table: string; fk: string; columns: string[] }
  >
> = {
  recommendations: {
    key: "supervisor",
    table: "Supervisor",
    fk: "supervisorId",
    columns: ["id", "name"],
  },
  journalReviews: {
    key: "journal",
    table: "Journal",
    fk: "journalId",
    columns: ["id", "title"],
  },
};

/** The author projection, identical for every section. */
const AUTHOR_COLUMNS = [
  "id",
  "name",
  "handle",
  "avatarUrl",
  "institutionVerifiedAt",
  "createdAt",
  "email",
  "bio",
] as const;

const AUTHOR_DATE_KEYS = ["institutionVerifiedAt", "createdAt"] as const;
/** Quotes a SQL identifier. Names originate from static config, never input. */
const ident = (name: string) => `"${name}"`;

/** `jsonb_build_object` for a fixed column list, e.g. `jsonb_build_object('id', u."id", ...)`. */
const jsonColumns = (alias: string, columns: readonly string[]) =>
  `jsonb_build_object(${columns.map((c) => `'${c}', ${alias}.${ident(c)}`).join(", ")})`;

/**
 * Clamps a caller-supplied page size into a safe integer literal.
 *
 * This is the one value interpolated as raw SQL rather than bound, because
 * `LIMIT` as a bound parameter round-trips poorly through some drivers. The
 * clamp is what makes it safe: the result is always a bare integer.
 */
const limitLiteral = (take: number) => {
  const safe = Math.floor(Number(take));
  if (!Number.isFinite(safe)) return Prisma.raw("0");
  return Prisma.raw(String(Math.max(0, Math.min(100, safe))));
};

/** The author, minus the viewer's follow state, which arrives in the overlay. */
function authorJson(authorIdExpr: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`(
    SELECT ${Prisma.raw(jsonColumns("u", AUTHOR_COLUMNS))}
    FROM "User" u
    WHERE u."id" = ${authorIdExpr}
  )`;
}

/** The author block plus the optional extra relation, layered onto a row's json. */
function nestedJson(section: Section, rowAlias: string): Prisma.Sql {
  const extra = EXTRA_INCLUDE[section];
  let extraSql = Prisma.empty;
  if (extra) {
    const alias = uncapitalize(extra.table);
    extraSql = Prisma.sql`, ${Prisma.raw(`'${extra.key}'`)}, (
        SELECT ${Prisma.raw(jsonColumns(alias, extra.columns))}
        FROM ${Prisma.raw(ident(extra.table))} ${Prisma.raw(alias)}
        WHERE ${Prisma.raw(alias)}.${Prisma.raw(ident("id"))} = ${Prisma.raw(rowAlias)}.${Prisma.raw(ident(extra.fk))}
      )`;
  }

  return Prisma.sql`jsonb_build_object(
    'author', ${authorJson(Prisma.raw(`${rowAlias}."authorId"`))}
    ${extraSql}
  )`;
}

/** PascalCase table name for a Prisma model key, e.g. `socialPost` -> `SocialPost`. */
const pascal = (model: string) =>
  model.charAt(0).toUpperCase() + model.slice(1);

/** Inverse of {@link pascal}, for a relation alias. */
const uncapitalize = (name: string) =>
  name.charAt(0).toLowerCase() + name.slice(1);

/**
 * Content-tab statement: the first `take` rows of every section table.
 *
 * No window function, so each branch is a bounded index scan that stops at
 * `LIMIT` — a scholar with thousands of articles costs the same as one with a
 * handful. The section totals are *not* read here; the caller uses the
 * materialized `User` counters instead.
 *
 * Viewer-agnostic by construction: the statement takes no viewer id, which is
 * what makes the result shareable across every visitor of this profile. The
 * viewer's vote / bookmark / follow state is added afterwards by
 * {@link fetchProfileSectionsOverlay}.
 */
export function buildContentSectionsSql(
  profileId: string,
  take: number,
): Prisma.Sql {
  const limit = limitLiteral(take);

  const branches = SECTIONS.map((section) => {
    const config = ENTITY_CONFIG[SECTION_MODULE[section]];
    const table = pascal(config.model);
    const filter = CONTENT_FILTER[section];

    return Prisma.sql`
      SELECT
        ${section}::text AS "section",
        COALESCE(
          json_agg(
            (to_jsonb(x) - '_rn') || ${nestedJson(section, "x")}
            ORDER BY x."_rn"
          ),
          '[]'::json
        ) AS "payload"
      FROM (
        SELECT t.*, row_number() OVER (ORDER BY t."createdAt" DESC, t."id" DESC) AS "_rn"
        FROM ${Prisma.raw(ident(table))} t
        WHERE t."authorId" = ${profileId}
          AND t."isDeleted" = false
        ${filter ? Prisma.raw(filter) : Prisma.empty}
        ORDER BY t."createdAt" DESC, t."id" DESC
        LIMIT ${limit}
      ) x`;
  });

  return Prisma.join(branches, "\n    UNION ALL\n    ");
}

/**
 * Bookmark-tab statement: the first `take` bookmarked rows of every section,
 * plus each section's true total for the viewer's own bookmarks.
 *
 * `count(*) OVER ()` runs before the outer `WHERE`, so `total` is the whole
 * match count rather than the page size. The scan it forces is the same one the
 * 17 separate `count()` calls used to make — it just happens in one trip now.
 *
 * `ownerId` is the session user, resolved by the caller, and the viewer state
 * is overlaid separately for the same reason as the content tab.
 */
export function buildBookmarkSectionsSql(
  ownerId: string,
  take: number,
): Prisma.Sql {
  const limit = limitLiteral(take);

  const branches = SECTIONS.map((section) => {
    const config = ENTITY_CONFIG[SECTION_MODULE[section]];
    const table = pascal(config.model);
    const bookmarkTable = pascal(config.bookmarkModel);
    const fk = ident(config.parentFk);
    const filter = BOOKMARK_FILTER[section];

    return Prisma.sql`
      SELECT
        ${section}::text AS "section",
        COALESCE(MAX(x."_total"), 0)::int AS "total",
        COALESCE(
          json_agg(
            (to_jsonb(x) - '_rn' - '_total') || ${nestedJson(section, "x")}
            ORDER BY x."_rn"
          ),
          '[]'::json
        ) AS "payload"
      FROM (
        SELECT p.*,
               row_number() OVER (ORDER BY b."createdAt" DESC, b."id" DESC) AS "_rn",
               count(*) OVER () AS "_total"
        FROM ${Prisma.raw(ident(bookmarkTable))} b
        JOIN ${Prisma.raw(ident(table))} p ON p."id" = b.${Prisma.raw(fk)}
        WHERE b."userId" = ${ownerId}
          AND p."isDeleted" = false
        ${filter ? Prisma.raw(filter) : Prisma.empty}
      ) x
      WHERE x."_rn" <= ${limit}`;
  });

  return Prisma.join(branches, "\n    UNION ALL\n    ");
}

/**
 * The live half: the viewer's state for exactly the rows a tab just returned.
 *
 * Same reasoning as `getLiveOverlay` in the Tri-Split, adapted to a tab whose
 * rows span 17 tables: one statement resolves every section at once, because
 * the production pool is `max: 1` and 17 separate round trips would execute
 * strictly one after another.
 *
 * Sections with no rows on this page emit no branch at all, so the statement
 * costs one index seek per section that actually has a row — and nothing for
 * the other sixteen.
 */
export function buildSectionsOverlaySql(
  rowIds: SectionRowIds,
  authorIds: string[],
  viewerId: string,
): Prisma.Sql {
  const populated = SECTIONS.filter((section) => (rowIds[section]?.length ?? 0) > 0);

  const voteBranches = populated.map((section) => {
    const config = ENTITY_CONFIG[SECTION_MODULE[section]];
    return Prisma.sql`SELECT ${section}::text AS "section",
        v.${Prisma.raw(ident(config.parentFk))} AS "rowId", v."voteType"
      FROM ${Prisma.raw(ident(pascal(config.voteModel)))} v
      WHERE v."userId" = ${viewerId}
        AND v.${Prisma.raw(ident(config.parentFk))} IN (${Prisma.join(rowIds[section])})`;
  });

  const bookmarkBranches = populated.map((section) => {
    const config = ENTITY_CONFIG[SECTION_MODULE[section]];
    return Prisma.sql`SELECT ${section}::text AS "section",
        b.${Prisma.raw(ident(config.parentFk))} AS "rowId", b."id"
      FROM ${Prisma.raw(ident(pascal(config.bookmarkModel)))} b
      WHERE b."userId" = ${viewerId}
        AND b.${Prisma.raw(ident(config.parentFk))} IN (${Prisma.join(rowIds[section])})`;
  });

  const votesSql = voteBranches.length
    ? Prisma.sql`COALESCE(
        (SELECT json_agg(t) FROM (${Prisma.join(voteBranches, "\n          UNION ALL\n          ")}) t),
        '[]'::json
      ) AS "votes"`
    : Prisma.sql`'[]'::json AS "votes"`;

  const bookmarksSql = bookmarkBranches.length
    ? Prisma.sql`COALESCE(
        (SELECT json_agg(t) FROM (${Prisma.join(bookmarkBranches, "\n          UNION ALL\n          ")}) t),
        '[]'::json
      ) AS "bookmarks"`
    : Prisma.sql`'[]'::json AS "bookmarks"`;

  // The bookmark tab lists other people's posts, so follow state is per author
  // and resolved against the distinct author ids on this page. The content tab
  // has a single author, which collapses to a one-element list.
  const followingSql =
    authorIds.length > 0
      ? Prisma.sql`COALESCE(
          (SELECT json_agg(f."followingId") FROM "Follows" f
            WHERE f."followerId" = ${viewerId}
              AND f."followingId" IN (${Prisma.join(authorIds)})),
          '[]'::json
        ) AS "following"`
      : Prisma.sql`'[]'::json AS "following"`;

  return Prisma.sql`SELECT ${votesSql}, ${bookmarksSql}, ${followingSql}`;
}

// ─────────────────────────────────────────────────────────────
// Rehydration: `to_jsonb` yields ISO strings, Prisma yields `Date`.
// Derived from the DMMF so it cannot drift from the schema, and so
// nothing downstream can tell the two shapes apart.
// ─────────────────────────────────────────────────────────────

function reviveDates(
  row: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string") row[key] = new Date(value);
  }
  return row;
}

function rehydrateSection(section: Section, row: Record<string, unknown>) {
  const config = ENTITY_CONFIG[SECTION_MODULE[section]];
  reviveDates(row, dateKeysForModel(config.model));

  const author = row.author;
  if (author && typeof author === "object") {
    reviveDates(author as Record<string, unknown>, AUTHOR_DATE_KEYS);
  }
  return row;
}

/**
 * Revives every `Date` in a section payload, in place.
 *
 * Needed TWICE per read, and the reason is worth stating because it is easy to
 * get wrong:
 *
 *  1. `to_jsonb` in the statement turns `DateTime` columns into ISO strings, so
 *     the raw query result has to be revived before it is typed.
 *  2. `unstable_cache` persists via `JSON.stringify`, so a *cache hit* hands
 *     back ISO strings again — for a path that never touched Prisma.
 *
 * Both are string -> `Date`, so calling it twice is idempotent. Without the
 * second call the Content tab would render ISO strings for `createdAt` on every
 * warm read and only produce `Date`s on a cold one, which is the kind of bug
 * that never shows up in local development where the cache is always cold.
 */
export function reviveSectionDates(
  sections: ProfileSectionsPayload,
): ProfileSectionsPayload {
  for (const section of SECTIONS) {
    for (const row of sections[section] ?? []) rehydrateSection(section, row);
  }
  return sections;
}

export type ProfileSectionRow = Record<string, unknown>;

/**
 * The per-section row types, spelled out.
 *
 * These tabs render 17 different card components, and `SectionData` in
 * `types/components.ts` is derived from this module's return type, so each
 * section key has to keep its concrete Prisma payload type. The query returns
 * JSON; this is the contract that JSON is asserted against at the single place
 * it crosses into typed code, and it is kept in lockstep with the `include`
 * the raw SQL builds by `test/profile-sections.test.ts`.
 *
 * `followers` is typed as an array even for signed-out visitors, where the
 * statement yields `[]` rather than omitting the relation — both read as falsy.
 */
type ViewerInclude = {
  author: {
    select: {
      id: true;
      name: true;
      handle: true;
      avatarUrl: true;
      institutionVerifiedAt: true;
      createdAt: true;
      email: true;
      bio: true;
      followers: { where: { followerId: string }; select: { followerId: true } };
    };
  };
  votes: {
    where: { userId: string };
    select: { userId: true; voteType: true };
  };
  bookmarks: { where: { userId: string }; select: { id: true } };
};

type SupervisorInclude = { supervisor: { select: { id: true; name: true } } };
type JournalInclude = { journal: { select: { id: true; title: true } } };

export type SectionPayloads = {
  articles: Prisma.ArticleGetPayload<{ include: ViewerInclude }>;
  socialPosts: Prisma.SocialPostGetPayload<{ include: ViewerInclude }>;
  vacancies: Prisma.JobVacancyGetPayload<{ include: ViewerInclude }>;
  admissions: Prisma.PhdAdmissionGetPayload<{ include: ViewerInclude }>;
  events: Prisma.ResearchEventGetPayload<{ include: ViewerInclude }>;
  helpPosts: Prisma.HelpPostGetPayload<{ include: ViewerInclude }>;
  journals: Prisma.JournalGetPayload<{ include: ViewerInclude }>;
  researchTools: Prisma.ResearchToolGetPayload<{ include: ViewerInclude }>;
  recommendations: Prisma.RecommendationGetPayload<{
    include: ViewerInclude & SupervisorInclude;
  }>;
  journalReviews: Prisma.JournalReviewGetPayload<{
    include: ViewerInclude & JournalInclude;
  }>;
  supervisors: Prisma.SupervisorGetPayload<{ include: ViewerInclude }>;
  results: Prisma.ResultGetPayload<{ include: ViewerInclude }>;
  contributionPosts: Prisma.ContributionGetPayload<{ include: ViewerInclude }>;
  publications: Prisma.PublicationGetPayload<{ include: ViewerInclude }>;
  surveys: Prisma.ResearchSurveyGetPayload<{ include: ViewerInclude }>;
  researchGrants: Prisma.ResearchGrantGetPayload<{ include: ViewerInclude }>;
  courses: Prisma.CourseGetPayload<{ include: ViewerInclude }>;
};

export type ProfileSectionsPayload = {
  [K in Section]: SectionPayloads[K][];
};

/** The rows one page returned, grouped by section, for the overlay statement. */
export type SectionRowIds = { [K in Section]: string[] };

export function emptySectionRowIds(): SectionRowIds {
  const out = {} as SectionRowIds;
  for (const section of SECTIONS) out[section] = [];
  return out;
}

type RawSectionRow = {
  section: string;
  total?: number;
  payload: unknown;
};

function parsePayload(value: unknown): ProfileSectionRow[] {
  if (!Array.isArray(value)) return [];
  return value as ProfileSectionRow[];
}

/** First `take` rows of every content section, keyed by section. */
export async function fetchContentSections(
  profileId: string,
  take: number,
): Promise<ProfileSectionsPayload> {
  const rows = await prisma.$queryRaw<RawSectionRow[]>(
    buildContentSectionsSql(profileId, take),
  );

  const out = {} as Record<Section, ProfileSectionRow[]>;
  for (const section of SECTIONS) out[section] = [];

  for (const row of rows) {
    const section = row.section as Section;
    if (!(section in out)) continue;
    out[section] = parsePayload(row.payload).map((item) =>
      rehydrateSection(section, item),
    );
  }
  return out as ProfileSectionsPayload;
}

export type BookmarkSections = {
  items: ProfileSectionsPayload;
  counts: Record<Section, number>;
};

/** First `take` bookmarked rows per section, plus each section's true total. */
export async function fetchBookmarkSections(
  ownerId: string,
  take: number,
): Promise<BookmarkSections> {
  const rows = await prisma.$queryRaw<RawSectionRow[]>(
    buildBookmarkSectionsSql(ownerId, take),
  );

  const items = {} as Record<Section, ProfileSectionRow[]>;
  const counts = {} as Record<Section, number>;
  for (const section of SECTIONS) {
    items[section] = [];
    counts[section] = 0;
  }

  for (const row of rows) {
    const section = row.section as Section;
    if (!(section in items)) continue;
    counts[section] = Number(row.total ?? 0);
    items[section] = parsePayload(row.payload).map((item) =>
      rehydrateSection(section, item),
    );
  }
  return { items: items as ProfileSectionsPayload, counts };
}

// ─────────────────────────────────────────────────────────────
// The live half: viewer state, never read from the cache.
// ─────────────────────────────────────────────────────────────

/** What one overlay statement returns, keyed by section for the fold. */
export type ProfileSectionsOverlay = {
  votes: Map<Section, Map<string, VoteType>>;
  bookmarks: Map<Section, Map<string, string>>;
  following: Set<string>;
};

export const EMPTY_SECTIONS_OVERLAY: ProfileSectionsOverlay = {
  votes: new Map(),
  bookmarks: new Map(),
  following: new Set(),
};

type RawOverlayRow = {
  votes: unknown;
  bookmarks: unknown;
  following: unknown;
};

const asArray = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? (value as Record<string, unknown>[]) : [];

/**
 * Resolves the viewer's votes, bookmarks and follows for one page of tab rows.
 *
 * Split out of the section statements precisely so the cached half carries no
 * identity: the cached payload is then shareable by every visitor, while the
 * state that must never be stale still costs exactly one statement.
 *
 * Returns {@link EMPTY_SECTIONS_OVERLAY} without querying when there is no
 * viewer or nothing on the page — an anonymous visitor cannot express any of
 * this state, so the statement would be pure waste.
 */
export async function fetchProfileSectionsOverlay(
  rowIds: SectionRowIds,
  authorIds: string[],
  viewerId: string | null,
): Promise<ProfileSectionsOverlay> {
  if (!viewerId) return EMPTY_SECTIONS_OVERLAY;
  if (authorIds.length === 0) return EMPTY_SECTIONS_OVERLAY;

  const rows = await prisma.$queryRaw<RawOverlayRow[]>(
    buildSectionsOverlaySql(rowIds, authorIds, viewerId),
  );

  const row = rows[0];
  if (!row) return EMPTY_SECTIONS_OVERLAY;

  const votes = new Map<Section, Map<string, VoteType>>();
  for (const entry of asArray(row.votes)) {
    const section = entry.section as Section;
    const voteType = entry.voteType;
    // Keep only known enum members, so schema drift can never put an
    // unrecognised value into the vote button's state.
    if (voteType !== VoteType.UPVOTE && voteType !== VoteType.DOWNVOTE) continue;
    if (!(section in rowIds)) continue;
    const forSection = votes.get(section) ?? new Map<string, VoteType>();
    forSection.set(String(entry.rowId), voteType);
    votes.set(section, forSection);
  }

  const bookmarks = new Map<Section, Map<string, string>>();
  for (const entry of asArray(row.bookmarks)) {
    const section = entry.section as Section;
    if (!(section in rowIds)) continue;
    const forSection = bookmarks.get(section) ?? new Map<string, string>();
    forSection.set(String(entry.rowId), String(entry.id));
    bookmarks.set(section, forSection);
  }

  return {
    votes,
    bookmarks,
    following: new Set(asArray(row.following).map(String)),
  };
}

/**
 * Folds viewer state into a page of section rows.
 *
 * Mirrors `stitchLiveState` for the Tri-Split lists: the cached half supplies
 * the rows, the overlay supplies everything identity-bearing, and a stale cache
 * can therefore never revert a vote, a bookmark or a follow button.
 *
 * Pure, so it is unit-testable without a database.
 */
export function applySectionsOverlay(
  sections: ProfileSectionsPayload,
  overlay: ProfileSectionsOverlay,
  viewerId: string | null,
): ProfileSectionsPayload {
  const out = {} as Record<Section, ProfileSectionRow[]>;

  for (const section of SECTIONS) {
    const votesByRow = overlay.votes.get(section);
    const bookmarksByRow = overlay.bookmarks.get(section);

    out[section] = (sections[section] ?? []).map((row) => {
      const id = String(row.id);
      const voteType = votesByRow?.get(id);
      const bookmarkId = bookmarksByRow?.get(id);
      const authorId = row.authorId;
      const isFollowing =
        viewerId != null &&
        typeof authorId === "string" &&
        overlay.following.has(authorId);

      return {
        ...row,
        votes: voteType ? [{ voteType }] : [],
        bookmarks: bookmarkId ? [{ id: bookmarkId }] : [],
        author: {
          ...(row.author as Record<string, unknown> | undefined),
          followers: isFollowing && viewerId != null
            ? [{ followerId: viewerId }]
            : [],
        },
      };
    });
  }

  return out as ProfileSectionsPayload;
}

/** The row ids on this page, grouped by section, for the overlay statement. */
export function collectSectionRowIds(
  sections: ProfileSectionsPayload,
): SectionRowIds {
  const out = emptySectionRowIds();
  for (const section of SECTIONS) {
    for (const row of sections[section] ?? []) out[section].push(String(row.id));
  }
  return out;
}

/** The distinct author ids across a page, for the overlay's follow lookup. */
export function collectSectionAuthorIds(
  sections: ProfileSectionsPayload,
): string[] {
  const ids = new Set<string>();
  for (const section of SECTIONS) {
    for (const row of sections[section] ?? []) {
      const authorId = row.authorId;
      if (typeof authorId === "string" && authorId) ids.add(authorId);
    }
  }
  return [...ids];
}

export { SECTIONS as PROFILE_SECTION_KEYS, SECTION_MODULE };
