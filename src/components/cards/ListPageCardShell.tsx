import { MessageCircle } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { FollowButton } from "@/components/interactions/FollowButton"; // client component
import { ShareButton } from "@/components/interactions/ShareButton";
import { formatTimeAgo } from "../../utils/time-ago";
import { TruncatedCardBody } from "./TruncatedCardBody";

// local tiny utility to avoid adding new deps
const clsx = (...inputs: Array<string | false | null | undefined>) =>
  inputs.filter(Boolean).join(" ");

export type ListPageCardShellProps = {
  // Common header (author)
  authorHref: string;
  authorName: string;
  authorHandle?: string;
  authorAvatarUrl?: string | null;

  // Common header management (3 dots)
  managementControls?: ReactNode;

  children: ReactNode; // middle body

  // Follow in header (when not owner)
  authorId?: string;
  isFollowing?: boolean;
  // Current logged-in user id, used to hide the follow button for own content
  currentUserId?: string;

  // Common footer (vote + comments)
  footerVoteButton?: ReactNode;
  footerCommentsHref?: string;
  footerCommentsCount?: number;
  footer?: ReactNode;

  className?: string;
  bodyClassName?: string;

  // link to the detail page
  detailPageHref: string;
  bodyBottomContent?: ReactNode;

  editedDate?: Date | string;
  createdDate: Date | string;
  createdLabel?: string;
  editedLabel?: string;

  // When true, children will NOT be wrapped in a <Link> (use case: children contain <a> tags)
  noBodyLink?: boolean;
};

export default function ListPageCardShell({
  createdLabel = "Created",
  editedLabel = "Edited",
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
  footer,
  className,
  bodyClassName,
  detailPageHref,
  bodyBottomContent,
  editedDate,
  createdDate,
  noBodyLink = false,
}: ListPageCardShellProps) {
  const showManagementControls = Boolean(managementControls);

  return (
    <div className={clsx("sb-card p-5 sm:p-6 md:p-8", className)}>
      {/* Common header */}
      <div className="mb-6 flex items-center justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <Link href={authorHref} className="shrink-0">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border bg-slate-100 transition hover:ring-2 hover:ring-blue-100 dark:border-slate-700 dark:bg-slate-800">
              {authorAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={authorAvatarUrl}
                  alt={authorName}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="font-semibold text-slate-400 text-lg">
                  {authorName?.charAt(0).toUpperCase() || "?"}
                </span>
              )}
            </div>
          </Link>

          <div>
            <Link
              href={authorHref}
              className="font-semibold text-slate-950 transition hover:text-blue-700 hover:underline dark:text-slate-50 dark:hover:text-blue-300"
            >
              {authorName || "Scholar"}
            </Link>
            {authorHandle ? (
              <div className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                @{authorHandle}
              </div>
            ) : null}
          </div>
        </div>

        {/* 3 dots dropdown (edit/delete) OR Follow (non-owner) */}
        <div className="flex items-center">
          {showManagementControls ? (
            managementControls
          ) : authorId ? (
            <FollowButton
              targetId={authorId}
              isFollowing={!!isFollowing}
              currentUserId={currentUserId}
            />
          ) : null}
        </div>
      </div>

      {/* Clickable middle body */}
      <TruncatedCardBody
        detailPageHref={detailPageHref}
        className={clsx("block group", bodyClassName)}
        noBodyLink={noBodyLink}
      >
        {children}
      </TruncatedCardBody>

      {bodyBottomContent}

      <div className="mt-2 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
        <span className="font-semibold text-slate-400 dark:text-slate-500">
          {" "}
          {createdLabel} {formatTimeAgo(createdDate)}
        </span>
        {editedDate && (
          <span className="font-semibold text-slate-400 dark:text-slate-500">
            {editedLabel} {formatTimeAgo(editedDate)}
          </span>
        )}
      </div>

      {/* Common footer */}
      <div className="mt-2 flex items-center gap-4 border-t border-slate-200 pt-2 dark:border-slate-800 sm:gap-6">
        {footer ? (
          footer
        ) : (
          <>
            <div className="flex items-center gap-4 sm:gap-6">
              {footerVoteButton}
            </div>

            {footerCommentsHref && (
              <Link
                href={footerCommentsHref}
                className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 transition-colors hover:text-blue-700 dark:text-slate-400 sm:gap-2"
              >
                <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                {(footerCommentsCount || 0).toString()}{" "}
                <span className="hidden md:inline">
                  {footerCommentsCount === 1 ? "Comment" : "Comments"}
                </span>
              </Link>
            )}

            <ShareButton href={detailPageHref} label="Share" />
          </>
        )}
      </div>
    </div>
  );
}
