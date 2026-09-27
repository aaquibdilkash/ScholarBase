/**
 * Server cache for the three data tabs on a scholar profile.
 *
 * Content, Bookmarks and Activity are list surfaces like any other, so they get
 * the same treatment as `/events` and friends: a cached, viewer-agnostic batch
 * under a tag, a 5-minute TTL from the shared `LIST_REVALIDATE_SECONDS` policy,
 * and a hard-expire purge on the mutations that change them.
 *
 * ┌───────────────────────────────────────────────────────────────┐
 * │ Content   — cached rows + live viewer state. Purged by the     │
 * │             author's own create / edit / delete.               │
 * │ Bookmarks — cached rows, scoped to the session user. Purged by │
 * │             `toggleBookmark`.                                  │
 * │ Activity  — cached rows. Purged by the same content funnel,   │
 * │             since every action writes a `UserActivity` row.    │
 * └───────────────────────────────────────────────────────────────┘
 *
 * WHY THE TAG IS PER PROFILE, AND HOW THAT IS POSSIBLE
 *
 * It matters: with one shared tag, a single publish anywhere evicts every
 * scholar's Content tab, so on a platform where people actually publish the
 * cache is permanently cold and you have paid for nothing.
 *
 * The obstacle looks like `unstable_cache` fixes its tags at wrapper-creation
 * time. It does not — verified in `next/dist/server/web/spec-extension/
 * unstable-cache.js`, where the cache key is built as:
 *
 *     const fixedKey    = `${cb.toString()}-${keyParts.join(',')}`;
 *     const invocationKey = `${fixedKey}-${JSON.stringify(args)}`;
 *
 * The wrapper's *identity* is not in that key — only the function's source
 * text, the key parts, and the arguments. So a wrapper constructed per call,
 * carrying a per-profile tag, still resolves to the same entry as any other
 * call for the same profile, and the tag lands on exactly that entry. The
 * profile id must therefore stay a function *argument* (it is, and it must be —
 * closing over it instead would collapse every profile onto one entry).
 *
 * The consequence is that each mutation has to name the profile it changed.
 * `revalidateContent` and friends take the author ids for that reason; a call
 * site that cannot name one simply purges nothing, and the 5-minute TTL bounds
 * how long that profile can look stale. That bound is the same safety net the
 * public list pages already rely on for embedded author fields, which drift on
 * a profile edit for the same reason.
 */
import { revalidateTag, unstable_cache as unstableCache } from "next/cache";

import prisma from "@/lib/db";
import {
  applySectionsOverlay,
  collectSectionAuthorIds,
  collectSectionRowIds,
  fetchBookmarkSections,
  fetchContentSections,
  fetchProfileSectionsOverlay,
  reviveSectionDates,
  PROFILE_SECTION_KEYS,
  type BookmarkSections,
  type ProfileSectionsPayload,
} from "@/lib/profile-sections";

import { LIST_REVALIDATE_SECONDS, normalizePageSize } from "../cache";

/** Tag stem for the profile Content tab rows. */
export const PROFILE_CONTENT_TAG = "profile-content";

/** Tag stem for the profile Bookmarks tab rows. */
export const PROFILE_BOOKMARKS_TAG = "profile-bookmarks";

/** Tag stem for the profile Activity tab rows. */
export const PROFILE_ACTIVITY_TAG = "profile-activity";

/**
 * Next rejects tags over 256 characters, and a cuid plus a stem is far under it.
 * Kept as an explicit guard because the id is interpolated into an invalidation
 * handle: an id that silently became an invalid tag would be an invalidation
 * that silently stops working.
 */
const MAX_TAG_LENGTH = 256;

const scopedTag = (stem: string, id: string): string => {
  const tag = `${stem}:${id}`;
  if (tag.length > MAX_TAG_LENGTH) {
    throw new Error(`Cache tag too long for ${stem}: ${id}`);
  }
  return tag;
};

/** The tag guarding one scholar's Content tab. */
export const profileContentTag = (profileId: string): string =>
  scopedTag(PROFILE_CONTENT_TAG, profileId);

/** The tag guarding one user's Bookmarks tab. */
export const profileBookmarksTag = (ownerId: string): string =>
  scopedTag(PROFILE_BOOKMARKS_TAG, ownerId);

