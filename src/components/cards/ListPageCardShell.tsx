import Link from "next/link";
import type { ReactNode } from "react";
import { FollowButton } from "@/components/interactions/FollowButton"; // client component
import { ShareButton } from "@/components/interactions/ShareButton";
import { formatTimeAgo } from "../../utils/time-ago";

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

  // Common footer (vote + comments)
  footerVoteButton?: ReactNode;
  footerCommentsHref: string;
  footerCommentsCount: number;

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
  managementControls,
  children,
  footerVoteButton,
  footerCommentsHref,
  footerCommentsCount,
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
    <div className={clsx("sb-card p-6 md:p-8", className)}>
      {/* Common header */}
      <div className="flex items-center justify-between gap-4 mb-6 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
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

          <div>
            <Link
              href={authorHref}
              className="font-semibold text-slate-950 hover:text-blue-700 hover:underline transition"
            >
              {authorName || "Scholar"}
            </Link>
            {authorHandle ? (
              <div className="mt-0.5 text-xs font-medium text-slate-500">
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
            <FollowButton targetId={authorId} isFollowing={!!isFollowing} />
          ) : null}
        </div>
      </div>

      {/* Clickable middle body */}
      {noBodyLink ? (
        <div className={clsx("block group", bodyClassName)}>{children}</div>
      ) : (
        <Link
          href={detailPageHref}
          className={clsx("block group", bodyClassName)}
        >
          {children}
        </Link>
      )}

      {bodyBottomContent}

      <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
        <span className="font-semibold text-slate-400">
          {" "}
          {createdLabel} {formatTimeAgo(createdDate)}
        </span>
        {editedDate && (
          <span className="font-semibold text-slate-400">
            {editedLabel} {formatTimeAgo(editedDate)}
          </span>
        )}
      </div>

      {/* Common footer */}
      <div className="border-t border-slate-200 pt-2 mt-2 flex items-center gap-4 sm:gap-6">
        <div className="flex items-center gap-4 sm:gap-6">{footerVoteButton}</div>

        <Link
          href={footerCommentsHref}
          className="flex items-center gap-1.5 sm:gap-2 text-sm font-semibold text-black-500 hover:text-blue-700 transition-colors"
        >
          <svg
            className="w-4 h-4 sm:w-5 sm:h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          {footerCommentsCount}{" "}
          <span className="hidden md:inline">
            {footerCommentsCount === 1 ? "Comment" : "Comments"}
          </span>
        </Link>

        <ShareButton href={detailPageHref} label="Share" />
      </div>
    </div>
  );
}
