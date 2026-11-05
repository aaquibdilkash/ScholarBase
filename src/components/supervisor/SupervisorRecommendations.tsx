"use client";

import { useQuery } from "@tanstack/react-query";
import { PagedCarousel } from "@/components/ui/PagedCarousel";
import { RecommendationCard } from "@/components/supervisor/RecommendationCard";
import { getSupervisorRecommendations } from "@/app/actions/supervisors";
import type { RecommendationWithAuthor } from "@/types/cards";
import { recommendationCountKey, RecommendationAggregates } from "./recommendationCount";

export function SupervisorRecommendations({
  initialRecommendations,
  initialVisibleCount,
  supervisor,
  currentUserId,
}: {
  initialRecommendations: RecommendationWithAuthor[];
  /** Live + engaged tombstones — the carousel's paging bound. */
  initialVisibleCount: number;
  supervisor: { id: string; name: string | null };
  currentUserId?: string;
}) {
  // Reactive slide count (kept on an engaged delete) so hasMore stays in sync
  // without a server re-fetch.
  const { data: aggregate } = useQuery<RecommendationAggregates>({
    queryKey: recommendationCountKey(supervisor.id),
    queryFn: () =>
      Promise.resolve({
        count: initialVisibleCount,
        ratingSum: 0,
        dist: {},
        slides: initialVisibleCount,
      }),
    enabled: false,
    initialData: {
      count: initialVisibleCount,
      ratingSum: 0,
      dist: {},
      slides: initialVisibleCount,
    },
  });
  const visibleCount = aggregate?.slides ?? initialVisibleCount;

  return (
    <PagedCarousel<RecommendationWithAuthor>
      queryKey={["recommendations", supervisor.id]}
      initialItems={initialRecommendations}
      visibleCount={visibleCount}
      fetchPage={(skip, take) =>
        getSupervisorRecommendations(supervisor.id, skip, take)
      }
      errorLabel="recommendations"
      renderItem={(r) => (
        <RecommendationCard
          key={r.id}
          recommendation={r}
          supervisor={supervisor}
          currentUserId={currentUserId}
        />
      )}
    />
  );
}
