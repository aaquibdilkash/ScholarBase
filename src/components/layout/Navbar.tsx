import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { BrandMark } from "@/components/BrandMark";

export default async function Navbar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <nav className="sticky top-0 z-10 border-b border-white/70 bg-white/70 backdrop-blur-xl">
      <div className="sb-shell flex min-h-16 flex-wrap items-center justify-between gap-3 py-3">
        <Link href="/" className="flex items-center gap-3">
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

        <div className="flex items-center gap-4">
          {!user && (
            <Link href="/login" className="sb-button-accent">
              Log In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
