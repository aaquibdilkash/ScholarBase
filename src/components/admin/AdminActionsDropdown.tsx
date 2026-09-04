"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  MoreHorizontal,
  Trash2,
  Snowflake,
  RefreshCw,
  Undo2,
  FileText,
} from "lucide-react";
import { moderateContent } from "@/app/actions/reports";
import { getReportsForEntity } from "@/app/actions/admin";
import { useToast } from "@/components/ui/Toast";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import {
  patchAdminContentCache,
  adjustAdminStatsCache,
} from "@/lib/adminCache";
import type { AdminContentItem } from "@/types/admin";
import type { ModerationAction } from "@/types/reports";

const clsx = (...inputs: Array<string | false | null | undefined>) =>
  inputs.filter(Boolean).join(" ");

interface AdminActionsDropdownProps {
  contentType: string;
  contentId: string;
  /** Admin sidebar section id — used to patch stats cards optimistically. */
  sectionId: string;
  /** Current report count — shown as a badge in the trigger */
  reportCount?: number;
  /** Comments have no isFrozen flag — hide the Freeze option for them. */
  showFreeze?: boolean;
  /** When true, the dropdown is disabled (e.g. during a mutation) */
  disabled?: boolean;
  /** Noun used in menu labels — e.g. "User" → "Freeze User" / "Delete User".
   *  Defaults to "Content". */
  entityLabel?: string;
  /** Current frozen state — switches the menu item to "Unfreeze {label}"
   *  and dispatches the UNFREEZE action instead of FREEZE. */
  isFrozen?: boolean;
  /** Already soft-deleted rows cannot be deleted again or dismissed —
   *  hides the Delete and Dismiss Reports options. */
  isDeleted?: boolean;
  /** Whether the owner has appealed against a freeze/delete — shows the
   *  "Dismiss Appeal" option so moderators can acknowledge it. */
  hasActiveAppeal?: boolean;
}

