"use client";
import { Menu } from "lucide-react";

export default function MobileSidebarToggle() {
  return (
    <button
      type="button"
      className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:text-white md:hidden"
      aria-label="Toggle navigation"
      onClick={() => {
        window.dispatchEvent(new CustomEvent("sb-toggle-sidebar"));
      }}
    >
      <Menu className="h-6 w-6" />
    </button>
  );
}
