import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { cloneElement, isValidElement, type ReactNode } from "react";
import { FollowButton } from "@/components/interactions/FollowButton";
import { ShareButton } from "@/components/interactions/ShareButton";
import CommentCountDisplay from "@/components/interactions/CommentCountDisplay";
import { FrozenContentBanner } from "@/components/moderation/FrozenContentBanner";
import { formatTimeAgo } from "../../utils/time-ago";
import type { ReportEntityType, ReportModule } from "@/types/reports";

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
  footerBookmarkButton?: ReactNode;
  footerCommentsHref: string;
  footerCommentsCount: number;

  // Dedicated report menu in the footer (far-right edge)
  footerReportMenu?: ReactNode;

  // Moderation: frozen posts render a banner and hide vote + report
  // interactions (read-only), matching frozen comments in CommentThread.
  isFrozen?: boolean;

  // Frozen banner controls — all are optional so existing call sites keep
  // working unchanged. When omitted and `isFrozen` is true, the banner renders
  // as the static notice only (no View reason / View reports affordances).
  frozenEntityId?: string;
  frozenModule?: ReportModule;
  frozenEntityType?: ReportEntityType;
  frozenOwnerId?: string | null;
  frozenHasActiveAppeal?: boolean;
  isAdmin?: boolean;

  discussion?: ReactNode;

  className?: string;
  bodyClassName?: string;
  bodyBottomContent?: ReactNode;

  editedDate?: Date | string;
  createdDate: Date | string;
  createdLabel?: string;
  editedLabel?: string;

  // Share payload for the footer share button. Optional: when omitted the
  // ShareButton reads the page's og:tags, which detail pages already emit
  // correctly via generateMetadata().
  shareTitle?: string;
  shareText?: string;
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
  footerBookmarkButton,
  footerCommentsHref,
  footerCommentsCount,
  footerReportMenu,
  isFrozen,
  frozenEntityId,
  frozenModule,
  frozenEntityType,
  frozenOwnerId,
  frozenHasActiveAppeal,
  isAdmin,
  discussion,
  className,
  bodyClassName,
  bodyBottomContent,
  editedDate,
  createdDate,
  shareTitle,
  shareText,
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
        className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-slate-800 mb-6"
      >
        <ChevronLeft className="h-5 w-4" />
        {backLabel}
      </Link>

      <div className={clsx(bodyClassName ?? "sb-card min-w-0 w-full overflow-x-clip p-6 sm:p-6 md:p-8")}>
        {/* Moderation banner — frozen content is visible but read-only */}
        {isFrozen && frozenEntityId ? (
          <FrozenContentBanner
            entityId={frozenEntityId}
            module={frozenModule ?? "SOCIAL_FEED"}
            entityType={frozenEntityType ?? "POST"}
            ownerId={frozenOwnerId ?? authorId ?? null}
            currentUserId={currentUserId}
            hasActiveAppeal={frozenHasActiveAppeal}
            isAdmin={isAdmin}
            variant="detail"
          />
        ) : isFrozen && (
          <div className="mb-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-sm font-semibold text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400">
            <span className="inline-flex items-center gap-2 text-left">
              <span aria-hidden>❄</span>
              <span>
                This post has been frozen by moderators. Voting, reporting and
                commenting are disabled.
              </span>
            </span>
          </div>
        )}
        {/* Common header */}
        <div className="mb-6 flex items-center justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            {authorHref ? (
              <Link prefetch={false} href={authorHref} className="shrink-0">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden transition hover:ring-2 hover:ring-blue-100 dark:border dark:border-slate-700 dark:bg-slate-800">
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
              <div className="w-12 h-12 shrink-0 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden dark:border dark:border-slate-700 dark:bg-slate-800">
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
        <div className="min-w-0 max-w-full">
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
            {isFrozen && footerBookmarkButton && isValidElement(footerBookmarkButton)
              ? cloneElement(
                  footerBookmarkButton as React.ReactElement<{ frozen?: boolean }>,
                  { frozen: true },
                )
              : footerBookmarkButton}
            <ShareButton label="Share" title={shareTitle} text={shareText} />
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
