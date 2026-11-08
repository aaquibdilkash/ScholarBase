"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  MoreHorizontal,
  ToggleLeft,
  ToggleRight,
  Trash2,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import {
  deleteInstitutionDomain,
  toggleInstitutionDomainActive,
  type InstitutionDomainStatusFilter,
} from "@/app/actions/admin";
import type { AdminPage, InstitutionDomainItem } from "@/types/admin";

/**
 * Patch one cached domain page: flip `isActive`, or drop the row when the new
 * state no longer matches the active filter. Totals are recounted so the pager
 * stays truthful without a refetch.
 */
function patchDomainPage(
  current: AdminPage<InstitutionDomainItem> | undefined,
  id: string,
  update: { isActive?: boolean; remove?: boolean },
  status: InstitutionDomainStatusFilter,
): AdminPage<InstitutionDomainItem> | undefined {
  if (!current) return current;

  const stillMatches =
    status === "ALL" ||
    (status === "ACTIVE" ? update.isActive === true : update.isActive === false);
  const shouldRemove =
    update.remove || (update.isActive !== undefined && !stillMatches);

  const items = shouldRemove
    ? current.items.filter((item) => item.id !== id)
    : current.items.map((item) =>
        item.id === id
          ? { ...item, isActive: update.isActive ?? item.isActive }
          : item,
      );
  const total = shouldRemove ? Math.max(0, current.total - 1) : current.total;

  return {
    ...current,
    items,
    total,
    totalPages: Math.max(1, Math.ceil(total / current.pageSize)),
  };
}

interface InstitutionDomainActionsDropdownProps {
  domain: InstitutionDomainItem;
  /** Exact query key of the page this row belongs to. */
  queryKey: readonly unknown[];
  /** Active status filter — drives optimistic removal on a state flip. */
  status: InstitutionDomainStatusFilter;
}

/** Per-row actions for an approved institution domain: activate/deactivate or
 *  delete (with confirmation). Mirrors the AdminActionsDropdown pattern. */
export function InstitutionDomainActionsDropdown({
  domain,
  queryKey,
  status,
}: InstitutionDomainActionsDropdownProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(
    null,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const toggleMutation = useMutation({
    mutationFn: (isActive: boolean) =>
      toggleInstitutionDomainActive(domain.id, isActive),
    onMutate: async (isActive) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<
        AdminPage<InstitutionDomainItem>
      >(queryKey);
      queryClient.setQueryData<AdminPage<InstitutionDomainItem> | undefined>(
        queryKey,
        (old) => patchDomainPage(old, domain.id, { isActive }, status),
      );
      return { previous };
    },
    onSuccess: (result) => {
      queryClient.setQueryData<AdminPage<InstitutionDomainItem> | undefined>(
        queryKey,
        (old) =>
          old
            ? {
                ...old,
                items: old.items.map((item) =>
                  item.id === result.data.id ? result.data : item,
                ),
              }
            : old,
      );
      toast(
        result.data.isActive ? "Domain activated." : "Domain deactivated.",
        "success",
      );
      void queryClient.invalidateQueries({
        queryKey: ["admin-institution-domains"],
      });
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(queryKey, context?.previous);
      toast("Failed to update domain.", "error");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteInstitutionDomain(domain.id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<
        AdminPage<InstitutionDomainItem>
      >(queryKey);
      queryClient.setQueryData<AdminPage<InstitutionDomainItem> | undefined>(
        queryKey,
        (old) => patchDomainPage(old, domain.id, { remove: true }, status),
      );
      return { previous };
    },
    onSuccess: () => {
      toast("Domain removed.", "success");
      void queryClient.invalidateQueries({
        queryKey: ["admin-institution-domains"],
      });
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(queryKey, context?.previous);
      toast("Failed to remove domain.", "error");
    },
    onSettled: () => {
      setConfirmOpen(false);
      setOpen(false);
    },
  });

  const isPending = toggleMutation.isPending || deleteMutation.isPending;

  useEffect(() => {
    if (!open) return;

    const onDocMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (btnRef.current?.contains(target)) return;
      setOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    // A fixed-position portal menu can't follow its anchor through scrolling
    // or layout changes — close it instead of letting it float detached.
    const onScrollOrResize = () => setOpen(false);

    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  return (
    <>
      <div className="relative">
        <button
          ref={btnRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          disabled={isPending}
          onClick={() => {
            const rect = btnRef.current?.getBoundingClientRect();
            if (rect) {
              setMenuPos({
                top: rect.bottom + 6,
                right: Math.max(8, window.innerWidth - rect.right),
              });
            }
            setOpen((value) => !value);
          }}
          className="sb-menu-trigger"
          aria-label={`Actions for ${domain.domain}`}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MoreHorizontal className="h-4 w-4" />
          )}
        </button>

        {open &&
          !isPending &&
          menuPos &&
          createPortal(
            <div
              ref={menuRef}
              role="menu"
              className="sb-menu fixed z-menu w-48"
              style={{ top: menuPos.top, right: menuPos.right }}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  toggleMutation.mutate(!domain.isActive);
                }}
                className="sb-menu-item flex items-center gap-2"
              >
                {domain.isActive ? (
                  <ToggleLeft className="h-4 w-4" />
                ) : (
                  <ToggleRight className="h-4 w-4" />
                )}
                <span>{domain.isActive ? "Deactivate" : "Activate"}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  setConfirmOpen(true);
                }}
                className="sb-menu-item flex items-center gap-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-400/10"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete</span>
              </button>
            </div>,
            document.body,
          )}
      </div>

      <ConfirmationModal
        isOpen={confirmOpen}
        onClose={() => {
          if (!deleteMutation.isPending) setConfirmOpen(false);
        }}
        onConfirm={() => deleteMutation.mutate()}
        title="Remove approved domain?"
        message={`Users from ${domain.domain} will no longer be able to sign up with the institutional badge. This cannot be undone.`}
        isConfirming={deleteMutation.isPending}
        confirmLabel="Remove domain"
        confirmingLabel="Removing..."
        confirmVariant="destructive"
      />
    </>
  );
}
