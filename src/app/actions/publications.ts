"use server";

import type { PublicationWithAuthor } from "@/types/cards";
import type { PublicationType } from "@prisma/client";

import prisma from "@/lib/db";
import { getActiveUser, requireCurrentUser } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { readFormValue, readOptionalFormValue, assertRichTextWithinLimit } from "@/lib/form";
import { getRichTextLength } from "@/lib/html";
import { validateExternalUrl } from "@/lib/external-url";
import { notifyUserById } from "@/lib/notifications";
import { MAX_PUBLICATION_ABSTRACT } from "@/lib/constants";

type PublicationPeople = {
  authorIds: string[];
  authors: string[];
  journalId: string | null;
};

type PublicationPeopleResult =
  | { success: true; data: PublicationPeople }
  | { success: false; error: string };

async function resolvePublicationPeople(
  formData: FormData,
): Promise<PublicationPeopleResult> {
  const authorIds = readOptionalFormValue(formData, "authorIds");
  const journalId = readOptionalFormValue(formData, "journalId");
  if (!authorIds || authorIds.trim() === "") {
    return {
      success: false,
      error: "Select at least one ScholarBase author for this publication.",
    };
  }
  const authorIdList = authorIds.split(",").map((id) => id.trim()).filter(Boolean);
  const authors = await prisma.user.findMany({ where: { id: { in: authorIdList }, isDeleted: false }, select: { id: true, name: true, handle: true } });
  if (authors.length !== authorIdList.length) {
    return {
      success: false,
      error: "One or more selected authors are no longer available. Please select them again.",
    };
  }
  const journal = journalId ? await prisma.journal.findFirst({ where: { id: journalId, isDeleted: false }, select: { id: true } }) : null;
  return {
    success: true,
    data: {
      authorIds: authorIdList,
      authors: authors.map((author) => author.name || `@${author.handle}`),
      journalId: journal?.id ?? null,
    },
  };
}

export async function createPublication(formData: FormData) {
  const auth = await getActiveUser("Please log in to submit a publication.");
  if (auth.frozen) return { success: false, error: auth.message, message: auth.message };
  const user = auth.user;
  const writeLimit = await enforceRateLimit({ namespace: "publication:create", key: user.id, limit: 10, window: "10 m" });
  if (!writeLimit.allowed) return { success: false as const, error: writeLimit.error };

  const title = readFormValue(formData, "title");
  const peopleResult = await resolvePublicationPeople(formData);
  if (!peopleResult.success) return peopleResult;
  const linkedPeople = peopleResult.data;
  const authors = linkedPeople.authors.join(", ");
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
  const safeUrl = validateExternalUrl(url, "Publication URL");
  const keywords = readOptionalFormValue(formData, "keywords");
  const domain = readOptionalFormValue(formData, "domain");
  const abstract = readOptionalFormValue(formData, "abstract");
  assertRichTextWithinLimit(abstract ?? "", MAX_PUBLICATION_ABSTRACT, "Abstract");
  if (getRichTextLength(abstract ?? "") === 0) {
    return { success: false, error: "Abstract is required." };
  }

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
        url: safeUrl,
        keywords,
        domain,
        abstract,
        authorId: user.id,
        journalId: linkedPeople.journalId,
        publicationAuthors: { create: linkedPeople.authorIds.map((userId, authorOrder) => ({ userId, authorOrder })) },
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            handle: true,
            avatarUrl: true, institutionVerifiedAt: true,
            followers: { where: { followerId: user.id }, select: { followerId: true } },
          },
        },
        publicationAuthors: {
          select: {
            userId: true,
            authorOrder: true,
            user: { select: { id: true, name: true, handle: true } },
          },
          orderBy: { authorOrder: "asc" },
        },
      },
    });

    await tx.user.update({
      where: { id: user.id },
      data: { publicationCount: { increment: 1 } },
    });

    // Co-author notifications: only for scholars other than the submitter
    await Promise.all(
      linkedPeople.authorIds.filter((authorId) => authorId !== user.id).map((recipientId) =>
        notifyUserById({
          recipientId,
          actorId: user.id,
          type: "publication-author",
          targetType: "Publication",
          targetId: newPublication.id,
          title: `${user.email?.split("@")[0] || "Someone"} added you as a publication author`,
          body: title,
        }),
      ),
    );

    return newPublication;
  });

  return { success: true, data: publication };
}

