"use server";

import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function getScholars(
  q?: string,
  sort: "latest" | "reputation" = "latest",
  currentUserId?: string,
  limit = 10,
  cursor?: string,
) {
  const orderBy: Prisma.UserOrderByWithRelationInput[] =
    sort === "reputation"
      ? [{ reputation: "desc" }, { createdAt: "desc" }]
      : [{ createdAt: "desc" }];

  return prisma.user.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: Prisma.QueryMode.insensitive } },
              { handle: { contains: q, mode: Prisma.QueryMode.insensitive } },
              { bio: { contains: q, mode: Prisma.QueryMode.insensitive } },
            ],
          }
        : {}),
      isDeleted: false, // RULE 3: exclude soft-deleted (tombstoned) scholars
    },
    select: {
      id: true,
      name: true,
      handle: true,
      avatarUrl: true, institutionVerifiedAt: true,
      bio: true,
      reputation: true,
      createdAt: true,
      // RULE 6: Read materialized counters instead of a live COUNT(*) subquery.
      followersCount: true,
      followingCount: true,
      followers: currentUserId
        ? {
            where: { followerId: currentUserId },
            select: { followerId: true },
          }
        : false,
    },
    orderBy,
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
}

export async function getScholarById(id: string) {
  return prisma.user.findUnique({
    where: { id, isDeleted: false }, // RULE 3: exclude soft-deleted (tombstoned) scholars
    select: {
      id: true,
      name: true,
      handle: true,
      avatarUrl: true, institutionVerifiedAt: true,
      bio: true,
      reputation: true,
      createdAt: true,
      // RULE 6: Read materialized counters instead of a live COUNT(*) subquery.
      followersCount: true,
      followingCount: true,
    },
  });
}
