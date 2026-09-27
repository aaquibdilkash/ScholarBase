"use client";

import { useQuery } from "@tanstack/react-query";
import { PagedCarousel } from "@/components/ui/PagedCarousel";
import { RecommendationCard } from "@/components/supervisor/RecommendationCard";
import { getSupervisorRecommendations } from "@/app/actions/supervisors";
import type { RecommendationWithAuthor } from "@/types/cards";
import { recommendationCountKey, RecommendationAggregates } from "./recommendationCount";

export function SupervisorRecommendations({
  initialRecommendations,
  totalCount,
  supervisor,
  currentUserId,
}: {
  initialRecommendations: RecommendationWithAuthor[];
  totalCount: number;
  supervisor: { id: string; name: string | null };
  currentUserId?: string;
}) {
  // Reactive total count (decremented on delete) so the carousel's hasMore
  // and any count display stay in sync without a server re-fetch.
  const { data: aggregate } = useQuery<RecommendationAggregates>({
    queryKey: recommendationCountKey(supervisor.id),
    queryFn: () =>
      Promise.resolve({
        count: totalCount,
        ratingSum: 0,
        dist: {},
      }),
    enabled: false,
    initialData: { count: totalCount, ratingSum: 0, dist: {} },
  });
  const reactiveTotal = aggregate?.count ?? totalCount;

  return (
    <PagedCarousel<RecommendationWithAuthor>
      queryKey={["recommendations", supervisor.id]}
      initialItems={initialRecommendations}
      totalCount={reactiveTotal}
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
