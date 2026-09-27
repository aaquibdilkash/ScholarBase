"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PagedCarousel } from "@/components/ui/PagedCarousel";
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
 * Reviews for one journal, paged as a horizontal carousel — the exact twin of
 * `RecommendationsSection` / `SupervisorRecommendations`, down to the shared
 * `PagedCarousel` and the `["journalReviewCount", id]` aggregates store.
 *
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
  userReviewRating,
}: {
  journalId: string;
  initialReviews: JournalReviewWithAuthor[];
  initialCount: number;
  initialRatingSum: number;
  initialDistribution: Record<number, number>;
  currentUserId?: string;
  hasUserReview: boolean;
  userReviewId?: string | null;
  /**
   * The viewer's own rating, from the aggregates query rather than the first
   * carousel slide — the first slide is the newest review, which is usually
   * somebody else's. Needed so the delete path decrements the star bucket the
   * review actually fell into.
   */
  userReviewRating?: number | null;
}) {
  const queryClient = useQueryClient();

  seedJournalReviewAggregates(
    queryClient,
    journalId,
    initialCount,
    initialRatingSum,
    initialDistribution ?? {},
  );

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

  return (
    <section className="mt-8 sm:mt-10" id="reviews">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900">
          Reviews ({reactiveTotal})
        </h2>
      </div>

      {reactiveTotal > 0 ? (
        <PagedCarousel<JournalReviewWithAuthor>
          queryKey={["journalReviews", journalId]}
          initialItems={initialReviews}
          totalCount={reactiveTotal}
          fetchPage={(skip, take) => getJournalReviews(journalId, skip, take)}
          errorLabel="journal reviews"
          renderItem={(r) => (
            <JournalReviewCard
              key={r.id}
              review={r}
              currentUserId={currentUserId ?? undefined}
            />
          )}
        />
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          <p className="mb-2">No reviews yet. Be the first to share yours!</p>
          <WriteJournalReviewButton
            journalId={journalId}
            initialHasReview={hasUserReview}
            initialUserReviewId={userReviewId}
            initialRating={userReviewRating ?? undefined}
          />
        </div>
      )}
    </section>
  );
}
