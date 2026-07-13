import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { LikeButton } from "@/components/interactions/LikeButton";
import { CommentSection } from "@/components/interactions/CommentSection";
import Link from "next/link";
import { RichContent } from "@/components/content/RichContent";
import { CommentIcon } from "@/components/icons/CommentIcon";

import { getCurrentUser } from "@/lib/auth";

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const article = await prisma.article.findUnique({
    where: { slug },
    select: {
      id: true,
      title: true,
      content: true,
      createdAt: true,
      author: {
        select: {
          id: true,
          name: true,
        },
      },
      likes: {
        where: { userId: user?.id },
        select: { userId: true },
      },
      comments: {
        where: { parentId: null },
        select: {
          id: true,
          content: true,
          createdAt: true,
          parentId: true,
          author: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
          likes: {
            where: { userId: user?.id },
            select: { userId: true },
          },
          replies: {
            select: {
              id: true,
              content: true,
              createdAt: true,
              parentId: true,
              author: {
                select: {
                  id: true,
                  name: true,
                  avatarUrl: true,
                },
              },
              likes: {
                where: { userId: user?.id },
                select: { userId: true },
              },
              _count: {
                select: {
                  likes: true,
                },
              },
            },
            orderBy: { createdAt: "asc" },
          },
          _count: {
            select: {
              likes: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      _count: {
        select: {
          likes: true,
          comments: true,
        },
      },
    },
  });

  if (!article) notFound();

  const isLiked = !!user && article.likes.length > 0;

  return (
    <main className="mx-auto max-w-5xl py-6">
      <Link
        href="/blog"
        className="inline-flex items-center text-sm font-medium text-slate-500 transition-colors hover:text-blue-700 mb-8"
      >
        ← Back to Blog
      </Link>

      <article className="sb-surface-strong mb-8 p-8 md:p-12">
        <header className="mb-10 border-b border-slate-100 pb-8">
          <h1 className="mb-6 text-4xl font-semibold leading-tight tracking-tight text-slate-950 md:text-5xl">
            {article.title}
          </h1>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 text-lg font-semibold text-blue-700">
              {article.author.name?.charAt(0) || "S"}
            </div>
            <div>
              <Link
                href={`/scholar/${article.author.id}`}
                className="font-semibold text-slate-950 hover:underline"
              >
                <p className="font-semibold text-slate-950">
                  {article.author.name}
                </p>
              </Link>

              <p className="text-sm text-slate-500">
                {new Date(article.createdAt).toLocaleDateString("en-US", {
                  dateStyle: "medium",
                })}
              </p>
            </div>
          </div>
        </header>

        <div className="prose prose-slate prose-lg md:prose-xl max-w-none mb-12 prose-headings:text-slate-950 prose-a:text-blue-700 hover:prose-a:text-blue-600">
          <RichContent content={article.content} />
        </div>

        <div className="border-t border-slate-100 pt-6 flex items-center gap-6">
          <LikeButton
            targetId={article.id}
            type="article"
            initialLikes={article._count.likes}
            initialIsLiked={isLiked}
          />
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
            <CommentIcon className="w-5 h-5" />
            {article._count.comments} Comments
          </div>
        </div>
      </article>

      <div className="sb-surface-strong p-8 md:p-12">
        <h3 className="mb-6 text-2xl font-semibold text-slate-950">
          Discussions
        </h3>
        <CommentSection
          comments={article.comments}
          targetId={article.id}
          type="article"
          currentUserId={user?.id ?? null}
        />
      </div>
    </main>
  );
}
