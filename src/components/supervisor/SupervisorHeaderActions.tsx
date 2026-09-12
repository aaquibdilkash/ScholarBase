"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, MoreHorizontal } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/Toast";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { deleteRecommendation as deleteRecommendationAction } from "@/app/actions/recommendations";
import { decrementRecommendation } from "./recommendationCount";
import type { RecommendationWithAuthor } from "@/types/cards";

type Props = {
  supervisorId: string;
  isSupervisorOwner: boolean;
  supervisorEditHref: string;
  onDeleteSupervisor: () => unknown | Promise<unknown>;
  initialHasRecommendation: boolean;
  initialUserRecommendationId?: string | null;
};
export function SupervisorHeaderActions({
  supervisorId,
  isSupervisorOwner,
  supervisorEditHref,
  onDeleteSupervisor,
  initialHasRecommendation,
  initialUserRecommendationId,
}: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<"supervisor" | "recommendation" | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const { data: activeRecId } = useQuery({
    queryKey: ["user_rec_status", supervisorId],
    queryFn: () => initialUserRecommendationId ?? null,
    initialData: initialUserRecommendationId ?? null,
    staleTime: Infinity,
  });
  const hasRec = Boolean(initialHasRecommendation && activeRecId);
  const recId = activeRecId ?? undefined;
  const deleteRecMutation = useMutation({ mutationFn: deleteRecommendationAction });

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t)) return;
      if (btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  if (!isSupervisorOwner && !hasRec) {
    return (
      <Link prefetch={false} href={`/supervisor/${supervisorId}/recommendation/add`} className="sb-button-primary w-auto">
        + Recommend
      </Link>
    );
  }

  const confirmDelete = () => {
    if (pendingDelete === "supervisor") {
      startDeleteTransition(async () => {
        const result = (await onDeleteSupervisor()) as
          | { redirect?: string; refresh?: boolean; invalidateQueries?: unknown[][] }
          | undefined;
        setPendingDelete(null);
        if (result?.redirect) {
          result.invalidateQueries?.forEach((key) =>
            queryClient.invalidateQueries({ queryKey: key as string[] }),
          );
          router.push(result.redirect);
          toast("Supervisor deleted successfully.", "success");
        } else if (result?.refresh === false) {
          return;
        } else {
          router.refresh();
          toast("Supervisor deleted successfully.", "success");
        }
      });
    } else if (pendingDelete === "recommendation" && recId) {
      startDeleteTransition(async () => {
        try {
          const response = await deleteRecMutation.mutateAsync(recId);
          if (!response?.success || !response.data) {
            toast("Failed to delete recommendation.", "error");
            return;
          }
          queryClient.setQueriesData(
            { queryKey: ["recommendations", supervisorId] },
            (oldData: RecommendationWithAuthor[] = []) =>
              oldData.filter((r) => r.id !== response.data.deletedId),
          );
          queryClient.invalidateQueries({ queryKey: ["recommendations", supervisorId] });
          const cached =
            queryClient.getQueryData<RecommendationWithAuthor[]>(["recommendations", supervisorId]) ?? [];
          const deleted = cached.find((r) => (r.id ?? r.author?.id) === response.data.deletedId);
          decrementRecommendation(queryClient, supervisorId, deleted?.rating ?? 5);
          queryClient.setQueryData(["user_rec_status", supervisorId], null);
          toast("Recommendation deleted successfully", "success");
        } catch (error) {
          toast((error as Error).message, "error");
        } finally {
          setPendingDelete(null);
          setOpen(false);
        }
      });
    }
  };

  return (
    <>
      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            ref={btnRef}
            type="button"
            aria-haspopup="menu"
            aria-expanded={open}
            disabled={isDeleting}
            onClick={() => setOpen((v) => !v)}
            className="sb-menu-trigger"
          >
            {isDeleting ? <Loader2 className="animate-spin h-4 w-4" /> : <MoreHorizontal className="h-4 w-4" />}
            <span className="sr-only">Open actions</span>
          </button>
          {open && !isDeleting && (
            <div ref={menuRef} role="menu" className="sb-menu absolute right-0 z-50 mt-2 w-48">
              <div>
                {isSupervisorOwner && (
                  <>
                    <Link prefetch={false} role="menuitem" href={supervisorEditHref} className="sb-menu-item" onClick={() => setOpen(false)}>
                      Edit Supervisor
                    </Link>
                    <button type="button" role="menuitem" onClick={() => { setOpen(false); setPendingDelete("supervisor"); }} className="sb-menu-item text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-400/10">
                      Delete Supervisor
                    </button>
                  </>
                )}
                {hasRec && recId && (
                  <>
                    <Link prefetch={false} role="menuitem" href={`/supervisor/${supervisorId}/recommendation/${recId}/edit`} className="sb-menu-item" onClick={() => setOpen(false)}>
                      Edit Recommendation
                    </Link>
                    <button type="button" role="menuitem" onClick={() => { setOpen(false); setPendingDelete("recommendation"); }} className="sb-menu-item text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-400/10">
                      Delete Recommendation
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
        {!hasRec && (
          <Link prefetch={false} href={`/supervisor/${supervisorId}/recommendation/add`} className="sb-button-primary w-auto">
            + Recommend
          </Link>
        )}
      </div>
      <ConfirmationModal
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="Confirm Deletion"
        message={
          pendingDelete === "supervisor"
            ? "Are you sure you want to delete this supervisor? This action cannot be undone."
            : "Are you sure you want to delete your recommendation? This action cannot be undone."
        }
        isConfirming={isDeleting}
      />
    </>
  );
}

