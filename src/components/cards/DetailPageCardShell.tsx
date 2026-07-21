import Link from "next/link";
import type { ReactNode } from "react";
import { FollowButton } from "@/components/interactions/FollowButton";
import { ShareButton } from "@/components/interactions/ShareButton";
import { formatTimeAgo } from "../../utils/time-ago";

// local tiny utility to avoid adding new deps
const clsx = (...inputs: Array<string | false | null | undefined>) =>
  inputs.filter(Boolean).join(" ");

export type DetailPageCardShellProps = {
  backHref: string;
  backLabel: string;

  // Common header (author)
  authorHref: string;
  authorName: string;
  authorHandle?: string;
  authorAvatarUrl?: string | null;

  // Common header management (3 dots)
  managementControls?: ReactNode;

  // Follow in header (when not owner)
  // Optional because some existing detail pages (e.g. supervisor page) haven't been updated yet.
  authorId?: string;
  isFollowing?: boolean;

  children: ReactNode; // middle body

  // Common footer (like + comments)
  footerLikeButton?: ReactNode;
  footerCommentsHref: string;
  footerCommentsCount: number;

  discussion?: ReactNode;

  className?: string;
  bodyClassName?: string;

  editedDate?: Date | string;
  createdDate: Date | string;
};

export default function DetailPageCardShell({
  backHref,
  backLabel,
  authorHref,
  authorName,
  authorHandle,
  authorAvatarUrl,
  authorId,
  isFollowing,
  managementControls,
  children,
  footerLikeButton,
  footerCommentsHref,
  footerCommentsCount,
  discussion,
  className,
  bodyClassName,
  editedDate,
  createdDate,
}: DetailPageCardShellProps) {
  // In current usage, `managementControls` is only passed for owners.
  const isOwner = Boolean(managementControls);

  return (
    <main
      className={clsx(
        "mx-auto max-w-3xl py-12 px-4 sm:px-6 lg:px-8",
        className,
      )}
    >
      <Link
        href={backHref}
        className="inline-flex items-center text-sm font-medium text-slate-500 transition-colors hover:text-blue-700 mb-8"
      >
        ← {backLabel}
      </Link>

      <div className={bodyClassName ?? "sb-card p-6 md:p-8"}>
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

          {/* Right side: owner actions OR follow */}
          <div className="flex items-center">
            {isOwner ? (
              managementControls
            ) : (
              // These are optional for some legacy pages; guard with safe fallbacks.
              <FollowButton
                targetId={authorId ?? ""}
                isFollowing={Boolean(isFollowing)}
              />
            )}
          </div>
        </div>

        {children}

        <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
          <span className="font-semibold text-slate-400">Created {formatTimeAgo(createdDate)}</span>
          {editedDate && (
            <span className="font-semibold text-slate-400">
              Edited {formatTimeAgo(editedDate)}
            </span>
          )}
        </div>

        {/* Common footer */}
        {/* Order required: likes, comments, share */}
        <div className="border-t border-slate-200 pt-2 mt-2 flex items-center gap-6">
          <div className="flex items-center gap-6">
            {footerLikeButton}

            <Link
              href={footerCommentsHref}
              className="flex items-center gap-2 text-sm font-semibold text-black-500 hover:text-blue-700 transition-colors"
            >
              <svg
                className="w-5 h-5"
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
              {footerCommentsCount} Comments
            </Link>
          </div>

          <ShareButton href={authorHref} label="Share" />
        </div>
      </div>

      {discussion}
    </main>
  );
}
