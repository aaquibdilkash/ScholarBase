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
import { getCurrentUser } from "@/lib/auth";
import { isSearchableQuery } from "@/lib/search-guard";
import { allowSearchRequest } from "@/lib/search-rate-limit";
import { PUBLIC_SOCIAL_POST_SELECT } from "@/types/feed";
import type { MentionUser } from "@/components/interactions/CommentThread";

import {
  createContentList,
  createDirectoryList,
  CONTENT_COUNTER_KEYS,
  type ContentListArgs,
} from "../content";
import { revalidateProfileContent } from "./profile-tab";
import { reviveDates } from "../cache";

/** Viewer-agnostic article projection. Excludes votes/bookmarks (live overlay). */
const ARTICLE_SELECT = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  createdAt: true,
  updatedAt: true,
  editedAt: true,
  authorId: true,
  isFrozen: true,
  hasActiveAppeal: true,
  totalVotes: true,
  totalBookmarks: true,
  totalComments: true,
  author: {
    select: {
      id: true,
      name: true,
      handle: true,
      avatarUrl: true,
      institutionVerifiedAt: true,
    },
  },
} as unknown as Record<string, unknown>;

/**
 * Viewer-agnostic scholar projection. Deliberately has no `followers` filter:
 * that relation IS the identity leak this shape removes. Follow state arrives
 * from the live overlay instead.
 */
const SCHOLAR_SELECT = {
  id: true,
  name: true,
  handle: true,
  avatarUrl: true,
  institutionVerifiedAt: true,
  bio: true,
  reputation: true,
  createdAt: true,
  // RULE 6: materialized counters, not a live COUNT(*) subquery.
  followersCount: true,
  followingCount: true,
} as unknown as Record<string, unknown>;

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
 * A key maps either to a single `ContentListArgs`, or to `{ variants: [...] }`
 * for a list that needs more than one cached loader. The scholar directory is
 * the only such case: `latest` and `reputation` sort by different indexed
 * columns, and `unstable_cache` fixes its key parts at creation time, so the two
 * orderings must be separate loaders with disjoint cache key spaces.
 *
 * Exported so the contract test can assert across every key at once.
 */
