"use server";

import type { CourseWithAuthor } from "@/types/cards";

import {
  loadContentPage,
  revalidateContent,
} from "@/lib/tri-split/modules/registry";

import { cache } from "react";

import prisma from "@/lib/db";
import { resolvePostDeletePermission } from "@/lib/deletion";
import { getActiveUser, requireCurrentUser, isAuthorizedOrAdmin } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { readFormValue, assertRichTextWithinLimit } from "@/lib/form";
import { notifyFollowersOfActivity } from "@/lib/notifications";
import { validateExternalUrl } from "@/lib/external-url";
import { COMMENT_PAGE_SIZE, MAX_COURSE_DESCRIPTION } from "@/lib/constants";
import { VISIBLE_PARENT_COMMENT_WHERE } from "@/lib/comment-visibility";
import { engagedContentWhere } from "@/lib/content-tombstone";

export async function createCourse(formData: FormData) {
  const auth = await getActiveUser("Please log in to share a course.");
  if (auth.frozen) return { success: false, error: auth.message, message: auth.message };
  const user = auth.user;
  await enforceRateLimit({ namespace: "course:create", key: user.id, limit: 10, window: "10 m" });

  const title = readFormValue(formData, "title");
  const provider = readFormValue(formData, "provider");
  const instructor = readFormValue(formData, "instructor");
  const format = readFormValue(formData, "format");
  const level = readFormValue(formData, "level");
  const priceRaw = readFormValue(formData, "price");
  const durationValueRaw = readFormValue(formData, "durationValue");
  const durationUnit = readFormValue(formData, "durationUnit");
  const link = readFormValue(formData, "link");
  let safeLink: string | null;
  try {
    safeLink = validateExternalUrl(link, "Course link");
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "Invalid URL." };
  }
  let price: number | null = null;
  if (priceRaw.length > 0) {
    const parsed = Number(priceRaw);
    if (Number.isNaN(parsed) || parsed < 0) {
      return { success: false, message: "Price must be a valid number." };
    }
    price = Math.floor(parsed);
  }

  let duration: string | null = null;
  if (durationValueRaw.length > 0 && durationUnit.length > 0) {
    const dv = Number(durationValueRaw);
    if (Number.isNaN(dv) || dv < 0) {
      return { success: false, message: "Duration must be a valid number." };
    }
    duration = `${Math.floor(dv)} ${durationUnit}`;
  }

  const description = readFormValue(formData, "description");
  assertRichTextWithinLimit(description, MAX_COURSE_DESCRIPTION, "Description");

  const course = await prisma.$transaction(async (tx) => {
    const newCourse = await tx.course.create({
      data: {
        title,
        provider: provider || null,
        instructor: instructor || null,
        format: format || null,
        level: level || null,
        price,
        duration,
        link: safeLink ?? "",
        description,
        authorId: user.id,
      },
      include: { author: { select: { id: true, name: true, handle: true, avatarUrl: true, institutionVerifiedAt: true, followers: { where: { followerId: user.id }, select: { followerId: true } } } }, votes: { where: { userId: user.id }, select: { voteType: true } }, bookmarks: { where: { userId: user.id }, select: { id: true } } },
    });

    await tx.userActivity.create({
      data: {
        userId: user.id,
        action: "PUBLISHED",
        moduleType: "COURSE",
        entityId: newCourse.id,
        entityTitle: newCourse.title,
      },
    });

    await tx.user.update({
      where: { id: user.id },
      data: { courseCount: { increment: 1 } },
    });

    return newCourse;
  });

  await notifyFollowersOfActivity({
    actorId: user.id,
    type: "content-published",
    targetType: "Course",
    targetId: course.id,
    title: `${user.email?.split("@")[0] || "Someone"} shared a research course`,
    body: provider ? `${title} - ${provider}` : title,
  });

  // Purge the cached course pages: publish must be visible at once, not after the TTL.
  revalidateContent("COURSE", user.id);

  return { success: true, data: course };
}

