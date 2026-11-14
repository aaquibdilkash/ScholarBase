import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { CommentSection } from "@/components/interactions/CommentSection";
import type { CommentWithAuthorAndVotes } from "@/types/comments";
import { VoteButton } from "@/components/interactions/VoteButton";
import { BookmarkButton } from "@/components/interactions/BookmarkButton";
import {
  deleteRecommendation,
  getRecommendation,
} from "@/app/actions/recommendations";
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
import type { Metadata } from "next";
import RelatedContent from "@/components/content/RelatedContent";
import { getRelatedContent } from "@/lib/semantic/related";
import { getModeratorDeletedContent } from "@/lib/deleted-content";
import { RemovedContentNotice } from "@/components/moderation/RemovedContentNotice";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; recommendationId: string }>;
}): Promise<Metadata> {
  const { id, recommendationId } = await params;
  const rec = await getRecommendation(recommendationId).catch(() => null);
  if (!rec || rec.supervisor.id !== id) {
    return buildNoindexMetadata("Removed content");
  }
  return buildMetadata({
    title: `Recommendation for ${rec.supervisor.name || "Supervisor"}`,
    description: `A ${rec.rating ? `${rec.rating}/5 ` : ""}mentorship recommendation. ${(rec.feedback || "").replace(/<[^>]*>/g, " ")}`,
    path: `/supervisor/${rec.supervisor.id}/recommendation/${rec.id}`,
    type: "article",
    publishedTime: rec.createdAt,
    section: "Supervisor Recommendations",
  });
}

