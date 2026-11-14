"use server";

import type { JournalWithAuthor } from "@/types/cards";

import {
  loadContentPage,
  revalidateContent,
} from "@/lib/tri-split/modules/registry";
import { revalidateBookmarkersForDeletedContent } from "@/lib/tri-split/modules/profile-tab";
import { hideContentActivity } from "@/lib/activity";

import { cache } from "react";

import prisma from "@/lib/db";
import { resolvePostDeletePermission } from "@/lib/deletion";
import { getActiveUser, requireCurrentUser, isAuthorizedOrAdmin, getCurrentUser } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { isSearchableQuery } from "@/lib/search-guard";
import { allowSearchRequest } from "@/lib/search-rate-limit";
import { readFormValue, readOptionalFormValue, assertRichTextWithinLimit } from "@/lib/form";
import { notifyFollowersOfActivity, deleteAllNotificationsForContent, deleteAuthorNotificationsForContent } from "@/lib/notifications";
import type {
  Quartile,
  AbdcTier,
  WosIndex,
  OpenAccessStatus,
} from "@prisma/client";
import { COMMENT_PAGE_SIZE, MAX_JOURNAL_DESCRIPTION } from "@/lib/constants";
import { VISIBLE_PARENT_COMMENT_WHERE } from "@/lib/comment-visibility";
import { validateExternalUrl } from "@/lib/external-url";
import { METRIC_BOUNDS } from "@/constants/journal-metrics";

// Strict numeric-only metric parsing (SJR Score, CiteScore, Impact Factor).
// Rejects "2.4abc"/"abc" instead of silently coercing via parseFloat, and
// enforces the industry bounds shared with the form (METRIC_BOUNDS).
// Accepts string | null because readOptionalFormValue returns null when absent.
function parseOptionalMetric(
  raw: string | null | undefined,
  fieldLabel: string,
  max: number,
): number | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`${fieldLabel} must be a number (e.g., 2.4).`);
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0 || value > max) {
    throw new Error(
      `${fieldLabel} must be a number between 0 and ${max}.`,
    );
  }
  return value;
}

// Frequency allowlist — new writes constrained to dropdown; legacy free-text
// values pass through untouched so old rows are never wiped on edit.
function sanitizeFrequency(raw: string | null | undefined): string | undefined {
  if (raw == null) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return trimmed;
}

export async function createJournal(formData: FormData) {
  const auth = await getActiveUser("Please log in to submit details.");
  if (auth.frozen) return { success: false, error: auth.message, message: auth.message };
  const user = auth.user;
  const writeLimit = await enforceRateLimit({ namespace: "journal:create", key: user.id, limit: 10, window: "10 m" });
  if (!writeLimit.allowed) return { success: false as const, error: writeLimit.error };

  const title = readFormValue(formData, "title");
  const issn = readOptionalFormValue(formData, "issn");
  const scopusQuartile = readOptionalFormValue(formData, "scopusQuartile");
  const abdcRanking = readOptionalFormValue(formData, "abdcRanking");
  const wosIndex = readOptionalFormValue(formData, "wosIndex");
  const wosQuartile = readOptionalFormValue(formData, "wosQuartile");
  const sjrQuartile = readOptionalFormValue(formData, "sjrQuartile");
  const publisher = readOptionalFormValue(formData, "publisher");
  const website = readOptionalFormValue(formData, "website");
  let safeWebsite: string | null;
  try {
    safeWebsite = validateExternalUrl(website, "Website");
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "Invalid URL." };
  }
  const about = readOptionalFormValue(formData, "about");
  assertRichTextWithinLimit(about ?? "", MAX_JOURNAL_DESCRIPTION, "About");
  const subjectArea = readOptionalFormValue(formData, "subjectArea");
  const frequency = sanitizeFrequency(
    readOptionalFormValue(formData, "frequency"),
  );
  const openAccess = readOptionalFormValue(formData, "openAccess");

  const impactFactor = parseOptionalMetric(
    readOptionalFormValue(formData, "impactFactor"),
    "Impact Factor",
    METRIC_BOUNDS.impactFactor.max,
  );
  const sjrScore = parseOptionalMetric(
    readOptionalFormValue(formData, "sjrScore"),
    "SJR Score",
    METRIC_BOUNDS.sjrScore.max,
  );
  const citeScore = parseOptionalMetric(
    readOptionalFormValue(formData, "citeScore"),
    "CiteScore",
    METRIC_BOUNDS.citeScore.max,
  );
  const isAnonymous = formData.has("isAnonymous");

  const journal = await prisma.$transaction(async (tx) => {
    const newJournal = await tx.journal.create({
      data: {
        title,
        issn,
        impactFactor,
        scopusQuartile: scopusQuartile
          ? (scopusQuartile as Quartile)
          : undefined,
        abdcRanking: abdcRanking ? (abdcRanking as AbdcTier) : undefined,
        wosIndex: wosIndex ? (wosIndex as WosIndex) : undefined,
        wosQuartile: wosQuartile ? (wosQuartile as Quartile) : undefined,
        sjrQuartile: sjrQuartile ? (sjrQuartile as Quartile) : undefined,
        sjrScore,
        citeScore,
        publisher,
        website: safeWebsite,
        about,
        subjectArea,
        frequency,
        openAccess: openAccess ? (openAccess as OpenAccessStatus) : undefined,
        isAnonymous,
        authorId: user.id,
      },
      include: { author: { select: { id: true, name: true, handle: true, avatarUrl: true, institutionVerifiedAt: true, followers: { where: { followerId: user.id }, select: { followerId: true } } } }, votes: { where: { userId: user.id }, select: { voteType: true } }, bookmarks: { where: { userId: user.id }, select: { id: true } } },
    });

    // Anonymous content stays out of the author's profile count and activity
    // log, mirroring `createRecommendation` / `createJournalReview`.
    if (!isAnonymous) {
      await tx.userActivity.create({
        data: {
          userId: user.id,
          action: "PUBLISHED",
          moduleType: "JOURNAL",
          entityId: newJournal.id,
          entityTitle: newJournal.title,
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: { journalCount: { increment: 1 } },
      });
    }

    return newJournal;
  });

  if (!isAnonymous) {
    await notifyFollowersOfActivity({
      actorId: user.id,
      type: "content-published",
      targetType: "Journal",
      targetId: journal.id,
      title: `${user.email?.split("@")[0] || "Someone"} added a new journal`,
      body: `${title}${publisher ? ` by ${publisher}` : ""}`,
    });
  }

  // Purge the cached journal pages: publish must be visible at once, not after the TTL.
  revalidateContent("JOURNAL", user.id);

  return { success: true, data: journal };
}

