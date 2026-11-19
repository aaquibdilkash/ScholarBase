"use client";

import { useQueryClient } from "@tanstack/react-query";
import { removeFromList } from "@/utils/cacheMutation";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import { ReportMenu } from "@/components/cards/ReportMenu";
import { VoteButton } from "@/components/interactions/VoteButton";
import { BookmarkButton } from "@/components/interactions/BookmarkButton";
import { deleteResult } from "@/app/actions/results";
import { useToast } from "@/components/ui/Toast";
import { actionErrorMessage, friendlyActionError } from "@/lib/utils";
import { RichContent } from "@/components/content/RichContent";
import Link from "next/link";
import { SafeExternalLink } from "@/components/ui/SafeExternalLink";
import type { ResultWithAuthor } from "@/types/cards";
import { resultBadgeLabel, resultLinkActions } from "@/lib/results/entry-types";
import { resultEditHref, resultHref } from "@/lib/results/routes";

export function ResultCard({
  result,
  currentUserId,
}: {
  result: ResultWithAuthor;
  currentUserId?: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isOwner = currentUserId === result.authorId;
  const isFollowing = (result.author?.followers?.length ?? 0) > 0;
  const userVote: "UPVOTE" | "DOWNVOTE" | null =
    (result.votes || [])[0]?.voteType ?? null;
  // Share payload: mirror exams-and-results/[id]/page.tsx generateMetadata().
  const shareTitle = result.title;
  const shareText =
    (result.description || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() ||
    result.title;
  const links = resultLinkActions(result.kind, {
    notificationLink: result.notificationLink,
    checkOrApplyLink: result.checkOrApplyLink,
  });

  return (
    <ListPageCardShell
      authorHref={`/scholars/${result.author?.id}`}
      authorName={result.author?.name || "Scholar"}
      authorId={result.authorId}
      isFollowing={isFollowing}
      currentUserId={currentUserId}
      authorHandle={result.author?.handle || undefined}
      authorAvatarUrl={result.author?.avatarUrl || undefined} authorVerified={!!(result.author?.institutionVerifiedAt)}
      isFrozen={result.isFrozen ?? false}
      frozenEntityId={result.id}
      frozenModule="RESULT"
      frozenEntityType="POST"
      frozenOwnerId={result.author?.id ?? null}
      frozenHasActiveAppeal={result.hasActiveAppeal ?? false}
      detailPageHref={resultHref(result.id)}
      shareTitle={shareTitle}
      shareText={shareText}
      managementControls={
        isOwner && (
          <OwnerActionsDropdown
            editHref={resultEditHref(result.id)}
            isOwner={true}
            onDelete={async () => {
              try {
                const response = await deleteResult(result.id);
                if (!response?.success || !response.data) {
                  toast(actionErrorMessage(response, "Failed to delete result."), "error");
                  return { refresh: false };
                }
                removeFromList<ResultWithAuthor>(queryClient, ["results"], response.data.deletedId);
                toast("Result deleted successfully.", "success");
                return { refresh: false };
              } catch (error) {
                const message = friendlyActionError(error, "Unknown error");
                toast(message, "error");
                return { refresh: false };
              }
            }}
            editLabel="Edit Result"
            deleteLabel="Delete"
          />
        )
      }
      createdDate={result.createdAt}
      editedDate={
        result.editedAt && result.editedAt > result.createdAt ? result.editedAt : undefined
      }
      footerVoteButton={
        <VoteButton
          frozen={result.isFrozen === true}
          targetId={result.id}
          module="RESULT"
          initialTotalVotes={result.totalVotes}
          initialUserVote={userVote}
          isOwnContent={isOwner}
        />
      }
      footerBookmarkButton={
        <BookmarkButton
          frozen={result.isFrozen === true}
          targetId={result.id}
          module="RESULT"
          initialTotalBookmarks={result.totalBookmarks ?? 0}
          initialIsBookmarked={Array.isArray(result.bookmarks) && result.bookmarks.length > 0}
        />
      }
      footerCommentsHref={resultHref(result.id)}
      footerCommentsCount={result.totalComments}
      footerReportMenu={
        <ReportMenu
          entityId={result.id}
          entityType="POST"
          module="RESULT"
          ownerId={result.author?.id ?? result.authorId ?? null}
          currentUserId={currentUserId ?? null}
          isFrozen={result.isFrozen ?? false}
          hasActiveAppeal={result.hasActiveAppeal ?? false}
        />
      }
      noBodyLink={true}
      bodyBottomContent={
        (links.primary || links.secondary) && (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            {links.primary && (
              <SafeExternalLink
                url={links.primary.href}
                onClick={(e) => e.stopPropagation()}
                className="sb-button-primary flex-1 px-4 py-2 text-center text-xs"
              >
                {links.primary.label}
              </SafeExternalLink>
            )}
            {links.secondary && (
              <SafeExternalLink
                url={links.secondary.href}
                onClick={(e) => e.stopPropagation()}
                className="sb-button-soft flex-1 px-4 py-2 text-center text-xs"
              >
                {links.secondary.label}
              </SafeExternalLink>
            )}
          </div>
        )
      }
    >
      <Link href={resultHref(result.id)} prefetch={false} className="block group">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
            {resultBadgeLabel(result.kind, result.type)}
          </span>
          {result.category && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {result.category}
            </span>
          )}
        </div>

        <h2 className="mb-2 break-words [overflow-wrap:anywhere] text-lg font-semibold leading-tight text-slate-950 transition-colors group-hover:text-blue-700 dark:text-slate-50 dark:group-hover:text-blue-300">
          {result.title}
        </h2>

        <RichContent
          content={result.description}
          className="text-sm leading-relaxed text-slate-600 dark:text-slate-300"
        />

        {(result.conductingBody || result.session) && (
          <div className="mt-3 flex flex-wrap gap-3 text-xs font-medium text-slate-500">
            {result.conductingBody && (
              <span className="break-words [overflow-wrap:anywhere]">Conducting Body: {result.conductingBody}</span>
            )}
            {result.session && <span className="break-words">Session: {result.session}</span>}
          </div>
        )}
      </Link>
    </ListPageCardShell>
  );
}
