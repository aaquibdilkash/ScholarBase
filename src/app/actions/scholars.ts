"use server";

import prisma from "@/lib/db";
import { loadContentPage } from "@/lib/tri-split/modules/registry";
import { getCurrentUser } from "@/lib/auth";
import { isSearchableQuery } from "@/lib/search-guard";
import { allowSearchRequest } from "@/lib/search-rate-limit";
import type { Scholar } from "@/types/scholar";

/**
 * Loads one page of the scholar directory for the *current* viewer.
 *
 * Identity comes from the session, server-side — never from a client argument.
 * (This loader used to accept `currentUserId` from the browser, so any caller
 * could read any other user's follow relationships.)
 *
 * The cached batch + single-statement live overlay are configured under the
 * `SCHOLAR_DIRECTORY` key in `@/lib/tri-split/modules/registry`, like every
 * other listing page.
 */
export async function getScholars(
  q?: string,
  sort: "latest" | "reputation" = "latest",
  limit = 10,
  cursor?: string,
) {
  // `latest` and `reputation` sort by different indexed columns on `User`, so
  // they are separate loaders with disjoint cache-key spaces. The variant index
  // picks between them — it must never be derived from a shared key part, or a
  // reputation-sorted request could be served latest-sorted rows.
  return loadContentPage("SCHOLAR_DIRECTORY", {
    query: q,
    pageSize: limit,
    cursor,
    variant: sort === "reputation" ? 1 : 0,
  }) as unknown as Promise<Scholar[]>;
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
  // P0-3: shared floor (3), not a local 2 — raw-SQL trigram search over every
  // user row, so it must not be easier to spam than the feed search.
  if (!isSearchableQuery(term)) return [];
  if (!(await allowSearchRequest("picker:scholar", (await getCurrentUser())?.id))) {
    return [];
  }

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
