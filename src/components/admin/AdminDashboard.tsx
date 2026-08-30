"use client";

import { useState, useTransition, useOptimistic } from "react";
import Link from "next/link";
import { Flag, ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/Toast";
import { RejectionModal } from "@/components/ui/RejectionModal";
import {
  getAdminContent,
  getAdminUsers,
  getAdminStats,
  updateContributionStatus,
} from "@/app/actions/admin";
import { AdminActionsDropdown } from "@/components/admin/AdminActionsDropdown";
import { patchAdminContentCache } from "@/lib/adminCache";
import type { AdminContentItem, AdminPage } from "@/types/admin";

const ADMIN_SECTIONS = [
  { id: "feed", title: "Feed", href: "/feed" },
  { id: "blog", title: "Blog", href: "/blog" },
  { id: "publications", title: "Publications", href: "/publications" },
  { id: "journals", title: "Journals", href: "/journals" },
  { id: "researchTools", title: "Research Tools", href: "/research-tools" },
  { id: "admissions", title: "Admissions", href: "/admissions" },
  { id: "events", title: "Events", href: "/events" },
  { id: "vacancies", title: "Vacancies", href: "/vacancies" },
  { id: "help", title: "Help", href: "/help" },
  { id: "results", title: "Results", href: "/results" },
  { id: "contributions", title: "Contributions", href: "/contributions" },
  { id: "supervisors", title: "Supervisors", href: "/supervisor" },
  { id: "recommendations", title: "Recommendations", href: "/supervisor" },
  { id: "surveys", title: "Surveys", href: "/surveys" },
  { id: "users", title: "Users", href: "#" },
];

// Section id -> contentType key expected by toggleContentFreeze /
// moderateContent (reports.ts). Do NOT derive these by stripping the
// trailing "s" — feed/help/blog have no plural, vacancies → vacancie, etc.
const SECTION_CONTENT_TYPES: Record<string, string> = {
  feed: "feed",
  blog: "blog",
  publications: "publication",
  journals: "journal",
  researchTools: "researchTool",
  admissions: "admission",
  events: "event",
  vacancies: "vacancy",
  help: "help",
  results: "result",
  contributions: "contribution",
  supervisors: "supervisor",
  recommendations: "recommendation",
  surveys: "survey",
  users: "SCHOLAR_PROFILE",
};

type Stats = {
  totalUsers: number;
  totalContent: number;
  sections: Record<string, number>;
};

type AdminDashboardProps = {
  initialStats: Stats;
  initialData: AdminPage<AdminContentItem>;
};

type ContentView = "posts" | "comments";

// Per-section UI state — switching modules never resets another module's
// view/page/sort/filter, and each module's list stays in the React Query
// cache so returning to it renders instantly with zero DB queries.
type SectionUiState = {
  view: ContentView;
  page: number;
  sortBy: "createdAt" | "reportCount";
  statusFilter: "all" | "active" | "frozen" | "deleted";
};

const DEFAULT_SECTION_STATE: SectionUiState = {
  view: "posts",
  page: 1,
  sortBy: "createdAt",
  statusFilter: "all",
};

const EMPTY_PAGE: AdminPage<AdminContentItem> = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 10,
  totalPages: 0,
};

