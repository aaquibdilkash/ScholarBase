import prisma from "@/lib/db";

/**
 * Reviewer candidates from stated research interests.
 *
 * The only expertise signal the database actually holds is
 * `User.interests` — free text the scholar filled in themselves. Ranking on
 * keyword overlap with that field is honest about what it knows: it is a
 * shortlist to save typing, not a claim that the person is qualified. The
 * editor still decides, and the action still refuses the author and the
 * assigning editor.
 */

export type ReviewerCandidate = {
  id: string;
  name: string | null;
  email: string;
  /** Keywords from the manuscript that appear in this person's interests. */
  matched: string[];
};

const MAX_CANDIDATES = 5;

/**
 * Rank candidates by how many of the manuscript's keywords their interests
 * mention. Pure so the ordering is testable without a database.
 */
export function rankReviewerCandidates(
  candidates: {
    id: string;
    name: string | null;
    email: string;
    interests: string | null;
  }[],
  keywords: readonly string[],
  excludeIds: readonly string[] = [],
): ReviewerCandidate[] {
  const excluded = new Set(excludeIds);

  return candidates
    .map((candidate) => {
      const haystack = (candidate.interests ?? "").toLowerCase();
      const matched = keywords.filter((keyword) =>
        haystack.includes(keyword.toLowerCase()),
      );

      return { candidate, matched };
    })
    .filter(({ candidate, matched }) => {
      if (matched.length === 0) return false;
      if (excluded.has(candidate.id)) return false;
      return true;
    })
    .sort((a, b) => b.matched.length - a.matched.length)
    .slice(0, MAX_CANDIDATES)
    .map(({ candidate, matched }) => ({
      id: candidate.id,
      name: candidate.name,
      email: candidate.email,
      matched,
    }));
}

/** Shortlist for one manuscript: one indexed query, ranked in memory. */
export async function findReviewerCandidates({
  keywords,
  authorId,
  excludeIds = [],
}: {
  keywords: readonly string[];
  authorId: string;
  excludeIds?: readonly string[];
}): Promise<ReviewerCandidate[]> {
  if (keywords.length === 0) return [];

  const candidates = await prisma.user.findMany({
    where: {
      isFrozen: false,
      isDeleted: false,
      id: { notIn: [authorId, ...excludeIds] },
      interests: { not: null },
      OR: keywords.map((keyword) => ({
        interests: { contains: keyword, mode: "insensitive" as const },
      })),
    },
    select: { id: true, name: true, email: true, interests: true },
    take: 40,
  });

  return rankReviewerCandidates(candidates, keywords, [authorId, ...excludeIds]);
}
