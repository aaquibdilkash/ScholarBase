"use client";

import { useQuery } from "@tanstack/react-query";
import { SupervisorRecommendations } from "./SupervisorRecommendations";
import { recommendationCountKey, RecommendationAggregates } from "./recommendationCount";
import type { RecommendationWithAuthor } from "@/types/cards";

/**
 * Server value for the initial paint, then the counts re-derive from the
 * shared ["recommendationCount", id] cache that every mutation keeps in sync.
 * Deletes decrement the live count; `slides` only drops when the row is
 * removed outright, so an engaged tombstone stays reachable.
 */
export function RecommendationsSection({
  supervisorId,
  supervisorName,
  initialRecommendations,
  initialCount,
  initialVisibleCount,
  currentUserId,
}: {
  supervisorId: string;
  supervisorName: string | null;
  initialRecommendations: RecommendationWithAuthor[];
  /** Live recommendations only: heading, average and star distribution. */
  initialCount: number;
  /** Live + engaged tombstones: what the carousel can page through. */
  initialVisibleCount: number;
  currentUserId?: string;
}) {
  // Subscribes to the shared aggregates store
  // (``{ count, ratingSum, dist, slides }``).
  const { data: aggregate } = useQuery<RecommendationAggregates>({
    queryKey: recommendationCountKey(supervisorId),
    queryFn: () =>
      Promise.resolve({
        count: initialCount,
        ratingSum: 0,
        dist: {},
        slides: initialVisibleCount,
      }),
    enabled: false,
    initialData: {
      count: initialCount,
      ratingSum: 0,
      dist: {},
      slides: initialVisibleCount,
    },
  });
  const total = aggregate?.count ?? initialCount;
  const slides = aggregate?.slides ?? initialVisibleCount;

  return (
    <div className="space-y-4 sm:space-y-6 mb-4 sm:mb-6">
      <h3
        className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 mb-4 sm:mb-6"
        id="recommendations"
      >
        Recommendations ({total})
      </h3>
      {slides === 0 ? (
        <p className="text-slate-500 bg-white p-8 rounded-2xl border border-slate-200/60 text-center">
          No recommendations yet. Be the first to share your experience!
        </p>
      ) : (
        <SupervisorRecommendations
          initialRecommendations={initialRecommendations}
          initialVisibleCount={slides}
          supervisor={{ id: supervisorId, name: supervisorName }}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
}