export async function updateCourse(formData: FormData, courseId: string) {
  // Frozen owners may edit (to correct content before appealing).
  const user = await requireCurrentUser("Log in to edit this course.");
  await enforceRateLimit({ namespace: "course:edit", key: user.id, limit: 20, window: "10 m" });

  const title = readFormValue(formData, "title");
  const provider = readFormValue(formData, "provider");
  const instructor = readFormValue(formData, "instructor");
  const format = readFormValue(formData, "format");
  const level = readFormValue(formData, "level");
  const priceRaw = readFormValue(formData, "price");
  const durationValueRaw = readFormValue(formData, "durationValue");
  const durationUnit = readFormValue(formData, "durationUnit");
  const link = readFormValue(formData, "link");
  let safeLink: string | null;
  try {
    safeLink = validateExternalUrl(link, "Course link");
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "Invalid URL." };
  }
  let price: number | null = null;
  if (priceRaw.length > 0) {
    const parsed = Number(priceRaw);
    if (Number.isNaN(parsed) || parsed < 0) {
      return { success: false, message: "Price must be a valid number." };
    }
    price = Math.floor(parsed);
  }

  let duration: string | null = null;
  if (durationValueRaw.length > 0 && durationUnit.length > 0) {
    const dv = Number(durationValueRaw);
    if (Number.isNaN(dv) || dv < 0) {
      return { success: false, message: "Duration must be a valid number." };
    }
    duration = `${Math.floor(dv)} ${durationUnit}`;
  }

  const description = readFormValue(formData, "description");
  assertRichTextWithinLimit(description, MAX_COURSE_DESCRIPTION, "Description");

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { authorId: true },
  });

  if (!course) {
    throw new Error("Course not found.");
  }
  if (!(await isAuthorizedOrAdmin(course.authorId, user.id))) {
    throw new Error("Not authorized to edit this course.");
  }

  const updatedCourse = await prisma.course.update({
    where: { id: courseId },
    data: {
      title,
      provider: provider || null,
      instructor: instructor || null,
      format: format || null,
      level: level || null,
      price,
      duration,
      link: safeLink ?? "",
      description,
      editedAt: new Date(),
    },
  });

  // Purge the cached course pages: edit must be visible at once, not after the TTL.
  revalidateContent("COURSE", course.authorId);

  return { success: true, data: updatedCourse };
}

export async function deleteCourse(courseId: string) {
  // Frozen owners may delete own content (read/edit/delete allowed, create blocked).
  const user = await requireCurrentUser("Log in to delete this course.");
  await enforceRateLimit({ namespace: "course:delete", key: user.id, limit: 20, window: "10 m" });

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { authorId: true, totalVotes: true, totalComments: true },
  });

  if (!course) {
    throw new Error("Course not found.");
  }
  const deletedByType = await resolvePostDeletePermission(
    user.id,
    course.authorId,
  );

  await prisma.$transaction(async (tx) => {
    await tx.course.update({
      where: { id: courseId },
      data: { isDeleted: true, deletedByType, deletedById: user.id },
    });

     await tx.user.update({
       where: { id: course.authorId },
       data: { courseCount: { decrement: 1 } },
     });

     if (course.totalVotes !== 0) {
      await tx.user.update({
        where: { id: course.authorId },
        data: { reputation: { decrement: course.totalVotes } },
      });
    }
  });

  // Purge the cached course pages: soft delete must be visible at once, not after the TTL.
  revalidateContent("COURSE", course.authorId);

  return { success: true, data: { deletedId: courseId, isDeleted: true as const, deletedByType, totalComments: course.totalComments } };
}

/**
 * Loads one page of course rows for the
 * *current* viewer.
 *
 * Identity comes from the session, server-side — never from a client argument.
 * (This loader used to accept `userId` from the browser, so any caller could
 * read another user's vote / bookmark / follow state.)
 *
 * The cached viewer-agnostic batch plus the single-statement live overlay live
 * in `@/lib/tri-split/modules/registry`.
 */
export async function getCourses(
  q?: string,
  limit = 10,
  cursor?: string,
) {
  return loadContentPage("COURSE", { query: q, pageSize: limit, cursor }) as Promise<
  CourseWithAuthor[]
>;
}

export const getCourseById = cache(
  async (courseId: string, userId?: string) => {
    return prisma.course.findUnique({
      where: { id: courseId, ...engagedContentWhere("totalComments") },
      select: {
        id: true,
        title: true,
        provider: true,
        instructor: true,
        format: true,
        level: true,
        price: true,
        duration: true,
        link: true,
        description: true,
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
              ? { where: { followerId: userId }, select: { followerId: true } }
              : false,
          },
        },
        totalVotes: true,
        totalBookmarks: true,
        isFrozen: true,
        hasActiveAppeal: true,
        isDeleted: true,
        deletedByType: true,
        totalComments: true,
        votes: userId
          ? { where: { userId }, select: { userId: true, voteType: true } }
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
              ? { where: { userId }, select: { userId: true, voteType: true } }
              : false,
            mentions: true,
          },
        },
      },
    });
  },
);
