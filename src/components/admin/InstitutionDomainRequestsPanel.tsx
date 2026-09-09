"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import {
  getAdminInstitutionDomainRequests,
  reviewInstitutionDomainRequest,
} from "@/app/actions/admin";
import { AdminPagination } from "@/components/admin/AdminPagination";
import type {
  AdminPage,
  InstitutionDomainRequestItem,
} from "@/types/admin";

type RequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "ALL";

export function InstitutionDomainRequestsPanel({
  initialData,
}: {
  initialData: AdminPage<InstitutionDomainRequestItem>;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [status, setStatus] = useState<RequestStatus>("PENDING");
  const [page, setPage] = useState(1);
  const [, startTransition] = useTransition();

  const queryKey = ["admin-institution-domain-requests", status, page] as const;
  const query = useQuery({
    queryKey,
    queryFn: () => getAdminInstitutionDomainRequests(page, status),
    initialData: status === "PENDING" && page === 1 ? initialData : undefined,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
  });

  const data = query.data ?? initialData;
  const [optimisticItems, applyOptimistic] = useOptimistic(
    data.items,
    (items, update: { id: string; status: "APPROVED" | "REJECTED" }) =>
      items.map((item) =>
        item.id === update.id ? { ...item, status: update.status } : item,
      ),
  );

  const reviewMutation = useMutation({
    mutationFn: ({ id, nextStatus }: { id: string; nextStatus: "APPROVED" | "REJECTED" }) =>
      reviewInstitutionDomainRequest(id, nextStatus),
    onSuccess: (result, variables) => {
      queryClient.setQueryData<AdminPage<InstitutionDomainRequestItem>>(
        queryKey,
        (current) => {
          if (!current) return current;
          const shouldRemove = status !== "ALL" && status !== variables.nextStatus;
          const items = shouldRemove
            ? current.items.filter((item) => item.id !== variables.id)
            : current.items.map((item) =>
                item.id === variables.id ? result.data : item,
              );
          return {
            ...current,
            items,
            total: shouldRemove ? Math.max(0, current.total - 1) : current.total,
            totalPages: Math.max(1, Math.ceil((shouldRemove ? current.total - 1 : current.total) / current.pageSize)),
          };
        },
      );
      toast(
        variables.nextStatus === "APPROVED"
          ? "Request approved. Add the domain to the code allowlist and deploy."
          : "Request rejected.",
        "success",
      );
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey });
      toast("Could not update the institution request.", "error");
    },
  });

  const review = (id: string, nextStatus: "APPROVED" | "REJECTED") => {
    startTransition(() => applyOptimistic({ id, status: nextStatus }));
    reviewMutation.mutate({ id, nextStatus });
  };

  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-800 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Institution domain requests
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Approved domains become active after they are added to the code allowlist and deployed.
          </p>
        </div>
        <label className="sr-only" htmlFor="institution-request-status">
          Filter institution requests
        </label>
        <select
          id="institution-request-status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as RequestStatus);
            setPage(1);
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
        >
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="ALL">All</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Institution</th>
              <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Domain</th>
              <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Requester</th>
              <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Evidence</th>
              <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Status</th>
              <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {query.isPending ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center">
                  <Loader2 className="inline-block h-6 w-6 animate-spin text-slate-400" />
                </td>
              </tr>
            ) : optimisticItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                  No institution requests found.
                </td>
              </tr>
            ) : (
              optimisticItems.map((item) => (
                <tr key={item.id} className="align-top hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                    {item.institutionName}
                    {item.details && (
                      <p className="mt-1 max-w-xs text-xs font-normal text-slate-500 dark:text-slate-400">
                        {item.details}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">{item.domain}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{item.requesterEmail}</td>
                  <td className="px-4 py-3">
                    {item.website ? (
                      <a
                        href={`/api/outbound?url=${encodeURIComponent(item.website)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-700 hover:underline dark:text-blue-300"
                      >
                        Website
                      </a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {item.status === "PENDING" ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => review(item.id, "APPROVED")}
                          disabled={reviewMutation.isPending}
                          className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => review(item.id, "REJECTED")}
                          disabled={reviewMutation.isPending}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {item.reviewNote || "Reviewed"}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data.totalPages > 1 && (
        <AdminPagination
          page={data.page}
          total={data.total}
          totalPages={data.totalPages}
          itemsCount={data.items.length}
          isPending={query.isPending || reviewMutation.isPending}
          onPageChange={setPage}
        />
      )}
    </section>
  );
}
