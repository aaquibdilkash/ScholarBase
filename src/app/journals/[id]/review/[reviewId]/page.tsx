import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import type { JournalOutcome } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { CommentSection } from "@/components/interactions/CommentSection";
import type { CommentWithAuthorAndVotes } from "@/types/comments";
import { VoteButton } from "@/components/interactions/VoteButton";
import { BookmarkButton } from "@/components/interactions/BookmarkButton";
import {
  deleteJournalReview,
  getJournalReview,
} from "@/app/actions/journalReviews";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  buildBreadcrumbList,
  buildContentJsonLd,
  CONTENT_SCHEMA,
} from "@/lib/schema";
import { ReportMenu } from "@/components/cards/ReportMenu";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { StarRating } from "@/components/ui/StarRating";
import { RichContent } from "@/components/content/RichContent";
import { buildMetadata, buildNoindexMetadata } from "@/lib/seo";
import { SITE_URL } from "@/constants/seo";
import RelatedContent from "@/components/content/RelatedContent";
import { getRelatedContent } from "@/lib/semantic/related";
import { getModeratorDeletedContent } from "@/lib/deleted-content";
import { RemovedContentNotice } from "@/components/moderation/RemovedContentNotice";

const OUTCOME_LABELS: Record<JournalOutcome, string> = {
  ACCEPTED: "Accepted",
  MINOR_REVISION: "Minor Revision",
  MAJOR_REVISION: "Major Revision",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; reviewId: string }>;
}): Promise<Metadata> {
  const { id, reviewId } = await params;
  const review = await getJournalReview(reviewId).catch(() => null);
  if (!review || review.journal.id !== id) {
    return buildNoindexMetadata("Removed content");
  }
  return buildMetadata({
    title: `Review of ${review.journal.title}`,
    description: `A ${Number(review.rating).toFixed(1)}/5 peer review of ${review.journal.title}. ${(review.feedback || "").replace(/<[^>]*>/g, " ")}`,
    path: `/journals/${review.journalId}/review/${review.id}`,
    type: "article",
    publishedTime: review.createdAt,
    section: "Journal Reviews",
  });
}

