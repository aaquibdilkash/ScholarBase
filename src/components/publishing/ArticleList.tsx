import Link from "next/link";

import { formatDate } from "@/utils/date";
import type { ArticleSummary, PublicVenue } from "@/lib/publishing/public";
import { venueBasePath } from "@/components/publishing/VenueMasthead";

/** `12` + `2` -> `"12(2)"`; `12` + null -> `"12"`; neither -> `null`. */
export function issueLocator(
  volume: number | null,
  issue: number | null,
): string | null {
  if (volume === null && issue === null) return null;
  if (volume === null) return `Issue ${issue}`;
  return issue === null ? `Vol. ${volume}` : `${volume}(${issue})`;
}

export function articleHref(venue: PublicVenue, articleId: string): string {
  return `${venueBasePath(venue.type)}/${venue.slug}/article/${articleId}`;
}

/** Human-readable byte size, capped at MB so a 25 MB PDF reads as "24.1 MB". */
export function formatFileSize(bytes: number | null): string | null {
  if (!bytes || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ArticleList({
  venue,
  articles,
  showIssue = false,
  emptyMessage = "No articles have been published in this venue yet.",
}: {
  venue: PublicVenue;
  articles: readonly ArticleSummary[];
  showIssue?: boolean;
  emptyMessage?: string;
}) {
  if (articles.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[var(--card-border)] px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ol className="divide-y divide-[var(--card-border)]">
      {articles.map((article) => {
        const locator = showIssue ? issueLocator(article.volume, article.issue) : null;
        const size = formatFileSize(article.sizeBytes);

        return (
          <li key={article.id} className="py-4 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
              <h3 className="min-w-0 flex-1 text-base font-semibold leading-6 text-slate-950 dark:text-slate-50">
                <Link
                  className="underline-offset-2 hover:underline"
                  href={articleHref(venue, article.id)}
                >
                  {article.title}
                </Link>
              </h3>
              {article.pageRange ? (
                <span className="shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">
                  pp. {article.pageRange}
                </span>
              ) : null}
            </div>

            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {article.authors.map((author) => author.name).join(", ") ||
                "Author not listed"}
            </p>

            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              {locator ? <span>{locator}</span> : null}
              {article.publishedAt ? (
                <span>Published {formatDate(article.publishedAt)}</span>
              ) : null}
              {article.doi ? (
                <a
                  className="underline hover:text-slate-900 dark:hover:text-slate-100"
                  href={`https://doi.org/${article.doi}`}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  doi:{article.doi}
                </a>
              ) : null}
              {article.fileName ? (
                <a
                  className="font-medium text-blue-700 underline hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
                  href={`/api/papers/${article.id}/file`}
                >
                  PDF{size ? ` (${size})` : ""}
                </a>
              ) : null}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
