/** Public visibility predicate shared by detail queries and list loaders. */
export function engagedContentWhere(...counterKeys: string[]) {
  return {
    OR: [
      { isDeleted: false },
      {
        isDeleted: true,
        OR: counterKeys.map((key) => ({ [key]: { gt: 0 } })),
      },
    ],
  };
}

type DeletedCounters = {
  totalComments?: number | null;
  reviewCount?: number | null;
  totalResponses?: number | null;
  recommendationCount?: number | null;
};

/**
 * After a detail-page delete, stay on the page when the tombstone remains
 * readable; otherwise the row would 404 on refresh, so fall back to the list.
 * Each delete action returns only the counters its module is engaged by.
 */
export function deletedDetailNavigation(
  counters: DeletedCounters | null | undefined,
  redirectTo: string,
  invalidateQueries: unknown[][],
) {
  const engaged =
    (counters?.totalComments ?? 0) > 0 ||
    (counters?.reviewCount ?? 0) > 0 ||
    (counters?.totalResponses ?? 0) > 0 ||
    (counters?.recommendationCount ?? 0) > 0;
  return engaged
    ? ({ refresh: true } as const)
    : { redirect: redirectTo, invalidateQueries };
}

