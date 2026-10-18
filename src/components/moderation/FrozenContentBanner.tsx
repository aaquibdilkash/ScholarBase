"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, HelpCircle, Loader2 } from "lucide-react";
import { AppealButton } from "@/components/appeals/AppealButton";
import { getMyContentFreezeContext } from "@/app/actions/content-freeze-context";
import { getReportsForEntity } from "@/app/actions/admin";
import type { FreezeContext } from "@/app/actions/freeze-context";
import type { ReportEntityType, ReportModule } from "@/types/reports";

function prettyCategory(category: string) {
  return category
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

type ContentFreezeContext = FreezeContext & { isOwner: boolean; isAdmin: boolean };

export type FrozenContentBannerProps = {
  entityId: string;
  module: ReportModule;
  entityType?: ReportEntityType;
  ownerId?: string | null;
  currentUserId?: string | null;
  hasActiveAppeal?: boolean;
  isAdmin?: boolean;
  /** Compact single-line variant for list cards; default is the detail banner. */
  variant?: "detail" | "list-compact";
};

/**
 * Frozen-content banner — the post-card twin of `FrozenAccountBanner`.
 *
 * - Everyone sees the frozen notice (visibility parity with the static banner
 *   it replaces in `DetailPageCardShell`, new in `ListPageCardShell`).
 * - Owners get `View reason & Appeal` — anonymized report categories + the
 *   same `AppealButton` behind the flag menu (mirrors the frozen-user flow).
 * - Admins get `View reports` — pending reports via `getReportsForEntity`.
 * - Strangers see the static notice only (report excerpts never leak).
 *
 * Dialog data lazy-loads via React Query only when opened (`staleTime: 30s`),
 * so list feeds pay zero extra queries for frozen rows they never expand.
 */
export function FrozenContentBanner({
  entityId,
  module,
  entityType = "POST",
  ownerId,
  currentUserId,
  hasActiveAppeal = false,
  isAdmin = false,
  variant = "detail",
}: FrozenContentBannerProps) {
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);

  const isOwner = ownerId != null && ownerId === currentUserId;
  const canSeeReason = isOwner || isAdmin;
  const canAppeal = isOwner && !hasActiveAppeal;

  return (
    <>
      <div
        role="alert"
        className={
          variant === "list-compact"
            ? "mb-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs font-semibold text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400"
            : "mb-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-sm font-semibold text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400"
        }
      >
        {/* ❄ and the notice share one inline-flex span so the glyph can never
            wrap onto its own line on narrow viewports. */}
        <span className="inline-flex items-center gap-2 text-left">
          <span aria-hidden>❄</span>
          <span>
            This post has been frozen by moderators. Voting, reporting and
            commenting are disabled.
          </span>
        </span>
        {canSeeReason && (
          <button
            type="button"
            onClick={() => setReasonOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-amber-600 px-3 py-1 text-xs font-bold text-white transition hover:bg-amber-700"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            View reason{canAppeal ? " & Appeal" : ""}
          </button>
        )}
        {isAdmin && (
          <button
            type="button"
            onClick={() => setReportsOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-bold text-amber-700 transition hover:bg-amber-100 dark:border-amber-800 dark:bg-transparent dark:text-amber-300 dark:hover:bg-amber-950/60"
          >
            <Eye className="h-3.5 w-3.5" />
            View reports
          </button>
        )}
      </div>

      {reasonOpen && canSeeReason && (
        <ContentFreezeReasonDialog
          entityId={entityId}
          module={module}
          entityType={entityType}
          hasActiveAppeal={hasActiveAppeal}
          onClose={() => setReasonOpen(false)}
        />
      )}

      {reportsOpen && isAdmin && (
        <ContentFreezeReportsDialog
          entityId={entityId}
          onClose={() => setReportsOpen(false)}
        />
      )}
    </>
  );
}


function ContentFreezeReasonDialog({
  entityId,
  module,
  entityType,
  hasActiveAppeal,
  onClose,
}: {
  entityId: string;
  module: ReportModule;
  entityType: ReportEntityType;
  hasActiveAppeal: boolean;
  onClose: () => void;
}) {
  const { data, isPending, isError } = useQuery<ContentFreezeContext>({
    queryKey: ["content-freeze-context", entityId],
    queryFn: () => getMyContentFreezeContext(entityId, module, entityType),
    staleTime: 30_000,
  });

  return (
    <div className="fixed inset-0 z-modal overflow-y-auto">
      <div
        className="flex min-h-full items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Why is this content frozen?
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            >
              <span className="sr-only">Close</span>x
            </button>
          </div>

          {isPending ? (
            <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading freeze details...
            </p>
          ) : isError || !data ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Could not load freeze details. You can still file an appeal
              below, or from the flag menu on this post.
            </p>
          ) : (
            <div className="mb-4 flex flex-col gap-2">
              {data.reports.length === 0 ? (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  A moderator froze this content after reviewing reports
                  against it
                  {data.reportCount > 0 ? ` (${data.reportCount} total)` : ""}.
                  Reporter identities are kept private.
                </p>
              ) : (
                data.reports.map((r) => (
                  <div
                    key={r.category}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  >
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      {prettyCategory(r.category)} x {r.count}
                    </p>
                    {r.excerpts.map((ex, i) => (
                      <p
                        key={i}
                        className="mt-1 text-xs text-slate-500 dark:text-slate-400"
                      >
                        &ldquo;{ex}&rdquo;
                      </p>
                    ))}
                  </div>
                ))
              )}
              {data.pendingAppeal && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400">
                  Appeal pending review — moderators will decide shortly.
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Close
            </button>
            <AppealButton
              entityId={entityId}
              module={module}
              entityType={entityType === "COMMENT" ? "COMMENT" : "POST"}
              hasActiveAppeal={data?.hasActiveAppeal ?? hasActiveAppeal}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ContentFreezeReportsDialog({
  entityId,
  onClose,
}: {
  entityId: string;
  onClose: () => void;
}) {
  const [reports, setReports] = useState<
    {
      id: string;
      category: string;
      details: string | null;
      createdAt: Date;
      reporter: { name: string | null; email: string | null } | null;
    }[]
  >([]);
  const [isPending, setIsPending] = useState(true);
  const [isError, setIsError] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const page = await getReportsForEntity(entityId, null);
        setReports(page.reports);
        setNextCursor(page.nextCursor);
      } catch {
        setIsError(true);
      } finally {
        setIsPending(false);
      }
    })();
  }, [entityId]);

  const loadMore = async () => {
    if (!nextCursor || isFetchingMore) return;
    setIsFetchingMore(true);
    try {
      const page = await getReportsForEntity(entityId, nextCursor);
      setReports((prev) => [...prev, ...page.reports]);
      setNextCursor(page.nextCursor);
    } catch {
      setIsError(true);
    } finally {
      setIsFetchingMore(false);
    }
  };

  return (
    <div className="fixed inset-0 z-modal overflow-y-auto">
      <div
        className="flex min-h-full items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Reports on this content
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            >
              <span className="sr-only">Close</span>x
            </button>
          </div>

          {isPending ? (
            <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading reports...
            </p>
          ) : isError ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Could not load reports for this content.
            </p>
          ) : reports.length === 0 ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              No pending reports on this content. It may have been frozen
              directly by a moderator.
            </p>
          ) : (
            <div className="mb-4 flex max-h-80 flex-col gap-2 overflow-y-auto">
              {reports.map((r) => (
                <div
                  key={r.id}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {prettyCategory(String(r.category))} ·{" "}
                    {r.reporter?.name || r.reporter?.email || "Unknown reporter"}
                  </p>
                  {r.details && (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      &ldquo;{r.details}&rdquo;
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                    {new Date(r.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
              {nextCursor && (
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={isFetchingMore}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {isFetchingMore ? "Loading..." : "Load older reports"}
                </button>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
