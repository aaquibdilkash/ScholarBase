import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { CommentSection } from "@/components/interactions/CommentSection";
import { VoteButton } from "@/components/interactions/VoteButton";
import { BookmarkButton } from "@/components/interactions/BookmarkButton";

import { RecommendationsSection } from "@/components/supervisor/RecommendationsSection";
import { OverallRatingSection } from "@/components/supervisor/OverallRatingSection";
import { SupervisorHeaderActions } from "@/components/supervisor/SupervisorHeaderActions";
import {
  deleteSupervisor,
  getSupervisor,
  getSupervisorRecommendationMeta,
} from "@/app/actions/supervisors";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  buildBreadcrumbList,
  buildContentJsonLd,
  CONTENT_SCHEMA,
} from "@/lib/schema";
import { ReportMenu } from "@/components/cards/ReportMenu";
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
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supervisor = await getSupervisor(id).catch(() => null);
  if (!supervisor) {
    return buildNoindexMetadata("Removed content");
  }
  const name = supervisor.name || "PhD Supervisor";
  const university = supervisor.university
    ? ` at ${supervisor.university}`
    : "";
  return buildMetadata({
    title: `${name}${university} - PhD Supervisor`,
    description: (
      supervisor.about ||
      `Profiles, ratings, and recommendations for PhD supervisor ${supervisor.name || ""}.`
    ).replace(/<[^>]*>/g, " "),
    path: `/supervisor/${supervisor.id}`,
    type: "profile",
    // Anonymous supervisors must not leak the author through metadata
    // (og:author / JSON-LD), mirroring the card and detail-page contract.
    author: supervisor.isAnonymous
      ? undefined
      : supervisor.author?.name || undefined,
    publishedTime: supervisor.createdAt,
    section: "Supervisors",
  });
}

