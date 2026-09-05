import { Flag } from "lucide-react";
import type { ContentView } from "@/lib/adminConfig";

export type AdminStatusFilter =
  | "all"
  | "active"
  | "frozen"
  | "deleted";

interface AdminToolbarProps {
  /** e.g. "Feed Management" or "Users Management". */
  title: string;
  /** Rest of the heading — shows "· Posts" / "· Comments" for content tabs. */
  subtitle?: string;
  /** Show the Posts/Comments segmented switch (hidden for Users & Appeals). */
  showPostsComments: boolean;
  view: ContentView;
  onViewSelect: (v: ContentView) => void;
  /** Show the two Appeals selects (Admin Status / Entity Status). */
  showAppealFilters: boolean;
  statusFilter: AdminStatusFilter;
  onStatusFilterChange: (v: AdminStatusFilter) => void;
  entityStatusFilter: AdminStatusFilter;
  onEntityStatusFilterChange: (v: AdminStatusFilter) => void;
  /** Show the generic Status select (hidden for Users & Appeals). */
  showStatusFilter: boolean;
  /** Show the "Sort: Newest / Most Reports" toggle (hidden for Users). */
  showSort: boolean;
  sortBy: "createdAt" | "reportCount";
  onToggleSort: () => void;
}

const selectClass =
  "rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800";

const cast = (v: string): AdminStatusFilter =>
  v as AdminStatusFilter;

/** Toolbar above the data table — tab sub-view switch, status filters and the
 *  sort toggle. All state is lifted to the dashboard; this stays presentational. */
export function AdminToolbar({
  title,
  subtitle,
  showPostsComments,
  view,
  onViewSelect,
  showAppealFilters,
  statusFilter,
  onStatusFilterChange,
  entityStatusFilter,
  onEntityStatusFilterChange,
  showStatusFilter,
  showSort,
  sortBy,
  onToggleSort,
}: AdminToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        {title}
        {subtitle && (
          <span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">
            · {subtitle}
          </span>
        )}
      </h3>

      <div className="flex flex-wrap items-center gap-2">
        {showPostsComments && (
          <div className="inline-flex rounded-lg border border-slate-300 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800">
            {(["posts", "comments"] as ContentView[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onViewSelect(v)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition ${
                  view === v
                    ? "bg-white text-blue-700 shadow-sm dark:bg-slate-900 dark:text-blue-300"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        )}

        {showAppealFilters && (
          <>
            <label className="sr-only" htmlFor="admin-status-filter">
              Filter by admin status
            </label>
            <select
              id="admin-status-filter"
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(cast(e.target.value))}
              className={selectClass}
            >
              <option value="all">Admin: All</option>
              <option value="active">Admin: Pending</option>
              <option value="frozen">Admin: Actioned</option>
              <option value="deleted">Admin: Dismissed</option>
            </select>
            <label className="sr-only" htmlFor="entity-status-filter">
              Filter by entity status
            </label>
            <select
              id="entity-status-filter"
              value={entityStatusFilter}
              onChange={(e) => onEntityStatusFilterChange(cast(e.target.value))}
              className={selectClass}
            >
              <option value="all">Entity: All</option>
              <option value="active">Entity: Active</option>
              <option value="frozen">Entity: Frozen</option>
              <option value="deleted">Entity: Deleted</option>
            </select>
          </>
        )}

        {showStatusFilter && (
          <>
            <label className="sr-only" htmlFor="status-filter">
              Filter by status
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(cast(e.target.value))}
              className={selectClass}
            >
              <option value="all">Status: All</option>
              <option value="active">Status: Active</option>
              <option value="frozen">Status: Frozen</option>
              <option value="deleted">Status: Deleted</option>
            </select>
          </>
        )}

        {showSort && (
          <button
            type="button"
            onClick={onToggleSort}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Flag className="h-3.5 w-3.5 text-red-500" />
            {sortBy === "reportCount" ? "Sort: Most Reports" : "Sort: Newest"}
          </button>
        )}
      </div>
    </div>
  );
}