"use server";

import prisma from "@/lib/db";
import { loadScholarsPage } from "@/lib/tri-split/modules/scholar";

/**
 * Loads one page of the scholar directory for the *current* viewer.
 *
 * Identity comes from the session, server-side — never from a client argument.
 * (This loader used to accept `currentUserId` from the browser, so any caller
 * could read any other user's follow relationships.)
 *
 * The cached batch + single-statement live overlay live in
 * `@/lib/tri-split/modules/scholar`.
 */
export async function getScholars(
  q?: string,
  sort: "latest" | "reputation" = "latest",
  limit = 10,
  cursor?: string,
) {
  return loadScholarsPage({ query: q, sort, pageSize: limit, cursor });
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