export default async function SupervisorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();

  const supervisor = await getSupervisor(id, user?.id);

  if (!supervisor) {
    const removed = await getModeratorDeletedContent("supervisor", { id });
    if (!removed) notFound();
    return (
      <RemovedContentNotice
        backHref="/supervisor"
        backLabel="Back to Supervisors"
        entityId={removed.id}
        module="SUPERVISOR"
        ownerId={removed.authorId}
        currentUserId={user?.id}
        hasActiveAppeal={removed.hasActiveAppeal}
        noun="supervisor profile"
      />
    );
  }

  const recMeta = await getSupervisorRecommendationMeta(id);

  async function handleDelete() {
    "use server";
    const res = await deleteSupervisor(supervisor!.id);
    if (res?.success === false) return res;
    return { redirect: "/supervisor", invalidateQueries: [["supervisors"]] };
  }

  const userVote =
    (supervisor.votes?.[0]?.voteType as "UPVOTE" | "DOWNVOTE" | null) ?? null;

  const hasUserRecommendation = recMeta.hasUserRecommendation;
  const isFollowing = (supervisor.author?.followers?.length ?? 0) > 0;

  const related = await getRelatedContent("SUPERVISOR", supervisor.id);

  const recommendationCount = recMeta.totalCount;
  const avgRating = recMeta.avgRating;
  const ratingDistribution = recMeta.ratingDistribution;

  return (
    <DetailPageCardShell
      structuredData={
        <JsonLd
          data={[
            buildContentJsonLd({
              type: CONTENT_SCHEMA.supervisor,
              path: `/supervisor/${supervisor.id}`,
              name: supervisor.name,
              description:
                supervisor.about ||
                [supervisor.department, supervisor.university]
                  .filter(Boolean)
                  .join(", "),
              datePublished: supervisor.createdAt,
              extra: {
                ...(supervisor.university
                  ? {
                      affiliation: {
                        "@type": "Organization",
                        name: supervisor.university,
                      },
                    }
                  : {}),
              },
            }),
            buildBreadcrumbList([
              { name: "Supervisors", path: "/supervisor" },
              { name: supervisor.name, path: `/supervisor/${supervisor.id}` },
            ]),
          ]}
        />
      }
      relatedContent={
        <RelatedContent title="Related supervisors" items={related} />
      }
      preservedContent={
        <>
          <OverallRatingSection
            supervisorId={supervisor.id}
            initialCount={recommendationCount}
            initialVisibleCount={recMeta.visibleCount}
            initialAvgRating={avgRating}
            initialDistribution={ratingDistribution}
          />

          {/* Recommendations List — reactive count/empty-state, no server refetch */}
          <RecommendationsSection
            supervisorId={supervisor.id}
            supervisorName={supervisor.name}
            initialRecommendations={supervisor.recommendations}
            initialCount={recommendationCount}
            initialVisibleCount={recMeta.visibleCount}
            currentUserId={user?.id}
          />
        </>
      }
      isFrozen={supervisor.isFrozen ?? false}
      frozenEntityId={supervisor.id}
      frozenModule="SUPERVISOR"
      frozenEntityType="POST"
      frozenOwnerId={supervisor.author?.id ?? null}
      frozenHasActiveAppeal={supervisor.hasActiveAppeal ?? false}
      backHref="/supervisor"
      backLabel="Back to Supervisors"
      authorId={supervisor.isAnonymous ? undefined : supervisor.authorId}
      isFollowing={supervisor.isAnonymous ? false : isFollowing}
      currentUserId={user?.id}
      authorHref={
        supervisor.isAnonymous
          ? undefined
          : `/scholars/${supervisor.authorId}`
      }
      authorName={
        supervisor.isAnonymous
          ? "Anonymous Scholar"
          : supervisor.author?.name || "Scholar"
      }
      authorHandle={
        supervisor.isAnonymous
          ? undefined
          : supervisor.author?.handle || undefined
      }
      authorAvatarUrl={
        supervisor.isAnonymous
          ? null
          : supervisor.author?.avatarUrl || undefined
      }
      authorVerified={
        !supervisor.isAnonymous && !!supervisor.author?.institutionVerifiedAt
      }
      createdDate={supervisor.createdAt}
      footerBookmarkButton={
        <BookmarkButton
          frozen={supervisor.isFrozen === true}
          targetId={supervisor.id}
          module="SUPERVISOR"
          initialTotalBookmarks={supervisor.totalBookmarks ?? 0}
          initialIsBookmarked={
            Array.isArray(supervisor.bookmarks) &&
            supervisor.bookmarks.length > 0
          }
        />
      }
      footerCommentsHref={`/supervisor/${supervisor.id}#comments`}
      footerCommentsCount={supervisor.totalComments}
      footerReportMenu={
        <ReportMenu
          entityId={supervisor.id}
          entityType="POST"
          module="SUPERVISOR"
          ownerId={supervisor.author?.id ?? null}
          currentUserId={user?.id ?? null}
          isFrozen={supervisor.isFrozen}
          hasActiveAppeal={supervisor.hasActiveAppeal}
        />
      }
      footerVoteButton={
        <VoteButton
          targetId={supervisor.id}
          module="SUPERVISOR"
          initialTotalVotes={supervisor.totalVotes}
          initialUserVote={userVote}
          isOwnContent={user?.id === supervisor.author?.id}
        />
      }
      discussion={
        <CommentSection
          locked={supervisor.isFrozen ?? false}
          comments={supervisor.comments}
          totalComments={supervisor.totalComments}
          targetId={supervisor.id}
          module="supervisor"
          currentUserId={user?.id ?? null}
          postAuthorId={
            supervisor.isAnonymous ? undefined : supervisor.authorId
          }
        />
      }
    >
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200/60 p-4 sm:p-6 md:p-8 lg:p-10 mb-6 sm:mb-8">
        <div className="min-w-0 w-full">
          {supervisor.isAnonymous ? (
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Anonymous supervisor
            </p>
          ) : null}
          <div className="flex min-w-0 w-full flex-row items-start justify-between gap-4 sm:gap-6">
            <div className="min-w-0 flex-1">
              <h1 className="max-w-full break-words text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight mb-1.5 sm:mb-2 [overflow-wrap:anywhere]">
                {supervisor.name}
              </h1>
              <p className="text-base sm:text-lg text-slate-500 font-medium break-words [overflow-wrap:anywhere]">
                {supervisor.university}
              </p>
              {supervisor.department && (
                <p className="text-xs sm:text-sm text-slate-400 mt-1 break-words [overflow-wrap:anywhere]">
                  {supervisor.department}
                </p>
              )}
            </div>

            <div className="flex w-auto shrink-0 justify-end pt-1">
              <SupervisorHeaderActions
                supervisorId={supervisor.id}
                isSupervisorOwner={user?.id === supervisor.authorId}
                supervisorEditHref={`/supervisor/${supervisor.id}/edit`}
                onDeleteSupervisor={handleDelete}
                initialHasRecommendation={hasUserRecommendation}
                initialUserRecommendationId={recMeta.userRecommendationId}
              />
            </div>
          </div>

          {supervisor.about && (
            <RichContent
              content={supervisor.about}
              className="mt-3 sm:mt-4 w-full max-w-full text-xs sm:text-sm leading-6 text-slate-700 break-words overflow-wrap-anywhere [&_*]:max-w-full [&_*]:break-words [&_*]:overflow-wrap-anywhere"
            />
          )}
        </div>
      </div>
    </DetailPageCardShell>
  );
}
