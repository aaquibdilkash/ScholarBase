"use client";
import { Select } from "@/components/ui/Select";

import { useOptimistic, useState, useTransition } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { SafeEmailLink, SafeExternalLink } from "@/components/ui/SafeExternalLink";
import {
  getAdminInstitutionDomainRequests,
  getAdminInstitutionDomains,
  reviewInstitutionDomainRequest,
  type InstitutionDomainStatusFilter,
} from "@/app/actions/admin";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminTable, type AdminColumn } from "@/components/admin/AdminTable";
import { InstitutionDomainActionsDropdown } from "@/components/admin/InstitutionDomainActionsDropdown";
import { formatDate } from "@/utils/date";
import type {
  AdminPage,
  InstitutionDomainItem,
  InstitutionDomainRequestItem,
} from "@/types/admin";

type PanelTab = "requests" | "domains";
type RequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "ALL";

const EMPTY_REQUEST_PAGE: AdminPage<InstitutionDomainRequestItem> = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 10,
  totalPages: 0,
};

const EMPTY_DOMAIN_PAGE: AdminPage<InstitutionDomainItem> = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 10,
  totalPages: 0,
};

const selectClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300";

function statusBadge(isActive: boolean) {
  return isActive
    ? "bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-900/30 dark:text-emerald-300"
    : "bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-400";
}

function domainStatusLabel(isActive: boolean) {
  return isActive ? "Active" : "Inactive";
}

const requestColumns = (
  onReview: (id: string, nextStatus: "APPROVED" | "REJECTED") => void,
  isReviewing: boolean,
): AdminColumn<InstitutionDomainRequestItem>[] => [
  {
    key: "institution",
    header: "Institution",
    render: (item) => (
      <>
        <div className="font-medium text-slate-900 dark:text-slate-100">
          {item.institutionName}
        </div>
        {item.details && (
          <p className="mt-1 max-w-xs text-xs font-normal text-slate-500 dark:text-slate-400">
            {item.details}
          </p>
        )}
      </>
    ),
  },
  {
    key: "domain",
    header: "Domain",
    render: (item) => (
      <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
        {item.domain}
      </span>
    ),
  },
  {
    key: "requester",
    header: "Requester",
    render: (item) => (
      <div className="text-slate-600 dark:text-slate-400">
        <SafeEmailLink email={item.requesterEmail} />
      </div>
    ),
  },
  {
    key: "evidence",
    header: "Evidence",
    render: (item) => (
      <SafeExternalLink
        url={item.website}
        fallback={<span className="text-slate-400">—</span>}
        className="text-blue-700 hover:underline dark:text-blue-300"
      >
        Website
      </SafeExternalLink>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (item) => (
      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
        {item.status}
      </span>
    ),
  },
  {
    key: "actions",
    header: "Actions",
    render: (item) =>
      item.status === "PENDING" ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onReview(item.id, "APPROVED")}
            disabled={isReviewing}
            className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={() => onReview(item.id, "REJECTED")}
            disabled={isReviewing}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      ) : (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {item.reviewNote || "Reviewed"}
        </span>
      ),
  },
];

