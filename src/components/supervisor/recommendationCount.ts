import type { QueryClient } from "@tanstack/react-query";

export type RatingDistributionRow = {
  stars: number;
  count: number;
  percentage: number;
};

export interface RecommendationAggregates {
  count: number;
  ratingSum: number;
  // Per-star distribution, 1..5
  dist: Record<number, number>;
}

// Reactive materialized recommendation aggregates, keyed per supervisor.
// All mutation paths (create / card-delete / detail-delete) keep this in sync
// so the header count, empty-state, carousel hasMore, AND the overall rating
// re-render instantly — no router.refresh() / supervisor re-fetch.
export const recommendationCountKey = (supervisorId: string) => [
  "recommendationCount",
  supervisorId,
];

const EMPTY: RecommendationAggregates = {
  count: 0,
  ratingSum: 0,
  dist: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
};

export function getRecommendationAggregates(
  queryClient: QueryClient,
  supervisorId: string,
): RecommendationAggregates {
  return (
    queryClient.getQueryData<RecommendationAggregates>(
      recommendationCountKey(supervisorId),
    ) ?? EMPTY
  );
}

export function setRecommendationAggregates(
  queryClient: QueryClient,
  supervisorId: string,
  next: Partial<RecommendationAggregates>,
) {
  const current = getRecommendationAggregates(queryClient, supervisorId);
  queryClient.setQueryData(recommendationCountKey(supervisorId), {
    ...current,
    ...next,
    count: Math.max(0, next.count ?? current.count),
  });
}

export function getRecommendationCount(
  queryClient: QueryClient,
  supervisorId: string,
): number {
  return getRecommendationAggregates(queryClient, supervisorId).count;
}

export function getRecommendationRatingSum(
  queryClient: QueryClient,
  supervisorId: string,
): number {
  return getRecommendationAggregates(queryClient, supervisorId).ratingSum;
}

// Delegated: decrement count + ratingSum + one star bucket when a single
// recommendation (with the given rating) is removed.
export function decrementRecommendation(
  queryClient: QueryClient,
  supervisorId: string,
  rating: number,
) {
  const current = getRecommendationAggregates(queryClient, supervisorId);
  const star = Math.round(rating) as 1 | 2 | 3 | 4 | 5;
  setRecommendationAggregates(queryClient, supervisorId, {
    count: current.count - 1,
    ratingSum: current.ratingSum - rating,
    dist: {
      ...current.dist,
      [star]: Math.max(0, (current.dist[star] ?? 0) - 1),
    },
  });
}

// Seed the aggregates from the server when they aren't already in the cache
// (initial render / after a reset).
export function seedRecommendationAggregates(
  queryClient: QueryClient,
  supervisorId: string,
  initialCount: number,
  initialRatingSum: number,
  initialDistribution: RecommendationAggregates["dist"],
) {
  const existing = queryClient.getQueryData<RecommendationAggregates>(
    recommendationCountKey(supervisorId),
  );
  if (existing) return existing;
  const fresh: RecommendationAggregates = {
    count: initialCount,
    ratingSum: initialRatingSum,
    dist: {
      ...EMPTY.dist,
      ...(initialDistribution ?? {}),
    },
  };
  queryClient.setQueryData(recommendationCountKey(supervisorId), fresh);
  return fresh;
}

// Drop the cached aggregates so the next page render re-seeds from the
// server's fresh value (used after creating/updating a recommendation, when
// navigating back to the supervisor detail page).
export function resetRecommendationCount(
  queryClient: QueryClient,
  supervisorId: string,
) {
  queryClient.removeQueries({ queryKey: recommendationCountKey(supervisorId) });
}