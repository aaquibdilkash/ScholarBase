import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { BrandMark } from "@/components/BrandMark";
import MobileSidebarToggle from "@/components/layout/MobileSidebarToggle";

export default async function Navbar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <nav className="sticky top-0 z-10 border-b border-white/70 bg-white/70 backdrop-blur-xl">
      <div className="sb-shell relative flex min-h-16 items-center gap-3 py-3">
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
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-lg font-semibold tracking-tight md:hidden"
        >
          <BrandMark />
        </Link>

        <div className="ml-auto flex items-center gap-3 sm:gap-4">
          {user ? (
            <Link
              href={`/scholar/${user.id}`}
              className="sb-button-soft px-4 py-2"
              aria-label="Open profile"
            >
              Profile
            </Link>
          ) : (
            <Link href="/login" className="sb-button-accent">
              Log In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
