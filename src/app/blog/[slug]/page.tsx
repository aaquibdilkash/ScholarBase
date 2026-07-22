import { notFound } from "next/navigation";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import { VoteButton } from "@/components/interactions/VoteButton";
import { CommentSection } from "@/components/interactions/CommentSection";
import { RichContent } from "@/components/content/RichContent";
import { getCurrentUser } from "@/lib/auth";
import { deleteArticle, getArticle } from "@/app/actions/blog";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";

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

  const upvotes =
    a.votes?.filter((v: any) => v.voteType === "UPVOTE").length ?? 0;
  const downvotes =
    a.votes?.filter((v: any) => v.voteType === "DOWNVOTE").length ?? 0;
  const userVote =
    (a.votes?.find((v: any) => v.userId === user?.id)?.voteType as
      | "UPVOTE"
      | "DOWNVOTE"
      | null) ?? null;

  async function handleDelete() {
    "use server";
    await deleteArticle(a.id, a.slug);
  }

  return (
    <DetailPageCardShell
      backHref="/blog"
      backLabel="Back to Blogs"
      authorHref={`/scholar/${a.author.id}`}
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
      isFollowing={(a.author as any)?.followers?.length ? true : false}
      createdDate={a.createdAt}
      editedDate={a.updatedAt > a.createdAt ? a.updatedAt : undefined}
      footerVoteButton={
        <VoteButton
          targetId={a.id}
          type="article"
          initialUpvotes={upvotes}
          initialDownvotes={downvotes}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/blog/${a.slug}#comments`}
      footerCommentsCount={a._count.comments}
      discussion={
        <div
          className="mt-8 sb-surface-strong p-8 md:p-12 rounded-xl"
          id="comments"
        >
          <h2 className="text-2xl font-bold text-slate-950 mb-6">Discussion</h2>
          <CommentSection
            comments={a.comments}
            targetId={a.id}
            type="article"
            currentUserId={user?.id ?? null}
            postAuthorId={a.authorId}
          />
        </div>
      }
    >
      <h1 className="text-2xl md:text-3xl font-bold text-slate-950 mb-2">
        {article.title}
      </h1>
      <p className="text-sm leading-relaxed text-slate-600 line-clamp-3">
        {article.excerpt}
      </p>

      <div className="mb-6 flex items-center gap-2 text-sm font-medium text-slate-500">
        <span>
          {new Date(article.createdAt).toLocaleDateString("en-US", {
            dateStyle: "medium",
          })}
        </span>
      </div>

      <div className="prose prose-slate prose-lg max-w-none mb-10 prose-headings:text-slate-950 prose-a:text-blue-700 hover:prose-a:text-blue-600">
        <RichContent content={article.content} />
      </div>
    </DetailPageCardShell>
  );
}
