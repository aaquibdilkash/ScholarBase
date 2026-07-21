import { getHelpPost } from "@/app/actions/help";
import { CommentSection } from "@/components/interactions/CommentSection";
import { requireCurrentUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import { LikeButton } from "@/components/interactions/LikeButton";
import { deleteHelpPost } from "@/app/actions/help";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";

export default async function HelpPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireCurrentUser();
  const post = await getHelpPost(id, user.id);

  if (!post) {
    notFound();
  }

  // Define the delete action outside the JSX
  async function handleDelete() {
    "use server";
    await deleteHelpPost(post!.id);
  }

  return (
    <DetailPageCardShell
      backHref="/help"
      backLabel="Back to Help & Support"
      authorHref={`/scholar/${post.author.id}`}
      authorName={post.author.name || "Scholar"}
      authorHandle={post.author.handle || undefined}
      authorAvatarUrl={post.author.avatarUrl || undefined}
      authorId={post.author.id}
      isFollowing={!!post.author.followers?.length}
      createdDate={post.createdAt}
      editedDate={post.updatedAt > post.createdAt ? post.updatedAt : undefined}
      managementControls={
        user?.id === post.author.id ? (
          <OwnerActionsDropdown
            editHref={`/help/${post.id}/edit`}
            onDelete={handleDelete}
            isOwner={true}
            editLabel="Edit Post"
            deleteLabel="Delete"
          />
        ) : null
      }
      footerLikeButton={
        <LikeButton
          targetId={post.id}
          type="help"
          initialLikes={post._count.likes}
          initialIsLiked={!!post.likes?.length}
        />
      }
      footerCommentsHref={`/help/${post.id}#comments`}
      footerCommentsCount={post._count.comments}
      discussion={
        <div
          className="mt-8 sb-surface-strong p-8 md:p-12 rounded-xl"
          id="comments"
        >
          <h2 className="text-2xl font-bold text-slate-950 mb-6">Discussion</h2>
          <CommentSection
            comments={post.comments}
            targetId={post.id}
            type="help"
            currentUserId={user.id}
            postAuthorId={post.author.id}
          />
        </div>
      }
    >
      <h1 className="text-3xl font-bold mb-2">{post.title}</h1>

      <p className="text-lg font-semibold text-blue-700 mb-6">
        {post.category}
      </p>

      <p className="text-slate-700 leading-loose whitespace-pre-wrap mb-8">
        {post.message}
      </p>
    </DetailPageCardShell>
  );
}
