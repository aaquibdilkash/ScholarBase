"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { JournalReviewCard } from "./JournalReviewCard";
import { WriteJournalReviewButton } from "./WriteJournalReviewButton";
import { getJournalReviews } from "@/app/actions/journalReviews";
import {
  journalReviewCountKey,
  seedJournalReviewAggregates,
  type JournalReviewAggregates,
} from "./journalReviewCount";
import type { JournalReviewWithAuthor } from "@/types/cards";

/**
 * Server value for the initial paint, then the count re-derives from the
 * shared ["journalReviewCount", id] cache that every mutation keeps in sync.
 * Deletes decrement it, create resets it so the next server render re-seeds.
 *
 * Journal-level aggregates (reviewCount / ratingSum / dist) are materialized
 * on the Journal and seeded here from the server once, then mutated client-side.
 */
export function JournalReviewsSection({
  journalId,
  initialReviews,
  initialCount,
  initialRatingSum,
  initialDistribution,
  currentUserId,
  hasUserReview,
  userReviewId,
}: {
  journalId: string;
  initialReviews: JournalReviewWithAuthor[];
  initialCount: number;
  initialRatingSum: number;
  initialDistribution: Record<number, number>;
  currentUserId?: string;
  hasUserReview: boolean;
  userReviewId?: string | null;
}) {
  const queryClient = useQueryClient();

  seedJournalReviewAggregates(
    queryClient,
    journalId,
    initialCount,
    initialRatingSum,
    initialDistribution ?? {},
  );

  const queryKey = ["journalReviews", journalId];

  const { data: reviews = [] } = useQuery({
    queryKey,
    queryFn: () => getJournalReviews(journalId, 0, 5),
    initialData: initialReviews,
  });

  const { data: aggregate } = useQuery<JournalReviewAggregates>({
    queryKey: journalReviewCountKey(journalId),
    queryFn: () =>
      Promise.resolve({
        count: initialCount,
        ratingSum: initialRatingSum,
        dist: initialDistribution ?? {},
      }),
    enabled: false,
    initialData: {
      count: initialCount,
      ratingSum: initialRatingSum,
      dist: initialDistribution ?? {},
    },
  });
  const reactiveTotal = aggregate?.count ?? initialCount;

  const [loading, setLoading] = useState(false);

  const loadMore = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const newItems = await getJournalReviews(
        journalId,
        reviews.length,
        5,
      );
      if (newItems.length > 0) {
        queryClient.setQueryData(
          queryKey,
          (prev: JournalReviewWithAuthor[] = []) => {
            const existingIds = new Set(prev.map((r) => r.id));
            return [...prev, ...newItems.filter((r) => !existingIds.has(r.id))];
          },
        );
      }
    } catch (err) {
      console.error("Failed to load more journal reviews:", err);
    } finally {
      setLoading(false);
    }
  };

  const hasMore = reviews.length < reactiveTotal;
  const userReviewRating: number | undefined = userReviewId
    ? initialReviews.find((r) => r.id === userReviewId)?.rating ?? undefined
    : undefined;


  return (
    <section className="mt-8 sm:mt-10" id="reviews">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900">
          Reviews ({reactiveTotal})
        </h2>
      </div>

      {reactiveTotal > 0 ? (
        <>
          <div className="space-y-4">
            {reviews.map((r) => (
              <JournalReviewCard
                key={r.id}
                review={r}
                currentUserId={currentUserId ?? undefined}
              />
            ))}
          </div>
          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loading}
              className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            >
              {loading ? "Loading…" : "Load more reviews"}
            </button>
          )}
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          <p className="mb-2">No reviews yet. Be the first to share yours!</p>
          <WriteJournalReviewButton
            journalId={journalId}
            initialHasReview={hasUserReview}
            initialUserReviewId={userReviewId}
            initialRating={userReviewRating}
          />
        </div>
      )}
    </section>
  );
}
