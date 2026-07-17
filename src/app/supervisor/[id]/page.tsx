import prisma from "@/lib/db";
import Link from "next/link";

import { getCurrentUser } from "@/lib/auth";
import { CommentSection } from "@/components/interactions/CommentSection";
import { LikeButton } from "@/components/interactions/LikeButton";

import { RecommendationCard } from "@/app/supervisor/components/RecommendationCard";
import { deleteSupervisor } from "@/app/actions/supervisors";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";

export default async function SupervisorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();

  const supervisor = await prisma.supervisor.findUnique({
    where: { id },
    include: {
      author: true,

      recommendations: {
        include: {
          author: true,
          likes: { where: { userId: user?.id } },
          _count: { select: { comments: true, likes: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      comments: {
        where: { parentId: null },
        include: {
          author: true,
          likes: { where: { userId: user?.id } },
          _count: { select: { likes: true } },
          replies: {
            include: {
              author: true,
              likes: { where: { userId: user?.id } },
              _count: { select: { likes: true } },
            },
          },
        },
      },
      likes: { where: { userId: user?.id } },
      _count: { select: { likes: true } },
    },
  });

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

  const isLiked = supervisor.likes.length > 0;
  const hasUserRecommendation =
    !!user && supervisor.recommendations.some((r) => r.authorId === user.id);

  return (
    <DetailPageCardShell
      backHref="/supervisor"
      backLabel="Back to Search"
      authorHref={`/scholar/${supervisor.authorId}`}
      authorName={supervisor.author?.name || "Scholar"}
      authorHandle={supervisor.author?.handle || undefined}
      authorAvatarUrl={supervisor.author?.avatarUrl || undefined}
      footerCommentsHref={`/supervisor/${supervisor.id}#comments`}
      footerCommentsCount={supervisor.comments.length}
      footerLikeButton={
        <LikeButton
          targetId={supervisor.id}
          type="supervisor"
          initialLikes={supervisor._count.likes}
          initialIsLiked={isLiked}
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
          id="comments"
          className="mt-8 sb-surface-strong p-8 md:p-12 rounded-xl"
        >
          <h3 className="text-2xl font-bold text-slate-900 mb-6">Discussion</h3>
          <CommentSection
            comments={supervisor.comments}
            targetId={supervisor.id}
            type="supervisor"
            currentUserId={user?.id ?? null}
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
              <p className="mt-4 text-sm leading-6 text-slate-700">
                {supervisor.about}
              </p>
            )}
          </div>

          {!hasUserRecommendation && (
            <Link
              href={`/supervisor/${supervisor.id}/recommendation/add`}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold shadow-sm shadow-blue-600/20 hover:bg-blue-700 hover:shadow-md hover:shadow-blue-600/30 transition-all duration-200 whitespace-nowrap"
            >
              + Recommend
            </Link>
          )}
        </div>
      </div>

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
          <div className="grid gap-6 md:grid-cols-2">
            {supervisor.recommendations.map((r) => (
              <RecommendationCard
                key={r.id}
                recommendation={r}
                supervisor={supervisor}
                currentUserId={user?.id}
              />
            ))}
          </div>
        )}
      </div>
    </DetailPageCardShell>
  );
}
