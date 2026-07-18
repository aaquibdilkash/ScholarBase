import Link from "next/link";
import type { ReactNode } from "react";
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

  // Common footer (like + comments)
  footerLikeButton?: ReactNode;
  footerCommentsHref: string;
  footerCommentsCount: number;

  className?: string;
  bodyClassName?: string;

  // link to the detail page
  detailPageHref: string;
  bodyBottomContent?: ReactNode;
};

export default function ListPageCardShell({
  authorHref,
  authorName,
  authorHandle,
  authorAvatarUrl,
  managementControls,
  children,
  footerLikeButton,
  footerCommentsHref,
  footerCommentsCount,
  className,
  bodyClassName,
  detailPageHref,
  bodyBottomContent,
}: ListPageCardShellProps) {
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

        {/* 3 dots dropdown (edit/delete) */}
        <div className="flex items-center">{managementControls}</div>
      </div>

      {/* Clickable middle body */}
      <Link href={detailPageHref} className={clsx("block group", bodyClassName)}>
        {children}
      </Link>

      {bodyBottomContent}

      {/* Common footer */}
      <div className="border-t border-slate-200 pt-6 mt-8 flex items-center gap-8">
        {footerLikeButton}

        <Link
          href={footerCommentsHref}
          className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-blue-700 transition-colors"
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
    </div>
  );
}
