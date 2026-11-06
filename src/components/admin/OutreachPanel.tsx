"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  listOutreachContacts,
  type OutreachContactItem,
} from "@/app/actions/outreach";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { Button } from "@/components/ui/button";
import { OutreachForm } from "@/components/admin/OutreachForm";
import { OutreachImport } from "@/components/admin/OutreachImport";
import { OutreachActionsDropdown } from "@/components/admin/OutreachActionsDropdown";
import { AdminInviteScholarForm } from "@/components/admin/AdminInviteScholarForm";
import { Mail, CheckCircle2, XCircle, AlertCircle, Edit3 } from "lucide-react";
import { ADMIN_PAGE_SIZE } from "@/lib/constants";
import { outreachQueryKey } from "@/utils/outreach-cache";

type OutreachRow = OutreachContactItem;
type OutreachView = "contacts" | "compose";

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

export function OutreachPanel() {
  const [view, setView] = useState<OutreachView>("contacts");
  const [page, setPage] = useState(1);

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
  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage === page) return;
    if (data && nextPage > data.totalPages) return;
    setPage(nextPage);
  };

  // A new contact always lands at the top of page 1, so jump there after an
  // add or import instead of leaving the admin on an unchanged page.
  const showFirstPage = () => setPage(1);

  const columns = [
    {
      key: "name",
      header: "Name",
      render: (item: OutreachRow) => (
        <div className="font-medium text-slate-900 dark:text-slate-100">
          {item.name}
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

  const items = data?.items ?? [];

  const tabClass = (active: OutreachView, v: OutreachView) =>
    active === v
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
            className={`flex-1 rounded-none border-none bg-transparent px-3 py-2 text-xs font-semibold transition ${tabClass(view, "contacts")}`}
          >
            <Mail className="mr-1.5 h-3.5 w-3.5" />
            Contacts
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => setView("compose")}
            className={`flex-1 rounded-none border-none bg-transparent px-3 py-2 text-xs font-semibold transition ${tabClass(view, "compose")}`}
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
        </>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-sm overflow-hidden">
          <AdminInviteScholarForm />
        </div>
      )}
    </div>
  );
}