export const CONTENT_LIST_CONFIGS = {
  // ---------------------------------------------------------------------
  // Formerly bespoke. The feed and the article list each had their own
  // factory config; both are plain `ContentListArgs` now, so every listing
  // page in the product is declared in this one file and reaches the P0-3
  // search floor and throttle through `loadContentPage`.
  // ---------------------------------------------------------------------
  FEED: {
    module: "SOCIAL_POST",
    trending: "socialPosts",
    tag: "feed-public",
    where: { isDeleted: false },
    select: PUBLIC_SOCIAL_POST_SELECT as unknown as Record<string, unknown>,
    // `unstable_cache` serialises via JSON.stringify, so dates become ISO
    // strings; the shared `reviveDates` (driven by this same list) revives them.
    dateKeys: ["createdAt", "updatedAt", "editedAt"],
    // The feed searches post text *and* the author's name/handle, which the
    // relation form of `searchFields` expresses.
    searchFields: [
      { field: "content" },
      { field: "name", relation: "author" },
      { field: "handle", relation: "author" },
    ],
    stitchOverrides: {
      // The feed's only genuinely module-specific fold rule: the `mentions`
      // column is Prisma `Json`, so it arrives as whatever was written. This
      // used to live in a `feed-stitch.ts` of its own — the feed was the last
      // bespoke module converted and it was the only one left with a private
      // file. Every other rule is now shared: dates come from `dateKeys` via
      // `reviveDates`, counters from `CONTENT_COUNTER_KEYS`.
      normalize: (row: Record<string, unknown>) => ({
        mentions: Array.isArray(row.mentions)
          ? (row.mentions as MentionUser[])
          : null,
      }),
    },
  },
  ARTICLE: {
    module: "ARTICLE",
    trending: "articles",
    tag: "articles-public",
    where: { isDeleted: false },
    select: ARTICLE_SELECT as unknown as Record<string, unknown>,
    dateKeys: ["createdAt", "updatedAt", "editedAt"],
    searchFields: [{ field: "title" }, { field: "name", relation: "author" }],
  },

  // ---------------------------------------------------------------------
  // The scholar directory: the one list that is not a content module. It
  // lists `User` rows, so it has no vote/bookmark tables to derive and is
  // declared through `createDirectoryList` instead.
  // ---------------------------------------------------------------------
  SCHOLAR_DIRECTORY: {
    directory: true,
    trending: "scholars",
    variants: [
      {
        rowTable: "User",
        tag: "scholars-public",
        model: "user",
        where: { isDeleted: false },
        keyParts: ["latest"],
        select: SCHOLAR_SELECT,
        orderBy: { createdAt: "desc" },
        dateKeys: ["createdAt"],
        counterKeys: ["reputation", "followersCount", "followingCount"],
        searchFields: [{ field: "name" }, { field: "handle" }, { field: "bio" }],
        stitchOverrides: {
          // Top-level follow state rather than a nested author.followers array,
          // so the leaky shape never reaches the output.
          followTarget: "self" as const,
        },
      },
      {
        rowTable: "User",
        tag: "scholars-public",
        model: "user",
        where: { isDeleted: false },
        keyParts: ["reputation"],
        select: SCHOLAR_SELECT,
        orderBy: { reputation: "desc", createdAt: "desc" },
        dateKeys: ["createdAt"],
        counterKeys: ["reputation", "followersCount", "followingCount"],
        searchFields: [{ field: "name" }, { field: "handle" }, { field: "bio" }],
        stitchOverrides: {
          followTarget: "self" as const,
        },
      },
    ],
  },

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

/** Keys of the registry, i.e. every module the listings cover. */
export type ContentListKey = keyof typeof CONTENT_LIST_CONFIGS;

/** Cache-key discriminator per scholar ordering, so the two never collide. */
export const SCHOLAR_SORT_KEY_PARTS = ["latest", "reputation"] as const;
export type ScholarSort = (typeof SCHOLAR_SORT_KEY_PARTS)[number];

/**
 * The directory's fold rules, exported for the unit tests that assert the
 * follow-state shape without a database.
 *
 * DERIVED from the `SCHOLAR_DIRECTORY` config rather than mirrored: this used
 * to be a hand-copied literal, which meant a config edit could silently leave
 * the tested rules diverging from the shipped ones.
 */
const scholarVariant = CONTENT_LIST_CONFIGS.SCHOLAR_DIRECTORY.variants[0];
export const SCHOLAR_STITCH_OPTIONS = {
  getRowId: (row: Record<string, unknown>) => row.id as string,
  // Follow state on a scholar row is keyed by the scholar's own id.
  getAuthorId: (row: Record<string, unknown>) => row.id as string,
  counterKeys: scholarVariant.counterKeys,
  // The shared date revival, driven by the directory's own `dateKeys` — the same
  // derivation every content module gets, not a hand-rolled copy of it.
  rehydrate: (row: Record<string, unknown>) =>
    reviveDates(row, scholarVariant.dateKeys),
  // Top-level follow state, not nested under an author.
  followTarget: scholarVariant.stitchOverrides.followTarget,
};

type Loader = ReturnType<typeof createContentList>;

/**
 * Every configured module's loader(s).
 *
 * Typed as a union rather than per-key because `ContentListKey` is a union, so a
 * per-key conditional resolves to `{}` for the members that are not variant
 * lists. Callers narrow with {@link singleLoader} (content keys) or index the
 * array directly (the scholar directory's two orderings).
 */
export type ContentListLoaders = Loader | Loader[];

/** The single loader for a key that declares exactly one. */
export function singleLoader(key: ContentListKey): Loader {
  const entry = CONTENT_LISTS[key] as ContentListLoaders;
  if (Array.isArray(entry)) {
    throw new Error(`registry key "${key}" declares ordering variants, not one loader`);
  }
  return entry;
}

/**
 * Builds the loader(s) for one registry key.
 *
 * A content key yields one loader. `SCHOLAR_DIRECTORY` yields two, because
 * `unstable_cache` fixes its key parts at creation time and `latest` /
 * `reputation` sort by different indexed columns — two loaders, two disjoint
 * key spaces, so a reputation-sorted request can never be served latest-sorted
 * rows.
 */
function buildLoaders(key: ContentListKey): ContentListLoaders {
  const config = CONTENT_LIST_CONFIGS[key] as ContentListArgs | { variants: unknown[] };
  if ("variants" in config) {
    return config.variants.map((variant) => createDirectoryList(variant as never));
  }
  return createContentList(config);
}

/** Every configured module, built from its declarative config. */
export const CONTENT_LISTS = Object.fromEntries(
  (Object.keys(CONTENT_LIST_CONFIGS) as ContentListKey[]).map((key) => [
    key,
    buildLoaders(key),
  ]),
) as Record<ContentListKey, ContentListLoaders>;

/** All configured module keys, in declaration order. */
export const CONTENT_LIST_KEYS = Object.keys(
  CONTENT_LIST_CONFIGS,
) as ContentListKey[];

/**
 * Loads one page for a standard content module, for the current viewer.
 * Takes no identity — the factory resolves it from the session.
 *
 * This is the ONE entry point for all 13 configured content modules
 * (publications, events, grants, surveys, admissions, courses, vacancies,
 * journals, research tools, results, contributions, supervisors, help), so the
 * search throttle lives here rather than being repeated in 13 action files that
 * would inevitably drift apart.
 *
 * The minimum-length rule is one layer down, inside `createContentList`'s
 * `buildWhere`; this adds the rate limit for terms that clear it.
 */
export async function loadContentPage(
  key: ContentListKey,
  args: {
    query?: string;
    pageSize?: number;
    cursor?: string;
    /** Ordering variant, for keys that declare more than one loader. */
    variant?: number;
  } = {},
): Promise<Record<string, unknown>[]> {
  const entry = CONTENT_LISTS[key] as Loader | Loader[];
  const loader = Array.isArray(entry) ? entry[args.variant ?? 0] : entry;
  if (isSearchableQuery(args.query)) {
    const viewer = await getCurrentUser();
    // Returns an empty page rather than throwing: callers are server-rendered
    // list pages whose empty state already renders, and an exception would tear
    // down the whole page to report a throttle.
    if (!(await allowSearchRequest(`content:${key}`, viewer?.id))) return [];
  }
  return loader.fetchPage(args);
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
  const entry = CONTENT_LISTS[key] as Loader | Loader[];
  // Variant keys (the scholar directory) purge every ordering.
  if (Array.isArray(entry)) {
    for (const loader of entry) loader.revalidate();
  } else {
    entry.revalidate();
  }
  revalidateTrending(CONTENT_LIST_CONFIGS[key].trending);
  revalidateProfileContent(...authorIds);
}

/** Re-exported so tests can cross-check a config key against the write path. */
export { ENTITY_CONFIG, type ModuleKey };
