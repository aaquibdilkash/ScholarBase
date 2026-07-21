import { notFound } from "next/navigation";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import { LikeButton } from "@/components/interactions/LikeButton";
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

  // keep TS happy: after notFound() this is safe to treat as non-null
  const a = article;

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
      footerLikeButton={
        <LikeButton
          targetId={a.id}
          type="article"
          initialLikes={a._count.likes}
          initialIsLiked={!!a.likes?.length}
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

      {/* Footer actions (like/comments) are handled by DetailPageCardShell */}

      {/* <div className="hidden" aria-hidden>
        <CommentIcon className="h-5 w-5" />
      </div> */}
    </DetailPageCardShell>
  );
}