/** The tag guarding one scholar's Activity tab. */
export const profileActivityTag = (profileId: string): string =>
  scopedTag(PROFILE_ACTIVITY_TAG, profileId);

/**
 * Builds a cached loader tagged to one id.
 *
 * The wrapped function is a single literal at a single source position, so its
 * `toString()` — and therefore the cache key — is identical on every call. The
 * id is the first argument precisely so it lands in `JSON.stringify(args)`.
 */
function createScopedLoader<TValue, TId extends string, TRest extends unknown[]>(
  stem: string,
  load: (id: TId, ...rest: TRest) => Promise<TValue>,
) {
  return (id: TId, ...rest: TRest): Promise<TValue> => {
    // `unstable_cache` imported lazily: it is only legal to *call* the wrapper
    // inside a request, and this keeps the construction next to that call.
    const cached = unstableCache(load as (...args: unknown[]) => Promise<TValue>, [], {
      tags: [scopedTag(stem, id)],
      revalidate: LIST_REVALIDATE_SECONDS,
    });
    return cached(id, ...rest);
  };
}

/** Materialized `User` counters the Content tab reads its section totals from. */
const USER_COUNTER_SELECT = {
  articleCount: true,
  socialPostCount: true,
  jobVacancyCount: true,
  phdAdmissionCount: true,
  researchEventCount: true,
  helpPostCount: true,
  journalCount: true,
  journalReviewCount: true,
  researchToolCount: true,
  recommendationCount: true,
  supervisorCount: true,
  resultCount: true,
  contributionCount: true,
  publicationCount: true,
  surveyCount: true,
  surveyParticipationCount: true,
  researchGrantCount: true,
  courseCount: true,
} as const;

/** Section key -> the materialized counter that totals it. */
const COUNT_SOURCE = {
  articles: "articleCount",
  socialPosts: "socialPostCount",
  vacancies: "jobVacancyCount",
  admissions: "phdAdmissionCount",
  events: "researchEventCount",
  helpPosts: "helpPostCount",
  journals: "journalCount",
  researchTools: "researchToolCount",
  recommendations: "recommendationCount",
  supervisors: "supervisorCount",
  results: "resultCount",
  contributionPosts: "contributionCount",
  publications: "publicationCount",
  surveys: "surveyCount",
  researchGrants: "researchGrantCount",
  courses: "courseCount",
  journalReviews: "journalReviewCount",
} as const satisfies Record<
  (typeof PROFILE_SECTION_KEYS)[number],
  keyof typeof USER_COUNTER_SELECT
>;

type ContentBatch = {
  sections: ProfileSectionsPayload;
  counts: Record<string, number>;
};

/**
 * The cached, viewer-agnostic half of the Content tab.
 *
 * The counters ride along because they are materialized `User` scalars (RULE 2)
 * and because they move on exactly the events that purge this tag — publish,
 * edit, delete. Reading them live instead would add a round trip per tab load
 * to buy freshness that a purge already guarantees.
 */
const loadCachedContentBatch = createScopedLoader<
  ContentBatch,
  string,
  [number]
>(PROFILE_CONTENT_TAG, async (profileId, take) => {
  const user = await prisma.user.findUnique({
    where: { id: profileId },
    select: USER_COUNTER_SELECT,
  });

  const sections = await fetchContentSections(profileId, take);

  const counts: Record<string, number> = {};
  for (const key of PROFILE_SECTION_KEYS) {
    const counter = COUNT_SOURCE[key];
    counts[key] = user?.[counter] ?? 0;
  }
  // The tab renders this heading next to the surveys, but it is not a section of
  // its own, so it has no key in `COUNT_SOURCE`.
  counts.surveyParticipation = user?.surveyParticipationCount ?? 0;

  return { sections, counts };
});

/** The cached, viewer-agnostic half of the Bookmarks tab. */
const loadCachedBookmarkBatch = createScopedLoader<
  BookmarkSections,
  string,
  [number]
>(PROFILE_BOOKMARKS_TAG, (ownerId, take) => fetchBookmarkSections(ownerId, take));

/**
 * The Content tab, for the current viewer.
 *
 * The viewer is resolved from the session, never from an argument: this is the
 * identity contract the Tri-Split factory enforces for every list, and the same
 * hole the old `getProfileSections` had (a caller-chosen `currentUserId`) must
 * not come back here.
 */
