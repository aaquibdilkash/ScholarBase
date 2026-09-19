"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { VoteButton } from "@/components/interactions/VoteButton";
import { BookmarkButton } from "@/components/interactions/BookmarkButton";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { ReportMenu } from "@/components/cards/ReportMenu";
import { deleteJournalReview } from "@/app/actions/journalReviews";
import { useToast } from "@/components/ui/Toast";
import { RichContent } from "@/components/content/RichContent";
import { removeFromList } from "@/utils/cacheMutation";
import Link from "next/link";
import { StarRating } from "@/components/ui/StarRating";
import type { JournalReviewWithAuthor } from "@/types/cards";
import type { JournalOutcome } from "@prisma/client";

export function JournalReviewCard({
  review,
  currentUserId,
}: {
  review: JournalReviewWithAuthor;
  currentUserId?: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const router = useRouter();

  const userVote: "UPVOTE" | "DOWNVOTE" | null =
    (review.votes || [])[0]?.voteType ?? null;

  const ownerId = review.authorId ?? review.author?.id;
  const isOwner = !!currentUserId && ownerId === currentUserId;
  const isFollowing = (review.author?.followers?.length ?? 0) > 0;

  const deleteMutation = useMutation({
    mutationFn: deleteJournalReview,
  });

  const handleDeleteFromDropdown = async () => {
    try {
      const response = await deleteMutation.mutateAsync(review.id);
      if (!response?.success || !response.data) {
        toast("Failed to delete review.", "error");
        return { refresh: false };
      }

      // 1. Remove from every cached list slice instantly.
      removeFromList<JournalReviewWithAuthor>(
        queryClient,
        ["journalReviews", review.journalId],
        response.data.deletedId,
      );

      // 2. Journal detail aggregates (reviewCount / ratingSum) are materialized
      // on the Journal, so invalidate the journal query to reseed them.
      queryClient.invalidateQueries({ queryKey: ["journal", review.journalId] });
      queryClient.invalidateQueries({ queryKey: ["journalReviews", review.journalId] });

      toast("Review deleted successfully.", "success");
      router.push(`/journals/${review.journalId}`);
      return { refresh: false };
    } catch (error) {
      toast((error as Error).message, "error");
      return { refresh: false };
    }
  };

    const outcomeLabel = (o: JournalOutcome) =>
    ({
      ACCEPTED: "Accepted",
      MINOR_REVISION: "Minor Revision",
      MAJOR_REVISION: "Major Revision",
      REJECTED: "Rejected",
      WITHDRAWN: "Withdrawn",
    } as Record<JournalOutcome, string>)[o] ?? o;


  return (
    <ListPageCardShell
      detailPageHref={`/journals/${review.journalId}/review/${review.id}`}
      // The card renders its own <Link> below (star rating + feedback body),
      // so the shell's generic body link must be disabled to avoid nesting
      // <a> inside <a> (hydration error).
      noBodyLink={true}
      authorHref={
        review.isAnonymous
          ? undefined
          : `/scholars/${review.author?.id}`
      }
      authorName={
        review.isAnonymous
          ? "Anonymous Scholar"
          : review.author?.name || "Scholar"
      }
      authorId={
        review.isAnonymous
          ? undefined
          : review.author?.id ?? review.authorId ?? null
      }
      isFollowing={review.isAnonymous ? false : isFollowing}
      currentUserId={currentUserId}
      createdDate={review.createdAt}
      editedDate={
        review.editedAt && review.editedAt > review.createdAt
          ? review.editedAt
          : undefined
      }
      footerVoteButton={
        <VoteButton
          targetId={review.id}
          module="JOURNAL_REVIEW"
          initialTotalVotes={review.totalVotes}
          initialUserVote={userVote}
        />
      }
      footerBookmarkButton={
        <BookmarkButton
          targetId={review.id}
          module="JOURNAL_REVIEW"
          initialTotalBookmarks={review.totalBookmarks ?? 0}
          initialIsBookmarked={
            Array.isArray(review.bookmarks) && review.bookmarks.length > 0
          }
        />
      }
      footerCommentsHref={`/journals/${review.journalId}/review/${review.id}#comments`}
      footerCommentsCount={review.totalComments}
      footerReportMenu={
        <ReportMenu
          entityId={review.id}
          entityType="POST"
          module="JOURNAL_REVIEW"
          ownerId={review.author?.id ?? null}
          currentUserId={currentUserId ?? null}
          isFrozen={review.isFrozen ?? false}
          isDeleted={false}
          hasActiveAppeal={review.hasActiveAppeal ?? false}
        />
      }
      managementControls={
        isOwner ? (
          <OwnerActionsDropdown
            editHref={`/journals/${review.journalId}/review/${review.id}/edit`}
            onDelete={handleDeleteFromDropdown}
            isOwner={true}
            editLabel="Edit Review"
            deleteLabel="Delete Review"
          />
        ) : null
      }
    >
      {review.isAnonymous ? (
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
          Anonymous journal review
        </p>
      ) : null}
      <Link
        href={`/journals/${review.journalId}/review/${review.id}`}
        prefetch={false}
        className="block group"
      >
        <div className="flex items-center gap-2 mb-2">
          <StarRating rating={review.rating} size="sm" />
          <span className="font-bold text-slate-800 dark:text-slate-100">
            {Number(review.rating).toFixed(1)} / 5
          </span>
        </div>

        <p className="text-sm font-semibold text-slate-700 mb-1 dark:text-slate-200">
          Outcome: {outcomeLabel(review.outcome)}
        </p>

        <div className="grid grid-cols-3 gap-x-4 mb-3">
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-1 dark:text-slate-300">
              Turnaround
            </p>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
              {review.turnaroundTimeDays}d
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-1 dark:text-slate-300">
              Editorial
            </p>
            <StarRating rating={review.editorialQualityScore} size="sm" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-1 dark:text-slate-300">
              Peer Review
            </p>
            <StarRating rating={review.peerReviewRigorScore} size="sm" />
          </div>
        </div>

                <RichContent
          content={review.feedback}
          className="text-sm leading-relaxed text-slate-600 dark:text-slate-300"
        />
      </Link>
    </ListPageCardShell>
  );
}