// The slug is dynamic: /journals/[id]/review/[reviewId]
// `reviewId` comes from the URL; we render the single review by fetching
// only that row (cursor-based lookup keeps it cheap).
export default async function JournalReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string; reviewId: string }>;
}) {
  const { id, reviewId } = await params;
  const user = await getCurrentUser();

  // The viewer id resolves the vote / bookmark / follow state for THIS viewer
  // (RULE 2: filtered selects, never the whole relation).
  const review = await getJournalReview(reviewId, user?.id);

  // A review is reachable only under its own journal. Without this check the
  // page would render — and the "back" link would point at — a journal the
  // review does not belong to.
  if (!review || review.journal.id !== id) {
    const removed = await getModeratorDeletedContent("journalReview", {
      id: reviewId,
    });
    if (!removed) notFound();
    return (
      <RemovedContentNotice
        backHref={`/journals/${id}`}
        backLabel="Back to Journal"
        entityId={removed.id}
        module="JOURNAL_REVIEW"
        ownerId={removed.authorId}
        currentUserId={user?.id}
        hasActiveAppeal={removed.hasActiveAppeal}
        noun="journal review"
      />
    );
  }

  async function handleDelete() {
    "use server";
    const res = await deleteJournalReview(review!.id);
    if (res?.success === false) return res;
    return {
      redirect: `/journals/${id}`,
      invalidateQueries: [["journalReviews", id]],
    };
  }

  const userVote =
    (review.votes?.[0]?.voteType as "UPVOTE" | "DOWNVOTE" | null) ?? null;

  const related = await getRelatedContent("JOURNAL_REVIEW", review.id);
  const isBookmarked =
    Array.isArray(review.bookmarks) && review.bookmarks.length > 0;
  const isFollowing = (review.author?.followers?.length ?? 0) > 0;
  const isOwner = !!user?.id && user.id === review.authorId;

  return (
    <DetailPageCardShell
      structuredData={
        <JsonLd
          data={[
            buildContentJsonLd({
              type: CONTENT_SCHEMA.journalReview,
              path: `/journals/${review.journalId}/review/${review.id}`,
              name: `Review of ${review.journal.title}`,
              description: review.feedback,
              author: {
                name: review.author?.name,
                path: review.author?.id
                  ? `/scholars/${review.author.id}`
                  : null,
              },
              datePublished: review.createdAt,
              dateModified: review.editedAt,
              extra: {
                itemReviewed: {
                  "@type": "Periodical",
                  name: review.journal.title,
                  url: `${SITE_URL}/journals/${review.journalId}`,
                },
                reviewRating: {
                  "@type": "Rating",
                  ratingValue: review.rating,
                  bestRating: 5,
                  worstRating: 1,
                },
              },
            }),
            buildBreadcrumbList([
              { name: "Journals", path: "/journals" },
              {
                name: review.journal.title,
                path: `/journals/${review.journalId}`,
              },
              {
                name: "Review",
                path: `/journals/${review.journalId}/review/${review.id}`,
              },
            ]),
          ]}
        />
      }
      relatedContent={
        <RelatedContent title="Related journal reviews" items={related} />
      }
      isFrozen={review.isFrozen ?? false}
      frozenEntityId={review.id}
      frozenModule="JOURNAL_REVIEW"
      frozenEntityType="POST"
      frozenOwnerId={review.authorId ?? null}
      frozenHasActiveAppeal={review.hasActiveAppeal ?? false}
      isAdmin={false}
      backHref={`/journals/${review.journalId}`}
      backLabel="Back to Journal"
      authorHref={
        review.isAnonymous ? undefined : `/scholars/${review.author?.id}`
      }
      authorName={
        review.isAnonymous
          ? "Anonymous Scholar"
          : review.author?.name || "Scholar"
      }
      authorHandle={
        review.isAnonymous ? undefined : review.author?.handle || undefined
      }
      authorAvatarUrl={
        review.isAnonymous ? null : review.author?.avatarUrl || undefined
      }
      authorVerified={
        !review.isAnonymous && !!review.author?.institutionVerifiedAt
      }
      authorId={review.isAnonymous ? undefined : review.author?.id}
      isFollowing={isFollowing}
      currentUserId={user?.id}
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
          isOwnContent={isOwner}
        />
      }
      footerBookmarkButton={
        <BookmarkButton
          targetId={review.id}
          module="JOURNAL_REVIEW"
          initialTotalBookmarks={review.totalBookmarks ?? 0}
          initialIsBookmarked={isBookmarked}
        />
      }
      footerCommentsHref={`/journals/${review.journalId}/review/${review.id}#comments`}
      footerCommentsCount={review.totalComments}
      footerReportMenu={
        <ReportMenu
          entityId={review.id}
          entityType="POST"
          module="JOURNAL_REVIEW"
          ownerId={review.authorId ?? null}
          currentUserId={user?.id ?? null}
          isFrozen={review.isFrozen}
          hasActiveAppeal={review.hasActiveAppeal}
        />
      }
      // The discussion the recommendation detail page renders below its card. A
      // review had none, so a reader had nowhere to ask the author a question.
      discussion={
        <div id="comments">
          <CommentSection
            locked={review.isFrozen ?? false}
            comments={review.comments as CommentWithAuthorAndVotes[]}
            totalComments={review.totalComments}
            targetId={review.id}
            module="journalReview"
            currentUserId={user?.id ?? null}
            postAuthorId={review.isAnonymous ? undefined : review.authorId}
          />
        </div>
      }
      managementControls={
        isOwner ? (
          <OwnerActionsDropdown
            editHref={`/journals/${review.journalId}/review/${review.id}/edit`}
            onDelete={handleDelete}
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
      <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        Review of{" "}
        <Link
          href={`/journals/${review.journalId}`}
          className="break-words text-blue-700 [overflow-wrap:anywhere] hover:underline dark:text-blue-400"
          prefetch={false}
        >
          {review.journal.title}
        </Link>
      </p>



      {/* The detail page renders the whole review. The list card clamps its
          body behind a "View more" control, which is wrong here: there is
          nothing left to page to. */}
      <div className="mb-4 space-y-3">
        <div className="flex items-center gap-2">
          <StarRating rating={review.rating} size="md" />
          <span className="font-bold text-slate-800 dark:text-slate-100">
            {Number(review.rating).toFixed(1)} / 5
          </span>
        </div>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Outcome: {OUTCOME_LABELS[review.outcome] ?? review.outcome}
        </p>
        <div className="grid grid-cols-3 gap-x-4">
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              Turnaround
            </p>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
              {review.turnaroundTimeDays}d
            </p>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              Editorial
            </p>
            <StarRating rating={review.editorialQualityScore} size="sm" />
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              Peer Review
            </p>
            <StarRating rating={review.peerReviewRigorScore} size="sm" />
          </div>
        </div>
      </div>

      <div>
        <p className="mb-2 text-base font-semibold text-slate-800 sm:mb-3 sm:text-lg dark:text-slate-100">
          Review Feedback
        </p>
        <RichContent
          content={review.feedback}
          className="leading-relaxed text-slate-700 dark:text-slate-200"
        />
      </div>
    </DetailPageCardShell>
  );
}

