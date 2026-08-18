"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Carousel } from "@/components/ui/Carousel";
import { RecommendationCard } from "@/components/supervisor/RecommendationCard";
import { getSupervisorRecommendations } from "@/app/actions/supervisors";
import type { RecommendationWithAuthor } from "@/types/cards";

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
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const queryKey = ["recommendations", supervisor.id];

  const { data: recommendations = [] } = useQuery({
    queryKey,
    queryFn: () =>
      getSupervisorRecommendations(supervisor.id, currentUserId, 0, 10),
    initialData: initialRecommendations,
  });

  const loadMore = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const newItems = await getSupervisorRecommendations(
        supervisor.id,
        currentUserId,
        recommendations.length,
        1,
      );
      if (newItems.length > 0) {
        queryClient.setQueryData(
          queryKey,
          (prev: RecommendationWithAuthor[] = []) => {
            const existingIds = new Set(prev.map((r) => r.id));
            const uniqueNew = newItems.filter((r) => !existingIds.has(r.id));
            return [...prev, ...uniqueNew];
          },
        );
      }
    } catch (err) {
      console.error("Failed to load more recommendations:", err);
    } finally {
      setLoading(false);
    }
  };

  const hasMore = recommendations.length < totalCount;

  return (
    <div className="relative">
      <Carousel onLoadMore={hasMore ? loadMore : undefined} hasMore={hasMore}>
        {recommendations.map((r) => (
          <RecommendationCard
            key={r.id}
            recommendation={r}
            supervisor={supervisor}
            currentUserId={currentUserId}
          />
        ))}
      </Carousel>
      {loading && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="flex items-center gap-2 rounded-full bg-slate-900/80 px-4 py-2 text-sm font-medium text-white shadow-lg">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            Loading more...
          </div>
        </div>
      )}
    </div>
  );
}
