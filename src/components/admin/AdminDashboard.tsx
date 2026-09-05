"use client";

import { useState, useEffect, useTransition, useOptimistic } from "react";
import Link from "next/link";
import { Flag, ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/Toast";
import { RejectionModal } from "@/components/ui/RejectionModal";
import {
  getAdminContent,
  getAdminUsers,
  getAdminStats,
  getAdminAppeals,
  updateContributionStatus,
} from "@/app/actions/admin";
import { AdminActionsDropdown } from "@/components/admin/AdminActionsDropdown";
import {
  patchAdminContentCache,
  patchAdminAppealsCache,
} from "@/lib/adminCache";
import { getEntityDisplayTitle } from "@/lib/entityTitle";
import { useAdminNav } from "@/hooks/useAdminNav";
import type {
  AdminAppealItem,
  AdminContentItem,
  AdminPage,
} from "@/types/admin";
import type { ModerationAction } from "@/types/reports";

const ADMIN_SECTIONS = [
  { id: "appeals", title: "Appeals", href: "#" },
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
  /** Appeals-only: independent filter on the appealed entity's moderation
   *  state (Active / Frozen / Deleted). Falls back to "all" on non-appeal
   *  sections. */
  entityStatusFilter: "all" | "active" | "frozen" | "deleted";
};

const DEFAULT_SECTION_STATE: SectionUiState = {
  view: "posts",
  page: 1,
  sortBy: "createdAt",
  statusFilter: "all",
  entityStatusFilter: "all",
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
  // Navigation persisted in localStorage ("sb_admin_nav") — refreshing /admin
  // restores the last active section instead of resetting to "Feed"
  // (hydration-safe: first render matches SSR defaults, then syncs).
  const {
    activeSection: activeTab,
    setActiveSection: setActiveTab,
    setActiveSubTab: persistSubTab,
    setStatusFilter: persistStatusFilter,
    entityStatusFilter: persistedEntityStatusFilter,
    setEntityStatusFilter: persistEntityStatusFilter,
  } = useAdminNav();
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
  const { view, page, sortBy, statusFilter, entityStatusFilter } = ui;

  // Keep the persisted nav state in sync with the active section's view and
  // status filter, so a refresh reopens the exact same table configuration.
  useEffect(() => {
    persistSubTab(view);
    persistStatusFilter(statusFilter);
    if (activeTab === "appeals") persistEntityStatusFilter(entityStatusFilter);
  }, [
    view,
    statusFilter,
    entityStatusFilter,
    activeTab,
    persistSubTab,
    persistStatusFilter,
    persistEntityStatusFilter,
  ]);

  const setUi = (patch: Partial<SectionUiState>) =>
    setSectionStates((prev) => ({
      ...prev,
      [activeTab]: { ...(prev[activeTab] ?? DEFAULT_SECTION_STATE), ...patch },
    }));

  // Seed the appeals section's entityStatusFilter from the persisted global
  // nav state on first visit (matches the rest of the per-section hydration).
  useEffect(() => {
    if (
      activeTab === "appeals" &&
      !sectionStates.appeals &&
      persistedEntityStatusFilter
    ) {
      setUi({ entityStatusFilter: persistedEntityStatusFilter });
    }
  }, [activeTab, sectionStates.appeals, persistedEntityStatusFilter]);

  // --- Stats: cached, never refetched on actions (patched optimistically) ---
  const statsQuery = useQuery({
    queryKey: ["admin-stats"],
    queryFn: getAdminStats,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    initialData: initialStats,
  });
  // --- Appeals list: cached, paginated, newest-first. The cache is keyed by
  // the full filter combination (entityType + admin status + entity status)
  // so swapping filters hits a warm cache when revisited, and the
  // `patchAdminAppealsCache` helper can surgically update the matching row
  // without a refetch after a moderation action (RULE 1).
  const appealsQuery = useQuery({
    queryKey: ["admin-appeals", view, statusFilter, entityStatusFilter],
    queryFn: () =>
      getAdminAppeals(
        undefined,
        undefined,
        view === "posts" ? "POST" : "COMMENT",
      ),
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
    enabled: activeTab === "appeals",
  });
  const appealsData = appealsQuery.data;
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

  // Appeals tab: optimistic layer for the *moderation state* of the appealed
  // entity (entityStatus: Active/Frozen/Deleted). React Query handles the
  // long-term sync; useOptimistic makes the cell flip instantly the moment
  // the admin clicks Freeze/Unfreeze/Delete/Recover — same pattern as
  // `optimisticItems` above for the content tables.
  const [optimisticAppeals, applyOptimisticAppeal] = useOptimistic<
    AdminAppealItem[],
    { entityId: string; patch: Partial<AdminAppealItem> }
  >(appealsData?.items ?? [], (state, action) =>
    state.map((it) =>
      it.entityId === action.entityId ? { ...it, ...action.patch } : it,
    ),
  );

// Appeals tab renders the dedicated appeals query — NOT the content list.
// Two independent status filters are layered on top of the cached rows:
//   1. statusFilter (admin status): maps onto the appeal lifecycle
//      PENDING / ACTIONED / DISMISSED (same as before).
//   2. entityStatusFilter (entity moderation state): independent filter on
//      the appealed entity's live state — Active / Frozen / Deleted. This
//      lets admins pivot "show me PENDING appeals against Frozen content"
//      without any extra DB query (client-side filter on cached data).
  const appealsItems = optimisticAppeals.filter((a) => {
    if (statusFilter === "active") return a.status === "PENDING";
    if (statusFilter === "frozen") return a.status === "ACTIONED";
    if (statusFilter === "deleted") return a.status === "DISMISSED";
    return true; // "all"
  }).filter((a) => {
    if (entityStatusFilter === "active")
      return a.entityStatus === "ACTIVE";
    if (entityStatusFilter === "frozen")
      return a.entityStatus === "FROZEN";
    if (entityStatusFilter === "deleted")
      return a.entityStatus === "DELETED";
    return true; // "all"
  });
  const tableItems: AdminContentItem[] =
    activeTab === "appeals"
      ? appealsItems.map((a) => ({
          ...a,
          isFrozen: a.entityStatus === "FROZEN",
          isDeleted: a.entityStatus === "DELETED",
        })) as unknown as AdminContentItem[]
      : optimisticItems;

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

  // Appeals tab callback: fired by AdminActionsDropdown after every successful
  // moderation action against an appealed entity. Mirrors the new entityState
  // (Active/Frozen/Deleted) onto the appeal row optimistically AND patches
  // the React Query cache so a section switch keeps the change (RULE 1).
  const handleAppealMutated = (
    entityId: string,
    info: {
      action: ModerationAction;
      isFrozen?: boolean;
      isDeleted?: boolean;
    },
  ) => {
    const { isFrozen, isDeleted } = info;
    const nextStatus =
      isDeleted === true
        ? "DELETED"
        : isFrozen === true
          ? "FROZEN"
          : "ACTIVE";
    startTransition(() =>
      applyOptimisticAppeal({
        entityId,
        patch: { entityStatus: nextStatus },
      }),
    );
    patchAdminAppealsCache(queryClient, entityId, {
      entityStatus: nextStatus,
    });
  };

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

  const handleEntityStatusFilterChange = (
    next: "all" | "active" | "frozen" | "deleted",
  ) => {
    setUi({ entityStatusFilter: next, page: 1 });
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
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {ADMIN_SECTIONS.find((s) => s.id === activeTab)?.title}{" "}
                Management
                {activeTab !== "users" && (
                  <span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">
                    · {view === "comments" ? "Comments" : "Posts"}
                  </span>
                )}
              </h3>

              {/* Tab switcher + filters + sort live in the toolbar above
                  the table — keeping the table itself to pure data so the
                  <th>/<td> column order always matches 1:1 (see the
                  appeals columns below). */}
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
                {activeTab === "appeals" && (
                  <>
                    {/* Appeal lifecycle filter — pending/actioned/dismissed.
                        Drives the "Admin Status" column on the appeals tab. */}
                    <label className="sr-only" htmlFor="admin-status-filter">
                      Filter by admin status
                    </label>
                    <select
                      id="admin-status-filter"
                      value={statusFilter}
                      onChange={(e) =>
                        handleStatusFilterChange(
                          e.target.value as
                            | "all"
                            | "active"
                            | "frozen"
                            | "deleted",
                        )
                      }
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <option value="all">Admin: All</option>
                      <option value="active">Admin: Pending</option>
                      <option value="frozen">Admin: Actioned</option>
                      <option value="deleted">Admin: Dismissed</option>
                    </select>
                    {/* Entity moderation state filter — active/frozen/deleted.
                        Drives the "Entity Status" column on the appeals tab. */}
                    <label className="sr-only" htmlFor="entity-status-filter">
                      Filter by entity status
                    </label>
                    <select
                      id="entity-status-filter"
                      value={entityStatusFilter}
                      onChange={(e) =>
                        handleEntityStatusFilterChange(
                          e.target.value as
                            | "all"
                            | "active"
                            | "frozen"
                            | "deleted",
                        )
                      }
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <option value="all">Entity: All</option>
                      <option value="active">Entity: Active</option>
                      <option value="frozen">Entity: Frozen</option>
                      <option value="deleted">Entity: Deleted</option>
                    </select>
                  </>
                )}
                {activeTab !== "users" && activeTab !== "appeals" && (
                  /* Generic status filter for the non-appeals content tables —
                     drives the same `<th>` that shows Active/Frozen/Deleted
                     badges. */
                  <label className="sr-only" htmlFor="status-filter">
                    Filter by status
                  </label>
                )}
                {activeTab !== "users" && activeTab !== "appeals" && (
                  <select
                    id="status-filter"
                    value={statusFilter}
                    onChange={(e) =>
                      handleStatusFilterChange(
                        e.target.value as
                          | "all"
                          | "active"
                          | "frozen"
                          | "deleted",
                      )
                    }
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <option value="all">Status: All</option>
                    <option value="active">Status: Active</option>
                    <option value="frozen">Status: Frozen</option>
                    <option value="deleted">Status: Deleted</option>
                  </select>
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
                          : activeTab === "appeals"
                            ? "Entity"
                            : view === "comments"
                              ? "Comment"
                              : "Title"}
                      </th>
                      <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                        {activeTab === "users"
                          ? "Email"
                          : activeTab === "appeals"
                            ? "Owner"
                            : "Author"}
                      </th>
<th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                        {activeTab === "appeals" ? "Admin Status" : "Reports"}
                      </th>
                      <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                        {activeTab === "appeals" ? "Reason" : "Appealed"}
                      </th>
                      {activeTab === "appeals" && (
                        <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                          Entity Status
                        </th>
                      )}
                      <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {tableItems.length === 0 ? (
                      <tr>
                        <td
                          colSpan={activeTab === "appeals" ? 6 : 5}
                          className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                        >
                          No content found
                          {statusFilter !== "all" && (
                            <> with admin status &quot;{statusFilter}&quot;</>
                          )}
                          {activeTab === "appeals" &&
                            entityStatusFilter !== "all" && (
                              <>
                                {statusFilter !== "all" ? " / " : " with "}
                                entity status &quot;{entityStatusFilter}&quot;
                              </>
                            )}
                          . Try a different filter.
                        </td>
                      </tr>
                    ) : (
                      tableItems.map((item) => (
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
                                {getEntityDisplayTitle(item)}
                              </Link>
                            ) : (
                              <p className="font-medium text-slate-900 dark:text-slate-100">
                                {getEntityDisplayTitle(item)}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                            {activeTab === "users"
                              ? item.email
                              : activeTab === "appeals"
                                ? item.owner?.name ||
                                  item.owner?.email ||
                                  "Unknown"
                                : item.author?.name ||
                                  item.author?.email ||
                                  "Unknown"}
                          </td>
                          <td className="px-4 py-3">
                            {activeTab === "appeals" ? (
                              <span
                                className={`inline-flex min-w-[32px] items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold ${
                                  item.status === "ACTIONED"
                                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                    : item.status === "DISMISSED"
                                      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                                      : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                                }`}
                              >
                                {item.status}
                              </span>
                            ) : (
                              <span
                                className={`inline-flex min-w-[32px] items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold ${
                                  (item.reportCount ?? 0) > 0
                                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                                    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                                }`}
                              >
                                {item.reportCount ?? 0}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {activeTab === "appeals" ? (
                              <span
                                className="max-w-[240px] truncate text-sm text-slate-600 dark:text-slate-400"
                                title={item.appealReason ?? undefined}
                              >
                                {/* Structured category + free-text details
                                    from the appeal modal (AppealButton). */}
                                {typeof item.category === "string"
                                  ? `${item.category.replaceAll("_", " ")}: `
                                  : ""}
                                {item.appealReason || "—"}
                              </span>
                            ) : item.hasActiveAppeal ? (
                              <span className="inline-flex w-fit items-center justify-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                                Yes
                              </span>
                            ) : (
                              <span className="inline-flex min-w-[40px] items-center justify-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                                No
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {/* Non-appeals tabs render the Active/Frozen/
                                Deleted badges under the "Appealed" cell.
                                Appeals tabs skip this entirely — the
                                dedicated Entity Status column below
                                carries the equivalent info. */}
                            {activeTab !== "appeals" && (
                              <div className="flex flex-wrap items-center gap-1.5">
                                {/* Comments are soft-deleted/frozen with the same
                                  isDeleted/isFrozen columns as other content
                                  (RULE 4); authorId is always preserved. */}
                                {view === "comments" ? (
                                  item.isDeleted ? (
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
                            )}
                          </td>
                          {activeTab === "appeals" && (
                            <td className="px-4 py-3">
                              {/* Mirrors the Entity Status filter column —
                                  shows the appealed entity's live moderation
                                  state. Flip is optimistic (see
                                  applyOptimisticAppeal in handleAppealMutated)
                                  — no DB round-trip on Freeze/Unfreeze/Delete/
                                  Recover. */}
                              <span
                                className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                  item.entityStatus === "DELETED"
                                    ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                                    : item.entityStatus === "FROZEN"
                                      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                                      : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                }`}
                              >
                                {item.entityStatus === "FROZEN"
                                  ? "Frozen"
                                  : item.entityStatus === "DELETED"
                                    ? "Deleted"
                                    : "Active"}
                              </span>
                            </td>
                          )}
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
                                  hasActiveAppeal={Boolean(
                                    item.hasActiveAppeal,
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
                                    activeTab === "appeals"
                                      ? item.contentType || "feed"
                                      : view === "comments"
                                        ? item.modelKey || "socialComment"
                                        : (SECTION_CONTENT_TYPES[activeTab] ??
                                          activeTab)
                                  }
                                  contentId={
                                    activeTab === "appeals"
                                      ? item.entityId || item.id
                                      : item.id
                                  }
                                  reportCount={item.reportCount ?? 0}
                                  showFreeze={!item.isDeleted}
                                  isFrozen={item.isFrozen}
                                  isDeleted={item.isDeleted}
                                  hasActiveAppeal={Boolean(
                                    item.hasActiveAppeal,
                                  )}
                                  entityLabel={
                                    activeTab === "appeals"
                                      ? item.entityType === "COMMENT"
                                        ? "Comment"
                                        : "Content"
                                      : view === "comments"
                                        ? "Comment"
                                        : undefined
                                  }
                                  disabled={isPending}
                                  sectionId={activeTab}
                                  onMutated={
                                    activeTab === "appeals"
                                      ? (info) =>
                                          handleAppealMutated(
                                            item.entityId || item.id,
                                            info,
                                          )
                                      : undefined
                                  }
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
