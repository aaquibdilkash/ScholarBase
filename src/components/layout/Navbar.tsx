import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { BrandMark } from "@/components/BrandMark";
import MobileSidebarToggle from "@/components/layout/MobileSidebarToggle";
import UserActionsDropdown from "./UserActionsDropdown";
import prisma from "@/lib/db";
import NavLoginButton from "./NavLoginButton";
import { Bell } from "lucide-react";
import SignOutButton from "@/components/auth/SignOutButton";

export default async function Navbar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let unreadCount = 0;
  if (user) {
    unreadCount = await prisma.notification.count({
      where: { recipientId: user.id, readAt: null },
    });
  }

  return (
    <nav className="sticky top-0 z-10 border-b border-white/70 bg-white/70 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/90">
      <div className="sb-shell relative flex min-h-14 items-center gap-2 py-2 sm:min-h-16 sm:py-3">
        <Link href="/" className="hidden items-center gap-3 md:flex">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white shadow-sm dark:bg-white dark:text-slate-950">
            SB
          </div>
          <div className="leading-tight">
            <div className="text-base font-semibold tracking-tight">
              <BrandMark />
            </div>
            <div className="hidden text-xs text-slate-500 dark:text-slate-400 sm:block">
              Research, supervisors, and opportunities
            </div>
          </div>
        </Link>

        <MobileSidebarToggle />

        <Link
          href="/"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-base font-semibold tracking-tight md:hidden"
        >
          <BrandMark />
        </Link>

        <div className="ml-auto flex items-center gap-2 sm:gap-3 md:gap-4">
          {user ? (
            <>
              <div className="hidden items-center gap-2 sm:gap-3 md:flex md:gap-4">
                <Link
                  href="/notifications"
                  className="sb-button-soft relative p-2 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-800 dark:hover:bg-slate-800 dark:hover:text-white"
                  aria-label="Notifications"
                >
                  <Bell className="h-6 w-6" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold leading-none text-white">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </Link>
                <Link
                  href={`/scholars/${user.id}`}
                  className="sb-button-accent px-3 py-1.5 sm:px-4 sm:py-2"
                  aria-label="Open profile"
                >
                  Profile
                </Link>
                <SignOutButton className="sb-button-accent px-3 py-1.5 sm:px-4 sm:py-2">
                  Sign Out
                </SignOutButton>
              </div>
              <UserActionsDropdown user={user} unreadCount={unreadCount} />
            </>
          ) : (
            <NavLoginButton />
          )}
        </div>
      </div>
    </nav>
  );
}
