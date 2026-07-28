"use client";

import { Journal, User } from "@prisma/client";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import { VoteButton } from "@/components/interactions/VoteButton";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import { RichContent } from "@/components/content/RichContent";

type JournalWithAuthor = Journal & {
  author: User & {
    followers?: { followerId: string }[];
  };
  votes: any[];
  _count: { votes: number; comments: number };
};

export function JournalCard({
  journal,
  currentUserId,
}: {
  journal: JournalWithAuthor;
  currentUserId?: string;
}) {
  const isOwner = currentUserId === journal.authorId;
  const isFollowing = (journal.author.followers?.length ?? 0) > 0;
  const userVote: "UPVOTE" | "DOWNVOTE" | null =
    journal.votes?.find((v: any) => v.userId === currentUserId)?.voteType ??
    null;
  const upvoteCount =
    journal.votes?.filter((v: any) => v.voteType === "UPVOTE").length ?? 0;
  const downvoteCount =
    journal.votes?.filter((v: any) => v.voteType === "DOWNVOTE").length ?? 0;

  return (
    <ListPageCardShell
      authorHref={`/scholar/${journal.author.id}`}
      authorName={journal.author.name || "Scholar"}
      authorId={journal.author.id}
      isFollowing={isFollowing}
      authorHandle={journal.author.handle || undefined}
      authorAvatarUrl={journal.author.avatarUrl || undefined}
      detailPageHref={`/journals/${journal.id}`}
      managementControls={
        isOwner && (
          <OwnerActionsDropdown
            editHref={`/journals/${journal.id}/edit`}
            isOwner={true}
            editLabel="Edit Journal"
            deleteLabel="Delete"
            onDelete={() => {
              // TODO: wire delete action if available
            }}
          />
        )
      }
      createdDate={journal.createdAt}
      editedDate={
        journal.updatedAt > journal.createdAt ? journal.updatedAt : undefined
      }
      footerVoteButton={
        <VoteButton
          targetId={journal.id}
          type="journal"
          initialUpvotes={upvoteCount}
          initialDownvotes={downvoteCount}
          initialUserVote={userVote}
        />
      }
      footerCommentsHref={`/journals/${journal.id}`}
      footerCommentsCount={journal._count.comments}
    >
      <h2 className="mb-2 text-lg font-semibold leading-tight text-slate-950 group-hover:text-blue-700 transition-colors">
        {journal.title}
      </h2>

      <RichContent
        content={journal.about}
        className="text-sm leading-relaxed text-slate-600 line-clamp-3"
      />

      {journal.issn && (
        <div className="mt-6 rounded-xl border border-blue-100/50 bg-blue-50/50 p-2 text-xs font-semibold text-blue-600">
          ISSN: {journal.issn}
        </div>
      )}

      {journal.website && (
        <div className="flex gap-3 mt-4">
          <a
            href={journal.website}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex-1 rounded-lg bg-slate-950 py-2 text-center text-xs font-semibold text-white transition-colors duration-200 hover:bg-slate-800"
          >
            View Website
          </a>
        </div>
      )}
    </ListPageCardShell>
  );
}
