import Link from "next/link";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { cloneElement, isValidElement, type ReactNode } from "react";
import { FollowButton } from "@/components/interactions/FollowButton";
import { ShareButton } from "@/components/interactions/ShareButton";
import CommentCountDisplay from "@/components/interactions/CommentCountDisplay";
import { formatTimeAgo } from "../../utils/time-ago";

// local tiny utility to avoid adding new deps
const clsx = (...inputs: Array<string | false | null | undefined>) =>
  inputs.filter(Boolean).join(" ");

export type DetailPageCardShellProps = {
  backHref: string;
  backLabel: string;

  // Common header (author)
  authorHref?: string;
  authorName: string;
  authorHandle?: string;
  authorAvatarUrl?: string | null;
  authorVerified?: boolean;

  // Common header management (3 dots)
  managementControls?: ReactNode;

  // Follow in header (when not owner)
  // Optional because some existing detail pages (e.g. supervisor page) haven't been updated yet.
  authorId?: string;
  isFollowing?: boolean;
  // Current logged-in user id, used to hide the follow button for own content
  currentUserId?: string;

  children: ReactNode; // middle body

  // Common footer (votes + comments)
  footerVoteButton?: ReactNode;
  footerCommentsHref: string;
  footerCommentsCount: number;

  // Dedicated report menu in the footer (far-right edge)
  footerReportMenu?: ReactNode;

  // Moderation: frozen posts render a banner and hide vote + report
  // interactions (read-only), matching frozen comments in CommentThread.
  isFrozen?: boolean;

  discussion?: ReactNode;

  className?: string;
  bodyClassName?: string;
  bodyBottomContent?: ReactNode;

  editedDate?: Date | string;
  createdDate: Date | string;
  createdLabel?: string;
  editedLabel?: string;
};

export default function DetailPageCardShell({
  createdLabel = "Created",
  editedLabel = "Edited",
  backHref,
  backLabel,
  authorHref,
  authorName,
  authorHandle,
  authorAvatarUrl,
  authorVerified,
  authorId,
  isFollowing,
  currentUserId,
  managementControls,
  children,
  footerVoteButton,
  footerCommentsHref,
  footerCommentsCount,
  footerReportMenu,
  isFrozen,
  discussion,
  className,
  bodyClassName,
  bodyBottomContent,
  editedDate,
  createdDate,
}: DetailPageCardShellProps) {
  // In current usage, `managementControls` is only passed for owners.
  const isOwner = Boolean(managementControls);

  return (
    <main
      className={clsx(
        "mx-auto w-full max-w-3xl px-0 py-3 sm:px-6 sm:py-8 md:px-8 md:py-10",
        className,
      )}
    >
      <Link prefetch={false}
        href={backHref}
        className="inline-flex items-center text-sm font-medium text-slate-500 transition-colors hover:text-blue-700 mb-8"
      >
        ← {backLabel}
      </Link>

      <div className={clsx(bodyClassName ?? "sb-card p-6 sm:p-6 md:p-8")}>
        {/* Moderation banner — frozen content is visible but read-only */}
        {isFrozen && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400">
            <span aria-hidden>❄</span>
            This post has been frozen by moderators. Voting, reporting and
            commenting are disabled.
          </div>
        )}
        {/* Common header */}
        <div className="mb-6 flex items-center justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            {authorHref ? (
              <Link prefetch={false} href={authorHref} className="shrink-0">
                <div className="w-12 h-12 rounded-full bg-slate-100 border flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-blue-100 transition">
                  {authorAvatarUrl ? (
                    <UserAvatar src={authorAvatarUrl} name={authorName} />
                  ) : (
                    <span className="font-semibold text-slate-400 text-lg">
                      {authorName?.charAt(0).toUpperCase() || "?"}
                    </span>
                  )}
                </div>
              </Link>
            ) : (
              <div className="w-12 h-12 shrink-0 rounded-full bg-slate-100 border flex items-center justify-center overflow-hidden dark:border-slate-700 dark:bg-slate-800">
                <span className="font-semibold text-slate-400 text-lg">?</span>
              </div>
            )}

            <div>
              {authorHref ? (
                <Link prefetch={false}
                  href={authorHref}
                  className="font-semibold text-slate-950 hover:text-blue-700 hover:underline transition"
                >
                  <span className="inline-flex max-w-full items-center gap-1">
                    <span className="min-w-0 truncate">{authorName || "Scholar"}</span>
                    {authorVerified ? <VerifiedBadge /> : null}
                  </span>
                </Link>
              ) : (
                <span className="font-semibold italic text-slate-500 dark:text-slate-400">
                  <span className="inline-flex max-w-full items-center gap-1">
                    <span className="min-w-0 truncate">{authorName || "Scholar"}</span>
                    {authorVerified ? <VerifiedBadge /> : null}
                  </span>
                </span>
              )}
              {authorHandle ? (
                <div className="mt-0.5 text-xs font-medium text-slate-500">
                  @{authorHandle}
                </div>
              ) : null}
            </div>
          </div>

          {/* Right side: owner actions OR follow */}
          <div className="flex items-center">
            {isOwner ? (
              managementControls
            ) : authorId ? (
              <FollowButton
                targetId={authorId}
                isFollowing={Boolean(isFollowing)}
                currentUserId={currentUserId}
              />
            ) : null}
          </div>
        </div>

        {/* Body — clipping is handled by child components (e.g. Carousel
            uses its own overflow-x-hidden) so positioned overlays like
            carousel arrows are never cut off. */}
        <div>
          {children}

          {bodyBottomContent}
        </div>

        <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
          <span
            suppressHydrationWarning
            className="font-semibold text-slate-400"
          >
            {createdLabel} {formatTimeAgo(createdDate)}
          </span>
          {editedDate && (
            <span
              suppressHydrationWarning
              className="font-semibold text-slate-400"
            >
              {editedLabel} {formatTimeAgo(editedDate)}
            </span>
          )}
        </div>

        {/* Common footer — votes/comments left, Share + Report far right */}
        <div className="mt-2 flex items-center justify-between gap-4 border-t border-slate-200 pt-2 dark:border-slate-800 sm:gap-6">
          <div className="flex items-center gap-4 sm:gap-6">
            {/* Frozen: keep the vote button visible but disabled (VoteButton
                supports the `frozen` prop, injected here for detail pages). */}
            {isFrozen && footerVoteButton && isValidElement(footerVoteButton)
              ? cloneElement(
                  footerVoteButton as React.ReactElement<{ frozen?: boolean }>,
                  { frozen: true },
                )
              : footerVoteButton}

            <CommentCountDisplay
              href={footerCommentsHref}
              initialCount={footerCommentsCount}
            />
          </div>

          <div className="flex items-center gap-2">
            <ShareButton label="Share" />
            {/* Report menu is always visible — on frozen posts it also hosts
                the owner's "Appeal Removal" option. */}
            {footerReportMenu}
          </div>
        </div>
      </div>

      {discussion}
    </main>
  );
}
