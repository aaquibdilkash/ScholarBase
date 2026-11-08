"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, ShieldAlert, Sparkles } from "lucide-react";
import {
  getAdminShieldSummary,
  getAdminShieldUsage,
} from "@/app/actions/admin";
import { AdminTable, type AdminColumn } from "@/components/admin/AdminTable";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { Button } from "@/components/ui/button";
import { ADMIN_PAGE_SIZE } from "@/lib/constants";
import type { AdminShieldTool, AdminShieldUsageItem } from "@/types/admin";

const TOOL_TABS: {
  id: AdminShieldTool;
  label: string;
  Icon: typeof ShieldAlert;
}[] = [
  { id: "DETECTOR", label: "Detector", Icon: ShieldAlert },
  { id: "REWRITER", label: "Rewriter", Icon: Sparkles },
];

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Detector scores are AI-likelihood percentages — tint by risk band. */
function scoreBadge(value: number | null) {
  if (value === null) {
    return <span className="text-slate-400 dark:text-slate-500">—</span>;
  }
  const tone =
    value >= 70
      ? "bg-rose-50 border-rose-100 text-rose-700 dark:bg-rose-900/20 dark:border-rose-900/30 dark:text-rose-300"
      : value >= 40
        ? "bg-amber-50 border-amber-100 text-amber-700 dark:bg-amber-900/20 dark:border-amber-900/30 dark:text-amber-300"
        : "bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-900/30 dark:text-emerald-300";
  return (
    <span
      className={`inline-flex rounded-lg border px-2 py-0.5 font-mono text-xs font-semibold ${tone}`}
    >
      {value}
    </span>
  );
}

/** Rewriter rows carry no scores, so their columns stay deliberately short. */
function columnsFor(
  tool: AdminShieldTool,
): AdminColumn<AdminShieldUsageItem>[] {
  const columns: AdminColumn<AdminShieldUsageItem>[] = [
    {
      key: "id",
      header: "Report ID",
      render: (item) => (
        <code
          title={item.id}
          className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-300"
        >
          {item.id.length > 14 ? `${item.id.slice(0, 14)}…` : item.id}
        </code>
      ),
    },
    {
      key: "model",
      header: "Engine",
      render: (item) => (
        <span className="font-mono text-xs text-slate-900 dark:text-slate-100">
          {item.model}
        </span>
      ),
    },
    {
      key: "scholar",
      header: "Scholar",
      render: (item) => (
        <div>
          <div className="font-medium text-slate-900 dark:text-slate-100">
            {item.user?.name ?? item.user?.email ?? "Unknown scholar"}
          </div>
          {item.user?.handle && (
            <div className="text-xs text-slate-500 dark:text-slate-400">
              @{item.user.handle}
            </div>
          )}
        </div>
      ),
    },
  ];

  if (tool === "DETECTOR") {
    columns.push(
      {
        key: "overallScore",
        header: "Overall",
        render: (item) => scoreBadge(item.overallScore),
        cellClassName: "w-24",
      },
      {
        key: "neuralScore",
        header: "Neural",
        render: (item) => scoreBadge(item.neuralScore),
        cellClassName: "w-24",
      },
      {
        key: "cadenceScore",
        header: "Cadence",
        render: (item) => scoreBadge(item.cadenceScore),
        cellClassName: "w-24",
      },
    );
  }

  columns.push({
    key: "createdAt",
    header: "Used",
    render: (item) => (
      <span className="text-xs text-slate-500 dark:text-slate-400">
        {formatDate(item.createdAt)}
      </span>
    ),
  });

  return columns;
}

function SummaryCard({
  label,
  total,
  recent,
}: {
  label: string;
  total: number | undefined;
  recent: number | undefined;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
        {total ?? "—"}
      </p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {recent ?? 0} in the last 7 days
      </p>
    </div>
  );
}

/** Admin → Scholar Shield: Detector and Rewriter usage, newest first. */
export function ShieldUsagePanel() {
  const [tool, setTool] = useState<AdminShieldTool>("DETECTOR");
  const [page, setPage] = useState(1);

  const summaryQuery = useQuery({
    queryKey: ["admin-shield-summary"],
    queryFn: () => getAdminShieldSummary(),
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
  });

  // One cache entry per (tool, page) — switching tabs/pages back is instant.
  const usageQuery = useQuery({
    queryKey: ["admin-shield-usage", tool, page],
    queryFn: () => getAdminShieldUsage(tool, page, ADMIN_PAGE_SIZE),
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
    // Keep the current rows visible while the next page loads.
    placeholderData: keepPreviousData,
  });

  const summary = summaryQuery.data;
  const data = usageQuery.data;
  const items = data?.items ?? [];

  const handleToolChange = (nextTool: AdminShieldTool) => {
    if (nextTool === tool) return;
    setTool(nextTool);
    setPage(1);
  };

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage === page) return;
    if (data && nextPage > data.totalPages) return;
    setPage(nextPage);
  };

  const tabClass = (active: AdminShieldTool, id: AdminShieldTool) =>
    active === id
      ? "bg-white text-blue-700 shadow-sm dark:bg-slate-900 dark:text-blue-300"
      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100";

  return (
    <div className="space-y-6">
      {/* Tab switch: Detector vs Rewriter */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800/50 sm:max-w-[360px]">
        <div className="flex">
          {TOOL_TABS.map(({ id, label, Icon }) => {
            const count =
              summary?.[id === "DETECTOR" ? "detector" : "rewriter"].total;
            return (
              <Button
                key={id}
                type="button"
                size="sm"
                onClick={() => handleToolChange(id)}
                className={`flex-1 rounded-none border-none bg-transparent px-3 py-2 text-xs font-semibold transition ${tabClass(tool, id)}`}
              >
                <Icon className="mr-1.5 h-3.5 w-3.5" />
                {label}
                {typeof count === "number" && (
                  <span className="ml-1.5 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    {count}
                  </span>
                )}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Detector scans"
          total={summary?.detector.total}
          recent={summary?.detector.last7Days}
        />
        <SummaryCard
          label="Rewriter runs"
          total={summary?.rewriter.total}
          recent={summary?.rewriter.last7Days}
        />
        <SummaryCard
          label="Total uses"
          total={summary?.total}
          recent={
            summary
              ? summary.detector.last7Days + summary.rewriter.last7Days
              : undefined
          }
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {usageQuery.isPending ? (
          <div className="p-8 text-center">
            <Loader2 className="inline-block h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : (
          <AdminTable
            columns={columnsFor(tool)}
            rows={items}
            rowKey={(item) => item.id}
            emptyMessage={
              tool === "DETECTOR"
                ? "No detector scans recorded yet."
                : "No rewriter runs recorded yet."
            }
          />
        )}
        {data && data.totalPages > 1 && (
          <AdminPagination
            page={data.page}
            total={data.total}
            totalPages={data.totalPages}
            itemsCount={items.length}
            isPending={usageQuery.isFetching}
            onPageChange={handlePageChange}
          />
        )}
      </div>
    </div>
  );
}
