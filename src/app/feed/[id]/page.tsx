import { notFound } from "next/navigation";
import Image from "next/image";
import DetailPageCardShell from "@/components/cards/DetailPageCardShell";
import { VoteButton } from "@/components/interactions/VoteButton";
import { CommentSection } from "@/components/interactions/CommentSection";
import type { CommentWithAuthorAndVotes } from "@/types/comments";
import { getCurrentUser } from "@/lib/auth";
import { deleteSocialPost, getPost } from "@/app/actions/feed";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";

import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const post = await getPost(id).catch(() => null);
  if (!post) return { title: "Scholar Post" };
  const text = post.content.replace(/\s+/g, " ").trim();
  return buildMetadata({
    title: text.slice(0, 58) || "Scholar Post",
    description: text,
    path: `/feed/${post.id}`,
    type: "article",
    author: post.author?.name || undefined,
    publishedTime: post.createdAt,
    modifiedTime: post.updatedAt,
    image: post.imageUrl || undefined,
    section: "Scholar Community",
  });
}

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
  const userVote =
    (p.votes?.find((v) => v.userId === user?.id)?.voteType as
      | "UPVOTE"
      | "DOWNVOTE"
      | null) ?? null;

  async function handleDelete() {
    "use server";
        await deleteSocialPost(p.id);
    return { redirect: "/feed" };
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
          module="SOCIAL_POST"
          initialTotalVotes={p.totalVotes}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/feed/${p.id}#comments`}
      footerCommentsCount={p.totalComments}
      discussion={
        <CommentSection
          comments={p.comments as CommentWithAuthorAndVotes[]}
          targetId={p.id}
          module="post"
          currentUserId={user?.id ?? null}
          postAuthorId={p.authorId}
        />
      }
    >
      <p className="text-base break-words sm:text-lg whitespace-pre-wrap leading-relaxed text-slate-800">
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
