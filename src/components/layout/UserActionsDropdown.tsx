"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { ChevronDown } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";

export default function UserActionsDropdown({
  user,
  unreadCount = 0,
}: {
  user: User;
  unreadCount?: number;
}) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [optimisticUnreadCount, setOptimisticUnreadCount] = useState(unreadCount);

  useEffect(() => {
    setOptimisticUnreadCount(unreadCount);
  }, [unreadCount]);

  useEffect(() => {
    const handleRead = (event: Event) => {
      const { delta } = (event as CustomEvent<{ delta: number }>).detail || {};
      if (typeof delta === "number" && delta > 0) {
        setOptimisticUnreadCount((prev) => Math.max(0, prev - delta));
      }
    };

    const handleAllRead = () => {
      setOptimisticUnreadCount(0);
    };

    window.addEventListener("notification-read", handleRead);
    window.addEventListener("all-notifications-read", handleAllRead);
    return () => {
      window.removeEventListener("notification-read", handleRead);
      window.removeEventListener("all-notifications-read", handleAllRead);
    };
  }, []);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;

    const onDocClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (btnRef.current?.contains(target)) return;
      setOpen(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("touchstart", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("touchstart", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    const { error } = await createClient().auth.signOut();
    if (error) {
      setSigningOut(false);
      return;
    }

    setIsModalOpen(false);
    router.replace("/login");
    router.refresh();
  }, [router]);

  return (
    <div className="relative md:hidden">
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="sb-menu-trigger"
      >
        <ChevronDown className="h-5 w-5" />
        <span className="sr-only">Open user menu</span>
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="sb-menu absolute right-0 z-[100] mt-2 w-56"
        >
          <ul className="m-0 list-none p-0">
            <li>
              <Link
                role="menuitem"
                href={`/scholars/${user.id}`}
                className="sb-menu-item flex items-center px-4"
                onClick={() => setOpen(false)}
              >
                Profile
              </Link>
            </li>
            <li>
              <Link
                role="menuitem"
                href="/notifications"
                className="sb-menu-item flex items-center gap-2 px-4"
                onClick={() => setOpen(false)}
              >
                Notifications
                {optimisticUnreadCount > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-none text-white">
                    {optimisticUnreadCount > 99 ? "99+" : optimisticUnreadCount}
                  </span>
                )}
              </Link>
            </li>
            <li>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  setIsModalOpen(true);
                }}
                disabled={signingOut}
                className="sb-menu-item w-full text-left disabled:opacity-50 gap-2 px-4"
              >
                {signingOut ? "Signing out..." : "Sign Out"}
              </button>
            </li>
          </ul>
        </div>
      )}
      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleSignOut}
        title="Confirm Sign Out"
        message="Are you sure you want to sign out? You will be redirected to the login page."
        isConfirming={signingOut}
        confirmLabel="Sign Out"
        confirmingLabel="Signing out..."
        confirmVariant="outline"
      />
    </div>
  );
}
