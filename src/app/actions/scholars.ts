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


export type ScholarPickerResult = {
  id: string;
  name: string | null;
  handle: string | null;
  avatarUrl: string | null;
  institutionVerifiedAt: Date | null;
};

/** Lightweight, indexed picker search used by mentions and publication authors. */
export async function searchScholarsForPicker(
  query: string,
  limit = 6,
): Promise<ScholarPickerResult[]> {
  const term = query.trim();
  if (term.length < 2) return [];

  const safeLimit = Math.min(10, Math.max(1, Math.floor(limit)));
  return prisma.$queryRaw<ScholarPickerResult[]>`
    SELECT "id", "name", "handle", "avatarUrl", "institutionVerifiedAt"
    FROM "User"
    WHERE "isDeleted" = false
      AND (
        LOWER("handle") = LOWER(${term})
        OR LOWER("handle") LIKE LOWER(${term}) || '%'
        OR similarity("handle", ${term}) > 0.25
        OR similarity("name", ${term}) > 0.25
        OR to_tsvector('simple', COALESCE("name", '') || ' ' || COALESCE("bio", ''))
           @@ plainto_tsquery('simple', ${term})
      )
    ORDER BY
      CASE WHEN LOWER("handle") = LOWER(${term}) THEN 0
           WHEN LOWER("handle") LIKE LOWER(${term}) || '%' THEN 1
           WHEN LOWER("name") LIKE LOWER(${term}) || '%' THEN 2
           ELSE 3 END,
      GREATEST(similarity("handle", ${term}), similarity("name", ${term})) DESC,
      "createdAt" DESC
    LIMIT ${safeLimit}
  `;
}
