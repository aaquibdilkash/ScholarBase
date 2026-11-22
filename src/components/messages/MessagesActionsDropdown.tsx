"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ChevronDown, MessageCircle, Users } from "lucide-react";
import { EnablePushButton } from "@/components/push/EnablePushButton";

export function MessagesActionsDropdown({ onNavigate }: { onNavigate?: () => void }) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const touchHandledRef = useRef(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const menuWidth = 224;
      const rightSideLeft = rect.right + 4;
      const leftSideLeft = rect.left - menuWidth - 4;
      const left = rightSideLeft + menuWidth <= window.innerWidth - 8
        ? rightSideLeft
        : leftSideLeft;
      setMenuPosition({
        top: rect.bottom + 4,
        left: Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8)),
      });
    };
    updatePosition();
    const transitionTimer = window.setTimeout(updatePosition, 350);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.clearTimeout(transitionTimer);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  const navigate = () => {
    setOpen(false);
    onNavigate?.();
  };

  const toggleMenu = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuWidth = 224;
    const rightSideLeft = rect.right + 4;
    const leftSideLeft = rect.left - menuWidth - 4;
    const left = rightSideLeft + menuWidth <= window.innerWidth - 8
      ? rightSideLeft
      : leftSideLeft;
    setMenuPosition({
      top: rect.bottom + 4,
      left: Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8)),
    });
    setOpen(true);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== "touch") return;
    event.preventDefault();
    event.stopPropagation();
    touchHandledRef.current = true;
    toggleMenu();
  };

  const handleClick = () => {
    if (touchHandledRef.current) {
      touchHandledRef.current = false;
      return;
    }
    toggleMenu();
  };

  return (
    <div className="relative z-50 shrink-0">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Message actions"
        onPointerDown={handlePointerDown}
        onClick={handleClick}
        onTouchStart={(event) => event.stopPropagation()}
        className="sb-menu-trigger relative z-10 h-8 w-8 shrink-0 sm:h-9 sm:w-9"
      >
        <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5" />
      </button>
      {open && menuPosition && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="sb-menu sb-menu-navbar fixed z-navbar w-56"
          style={{ top: menuPosition.top, left: menuPosition.left }}
          onTouchStart={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <ul className="m-0 list-none p-0">
            <li>
              <Link prefetch={false} role="menuitem" href="/messages/new" onClick={navigate} className="sb-menu-item flex items-center gap-2 px-3 py-1.5 text-[13px] sm:px-4 sm:py-2 sm:text-sm">
                <MessageCircle className="h-4 w-4 shrink-0" />
                New Chat
              </Link>
            </li>
            <li>
              <Link prefetch={false} role="menuitem" href="/messages/new?group=1" onClick={navigate} className="sb-menu-item flex items-center gap-2 px-3 py-1.5 text-[13px] sm:px-4 sm:py-2 sm:text-sm">
                <Users className="h-4 w-4 shrink-0" />
                New Group
              </Link>
            </li>
            <li>
              <EnablePushButton variant="menu" />
            </li>
          </ul>
        </div>,
        document.body,
      )}
    </div>
  );
}
