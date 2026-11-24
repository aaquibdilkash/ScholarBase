"use client";

import { useEffect, useMemo } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { getReportsByModule } from "@/app/actions/admin";
import { AdminActionsDropdown } from "@/components/admin/AdminActionsDropdown";
import { UserAvatar } from "@/components/ui/UserAvatar";
import type { ReportWithReporter, ReportsPage } from "@/types/admin";
import { Snowflake, X } from "lucide-react";

type ReportsPanelProps = {
  module: string;
  initialTitle?: string;
};

type ReportGroup = {
  entityId: string;
  title: string | null;
  isFrozen: boolean;
  hasActiveAppeal: boolean;
  reports: ReportWithReporter[];
};

export function AdminReportsPanel({ module, initialTitle }: ReportsPanelProps) {
  const queryClient = useQueryClient();
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery<ReportsPage>({
    queryKey: ["reports-by-module", module],
    queryFn: ({ pageParam }) =>
      getReportsByModule(module, pageParam as string | null),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 30_000,
    enabled: !!module,
  });

  const reports = useMemo(
    () => data?.pages.flatMap((page) => page.reports) ?? [],
    [data],
  );

  // Reports arrive newest-first across many conversations. Group them so one
  // card maps to one moderator decision (freeze/unfreeze, dismiss) instead of
  // offering an action per duplicate report on the same group.
  const groups = useMemo(() => {
    const byEntity = new Map<string, ReportGroup>();
    for (const report of reports) {
      const existing = byEntity.get(report.entityId);
      if (existing) {
        existing.reports.push(report);
        continue;
      }
      byEntity.set(report.entityId, {
        entityId: report.entityId,
        title: report.entityTitle ?? null,
        isFrozen: Boolean(report.entityIsFrozen),
        hasActiveAppeal: Boolean(report.entityHasActiveAppeal),
        reports: [report],
      });
    }
    return [...byEntity.values()];
  }, [reports]);

  useEffect(() => {
    if (isLoading || isFetchingNextPage) return;
    const el = document.querySelector(
      ".admin-reports-scroll-bottom",
    ) as HTMLElement | null;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) fetchNextPage();
      },
      { root: el.parentElement, rootMargin: "80px", threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isLoading, isFetchingNextPage, fetchNextPage]);

  if (isLoading || isFetchingNextPage) {
    return (
      <div className="p-8 text-center">
        <svg
          className="inline-block h-8 w-8 animate-spin text-slate-400 mb-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" opacity="0.25" />
          <path d="M8 12l2.5 2.5M12 8l2.5 2.5M16 12l2.5 2.5" />
        </svg>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Loading reports…
        </p>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="p-8 text-center">
        <X className="h-6 w-6 mx-auto mb-4 text-slate-400 dark:text-slate-600" />
        <p className="text-slate-500 dark:text-slate-400">No pending reports</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {initialTitle || `Reports (${groups.length})`}
        </h2>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {groups.length} {groups.length === 1 ? "conversation" : "conversations"}
        </span>
      </div>

      <div className="space-y-3 max-h-[600px] overflow-y-auto">
        {groups.map((group) => (
          <div
            key={group.entityId}
            className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-center gap-3 border-b border-slate-100 p-3 dark:border-slate-800">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-200">
                {(group.title || "G").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {group.title || "Group discussion"}
                </p>
                <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                  {group.isFrozen && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                      <Snowflake className="h-3 w-3" />
                      Frozen
                    </span>
                  )}
                  {group.reports.length}{" "}
                  {group.reports.length === 1 ? "report" : "reports"}
                </p>
              </div>
              <AdminActionsDropdown
                contentType="MESSAGES"
                contentId={group.entityId}
                reportCount={group.reports.length}
                entityLabel="Group"
                showDelete={false}
                showRecover={false}
                isFrozen={group.isFrozen}
                hasActiveAppeal={group.hasActiveAppeal}
                onMutated={() => {
                  void queryClient.invalidateQueries({
                    queryKey: ["reports-by-module", module],
                  });
                }}
              />
            </div>

            <div className="space-y-2 p-3">
              {group.reports.map((report) => (
                <div key={report.id} className="flex items-start gap-2">
                  <div className="h-6 w-6 shrink-0 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <UserAvatar
                      src={`/api/users/avatar/${report.reporter?.id ?? "unknown"}`}
                      name={report.reporter?.name ?? "Reporter"}
                      imageClassName="rounded-full"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-slate-600 dark:text-slate-300">
                      <span className="font-medium">
                        {report.reporter?.name ?? "Unknown"}
                      </span>{" "}
                      · {report.category}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {report.details ?? "(no details)"}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
                    {new Date(report.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {hasNextPage && data?.pages && data.pages.length > 0 && (
        <div className="admin-reports-scroll-bottom border-t border-slate-200 p-3 mt-4 text-xs text-slate-500 dark:text-slate-400">
          Loading more…
        </div>
      )}
    </div>
  );
}
