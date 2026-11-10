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
};

/**
 * Lightweight, indexed picker search used by mentions, message recipients, and
 * publication authors.
 *
 * Mirrors the user search on `/messages` and `/scholars`: one Prisma `OR` over
 * `name` and `handle` with an insensitive `contains`, which PostgreSQL serves
 * from `User_name_trgm_idx` / `User_handle_trgm_idx`.
 *
 * Deliberately no `similarity()` / `word_similarity()` branches: those are
 * function calls a pg_trgm GIN index cannot answer, and inside an `OR` a single
 * non-indexable branch forces the whole statement into a sequential scan over
 * `User`. No `bio`/`interests` branch either — a picker asks for a person by
 * name or handle, and matching long text makes common terms return most of the
 * table.
 */
export async function searchScholarsForPicker(
  query: string,
  limit = 6,
): Promise<ScholarPickerResult[]> {
  const term = query.trim();
  // P0-3: shared floor (3), not a local 2 — every search surface uses the same
  // minimum so the pickers cannot be easier to spam than the feed search.
  if (!isSearchableQuery(term)) return [];
  if (!(await allowSearchRequest("picker:scholar", (await getCurrentUser())?.id))) {
    return [];
  }

  const safeLimit = Math.min(10, Math.max(1, Math.floor(limit)));
  return prisma.user.findMany({
    where: {
      isDeleted: false,
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { handle: { contains: term, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      handle: true,
      avatarUrl: true,
    },
    orderBy: { createdAt: "desc" },
    take: safeLimit,
  });
}