export async function updateJournal(formData: FormData, journalId: string) {
  // Frozen owners may edit (to correct content before appealing).
  const user = await requireCurrentUser("Log in to edit this journal.");
  const writeLimit = await enforceRateLimit({ namespace: "journal:edit", key: user.id, limit: 20, window: "10 m" });
  if (!writeLimit.allowed) return { success: false as const, error: writeLimit.error };

  const title = readFormValue(formData, "title");
  const issn = readOptionalFormValue(formData, "issn");
  const scopusQuartile = readOptionalFormValue(formData, "scopusQuartile");
  const abdcRanking = readOptionalFormValue(formData, "abdcRanking");
  const wosIndex = readOptionalFormValue(formData, "wosIndex");
  const wosQuartile = readOptionalFormValue(formData, "wosQuartile");
  const sjrQuartile = readOptionalFormValue(formData, "sjrQuartile");
  const publisher = readOptionalFormValue(formData, "publisher");
  const website = readOptionalFormValue(formData, "website");
  let safeWebsite: string | null;
  try {
    safeWebsite = validateExternalUrl(website, "Website");
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "Invalid URL." };
  }
  const about = readOptionalFormValue(formData, "about");
  assertRichTextWithinLimit(about ?? "", MAX_JOURNAL_DESCRIPTION, "About");
  const subjectArea = readOptionalFormValue(formData, "subjectArea");
  const frequency = sanitizeFrequency(
    readOptionalFormValue(formData, "frequency"),
  );
  const openAccess = readOptionalFormValue(formData, "openAccess");

  const impactFactor = parseOptionalMetric(
    readOptionalFormValue(formData, "impactFactor"),
    "Impact Factor",
    METRIC_BOUNDS.impactFactor.max,
  );
  const sjrScore = parseOptionalMetric(
    readOptionalFormValue(formData, "sjrScore"),
    "SJR Score",
    METRIC_BOUNDS.sjrScore.max,
  );
  const citeScore = parseOptionalMetric(
    readOptionalFormValue(formData, "citeScore"),
    "CiteScore",
    METRIC_BOUNDS.citeScore.max,
  );
  const isAnonymous = formData.has("isAnonymous");

  const journal = await prisma.journal.findUnique({
    where: { id: journalId },
    select: { authorId: true, isAnonymous: true },
  });

  if (!journal) {
    throw new Error("Journal not found.");
  }
  if (!(await isAuthorizedOrAdmin(journal.authorId, user.id))) {
    throw new Error("Not authorized to edit this journal.");
  }

  const updatedJournal = await prisma.$transaction(async (tx) => {
    const updated = await tx.journal.update({
      where: { id: journalId },
      data: {
        title,
        issn,
        impactFactor,
        scopusQuartile: scopusQuartile ? (scopusQuartile as Quartile) : undefined,
        abdcRanking: abdcRanking ? (abdcRanking as AbdcTier) : undefined,
        wosIndex: wosIndex ? (wosIndex as WosIndex) : undefined,
        wosQuartile: wosQuartile ? (wosQuartile as Quartile) : undefined,
        sjrQuartile: sjrQuartile ? (sjrQuartile as Quartile) : undefined,
        sjrScore,
        citeScore,
        publisher,
        website: safeWebsite,
        about,
        subjectArea,
        frequency,
        openAccess: openAccess ? (openAccess as OpenAccessStatus) : undefined,
        isAnonymous,
        editedAt: new Date(),
      },
    });

    // Anonymity toggle: keep the profile counter and activity log honest,
    // mirroring `updateRecommendation` / `updateJournalReview`.
    if (!journal.isAnonymous && isAnonymous) {
      await tx.user.update({
        where: { id: journal.authorId },
        data: { journalCount: { decrement: 1 } },
      });
      await tx.userActivity.deleteMany({
        where: {
          userId: journal.authorId,
          action: "PUBLISHED",
          moduleType: "JOURNAL",
          entityId: journalId,
        },
      });
      // Identity toggle: remove the author's own notifications for this
      // journal so a non-anon → anon switch doesn't leak who published it.
      await deleteAuthorNotificationsForContent(
        tx,
        journal.authorId,
        [journalId],
      );
    } else if (journal.isAnonymous && !isAnonymous) {
      await tx.user.update({
        where: { id: journal.authorId },
        data: { journalCount: { increment: 1 } },
      });
      await tx.userActivity.create({
        data: {
          userId: journal.authorId,
          action: "PUBLISHED",
          moduleType: "JOURNAL",
          entityId: journalId,
          entityTitle: updated.title,
        },
      });
    }

    return updated;
  });

  // Re-announce to followers now the row is public again — mirrors createJournal.
  if (journal.isAnonymous && !isAnonymous) {
    await notifyFollowersOfActivity({
      actorId: user.id,
      type: "content-published",
      targetType: "Journal",
      targetId: journalId,
      title: `${user.email?.split("@")[0] || "Someone"} added a new journal`,
      body: `${title}${publisher ? ` by ${publisher}` : ""}`,
    });
  }

  // Purge the cached journal pages: edit must be visible at once, not after the TTL.
  revalidateContent("JOURNAL", journal.authorId);

  return { success: true, data: updatedJournal };
}