function domainColumns(
  queryKey: readonly unknown[],
  status: InstitutionDomainStatusFilter,
): AdminColumn<InstitutionDomainItem>[] {
  return [
    {
      key: "domain",
      header: "Domain",
      render: (item) => (
        <div className="max-w-[200px] truncate font-medium text-slate-900 dark:text-slate-100">
          {item.domain}
        </div>
      ),
      cellClassName: "max-w-[200px]",
    },
    {
      key: "name",
      header: "Institution",
      render: (item) => (
        <div className="max-w-[180px] truncate text-slate-900 dark:text-slate-100">
          {item.name}
        </div>
      ),
      cellClassName: "max-w-[180px]",
    },
    {
      key: "status",
      header: "Status",
      render: (item) => (
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-0.5 text-xs font-semibold ${statusBadge(item.isActive)}`}
        >
          {domainStatusLabel(item.isActive)}
        </span>
      ),
      cellClassName: "w-32",
    },
    {
      key: "approvedAt",
      header: "Approved At",
      render: (item) => (
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {formatDate(item.approvedAt) || "—"}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (item) => (
        <InstitutionDomainActionsDropdown
          domain={item}
          queryKey={queryKey}
          status={status}
        />
      ),
      cellClassName: "w-24",
    },
  ];
}

export function InstitutionDomainAdminPanel({
  initialData,
}: {
  initialData?: AdminPage<InstitutionDomainRequestItem>;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, startTransition] = useTransition();

  const [tab, setTab] = useState<PanelTab>("requests");
  const [requestStatus, setRequestStatus] = useState<RequestStatus>("PENDING");
  const [requestPage, setRequestPage] = useState(1);
  const [domainStatus, setDomainStatus] =
    useState<InstitutionDomainStatusFilter>("ALL");
  const [domainPage, setDomainPage] = useState(1);

  const requestQueryKey = [
    "admin-institution-domain-requests",
    requestStatus,
    requestPage,
  ] as const;
  const requestQuery = useQuery({
    queryKey: requestQueryKey,
    queryFn: () =>
      getAdminInstitutionDomainRequests(requestPage, requestStatus),
    initialData:
      requestStatus === "PENDING" && requestPage === 1 ? initialData : undefined,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    enabled: tab === "requests",
  });

  const domainQueryKey = [
    "admin-institution-domains",
    domainStatus,
    domainPage,
  ] as const;
  const domainQuery = useQuery({
    queryKey: domainQueryKey,
    queryFn: () => getAdminInstitutionDomains(domainPage, domainStatus),
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
    enabled: tab === "domains",
  });

  const requestData = requestQuery.data ?? initialData ?? EMPTY_REQUEST_PAGE;
  const domainData = domainQuery.data ?? EMPTY_DOMAIN_PAGE;

  const [optimisticRequests, applyRequestOptimistic] = useOptimistic(
    requestData.items,
    (items, update: { id: string; status: "APPROVED" | "REJECTED" }) =>
      items.map((item) =>
        item.id === update.id ? { ...item, status: update.status } : item,
      ),
  );

  const reviewMutation = useMutation({
    mutationFn: ({
      id,
      nextStatus,
    }: {
      id: string;
      nextStatus: "APPROVED" | "REJECTED";
    }) => reviewInstitutionDomainRequest(id, nextStatus),
    onSuccess: (result, variables) => {
      queryClient.setQueryData<AdminPage<InstitutionDomainRequestItem>>(
        requestQueryKey,
        (current) => {
          if (!current) return current;
          const shouldRemove =
            requestStatus !== "ALL" && requestStatus !== variables.nextStatus;
          const items = shouldRemove
            ? current.items.filter((item) => item.id !== variables.id)
            : current.items.map((item) =>
                item.id === variables.id ? result.data : item,
              );
          const total = shouldRemove
            ? Math.max(0, current.total - 1)
            : current.total;
          return {
            ...current,
            items,
            total,
            totalPages: Math.max(1, Math.ceil(total / current.pageSize)),
          };
        },
      );
      // Approval upserts the domain into InstitutionDomain — refresh the
      // Approved Domains tab so it appears without a manual reload.
      void queryClient.invalidateQueries({
        queryKey: ["admin-institution-domains"],
      });
      toast(
        variables.nextStatus === "APPROVED"
          ? "Request approved. The domain is now active for signups."
          : "Request rejected.",
        "success",
      );
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: requestQueryKey });
      toast("Could not update the institution request.", "error");
    },
  });

  const review = (id: string, nextStatus: "APPROVED" | "REJECTED") => {
    startTransition(() => applyRequestOptimistic({ id, status: nextStatus }));
    reviewMutation.mutate({ id, nextStatus });
  };

  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-800 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Institution Domains
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Review domain requests and manage the domains that grant the
            institutional badge.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="Institution domain views"
            className="inline-flex rounded-lg border border-slate-300 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800"
          >
            {(["requests", "domains"] as PanelTab[]).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  tab === value
                    ? "bg-white text-blue-700 shadow-sm dark:bg-slate-900 dark:text-blue-300"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                {value === "requests" ? "Requests" : "Approved Domains"}
              </button>
            ))}
          </div>

          {tab === "requests" ? (
            <>
              <label className="sr-only" htmlFor="institution-request-status">
                Filter institution requests
              </label>
              <Select
                id="institution-request-status"
                value={requestStatus}
                onChange={(event) => {
                  setRequestStatus(event.target.value as RequestStatus);
                  setRequestPage(1);
                }}
                className={selectClass}
              >
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="ALL">All</option>
              </Select>
            </>
          ) : (
            <>
              <label className="sr-only" htmlFor="institution-domain-status">
                Filter approved institution domains
              </label>
              <Select
                id="institution-domain-status"
                value={domainStatus}
                onChange={(event) => {
                  setDomainStatus(
                    event.target.value as InstitutionDomainStatusFilter,
                  );
                  setDomainPage(1);
                }}
                className={selectClass}
              >
                <option value="ALL">All</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </Select>
            </>
          )}
        </div>
      </div>

      {tab === "requests" ? (
        <div role="tabpanel" aria-label="Institution requests">
          {requestQuery.isPending ? (
            <div className="px-4 py-8 text-center">
              <Loader2 className="inline-block h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <AdminTable
              columns={requestColumns(review, reviewMutation.isPending)}
              rows={optimisticRequests}
              rowKey={(item) => item.id}
              emptyMessage="No institution requests found."
            />
          )}

          {requestData.totalPages > 1 && (
            <AdminPagination
              page={requestData.page}
              total={requestData.total}
              totalPages={requestData.totalPages}
              itemsCount={requestData.items.length}
              isPending={requestQuery.isPending || reviewMutation.isPending}
              onPageChange={setRequestPage}
            />
          )}
        </div>
      ) : (
        <div role="tabpanel" aria-label="Approved institution domains">
          {domainQuery.isPending ? (
            <div className="px-4 py-8 text-center">
              <Loader2 className="inline-block h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <AdminTable
              columns={domainColumns(domainQueryKey, domainStatus)}
              rows={domainData.items}
              rowKey={(item) => item.id}
              emptyMessage={
                domainStatus === "ALL"
                  ? "No approved institution domains yet. Approve a request to add one."
                  : `No ${domainStatus.toLowerCase()} institution domains.`
              }
            />
          )}

          {domainData.totalPages > 1 && (
            <AdminPagination
              page={domainData.page}
              total={domainData.total}
              totalPages={domainData.totalPages}
              itemsCount={domainData.items.length}
              isPending={domainQuery.isPending}
              onPageChange={setDomainPage}
            />
          )}
        </div>
      )}
    </section>
  );
}
