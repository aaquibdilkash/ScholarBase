"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

export type OwnerActionsDropdownProps = {
  editHref: string;
  onDelete: () => void;
  isOwner: boolean;
  editLabel?: string;
  deleteLabel?: string;
};

export default function OwnerActionsDropdown({
  editHref,
  onDelete,
  isOwner,
  editLabel = "Edit",
  deleteLabel = "Delete",
}: OwnerActionsDropdownProps) {
  const [open, setOpen] = useState(false);
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

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M7 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM7 13a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
        </svg>
        <span className="sr-only">Open post actions</span>
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute right-0 z-10 mt-2 w-40 overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm"
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
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
              className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            >
              {deleteLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
