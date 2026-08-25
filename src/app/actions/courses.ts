"use server";

import { cache } from "react";

import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { requireCurrentUser, isAuthorizedOrAdmin } from "@/lib/auth";
import { readFormValue } from "@/lib/form";
import { notifyFollowersOfActivity } from "@/lib/notifications";

export async function createCourse(formData: FormData) {
  const user = await requireCurrentUser("Please log in to share a course.");

  const title = readFormValue(formData, "title");
  const provider = readFormValue(formData, "provider");
  const instructor = readFormValue(formData, "instructor");
  const format = readFormValue(formData, "format");
  const level = readFormValue(formData, "level");
  const price = readFormValue(formData, "price");
  const duration = readFormValue(formData, "duration");
  const link = readFormValue(formData, "link");
  const description = readFormValue(formData, "description");

  const course = await prisma.$transaction(async (tx) => {
    const newCourse = await tx.course.create({
      data: {
        title,
        provider: provider || null,
        instructor: instructor || null,
        format: format || null,
        level: level || null,
        price: price || null,
        duration: duration || null,
        link,
        description,
        authorId: user.id,
      },
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

  notifyFollowersOfActivity({
    actorId: user.id,
    type: "content-published",
    targetType: "Course",
    targetId: course.id,
    title: `${user.email?.split("@")[0] || "Someone"} shared a research course`,
    body: provider ? `${title} - ${provider}` : title,
  });

  return { success: true, data: course };
}

export async function updateCourse(formData: FormData, courseId: string) {
  const user = await requireCurrentUser("Log in to edit this course.");

  const title = readFormValue(formData, "title");
  const provider = readFormValue(formData, "provider");
  const instructor = readFormValue(formData, "instructor");
  const format = readFormValue(formData, "format");
  const level = readFormValue(formData, "level");
  const price = readFormValue(formData, "price");
  const duration = readFormValue(formData, "duration");
  const link = readFormValue(formData, "link");
  const description = readFormValue(formData, "description");

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
      price: price || null,
      duration: duration || null,
      link,
      description,
      editedAt: new Date(),
    },
  });

  return { success: true, data: updatedCourse };
}

export async function deleteCourse(courseId: string) {
  const user = await requireCurrentUser("Log in to delete this course.");

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { authorId: true, totalVotes: true },
  });

  if (!course) {
    throw new Error("Course not found.");
  }
  if (!(await isAuthorizedOrAdmin(course.authorId, user.id))) {
    throw new Error("Not authorized to delete this course.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.course.update({
      where: { id: courseId },
      data: { isDeleted: true },
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

  return { success: true, data: { deletedId: courseId } };
}

export async function getCourses(
  q?: string,
  userId?: string,
  limit = 10,
  cursor?: string,
) {
  const where: Prisma.CourseWhereInput = {
    isDeleted: false,
    ...(q && {
      OR: [
        { title: { contains: q, mode: Prisma.QueryMode.insensitive } },
        { provider: { contains: q, mode: Prisma.QueryMode.insensitive } },
        { instructor: { contains: q, mode: Prisma.QueryMode.insensitive } },
        { format: { contains: q, mode: Prisma.QueryMode.insensitive } },
        { level: { contains: q, mode: Prisma.QueryMode.insensitive } },
        { description: { contains: q, mode: Prisma.QueryMode.insensitive } },
      ],
    }),
  };

  return prisma.course.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
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
      totalComments: true,
      votes: userId
        ? { where: { userId }, select: { userId: true, voteType: true } }
        : false,
    },
  });
}

export const getCourseById = cache(
  async (courseId: string, userId?: string) => {
    return prisma.course.findUniqueOrThrow({
      where: { id: courseId, isDeleted: false },
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
            avatarUrl: true,
            followers: userId
              ? { where: { followerId: userId }, select: { followerId: true } }
              : false,
          },
        },
        totalVotes: true,
        totalComments: true,
        votes: userId
          ? { where: { userId }, select: { userId: true, voteType: true } }
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
              ? { where: { userId }, select: { userId: true, voteType: true } }
              : false,
            replies: {
              orderBy: { createdAt: "asc" },
              select: {
                id: true,
                content: true,
                createdAt: true,
                updatedAt: true,
                editedAt: true,
                author: {
                  select: {
                    id: true,
                    name: true,
                    handle: true,
                    avatarUrl: true,
                  },
                },
                totalVotes: true,
                votes: userId
                  ? {
                      where: { userId },
                      select: { userId: true, voteType: true },
                    }
                  : false,
              },
            },
          },
        },
      },
    });
  },
);
