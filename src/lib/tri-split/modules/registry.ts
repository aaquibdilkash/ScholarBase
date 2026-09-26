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

import { createContentList, type ContentListArgs } from "../content";

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
    tag: "journals-public",
    where: { isDeleted: false },
    select: {
      id: true,
      title: true,
      publisher: true,
      impactFactor: true,
      website: true,
      createdAt: true,
      updatedAt: true,
      editedAt: true,
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
    dateKeys: DATES,
  },

  PHD_ADMISSION: {
    module: "PHD_ADMISSION",
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
    dateKeys: DATES,
  },

  JOB_VACANCY: {
    module: "JOB_VACANCY",
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
    dateKeys: DATES,
  },

  SUPERVISOR: {
    module: "SUPERVISOR",
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

/** Purges one module's cached pages. Call from its create/edit/delete paths. */
export function revalidateContent(key: ContentListKey): void {
  CONTENT_LISTS[key].revalidate();
}

/** Re-exported so tests can cross-check a config key against the write path. */
export { ENTITY_CONFIG, type ModuleKey };
