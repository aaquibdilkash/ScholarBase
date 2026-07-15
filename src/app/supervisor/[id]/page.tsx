import prisma from "@/lib/db";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { CommentSection } from "@/components/interactions/CommentSection";
import { LikeButton } from "@/components/interactions/LikeButton";
import { RecommendationCard } from "@/app/supervisor/components/RecommendationCard";

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
      recommendations: {
        include: {
          author: true,
          likes: {
            where: {
              userId: user?.id,
            },
          },
          _count: {
            select: {
              comments: true,
              likes: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      comments: {
        where: { parentId: null },
        include: {
          author: true,
          likes: {
            where: {
              userId: user?.id,
            },
          },
          _count: {
            select: {
              likes: true,
            },
          },
          replies: {
            include: {
              author: true,
              likes: {
                where: {
                  userId: user?.id,
                },
              },
              _count: {
                select: {
                  likes: true,
                },
              },
            },
          },
        },
      },
      likes: {
        where: {
          userId: user?.id,
        },
      },
      _count: {
        select: {
          likes: true,
        },
      },
    },
  });

  if (!supervisor)
    return (
      <div className="p-8 text-center text-slate-500 font-medium">
        Supervisor not found
      </div>
    );

  const isLiked = supervisor.likes.length > 0;
  const hasUserRecommendation =
    !!user && supervisor.recommendations.some((r) => r.authorId === user.id);

  return (
    <main className="max-w-4xl mx-auto py-10 px-4">
      <Link
        href="/supervisor"
        className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-blue-600 mb-8 transition-colors"
      >
        ← Back to Search
      </Link>

      {/* Profile Header Card */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 p-8 md:p-10 mb-8">
        <div className=" flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
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
              href={`/supervisor/${supervisor.id}/recommend`}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold shadow-sm shadow-blue-600/20 hover:bg-blue-700 hover:shadow-md hover:shadow-blue-600/30 transition-all duration-200 whitespace-nowrap"
            >
              + Recommend
            </Link>
          )}
        </div>
        <div className="mt-6 border-t border-slate-100 pt-6 flex items-center justify-end">
          <LikeButton
            targetId={supervisor.id}
            type="supervisor"
            initialLikes={supervisor._count.likes}
            initialIsLiked={isLiked}
          />
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

      <div id="comments">
        <h3 className="text-2xl font-bold text-slate-900 mb-6">Discussion</h3>
        <CommentSection
          comments={supervisor.comments}
          targetId={supervisor.id}
          type="supervisor"
          currentUserId={user?.id ?? null}
        />
      </div>
    </main>
  );
}
