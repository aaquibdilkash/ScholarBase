import Link from "next/link";
import type { ReactNode } from "react";
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
  authorId,
  isFollowing,
  currentUserId,
  managementControls,
  children,
  footerVoteButton,
  footerCommentsHref,
  footerCommentsCount,
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
        "mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8 md:px-8 md:py-10",
        className,
      )}
    >
      <Link
        href={backHref}
        className="inline-flex items-center text-sm font-medium text-slate-500 transition-colors hover:text-blue-700 mb-8"
      >
        ← {backLabel}
      </Link>

      <div
        className={clsx(
          bodyClassName ?? "sb-card p-4 sm:p-6 md:p-8",
          "overflow-hidden",
        )}
      >
        {/* Common header */}
        <div className="flex items-center justify-between gap-4 mb-6 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            {authorHref ? (
              <Link href={authorHref} className="shrink-0">
                <div className="w-12 h-12 rounded-full bg-slate-100 border flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-blue-100 transition">
                  {authorAvatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={authorAvatarUrl}
                      alt={authorName}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
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
                <Link
                  href={authorHref}
                  className="font-semibold text-slate-950 hover:text-blue-700 hover:underline transition"
                >
                  {authorName || "Scholar"}
                </Link>
              ) : (
                <span className="font-semibold italic text-slate-500 dark:text-slate-400">
                  {authorName || "Scholar"}
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

        {children}

        {bodyBottomContent}

        <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
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

        {/* Common footer */}
        {/* Order required: votes, comments, share */}
        <div className="border-t border-slate-200 pt-2 mt-2 flex items-center gap-6">
          <div className="flex items-center gap-6">
            {footerVoteButton}

            <CommentCountDisplay
              href={footerCommentsHref}
              initialCount={footerCommentsCount}
            />
          </div>

          <ShareButton label="Share" />
        </div>
      </div>

      {discussion}
    </main>
  );
}