export default async function RecommendationDetailPage({
  params,
}: {
  params: Promise<{ id: string; recommendationId: string }>;
}) {
  const { id, recommendationId } = await params;
  const user = await getCurrentUser();

  const recommendation = await getRecommendation(recommendationId, user?.id);

  if (!recommendation || recommendation.supervisor.id !== id) {
    const removed = await getModeratorDeletedContent("recommendation", {
      id: recommendationId,
    });
    if (!removed) notFound();
    return (
      <RemovedContentNotice
        backHref={`/supervisor/${id}`}
        backLabel="Back to Supervisor Profile"
        entityId={removed.id}
        module="RECOMMENDATION"
        ownerId={removed.authorId}
        currentUserId={user?.id}
        hasActiveAppeal={removed.hasActiveAppeal}
        noun="recommendation"
      />
    );
  }

  async function handleDelete() {
    "use server";
    const res = await deleteRecommendation(recommendation!.id);
    if (res?.success === false) return res;
    return {
      redirect: `/supervisor/${id}`,
      invalidateQueries: [["recommendations", id]],
    };
  }

  // Filtered select in getRecommendation returns at most one row (the
  // current user's vote) — no full vote-array scan needed.
  const userVote =
    (recommendation.votes?.[0]?.voteType as "UPVOTE" | "DOWNVOTE" | null) ??
    null;

  const related = await getRelatedContent("RECOMMENDATION", recommendation.id);

  return (
    <DetailPageCardShell
      structuredData={
        <JsonLd
          data={[
            buildContentJsonLd({
              type: CONTENT_SCHEMA.recommendation,
              path: `/supervisor/${recommendation.supervisor.id}/recommendation/${recommendation.id}`,
              name: `Recommendation for ${recommendation.supervisor.name || "Supervisor"}`,
              description: recommendation.feedback,
              author: {
                name: recommendation.author?.name,
                path: recommendation.author?.id
                  ? `/scholars/${recommendation.author.id}`
                  : null,
              },
              datePublished: recommendation.createdAt,
              dateModified: recommendation.editedAt,
              extra: {
                itemReviewed: {
                  "@type": "Person",
                  name: recommendation.supervisor.name || "Supervisor",
                },
                reviewRating: {
                  "@type": "Rating",
                  ratingValue: recommendation.rating,
                  bestRating: 5,
                  worstRating: 1,
                },
              },
            }),
            buildBreadcrumbList([
              { name: "Supervisors", path: "/supervisor" },
              {
                name: recommendation.supervisor.name || "Supervisor",
                path: `/supervisor/${recommendation.supervisor.id}`,
              },
              {
                name: "Recommendation",
                path: `/supervisor/${recommendation.supervisor.id}/recommendation/${recommendation.id}`,
              },
            ]),
          ]}
        />
      }
      relatedContent={
        <RelatedContent title="Related recommendations" items={related} />
      }
      isFrozen={recommendation.isFrozen ?? false}
      frozenEntityId={recommendation.id}
      frozenModule="RECOMMENDATION"
      frozenEntityType="POST"
      frozenOwnerId={recommendation.authorId ?? null}
      frozenHasActiveAppeal={recommendation.hasActiveAppeal ?? false}
      backHref={`/supervisor/${recommendation.supervisor.id}`}
      backLabel="Back to Supervisor Profile"
      authorHref={
        recommendation.isAnonymous
          ? undefined
          : `/scholars/${recommendation.author?.id}`
      }
      authorName={
        recommendation.isAnonymous
          ? "Anonymous Scholar"
          : recommendation.author?.name || "Scholar"
      }
      authorHandle={
        recommendation.isAnonymous
          ? undefined
          : recommendation.author?.handle || undefined
      }
      authorAvatarUrl={
        recommendation.isAnonymous
          ? null
          : recommendation.author?.avatarUrl || undefined
      }
      authorVerified={
        !recommendation.isAnonymous &&
        !!recommendation.author?.institutionVerifiedAt
      }
      authorId={
        recommendation.isAnonymous ? undefined : recommendation.authorId
      }
      currentUserId={user?.id}
      createdDate={recommendation.createdAt}
      footerVoteButton={
        <VoteButton
          targetId={recommendation.id}
          module="RECOMMENDATION"
          initialTotalVotes={recommendation.totalVotes}
          initialUserVote={userVote}
          isOwnContent={!!user?.id && user.id === recommendation.authorId}
        />
      }
      footerBookmarkButton={
        <BookmarkButton
          frozen={recommendation.isFrozen === true}
          targetId={recommendation.id}
          module="RECOMMENDATION"
          initialTotalBookmarks={recommendation.totalBookmarks ?? 0}
          initialIsBookmarked={Array.isArray(recommendation.bookmarks) && recommendation.bookmarks.length > 0}
        />
      }
      footerCommentsHref={`/supervisor/${recommendation.supervisor.id}/recommendation/${recommendation.id}#comments`}
      footerCommentsCount={recommendation.totalComments}
      footerReportMenu={
        <ReportMenu
          entityId={recommendation.id}
          entityType="POST"
          module="RECOMMENDATION"
          ownerId={recommendation.author?.id ?? null}
          currentUserId={user?.id ?? null}
          isFrozen={recommendation.isFrozen}
          hasActiveAppeal={recommendation.hasActiveAppeal}
        />
      }
      discussion={
        <CommentSection
          locked={recommendation.isFrozen ?? false}
          comments={recommendation.comments as CommentWithAuthorAndVotes[]}
          totalComments={recommendation.totalComments}
          targetId={recommendation.id}
          module="recommendation"
          currentUserId={user?.id ?? null}
          postAuthorId={
            recommendation.isAnonymous ? undefined : recommendation.authorId
          }
        />
      }
      managementControls={
        user?.id === recommendation.authorId ? (
          <OwnerActionsDropdown
            editHref={`/supervisor/${id}/recommendation/${recommendationId}/edit`}
            onDelete={handleDelete}
            isOwner={true}
            editLabel="Edit Recommendation"
            deleteLabel="Delete Recommendation"
          />
        ) : null
      }
    >
      {recommendation.isAnonymous ? (
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
          Anonymous recommendation
        </p>
      ) : null}
      <p className="text-sm font-semibold text-slate-700 mb-2">
        Recommendation for{" "}
        <Link
          href={`/supervisor/${recommendation.supervisor.id}`}
          className="break-words text-blue-700 [overflow-wrap:anywhere] hover:underline"
          prefetch={false}
        >
          {recommendation.supervisor.name}
        </Link>
      </p>
      <div className="space-y-3 mb-4">
        <div>
          <p className="text-xs font-semibold text-slate-700 mb-1">
            Overall Mentorship Rating
          </p>
          <div className="flex items-center gap-2">
            <StarRating rating={recommendation.rating} size="md" />
            <span className="font-bold text-slate-800">
              {recommendation.rating.toFixed(1)} / 5
            </span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-x-4">
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-1">
              Responsiveness
            </p>
            <StarRating rating={recommendation.responsivenessScore} size="sm" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-1">
              Guidance
            </p>
            <StarRating rating={recommendation.guidanceScore} size="sm" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-1">
              Turnaround
            </p>
            <p className="text-sm font-bold text-slate-800">
              {recommendation.turnaroundTimeDays}d
            </p>
          </div>
        </div>
      </div>

      <div>
        <p className="text-base sm:text-lg font-semibold text-slate-800 mb-2 sm:mb-3">
          Mentorship Feedback
        </p>
        <RichContent
          content={recommendation.feedback}
          className="text-slate-700 leading-relaxed"
        />
      </div>
    </DetailPageCardShell>
  );
}
