"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { StarRating } from "@/components/ui/StarRating";
import {
  recommendationCountKey,
  seedRecommendationAggregates,
  RecommendationAggregates,
  RatingDistributionRow,
} from "./recommendationCount";

/**
 * The Overall Rating card rendered on the supervisor detail page.
 * Seeded from server values, then re-derives the average, count, and star
 * bars from the shared aggregates store — every delete updates it instantly
 * with NO fetch / router.refresh.
 */
export function OverallRatingSection({
  supervisorId,
  initialCount,
  initialAvgRating,
  initialDistribution,
}: {
  supervisorId: string;
  initialCount: number;
  initialAvgRating: number;
  initialDistribution: RatingDistributionRow[];
}) {
  const queryClient = useQueryClient();

  // Seed the aggregates once (each star bucket), then observe reactively.
  const initialDist: Record<number, number> = {};
  for (const row of initialDistribution) {
    initialDist[row.stars] = row.count;
  }
  const initialRatingSum = Math.round(initialAvgRating * initialCount);

  seedRecommendationAggregates(
    queryClient,
    supervisorId,
    initialCount,
    initialRatingSum,
    initialDist,
  );

  const { data: agg } = useQuery<RecommendationAggregates>({
    queryKey: recommendationCountKey(supervisorId),
    queryFn: () =>
      Promise.resolve({
        count: initialCount,
        ratingSum: initialRatingSum,
        dist: initialDist,
      }),
    enabled: false,
    initialData: {
      count: initialCount,
      ratingSum: initialRatingSum,
      dist: initialDist,
    },
  });

  const count = agg?.count ?? initialCount;
  const ratingSum = agg?.ratingSum ?? initialRatingSum;
  const dist = agg?.dist ?? initialDist;
  const avgRating = count > 0 ? ratingSum / count : 0;

  // Preserve the server's ordering (5 → 1) for the bars.
  const rows = [5, 4, 3, 2, 1].map((stars) => {
    const c = dist[stars] ?? 0;
    return {
      stars,
      count: c,
      percentage: count > 0 ? (c / count) * 100 : 0,
    };
  });

  if (count === 0) return null;

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200/60 p-3 sm:p-4 md:p-5 lg:p-6 mb-6 sm:mb-8">
      <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 mb-3 sm:mb-4">
        Overall Rating
      </h3>
      <div className="flex flex-col md:flex-row items-center gap-2 sm:gap-3 md:gap-4">
        <div className="flex flex-col items-center justify-center text-center">
          <p className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900">
            {avgRating.toFixed(1)}
          </p>
          <StarRating rating={avgRating} size="sm" />
          <p className="text-xs sm:text-sm text-slate-500 mt-1.5 sm:mt-2">
            ({count} ratings)
          </p>
        </div>
        <div className="w-full flex-1 space-y-1 sm:space-y-1.5">
          {rows.map((item) => (
            <div
              key={item.stars}
              className="flex items-center gap-2 sm:gap-3"
            >
              <span className="text-xs sm:text-sm font-semibold text-slate-600 w-14 sm:w-16">
                {item.stars} star
              </span>
              <div className="w-full bg-slate-100 rounded-full h-1 sm:h-1.5">
                <div
                  className="bg-yellow-400 h-1 sm:h-1.5 rounded-full"
                  style={{ width: `${item.percentage}%` }}
                ></div>
              </div>
              <span className="text-xs sm:text-sm font-medium text-slate-500 w-10 sm:w-12 text-right">
                {item.count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}