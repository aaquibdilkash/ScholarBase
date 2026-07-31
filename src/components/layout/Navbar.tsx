import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { BrandMark } from "@/components/BrandMark";
import MobileSidebarToggle from "@/components/layout/MobileSidebarToggle";
import { signOut } from "@/app/actions/auth";
import UserActionsDropdown from "./UserActionsDropdown";
import prisma from "@/lib/db";
import NavLoginButton from "./NavLoginButton";

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
    <nav className="sticky top-0 z-10 border-b border-white/70 bg-white/70 backdrop-blur-xl">
      <div className="sb-shell relative flex min-h-14 items-center gap-2 py-2 sm:min-h-16 sm:py-3">
        <Link href="/" className="hidden items-center gap-3 md:flex">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white shadow-sm">
            SB
          </div>
          <div className="leading-tight">
            <div className="text-base font-semibold tracking-tight">
              <BrandMark />
            </div>
            <div className="hidden text-xs text-slate-500 sm:block">
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
              <div className="hidden md:flex items-center gap-2 sm:gap-3 md:gap-4">
                <Link
                  href="/notifications"
                  className="sb-button-soft p-2 relative"
                  aria-label="Notifications"
                >
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.172V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.172c0 .538-.214 1.055-.595 1.438L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold leading-none text-white">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </Link>
                <Link
                  href={`/scholar/${user.id}`}
                  className="sb-button-soft px-3 py-1.5 sm:px-4 sm:py-2"
                  aria-label="Open profile"
                >
                  Profile
                </Link>
                <form action={signOut}>
                  <button type="submit" className="sb-button-soft px-3 py-1.5 sm:px-4 sm:py-2">
                    Sign Out
                  </button>
                </form>
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
