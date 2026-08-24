"use client";

import { useQuery } from "@tanstack/react-query";
import { SupervisorRecommendations } from "./SupervisorRecommendations";
import { recommendationCountKey, RecommendationAggregates } from "./recommendationCount";
import type { RecommendationWithAuthor } from "@/types/cards";

/**
 * Server value for the initial paint, then the count re-derives from the
 * shared ["recommendationCount", id] cache that every mutation keeps in sync.
 * Deletes decrement it, create resets it so the next server render reseeds.
 */
export function RecommendationsSection({
  supervisorId,
  supervisorName,
  initialRecommendations,
  initialCount,
  currentUserId,
}: {
  supervisorId: string;
  supervisorName: string | null;
  initialRecommendations: RecommendationWithAuthor[];
  initialCount: number;
  currentUserId?: string;
}) {
  // Subscribes to the shared aggregates store (``{ count, ratingSum, dist }``).
  // Falls back to the server-provided initialCount when the cache is empty.
  const { data: aggregate } = useQuery<RecommendationAggregates>({
    queryKey: recommendationCountKey(supervisorId),
    queryFn: () =>
      Promise.resolve({
        count: initialCount,
        ratingSum: 0,
        dist: {},
      }),
    enabled: false,
    initialData: {
      count: initialCount,
      ratingSum: 0,
      dist: {},
    },
  });
  const total = aggregate?.count ?? initialCount;

  return (
    <div className="space-y-4 sm:space-y-6 mb-4 sm:mb-6">
      <h3
        className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 mb-4 sm:mb-6"
        id="recommendations"
      >
        Recommendations ({total})
      </h3>
      {total === 0 ? (
        <p className="text-slate-500 bg-white p-8 rounded-2xl border border-slate-200/60 text-center">
          No recommendations yet. Be the first to share your experience!
        </p>
      ) : (
        <SupervisorRecommendations
          initialRecommendations={initialRecommendations}
          totalCount={total}
          supervisor={{ id: supervisorId, name: supervisorName }}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
}