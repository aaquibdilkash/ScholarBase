"use server";

import type { JournalWithAuthor } from "@/types/cards";

import {
  loadContentPage,
  revalidateContent,
} from "@/lib/tri-split/modules/registry";

import { cache } from "react";

import prisma from "@/lib/db";
import { resolvePostDeletePermission } from "@/lib/deletion";
import { requireActiveUser, isAuthorizedOrAdmin } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { readFormValue, readOptionalFormValue, assertRichTextWithinLimit } from "@/lib/form";
import { notifyFollowersOfActivity } from "@/lib/notifications";
import type {
  Quartile,
  AbdcTier,
  WosIndex,
  OpenAccessStatus,
} from "@prisma/client";
import { COMMENT_PAGE_SIZE, MAX_JOURNAL_DESCRIPTION } from "@/lib/constants";
import { VISIBLE_PARENT_COMMENT_WHERE } from "@/lib/comment-visibility";
import { validateExternalUrl } from "@/lib/external-url";

export async function createJournal(formData: FormData) {
  const user = await requireActiveUser("Please log in to submit details.");
  await enforceRateLimit({ namespace: "journal:create", key: user.id, limit: 10, window: "10 m" });

  const title = readFormValue(formData, "title");
  const issn = readOptionalFormValue(formData, "issn");
  const impactFactor = readOptionalFormValue(formData, "impactFactor");
  const scopusQuartile = readOptionalFormValue(formData, "scopusQuartile");
  const abdcRanking = readOptionalFormValue(formData, "abdcRanking");
  const wosIndex = readOptionalFormValue(formData, "wosIndex");
  const wosQuartile = readOptionalFormValue(formData, "wosQuartile");
  const sjrQuartile = readOptionalFormValue(formData, "sjrQuartile");
  const sjrScore = readOptionalFormValue(formData, "sjrScore");
  const citeScore = readOptionalFormValue(formData, "citeScore");
  const publisher = readOptionalFormValue(formData, "publisher");
  const website = readOptionalFormValue(formData, "website");
  const safeWebsite = validateExternalUrl(website, "Website");
  const about = readOptionalFormValue(formData, "about");
  assertRichTextWithinLimit(about ?? "", MAX_JOURNAL_DESCRIPTION, "About");
  const subjectArea = readOptionalFormValue(formData, "subjectArea");
  const frequency = readOptionalFormValue(formData, "frequency");
  const openAccess = readOptionalFormValue(formData, "openAccess");

  const journal = await prisma.$transaction(async (tx) => {
    const newJournal = await tx.journal.create({
      data: {
        title,
        issn,
        impactFactor: impactFactor ? parseFloat(impactFactor) : null,
        scopusQuartile: scopusQuartile
          ? (scopusQuartile as Quartile)
          : undefined,
        abdcRanking: abdcRanking ? (abdcRanking as AbdcTier) : undefined,
        wosIndex: wosIndex ? (wosIndex as WosIndex) : undefined,
        wosQuartile: wosQuartile ? (wosQuartile as Quartile) : undefined,
        sjrQuartile: sjrQuartile ? (sjrQuartile as Quartile) : undefined,
        sjrScore: sjrScore ? parseFloat(sjrScore) : null,
        citeScore: citeScore ? parseFloat(citeScore) : null,
        publisher,
        website: safeWebsite,
        about,
        subjectArea,
        frequency,
        openAccess: openAccess ? (openAccess as OpenAccessStatus) : undefined,
        authorId: user.id,
      },
      include: { author: { select: { id: true, name: true, handle: true, avatarUrl: true, institutionVerifiedAt: true, followers: { where: { followerId: user.id }, select: { followerId: true } } } }, votes: { where: { userId: user.id }, select: { voteType: true } }, bookmarks: { where: { userId: user.id }, select: { id: true } } },
    });

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
      data: { journalCount: { increment: 1 }, reputation: { increment: 1 } },
    });

    return newJournal;
  });

  await notifyFollowersOfActivity({
    actorId: user.id,
    type: "content-published",
    targetType: "Journal",
    targetId: journal.id,
    title: `${user.email?.split("@")[0] || "Someone"} added a new journal`,
    body: `${title}${publisher ? ` by ${publisher}` : ""}`,
  });

  // Purge the cached journal pages: publish must be visible at once, not after the TTL.
  revalidateContent("JOURNAL");

  return { success: true, data: journal };
}

