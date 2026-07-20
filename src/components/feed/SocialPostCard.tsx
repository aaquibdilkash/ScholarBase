"use client";

import { SocialPost, User, SocialLike } from "@prisma/client";
import { LikeButton } from "@/components/interactions/LikeButton";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { deleteSocialPost } from "@/app/actions/feed";

type PostWithDetails = SocialPost & {
  author: User & {
    followers?: { followerId: string }[];
  };
  likes: SocialLike[];
  _count: {
    comments: number;
    likes: number;
  };
};

export function SocialPostCard({
  post,
  isLiked,
  currentUserId,
}: {
  post: PostWithDetails;
  isLiked: boolean;
  currentUserId?: string;
}) {
  const isOwner = currentUserId === post.authorId;
  const isFollowing = (post.author.followers?.length ?? 0) > 0;

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
      footerLikeButton={
        <LikeButton
          targetId={post.id}
          type="post"
          initialLikes={post._count.likes}
          initialIsLiked={isLiked}
        />
      }
      footerCommentsHref={`/feed/${post.id}`}
      footerCommentsCount={post._count.comments}
    >
      <p className="mb-4 whitespace-pre-wrap leading-relaxed text-slate-800 transition-colors group-hover:text-slate-600">
        {post.content}
      </p>
    </ListPageCardShell>
  );
}