export function AdminDashboard({
  initialStats,
  initialData,
}: AdminDashboardProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("feed");
  const [sectionStates, setSectionStates] = useState<
    Record<string, SectionUiState>
  >({});
  const [isRejectionModalOpen, setIsRejectionModalOpen] = useState(false);
  const [itemToReject, setItemToReject] = useState<{
    contentId: string;
  } | null>(null);

  const [, startTransition] = useTransition();
  const { toast } = useToast();

  const ui = sectionStates[activeTab] ?? DEFAULT_SECTION_STATE;
  const { view, page, sortBy, statusFilter } = ui;

  const setUi = (patch: Partial<SectionUiState>) =>
    setSectionStates((prev) => ({
      ...prev,
      [activeTab]: { ...(prev[activeTab] ?? DEFAULT_SECTION_STATE), ...patch },
    }));

  // --- Stats: cached, never refetched on actions (patched optimistically) ---
  const statsQuery = useQuery({
    queryKey: ["admin-stats"],
    queryFn: getAdminStats,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    initialData: initialStats,
  });
  const stats = statsQuery.data;

  // --- Content list: one cached query per (module, view, page, sort, filter).
  // staleTime: Infinity → switching modules back and forth never hits the DB
  // again; lists only change through our own optimistic cache patches.
  const queryKey = [
    "admin-content",
    activeTab,
    view,
    page,
    sortBy,
    statusFilter,
  ] as const;
  const contentQuery = useQuery({
    queryKey,
    queryFn: () =>
      activeTab === "users"
        ? getAdminUsers(page, undefined, statusFilter)
        : getAdminContent(
            activeTab,
            sortBy,
            page,
            undefined,
            view,
            statusFilter,
          ),
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    // SSR-hydrated first page of the default Feed view — zero fetch on mount.
    initialData:
      activeTab === "feed" &&
      view === "posts" &&
      page === 1 &&
      sortBy === "createdAt" &&
      statusFilter === "all"
        ? initialData
        : undefined,
  });

  const data = contentQuery.data ?? EMPTY_PAGE;

  // RULE 1 micro-interactions: rows toggle instantly via useOptimistic while
  // the mutation syncs the React Query cache in the background.
  const [optimisticItems, applyOptimistic] = useOptimistic(
    data.items,
    (
      state,
      action: {
        id: string;
        patch?: Partial<AdminContentItem>;
        remove?: boolean;
      },
    ) =>
      action.remove
        ? state.filter((it) => it.id !== action.id)
        : state.map((it) =>
            it.id === action.id ? { ...it, ...action.patch } : it,
          ),
  );

  // --- Contribution approve/reject: optimistic status flip + cache patch ---
  const contributionMutation = useMutation({
    mutationFn: (vars: {
      id: string;
      status: "APPROVED" | "REJECTED";
      reason?: string;
    }) => updateContributionStatus(vars.id, vars.status, vars.reason),
    onMutate: ({ id, status }) => {
      startTransition(() => applyOptimistic({ id, patch: { status } }));
    },
    onSuccess: (_result, vars) => {
      toast(
        vars.status === "APPROVED"
          ? "Contribution approved"
          : "Contribution rejected",
        "success",
      );
      // Sync cache with the confirmed action (no refetch).
      patchAdminContentCache(queryClient, vars.id, {
        status: vars.status,
      });
    },
    onError: () => {
      toast("Failed to update contribution", "error");
    },
  });

  const handleTabClick = (sectionId: string) => {
    setActiveTab(sectionId); // list state (view/page/filters) is per-section
  };

  const handleViewSelect = (nextView: ContentView) => {
    setUi({ view: nextView, page: 1 });
  };

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage > data.totalPages || nextPage === page) return;
    setUi({ page: nextPage });
  };

  const handleStatusFilterChange = (
    next: "all" | "active" | "frozen" | "deleted",
  ) => {
    setUi({ statusFilter: next, page: 1 });
  };

  const handleSortChange = (next: "createdAt" | "reportCount") => {
    setUi({ sortBy: next, page: 1 });
  };

  const handleApprove = (contentId: string) => {
    contributionMutation.mutate({ id: contentId, status: "APPROVED" });
  };

  const handleReject = (contentId: string) => {
    setItemToReject({ contentId });
    setIsRejectionModalOpen(true);
  };

  const confirmReject = async (reason: string) => {
    if (!itemToReject) return;
    contributionMutation.mutate({
      id: itemToReject.contentId,
      status: "REJECTED",
      reason,
    });
    setIsRejectionModalOpen(false);
    setItemToReject(null);
  };

  const isPending =
    contentQuery.isPending ||
    statsQuery.isPending ||
    contributionMutation.isPending;

  const sectionCount = (sectionId: string) => stats?.sections?.[sectionId] ?? 0;

  return (
    <>
      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Total Users
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
              {stats.totalUsers}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Total Content
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
              {stats.totalContent}
            </p>
          </div>
          {ADMIN_SECTIONS.map((section) => (
            <button
              key={section.id}
              onClick={() => handleTabClick(section.id)}
              className={`rounded-xl border p-4 text-left transition ${
                activeTab === section.id
                  ? "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20"
                  : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {section.title}
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                {sectionCount(section.id)}
              </p>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="lg:w-64 shrink-0">
          <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
            <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Content Sections
              </h2>
            </div>
            <nav className="p-2">
              {ADMIN_SECTIONS.map((section) => (
                <button
                  key={section.id}
                  onClick={() => handleTabClick(section.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition mb-1 ${
                    activeTab === section.id
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                      : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  <span className="flex items-center justify-between">
                    {section.title}
                    <span className="text-xs font-semibold text-slate-400">
                      {sectionCount(section.id)}
                    </span>
                  </span>
                </button>
              ))}
            </nav>
          </div>
        </aside>

        <div className="flex-1">
          <div
            className={`rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden transition-opacity ${isPending ? "opacity-50" : "opacity-100"}`}
          >
            <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {ADMIN_SECTIONS.find((s) => s.id === activeTab)?.title}{" "}
                Management
                {activeTab !== "users" && (
                  <span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">
                    · {view === "comments" ? "Comments" : "Posts"}
                  </span>
                )}
              </h3>

              <div className="flex flex-wrap items-center gap-2">
                {activeTab !== "users" && (
                  <div className="inline-flex rounded-lg border border-slate-300 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800">
                    {(["posts", "comments"] as ContentView[]).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => handleViewSelect(v)}
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
                {activeTab !== "users" && (
                  <button
                    type="button"
                    onClick={() => {
                      handleSortChange(
                        sortBy === "createdAt" ? "reportCount" : "createdAt",
                      );
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <Flag className="h-3.5 w-3.5 text-red-500" />
                    {sortBy === "reportCount"
                      ? "Sort: Most Reports"
                      : "Sort: Newest"}
                  </button>
                )}
              </div>
            </div>

            {isPending ? (
              <div className="p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-300 border-t-blue-600"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/50">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                        {activeTab === "users"
                          ? "Name"
                          : view === "comments"
                            ? "Comment"
                            : "Title"}
                      </th>
                      <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                        {activeTab === "users" ? "Email" : "Author"}
                      </th>
                      <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                        Reports
                      </th>
                      <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                        Appealed
                      </th>
                      <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                        <label className="sr-only" htmlFor="status-filter">
                          Filter by status
                        </label>
                        <select
                          id="status-filter"
                          value={statusFilter}
                          onChange={(e) =>
                            handleStatusFilterChange(
                              e.target.value as
                                "all" | "active" | "frozen" | "deleted",
                            )
                          }
                          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <option value="all">Status: All</option>
                          <option value="active">Status: Active</option>
                          <option value="frozen">Status: Frozen</option>
                          <option value="deleted">Status: Deleted</option>
                        </select>
                      </th>
                      <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.items.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                        >
                          No content found
                          {statusFilter !== "all" && (
                            <> with status &quot;{statusFilter}&quot;</>
                          )}
                          . Try a different status filter.
                        </td>
                      </tr>
                    ) : (
                      optimisticItems.map((item) => (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                        >
                          <td className="px-4 py-3">
                            {activeTab === "users" ? (
                              <p className="font-medium text-slate-900 dark:text-slate-100">
                                {item.name}
                              </p>
                            ) : item.detailHref ? (
                              <Link
                                href={item.detailHref}
                                className="font-medium text-slate-900 transition hover:text-blue-700 dark:text-slate-100 dark:hover:text-blue-300"
                              >
                                {item.title ||
                                  item.content?.substring(0, 50) ||
                                  "Untitled"}
                              </Link>
                            ) : (
                              <p className="font-medium text-slate-900 dark:text-slate-100">
                                {item.title ||
                                  item.content?.substring(0, 50) ||
                                  "Untitled"}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                            {activeTab === "users"
                              ? item.email
                              : item.author?.name ||
                                item.author?.email ||
                                "Unknown"}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex min-w-[32px] items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold ${
                                (item.reportCount ?? 0) > 0
                                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                                  : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                              }`}
                            >
                              {item.reportCount ?? 0}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {/* Comments are soft-deleted/frozen with the same
                                isDeleted/isFrozen columns as other content
                                (RULE 4). Legacy tombstones (authorId: null)
                                surface as Deleted too. */}
                              {view === "comments" ? (
                                item.isDeleted || item.authorId == null ? (
                                  <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                    Deleted
                                  </span>
                                ) : (
                                  <span
                                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                      item.isFrozen
                                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                                        : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                    }`}
                                  >
                                    {item.isFrozen ? "Frozen" : "Active"}
                                  </span>
                                )
                              ) : (
                                <>
                                  {item.isDeleted && (
                                    <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                      Deleted
                                    </span>
                                  )}
                                  {activeTab === "contributions" &&
                                    !item.isDeleted && (
                                      <span
                                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                          item.status === "APPROVED"
                                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                            : item.status === "REJECTED"
                                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                                              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                                        }`}
                                      >
                                        {item.status}
                                      </span>
                                    )}
                                  {/* Active only when neither deleted nor frozen;
                                    deleted rows show Deleted (+"Frozen" if both). */}
                                  {!item.isDeleted && (
                                    <span
                                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                        item.isFrozen
                                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                                          : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                      }`}
                                    >
                                      {item.isFrozen ? "Frozen" : "Active"}
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {item.isAppealedByOwner ? (
                              <div className="flex flex-col gap-1">
                                <span className="inline-flex w-fit items-center justify-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                                  Yes
                                </span>
                                {item.appealReason && (
                                  <span
                                    className="max-w-[200px] truncate text-xs text-slate-500 dark:text-slate-400"
                                    title={item.appealReason}
                                  >
                                    {item.appealReason}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex min-w-[40px] items-center justify-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                                No
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {activeTab === "users" ? (
                                /* Same dropdown UI as other modules —
                                 moderateContent dispatches SCHOLAR_PROFILE to
                                 the User model (generic isFrozen/isDeleted). */
                                <AdminActionsDropdown
                                  contentType="SCHOLAR_PROFILE"
                                  contentId={item.id}
                                  sectionId="users"
                                  reportCount={item.reportCount ?? 0}
                                  showFreeze={!item.isDeleted}
                                  isFrozen={item.isFrozen}
                                  isDeleted={item.isDeleted}
                                  isAppealedByOwner={Boolean(
                                    item.isAppealedByOwner,
                                  )}
                                  disabled={isPending}
                                  entityLabel="User"
                                />
                              ) : activeTab === "contributions" &&
                                item.status === "PENDING" ? (
                                <>
                                  <button
                                    onClick={() => handleApprove(item.id)}
                                    className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition"
                                    disabled={isPending}
                                  >
                                    {isPending ? "..." : "Approve"}
                                  </button>
                                  <button
                                    onClick={() => handleReject(item.id)}
                                    className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition"
                                    disabled={isPending}
                                  >
                                    {isPending ? "..." : "Reject"}
                                  </button>
                                </>
                              ) : (
                                <AdminActionsDropdown
                                  contentType={
                                    view === "comments"
                                      ? item.modelKey || "socialComment"
                                      : (SECTION_CONTENT_TYPES[activeTab] ??
                                        activeTab)
                                  }
                                  contentId={item.id}
                                  reportCount={item.reportCount ?? 0}
                                  showFreeze={!item.isDeleted}
                                  isFrozen={item.isFrozen}
                                  isDeleted={
                                    view === "comments"
                                      ? item.isDeleted || item.authorId == null
                                      : item.isDeleted
                                  }
                                  isAppealedByOwner={Boolean(
                                    item.isAppealedByOwner,
                                  )}
                                  isTombstone={
                                    view === "comments" &&
                                    item.authorId == null &&
                                    !item.isDeleted
                                  }
                                  entityLabel={
                                    view === "comments" ? "Comment" : undefined
                                  }
                                  disabled={isPending}
                                  sectionId={activeTab}
                                />
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {data.totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 px-4 py-3 dark:border-slate-800">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Showing {data.items.length} of {data.total} · Page {data.page}{" "}
                  of {data.totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handlePageChange(data.page - 1)}
                    disabled={data.page <= 1 || isPending}
                    aria-label="Previous page"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {data.page} / {data.totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => handlePageChange(data.page + 1)}
                    disabled={data.page >= data.totalPages || isPending}
                    aria-label="Next page"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <RejectionModal
        isOpen={isRejectionModalOpen}
        onClose={() => setIsRejectionModalOpen(false)}
        onConfirm={confirmReject}
        title="Confirm Rejection"
        message="Are you sure you want to reject this item? Please provide a reason."
        isConfirming={isPending}
      />
    </>
  );
}