export async function deleteJournal(journalId: string) {
  // Frozen owners may delete own content (read/edit/delete allowed, create blocked).
  const user = await requireCurrentUser("Log in to delete this journal.");
  const writeLimit = await enforceRateLimit({ namespace: "journal:delete", key: user.id, limit: 20, window: "10 m" });
  if (!writeLimit.allowed) return { success: false as const, error: writeLimit.error };

  const journal = await prisma.journal.findUnique({
    where: { id: journalId },
    select: { authorId: true, totalVotes: true, totalComments: true, reviewCount: true, isAnonymous: true },
  });

  if (!journal) {
    throw new Error("Journal not found.");
  }
  const deletedByType = await resolvePostDeletePermission(
    user.id,
    journal.authorId,
  );

  await prisma.$transaction(async (tx) => {
    await tx.journal.update({
      where: { id: journalId },
      data: { isDeleted: true, deletedByType, deletedById: user.id },
    });

     await tx.user.update({
       where: { id: journal.authorId },
       data: {
         ...(journal.isAnonymous ? {} : { journalCount: { decrement: 1 } }),
       },
     });

     if (journal.totalVotes !== 0) {
      await tx.user.update({
        where: { id: journal.authorId },
        data: { reputation: { decrement: journal.totalVotes } },
      });
    }

    // Hide this content's activity so a deleted journal stops appearing in
    // anyone's activity feed at once (not after the cache TTL).
    await hideContentActivity(tx, "JOURNAL", journalId)

    // Delete every notification pointing at this journal and its comments.
    await deleteAllNotificationsForContent(tx, "JOURNAL", journalId)
  });

  // Purge the cached journal pages: soft delete must be visible at once, not after the TTL.
  revalidateContent("JOURNAL", journal.authorId);

  // Purge every bookmarker's Bookmarks tab so a soft-deleted post stops
  // inflating their bookmark count or showing a phantom "show more" arrow.
  await revalidateBookmarkersForDeletedContent("JOURNAL", journalId);

  return { success: true, data: { deletedId: journalId, isDeleted: true as const, deletedByType, totalComments: journal.totalComments, reviewCount: journal.reviewCount } };
}

