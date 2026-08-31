"use server";

import { cache } from "react";

import { Prisma, PublicationType } from "@prisma/client";
import prisma from "@/lib/db";
import { resolvePostDeletePermission } from "@/lib/deletion";
import { requireCurrentUser, isAuthorizedOrAdmin } from "@/lib/auth";
import { readFormValue, readOptionalFormValue } from "@/lib/form";
import { notifyFollowersOfActivity } from "@/lib/notifications";
import { COMMENT_PAGE_SIZE } from "@/lib/constants";

export async function createPublication(formData: FormData) {
  const user = await requireCurrentUser(
    "Please log in to submit a publication.",
  );

  const title = readFormValue(formData, "title");
  const authors = readFormValue(formData, "authors");
  const publicationType = readFormValue(
    formData,
    "publicationType",
  ) as PublicationType;
  const journalOrConference = readOptionalFormValue(
    formData,
    "journalOrConference",
  );
  const publisher = readOptionalFormValue(formData, "publisher");
  const year = readOptionalFormValue(formData, "year");
  const volume = readOptionalFormValue(formData, "volume");
  const issue = readOptionalFormValue(formData, "issue");
  const pages = readOptionalFormValue(formData, "pages");
  const doi = readOptionalFormValue(formData, "doi");
  const isbn = readOptionalFormValue(formData, "isbn");
  const url = readOptionalFormValue(formData, "url");
  const keywords = readOptionalFormValue(formData, "keywords");
  const domain = readOptionalFormValue(formData, "domain");
  const abstract = readOptionalFormValue(formData, "abstract");
  const isUserAuthor = readOptionalFormValue(formData, "isUserAuthor") === "on";

  const publication = await prisma.$transaction(async (tx) => {
    const newPublication = await tx.publication.create({
      data: {
        title,
        authors,
        publicationType,
        journalOrConference,
        publisher,
        year: year ? parseInt(year) : null,
        volume,
        issue,
        pages,
        doi,
        isbn,
        url,
        keywords,
        domain,
        abstract,
        isUserAuthor,
        authorId: user.id,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            handle: true,
            avatarUrl: true,
            followers: { where: { followerId: user.id }, select: { followerId: true } },
          },
        },
        votes: { where: { userId: user.id }, select: { voteType: true } },
      },
    });

    await tx.userActivity.create({
      data: {
        userId: user.id,
        action: "PUBLISHED",
        moduleType: "PUBLICATION",
        entityId: newPublication.id,
        entityTitle: newPublication.title,
      },
    });

    await tx.user.update({
      where: { id: user.id },
      data: { publicationCount: { increment: 1 }, reputation: { increment: 1 } },
    });

    return newPublication;
  });

  await notifyFollowersOfActivity({
    actorId: user.id,
    type: "content-published",
    targetType: "Publication",
    targetId: publication.id,
    title: `${user.email?.split("@")[0] || "Someone"} published a new paper`,
    body: `${title}${journalOrConference ? ` (${journalOrConference})` : ""}`,
  });

  return { success: true, data: publication };
}

