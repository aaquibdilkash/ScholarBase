import { MessageCircle } from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import Link from "next/link";
import type { ReactNode } from "react";
import { FollowButton } from "@/components/interactions/FollowButton"; // client component
import { ShareButton } from "@/components/interactions/ShareButton";
import { FrozenContentBanner } from "@/components/moderation/FrozenContentBanner";
import { formatTimeAgo } from "../../utils/time-ago";
import { TruncatedCardBody } from "./TruncatedCardBody";
import type { ReportEntityType, ReportModule } from "@/types/reports";

// local tiny utility to avoid adding new deps
const clsx = (...inputs: Array<string | false | null | undefined>) =>
  inputs.filter(Boolean).join(" ");

export type ListPageCardShellProps = {
    // Common header (author). When omitted (e.g., anonymous authors), the
  // header renders as plain text and does NOT link to any profile.
  authorHref?: string;
  authorName: string;
  authorHandle?: string;
  authorAvatarUrl?: string | null;
  authorVerified?: boolean;

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
  footerBookmarkButton?: ReactNode;
  footerCommentsHref?: string;
  footerCommentsCount?: number;
  footer?: ReactNode;

  // Dedicated report menu in the footer (far-right edge)
  footerReportMenu?: ReactNode;

  // Frozen banner controls — optional so existing call sites keep working.
  // When `isFrozen` is true but frozenEntityId is omitted, a static notice
  // renders (no View reason / View reports affordances).
  isFrozen?: boolean;
  frozenEntityId?: string;
  frozenModule?: ReportModule;
  frozenEntityType?: ReportEntityType;
  frozenOwnerId?: string | null;
  frozenHasActiveAppeal?: boolean;
  isAdmin?: boolean;

  className?: string;
  bodyClassName?: string;

  // link to the detail page
  detailPageHref: string;
  bodyBottomContent?: ReactNode;

  // Share payload for the footer share button. The card lives on a LIST page,
  // so falling back to the page's og:tags would share the directory's
  // title/description instead of this item's. Callers that pass these mirror
  // their detail page's generateMetadata(); when omitted the ShareButton
  // falls back to og:tags (correct on detail pages).
  shareTitle?: string;
  shareText?: string;

  editedDate?: Date | string;
  createdDate: Date | string;
  createdLabel?: string;
  editedLabel?: string;

  // When true, children will NOT be wrapped in a <Link prefetch={false}> (use case: children contain <a> tags)
  noBodyLink?: boolean;

  // When false, the middle body is rendered without the generic line-clamp /
  // measurement (use case: cards that manage their own text expansion).
  constrainBody?: boolean;
};

export default function ListPageCardShell({
  createdLabel = "Created",
  editedLabel = "Edited",
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
  footer,
  footerReportMenu,
  isFrozen,
  frozenEntityId,
  frozenModule,
  frozenEntityType,
  frozenOwnerId,
  frozenHasActiveAppeal,
  isAdmin,
  className,
  bodyClassName,
  detailPageHref,
  bodyBottomContent,
  shareTitle,
  shareText,
  editedDate,
  createdDate,
  noBodyLink = false,
  constrainBody,
}: ListPageCardShellProps) {
  const showManagementControls = Boolean(managementControls);

  return (
    <div className={clsx("sb-card min-w-0 w-full p-6 sm:p-6 md:p-8", className)}>
      {/* Frozen banner — visible before header for frozen list cards */}
      {isFrozen && frozenEntityId ? (
        <FrozenContentBanner
          entityId={frozenEntityId}
          module={frozenModule ?? "SOCIAL_FEED"}
          entityType={frozenEntityType ?? "POST"}
          ownerId={frozenOwnerId ?? authorId ?? null}
          currentUserId={currentUserId}
          hasActiveAppeal={frozenHasActiveAppeal}
          isAdmin={isAdmin}
          variant="list-compact"
        />
      ) : isFrozen ? (
        <div className="mb-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs font-semibold text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400">
          <span className="inline-flex items-center gap-2 text-left">
            <span aria-hidden>❄</span>
            <span>
              This post has been frozen by moderators. Voting, reporting and
              commenting are disabled.
            </span>
          </span>
        </div>
      ) : null}
      {/* Common header */}
      <div className="mb-6 flex items-center justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {authorHref ? (
            <Link href={authorHref} prefetch={false} className="shrink-0">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-slate-100 transition hover:ring-2 hover:ring-blue-100 dark:border dark:border-slate-700 dark:bg-slate-800">
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
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 dark:border dark:border-slate-700 dark:bg-slate-800">
              <span className="font-semibold text-slate-400 text-lg">?</span>
            </div>
          )}

          <div className="min-w-0 flex-1">
            {authorHref ? (
              <Link
                href={authorHref}
                prefetch={false}
                className="block max-w-full truncate font-semibold text-slate-950 transition hover:text-blue-700 hover:underline dark:text-slate-50 dark:hover:text-blue-300"
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
              <div className="mt-0.5 max-w-full whitespace-normal break-words text-xs font-medium text-slate-500 dark:text-slate-400">
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
        className={clsx("block min-w-0 group", bodyClassName)}
        noBodyLink={noBodyLink}
        constrainBody={constrainBody}
      >
        {children}
      </TruncatedCardBody>

      {bodyBottomContent}

      <div className="mt-2 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
        <span suppressHydrationWarning className="font-semibold text-slate-400 dark:text-slate-500">
          {" "}
          {createdLabel} {formatTimeAgo(createdDate)}
        </span>
        {editedDate && (
          <span suppressHydrationWarning className="font-semibold text-slate-400 dark:text-slate-500">
            {editedLabel} {formatTimeAgo(editedDate)}
          </span>
        )}
      </div>

      {/* Common footer — votes/comments left, Share + Report far right */}
      <div className="mt-2 flex items-center justify-between gap-4 border-t border-slate-200 pt-2 dark:border-slate-800 sm:gap-6">
        {footer ? (
          footer
        ) : (
          <>
            <div className="flex items-center gap-4 sm:gap-6">
              {footerVoteButton}

              {footerCommentsHref && (
                <Link
                  href={footerCommentsHref}
                  prefetch={false}
                  className="flex items-center gap-1.5 text-sm font-bold text-slate-800 transition-colors hover:text-blue-700 dark:text-slate-400 sm:gap-2"
                >
                  <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2.5} />
                  {(footerCommentsCount || 0).toString()}{" "}
                  <span className="hidden md:inline">
                    {footerCommentsCount === 1 ? "Comment" : "Comments"}
                  </span>
                </Link>
              )}
            </div>

            <div className="flex items-center gap-2">
              {footerBookmarkButton}
              <ShareButton
                href={detailPageHref}
                label="Share"
                title={shareTitle}
                text={shareText}
              />
              {footerReportMenu}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
