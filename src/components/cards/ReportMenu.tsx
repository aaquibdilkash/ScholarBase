"use client";

import { useState, useRef, useEffect } from "react";
import { Flag, HelpCircle } from "lucide-react";
import { ReportModal } from "@/components/cards/ReportModal";
import { AppealModal } from "@/components/cards/AppealModal";
import type { ReportEntityType, ReportModule } from "@/types/reports";

const clsx = (...inputs: Array<string | false | null | undefined>) =>
  inputs.filter(Boolean).join(" ");

interface ReportMenuProps {
  entityId: string;
  entityType: ReportEntityType;
  module: ReportModule;
  /** The content-type key used by appealContent (e.g. "feed", "socialComment"). */
  contentType: string;
  ownerId?: string | null;
  currentUserId?: string | null;
  isFrozen?: boolean;
  isDeleted?: boolean;
  isAppealedByOwner?: boolean;
}

export function ReportMenu({
  entityId,
  entityType,
  module,
  contentType,
  ownerId,
  currentUserId,
  isFrozen = false,
  isDeleted = false,
  isAppealedByOwner = false,
}: ReportMenuProps) {
  const [open, setOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isAppealModalOpen, setIsAppealModalOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const canAppeal =
    !isAppealedByOwner &&
    (isFrozen || isDeleted) &&
    ownerId != null &&
    ownerId === currentUserId;

  // Click / Escape outside to close dropdown — same pattern as
  // OwnerActionsDropdown / CommentActionsDropdown (no extra deps).
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

  const handleReportClick = () => {
    setOpen(false);
    setIsReportModalOpen(true);
  };

  const handleAppealClick = () => {
    setOpen(false);
    setIsAppealModalOpen(true);
  };

  return (
    <>
      <div className="relative">
        <button
          ref={btnRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={clsx(
            "inline-flex h-8 w-8 items-center justify-center rounded-lg",
            "text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600",
            "focus:outline-none focus:ring-2 focus:ring-blue-500/10",
            "dark:hover:bg-slate-800 dark:hover:text-slate-300",
          )}
          aria-label="Report content"
          title="Report content"
        >
          <Flag className="h-4 w-4" />
        </button>

        {open && (
          <div
            ref={menuRef}
            role="menu"
            // Drop-UP: ReportMenu only ever sits in footer action rows, where
            // space below is bounded by the card edge / viewport — opening
            // upward guarantees the menu is never clipped.
            className="sb-menu absolute bottom-full right-0 z-50 mb-2 w-44"
          >
            <div>
              {canAppeal && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleAppealClick}
                  className="sb-menu-item flex items-center gap-2"
                >
                  <HelpCircle className="h-4 w-4" />
                  <span>Appeal Removal</span>
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={handleReportClick}
                className="sb-menu-item flex items-center gap-2"
              >
                <Flag className="h-4 w-4" />
                <span>Report Content</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        entityId={entityId}
        entityType={entityType}
        module={module}
      />

      <AppealModal
        isOpen={isAppealModalOpen}
        onClose={() => setIsAppealModalOpen(false)}
        entityId={entityId}
        contentType={contentType}
      />
    </>
  );
}
