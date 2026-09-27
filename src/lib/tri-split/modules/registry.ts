/**
 * Declarative wiring for every standard content module.
 *
 * Each entry declares only what is genuinely unique to that module: its cache
 * tag, its `where` (soft-delete plus any status gate), its viewer-agnostic
 * projection, and its free-text search fields. Table names, vote/bookmark
 * models and foreign keys are all derived from `ENTITY_CONFIG` by
 * `createContentList`, so they cannot drift from the write path.
 *
 * The configs are kept as plain data and the loaders are derived from them, so
 * a test can assert the contract across every module (unique tags, soft-delete
 * filters, no viewer state in any projection) without a database.
 *
 * The social feed lives in `./feed` rather than here because it has extra
 * behaviour (a viewer-scoped "following" tab, mention normalisation).
 */
import { ENTITY_CONFIG, type ModuleKey } from "@/lib/transactions";
import { revalidateTrending } from "@/lib/trending";

import { createContentList, CONTENT_COUNTER_KEYS, type ContentListArgs } from "../content";
import { revalidateProfileContent } from "./profile-tab";

/** The author projection every content card renders. */
const AUTHOR_SELECT = {
  id: true,
  name: true,
  handle: true,
  avatarUrl: true,
  institutionVerifiedAt: true,
} as const;

/** RULE 2: materialized counters and moderation flags, never relation counts. */
const COMMON_TAIL = {
  totalVotes: true,
  totalBookmarks: true,
  totalComments: true,
  isFrozen: true,
  hasActiveAppeal: true,
} as const;

const DATES = ["createdAt", "updatedAt", "editedAt"] as const;

/** Shorthand: author block appended to a projection. */
const AUTHOR = { select: AUTHOR_SELECT } as unknown as Record<string, unknown>;

/**
 * Per-module config, keyed by `ENTITY_CONFIG` module name.
 *
 * Exported so the contract test can assert across all 13 modules at once.
 */
