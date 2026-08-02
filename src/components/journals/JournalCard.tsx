"use client";

import { Journal, User } from "@prisma/client";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import Link from "next/link";
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
      authorHref={`/scholars/${journal.author.id}`}
      authorName={journal.author.name || "Scholar"}
      authorId={journal.author.id}
      isFollowing={isFollowing}
      currentUserId={currentUserId}
      authorHandle={journal.author.handle || undefined}
      authorAvatarUrl={journal.author.avatarUrl || undefined}
      detailPageHref={`/journals/${journal.id}`}
      noBodyLink={true}
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
      bodyBottomContent={
        <>
          {journal.issn && (
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                ISSN
              </span>
              <span className="font-mono tracking-[0.18em] text-slate-700 dark:text-slate-200">
                {journal.issn}
              </span>
            </div>
          )}

          {journal.website && (
            <div className="mt-4 flex gap-3">
              <a
                href={journal.website}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="sb-button-primary flex-1 px-4 py-2 text-center text-xs"
              >
                View Website
              </a>
            </div>
          )}
        </>
      }
    >
      <Link href={`/journals/${journal.id}`} className="block group">
        <h2 className="mb-2 text-lg font-semibold leading-tight text-slate-950 group-hover:text-blue-700 transition-colors">
          {journal.title}
        </h2>

        <RichContent
          content={journal.about}
          className="text-sm leading-relaxed text-slate-600 line-clamp-3"
        />

        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
          {journal.publisher && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {journal.publisher}
            </span>
          )}
          {journal.impactFactor && (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              IF: {journal.impactFactor}
            </span>
          )}
          {journal.scopus && (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              Scopus: {journal.scopus}
            </span>
          )}
          {journal.abdcCategory && (
            <span className="rounded-full bg-purple-50 px-2.5 py-1 font-medium text-purple-700 dark:bg-purple-500/10 dark:text-purple-300">
              ABDC: {journal.abdcCategory}
            </span>
          )}
        </div>
      </Link>
    </ListPageCardShell>
  );
}
