"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupervisorRecommendations } from "@/app/actions/supervisors";
import { deleteRecommendation as deleteRecommendationAction } from "@/app/actions/recommendations";
import { decrementRecommendation } from "./recommendationCount";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { useToast } from "@/components/ui/Toast";
import type { RecommendationWithAuthor } from "@/types/cards";

/**
 * Reactive "+ Recommend" CTA on the supervisor detail page.
 *
 * - No recommendation  → "+ Recommend"
 * - Has one (anonymous or not) → OwnerActionsDropdown with working Edit + Delete.
 *
 * State is derived from the same ["recommendations", supervisorId] cache that
 * RecommendationForm / RecommendationCard mutate via queryClient, so the CTA
 * flips between states INSTANTLY without a refresh.
 */
export function RecommendButton({
  supervisorId,
  currentUserId,
  initialHasRecommendation,
  initialUserRecommendationId,
}: {
  supervisorId: string;
  currentUserId?: string;
  initialHasRecommendation: boolean;
  initialUserRecommendationId?: string | null;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // enabled: false → never fetches; purely observes the shared cache.
  const { data: recommendations } = useQuery<RecommendationWithAuthor[]>({
    queryKey: ["recommendations", supervisorId],
    queryFn: () => getSupervisorRecommendations(supervisorId, currentUserId, 0, 10),
    enabled: false,
    initialData: undefined,
  });

  // Own active recommendation — resolved from the cache first (reactive to
  // create/delete), falling back to the server-rendered id.
  const ownFromCache = currentUserId
    ? (recommendations ?? []).find(
        (r) => (r.authorId ?? r.author?.id) === currentUserId,
      )
    : undefined;
  // Once the shared cache has been observed (any create/delete updated it),
  // trust it exclusively — the server-rendered initial prop is stale after
  // client-side mutations.
  const hasUserRecommendation =
    recommendations !== undefined
      ? !!ownFromCache
      : initialHasRecommendation;
  const userRecommendationId = ownFromCache?.id ?? initialUserRecommendationId ?? null;

  const deleteMutation = useMutation({
    mutationFn: deleteRecommendationAction,
  });

  if (!currentUserId) return null;

  // Already recommended (anonymous or not)? Show the owner actions dropdown —
  // same edit/delete controls as on the recommendation card header.
  if (hasUserRecommendation && userRecommendationId) {
    return (
      <OwnerActionsDropdown
        editHref={`/supervisor/${supervisorId}/recommendation/${userRecommendationId}/edit`}
        onDelete={async () => {
          try {
            const response = await deleteMutation.mutateAsync(userRecommendationId);
            if (!response?.success || !response.data) {
              toast("Failed to delete recommendation.", "error");
              return { refresh: false };
            }
            // Instant flip back to "+ Recommend" via the shared cache.
            queryClient.setQueriesData(
              { queryKey: ["recommendations", supervisorId] },
              (oldData: RecommendationWithAuthor[] = []) =>
                oldData.filter((r) => r.id !== response.data.deletedId),
            );
            // Determine the deleted recommendation's rating (from the cached
            // array) so the overall rating + distribution update live.
            const cachedRecs =
              queryClient.getQueryData<RecommendationWithAuthor[]>([
                "recommendations",
                supervisorId,
              ]) ?? [];
            const deleted = cachedRecs.find(
              (r) => (r.id ?? r.author?.id) === response.data.deletedId
            );
            const removedRating = deleted?.rating ??
              ownFromCache?.rating ??
              cachedRecs.find((r) => (r.authorId ?? r.author?.id) === currentUserId)
                ?.rating ?? 5;
            decrementRecommendation(queryClient, supervisorId, removedRating);
            return { refresh: false };
          } catch (error) {
            toast((error as Error).message, "error");
            return { refresh: false };
          }
        }}
        isOwner={true}
        editLabel="Edit Recommendation"
        deleteLabel="Delete Recommendation"
      />
    );
  }
  if (hasUserRecommendation) return null;

  return (
    <Link
      href={`/supervisor/${supervisorId}/recommendation/add`}
      className="sb-button-primary w-full md:w-auto"
    >
      + Recommend
    </Link>
  );
}
