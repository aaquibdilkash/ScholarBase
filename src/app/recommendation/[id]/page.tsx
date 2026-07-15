import prisma from "@/lib/db";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { CommentSection } from "@/components/interactions/CommentSection";
import { LikeButton } from "@/components/interactions/LikeButton";
import Image from "next/image";
import { notFound } from "next/navigation";
import { CommentIcon } from "@/components/icons/CommentIcon";

export default async function RecommendationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();

  const recommendation = await prisma.recommendation.findUnique({
    where: { id },
    include: {
      author: true,
      supervisor: true,
      comments: {
        where: { parentId: null },
        orderBy: { createdAt: "asc" },
        include: {
          author: true,
          likes: {
            where: { userId: user?.id },
          },
          _count: {
            select: {
              likes: true,
            },
          },
          replies: {
            orderBy: { createdAt: "asc" },
            include: {
              author: true,
              likes: {
                where: { userId: user?.id },
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
          comments: true,
        },
      },
    },
  });

  if (!recommendation) {
    notFound();
  }

  const isLiked = !!user && recommendation.likes.length > 0;

  return (
    <main className="max-w-4xl mx-auto py-10 px-4">
      <Link
        href={`/supervisor/${recommendation.supervisor.id}`}
        className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-blue-600 mb-8 transition-colors"
      >
        ← Back to Supervisor Profile
      </Link>

      <div className="sb-surface-strong p-8 md:p-12 rounded-xl">
        <header className="flex items-center gap-3 mb-8">
          <Link href={`/scholar/${recommendation.author.id}`}>
            <div className="w-12 h-12 rounded-full bg-slate-100 border overflow-hidden hover:ring-2 hover:ring-blue-200 transition">
              {recommendation.author.avatarUrl ? (
                <Image
                  src={recommendation.author.avatarUrl}
                  alt="User"
                  width={48}
                  height={48}
                  unoptimized
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-bold text-slate-500 text-lg">
                  {recommendation.author.name?.charAt(0).toUpperCase() || "?"}
                </div>
              )}
            </div>
          </Link>
          <div>
            <Link
              href={`/scholar/${recommendation.author.id}`}
              className="font-semibold text-slate-950 hover:underline"
            >
              <p className="font-semibold text-slate-950">
                {recommendation.author.name}
              </p>
            </Link>

            <p className="text-sm text-slate-500">
              Recommends{" "}
              <Link
                href={`/supervisor/${recommendation.supervisor.id}`}
                className="font-semibold text-slate-900 hover:text-blue-600 hover:underline"
              >
                {recommendation.supervisor.name}
              </Link>
            </p>
          </div>
        </header>
        <p className="mb-2 text-sm font-semibold text-slate-900">
          {`Mentorship Rating: ${recommendation.rating}/5`}
        </p>

        <div className="mb-6 text-sm text-slate-700 space-y-1">
          <p>{`Turnaround Time: ${recommendation.turnaroundTimeDays} day(s)`}</p>
          <p>{`Responsiveness: ${recommendation.responsivenessScore}/5`}</p>
          <p>{`Guidance Quality: ${recommendation.guidanceScore}/5`}</p>
        </div>

        <p className="mb-8 text-slate-600 whitespace-pre-wrap">
          {`Mentorship Feedback: ${recommendation.feedback}`}
        </p>

        <div className="border-t border-slate-100 pt-6 flex items-center gap-6">
          <LikeButton
            targetId={recommendation.id}
            type="recommendation"
            initialLikes={recommendation._count.likes}
            initialIsLiked={isLiked}
          />
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
            <CommentIcon className="w-5 h-5" />
            {recommendation._count.comments} Comments
          </div>
        </div>
      </div>

      <div
        id="comments"
        className="mt-8 sb-surface-strong p-8 md:p-12 rounded-xl"
      >
        <h3 className="text-2xl font-bold text-slate-900 mb-6">Discussion</h3>
        <CommentSection
          comments={recommendation.comments}
          targetId={recommendation.id}
          type="recommendation"
          currentUserId={user?.id ?? null}
        />
      </div>
    </main>
  );
}