export async function updatePublication(
  formData: FormData,
  publicationId: string,
) {
  const user = await requireCurrentUser("Log in to edit this publication.");

  const title = readFormValue(formData, "title");
  const authors = readFormValue(formData, "authors");
  const publicationType = readFormValue(
    formData,
    "publicationType",
  ) as PublicationType;
  const journalOrConference = readOptionalFormValue(
    formData,
    "journalOrConference",
  );
  const publisher = readOptionalFormValue(formData, "publisher");
  const year = readOptionalFormValue(formData, "year");
  const volume = readOptionalFormValue(formData, "volume");
  const issue = readOptionalFormValue(formData, "issue");
  const pages = readOptionalFormValue(formData, "pages");
  const doi = readOptionalFormValue(formData, "doi");
  const isbn = readOptionalFormValue(formData, "isbn");
  const url = readOptionalFormValue(formData, "url");
  const keywords = readOptionalFormValue(formData, "keywords");
  const domain = readOptionalFormValue(formData, "domain");
  const abstract = readOptionalFormValue(formData, "abstract");
  const isUserAuthor = readOptionalFormValue(formData, "isUserAuthor") === "on";

  const publication = await prisma.publication.findUnique({
    where: { id: publicationId },
    select: { authorId: true },
  });

  if (!publication) {
    throw new Error("Publication not found.");
  }
  if (!(await isAuthorizedOrAdmin(publication.authorId, user.id))) {
    throw new Error("Not authorized to edit this publication.");
  }

  const updatedPublication = await prisma.publication.update({
    where: { id: publicationId },
    data: {
      title,
      authors,
      publicationType,
      journalOrConference,
      publisher,
      year: year ? parseInt(year) : null,
      volume,
      issue,
      pages,
      doi,
      isbn,
      url,
      keywords,
      domain,
      abstract,
      isUserAuthor,
      editedAt: new Date(),
    },
  });

  return { success: true, data: updatedPublication };
}

export async function deletePublication(publicationId: string) {
  const user = await requireCurrentUser("Log in to delete this publication.");

  const publication = await prisma.publication.findUnique({
    where: { id: publicationId },
    select: { authorId: true, totalVotes: true },
  });

  if (!publication) {
    throw new Error("Publication not found.");
  }
  const deletedByType = await resolvePostDeletePermission(
    user.id,
    publication.authorId,
  );

  await prisma.$transaction(async (tx) => {
    await tx.publication.update({
      where: { id: publicationId },
      data: { isDeleted: true, deletedByType, deletedById: user.id },
    });

     await tx.user.update({
       where: { id: publication.authorId },
       data: { publicationCount: { decrement: 1 }, reputation: { decrement: 1 } },
     });

     if (publication.totalVotes !== 0) {
      await tx.user.update({
        where: { id: publication.authorId },
        data: { reputation: { decrement: publication.totalVotes } },
      });
    }
  });

  return { success: true, data: { deletedId: publicationId } };
}

export async function getPublications(
  q?: string,
  userId?: string,
  limit = 10,
  cursor?: string,
) {
  const where: Prisma.PublicationWhereInput = {
    isDeleted: false,
    ...(q && {
      OR: [
        { title: { contains: q, mode: Prisma.QueryMode.insensitive } },
        { authors: { contains: q, mode: Prisma.QueryMode.insensitive } },
        { keywords: { contains: q, mode: Prisma.QueryMode.insensitive } },
        { domain: { contains: q, mode: Prisma.QueryMode.insensitive } },
        {
          journalOrConference: {
            contains: q,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        { abstract: { contains: q, mode: Prisma.QueryMode.insensitive } },
      ],
    }),
  };

  return prisma.publication.findMany({
    where,
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
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
      author: {
        select: {
          id: true,
          name: true,
          handle: true,
          avatarUrl: true,
          followers: userId
            ? { where: { followerId: userId }, select: { followerId: true } }
            : false,
        },
      },
      totalVotes: true,
      isFrozen: true,
      hasActiveAppeal: true,
      totalComments: true,
      votes: userId ? { where: { userId }, select: { voteType: true } } : false,
    },
  });
}

export const getPublicationById = cache(
  async (publicationId: string, userId?: string) => {
    return prisma.publication.findUniqueOrThrow({
      where: {
        id: publicationId,
        isDeleted: false,
      },
      select: {
        id: true,
        title: true,
        authors: true,
        publicationType: true,
        journalOrConference: true,
        publisher: true,
        year: true,
        volume: true,
        issue: true,
        pages: true,
        doi: true,
        isbn: true,
        url: true,
        keywords: true,
        domain: true,
        abstract: true,
        isUserAuthor: true,
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
        isFrozen: true,
        hasActiveAppeal: true,
        totalComments: true,
        votes: userId
          ? { where: { userId }, select: { voteType: true } }
          : false,
        comments: {
          where: { parentId: null, isDeleted: false },
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
                avatarUrl: true,
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
