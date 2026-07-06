import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { LikeButton } from "@/components/interactions/LikeButton";
import { CommentSection } from "@/components/interactions/CommentSection";
import Image from "next/image";

export default async function SinglePostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Fetch the post deeply to include top-level comments and their nested replies
  const post = await prisma.socialPost.findUnique({
    where: { id },
    include: {
      author: true,
      likes: true,
      comments: {
        where: { parentId: null }, // Only fetch top-level comments first
        include: {
          author: true,
          likes: true,
          replies: {
            // Fetch the nested replies
            include: { author: true, likes: true },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!post) notFound();

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <main className="mx-auto max-w-3xl py-6">
      <Link
        href="/feed"
        className="mb-8 inline-flex items-center text-sm font-semibold text-slate-500 transition-colors hover:text-blue-700"
      >
        <svg
          className="w-5 h-5 mr-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M10 19l-7-7m0 0l7-7m-7 7h18"
          />
        </svg>
        Back to Feed
      </Link>

      <article className="sb-surface-strong mb-8 p-6 md:p-8">
        <div className="mb-6 flex items-center gap-4">
          <Link href={`/scholar/${post.authorId}`} className="shrink-0">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border bg-slate-100 transition hover:ring-2 hover:ring-blue-100">
              {post.author.avatarUrl ? (
                <Image
                  src={post.author.avatarUrl}
                  alt="Author"
                  width={56}
                  height={56}
                  unoptimized
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xl font-semibold text-slate-400">
                  {post.author.name?.charAt(0).toUpperCase() || "?"}
                </span>
              )}
            </div>
          </Link>

          <div>
            <Link
              href={`/scholar/${post.authorId}`}
              className="text-lg font-semibold text-slate-950 transition hover:text-blue-700 hover:underline"
            >
              {post.author.name}
            </Link>
            <div className="mt-0.5 text-sm font-medium text-slate-500">
              {post.author.handle && (
                <span className="mr-2">@{post.author.handle}</span>
              )}
              <span>{formatDate(post.createdAt)}</span>
            </div>
          </div>
        </div>

        <p className="mb-8 whitespace-pre-wrap text-xl leading-relaxed text-slate-800">
          {post.content}
        </p>

        <div className="flex items-center gap-6 border-t border-slate-100 pt-4">
          <LikeButton
            targetId={post.id}
            type="post"
            initialLikes={post.likes.length}
          />
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            {post.comments.length} Comments
          </div>
        </div>
      </article>

      <div className="sb-surface-strong p-6 md:p-8">
        <h3 className="mb-6 text-xl font-semibold text-slate-950">
          Discussion
        </h3>
        <CommentSection
          comments={post.comments}
          targetId={post.id}
          type="post"
        />
      </div>
    </main>
  );
}