/**
 * Loads one page of journal rows for the
 * *current* viewer.
 *
 * Identity comes from the session, server-side — never from a client argument.
 * (This loader used to accept `userId` from the browser, so any caller could
 * read another user's vote / bookmark / follow state.)
 *
 * The cached viewer-agnostic batch plus the single-statement live overlay live
 * in `@/lib/tri-split/modules/registry`.
 */
export async function getJournals(
  q?: string,
  limit = 10,
  cursor?: string,
) {
  return loadContentPage("JOURNAL", { query: q, pageSize: limit, cursor }) as Promise<
  JournalWithAuthor[]
>;
}

export const getJournalById = cache(
  async (journalId: string, userId?: string) => {
    return prisma.journal.findUnique({
      where: {
        id: journalId,
        isDeleted: false,
      },
      select: {
        id: true,
        title: true,
        issn: true,
        impactFactor: true,
        scopusQuartile: true,
        abdcRanking: true,
        wosIndex: true,
        wosQuartile: true,
        sjrQuartile: true,
        sjrScore: true,
        citeScore: true,
        publisher: true,
        website: true,
        about: true,
        subjectArea: true,
        frequency: true,
        openAccess: true,
        createdAt: true,
        updatedAt: true,
        editedAt: true,
        authorId: true,
        author: {
          select: {
            id: true,
            name: true,
            handle: true,
            avatarUrl: true, institutionVerifiedAt: true,
            followers: userId
              ? {
                  where: { followerId: userId },
                  select: { followerId: true },
                }
              : false,
          },
        },
                totalVotes: true,
        totalBookmarks: true,
        isFrozen: true,
        hasActiveAppeal: true,
        isAnonymous: true,
        isDeleted: true,
        deletedByType: true,
        totalComments: true,
        // Materialized review aggregates (mirrors recommendationCount on
        // Supervisor): average rating = ratingSum / reviewCount.
        reviewCount: true,
        ratingSum: true,
        votes: userId
          ? { where: { userId }, select: { voteType: true } }
          : false,
        bookmarks: userId ? { where: { userId }, select: { id: true } } : false,
        comments: {
          where: VISIBLE_PARENT_COMMENT_WHERE,
          // LAZY PAGINATION: first page of parents only; replies load on demand.
          orderBy: { createdAt: "desc" },
          take: COMMENT_PAGE_SIZE + 1,
          select: {
            isDeleted: true,
            isFrozen: true,
            hasActiveAppeal: true,
            deletedByType: true,
            id: true,
            content: true,
            createdAt: true,
            updatedAt: true,
            editedAt: true,
            parentId: true,
            authorId: true,
            author: {
              select: {
                id: true,
                name: true,
                handle: true,
                avatarUrl: true, institutionVerifiedAt: true,
              },
            },
            totalVotes: true,
            totalReplies: true,
            votes: userId
              ? { where: { userId }, select: { voteType: true } }
              : false,
            mentions: true,
          },
        },
      },
    });
  },
);


export type JournalPickerResult = {
  id: string;
  title: string;
  publisher: string | null;
  issn: string | null;
};

/**
 * Lightweight, indexed picker search used when linking a publication.
 *
 * Mirrors `searchScholarsForPicker` and the `/journals` list search: one Prisma
 * `OR` over the fields that identify a journal — title, publisher, ISSN — with
 * an insensitive `contains`, which PostgreSQL serves from
 * `Journal_title_trgm_idx` / `Journal_publisher_trgm_idx` /
 * `Journal_issn_trgm_idx` as a `BitmapOr`.
 *
 * Deliberately no `similarity()` / `word_similarity()` / `to_tsvector(...)`
 * branches: a function call is not index-backed by `pg_trgm`, and one
 * non-indexable branch inside an `OR` forces the whole statement into a
 * sequential scan over `Journal`. No `about`/`subjectArea` branch either —
 * those are prose, and matching them in a picker returns most of the table for
 * a common word. A picker identifies a journal by name, publisher, or ISSN.
 */
export async function searchJournalsForPicker(
  query: string,
  limit = 6,
): Promise<JournalPickerResult[]> {
  const term = query.trim();
  // P0-3: shared floor (3), not a local 2 — every search surface uses the same
  // minimum so the picker cannot be easier to spam than the feed search.
  if (!isSearchableQuery(term)) return [];
  if (!(await allowSearchRequest("picker:journal", (await getCurrentUser())?.id))) {
    return [];
  }

  const safeLimit = Math.min(10, Math.max(1, Math.floor(limit)));
  return prisma.journal.findMany({
    where: {
      isDeleted: false,
      OR: [
        { title: { contains: term, mode: "insensitive" } },
        { publisher: { contains: term, mode: "insensitive" } },
        { issn: { contains: term, mode: "insensitive" } },
      ],
    },
    select: { id: true, title: true, publisher: true, issn: true },
    orderBy: { createdAt: "desc" },
    take: safeLimit,
  });
}
