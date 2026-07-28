"use client";

import { HelpPost, User } from "@prisma/client";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import { VoteButton } from "@/components/interactions/VoteButton";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { deleteHelpPost } from "@/app/actions/help";
import { RichContent } from "@/components/content/RichContent";

type HelpPostWithAuthor = HelpPost & {
  author: User & {
    followers?: { followerId: string }[];
  };
  votes: any[];
  _count: { votes: number; comments: number };
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
  const userVote: "UPVOTE" | "DOWNVOTE" | null =
    helpPost.votes?.find((v: any) => v.userId === currentUserId)?.voteType ??
    null;
  const upvoteCount =
    helpPost.votes?.filter((v: any) => v.voteType === "UPVOTE").length ?? 0;
  const downvoteCount =
    helpPost.votes?.filter((v: any) => v.voteType === "DOWNVOTE").length ?? 0;

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
      footerVoteButton={
        <VoteButton
          targetId={helpPost.id}
          type="help"
          initialUpvotes={upvoteCount}
          initialDownvotes={downvoteCount}
          initialUserVote={userVote}
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

      <RichContent
        content={helpPost.message}
        className="text-sm leading-relaxed text-slate-600 line-clamp-4"
      />
    </ListPageCardShell>
  );
}
