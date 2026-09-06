"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { MoreHorizontal } from "lucide-react";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";

export type CommentActionsDropdownProps = {
  onEdit: () => void;
  onDelete: () => void | Promise<void>;
  /** Controls menu visibility — true for comment author, post author, or parent comment author. */
  isOwner: boolean;
  /** Only the comment's own author may edit (post/parent owners can only delete). */
  canEdit?: boolean;
  editLabel?: string;
  deleteLabel?: string;
};

export default function CommentActionsDropdown({
  onEdit,
  onDelete,
  isOwner,
  canEdit = true,
  editLabel = "Edit",
  deleteLabel = "Delete",
}: CommentActionsDropdownProps) {
  const [open, setOpen] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

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

  if (!isOwner) return null;

  const handleDelete = () => {
    setOpen(false);
    setIsModalOpen(true);
  };

  const confirmDelete = async () => {
    startDeleteTransition(async () => {
      await onDelete();
      setIsModalOpen(false);
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
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Open post actions</span>
        </button>

        {open && (
          <div
            ref={menuRef}
            role="menu"
            className="sb-menu absolute right-0 z-50 mt-2 w-40"
          >
            <div>
              {canEdit && (
                <button
                  type="button"
                  role="menuitem"
                  disabled={isDeleting}
                  onClick={() => {
                    setOpen(false);
                    onEdit();
                  }}
                  className="sb-menu-item"
                >
                  {editLabel}
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                disabled={isDeleting}
                onClick={handleDelete}
                className="sb-menu-item text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-400/10"
              >
                {deleteLabel}
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
        message="Are you sure you want to delete this comment? This action cannot be undone."
        isConfirming={isDeleting}
      />
    </>
  );
}
