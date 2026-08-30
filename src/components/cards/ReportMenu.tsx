"use client";

import { useState, useRef, useEffect } from "react";
import { Flag } from "lucide-react";
import { ReportModal } from "@/components/cards/ReportModal";
import { AppealButton } from "@/components/appeals/AppealButton";
import type { ReportEntityType, ReportModule } from "@/types/reports";

const clsx = (...inputs: Array<string | false | null | undefined>) =>
  inputs.filter(Boolean).join(" ");

interface ReportMenuProps {
  entityId: string;
  entityType: ReportEntityType;
  module: ReportModule;
  ownerId?: string | null;
  currentUserId?: string | null;
  isFrozen?: boolean;
  isDeleted?: boolean;
  hasActiveAppeal?: boolean;
}

export function ReportMenu({
  entityId,
  entityType,
  module,
  ownerId,
  currentUserId,
  isFrozen = false,
  isDeleted = false,
  hasActiveAppeal = false,
}: ReportMenuProps) {
  const [open, setOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const canAppeal =
    !hasActiveAppeal &&
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
                <div role="menuitem" className="sb-menu-item flex items-center gap-2">
                  <AppealButton
                    entityId={entityId}
                    module={module}
                    entityType={entityType === "COMMENT" ? "COMMENT" : "POST"}
                    hasActiveAppeal={hasActiveAppeal}
                  />
                </div>
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
    </>
  );
}
