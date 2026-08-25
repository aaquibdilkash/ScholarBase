"use server";

import { cache } from "react";

import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { requireCurrentUser, isAuthorizedOrAdmin } from "@/lib/auth";
import { readFormValue, readOptionalFormValue } from "@/lib/form";
import { notifyFollowersOfActivity } from "@/lib/notifications";
import type { Quartile, AbdcTier, WosIndex } from "@prisma/client";

export async function createJournal(formData: FormData) {
  const user = await requireCurrentUser("Please log in to submit details.");

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
  const about = readOptionalFormValue(formData, "about");

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
        website,
        about,
        authorId: user.id,
      },
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
      data: { journalCount: { increment: 1 } },
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

  return { success: true, data: journal };
}

export async function updateJournal(formData: FormData, journalId: string) {
  const user = await requireCurrentUser("Log in to edit this journal.");

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
  const about = readOptionalFormValue(formData, "about");

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
      website,
      about,
      editedAt: new Date(),
    },
  });

  return { success: true, data: updatedJournal };
}

export async function deleteJournal(journalId: string) {
  const user = await requireCurrentUser("Log in to delete this journal.");

  const journal = await prisma.journal.findUnique({
    where: { id: journalId },
    select: { authorId: true, totalVotes: true },
  });

  if (!journal) {
    throw new Error("Journal not found.");
  }
  if (!(await isAuthorizedOrAdmin(journal.authorId, user.id))) {
    throw new Error("Not authorized to delete this journal.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.journal.update({
      where: { id: journalId },
      data: { isDeleted: true },
    });

    await tx.user.update({
      where: { id: journal.authorId },
      data: { journalCount: { decrement: 1 } },
    });

    if (journal.totalVotes !== 0) {
      await tx.user.update({
        where: { id: journal.authorId },
        data: { reputation: { decrement: journal.totalVotes } },
      });
    }
  });

  return { success: true, data: { deletedId: journalId } };
}

export async function getJournals(
  q?: string,
  userId?: string,
  limit = 10,
  cursor?: string,
) {
  const where: Prisma.JournalWhereInput = {
    isDeleted: false,
    ...(q && {
      OR: [
        { title: { contains: q, mode: Prisma.QueryMode.insensitive } },
        { publisher: { contains: q, mode: Prisma.QueryMode.insensitive } },
        { about: { contains: q, mode: Prisma.QueryMode.insensitive } },
        { issn: { contains: q, mode: Prisma.QueryMode.insensitive } },
      ],
    }),
  };

  return prisma.journal.findMany({
    where,
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      title: true,
      publisher: true,
      impactFactor: true,
      createdAt: true,
      updatedAt: true,
      editedAt: true,
      authorId: true,
      author: {
        select: {
          id: true,
          name: true,
          handle: true,
          avatarUrl: true,
          followers: userId
            ? {
                where: { followerId: userId },
                select: { followerId: true },
              }
            : false,
        },
      },
      totalVotes: true,
      totalComments: true,
      votes: userId ? { where: { userId }, select: { voteType: true } } : false,
    },
  });
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
        createdAt: true,
        updatedAt: true,
        editedAt: true,
        authorId: true,
        author: {
          select: {
            id: true,
            name: true,
            handle: true,
            avatarUrl: true,
            followers: userId
              ? {
                  where: { followerId: userId },
                  select: { followerId: true },
                }
              : false,
          },
        },
        totalVotes: true,
        totalComments: true,
        votes: userId
          ? { where: { userId }, select: { voteType: true } }
          : false,
        comments: {
          where: { parentId: null },
          orderBy: { createdAt: "desc" },
          select: {
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
                avatarUrl: true,
              },
            },
            totalVotes: true,
            totalReplies: true,
            votes: userId
              ? { where: { userId }, select: { voteType: true } }
              : false,
            replies: {
              orderBy: { createdAt: "asc" },
              select: {
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
                    avatarUrl: true,
                  },
                },
                totalVotes: true,
                totalReplies: true,
                votes: userId
                  ? { where: { userId }, select: { voteType: true } }
                  : false,
              },
            },
          },
        },
      },
    });
  },
);
