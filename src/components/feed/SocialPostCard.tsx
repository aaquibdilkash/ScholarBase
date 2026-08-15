"use client";

import Image from "next/image";
import { VoteButton } from "@/components/interactions/VoteButton";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { deleteSocialPost } from "@/app/actions/feed";
import type { SocialPostWithAuthor as PostWithDetails } from "@/types/cards";

export function SocialPostCard({
  post,
  currentUserId,
}: {
  post: PostWithDetails;
  currentUserId?: string;
}) {
  const isOwner = currentUserId === post.authorId;
  const isFollowing = (post.author.followers?.length ?? 0) > 0;
  const userVote: "UPVOTE" | "DOWNVOTE" | null =
    post.votes?.find((v) => v.userId === currentUserId)?.voteType ?? null;
  const upvoteCount =
    post.votes?.filter((v) => v.voteType === "UPVOTE").length ?? 0;
  const downvoteCount =
    post.votes?.filter((v) => v.voteType === "DOWNVOTE").length ?? 0;

  return (
    <ListPageCardShell
      authorId={post.authorId}
      isFollowing={isFollowing}
      currentUserId={currentUserId}
      authorHref={`/scholars/${post.authorId}`}
      authorName={post.author.name || "Scholar"}
      authorHandle={post.author.handle || undefined}
      authorAvatarUrl={post.author.avatarUrl || undefined}
      detailPageHref={`/feed/${post.id}`}
      managementControls={
        isOwner && (
          <OwnerActionsDropdown
            editHref={`/feed/${post.id}/edit`}
            isOwner={true}
            editLabel="Edit Post"
            deleteLabel="Delete"
            onDelete={async () => {
              await deleteSocialPost(post.id);
            }}
          />
        )
      }
      createdDate={post.createdAt}
      editedDate={post.updatedAt > post.createdAt ? post.updatedAt : undefined}
      footerVoteButton={
        <VoteButton
          targetId={post.id}
          type="post"
          initialUpvotes={upvoteCount}
          initialDownvotes={downvoteCount}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/feed/${post.id}`}
      footerCommentsCount={post._count.comments}
    >
      <div className={`flex gap-4 ${post.imageUrl ? "items-start" : ""}`}>
        <p
          className={`mb-4 whitespace-pre-wrap leading-relaxed text-slate-800 transition-colors group-hover:text-slate-600 ${
            post.imageUrl ? "w-1/2 min-w-0" : "w-full"
          }`}
        >
          {post.content}
        </p>
        {post.imageUrl && (
          <div className="mb-4 w-1/2 self-start overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:opacity-90 dark:bg-slate-900">
            <Image
              src={post.imageUrl}
              alt=""
              width={800}
              height={400}
              unoptimized
              className="block h-auto w-full object-contain"
            />
          </div>
        )}
      </div>
    </ListPageCardShell>
  );
}
