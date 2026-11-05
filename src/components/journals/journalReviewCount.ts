import type { QueryClient } from "@tanstack/react-query";

export type JournalReviewRatingDistributionRow = {
  stars: number;
  count: number;
  percentage: number;
};

export interface JournalReviewAggregates {
  count: number;
  ratingSum: number;
  // Per-star distribution, 1..5
  dist: Record<number, number>;
  /**
   * Rows the carousel can reach: live reviews + engaged tombstones. `count`
   * stays live-only (average + heading), while a delete that leaves a tombstone
   * must not remove a slide.
   */
  slides: number;
}

// Reactive materialized journal-review aggregates, keyed per journal.
// Mirrors recommendationCount.ts: every mutation path (create / card-delete /
// detail-delete) keeps this in sync so the header count, empty-state, the
// overall rating and the per-star distribution re-render instantly — no
// revalidatePath / journal re-fetch.
export const journalReviewCountKey = (journalId: string) => [
  "journalReviewCount",
  journalId,
];

const EMPTY: JournalReviewAggregates = {
  count: 0,
  ratingSum: 0,
  dist: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  slides: 0,
};

export function getJournalReviewAggregates(
  queryClient: QueryClient,
  journalId: string,
): JournalReviewAggregates {
  return (
    queryClient.getQueryData<JournalReviewAggregates>(
      journalReviewCountKey(journalId),
    ) ?? EMPTY
  );
}

export function setJournalReviewAggregates(
  queryClient: QueryClient,
  journalId: string,
  next: Partial<JournalReviewAggregates>,
) {
  const current = getJournalReviewAggregates(queryClient, journalId);
  queryClient.setQueryData(journalReviewCountKey(journalId), {
    ...current,
    ...next,
    count: Math.max(0, next.count ?? current.count),
    slides: Math.max(0, next.slides ?? current.slides),
  });
}

export function getJournalReviewCount(
  queryClient: QueryClient,
  journalId: string,
): number {
  return getJournalReviewAggregates(queryClient, journalId).count;
}

export function getJournalReviewRatingSum(
  queryClient: QueryClient,
  journalId: string,
): number {
  return getJournalReviewAggregates(queryClient, journalId).ratingSum;
}

// Delegated: decrement count + ratingSum + one star bucket when a single
// review (with the given rating) is removed. An engaged row becomes a tombstone
// instead of leaving the list, so `keepSlide` keeps it reachable.
export function decrementJournalReview(
  queryClient: QueryClient,
  journalId: string,
  rating: number,
  keepSlide = false,
) {
  const current = getJournalReviewAggregates(queryClient, journalId);
  const star = Math.round(rating) as 1 | 2 | 3 | 4 | 5;
  setJournalReviewAggregates(queryClient, journalId, {
    count: current.count - 1,
    ratingSum: current.ratingSum - rating,
    dist: {
      ...current.dist,
      [star]: Math.max(0, (current.dist[star] ?? 0) - 1),
    },
    slides: keepSlide ? current.slides : current.slides - 1,
  });
}

// Seed the aggregates from the server when they aren't already in the cache
// (initial render / after a reset).
export function seedJournalReviewAggregates(
  queryClient: QueryClient,
  journalId: string,
  initialCount: number,
  initialRatingSum: number,
  initialDistribution: JournalReviewAggregates["dist"],
  initialSlides: number = initialCount,
) {
  const existing = queryClient.getQueryData<JournalReviewAggregates>(
    journalReviewCountKey(journalId),
  );
  if (existing) return existing;
  const fresh: JournalReviewAggregates = {
    count: initialCount,
    ratingSum: initialRatingSum,
    dist: {
      ...EMPTY.dist,
      ...(initialDistribution ?? {}),
    },
    slides: initialSlides,
  };
  queryClient.setQueryData(journalReviewCountKey(journalId), fresh);
  return fresh;
}

// Drop the cached aggregates so the next render re-seeds from the server's
// fresh value (used after creating a review, when navigating back to the
// journal detail page).
export function resetJournalReviewCount(
  queryClient: QueryClient,
  journalId: string,
) {
  queryClient.removeQueries({ queryKey: journalReviewCountKey(journalId) });
}