export async function updatePublication(
  formData: FormData,
  publicationId: string,
) {
  // Frozen owners may edit (to correct content before appealing).
  const user = await requireCurrentUser("Log in to edit this publication.");
  const writeLimit = await enforceRateLimit({ namespace: "publication:edit", key: user.id, limit: 20, window: "10 m" });
  if (!writeLimit.allowed) return { success: false as const, error: writeLimit.error };

  const title = readFormValue(formData, "title");
  const peopleResult = await resolvePublicationPeople(formData);
  if (!peopleResult.success) return peopleResult;
  const linkedPeople = peopleResult.data;
  const authors = linkedPeople.authors.join(", ");
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
  const safeUrl = validateExternalUrl(url, "Publication URL");
  const keywords = readOptionalFormValue(formData, "keywords");
  const domain = readOptionalFormValue(formData, "domain");
  const abstract = readOptionalFormValue(formData, "abstract");
  assertRichTextWithinLimit(abstract ?? "", MAX_PUBLICATION_ABSTRACT, "Abstract");
  if (getRichTextLength(abstract ?? "") === 0) {
    return { success: false, error: "Abstract is required." };
  }

  const publication = await prisma.publication.findUnique({
    where: { id: publicationId },
    select: { authorId: true, publicationAuthors: { select: { userId: true } } },
  });
  if (!publication) throw new Error("Publication not found.");
  if (publication.authorId !== user.id) throw new Error("Not authorized to edit this publication.");
  const previousAuthorIds = publication.publicationAuthors.map(({ userId }) => userId);

  const updatedPublication = await prisma.$transaction(async (tx) => {
    await tx.publicationAuthor.deleteMany({ where: { publicationId } });
    return tx.publication.update({
      where: { id: publicationId },
      data: {
        title,
        journalId: linkedPeople.journalId,
        publicationAuthors: { create: linkedPeople.authorIds.map((userId, authorOrder) => ({ userId, authorOrder })) },
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
        url: safeUrl,
        keywords,
        domain,
        abstract,
        editedAt: new Date(),
      },
    });
  });

  // Notify scholars newly added as co-authors on edit
  const newlyAddedAuthorIds = linkedPeople.authorIds.filter(
    (id) => id !== user.id && !previousAuthorIds.includes(id),
  );
  if (newlyAddedAuthorIds.length > 0) {
    await Promise.all(
      newlyAddedAuthorIds.map((recipientId) =>
        notifyUserById({
          recipientId,
          actorId: user.id,
          type: "publication-author",
          targetType: "Publication",
          targetId: publicationId,
          title: `${user.email?.split("@")[0] || "Someone"} added you as a co-author`,
          body: `${title}${journalOrConference ? ` (${journalOrConference})` : ``}`,
        }),
      ),
    );
  }

  return { success: true, data: updatedPublication };
}

export async function deletePublication(publicationId: string) {
  // Frozen owners may delete own content (read/edit/delete allowed, create blocked).
  const user = await requireCurrentUser("Log in to delete this publication.");
  const writeLimit = await enforceRateLimit({ namespace: "publication:delete", key: user.id, limit: 20, window: "10 m" });
  if (!writeLimit.allowed) return { success: false as const, error: writeLimit.error };

  const publication = await prisma.publication.findUnique({
    where: { id: publicationId },
    select: { authorId: true, publicationAuthors: { select: { userId: true } } },
  });

  if (!publication) {
    throw new Error("Publication not found.");
  }
  if (user.id !== publication.authorId) {
    throw new Error("You are not the author of this publication.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.publication.update({
      where: { id: publicationId },
      data: { isDeleted: true, deletedByType: "AUTHOR", deletedById: user.id },
    });

    await tx.user.update({
      where: { id: user.id },
      data: { publicationCount: { decrement: 1 } },
    });

    // Hide this content's activity so a deleted publication stops appearing in
    // anyone's activity feed at once (not after the cache TTL).
    // Note: deleteAllNotificationsForContent no longer has a PUBLICATION path
    // since ENTITY_CONFIG.PUBLICATION was removed; we purge notifications that
    // reference this publication's id directly.
    await tx.notification.deleteMany({
      where: {
        OR: [
          { targetType: "Publication", targetId: publicationId },
        ],
      },
    });

  });

  return { success: true, data: { deletedId: publicationId, isDeleted: true as const, deletedByType: "AUTHOR" } };
}

