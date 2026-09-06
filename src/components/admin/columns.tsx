import Link from "next/link";
import type { ReactNode } from "react";
import { AdminActionsDropdown } from "@/components/admin/AdminActionsDropdown";
import { getEntityDisplayTitle } from "@/lib/entityTitle";
import { getModuleLabel } from "@/lib/notification-links";
import { ContentView, SECTION_CONTENT_TYPES } from "@/lib/adminConfig";
import type { AdminColumn } from "@/components/admin/AdminTable";
import type { AdminContentItem } from "@/types/admin";
import type { ModerationAction } from "@/types/reports";

/**
 * Shared context threaded into every column builder so cells can call back
 * into the dashboard's handlers. Kept slim — the builders stay the only place
 * that knows about column layout.
 */
export interface AdminColumnsCtx {
  activeTab: string;
  view: ContentView;
  isPending: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onAppealMutated: (
    entityId: string,
    info: { action: ModerationAction; isFrozen?: boolean; isDeleted?: boolean },
  ) => void;
}

/* ---------------------------------------------------------------------------
 * Shared cell renderers
 * ------------------------------------------------------------------------- */

function renderTitle(item: AdminContentItem): ReactNode {
  return item.detailHref ? (
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
  );
}

function renderReports(item: AdminContentItem): ReactNode {
  return (
    <span
      className={`inline-flex min-w-[32px] items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold ${
        (item.reportCount ?? 0) > 0
          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
          : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
      }`}
    >
      {item.reportCount ?? 0}
    </span>
  );
}

function renderAppealed(item: AdminContentItem): ReactNode {
  return item.hasActiveAppeal ? (
    <span className="inline-flex w-fit items-center justify-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
      Yes
    </span>
  ) : (
    <span className="inline-flex min-w-[40px] items-center justify-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-400 dark:bg-slate-800 dark:text-slate-500">
      No
    </span>
  );
}

/** Active / Frozen / Deleted (+ contribution status) badges. */
function renderStatusBadges(
  item: AdminContentItem,
  ctx: AdminColumnsCtx,
): ReactNode {
  const { activeTab, view } = ctx;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
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
          {activeTab === "contributions" && !item.isDeleted && (
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
  );
}

/** Last-column actions: users dropdown / contribution approve-reject / the
 *  generic moderation dropdown. */
function renderActions(item: AdminContentItem, ctx: AdminColumnsCtx): ReactNode {
  const { activeTab, view, isPending, onApprove, onReject, onAppealMutated } =
    ctx;
  return (
    <div className="flex items-center gap-2">
      {activeTab === "users" ? (
        <AdminActionsDropdown
          contentType="SCHOLAR_PROFILE"
          contentId={item.id}
          sectionId="users"
          reportCount={item.reportCount ?? 0}
          showFreeze={!item.isDeleted}
          isFrozen={item.isFrozen}
          isDeleted={item.isDeleted}
          hasActiveAppeal={Boolean(item.hasActiveAppeal)}
          disabled={isPending}
          entityLabel="User"
        />
      ) : activeTab === "contributions" && item.status === "PENDING" ? (
        <>
          <button
            onClick={() => onApprove(item.id)}
            className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition"
            disabled={isPending}
          >
            {isPending ? "..." : "Approve"}
          </button>
          <button
            onClick={() => onReject(item.id)}
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
                : (SECTION_CONTENT_TYPES[activeTab] ?? activeTab)
          }
          contentId={
            activeTab === "appeals" ? item.entityId || item.id : item.id
          }
          reportCount={item.reportCount ?? 0}
          showFreeze={!item.isDeleted}
          isFrozen={item.isFrozen}
          isDeleted={item.isDeleted}
          hasActiveAppeal={Boolean(item.hasActiveAppeal)}
          entityLabel={
            activeTab === "appeals"
              ? item.entityType === "COMMENT"
                ? "Comment"
                : "Content"
              : view === "comments"
                ? "Comment"
                : "Content"
          }
          disabled={isPending}
          sectionId={activeTab}
          onMutated={
            activeTab === "appeals"
              ? (info) => onAppealMutated(item.entityId || item.id, info)
              : undefined
          }
        />
      )}
    </div>
  );
}
/* ---------------------------------------------------------------------------
 * Column builders
 * ------------------------------------------------------------------------- */

/** Non-appeals / non-users content tables (Posts & Comments). */
export function buildContentColumns(
  ctx: AdminColumnsCtx,
): AdminColumn<AdminContentItem>[] {
  const { view } = ctx;
  return [
    {
      key: "title",
      header: view === "comments" ? "Comment" : "Title",
      render: renderTitle,
    },
    {
      key: "author",
      header: "Author",
      cellClassName: "text-slate-600 dark:text-slate-400",
      render: (item) => item.author?.name || item.author?.email || "Unknown",
    },
    { key: "reports", header: "Reports", render: renderReports },
    { key: "appealed", header: "Appealed", render: renderAppealed },
    {
      key: "status",
      header: "Status",
      render: (item) => renderStatusBadges(item, ctx),
    },
    {
      key: "actions",
      header: "Actions",
      render: (item) => renderActions(item, ctx),
    },
  ];
}

/** Administrator tables (Name / Email / ...). */
export function buildUsersColumns(
  ctx: AdminColumnsCtx,
): AdminColumn<AdminContentItem>[] {
  return [
    {
      key: "name",
      header: "Name",
      render: (item) => (
        <p className="font-medium text-slate-900 dark:text-slate-100">
          {item.name}
        </p>
      ),
    },
    {
      key: "email",
      header: "Email",
      cellClassName: "text-slate-600 dark:text-slate-400",
      render: (item) => item.email,
    },
    { key: "reports", header: "Reports", render: renderReports },
    { key: "appealed", header: "Appealed", render: renderAppealed },
    {
      key: "status",
      header: "Status",
      render: (item) => renderStatusBadges(item, ctx),
    },
    {
      key: "actions",
      header: "Actions",
      render: (item) => renderActions(item, ctx),
    },
  ];
}

/** Appeals table – 6 columns incl. Admin Status and Entity Status. */
export function buildAppealsColumns(
  ctx: AdminColumnsCtx,
): AdminColumn<AdminContentItem>[] {
  return [
    { key: "entity", header: "Entity", render: renderTitle },
    {
      key: "module",
      header: "Module",
      cellClassName: "text-slate-600 dark:text-slate-400",
      render: (item) => getModuleLabel(item.contentType || ""),
    },
    {
      key: "owner",
      header: "Owner",
      cellClassName: "text-slate-600 dark:text-slate-400",
      render: (item) => item.owner?.name || item.owner?.email || "Unknown",
    },
    {
      key: "adminStatus",
      header: "Admin Status",
      render: (item) => (
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
      ),
    },
    {
      key: "reason",
      header: "Reason",
      render: (item) => (
        <span
          className="max-w-[240px] truncate text-sm text-slate-600 dark:text-slate-400"
          title={item.appealReason ?? undefined}
        >
          {typeof item.category === "string"
            ? `${item.category.replaceAll("_", " ")}: `
            : ""}
          {item.appealReason || "—"}
        </span>
      ),
    },
    {
      key: "entityStatus",
      header: "Entity Status",
      render: (item) => (
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
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (item) => renderActions(item, ctx),
    },
  ];
}