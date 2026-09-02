"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, MoreHorizontal } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/Toast";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";

export type OwnerActionsDropdownProps = {
  editHref: string;
  onDelete: () => unknown | Promise<unknown>;
  isOwner: boolean;
  isAdmin?: boolean;
  editLabel?: string;
  deleteLabel?: string;
  deleteLoadingText?: string;
};

export default function OwnerActionsDropdown({
  editHref,
  onDelete,
  isOwner,
  isAdmin,
  editLabel = "Edit",
  deleteLabel = "Delete",
  deleteLoadingText = "Deleting...",
}: OwnerActionsDropdownProps) {
  const [open, setOpen] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

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

    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!isOwner && !isAdmin) return null;

  const handleDelete = () => {
    setIsModalOpen(true);
  };

  const confirmDelete = () => {
      startDeleteTransition(async () => {
        const result = await onDelete();
        const res = (result ?? undefined) as
          | { redirect?: string; refresh?: boolean; invalidateQueries?: unknown[][] }
          | undefined;
        setIsModalOpen(false);
        if (res?.redirect) {
          if (res.invalidateQueries) {
            res.invalidateQueries.forEach((key) =>
              queryClient.invalidateQueries({ queryKey: key }),
            );
          }
          router.push(res.redirect);
          toast("Item deleted successfully.", "success");
        } else if (res?.refresh === false) {
          return;
        } else {
          router.refresh();
          toast("Item deleted successfully.", "success");
        }
      });
    };

  return (
    <>
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
          {isDeleting ? (
            <Loader2 className="animate-spin h-4 w-4" />
          ) : (
            <MoreHorizontal className="h-4 w-4" />
          )}
          <span className="sr-only">
            {isDeleting ? deleteLoadingText : "Open post actions"}
          </span>
        </button>

        {open && !isDeleting && (
          <div
            ref={menuRef}
            role="menu"
            className="sb-menu absolute right-0 z-50 mt-2 w-40"
          >
            <div>
              <Link
                role="menuitem"
                href={editHref}
                className="sb-menu-item"
                onClick={() => setOpen(false)}
              >
                {editLabel}
              </Link>
              <button
                type="button"
                role="menuitem"
                disabled={isDeleting}
                onClick={handleDelete}
                className="sb-menu-item text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-400/10"
              >
                {isDeleting ? deleteLoadingText : deleteLabel}
              </button>
            </div>
          </div>
        )}
      </div>
      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={confirmDelete}
        title="Confirm Deletion"
        message="Are you sure you want to delete this item? This action cannot be undone."
        isConfirming={isDeleting}
      />
    </>
  );
}