export function AdminActionsDropdown({
  contentType,
  contentId,
  sectionId,
  reportCount = 0,
  showFreeze = true,
  disabled = false,
  entityLabel = "Content",
  isFrozen = false,
  isDeleted = false,
  hasActiveAppeal = false,
}: AdminActionsDropdownProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(
    null,
  );
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ModerationAction | null>(
    null,
  );
  // Reports inspection drawer — opens when "View Reports" is clicked (QA #11).
  const [inspectOpen, setInspectOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const { data: reports = [] } = useQuery({
    queryKey: ["reports-for-entity", contentId],
    queryFn: () => getReportsForEntity(contentId),
    staleTime: 30_000,
    enabled: inspectOpen,
  });

  const mutation = useMutation({
    mutationFn: (action: ModerationAction) =>
      moderateContent(action, contentType, contentId),
    // RULE 1 + Optimistic UI: patch the cached rows instantly, then sync
    // with the server truth returned by the Server Action. No refetch.
    onMutate: async (action) => {
      const optimisticPatch: Partial<AdminContentItem> =
        action === "FREEZE"
          ? { isFrozen: true }
          : action === "UNFREEZE"
            ? { isFrozen: false }
            : action === "DELETE"
              ? { isDeleted: true, isFrozen: true }
              : action === "RECOVER"
                ? { isDeleted: false, isFrozen: false, hasActiveAppeal: false }
                : action === "DISMISS_APPEAL"
                  ? { hasActiveAppeal: false }
                  : { reportCount: 0 };
      // Snapshot every affected cache entry for rollback on failure.
      const snapshots = queryClient.getQueriesData<{
        items: AdminContentItem[];
      }>({ queryKey: ["admin-content"] });
      patchAdminContentCache(queryClient, contentId, optimisticPatch);
      return { snapshots };
    },
    onSuccess: (result: {
      action: ModerationAction;
      success: boolean;
      data: {
        id: string;
        isFrozen?: boolean;
        isDeleted?: boolean;
        reportCount?: number;
        removed?: boolean;
      };
    }) => {
      const noun = entityLabel.toLowerCase();
      const messages: Record<ModerationAction, string> = {
        FREEZE: `${entityLabel} frozen successfully`,
        UNFREEZE: `${entityLabel} unfrozen successfully`,
        DELETE: `${entityLabel} deleted successfully`,
        RECOVER: `${entityLabel} recovered successfully`,
        DISMISS_REPORTS: `Reports on this ${noun} dismissed successfully`,
        DISMISS_APPEAL: `Appeal on this ${noun} acknowledged successfully`,
      };
      toast({
        title: "Success",
        description:
          messages[result.action] ?? "Action completed successfully.",
      });
      // Sync with the server truth (no refetch). Comments are soft-deleted
      // now (RULE 4), so rows are always patched, never removed. Only include
      // fields the server actually returned — DISMISS_REPORTS returns just
      // { id } and the count was already zeroed optimistically above, so we
      // must not overwrite cache values with `undefined`.
      const syncPatch: Partial<AdminContentItem> = {};
      if (result.data.isFrozen !== undefined)
        syncPatch.isFrozen = result.data.isFrozen;
      if (result.data.isDeleted !== undefined)
        syncPatch.isDeleted = result.data.isDeleted;
      if (result.data.reportCount !== undefined)
        syncPatch.reportCount = result.data.reportCount;
      if (Object.keys(syncPatch).length > 0) {
        patchAdminContentCache(queryClient, contentId, syncPatch);
      }
      if (result.action === "DELETE") {
        adjustAdminStatsCache(queryClient, sectionId, -1);
      } else if (result.action === "RECOVER") {
        adjustAdminStatsCache(queryClient, sectionId, 1);
      }
    },
    onError: (error: Error, _action, context) => {
      // Roll back the optimistic patches.
      context?.snapshots.forEach(([key, value]) =>
        queryClient.setQueryData(key, value),
      );
      toast({
        title: "Error",
        description: error.message ?? "Action failed. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Click / Escape outside to close dropdown — same pattern as
  // OwnerActionsDropdown (no extra deps).
  useEffect(() => {
    if (!open) return;

    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (btnRef.current?.contains(target)) return;
      setOpen(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
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

  const isPending = mutation.isPending;

  // Every moderation action is destructive or state-changing — all of them
  // require confirmation (freeze, delete, dismiss reports).
  const CONFIRM_META: Record<
    ModerationAction,
    { title: string; message: string; confirmLabel: string }
  > = {
    FREEZE: {
      title: `Confirm Freeze`,
      message: `Are you sure you want to freeze this ${entityLabel.toLowerCase()}? It will be hidden from the platform until unfrozen.`,
      confirmLabel: `Freeze ${entityLabel}`,
    },
    UNFREEZE: {
      title: `Confirm Unfreeze`,
      message: `Are you sure you want to unfreeze this ${entityLabel.toLowerCase()}? It will become visible on the platform again.`,
      confirmLabel: `Unfreeze ${entityLabel}`,
    },
    DELETE: {
      title: `Confirm Deletion`,
      message: `Are you sure you want to delete this ${entityLabel.toLowerCase()}? This action cannot be undone.`,
      confirmLabel: `Delete ${entityLabel}`,
    },
    RECOVER: {
      title: `Confirm Recover`,
      message: `Are you sure you want to recover this ${entityLabel.toLowerCase()}? It will be restored to the platform and become visible again.`,
      confirmLabel: `Recover ${entityLabel}`,
    },
    DISMISS_REPORTS: {
      title: "Confirm Dismiss Reports",
      message: `Are you sure you want to dismiss all reports on this ${entityLabel.toLowerCase()}? The report count will be reset.`,
      confirmLabel: "Dismiss Reports",
    },
    DISMISS_APPEAL: {
      title: "Confirm Dismiss Appeal",
      message: `Are you sure you want to acknowledge the owner's appeal on this ${entityLabel.toLowerCase()}? The appeal notice will be cleared.`,
      confirmLabel: "Acknowledge Appeal",
    },
  };

  const handleAction = (action: ModerationAction) => {
    setConfirmAction(action);
    setIsConfirmOpen(true);
    setOpen(false);
  };

  const confirmAndExecute = () => {
    if (!confirmAction) return;
    mutation.mutate(confirmAction);
    setIsConfirmOpen(false);
    setConfirmAction(null);
  };

  return (
    <>
      <div className="relative">
          <button
            ref={btnRef}
            type="button"
            aria-haspopup="menu"
            aria-expanded={open}
            disabled={disabled || isPending}
            onClick={() => {
              // Anchor the portal menu to the trigger's viewport position so it
              // renders below the button yet can never be clipped by scroll
              // containers (e.g. the table's overflow-x-auto wrapper).
              const rect = btnRef.current?.getBoundingClientRect();
              if (rect) {
                setMenuPos({
                  top: rect.bottom + 6,
                  right: Math.max(8, window.innerWidth - rect.right),
                });
              }
              setOpen((v) => !v);
            }}
            className={clsx(
              "sb-menu-trigger inline-flex items-center justify-center",
              isPending && "opacity-50",
            )}
            aria-label="Admin content actions"
          >
            {/* Trigger must contain ONLY the kebab icon — report counts are
                displayed exclusively in the "Reports" column badge. */}
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {open &&
            !isPending &&
            menuPos &&
            createPortal(
              <div
                ref={menuRef}
                role="menu"
                className="sb-menu fixed z-[70] w-48"
                style={{ top: menuPos.top, right: menuPos.right }}
              >
                <div>
                  {showFreeze && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() =>
                        handleAction(isFrozen ? "UNFREEZE" : "FREEZE")
                      }
                      className="sb-menu-item flex items-center gap-2"
                    >
                      <Snowflake className="h-4 w-4" />
                      <span>
                        {isFrozen ? "Unfreeze" : "Freeze"} {entityLabel}
                      </span>
                    </button>
                  )}
                  {(reportCount > 0 || !isDeleted) && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleAction("DISMISS_REPORTS")}
                      className="sb-menu-item flex items-center gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      <span>Dismiss Reports</span>
                    </button>
                  )}
                  {hasActiveAppeal && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleAction("DISMISS_APPEAL")}
                      className="sb-menu-item flex items-center gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      <span>Dismiss Appeal</span>
                    </button>
                  )}
                  {isDeleted && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleAction("RECOVER")}
                      className="sb-menu-item flex items-center gap-2"
                    >
                      <Undo2 className="h-4 w-4" />
                      <span>Recover {entityLabel}</span>
                    </button>
                  )}
                  {!isDeleted && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleAction("DELETE")}
                      className="sb-menu-item flex items-center gap-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-400/10"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Delete {entityLabel}</span>
                    </button>
                  )}
                  {(reportCount > 0 || reports.length > 0) && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => setInspectOpen(true)}
                      className="sb-menu-item flex items-center gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      <span>View Reports</span>
                      {reportCount > 0 && (
                        <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-xs">
                          {reportCount}
                        </span>
                      )}
                    </button>
                  )}
                </div>
              </div>,
              document.body,
            )}
      </div>

      <ConfirmationModal
        isOpen={isConfirmOpen}
        onClose={() => {
          setIsConfirmOpen(false);
          setConfirmAction(null);
        }}
        onConfirm={confirmAndExecute}
        title={confirmAction ? CONFIRM_META[confirmAction].title : ""}
        message={confirmAction ? CONFIRM_META[confirmAction].message : ""}
        confirmLabel={
          confirmAction ? CONFIRM_META[confirmAction].confirmLabel : "Confirm"
        }
                confirmingLabel="Processing..."
        isConfirming={isPending}
      />

      {/* Reports inspection drawer (QA #11) */}
      {inspectOpen &&
        createPortal(
          <div className="fixed inset-0 z-[80] flex items-end justify-end">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setInspectOpen(false)}
            />
            <div className="relative z-[81] h-[500px] w-96 overflow-y-auto bg-popover shadow-lg">
              <div className="sticky top-0 flex items-center justify-between border-b p-4">
                <h3 className="font-semibold">Reports on {entityLabel}</h3>
                <button
                  onClick={() => setInspectOpen(false)}
                  className="text-sm underline"
                >
                  Close
                </button>
              </div>
              <div className="p-4 space-y-4">
                {reports.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No pending reports.
                  </p>
                ) : (
                  reports.map((report) => (
                    <div
                      key={report.id}
                      className="space-y-1 border-l-2 pl-3"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium uppercase">
                          {report.category}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(report.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm">
                        {report.reporter?.name ?? report.reporter?.email ??
                          "Anonymous"}
                      </p>
                      {report.details && (
                        <p className="text-sm text-muted-foreground">
                          {report.details}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
