"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import {
  getAdminInstitutionDomains,
  toggleInstitutionDomainActive,
  deleteInstitutionDomain,
} from "@/app/actions/admin";
import type { InstitutionDomainItem } from "@/types/admin";
import { AdminTable } from "@/components/admin/AdminTable";
import { Button } from "@/components/ui/button";
import {
  ToggleRight,
  ToggleLeft,
  Trash2,
  Loader2,
} from "lucide-react";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";

type DomainRow = InstitutionDomainItem;

function statusBadge(isActive: boolean) {
  return isActive
    ? "bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-900/30 dark:text-emerald-300"
    : "bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-400";
}

function statusLabel(isActive: boolean) {
  return isActive ? "Active" : "Inactive";
}

function statusIcon(isActive: boolean) {
  return isActive ? (
    <ToggleRight className="h-3.5 w-3.5 text-emerald-500" />
  ) : (
    <ToggleLeft className="h-3.5 w-3.5 text-slate-400" />
  );
}

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function InstitutionDomainsPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["admin-institution-domains"],
    queryFn: async () => {
      const result = await getAdminInstitutionDomains(1, 100);
      return result;
    },
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
  });

  const data = query.data;
  const items = data?.items ?? [];

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      toggleInstitutionDomainActive(id, isActive),
    onMutate: async ({ id, isActive }) => {
      await queryClient.cancelQueries({ queryKey: ["admin-institution-domains"] });
      const previous = queryClient.getQueryData<{ items: DomainRow[] }>([
        "admin-institution-domains",
      ]);

      queryClient.setQueryData<{ items: DomainRow[] } | undefined>(
        ["admin-institution-domains"],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((item) =>
              item.id === id ? { ...item, isActive } : item,
            ),
          };
        },
      );

      return { previous };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-institution-domains"] });
    },
    onError: (_error, _vars, context) => {
      queryClient.setQueryData(["admin-institution-domains"], context?.previous);
      toast("Failed to update domain.", "error");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteInstitutionDomain(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["admin-institution-domains"] });
      const previous = queryClient.getQueryData<{ items: DomainRow[] }>([
        "admin-institution-domains",
      ]);

      queryClient.setQueryData<{ items: DomainRow[] } | undefined>(
        ["admin-institution-domains"],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.filter((item) => item.id !== id),
          };
        },
      );

      return { previous };
    },
    onSuccess: () => {
      toast("Domain removed.", "success");
      queryClient.invalidateQueries({ queryKey: ["admin-institution-domains"] });
    },
    onError: (_error, _vars, context) => {
      queryClient.setQueryData(["admin-institution-domains"], context?.previous);
      toast("Failed to remove domain.", "error");
    },
    onSettled: () => {
      setDeletingId(null);
      setConfirmOpen(false);
      setConfirmId(null);
    },
  });

  const handleToggle = (id: string, currentIsActive: boolean) => {
    toggleMutation.mutate({ id, isActive: !currentIsActive });
  };

  const handleDelete = () => {
    if (!confirmId) return;
    deleteMutation.mutate(confirmId);
  };

  const columns = [
    {
      key: "domain",
      header: "Domain",
      render: (item: DomainRow) => (
        <div className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-[200px]">
          {item.domain}
        </div>
      ),
      cellClassName: "max-w-[200px]",
    },
    {
      key: "name",
      header: "Institution",
      render: (item: DomainRow) => (
        <div className="text-slate-900 dark:text-slate-100 truncate max-w-[180px]">
          {item.name}
        </div>
      ),
      cellClassName: "max-w-[180px]",
    },
    {
      key: "status",
      header: "Status",
      render: (item: DomainRow) => (
        <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-0.5 text-xs font-semibold ${statusBadge(item.isActive)}`}>
          {statusIcon(item.isActive)}
          {statusLabel(item.isActive)}
        </span>
      ),
      cellClassName: "w-32",
    },
    {
      key: "approvedAt",
      header: "Approved At",
      render: (item: DomainRow) => (
        <div className="text-slate-500 dark:text-slate-400 text-xs">
          {formatDate(item.approvedAt)}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (item: DomainRow) => (
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void handleToggle(item.id, item.isActive)}
            disabled={deletingId === item.id}
            className="h-8 px-2 text-[11px] gap-1.5"
          >
            {item.isActive ? "Deactivate" : "Activate"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={deletingId === item.id}
            onClick={() => {
              setConfirmId(item.id);
              setConfirmOpen(true);
            }}
            className="h-8 p-1.5 text-[11px] text-slate-500 hover:text-rose-500"
            aria-label="Delete domain"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
      cellClassName: "w-40",
    },
  ] as const;

  const isLoading = toggleMutation.isPending || deleteMutation.isPending || query.isFetching;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-sm overflow-hidden">
        <AdminTable
          columns={columns as never}
          rows={items as never}
          rowKey={(item: DomainRow) => item.id}
          emptyMessage="No approved institution domains yet. Approve a domain request in the Institution Requests tab to add one."
        />
        <div className="border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
          <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
            <span>
              {items.length} domain{items.length !== 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-2">
              {isLoading && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={confirmOpen}
        onClose={() => {
          setConfirmOpen(false);
          setConfirmId(null);
        }}
        onConfirm={handleDelete}
        title="Remove approved domain?"
        message="Users from this domain will no longer be able to sign up with the institutional badge. This cannot be undone."
        isConfirming={deletingId === confirmId}
        confirmLabel="Remove domain"
        confirmingLabel="Removing..."
        confirmVariant="destructive"
      />
    </div>
  );
}
