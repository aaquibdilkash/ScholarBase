import { notFound } from "next/navigation";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import { VoteButton } from "@/components/interactions/VoteButton";
import { CommentSection } from "@/components/interactions/CommentSection";
import { RichContent } from "@/components/content/RichContent";
import { getCurrentUser } from "@/lib/auth";
import { deleteArticle, getArticle } from "@/app/actions/blog";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug).catch(() => null);
  if (!article) return { title: "Article" };
  return buildMetadata({
    title: article.title,
    description: article.excerpt || article.title,
    path: `/blog/${article.slug}`,
    type: "article",
  });
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getCurrentUser();

  const article = await getArticle(slug, user?.id);

  if (!article) notFound();

  const a = article;

  const userVote =
    (a.votes?.find((v) => v.userId === user?.id)?.voteType as
      | "UPVOTE"
      | "DOWNVOTE"
      | null) ?? null;

  async function handleDelete() {
    "use server";
        await deleteArticle(a.id);
    return { redirect: "/blog" };
  }

  return (
    <DetailPageCardShell
      backHref="/blog"
      backLabel="Back to Blogs"
      authorHref={`/scholars/${a.author.id}`}
      authorName={a.author.name || "Scholar"}
      authorHandle={a.author.handle || undefined}
      authorAvatarUrl={a.author.avatarUrl || undefined}
      managementControls={
        user?.id === a.authorId ? (
          <OwnerActionsDropdown
            editHref={`/blog/${a.slug}/edit`}
            onDelete={handleDelete}
            isOwner={true}
            editLabel="Edit Article"
            deleteLabel="Delete"
          />
        ) : null
      }
      authorId={a.authorId}
      isFollowing={(a.author as { followers?: { followerId: string }[] })?.followers?.length ? true : false}
      currentUserId={user?.id}
      createdDate={a.createdAt}
      editedDate={a.updatedAt > a.createdAt ? a.updatedAt : undefined}
      footerVoteButton={
        <VoteButton
          targetId={a.id}
          module="ARTICLE"
          initialTotalVotes={a.totalVotes}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/blog/${a.slug}#comments`}
      footerCommentsCount={a.totalComments}
      discussion={
           <CommentSection
             comments={a.comments}
             targetId={a.id}
             module="article"
             currentUserId={user?.id ?? null}
             postAuthorId={a.authorId}
           />
      }
    >
      <h1 className="text-2xl md:text-3xl font-bold text-slate-950 dark:text-slate-100 mb-2">
        {article.title}
      </h1>
      <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400 line-clamp-3">
        {article.excerpt}
      </p>

      <div className="mb-6 flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
        <span>
          {new Date(article.createdAt).toLocaleDateString("en-US", {
            dateStyle: "medium",
          })}
        </span>
      </div>

      <div className="prose prose-slate dark:prose-invert prose-lg max-w-none mb-10 prose-headings:text-slate-950 dark:prose-headings:text-slate-100 prose-a:text-blue-700 dark:prose-a:text-blue-400 hover:prose-a:text-blue-600 hover:dark:prose-a:text-blue-300">
        <RichContent content={article.content} />
      </div>
    </DetailPageCardShell>
  );
}
