"use client";

import { SocialPost, User } from "@prisma/client";
import { VoteButton } from "@/components/interactions/VoteButton";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { deleteSocialPost } from "@/app/actions/feed";

type PostWithDetails = SocialPost & {
  author: User & {
    followers?: { followerId: string }[];
  };
  votes: any[];
  _count: {
    comments: number;
    votes: number;
  };
};

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
    post.votes?.find((v: any) => v.userId === currentUserId)?.voteType ?? null;
  const upvoteCount =
    post.votes?.filter((v: any) => v.voteType === "UPVOTE").length ?? 0;
  const downvoteCount =
    post.votes?.filter((v: any) => v.voteType === "DOWNVOTE").length ?? 0;

  return (
    <ListPageCardShell
      authorId={post.authorId}
      isFollowing={isFollowing}
      authorHref={`/scholar/${post.authorId}`}
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
      <p className="mb-4 whitespace-pre-wrap leading-relaxed text-slate-800 transition-colors group-hover:text-slate-600">
        {post.content}
      </p>

      {post.imageUrl && (
        <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 transition hover:opacity-90">
          <img
            src={post.imageUrl}
            alt=""
            className="h-48 w-full object-cover"
            loading="lazy"
          />
        </div>
      )}
    </ListPageCardShell>
  );
}