export async function loadProfileContentTab(args: {
  profileId: string;
  take?: number;
  viewerId: string | null;
}): Promise<ContentBatch> {
  const take = normalizePageSize(args.take);
  const { sections, counts } = await loadCachedContentBatch(args.profileId, take);

  // A cache hit returns ISO strings, not `Date`s — see `reviveSectionDates`.
  reviveSectionDates(sections);

  const overlay = await fetchProfileSectionsOverlay(
    collectSectionRowIds(sections),
    collectSectionAuthorIds(sections),
    args.viewerId,
  );

  return {
    sections: applySectionsOverlay(sections, overlay, args.viewerId),
    counts,
  };
}

/**
 * The Bookmarks tab, for the current viewer.
 *
 * `ownerId` is the session user, passed in rather than re-resolved so the action
 * above can fail closed on a null session without a second lookup. It is never
 * a caller argument, which is what keeps one scholar's bookmarks unreadable by
 * another.
 */
export async function loadProfileBookmarkTab(args: {
  ownerId: string;
  take?: number;
  viewerId: string | null;
}): Promise<BookmarkSections> {
  const take = normalizePageSize(args.take);
  const { items, counts } = await loadCachedBookmarkBatch(args.ownerId, take);

  reviveSectionDates(items);

  const overlay = await fetchProfileSectionsOverlay(
    collectSectionRowIds(items),
    collectSectionAuthorIds(items),
    args.viewerId,
  );

  return { items: applySectionsOverlay(items, overlay, args.viewerId), counts };
}

type CachedActivityRow = {
  id: string;
  action: string;
  moduleType: string;
  entityId: string;
  entityTitle: string;
  createdAt: string;
};

/** The cached Activity page. Purged by the content mutation funnel. */
const loadCachedActivityPage = createScopedLoader<
  CachedActivityRow[],
  string,
  [number, string | undefined]
>(PROFILE_ACTIVITY_TAG, async (profileId, take, cursor) => {
  const rows = await prisma.userActivity.findMany({
    where: { userId: profileId },
    take,
    orderBy: { createdAt: "desc" },
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      action: true,
      moduleType: true,
      entityId: true,
      entityTitle: true,
      createdAt: true,
    },
  });
  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));
});

export type ProfileActivityItem = Omit<CachedActivityRow, "createdAt"> & {
  createdAt: Date;
};

/** One page of the Activity tab, dates revived. */
export async function loadProfileActivity(
  profileId: string,
  take: number,
  cursor?: string,
): Promise<ProfileActivityItem[]> {
  if (!profileId) return [];
  const rows = await loadCachedActivityPage(
    profileId,
    normalizePageSize(take),
    cursor,
  );
  return rows.map((row) => ({ ...row, createdAt: new Date(row.createdAt) }));
}

/**
 * Hard-expires a tag.
 *
 * `expire: 0` rather than a stale-while-revalidate purge, which would keep
 * serving a deleted row — not acceptable for content the author has just
 * cleared, or a bookmark they just removed. The single-argument
 * `revalidateTag(tag)` form is deprecated in Next 16.
 */
function expireTag(tag: string): void {
  revalidateTag(tag, { expire: 0 });
}

/** Expands and de-duplicates the author ids a mutation touched. */
function uniqueIds(ids: readonly (string | null | undefined)[]): string[] {
  return [...new Set(ids.filter((id): id is string => !!id))];
}

/**
 * Purges the given profiles' Content and Activity tabs.
 *
 * Called from the shared content-mutation funnel (`revalidateContent`,
 * `revalidateArticles`, `revalidatePublicFeed`) with the author id of the row
 * that changed. Activity rides along because every content action writes a
 * `UserActivity` row in the same transaction, so the two tabs go stale for
 * exactly the same events.
 *
 * A profile left out here is not purged; the 5-minute TTL bounds it. That is
 * deliberate rather than a fallback: the same TTL already governs embedded
 * author fields on every public list page, which drift on a profile edit.
 */
export function revalidateProfileContent(
  ...profileIds: (string | null | undefined)[]
): void {
  for (const id of uniqueIds(profileIds)) {
    expireTag(profileContentTag(id));
    expireTag(profileActivityTag(id));
  }
}

/** Purges one user's Bookmarks tab. Called when they bookmark or un-bookmark. */
export function revalidateProfileBookmarks(ownerId: string): void {
  expireTag(profileBookmarksTag(ownerId));
}
