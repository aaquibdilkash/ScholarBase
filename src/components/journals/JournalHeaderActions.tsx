"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, MoreHorizontal } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/Toast";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { deleteJournalReview as deleteReviewAction } from "@/app/actions/journalReviews";
import { decrementJournalReview } from "./journalReviewCount";
import type { JournalReviewWithAuthor } from "@/types/cards";

type Props = {
  journalId: string;
  isJournalOwner: boolean;
  journalEditHref: string;
  onDeleteJournal: () => unknown | Promise<unknown>;
  initialHasReview: boolean;
  initialUserReviewId?: string | null;
};
export function JournalHeaderActions({
  journalId,
  isJournalOwner,
  journalEditHref,
  onDeleteJournal,
  initialHasReview,
  initialUserReviewId,
}: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<"journal" | "review" | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const { data: activeReviewId } = useQuery({
    queryKey: ["user_review_status", journalId],
    queryFn: () => initialUserReviewId ?? null,
    initialData: initialUserReviewId ?? null,
    staleTime: Infinity,
  });
  const hasReview = Boolean(initialHasReview && activeReviewId);
  const reviewId = activeReviewId ?? undefined;
  const deleteReviewMutation = useMutation({ mutationFn: deleteReviewAction });

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

  if (!isJournalOwner && !hasReview) {
    return (
      <Link prefetch={false} href={`/journals/${journalId}/review/add`} className="sb-button-primary w-auto">
        + Review
      </Link>
    );
  }

  const confirmDelete = () => {
    if (pendingDelete === "journal") {
      startDeleteTransition(async () => {
        const result = (await onDeleteJournal()) as
          | { redirect?: string; refresh?: boolean; invalidateQueries?: unknown[][] }
          | undefined;
        setPendingDelete(null);
        if (result?.redirect) {
          result.invalidateQueries?.forEach((key) =>
            queryClient.invalidateQueries({ queryKey: key as string[] }),
          );
          router.push(result.redirect);
          toast("Journal deleted successfully.", "success");
        } else if (result?.refresh === false) {
          return;
        } else {
          router.refresh();
        }
      });
    } else if (pendingDelete === "review" && reviewId) {
      startDeleteTransition(async () => {
        try {
          const response = await deleteReviewMutation.mutateAsync(reviewId);
          if (!response?.success || !response.data) {
            toast("Failed to delete review.", "error");
            return;
          }
          // Remove from every cached list slice instantly.
          queryClient.setQueriesData(
            { queryKey: ["journalReviews", journalId] },
            (oldData: JournalReviewWithAuthor[] = []) =>
              oldData.filter((r) => r.id !== response.data.deletedId),
          );
          // Adjust the overall rating instantly from the cached rating.
          const cached =
            queryClient.getQueryData<JournalReviewWithAuthor[]>(["journalReviews", journalId]) ?? [];
          const deleted = cached.find((r) => (r.id ?? r.author?.id) === response.data.deletedId);
          decrementJournalReview(queryClient, journalId, deleted?.rating ?? 5);
          queryClient.setQueryData(["user_review_status", journalId], null);
          toast("Review deleted successfully", "success");
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
                {isJournalOwner && (
                  <>
                    <Link prefetch={false} role="menuitem" href={journalEditHref} className="sb-menu-item" onClick={() => setOpen(false)}>
                      Edit Journal
                    </Link>
                    <button type="button" role="menuitem" onClick={() => { setOpen(false); setPendingDelete("journal"); }} className="sb-menu-item text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-400/10">
                      Delete Journal
                    </button>
                  </>
                )}
                {hasReview && reviewId && (
                  <>
                    <Link prefetch={false} role="menuitem" href={`/journals/${journalId}/review/${reviewId}/edit`} className="sb-menu-item" onClick={() => setOpen(false)}>
                      Edit Review
                    </Link>
                    <button type="button" role="menuitem" onClick={() => { setOpen(false); setPendingDelete("review"); }} className="sb-menu-item text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-400/10">
                      Delete Review
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
        {!hasReview && (
          <Link prefetch={false} href={`/journals/${journalId}/review/add`} className="sb-button-primary w-auto">
            + Review
          </Link>
        )}
      </div>
            <ConfirmationModal
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="Confirm Deletion"
        message={
          pendingDelete === "journal"
            ? "Are you sure you want to delete this journal? This action cannot be undone."
            : "Are you sure you want to delete your review? This action cannot be undone."
        }
        isConfirming={isDeleting}
      />
    </>
  );
}

