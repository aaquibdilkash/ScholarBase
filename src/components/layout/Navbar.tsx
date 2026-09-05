import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { SBIcon } from "@/components/SBIcon";
import MobileSidebarToggle from "@/components/layout/MobileSidebarToggle";
import UserActionsDropdown from "./UserActionsDropdown";
import NavLoginButton from "./NavLoginButton";
import SignOutButton from "@/components/auth/SignOutButton";
import NotificationBadge from "./NotificationBadge";
import type { User } from "@supabase/supabase-js";

export default function Navbar({
  user,
  unreadCount = 0,
}: {
  user: User | null;
  unreadCount?: number;
}) {
  return (
    <nav className="sticky top-0 z-10 shadow-sm border-b border-slate-200/70 sb-navbar-bg backdrop-blur-xl dark:border-slate-800/80">
      <div className="sb-shell relative flex min-h-14 items-center gap-2 py-2 sm:min-h-16 sm:py-3">
        <Link href="/" className="hidden items-center gap-3 md:flex">
          <SBIcon className="h-10 w-10 text-[18px]" />
          <div className="leading-tight">
            <div className="text-base font-semibold tracking-tight">
              <BrandMark />
            </div>

            <div className="hidden text-xs text-slate-500 dark:text-slate-400 sm:block">
              Research Community Platform
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
                <NotificationBadge initialUnreadCount={unreadCount} />
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
