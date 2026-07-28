import Link from "next/link";

import { getCurrentUser } from "@/lib/auth";
import { CommentSection } from "@/components/interactions/CommentSection";
import { VoteButton } from "@/components/interactions/VoteButton";

import { Carousel } from "@/components/ui/Carousel";
import { RecommendationCard } from "@/components/supervisor/RecommendationCard";
import { deleteSupervisor, getSupervisor } from "@/app/actions/supervisors";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { StarRating } from "@/components/ui/StarRating";
import { RichContent } from "@/components/content/RichContent";

export default async function SupervisorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();

  const supervisor = await getSupervisor(id, user?.id);

  if (!supervisor)
    return (
      <div className="p-8 text-center text-slate-500 font-medium">
        Supervisor not found
      </div>
    );

  async function handleDelete() {
    "use server";
    await deleteSupervisor(supervisor!.id);
  }

  // Compute vote counts from votes array
  const upvotes =
    (supervisor.votes as any[])?.filter((v: any) => v.voteType === "UPVOTE")
      .length ?? 0;
  const downvotes =
    (supervisor.votes as any[])?.filter((v: any) => v.voteType === "DOWNVOTE")
      .length ?? 0;
  const userVote =
    ((supervisor.votes as any[])?.find((v: any) => v.userId === user?.id)
      ?.voteType as "UPVOTE" | "DOWNVOTE" | null) ?? null;

  const hasUserRecommendation =
    !!user && supervisor.recommendations.some((r) => r.authorId === user.id);
  const isFollowing = (supervisor.author.followers?.length ?? 0) > 0;

  const recommendationCount = supervisor.recommendations.length;
  const avgRating =
    recommendationCount > 0
      ? supervisor.recommendations.reduce((sum, rec) => sum + rec.rating, 0) /
        recommendationCount
      : 0;

  const ratingDistribution = [5, 4, 3, 2, 1].map((stars) => {
    const count = supervisor.recommendations.filter(
      (r) => r.rating === stars,
    ).length;
    return {
      stars,
      count,
      percentage:
        recommendationCount > 0 ? (count / recommendationCount) * 100 : 0,
    };
  });

  return (
    <DetailPageCardShell
      backHref="/supervisor"
      backLabel="Back to Search"
      authorId={supervisor.authorId}
      isFollowing={isFollowing}
      authorHref={`/scholar/${supervisor.authorId}`}
      authorName={supervisor.author?.name || "Scholar"}
      authorHandle={supervisor.author?.handle || undefined}
      authorAvatarUrl={supervisor.author?.avatarUrl || undefined}
      createdDate={supervisor.createdAt}
      footerCommentsHref={`/supervisor/${supervisor.id}#comments`}
      footerCommentsCount={supervisor.comments.length}
      footerVoteButton={
        <VoteButton
          targetId={supervisor.id}
          type="supervisor"
          initialUpvotes={upvotes}
          initialDownvotes={downvotes}
          initialUserVote={userVote}
        />
      }
      managementControls={
        user?.id === supervisor.authorId ? (
          <OwnerActionsDropdown
            editHref={`/supervisor/${supervisor.id}/edit`}
            onDelete={handleDelete}
            isOwner={true}
            editLabel="Edit Profile"
            deleteLabel="Delete"
          />
        ) : null
      }
      discussion={
        <div
          className="mt-8 sb-surface-strong p-8 md:p-12 rounded-xl"
          id="comments"
        >
          <h3 className="text-2xl font-bold text-slate-900 mb-6">Discussion</h3>
          <CommentSection
            comments={supervisor.comments}
            targetId={supervisor.id}
            type="supervisor"
            currentUserId={user?.id ?? null}
            postAuthorId={supervisor.authorId}
          />
        </div>
      }
    >
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 p-8 md:p-10 mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
              {supervisor.name}
            </h1>
            <p className="text-lg text-slate-500 font-medium">
              {supervisor.university}
            </p>
            {supervisor.department && (
              <p className="text-sm text-slate-400 mt-1">
                {supervisor.department}
              </p>
            )}
            {supervisor.about && (
              <RichContent
                content={supervisor.about}
                className="mt-4 text-sm leading-6 text-slate-700"
              />
            )}
          </div>

          {!hasUserRecommendation && (
            <Link
              href={`/supervisor/${supervisor.id}/recommendation/add`}
              className="sb-button-primary"
            >
              + Recommend
            </Link>
          )}
        </div>
      </div>

      {recommendationCount > 0 && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 p-8 md:p-10 mb-8">
          <h3 className="text-2xl font-bold text-slate-900 mb-6">
            Overall Rating
          </h3>
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex flex-col items-center justify-center text-center">
              <p className="text-5xl font-extrabold text-slate-900">
                {avgRating.toFixed(1)}
              </p>
              <StarRating rating={avgRating} size="lg" />
              <p className="text-sm text-slate-500 mt-2">
                ({recommendationCount} ratings)
              </p>
            </div>
            <div className="w-full flex-1 space-y-2">
              {ratingDistribution.map((item) => (
                <div key={item.stars} className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-600 w-12">
                    {item.stars} star
                  </span>
                  <div className="w-full bg-slate-100 rounded-full h-2.5">
                    <div
                      className="bg-yellow-400 h-2.5 rounded-full"
                      style={{ width: `${item.percentage}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-slate-500 w-12 text-right">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recommendations List */}
      <div className="space-y-6 mb-12">
        <h3
          className="text-2xl font-bold text-slate-900 mb-6"
          id="recommendations"
        >
          Recommendations ({supervisor.recommendations.length})
        </h3>
        {supervisor.recommendations.length === 0 ? (
          <p className="text-slate-500 bg-white p-8 rounded-2xl border border-slate-200/60 text-center">
            No recommendations yet. Be the first to share your experience!
          </p>
        ) : (
          <Carousel>
            {supervisor.recommendations.map((r) => (
              <RecommendationCard
                key={r.id}
                recommendation={r}
                supervisor={supervisor}
                currentUserId={user?.id}
              />
            ))}
          </Carousel>
        )}
      </div>
    </DetailPageCardShell>
  );
}
