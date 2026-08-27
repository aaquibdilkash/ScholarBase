"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteRecommendation as deleteRecommendationAction } from "@/app/actions/recommendations";
import { decrementRecommendation } from "./recommendationCount";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { useToast } from "@/components/ui/Toast";
import type { RecommendationWithAuthor } from "@/types/cards";

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

  // 🟢 CORE FIX: Use React Query as a global state store for the button status.
  // It starts with the server-provided ID. If we set this to null later, the button flips.
  const { data: activeRecId } = useQuery({
    queryKey: ["user_rec_status", supervisorId],
    // 🟢 ADD THIS LINE: A dummy function to satisfy React Query's strict requirements
    queryFn: () => initialUserRecommendationId ?? null, 
    initialData: initialUserRecommendationId ?? null,
    staleTime: Infinity, // Never fetch this from the network, just hold it in memory
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRecommendationAction,
  });

  if (!currentUserId) return null;

  if (initialHasRecommendation && activeRecId) {
    return (
      <OwnerActionsDropdown
        editHref={`/supervisor/${supervisorId}/recommendation/${activeRecId}/edit`}
        onDelete={async () => {
          try {
            const response = await deleteMutation.mutateAsync(activeRecId);
            if (!response?.success || !response.data) {
              toast("Failed to delete recommendation.", "error");
              return { refresh: false };
            }

            // 1. Remove from the carousel cache instantly
            queryClient.setQueriesData(
              { queryKey: ["recommendations", supervisorId] },
              (oldData: RecommendationWithAuthor[] = []) =>
                oldData.filter((r) => r.id !== response.data.deletedId),
            );
            
            // 2. Invalidate cache to refill the carousel gap
            queryClient.invalidateQueries({ queryKey: ["recommendations", supervisorId] });
            
            // 3. Adjust the overall rating instantly
            const cachedRecs = queryClient.getQueryData<RecommendationWithAuthor[]>(["recommendations", supervisorId]) ?? [];
            const deleted = cachedRecs.find((r) => (r.id ?? r.author?.id) === response.data.deletedId);
            const removedRating = deleted?.rating ?? 5;
            decrementRecommendation(queryClient, supervisorId, removedRating);
            
            // 🟢 4. Flip the global status to null so THIS button instantly turns into "+ Recommend"
            queryClient.setQueryData(["user_rec_status", supervisorId], null);

            toast("Recommendation deleted successfully", "success");
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

  return (
    <Link
      href={`/supervisor/${supervisorId}/recommendation/add`}
      className="sb-button-primary w-full md:w-auto"
    >
      + Recommend
    </Link>
  );
}