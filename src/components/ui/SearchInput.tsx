"use client";

import { Search } from "lucide-react";
import type { InputHTMLAttributes } from "react";

export function SearchInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={`relative ${className ?? ""}`.trim()}>
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
        aria-hidden="true"
      />
      <input
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
        {...props}
        className="sb-input w-full py-2.5 pl-10 pr-12"
      />
      <button
        type="submit"
        aria-label="Search"
        title="Search"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 cursor-pointer rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:hover:bg-slate-800 dark:hover:text-slate-100"
      >
        <Search className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}