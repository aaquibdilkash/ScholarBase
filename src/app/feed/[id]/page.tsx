import { notFound } from "next/navigation";
import Image from "next/image";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import { VoteButton } from "@/components/interactions/VoteButton";
import { CommentSection } from "@/components/interactions/CommentSection";
import { getCurrentUser } from "@/lib/auth";
import { deleteSocialPost, getPost } from "@/app/actions/feed";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";

export default async function SinglePostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();

  const post = await getPost(id, user?.id);

  if (!post) notFound();

  const p = post;
  const upvotes = p.votes?.filter((v) => v.voteType === "UPVOTE").length ?? 0;
  const downvotes =
    p.votes?.filter((v) => v.voteType === "DOWNVOTE").length ?? 0;
  const userVote =
    (p.votes?.find((v) => v.userId === user?.id)?.voteType as
      | "UPVOTE"
      | "DOWNVOTE"
      | null) ?? null;

  async function handleDelete() {
    "use server";
    await deleteSocialPost(p.id);
  }

  return (
    <DetailPageCardShell
      backHref="/feed"
      backLabel="Back to Feed"
      authorHref={`/scholars/${p.author.id}`}
      authorName={p.author.name || "Scholar"}
      authorHandle={p.author.handle || undefined}
      authorAvatarUrl={p.author.avatarUrl || undefined}
      managementControls={
        user?.id === p.authorId ? (
          <OwnerActionsDropdown
            editHref={`/feed/${p.id}/edit`}
            onDelete={handleDelete}
            isOwner={true}
            editLabel="Edit Post"
            deleteLabel="Delete"
          />
        ) : null
      }
      authorId={p.authorId}
      isFollowing={
        (p.author as { followers?: { followerId: string }[] })?.followers
          ?.length
          ? true
          : false
      }
      currentUserId={user?.id}
      createdDate={p.createdAt}
      editedDate={p.updatedAt > p.createdAt ? p.updatedAt : undefined}
      footerVoteButton={
        <VoteButton
          targetId={p.id}
          type="post"
          initialUpvotes={upvotes}
          initialDownvotes={downvotes}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/feed/${p.id}#comments`}
      footerCommentsCount={p._count.comments}
      discussion={
        <CommentSection
          comments={p.comments}
          targetId={p.id}
          type="post"
          currentUserId={user?.id ?? null}
          postAuthorId={p.authorId}
        />
      }
    >
      <p className="text-base sm:text-lg whitespace-pre-wrap leading-relaxed text-slate-800">
        {p.content}
      </p>

      {p.imageUrl && (
        <div className="mt-4 sm:mt-6">
          <Image
            src={p.imageUrl}
            alt=""
            width={800}
            height={416}
            unoptimized
            className="w-full h-48 sm:h-64 rounded-xl object-cover border border-slate-200 hover:opacity-90 transition"
          />
        </div>
      )}
    </DetailPageCardShell>
  );
}