/**
 * Loads one page of publication rows for a given profile (About tab).
 *
 * Identity comes from the session, server-side — never from a client argument.
 * Queries only publications owned by the given profileId (submitter-only).
 *
 * Order: year desc nulls last, then createdAt desc, id desc.
 * Initial take=1; load-more adds one more item per click.
 *
 * The cached viewer-agnostic batch plus the single-statement live overlay live
 * in `@/lib/tri-split/modules/registry`.
 */
export async function getProfilePublications(
  profileId: string,
  take: number = 1,
) {
  return prisma.publication.findMany({
    where: {
      authorId: profileId,
      isDeleted: false,
    },
    orderBy: [
      { year: "desc" },
      { createdAt: "desc" },
      { id: "desc" },
    ],
    take,
    select: {
      id: true,
      title: true,
      authors: true,
      publicationType: true,
      year: true,
      journalOrConference: true,
      journal: { select: { id: true, title: true } },
      publisher: true,
      doi: true,
      url: true,
      keywords: true,
      domain: true,
      abstract: true,
      createdAt: true,
      publicationAuthors: {
        select: {
          userId: true,
          authorOrder: true,
          user: { select: { id: true, name: true, handle: true } },
        },
        orderBy: { authorOrder: "asc" },
      },
    },
  }) as Promise<PublicationWithAuthor[]>;
}

/**
 * Loads the next page of publications for the About tab.
 * Increments take by 1 each click (one more item per arrow press).
 */
export async function getProfilePublicationPage(
  profileId: string,
  skip: number = 0,
  take: number = 1,
) {
  return prisma.publication.findMany({
    where: {
      authorId: profileId,
      isDeleted: false,
    },
    orderBy: [
      { year: "desc" },
      { createdAt: "desc" },
      { id: "desc" },
    ],
    skip,
    take,
    select: {
      id: true,
      title: true,
      authors: true,
      publicationType: true,
      year: true,
      journalOrConference: true,
      journal: { select: { id: true, title: true } },
      publisher: true,
      doi: true,
      url: true,
      keywords: true,
      domain: true,
      abstract: true,
      createdAt: true,
      publicationAuthors: {
        select: {
          userId: true,
          authorOrder: true,
          user: { select: { id: true, name: true, handle: true } },
        },
        orderBy: { authorOrder: "asc" },
      },
    },
  }) as Promise<PublicationWithAuthor[]>;
}

/**
 * Returns the total number of (non-deleted) publications for a profile.
 * Drives the header count and pagination "hasMore" state.
 */
export async function getProfilePublicationCount(profileId: string) {
  return prisma.publication.count({
    where: {
      authorId: profileId,
      isDeleted: false,
    },
  });
}

/**
 * Loads one page of publication rows for the
 * *current* viewer (used by the old /publications list page).
 *
 * Identity comes from the session, server-side — never from a client argument.
 * (This loader used to accept `userId` from the browser, so any caller could
 * read another user's vote / bookmark / follow state.)
 *
 * The cached viewer-agnostic batch plus the single-statement live overlay live
 * in `@/lib/tri-split/modules/registry`.
 *
 * NOTE: This loader is kept for backward compat if any code still references it,
 * but the `/publications` list page has been removed. New code should use
 * `getProfilePublications` / `getProfilePublicationPage` instead.
 */
export async function getPublications(
  q?: string,
  limit = 10,
  _cursor?: string,
) {
  return prisma.publication.findMany({
    where: {
      isDeleted: false,
      OR: [
        { title: { contains: q ?? "", mode: "insensitive" } },
        { abstract: { contains: q ?? "", mode: "insensitive" } },
        { keywords: { contains: q ?? "", mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      authors: true,
      publicationType: true,
      year: true,
      authorId: true,
      journal: { select: { id: true, title: true } },
    },
  }) as unknown as PublicationWithAuthor[];
}

export const getPublicationById = async (publicationId: string, userId?: string) => {
  return prisma.publication.findUnique({
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
      journalId: true,
      journal: { select: { id: true, title: true } },
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
      publicationAuthors: {
        select: {
          userId: true,
          authorOrder: true,
          user: { select: { id: true, name: true, handle: true } },
        },
        orderBy: { authorOrder: "asc" },
      },
    },
  });
};
