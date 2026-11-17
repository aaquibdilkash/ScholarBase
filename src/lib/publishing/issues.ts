/**
 * Volume/issue grouping, with no database and no React.
 *
 * Kept out of `public.ts` so the ordering rules — which decide what a reader
 * sees as the current issue and where a paper sits in a table of contents — are
 * unit-testable without mocking Prisma.
 */

/** The only columns grouping needs; any article row satisfies this. */
export type IssueLike = {
  volume: number | null;
  issue: number | null;
  firstPage: string | null;
  publishedAt: Date | null;
};

export type IssueGroupOf<T extends IssueLike> = {
  /** `null` when the paper was published online ahead of an issue. */
  volume: number | null;
  issue: number | null;
  articles: T[];
  /** Latest publication date in the group, used for ordering. */
  latest: Date | null;
};

function compareIssues<T extends IssueLike>(
  a: IssueGroupOf<T>,
  b: IssueGroupOf<T>,
): number {
  // Online-first (no volume) sorts first: it is the newest material.
  if (a.volume === null && b.volume !== null) return -1;
  if (a.volume !== null && b.volume === null) return 1;
  if ((a.volume ?? 0) !== (b.volume ?? 0)) return (b.volume ?? 0) - (a.volume ?? 0);
  return (b.issue ?? 0) - (a.issue ?? 0);
}

/**
 * Groups published papers into volumes/issues.
 *
 * Within an issue, articles are ordered by `firstPage` (a real table of
 * contents) and by publication date otherwise. A missing page sorts after the
 * paginated items, so an unpaginated editorial does not jump ahead of the lead
 * article. Page comparison is numeric-aware: `"9"` sorts before `"10"`, which
 * plain string comparison gets wrong.
 */
export function groupIssueArticles<T extends IssueLike>(
  articles: readonly T[],
): IssueGroupOf<T>[] {
  const groups = new Map<string, IssueGroupOf<T>>();

  for (const article of articles) {
    const key = `${article.volume ?? "online"}:${article.issue ?? "online"}`;
    const existing = groups.get(key);

    if (existing) {
      existing.articles.push(article);
      if (
        article.publishedAt &&
        (!existing.latest || article.publishedAt > existing.latest)
      ) {
        existing.latest = article.publishedAt;
      }
      continue;
    }

    groups.set(key, {
      volume: article.volume,
      issue: article.issue,
      articles: [article],
      latest: article.publishedAt ?? null,
    });
  }

  for (const group of groups.values()) {
    group.articles.sort((a, b) => {
      if (a.firstPage && b.firstPage) {
        return a.firstPage.localeCompare(b.firstPage, undefined, { numeric: true });
      }
      if (a.firstPage) return -1;
      if (b.firstPage) return 1;
      return (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0);
    });
  }

  return [...groups.values()].sort(compareIssues);
}

/** Volume/issue counts for the archive sidebar and the venue masthead. */
export function countIssues<T extends IssueLike>(
  issues: readonly IssueGroupOf<T>[],
): {
  articleCount: number;
  volumeCount: number;
  issueCount: number;
} {
  const volumes = new Set<number>();
  let issueCount = 0;

  for (const group of issues) {
    if (group.volume !== null) volumes.add(group.volume);
    if (group.volume !== null || group.issue !== null) issueCount += 1;
  }

  return {
    articleCount: issues.reduce((total, group) => total + group.articles.length, 0),
    volumeCount: volumes.size,
    issueCount,
  };
}
