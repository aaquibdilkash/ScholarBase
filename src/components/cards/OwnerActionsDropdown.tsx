"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";

export type OwnerActionsDropdownProps = {
  editHref: string;
  onDelete: () => void | Promise<{ redirect?: string } | void>;
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
      toast("Item deleted successfully.", "success");
      if (result?.redirect) {
        router.push(result.redirect);
      } else {
        router.refresh();
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
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {isDeleting ? (
            <svg
              className="animate-spin h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          ) : (
            <svg
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M7 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM7 13a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
            </svg>
          )}
          <span className="sr-only">
            {isDeleting ? deleteLoadingText : "Open post actions"}
          </span>
        </button>

        {open && !isDeleting && (
          <div
            ref={menuRef}
            role="menu"
            className="absolute right-0 z-50 mt-2 w-40 overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm"
          >
            <div className="py-1">
              <Link
                role="menuitem"
                href={editHref}
                className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => setOpen(false)}
              >
                {editLabel}
              </Link>
              <button
                type="button"
                role="menuitem"
                disabled={isDeleting}
                onClick={handleDelete}
                className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
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
      />
    </>
  );
}