export const CONTENT_LIST_CONFIGS = {
  HELP_POST: {
    module: "HELP_POST",
    // Which Trending tab lists this module, so one mutation purges both.
    trending: "helpPosts",
    tag: "help-public",
    where: { isDeleted: false },
    select: {
      id: true,
      title: true,
      subject: true,
      category: true,
      message: true,
      createdAt: true,
      updatedAt: true,
      editedAt: true,
      authorId: true,
      ...COMMON_TAIL,
      author: AUTHOR,
    } as unknown as Record<string, unknown>,
    searchFields: [
      { field: "title" },
      { field: "subject" },
      { field: "message" },
    ],
    dateKeys: DATES,
  },

  CONTRIBUTION: {
    module: "CONTRIBUTION",
    // Which Trending tab lists this module, so one mutation purges both.
    trending: "contributions",
    tag: "contributions-public",
    // Only approved contributions are public; the rest stay out of the feed.
    where: { isDeleted: false, status: "APPROVED" },
    select: {
      id: true,
      title: true,
      message: true,
      amount: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      editedAt: true,
      authorId: true,
      ...COMMON_TAIL,
      author: AUTHOR,
    } as unknown as Record<string, unknown>,
    searchFields: [{ field: "title" }, { field: "message" }],
    dateKeys: DATES,
  },

  PUBLICATION: {
    module: "PUBLICATION",
    // Which Trending tab lists this module, so one mutation purges both.
    trending: "publications",
    tag: "publications-public",
    where: { isDeleted: false },
    select: {
      id: true,
      title: true,
      authors: true,
      year: true,
      journalOrConference: true,
      publicationType: true,
      createdAt: true,
      updatedAt: true,
      editedAt: true,
      authorId: true,
      publicationAuthors: {
        select: {
          userId: true,
          authorOrder: true,
          user: { select: { id: true, name: true, handle: true } },
        },
        orderBy: { authorOrder: "asc" },
      },
      ...COMMON_TAIL,
      author: AUTHOR,
    } as unknown as Record<string, unknown>,
    searchFields: [
      { field: "title" },
      { field: "authors" },
      { field: "keywords" },
      { field: "domain" },
      { field: "journalOrConference" },
      { field: "abstract" },
    ],
    dateKeys: DATES,
  },
  RESEARCH_TOOL: {
    module: "RESEARCH_TOOL",
    // Which Trending tab lists this module, so one mutation purges both.
    trending: "researchTools",
    tag: "research-tools-public",
    where: { isDeleted: false },
    select: {
      id: true,
      name: true,
      website: true,
      use: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      editedAt: true,
      authorId: true,
      ...COMMON_TAIL,
      author: AUTHOR,
    } as unknown as Record<string, unknown>,
    searchFields: [
      { field: "name" },
      { field: "website" },
      { field: "use" },
      { field: "description" },
    ],
    dateKeys: DATES,
  },

  RESEARCH_GRANT: {
    module: "RESEARCH_GRANT",
    // Which Trending tab lists this module, so one mutation purges both.
    trending: "grants",
    tag: "research-grants-public",
    where: { isDeleted: false },
    select: {
      id: true,
      title: true,
      amount: true,
      description: true,
      applyLink: true,
      infoLink: true,
      createdAt: true,
      updatedAt: true,
      editedAt: true,
      authorId: true,
      ...COMMON_TAIL,
      author: AUTHOR,
    } as unknown as Record<string, unknown>,
    searchFields: [
      { field: "title" },
      { field: "amount" },
      { field: "description" },
      { field: "applyLink" },
      { field: "infoLink" },
    ],
    dateKeys: DATES,
  },

  COURSE: {
    module: "COURSE",
    // Which Trending tab lists this module, so one mutation purges both.
    trending: "courses",
    tag: "courses-public",
    where: { isDeleted: false },
    select: {
      id: true,
      title: true,
      provider: true,
      link: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      editedAt: true,
      authorId: true,
      ...COMMON_TAIL,
      author: AUTHOR,
    } as unknown as Record<string, unknown>,
    searchFields: [
      { field: "title" },
      { field: "provider" },
      { field: "instructor" },
      { field: "format" },
      { field: "level" },
      { field: "description" },
    ],
    dateKeys: DATES,
  },

  JOURNAL: {
    module: "JOURNAL",
    // Which Trending tab lists this module, so one mutation purges both.
    trending: "journals",
    tag: "journals-public",
    where: { isDeleted: false },
    // The card renders the average rating, so both aggregates ride the live
    // overlay: a posted/edited/deleted review is reflected on the next page
    // load without purging this shared batch for every visitor.
    counterKeys: [
      ...CONTENT_COUNTER_KEYS,
      "reviewCount",
      "ratingSum",
    ],
    // Zero-compute materialized aggregates (Rule 2): the count and the average
    // rating derive from these scalars, so no review rows are fetched. Kept in
    // the projection as the stitch's fallback when the overlay has no row.
    select: {
      id: true,
      title: true,
      publisher: true,
      impactFactor: true,
      website: true,
      createdAt: true,
      updatedAt: true,
      editedAt: true,
      reviewCount: true,
      ratingSum: true,
      authorId: true,
      ...COMMON_TAIL,
      author: AUTHOR,
    } as unknown as Record<string, unknown>,
    searchFields: [
      { field: "title" },
      { field: "publisher" },
      { field: "about" },
      { field: "issn" },
    ],
    dateKeys: DATES,
  },
  RESULT: {
    module: "RESULT",
    // Which Trending tab lists this module, so one mutation purges both.
    trending: "results",
    tag: "results-public",
    where: { isDeleted: false },
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      category: true,
      conductingBody: true,
      session: true,
      createdAt: true,
      updatedAt: true,
      editedAt: true,
      authorId: true,
      ...COMMON_TAIL,
      author: AUTHOR,
    } as unknown as Record<string, unknown>,
    searchFields: [
      { field: "title" },
      { field: "description" },
      { field: "category" },
      { field: "conductingBody" },
      { field: "session" },
    ],
    dateKeys: DATES,
  },

  RESEARCH_SURVEY: {
    module: "RESEARCH_SURVEY",
    // Which Trending tab lists this module, so one mutation purges both.
    trending: "surveys",
    tag: "surveys-public",
    where: { isDeleted: false },
    select: {
      id: true,
      title: true,
      description: true,
      privacy: true,
      shareData: true,
      status: true,
      isDeleted: true,
      // Survey-specific zero-compute aggregates.
      totalResponses: true,
      totalQuestions: true,
      totalBlocks: true,
      trendingScore: true,
      createdAt: true,
      updatedAt: true,
      editedAt: true,
      authorId: true,
      ...COMMON_TAIL,
      author: AUTHOR,
    } as unknown as Record<string, unknown>,
    searchFields: [{ field: "title" }, { field: "description" }],
    dateKeys: DATES,
  },

  RESEARCH_EVENT: {
    module: "RESEARCH_EVENT",
    // Which Trending tab lists this module, so one mutation purges both.
    trending: "events",
    tag: "events-public",
    where: { isDeleted: false },
    select: {
      id: true,
      title: true,
      date: true,
      location: true,
      deadline: true,
      description: true,
      notificationLink: true,
      applyLink: true,
      createdAt: true,
      updatedAt: true,
      editedAt: true,
      authorId: true,
      ...COMMON_TAIL,
      author: AUTHOR,
    } as unknown as Record<string, unknown>,
    searchFields: [
      { field: "title" },
      { field: "location" },
      { field: "description" },
    ],
    dateKeys: [...DATES, "date", "deadline"] as const,
  },

  PHD_ADMISSION: {
    module: "PHD_ADMISSION",
    // Which Trending tab lists this module, so one mutation purges both.
    trending: "admissions",
    tag: "admissions-public",
    where: { isDeleted: false },
    select: {
      id: true,
      university: true,
      department: true,
      deadline: true,
      description: true,
      notificationLink: true,
      applyLink: true,
      createdAt: true,
      updatedAt: true,
      editedAt: true,
      authorId: true,
      ...COMMON_TAIL,
      author: AUTHOR,
    } as unknown as Record<string, unknown>,
    searchFields: [
      { field: "university" },
      { field: "department" },
      { field: "description" },
    ],
    dateKeys: [...DATES, "deadline"] as const,
  },

  JOB_VACANCY: {
    module: "JOB_VACANCY",
    // Which Trending tab lists this module, so one mutation purges both.
    trending: "vacancies",
    tag: "vacancies-public",
    where: { isDeleted: false },
    select: {
      id: true,
      title: true,
      institution: true,
      deadline: true,
      description: true,
      notificationLink: true,
      applyLink: true,
      createdAt: true,
      updatedAt: true,
      editedAt: true,
      authorId: true,
      ...COMMON_TAIL,
      author: AUTHOR,
    } as unknown as Record<string, unknown>,
    searchFields: [
      { field: "title" },
      { field: "institution" },
      { field: "description" },
    ],
    dateKeys: [...DATES, "deadline"] as const,
  },

  SUPERVISOR: {
    module: "SUPERVISOR",
    // Which Trending tab lists this module, so one mutation purges both.
    trending: "supervisors",
    tag: "supervisors-public",
    where: { isDeleted: false },
    // Zero-compute materialized aggregates (RULE 2): the count and the average
    // rating derive from these scalars, so no recommendation rows are fetched.
    select: {
      id: true,
      name: true,
      university: true,
      department: true,
      recommendationCount: true,
      ratingSum: true,
      createdAt: true,
      updatedAt: true,
      editedAt: true,
      authorId: true,
      ...COMMON_TAIL,
      author: AUTHOR,
    } as unknown as Record<string, unknown>,
    searchFields: [{ field: "name" }],
    dateKeys: DATES,
  },
} as const;