export async function updateJournal(formData: FormData, journalId: string) {
  const user = await requireActiveUser("Log in to edit this journal.");
  await enforceRateLimit({ namespace: "journal:edit", key: user.id, limit: 20, window: "10 m" });

  const title = readFormValue(formData, "title");
  const issn = readOptionalFormValue(formData, "issn");
  const impactFactor = readOptionalFormValue(formData, "impactFactor");
  const scopusQuartile = readOptionalFormValue(formData, "scopusQuartile");
  const abdcRanking = readOptionalFormValue(formData, "abdcRanking");
  const wosIndex = readOptionalFormValue(formData, "wosIndex");
  const wosQuartile = readOptionalFormValue(formData, "wosQuartile");
  const sjrQuartile = readOptionalFormValue(formData, "sjrQuartile");
  const sjrScore = readOptionalFormValue(formData, "sjrScore");
  const citeScore = readOptionalFormValue(formData, "citeScore");
  const publisher = readOptionalFormValue(formData, "publisher");
  const website = readOptionalFormValue(formData, "website");
  const safeWebsite = validateExternalUrl(website, "Website");
  const about = readOptionalFormValue(formData, "about");
  assertRichTextWithinLimit(about ?? "", MAX_JOURNAL_DESCRIPTION, "About");
  const subjectArea = readOptionalFormValue(formData, "subjectArea");
  const frequency = readOptionalFormValue(formData, "frequency");
  const openAccess = readOptionalFormValue(formData, "openAccess");

  const journal = await prisma.journal.findUnique({
    where: { id: journalId },
    select: { authorId: true },
  });

  if (!journal) {
    throw new Error("Journal not found.");
  }
  if (!(await isAuthorizedOrAdmin(journal.authorId, user.id))) {
    throw new Error("Not authorized to edit this journal.");
  }

  const updatedJournal = await prisma.journal.update({
    where: { id: journalId },
    data: {
      title,
      issn,
      impactFactor: impactFactor ? parseFloat(impactFactor) : null,
      scopusQuartile: scopusQuartile ? (scopusQuartile as Quartile) : undefined,
      abdcRanking: abdcRanking ? (abdcRanking as AbdcTier) : undefined,
      wosIndex: wosIndex ? (wosIndex as WosIndex) : undefined,
      wosQuartile: wosQuartile ? (wosQuartile as Quartile) : undefined,
      sjrQuartile: sjrQuartile ? (sjrQuartile as Quartile) : undefined,
      sjrScore: sjrScore ? parseFloat(sjrScore) : null,
      citeScore: citeScore ? parseFloat(citeScore) : null,
      publisher,
      website: safeWebsite,
      about,
      subjectArea,
      frequency,
      openAccess: openAccess ? (openAccess as OpenAccessStatus) : undefined,
      editedAt: new Date(),
    },
  });

  // Purge the cached journal pages: edit must be visible at once, not after the TTL.
  revalidateContent("JOURNAL");

  return { success: true, data: updatedJournal };
}

export async function deleteJournal(journalId: string) {
  const user = await requireActiveUser("Log in to delete this journal.");
  await enforceRateLimit({ namespace: "journal:delete", key: user.id, limit: 20, window: "10 m" });

  const journal = await prisma.journal.findUnique({
    where: { id: journalId },
    select: { authorId: true, totalVotes: true },
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
       data: { journalCount: { decrement: 1 }, reputation: { decrement: 1 } },
     });

     if (journal.totalVotes !== 0) {
      await tx.user.update({
        where: { id: journal.authorId },
        data: { reputation: { decrement: journal.totalVotes } },
      });
    }
  });

  // Purge the cached journal pages: soft delete must be visible at once, not after the TTL.
  revalidateContent("JOURNAL");

  return { success: true, data: { deletedId: journalId } };
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
    return prisma.journal.findUniqueOrThrow({
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

/** Lightweight, indexed picker search used when linking a publication. */
export async function searchJournalsForPicker(
  query: string,
  limit = 6,
): Promise<JournalPickerResult[]> {
  const term = query.trim();
  if (term.length < 2) return [];

  const safeLimit = Math.min(10, Math.max(1, Math.floor(limit)));
  try {
    return await prisma.$queryRaw<JournalPickerResult[]>`
      SELECT "id", "title", "publisher", "issn"
      FROM "Journal"
      WHERE "isDeleted" = false
        AND (
          LOWER("issn") = LOWER(${term})
          OR LOWER("issn") LIKE LOWER(${term}) || '%'
          OR LOWER("title") LIKE LOWER(${term}) || '%'
          OR LOWER("publisher") LIKE LOWER(${term}) || '%'
          OR similarity("title", ${term}) > 0.18
          OR word_similarity(${term}, "title") > 0.18
          OR word_similarity(${term}, "publisher") > 0.18
          OR similarity("publisher", ${term}) > 0.18
          OR to_tsvector('simple', COALESCE("title", '') || ' ' || COALESCE("publisher", '') || ' ' || COALESCE("about", '') || ' ' || COALESCE("subjectArea", ''))
             @@ plainto_tsquery('simple', ${term})
        )
      ORDER BY
        CASE WHEN LOWER("issn") = LOWER(${term}) THEN 0
             WHEN LOWER("issn") LIKE LOWER(${term}) || '%' THEN 1
             WHEN LOWER("title") = LOWER(${term}) THEN 2
             WHEN LOWER("title") LIKE LOWER(${term}) || '%' THEN 3
             ELSE 4 END,
        GREATEST(similarity("title", ${term}), similarity("publisher", ${term})) DESC,
        "createdAt" DESC
      LIMIT ${safeLimit}
    `;
  } catch (error) {
    // Keep the picker usable if a deployment has not yet installed pg_trgm.
    console.error("Optimized journal picker search failed; using fallback:", error);
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
}
