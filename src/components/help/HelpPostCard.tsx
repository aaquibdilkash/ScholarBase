"use client";

import { HelpPost, User } from "@prisma/client";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import { LikeButton } from "@/components/interactions/LikeButton";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { deleteHelpPost } from "@/app/actions/help";

type HelpPostWithAuthor = HelpPost & {
  author: User & {
    followers?: { followerId: string }[];
  };
  isLiked: boolean;
  _count: { likes: number; comments: number };
};

export function HelpPostCard({
  helpPost,
  currentUserId,
}: {
  helpPost: HelpPostWithAuthor;
  currentUserId?: string;
}) {
  const isOwner = currentUserId === helpPost.authorId;
  const isFollowing = (helpPost.author.followers?.length ?? 0) > 0;

  return (
    <ListPageCardShell
      authorHref={`/scholar/${helpPost.author.id}`}
      authorName={helpPost.author.name || "Scholar"}
      authorId={helpPost.author.id}
      isFollowing={isFollowing}
      authorHandle={helpPost.author.handle || undefined}
      authorAvatarUrl={helpPost.author.avatarUrl || undefined}
      detailPageHref={`/help/${helpPost.id}`}
      managementControls={
        isOwner && (
          <OwnerActionsDropdown
            editHref={`/help/${helpPost.id}/edit`}
            isOwner={true}
            editLabel="Edit Help Post"
            deleteLabel="Delete"
            onDelete={() => {
              deleteHelpPost(helpPost.id);
            }}
          />
        )
      }
      createdDate={helpPost.createdAt}
      editedDate={
        helpPost.updatedAt > helpPost.createdAt ? helpPost.updatedAt : undefined
      }
      footerLikeButton={
        <LikeButton
          targetId={helpPost.id}
          type="help"
          initialLikes={helpPost._count.likes}
          initialIsLiked={helpPost.isLiked}
        />
      }
      footerCommentsHref={`/help/${helpPost.id}`}
      footerCommentsCount={helpPost._count.comments}
    >
      <div className="mb-4">
        <h2 className="mb-1 text-lg font-semibold leading-tight text-slate-950 group-hover:text-blue-700 transition-colors">
          {helpPost.title}
        </h2>
        <p className="text-sm font-semibold text-blue-700">
          {helpPost.category}
        </p>
      </div>

      <p className="text-sm leading-relaxed text-slate-600 line-clamp-4">
        {helpPost.message}
      </p>
    </ListPageCardShell>
  );
}
