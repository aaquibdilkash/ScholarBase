import { notFound } from "next/navigation";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import { ReportMenu } from "@/components/cards/ReportMenu";
import { CommentSection } from "@/components/interactions/CommentSection";
import { VoteButton } from "@/components/interactions/VoteButton";
import { BookmarkButton } from "@/components/interactions/BookmarkButton";
import { createClient } from "@/utils/supabase/server";
import { getJournalById } from "../../actions/journals";
import { deleteJournal } from "@/app/actions/journals";
import {
  getJournalReviewMeta,
  getJournalReviews,
} from "@/app/actions/journalReviews";
import { JournalRatingSection } from "@/components/journals/JournalRatingSection";
import { JournalHeaderActions } from "@/components/journals/JournalHeaderActions";
import { JournalReviewsSection } from "@/components/journals/JournalReviewsSection";
import { RichContent } from "@/components/content/RichContent";
import { SafeExternalLink } from "@/components/ui/SafeExternalLink";

import { buildMetadata, buildNoindexMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import RelatedContent from "@/components/content/RelatedContent";
import { getRelatedContent } from "@/lib/semantic/related";
import { getModeratorDeletedContent } from "@/lib/deleted-content";
import { RemovedContentNotice } from "@/components/moderation/RemovedContentNotice";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const journal = await getJournalById(id).catch(() => null);
  if (!journal) {
    return buildNoindexMetadata("Removed content");
  }
  return buildMetadata({
    title: journal.title,
    description: (
      journal.about ||
      `${journal.title}${journal.publisher ? ` by ${journal.publisher}` : ""}${journal.issn ? ` (ISSN ${journal.issn})` : ""}`
    ).replace(/<[^>]*>/g, " "),
    path: `/journals/${journal.id}`,
    type: "article",
    publishedTime: journal.createdAt,
    modifiedTime: journal.editedAt,
    section: "Journals",
  });
}

const JournalDetailPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const journal = await getJournalById(id, user?.id);

  if (!journal) {
    const removed = await getModeratorDeletedContent("journal", { id });
    if (!removed) notFound();
    return (
      <RemovedContentNotice
        backHref="/journals"
        backLabel="Back to Journals"
        entityId={removed.id}
        module="JOURNAL"
        ownerId={removed.authorId}
        currentUserId={user?.id}
        hasActiveAppeal={removed.hasActiveAppeal}
        noun="journal"
      />
    );
  }

  // Journal Reviews (mirrors the supervisor recommendations flow). Aggregates
  // are materialized on the Journal; the meta call adds the per-star split and
  // the viewer's own review id + rating (for the "+ Review" / "Edit Review" CTA).
  // ONE review is fetched: the carousel pages the rest in through the arrow.
  const reviewMeta = await getJournalReviewMeta(id);
  const initialReviews = await getJournalReviews(id, 0, 1);

  const j = journal;
  const userVote =
    (j.votes?.[0]?.voteType as "UPVOTE" | "DOWNVOTE" | null) ?? null;

  const related = await getRelatedContent("JOURNAL", j.id);

  async function handleDelete() {
    "use server";
    const res = await deleteJournal(j.id);
    if (res?.success === false) return res;
    return { redirect: "/journals", invalidateQueries: [["journals"]] };
  }

  return (
    <DetailPageCardShell
      relatedContent={<RelatedContent title="Related journals" items={related} />}
      preservedContent={
        <>
          <JournalRatingSection
            journalId={j.id}
            initialCount={reviewMeta.totalCount}
            initialVisibleCount={reviewMeta.visibleCount}
            initialAvgRating={reviewMeta.avgRating}
            initialDistribution={reviewMeta.ratingDistribution}
          />

          <JournalReviewsSection
            journalId={j.id}
            initialReviews={initialReviews}
            initialCount={reviewMeta.totalCount}
            initialVisibleCount={reviewMeta.visibleCount}
            initialRatingSum={j.ratingSum}
            initialDistribution={reviewMeta.ratingDistribution.reduce(
              (acc, row) => ({ ...acc, [row.stars]: row.count }),
              {} as Record<number, number>,
            )}
            currentUserId={user?.id ?? undefined}
            hasUserReview={reviewMeta.hasUserReview}
            userReviewId={reviewMeta.userReviewId ?? undefined}
          />
        </>
      }
      isFrozen={j.isFrozen ?? false}
      frozenEntityId={j.id}
      frozenModule="JOURNAL"
      frozenEntityType="POST"
      frozenOwnerId={j.author?.id ?? null}
      frozenHasActiveAppeal={j.hasActiveAppeal ?? false}
      backHref="/journals"
      backLabel="Back to Journals"
      authorHref={j.isAnonymous ? undefined : `/scholars/${j.author?.id}`}
      authorName={j.isAnonymous ? "Anonymous Scholar" : j.author?.name || "Scholar"}
      authorHandle={j.isAnonymous ? undefined : j.author?.handle || undefined}
      authorAvatarUrl={j.isAnonymous ? null : j.author?.avatarUrl || undefined}
      authorVerified={!j.isAnonymous && !!j.author?.institutionVerifiedAt}
      authorId={j.isAnonymous ? undefined : j.author?.id}
      isFollowing={j.isAnonymous ? false : !!j.author?.followers?.length}
      currentUserId={user?.id}
      createdDate={j.createdAt}
      editedDate={
        j.editedAt && j.editedAt > j.createdAt ? j.editedAt : undefined
      }
      footerVoteButton={
        <VoteButton
          targetId={j.id}
          module="JOURNAL"
          initialTotalVotes={j.totalVotes}
          initialUserVote={userVote}
          isOwnContent={user?.id === j.author?.id}
        />
      }
      footerBookmarkButton={
        <BookmarkButton
          frozen={j.isFrozen === true}
          targetId={j.id}
          module="JOURNAL"
          initialTotalBookmarks={j.totalBookmarks ?? 0}
          initialIsBookmarked={
            Array.isArray(j.bookmarks) && j.bookmarks.length > 0
          }
        />
      }
      footerCommentsHref={`/journals/${j.id}#comments`}
      footerCommentsCount={j.totalComments}
      footerReportMenu={
        <ReportMenu
          entityId={j.id}
          entityType="POST"
          module="JOURNAL"
          ownerId={j.author?.id ?? null}
          currentUserId={user?.id ?? null}
          isFrozen={j.isFrozen}
          hasActiveAppeal={j.hasActiveAppeal}
        />
      }
      discussion={
        <CommentSection
          locked={j.isFrozen ?? false}
          comments={j.comments}
          totalComments={j.totalComments}
          targetId={j.id}
          module="journal"
          currentUserId={user?.id ?? null}
          postAuthorId={j.isAnonymous ? undefined : j.author?.id}
        />
      }
    >
      <div className="flex min-w-0 w-full flex-row items-center justify-between gap-4 sm:gap-6 mb-4 sm:mb-6">
        <div className="min-w-0 flex-1">
          {j.isAnonymous ? (
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Anonymous journal
            </p>
          ) : null}
          <h1 className="max-w-full break-words text-lg sm:text-xl md:text-2xl font-bold text-slate-950 [overflow-wrap:anywhere]">
            {j.title}
          </h1>
        </div>
        <div className="flex w-auto shrink-0 justify-end">
          <JournalHeaderActions
            journalId={j.id}
            isJournalOwner={user?.id === j.author?.id}
            journalEditHref={`/journals/${j.id}/edit`}
            onDeleteJournal={handleDelete}
            initialHasReview={reviewMeta.hasUserReview}
            initialUserReviewId={reviewMeta.userReviewId}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-4 sm:mb-6">
        {j.subjectArea && (
          <div className="metric-card bg-indigo-50">
            <p className="text-xs text-indigo-500 font-medium uppercase tracking-wider">
              Subject Area
            </p>
            <p className="mt-1 break-words text-sm font-semibold text-indigo-800 [overflow-wrap:anywhere]">
              {j.subjectArea}
            </p>
          </div>
        )}
        {j.publisher && (
          <div className="metric-card bg-cyan-50">
            <p className="text-xs text-cyan-500 font-medium uppercase tracking-wider">
              Publisher
            </p>
            <p className="mt-1 break-words text-sm font-semibold text-cyan-800 [overflow-wrap:anywhere]">
              {j.publisher}
            </p>
          </div>
        )}
        {j.issn && (
          <div className="metric-card bg-rose-50">
            <p className="text-xs text-rose-500 font-medium uppercase tracking-wider">
              ISSN
            </p>
            <p className="mt-1 break-words text-sm font-semibold text-rose-800 [overflow-wrap:anywhere]">{j.issn}</p>
          </div>
        )}
        {j.impactFactor && (
          <div className="metric-card bg-amber-50">
            <p className="text-xs text-amber-500 font-medium uppercase tracking-wider">
              Impact Factor
            </p>
            <p className="text-sm font-semibold text-amber-800 mt-1">
              {j.impactFactor}
            </p>
          </div>
        )}
        {j.scopusQuartile && j.scopusQuartile !== "NONE" && (
          <div className="metric-card bg-emerald-50">
            <p className="text-xs text-emerald-500 font-medium uppercase tracking-wider">
              Scopus Quartile
            </p>
            <p className="text-sm font-semibold text-emerald-800 mt-1">
              {j.scopusQuartile}
            </p>
          </div>
        )}
        {j.abdcRanking && j.abdcRanking !== "NONE" && (
          <div className="metric-card bg-purple-50">
            <p className="text-xs text-purple-500 font-medium uppercase tracking-wider">
              ABDC Ranking
            </p>
            <p className="text-sm font-semibold text-purple-800 mt-1">
              {j.abdcRanking.replace("_STAR", "*")}
            </p>
          </div>
        )}
        {j.wosIndex && j.wosIndex !== "NONE" && (
          <div className="metric-card bg-blue-50">
            <p className="text-xs text-blue-500 font-medium uppercase tracking-wider">
              Web of Science Index
            </p>
            <p className="text-sm font-semibold text-blue-800 mt-1">
              {j.wosIndex}
            </p>
          </div>
        )}
        {j.wosQuartile && j.wosQuartile !== "NONE" && (
          <div className="metric-card bg-sky-50">
            <p className="text-xs text-sky-500 font-medium uppercase tracking-wider">
              Web of Science Quartile
            </p>
            <p className="text-sm font-semibold text-sky-800 mt-1">
              {j.wosQuartile}
            </p>
          </div>
        )}
        {j.sjrQuartile && j.sjrQuartile !== "NONE" && (
          <div className="metric-card bg-orange-50">
            <p className="text-xs text-orange-500 font-medium uppercase tracking-wider">
              SJR Quartile
            </p>
            <p className="text-sm font-semibold text-orange-800 mt-1">
              {j.sjrQuartile}
            </p>
          </div>
        )}
        {j.sjrScore != null && (
          <div className="metric-card bg-orange-50">
            <p className="text-xs text-orange-500 font-medium uppercase tracking-wider">
              SJR Score
            </p>
            <p className="text-sm font-semibold text-orange-800 mt-1">
              {j.sjrScore}
            </p>
          </div>
        )}
        {j.citeScore != null && (
          <div className="metric-card bg-teal-50">
            <p className="text-xs text-teal-500 font-medium uppercase tracking-wider">
              CiteScore
            </p>
            <p className="text-sm font-semibold text-teal-800 mt-1">
              {j.citeScore}
            </p>
          </div>
        )}
      </div>

      {j.about && (
        <div className="mt-4 sm:mt-6">
          <h3 className="text-base sm:text-lg font-semibold text-slate-950 mb-1.5 sm:mb-2">
            About
          </h3>
          <RichContent content={j.about} />
        </div>
      )}

      <div className="flex gap-3 sm:gap-4 mt-2 sm:mt-2">
        <SafeExternalLink
          url={j.website}
          className="flex-1 rounded-lg bg-slate-950 py-2 sm:py-2.5 text-center text-xs sm:text-sm font-semibold text-white transition-colors duration-200 hover:bg-slate-800"
        >
          View Website
        </SafeExternalLink>
      </div>
    </DetailPageCardShell>
  );
};

export default JournalDetailPage;
