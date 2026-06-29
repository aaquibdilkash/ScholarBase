import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { LikeButton } from "@/components/interactions/LikeButton";
import { CommentSection } from "@/components/interactions/CommentSection";
import Link from "next/link";

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await prisma.article.findUnique({
    where: { slug },
    include: {
      author: true,
      likes: true,
      comments: {
        where: { parentId: null },
        include: { author: true, replies: { include: { author: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!article) notFound();

  return (
    <main className="max-w-4xl mx-auto py-10 px-4">
      <Link
        href="/blog"
        className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-blue-600 mb-8 transition-colors"
      >
        ← Back to Blog
      </Link>

      {/* The Article Paper Card */}
      <article className="bg-white rounded-3xl shadow-sm border border-slate-200/60 p-8 md:p-12 mb-8">
        <header className="mb-10 pb-8 border-b border-slate-100">
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight mb-6">
            {article.title}
          </h1>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg">
              {article.author.name?.charAt(0) || "S"}
            </div>
            <div>
              <p className="text-slate-900 font-semibold">
                {article.author.name}
              </p>
              <p className="text-sm text-slate-500">
                {new Date(article.createdAt).toLocaleDateString(undefined, {
                  dateStyle: "medium",
                })}
              </p>
            </div>
          </div>
        </header>

        <div className="prose prose-slate prose-lg md:prose-xl max-w-none mb-12 prose-headings:text-slate-900 prose-a:text-blue-600 hover:prose-a:text-blue-500">
          {article.content}
        </div>

        <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
          <LikeButton
            targetId={article.id}
            type="article"
            initialLikes={article.likes.length}
          />
        </div>
      </article>

      {/* The Discussions Card */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 p-8 md:p-12">
        <h3 className="text-2xl font-bold text-slate-900 mb-6">Discussions</h3>
        <CommentSection
          comments={article.comments}
          targetId={article.id}
          type="article"
        />
      </div>
    </main>
  );
}
