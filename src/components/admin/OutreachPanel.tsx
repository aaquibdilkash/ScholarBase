"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listOutreachContacts,
  sendOutreachBatch,
  type OutreachContactItem,
} from "@/app/actions/outreach";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { Button } from "@/components/ui/button";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { useToast } from "@/components/ui/Toast";
import { OutreachForm } from "@/components/admin/OutreachForm";
import { OutreachImport } from "@/components/admin/OutreachImport";
import { OutreachActionsDropdown } from "@/components/admin/OutreachActionsDropdown";
import { AdminInviteScholarForm } from "@/components/admin/AdminInviteScholarForm";
import {
  Mail,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Edit3,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { ADMIN_PAGE_SIZE, MAX_OUTREACH_BATCH_SIZE } from "@/lib/constants";
import {
  OUTREACH_QUERY_KEY,
  outreachQueryKey,
  patchOutreachContactsInList,
  type OutreachListData,
} from "@/utils/outreach-cache";

type OutreachRow = OutreachContactItem;
type OutreachView = "contacts" | "compose";
type OutreachSendMode = "send" | "resend";

function statusLabel(status: string): string {
  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function statusIcon(status: string): React.ReactNode {
  switch (status) {
    case "PENDING":
      return <Mail className="h-3.5 w-3.5 text-slate-400" />;
    case "OUTREACHED":
      return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
    case "BOUNCED":
      return <XCircle className="h-3.5 w-3.5 text-rose-500" />;
    case "REPLIED":
      return <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />;
    case "UNSUBSCRIBED":
      return <AlertCircle className="h-3.5 w-3.5 text-amber-500" />;
    default:
      return <Mail className="h-3.5 w-3.5 text-slate-400" />;
  }
}

function statusStyle(status: string): string {
  switch (status) {
    case "PENDING":
      return "bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-400";
    case "OUTREACHED":
      return "bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-900/30 dark:text-emerald-300";
    case "BOUNCED":
      return "bg-rose-50 border-rose-100 text-rose-700 dark:bg-rose-900/20 dark:border-rose-900/30 dark:text-rose-300";
    case "REPLIED":
      return "bg-blue-50 border-blue-100 text-blue-700 dark:bg-blue-900/20 dark:border-blue-900/30 dark:text-blue-300";
    case "UNSUBSCRIBED":
      return "bg-amber-50 border-amber-100 text-amber-700 dark:bg-amber-900/20 dark:border-amber-900/30 dark:text-amber-300";
    default:
      return "bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-400";
  }
}

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** A row can join the current batch only if its status fits the mode. */
function isBatchSelectable(
  item: OutreachContactItem,
  mode: OutreachSendMode,
): boolean {
  return mode === "send"
    ? item.status === "PENDING"
    : item.status !== "PENDING" && item.status !== "UNSUBSCRIBED";
}

function unselectableReason(
  item: OutreachContactItem,
  mode: OutreachSendMode,
): string {
  if (item.status === "UNSUBSCRIBED") {
    return "This email has opted out of outreach.";
  }

  return mode === "send"
    ? "Only pending contacts can be selected for a send."
    : "Only already-contacted contacts can be selected for a resend.";
}

const checkboxClassName =
  "h-4 w-4 cursor-pointer rounded border-slate-300 accent-blue-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600";

export function OutreachPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [view, setView] = useState<OutreachView>("contacts");
  const [page, setPage] = useState(1);
  const [sendMode, setSendMode] = useState<OutreachSendMode>("send");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);

  const query = useQuery({
    queryKey: outreachQueryKey(page),
    queryFn: () =>
      listOutreachContacts({
        page,
        pageSize: ADMIN_PAGE_SIZE,
        status: "all",
        search: "",
      }),
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
    // Keep the current page on screen while the next one loads, like the
    // other admin tables.
    placeholderData: keepPreviousData,
  });

  const data = query.data;
  const pageKey = outreachQueryKey(page);

  const batchSendMutation = useMutation({
    mutationFn: async (contactIds: string[]) => {
      const result = await sendOutreachBatch({
        contactIds,
        resend: sendMode === "resend",
      });
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onMutate: async (contactIds) => {
      await queryClient.cancelQueries({ queryKey: pageKey });
      const previous = queryClient.getQueryData<OutreachListData>(pageKey);
      const now = new Date();

      queryClient.setQueryData<OutreachListData>(pageKey, (old) =>
        patchOutreachContactsInList(old, contactIds, (item) => ({
          status: "OUTREACHED",
          sendCount: item.sendCount + 1,
          emailSentAt: now,
          outreachedAt: now,
        })),
      );

      return { previous };
    },
    onSuccess: (summary) => {
      const parts = [`${summary.sent} email${summary.sent === 1 ? "" : "s"} sent`];
      if (summary.skipped > 0) parts.push(`${summary.skipped} skipped`);
      if (summary.failed > 0) parts.push(`${summary.failed} failed`);

      toast(
        `${parts.join(", ")}.`,
        summary.failed > 0 ? "error" : "success",
      );
      setSelectedIds(new Set());
      setConfirmSendOpen(false);
      void queryClient.invalidateQueries({ queryKey: OUTREACH_QUERY_KEY });
    },
    onError: (error: Error, _contactIds, context) => {
      queryClient.setQueryData<OutreachListData>(pageKey, context?.previous);
      toast(
        error.message || "Failed to send emails. Please try again.",
        "error",
      );
      void queryClient.invalidateQueries({ queryKey: OUTREACH_QUERY_KEY });
    },
    onSettled: () => {
      setConfirmSendOpen(false);
    },
  });

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage === page) return;
    if (data && nextPage > data.totalPages) return;
    setSelectedIds(new Set());
    setPage(nextPage);
  };

  // A new contact always lands at the top of page 1, so jump there after an
  // add or import instead of leaving the admin on an unchanged page.
  const showFirstPage = () => setPage(1);

  const items = data?.items ?? [];

  const selectableItems = items.filter((item) =>
    isBatchSelectable(item, sendMode),
  );
  const selectedItems = items.filter(
    (item) => selectedIds.has(item.id) && isBatchSelectable(item, sendMode),
  );
  const selectedCount = selectedItems.length;
  const allSelected =
    selectableItems.length > 0 && selectedCount === selectableItems.length;

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      if (next.size >= MAX_OUTREACH_BATCH_SIZE) return current;
      next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(
      allSelected ? new Set() : new Set(selectableItems.map((item) => item.id)),
    );
  };

  const changeSendMode = (mode: OutreachSendMode) => {
    if (mode === sendMode) return;
    setSendMode(mode);
    setSelectedIds(new Set());
    setConfirmSendOpen(false);
  };

  const columns = [
    {
      key: "select",
      header: (
        <input
          type="checkbox"
          aria-label={
            allSelected
              ? "Clear selection"
              : sendMode === "send"
                ? "Select all pending contacts on this page"
                : "Select all contacted contacts on this page"
          }
          checked={allSelected}
          disabled={selectableItems.length === 0 || batchSendMutation.isPending}
          ref={(node) => {
            if (node) node.indeterminate = selectedCount > 0 && !allSelected;
          }}
          onChange={toggleSelectAll}
          className={checkboxClassName}
        />
      ),
      render: (item: OutreachRow) => {
        const selectable = isBatchSelectable(item, sendMode);

        return (
          <input
            type="checkbox"
            aria-label={`Select ${item.name || item.email}`}
            checked={selectable && selectedIds.has(item.id)}
            disabled={!selectable || batchSendMutation.isPending}
            title={selectable ? undefined : unselectableReason(item, sendMode)}
            onChange={() => toggleSelected(item.id)}
            className={checkboxClassName}
          />
        );
      },
      cellClassName: "w-10",
    },
    {
      key: "name",
      header: "Name",
      render: (item: OutreachRow) => (
        <div className="font-medium text-slate-900 dark:text-slate-100">
          {item.name || "—"}
        </div>
      ),
    },
    {
      key: "email",
      header: "Email",
      render: (item: OutreachRow) => (
        <div className="text-slate-900 dark:text-slate-100 truncate max-w-[200px]">
          {item.email}
        </div>
      ),
      cellClassName: "max-w-[200px]",
    },
    {
      key: "institution",
      header: "Institution",
      render: (item: OutreachRow) => (
        <div className="text-slate-500 dark:text-slate-400 truncate max-w-[150px]">
          {item.institution ?? "—"}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item: OutreachRow) => (
        <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-0.5 text-xs font-semibold ${statusStyle(item.status)}`}>
          {statusIcon(item.status)}
          {statusLabel(item.status)}
        </span>
      ),
      cellClassName: "w-40",
    },
    {
      key: "sentAt",
      header: "Sent At",
      render: (item: OutreachRow) => (
        <div className="text-slate-500 dark:text-slate-400 text-xs">
          {formatDate(item.emailSentAt)}
        </div>
      ),
    },
    {
      key: "sendCount",
      header: "Sends",
      render: (item: OutreachRow) => (
        <div className="text-slate-900 dark:text-slate-100 font-mono text-xs">
          {item.sendCount}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (item: OutreachRow) => (
        <OutreachActionsDropdown contact={item} page={page} />
      ),
      cellClassName: "w-24",
    },
  ] as const;

  const segmentClass = (active: boolean) =>
    active
      ? "bg-white text-blue-700 shadow-sm dark:bg-slate-900 dark:text-blue-300"
      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100";

  return (
    <div className="space-y-6">
      {/* Tab switch: Contacts vs Compose */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800/50 sm:max-w-[360px]">
        <div className="flex">
          <Button
            type="button"
            size="sm"
            onClick={() => setView("contacts")}
            className={`flex-1 rounded-none border-none bg-transparent px-3 py-2 text-xs font-semibold transition ${segmentClass(view === "contacts")}`}
          >
            <Mail className="mr-1.5 h-3.5 w-3.5" />
            Contacts
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => setView("compose")}
            className={`flex-1 rounded-none border-none bg-transparent px-3 py-2 text-xs font-semibold transition ${segmentClass(view === "compose")}`}
          >
            <Edit3 className="mr-1.5 h-3.5 w-3.5" />
            Compose
          </Button>
        </div>
      </div>

      {view === "contacts" ? (
        <>
          <div className="grid gap-6 sm:grid-cols-3 lg:grid-cols-4">
            <div className="col-span-3 sm:col-span-2">
              <OutreachForm onCreated={showFirstPage} />
            </div>
            <div className="col-span-3 sm:col-span-1">
              <OutreachImport onCreated={showFirstPage} />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800/50">
                  <button
                    type="button"
                    onClick={() => changeSendMode("send")}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${segmentClass(sendMode === "send")}`}
                  >
                    Send
                  </button>
                  <button
                    type="button"
                    onClick={() => changeSendMode("resend")}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${segmentClass(sendMode === "resend")}`}
                  >
                    Resend
                  </button>
                </div>
                <span
                  className="text-xs text-slate-500 dark:text-slate-400"
                  role="status"
                >
                  {selectedCount > 0
                    ? `${selectedCount} selected`
                    : sendMode === "send"
                      ? "Select pending contacts to send"
                      : "Select contacted contacts to resend"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {selectedCount > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedIds(new Set())}
                    disabled={batchSendMutation.isPending}
                  >
                    Clear
                  </Button>
                )}
                <button
                  type="button"
                  disabled={
                    selectedCount === 0 ||
                    selectedCount > MAX_OUTREACH_BATCH_SIZE ||
                    batchSendMutation.isPending
                  }
                  onClick={() => setConfirmSendOpen(true)}
                  className="sb-button-primary gap-2 text-xs disabled:opacity-60"
                >
                  {batchSendMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : sendMode === "send" ? (
                    <Mail className="h-3.5 w-3.5" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  {sendMode === "send" ? "Send selected" : "Resend selected"}
                </button>
              </div>
            </div>

            <AdminTable
              columns={columns as never}
              rows={items as never}
              rowKey={(item: OutreachRow) => item.id}
              emptyMessage="No outreach contacts yet. Add your first contact above."
            />
            {data && data.totalPages > 1 && (
              <AdminPagination
                page={data.page}
                total={data.total}
                totalPages={data.totalPages}
                itemsCount={items.length}
                isPending={query.isFetching}
                onPageChange={handlePageChange}
              />
            )}
          </div>

          {confirmSendOpen && (
            <ConfirmationModal
              isOpen
              onClose={() => {
                if (!batchSendMutation.isPending) setConfirmSendOpen(false);
              }}
              onConfirm={() =>
                batchSendMutation.mutate(
                  selectedItems.map((item) => item.id),
                )
              }
              title={
                sendMode === "send"
                  ? "Send outreach emails?"
                  : "Resend outreach emails?"
              }
              message={
                sendMode === "send"
                  ? `${selectedCount} selected contact${selectedCount === 1 ? "" : "s"} will receive the outreach email. Each recipient gets a different template from the library.`
                  : `Another email will be sent to ${selectedCount} selected contact${selectedCount === 1 ? "" : "s"}, each using a different template from the library.`
              }
              isConfirming={batchSendMutation.isPending}
              confirmLabel={
                sendMode === "send" ? "Send emails" : "Resend emails"
              }
              confirmingLabel="Sending…"
              confirmVariant="default"
              confirmClassName="sb-button-primary"
            />
          )}
        </>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-sm overflow-hidden">
          <AdminInviteScholarForm />
        </div>
      )}
    </div>
  );
}
