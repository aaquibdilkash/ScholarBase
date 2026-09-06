"use client";

import { useState, useTransition, useOptimistic } from "react";
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
import {
  patchAdminContentCache,
  patchAdminAppealsCache,
} from "@/lib/adminCache";
import { useAdminNav } from "@/hooks/useAdminNav";
import {
  useAdminSectionState,
  DEFAULT_SECTION_STATE,
  type SectionUiState,
} from "@/hooks/useAdminSectionState";
import { ADMIN_SECTIONS } from "@/lib/adminConfig";
import type { ContentView } from "@/lib/adminConfig";
import { AdminStatsCards } from "@/components/admin/AdminStatsCards";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminToolbar } from "@/components/admin/AdminToolbar";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminTable } from "@/components/admin/AdminTable";
import {
  buildContentColumns,
  buildUsersColumns,
  buildAppealsColumns,
} from "@/components/admin/columns";
import type { AdminColumnsCtx } from "@/components/admin/columns";
import type {
  AdminAppealItem,
  AdminContentItem,
  AdminPage,
} from "@/types/admin";
import type { ModerationAction } from "@/types/reports";

type Stats = {
  totalUsers: number;
  totalContent: number;
  sections: Record<string, number>;
};

type AdminDashboardProps = {
  initialStats: Stats;
  initialData: AdminPage<AdminContentItem>;
};

// Per-section UI state — switching modules never resets another module's
// view/page/sort/filter, and each module's list stays in the React Query
// cache so returning to it renders instantly with zero DB queries.
// The state shape lives in useAdminSectionState (persisted to localStorage
// so a refresh restores it).

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
  const { activeSection: activeTab, setActiveSection: setActiveTab } =
    useAdminNav();
  // Per-section UI state persisted in localStorage ("sb_admin_sections") —
  // a refresh reopens every section with its exact view/page/sort/filters,
  // not just the active one (hydration-safe, same pattern as the nav hook).
  const { sectionStates, setSectionState } = useAdminSectionState();
  const [isRejectionModalOpen, setIsRejectionModalOpen] = useState(false);
  const [itemToReject, setItemToReject] = useState<{
    contentId: string;
  } | null>(null);

  const [, startTransition] = useTransition();
  const { toast } = useToast();

  const ui = sectionStates[activeTab] ?? DEFAULT_SECTION_STATE;
  const { view, page, sortBy, statusFilter, entityStatusFilter } = ui;

  const setUi = (patch: Partial<SectionUiState>) =>
    setSectionState(activeTab, patch);

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
// Columns are built from the SAME array the table's <thead> and <tbody>
  // render from, so header/cell counts can never drift (see AdminTable).
  const columnsCtx: AdminColumnsCtx = {
    activeTab,
    view,
    isPending,
    onApprove: handleApprove,
    onReject: handleReject,
    onAppealMutated: handleAppealMutated,
  };
  const columns =
    activeTab === "users"
      ? buildUsersColumns(columnsCtx)
      : activeTab === "appeals"
        ? buildAppealsColumns(columnsCtx)
        : buildContentColumns(columnsCtx);

  const emptyMessage = (
    <>
      No content found
      {statusFilter !== "all" && (
        <> with admin status &quot;{statusFilter}&quot;</>
      )}
      {activeTab === "appeals" && entityStatusFilter !== "all" && (
        <>
          {statusFilter !== "all" ? " / " : " with "}
          entity status &quot;{entityStatusFilter}&quot;
        </>
      )}
      . Try a different filter.
    </>
  );

  const activeSectionTitle =
    ADMIN_SECTIONS.find((s) => s.id === activeTab)?.title ?? "";

  return (
    <>
      {stats && (
        <AdminStatsCards
          sections={ADMIN_SECTIONS}
          activeSection={activeTab}
          onSelect={handleTabClick}
          getCount={sectionCount}
        />
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        <AdminSidebar
          sections={ADMIN_SECTIONS}
          activeSection={activeTab}
          onSelect={handleTabClick}
          getCount={sectionCount}
        />

        <div className="flex-1">
          <div
            className={`rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden transition-opacity ${isPending ? "opacity-50" : "opacity-100"}`}
          >
            <AdminToolbar
              title={`${activeSectionTitle} Management`}
              subtitle={
                activeTab !== "users"
                  ? view === "comments"
                    ? "Comments"
                    : "Posts"
                  : undefined
              }
              showPostsComments={activeTab !== "users"}
              view={view}
              onViewSelect={handleViewSelect}
              showAppealFilters={activeTab === "appeals"}
              statusFilter={statusFilter}
              onStatusFilterChange={handleStatusFilterChange}
              entityStatusFilter={entityStatusFilter}
              onEntityStatusFilterChange={handleEntityStatusFilterChange}
              showStatusFilter={
                activeTab !== "users" && activeTab !== "appeals"
              }
              showSort={activeTab !== "users"}
              sortBy={sortBy}
              onToggleSort={() =>
                handleSortChange(
                  sortBy === "createdAt" ? "reportCount" : "createdAt",
                )
              }
            />

            {isPending ? (
              <div className="p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-300 border-t-blue-600"></div>
              </div>
            ) : (
              <AdminTable
                columns={columns}
                rows={tableItems}
                rowKey={(item) => item.id}
                emptyMessage={emptyMessage}
              />
            )}

            {data.totalPages > 1 && (
              <AdminPagination
                page={data.page}
                total={data.total}
                totalPages={data.totalPages}
                itemsCount={data.items.length}
                isPending={isPending}
                onPageChange={handlePageChange}
              />
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