/** Keys of the registry, i.e. the `ENTITY_CONFIG` modules it covers. */
export type ContentListKey = keyof typeof CONTENT_LIST_CONFIGS;

/** Every configured module, built from its declarative config. */
export const CONTENT_LISTS = Object.fromEntries(
  (Object.entries(CONTENT_LIST_CONFIGS) as [ContentListKey, ContentListArgs][]).map(
    ([key, config]) => [key, createContentList(config)],
  ),
) as Record<ContentListKey, ReturnType<typeof createContentList>>;

/** All configured module keys, in declaration order. */
export const CONTENT_LIST_KEYS = Object.keys(
  CONTENT_LIST_CONFIGS,
) as ContentListKey[];

/**
 * Loads one page for a standard content module, for the current viewer.
 * Takes no identity — the factory resolves it from the session.
 */
export function loadContentPage(
  key: ContentListKey,
  args: { query?: string; pageSize?: number; cursor?: string } = {},
): Promise<Record<string, unknown>[]> {
  return CONTENT_LISTS[key].fetchPage(args);
}

/**
 * Purges one module's cached pages. Call from its create/edit/delete paths.
 *
 * Also purges that module's Trending tab, and the Content and Activity tabs of
 * every profile named in `authorIds` — all three list exactly the rows this
 * mutation changed.
 *
 * `authorIds` is what makes the profile purge precise rather than global. A tag
 * is fixed per profile, so a publish has to say whose tab it dirtied; a call
 * site that cannot name the author purges only the module's own lists and
 * leaves the profile tab to the 5-minute TTL.
 */
export function revalidateContent(
  key: ContentListKey,
  ...authorIds: (string | null | undefined)[]
): void {
  CONTENT_LISTS[key].revalidate();
  revalidateTrending(CONTENT_LIST_CONFIGS[key].trending);
  revalidateProfileContent(...authorIds);
}

/** Re-exported so tests can cross-check a config key against the write path. */
export { ENTITY_CONFIG, type ModuleKey };
