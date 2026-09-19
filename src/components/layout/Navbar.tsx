import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { SBIcon } from "@/components/SBIcon";
import MobileSidebarToggle from "@/components/layout/MobileSidebarToggle";
import UserActionsDropdown from "./UserActionsDropdown";
import NavLoginButton from "./NavLoginButton";
import SignOutButton from "@/components/auth/SignOutButton";
import NotificationBadge from "./NotificationBadge";
import { EnablePushButton } from "@/components/push/EnablePushButton";
import type { User } from "@supabase/supabase-js";

/**
 * Navbar action pills are denser than the app-wide `sb-button-accent` button.
 * The bar has to hold three widths — phone, the tablet range in between, and
 * laptop — so label size and padding step up together at `sm` and `md`
 * instead of jumping straight to their full size at `sm`.
 */
const NAVBAR_ACTION =
  "sb-button-accent px-2.5 py-1.5 text-[11px] sm:px-3.5 sm:py-2 sm:text-xs md:px-4 md:py-2.5 md:text-sm";

export default function Navbar({
  user,
  unreadCount = 0,
}: {
  user: User | null;
  unreadCount?: number;
}) {
  return (
    <nav
      id="sb-navbar"
      className="sticky top-0 z-50 shrink-0 shadow-sm border-b border-slate-200/70 sb-navbar-bg backdrop-blur-xl dark:border-slate-800/80"
    >
      {/* Density steps with the viewport: phone -> tablet (`sm`) -> laptop (`md`). */}
      <div className="sb-shell relative flex min-h-14 items-center gap-2 py-2 sm:min-h-15 sm:py-2.5 md:min-h-16 md:py-3">
        <Link prefetch={false} href="/" className="hidden items-center gap-2.5 lg:flex lg:gap-3">
          <SBIcon className="h-9 w-9 text-base lg:h-10 lg:w-10 lg:text-[18px]" />
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight lg:text-base">
              <BrandMark />
            </div>

            <div className="text-[11px] text-slate-500 dark:text-slate-400 lg:text-xs">
              Research Community Platform
            </div>
          </div>
        </Link>

        <MobileSidebarToggle />

        <Link prefetch={false}
          href="/"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[15px] font-semibold tracking-tight sm:text-base lg:hidden"
        >
          <BrandMark />
        </Link>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2 md:gap-3">
          {user ? (
            <>
              {/* Desktop action cluster. The message-alert toggle lives in here
                  too, so smaller screens collapse to just the overflow
                  menu and every action is reachable from that one dropdown. */}
              <div className="hidden items-center gap-3 lg:flex">
                <EnablePushButton variant="navbar" />
                <NotificationBadge initialUnreadCount={unreadCount} />
                <Link prefetch={false}
                  href={`/scholars/${user.id}`}
                  className={NAVBAR_ACTION}
                  aria-label="Open profile"
                >
                  Profile
                </Link>
                <SignOutButton className={NAVBAR_ACTION}>
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
