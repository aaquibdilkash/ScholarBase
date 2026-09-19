"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteJournalReview } from "@/app/actions/journalReviews";
import { decrementJournalReview } from "./journalReviewCount";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { useToast } from "@/components/ui/Toast";
import type { JournalReviewWithAuthor } from "@/types/cards";

export function WriteJournalReviewButton({
  journalId,
  initialHasReview,
  initialUserReviewId,
  initialRating,
}: {
  journalId: string;
  initialHasReview: boolean;
  initialUserReviewId?: string | null;
  initialRating?: number;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // 🟢 CORE FIX: Use React Query as a global state store for the button status.
  // It starts with the server-provided id. If we set this to null later, the
  // button flips back to "+ Review".
  const { data: activeReviewId } = useQuery({
    queryKey: ["user_review_status", journalId],
    queryFn: () => initialUserReviewId ?? null,
    initialData: initialUserReviewId ?? null,
    staleTime: Infinity, // Never fetch this from the network, just hold it.
  });

  const deleteMutation = useMutation({
    mutationFn: deleteJournalReview,
  });

  if (initialHasReview && activeReviewId) {
    return (
      <OwnerActionsDropdown
        editHref={`/journals/${journalId}/review/${activeReviewId}/edit`}
        onDelete={async () => {
          try {
            const response = await deleteMutation.mutateAsync(activeReviewId);
            if (!response?.success || !response.data) {
              toast("Failed to delete review.", "error");
              return { refresh: false };
            }

            // 1. Remove from the list cache instantly
            queryClient.setQueriesData(
              { queryKey: ["journalReviews", journalId] },
                          (oldData: JournalReviewWithAuthor[] = []) =>
                oldData.filter((r) => r.id !== response.data.deletedId),
            );

            // 2. Adjust the overall rating instantly.
            decrementJournalReview(
              queryClient,
              journalId,
              initialRating ?? 5,
            );

            // 3. Flip the global status to null so THIS button turns into "+ Review"
            queryClient.setQueryData(["user_review_status", journalId], null);

            toast("Review deleted successfully", "success");
            return { refresh: false };
          } catch (error) {
            toast((error as Error).message, "error");
            return { refresh: false };
          }
        }}
        isOwner={true}
        editLabel="Edit Review"
        deleteLabel="Delete Review"
      />
    );
  }

  return (
    <Link
      prefetch={false}
      href={`/journals/${journalId}/review/add`}
      className="sb-button-primary w-auto"
    >
      + Review
    </Link>
  );
}
