"use client";

import { Menu } from "lucide-react";
import { useNavigationDrawer } from "@/components/layout/NavigationDrawerProvider";

export default function MobileSidebarToggle() {
  const { toggle } = useNavigationDrawer();
  return (
    <button
      type="button"
      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border sb-soft text-slate-700 shadow-sm transition hover:text-slate-950 sm:h-11 sm:w-11 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:text-white lg:hidden"
      aria-label="Toggle navigation"
      onClick={toggle}
    >
      <Menu className="h-5 w-5 sm:h-6 sm:w-6" />
    </button>
  );
}
